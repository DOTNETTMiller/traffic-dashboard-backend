/**
 * ITS Architecture Documentation API Routes
 *
 * RAD-IT-like functionality for managing regional ITS architecture
 * directly within the DOT Corridor Communicator
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const ArchitecturePDFGenerator = require('../utils/architecture-pdf-generator');
const path = require('path');
const fs = require('fs');

// ============================================================================
// STAKEHOLDERS
// ============================================================================

router.get('/stakeholders', async (req, res) => {
  try {
    const stakeholders = await db.allAsync(`
      SELECT * FROM arch_stakeholders
      WHERE active = 1
      ORDER BY name
    `);

    res.json({
      success: true,
      count: stakeholders.length,
      stakeholders: stakeholders.map(s => ({
        ...s,
        roles: safeJsonParse(s.roles)
      }))
    });
  } catch (error) {
    console.error('Error retrieving stakeholders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stakeholders', async (req, res) => {
  try {
    const {
      name, abbreviation, type, jurisdiction, primary_contact,
      email, phone, address, city, state, zip, roles, description, website
    } = req.body;

    const result = await db.runAsync(`
      INSERT INTO arch_stakeholders (
        name, abbreviation, type, jurisdiction, primary_contact,
        email, phone, address, city, state, zip, roles, description, website
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, abbreviation, type, jurisdiction, primary_contact,
      email, phone, address, city, state, zip,
      JSON.stringify(roles || []), description, website
    ]);

    res.json({
      success: true,
      stakeholder_id: result.lastID,
      message: 'Stakeholder created successfully'
    });
  } catch (error) {
    console.error('Error creating stakeholder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/stakeholders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Convert roles to JSON if provided
    if (updates.roles) {
      updates.roles = JSON.stringify(updates.roles);
    }

    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    await db.runAsync(`
      UPDATE arch_stakeholders
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, values);

    res.json({ success: true, message: 'Stakeholder updated' });
  } catch (error) {
    console.error('Error updating stakeholder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ELEMENTS (ITS Systems)
// ============================================================================

router.get('/elements', async (req, res) => {
  try {
    const { type, stakeholder_id, status } = req.query;

    let query = `
      SELECT e.*, s.name as stakeholder_name, s.abbreviation as stakeholder_abbr
      FROM arch_elements e
      LEFT JOIN arch_stakeholders s ON e.stakeholder_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND e.element_type = ?';
      params.push(type);
    }

    if (stakeholder_id) {
      query += ' AND e.stakeholder_id = ?';
      params.push(stakeholder_id);
    }

    if (status) {
      query += ' AND e.status = ?';
      params.push(status);
    }

    query += ' ORDER BY e.name';

    const elements = await db.allAsync(query, params);

    res.json({
      success: true,
      count: elements.length,
      elements: elements.map(e => ({
        ...e,
        standards: safeJsonParse(e.standards),
        capabilities: safeJsonParse(e.capabilities)
      }))
    });
  } catch (error) {
    console.error('Error retrieving elements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/elements', async (req, res) => {
  try {
    const {
      name, element_type, category, stakeholder_id, description,
      location, latitude, longitude, status, installation_date,
      vendor, model, software_version, standards, capabilities, notes
    } = req.body;

    const result = await db.runAsync(`
      INSERT INTO arch_elements (
        name, element_type, category, stakeholder_id, description,
        location, latitude, longitude, status, installation_date,
        vendor, model, software_version, standards, capabilities, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, element_type, category, stakeholder_id, description,
      location, latitude, longitude, status || 'planned', installation_date,
      vendor, model, software_version,
      JSON.stringify(standards || []),
      JSON.stringify(capabilities || []),
      notes
    ]);

    res.json({
      success: true,
      element_id: result.lastID,
      message: 'Element created successfully'
    });
  } catch (error) {
    console.error('Error creating element:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// INTERFACES (Data Flows)
// ============================================================================

router.get('/interfaces', async (req, res) => {
  try {
    const interfaces = await db.allAsync(`
      SELECT
        i.*,
        se.name as source_name,
        de.name as destination_name,
        ss.name as source_stakeholder,
        ds.name as destination_stakeholder
      FROM arch_interfaces i
      JOIN arch_elements se ON i.source_element_id = se.id
      JOIN arch_elements de ON i.destination_element_id = de.id
      LEFT JOIN arch_stakeholders ss ON se.stakeholder_id = ss.id
      LEFT JOIN arch_stakeholders ds ON de.stakeholder_id = ds.id
      ORDER BY i.name
    `);

    res.json({
      success: true,
      count: interfaces.length,
      interfaces: interfaces.map(i => ({
        ...i,
        information_flows: safeJsonParse(i.information_flows),
        standards: safeJsonParse(i.standards)
      }))
    });
  } catch (error) {
    console.error('Error retrieving interfaces:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/interfaces', async (req, res) => {
  try {
    const {
      name, source_element_id, destination_element_id, description,
      data_type, information_flows, protocol, standards,
      security_classification, frequency, bandwidth_requirements,
      latency_requirements, status, implementation_notes
    } = req.body;

    const result = await db.runAsync(`
      INSERT INTO arch_interfaces (
        name, source_element_id, destination_element_id, description,
        data_type, information_flows, protocol, standards,
        security_classification, frequency, bandwidth_requirements,
        latency_requirements, status, implementation_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, source_element_id, destination_element_id, description,
      data_type,
      JSON.stringify(information_flows || []),
      protocol,
      JSON.stringify(standards || []),
      security_classification, frequency, bandwidth_requirements,
      latency_requirements, status || 'planned', implementation_notes
    ]);

    res.json({
      success: true,
      interface_id: result.lastID,
      message: 'Interface created successfully'
    });
  } catch (error) {
    console.error('Error creating interface:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ARCHITECTURE DIAGRAM DATA
// ============================================================================

router.get('/diagram', async (req, res) => {
  try {
    // Get all elements with their positions for diagram
    const elements = await db.allAsync(`
      SELECT e.*, s.name as stakeholder_name, s.abbreviation as stakeholder_abbr
      FROM arch_elements e
      LEFT JOIN arch_stakeholders s ON e.stakeholder_id = s.id
    `);

    // Get all interfaces
    const interfaces = await db.allAsync(`
      SELECT * FROM arch_interfaces
    `);

    res.json({
      success: true,
      diagram: {
        elements: elements.map(e => ({
          id: e.id,
          name: e.name,
          type: e.element_type,
          category: e.category,
          stakeholder: e.stakeholder_abbr || e.stakeholder_name,
          status: e.status,
          latitude: e.latitude,
          longitude: e.longitude
        })),
        interfaces: interfaces.map(i => ({
          id: i.id,
          source: i.source_element_id,
          destination: i.destination_element_id,
          protocol: i.protocol,
          status: i.status
        }))
      }
    });
  } catch (error) {
    console.error('Error retrieving diagram data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// STANDARDS
// ============================================================================

router.get('/standards', async (req, res) => {
  try {
    const standards = await db.allAsync(`
      SELECT * FROM arch_standards
      ORDER BY organization, standard_id
    `);

    res.json({
      success: true,
      count: standards.length,
      standards: standards.map(s => ({
        ...s,
        related_standards: safeJsonParse(s.related_standards)
      }))
    });
  } catch (error) {
    console.error('Error retrieving standards:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/standards', async (req, res) => {
  try {
    const {
      standard_id, name, organization, category, version,
      description, document_url, purchase_url, scope, related_standards
    } = req.body;

    const result = await db.runAsync(`
      INSERT INTO arch_standards (
        standard_id, name, organization, category, version,
        description, document_url, purchase_url, scope, related_standards
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      standard_id, name, organization, category, version,
      description, document_url, purchase_url, scope,
      JSON.stringify(related_standards || [])
    ]);

    res.json({
      success: true,
      standard_db_id: result.lastID,
      message: 'Standard added successfully'
    });
  } catch (error) {
    console.error('Error creating standard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PROJECTS
// ============================================================================

router.get('/projects', async (req, res) => {
  try {
    const projects = await db.allAsync(`
      SELECT p.*, s.name as stakeholder_name
      FROM arch_projects p
      LEFT JOIN arch_stakeholders s ON p.stakeholder_id = s.id
      ORDER BY p.start_date DESC
    `);

    res.json({
      success: true,
      count: projects.length,
      projects: projects.map(p => ({
        ...p,
        service_packages: safeJsonParse(p.service_packages),
        elements_deployed: safeJsonParse(p.elements_deployed),
        funding_sources: safeJsonParse(p.funding_sources)
      }))
    });
  } catch (error) {
    console.error('Error retrieving projects:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/projects', async (req, res) => {
  try {
    const {
      name, project_id, description, stakeholder_id, project_type,
      service_packages, elements_deployed, scope, budget, funding_sources,
      start_date, completion_date, status, project_manager, contact_email,
      systems_engineering_required, se_documentation_path, notes
    } = req.body;

    const result = await db.runAsync(`
      INSERT INTO arch_projects (
        name, project_id, description, stakeholder_id, project_type,
        service_packages, elements_deployed, scope, budget, funding_sources,
        start_date, completion_date, status, project_manager, contact_email,
        systems_engineering_required, se_documentation_path, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, project_id, description, stakeholder_id, project_type,
      JSON.stringify(service_packages || []),
      JSON.stringify(elements_deployed || []),
      scope, budget,
      JSON.stringify(funding_sources || []),
      start_date, completion_date, status || 'planned',
      project_manager, contact_email,
      systems_engineering_required !== false ? 1 : 0,
      se_documentation_path, notes
    ]);

    res.json({
      success: true,
      project_db_id: result.lastID,
      message: 'Project created successfully'
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ARCHITECTURE METADATA
// ============================================================================

router.get('/metadata', async (req, res) => {
  try {
    const metadata = await db.getAsync(`
      SELECT m.*, s.name as maintainer_name
      FROM arch_metadata m
      LEFT JOIN arch_stakeholders s ON m.maintainer_stakeholder_id = s.id
      ORDER BY m.id DESC
      LIMIT 1
    `);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'No architecture metadata found'
      });
    }

    res.json({
      success: true,
      metadata: {
        ...metadata,
        goals: safeJsonParse(metadata.goals)
      }
    });
  } catch (error) {
    console.error('Error retrieving metadata:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/metadata', async (req, res) => {
  try {
    const {
      architecture_name, version, geographic_scope, time_horizon,
      maintainer_stakeholder_id, description, vision_statement,
      goals, certification_date, next_review_date
    } = req.body;

    await db.runAsync(`
      UPDATE arch_metadata SET
        architecture_name = ?,
        version = ?,
        geographic_scope = ?,
        time_horizon = ?,
        maintainer_stakeholder_id = ?,
        description = ?,
        vision_statement = ?,
        goals = ?,
        certification_date = ?,
        next_review_date = ?,
        last_updated = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      architecture_name, version, geographic_scope, time_horizon,
      maintainer_stakeholder_id, description, vision_statement,
      JSON.stringify(goals || []), certification_date, next_review_date
    ]);

    res.json({ success: true, message: 'Architecture metadata updated' });
  } catch (error) {
    console.error('Error updating metadata:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// AUTO-POPULATE FROM EXISTING DATA
// ============================================================================

router.post('/populate-from-equipment', async (req, res) => {
  try {
    // This endpoint will convert existing ITS equipment into architecture elements
    // Useful for bootstrapping the architecture from current inventory

    // Example: Convert ITS equipment to architecture elements
    const equipment = await db.allAsync(`
      SELECT * FROM its_equipment
    `);

    let created = 0;
    for (const item of equipment) {
      try {
        await db.runAsync(`
          INSERT OR IGNORE INTO arch_elements (
            name, element_type, category, description,
            location, latitude, longitude, status, vendor, model
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          item.equipment_name || `${item.equipment_type}-${item.id}`,
          'field',  // Most ITS equipment is field equipment
          item.equipment_category || 'Traffic Management',
          item.description,
          item.location,
          item.latitude,
          item.longitude,
          item.status || 'existing',
          item.manufacturer,
          item.model
        ]);
        created++;
      } catch (err) {
        // Skip duplicates
        console.log(`Skipped duplicate: ${item.equipment_name}`);
      }
    }

    res.json({
      success: true,
      message: `Created ${created} architecture elements from equipment inventory`
    });
  } catch (error) {
    console.error('Error populating from equipment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// EXPORT & REPORTING
// ============================================================================

/**
 * GET /api/architecture/export/pdf
 * Generate and download complete architecture as PDF
 */
router.get('/export/pdf', async (req, res) => {
  try {
    // Gather all architecture data
    const [metadata, stakeholders, elements, interfaces, standards, projects] = await Promise.all([
      db.getAsync('SELECT * FROM arch_metadata ORDER BY id DESC LIMIT 1'),
      db.allAsync('SELECT * FROM arch_stakeholders WHERE active = 1 ORDER BY name'),
      db.allAsync(`
        SELECT e.*, s.name as stakeholder_name
        FROM arch_elements e
        LEFT JOIN arch_stakeholders s ON e.stakeholder_id = s.id
        ORDER BY e.element_type, e.name
      `),
      db.allAsync(`
        SELECT i.*, se.name as source_name, de.name as destination_name,
               ss.name as source_stakeholder, ds.name as destination_stakeholder
        FROM arch_interfaces i
        JOIN arch_elements se ON i.source_element_id = se.id
        JOIN arch_elements de ON i.destination_element_id = de.id
        LEFT JOIN arch_stakeholders ss ON se.stakeholder_id = ss.id
        LEFT JOIN arch_stakeholders ds ON de.stakeholder_id = ds.id
        ORDER BY i.name
      `),
      db.allAsync('SELECT * FROM arch_standards ORDER BY organization, standard_id'),
      db.allAsync(`
        SELECT p.*, s.name as stakeholder_name
        FROM arch_projects p
        LEFT JOIN arch_stakeholders s ON p.stakeholder_id = s.id
        ORDER BY p.start_date DESC
      `)
    ]);

    const architectureData = {
      metadata: metadata || {},
      stakeholders: stakeholders.map(s => ({
        ...s,
        roles: safeJsonParse(s.roles)
      })),
      elements: elements.map(e => ({
        ...e,
        standards: safeJsonParse(e.standards),
        capabilities: safeJsonParse(e.capabilities)
      })),
      interfaces: interfaces.map(i => ({
        ...i,
        information_flows: safeJsonParse(i.information_flows),
        standards: safeJsonParse(i.standards)
      })),
      standards: standards.map(s => ({
        ...s,
        related_standards: safeJsonParse(s.related_standards)
      })),
      projects: projects.map(p => ({
        ...p,
        service_packages: safeJsonParse(p.service_packages),
        funding_sources: safeJsonParse(p.funding_sources)
      }))
    };

    // Generate PDF
    const generator = new ArchitecturePDFGenerator();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ITS_Architecture_${timestamp}.pdf`;
    const outputPath = path.join(__dirname, '..', 'data', filename);

    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    await generator.generatePDF(architectureData, outputPath);

    // Send file
    res.download(outputPath, filename, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
      }
      // Clean up file after download
      setTimeout(() => {
        fs.unlink(outputPath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting PDF:', unlinkErr);
        });
      }, 5000);
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/architecture/export/html
 * Generate and download architecture as static HTML website
 */
router.get('/export/html', async (req, res) => {
  try {
    // Gather all architecture data (same as PDF)
    const [metadata, stakeholders, elements, interfaces, standards, projects] = await Promise.all([
      db.getAsync('SELECT * FROM arch_metadata ORDER BY id DESC LIMIT 1'),
      db.allAsync('SELECT * FROM arch_stakeholders WHERE active = 1 ORDER BY name'),
      db.allAsync(`
        SELECT e.*, s.name as stakeholder_name
        FROM arch_elements e
        LEFT JOIN arch_stakeholders s ON e.stakeholder_id = s.id
        ORDER BY e.element_type, e.name
      `),
      db.allAsync(`
        SELECT i.*, se.name as source_name, de.name as destination_name
        FROM arch_interfaces i
        JOIN arch_elements se ON i.source_element_id = se.id
        JOIN arch_elements de ON i.destination_element_id = de.id
        ORDER BY i.name
      `),
      db.allAsync('SELECT * FROM arch_standards ORDER BY organization, standard_id'),
      db.allAsync(`
        SELECT p.*, s.name as stakeholder_name
        FROM arch_projects p
        LEFT JOIN arch_stakeholders s ON p.stakeholder_id = s.id
        ORDER BY p.start_date DESC
      `)
    ]);

    // Generate HTML
    const html = generateArchitectureHTML({
      metadata,
      stakeholders,
      elements,
      interfaces,
      standards,
      projects
    });

    // Create ZIP with HTML files
    const JSZip = require('jszip');
    const zip = new JSZip();

    zip.file('index.html', html.index);
    zip.file('stakeholders.html', html.stakeholders);
    zip.file('elements.html', html.elements);
    zip.file('interfaces.html', html.interfaces);
    zip.file('standards.html', html.standards);
    zip.file('projects.html', html.projects);
    zip.file('styles.css', html.css);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ITS_Architecture_${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zipBuffer);

  } catch (error) {
    console.error('Error generating HTML export:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/architecture/export/json
 * Export all architecture data as JSON
 */
router.get('/export/json', async (req, res) => {
  try {
    const [metadata, stakeholders, elements, interfaces, standards, projects, service_packages, agreements] = await Promise.all([
      db.getAsync('SELECT * FROM arch_metadata ORDER BY id DESC LIMIT 1'),
      db.allAsync('SELECT * FROM arch_stakeholders ORDER BY name'),
      db.allAsync('SELECT * FROM arch_elements ORDER BY name'),
      db.allAsync('SELECT * FROM arch_interfaces ORDER BY name'),
      db.allAsync('SELECT * FROM arch_standards ORDER BY standard_id'),
      db.allAsync('SELECT * FROM arch_projects ORDER BY name'),
      db.allAsync('SELECT * FROM arch_service_packages ORDER BY package_id'),
      db.allAsync('SELECT * FROM arch_agreements ORDER BY title')
    ]);

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      metadata,
      stakeholders,
      elements,
      interfaces,
      standards,
      projects,
      service_packages,
      agreements
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ITS_Architecture_${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);

  } catch (error) {
    console.error('Error exporting JSON:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function safeJsonParse(jsonString) {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return jsonString;
  }
}

/**
 * Generate static HTML website for architecture
 */
function generateArchitectureHTML(data) {
  const css = `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    h1 { margin: 0 0 10px 0; }
    nav {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    nav a {
      margin-right: 20px;
      color: #4285F4;
      text-decoration: none;
      font-weight: 500;
    }
    .content {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .card {
      background: #f8f9fa;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      border-left: 4px solid #4285F4;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 5px;
    }
    .badge-blue { background: #E8F0FE; color: #4285F4; }
    .badge-green { background: #E8F5E9; color: #2E7D32; }
    .badge-orange { background: #FFF3E0; color: #E65100; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #f8f9fa; font-weight: 600; }
  `;

  const navigation = `
    <nav>
      <a href="index.html">Overview</a>
      <a href="stakeholders.html">Stakeholders</a>
      <a href="elements.html">Elements</a>
      <a href="interfaces.html">Interfaces</a>
      <a href="standards.html">Standards</a>
      <a href="projects.html">Projects</a>
    </nav>
  `;

  return {
    css,
    index: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.metadata.architecture_name || 'ITS Architecture'}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <h1>${data.metadata.architecture_name || 'Regional ITS Architecture'}</h1>
    <p>${data.metadata.vision_statement || ''}</p>
  </header>
  ${navigation}
  <div class="content">
    <h2>Architecture Overview</h2>
    <div class="card">
      <h3>Scope</h3>
      <p><strong>Geographic:</strong> ${data.metadata.geographic_scope || 'N/A'}</p>
      <p><strong>Time Horizon:</strong> ${data.metadata.time_horizon || 'N/A'}</p>
      <p><strong>Version:</strong> ${data.metadata.version || '1.0'}</p>
    </div>
    <h3>Statistics</h3>
    <table>
      <tr><th>Component</th><th>Count</th></tr>
      <tr><td>Stakeholders</td><td>${data.stakeholders.length}</td></tr>
      <tr><td>ITS Elements</td><td>${data.elements.length}</td></tr>
      <tr><td>Interfaces</td><td>${data.interfaces.length}</td></tr>
      <tr><td>Standards</td><td>${data.standards.length}</td></tr>
      <tr><td>Projects</td><td>${data.projects.length}</td></tr>
    </table>
  </div>
</body>
</html>`,

    stakeholders: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Stakeholders - ITS Architecture</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header><h1>Stakeholders</h1></header>
  ${navigation}
  <div class="content">
    ${data.stakeholders.map(s => `
      <div class="card">
        <h3>${s.name} ${s.abbreviation ? `(${s.abbreviation})` : ''}</h3>
        <p><span class="badge badge-blue">${s.type.replace('_', ' ').toUpperCase()}</span></p>
        <p>${s.description || ''}</p>
        ${s.email ? `<p>📧 ${s.email}</p>` : ''}
      </div>
    `).join('')}
  </div>
</body>
</html>`,

    elements: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ITS Elements - ITS Architecture</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header><h1>ITS Elements</h1></header>
  ${navigation}
  <div class="content">
    <table>
      <thead>
        <tr><th>Name</th><th>Type</th><th>Owner</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${data.elements.map(e => `
          <tr>
            <td><strong>${e.name}</strong></td>
            <td><span class="badge badge-blue">${e.element_type}</span></td>
            <td>${e.stakeholder_name || 'N/A'}</td>
            <td><span class="badge badge-green">${e.status}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`,

    interfaces: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Interfaces - ITS Architecture</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header><h1>Interfaces & Data Flows</h1></header>
  ${navigation}
  <div class="content">
    ${data.interfaces.map(i => `
      <div class="card">
        <h3>${i.name}</h3>
        <p>${i.source_name} → ${i.destination_name}</p>
        <p><strong>Protocol:</strong> ${i.protocol || 'N/A'}</p>
        <p>${i.description || ''}</p>
      </div>
    `).join('')}
  </div>
</body>
</html>`,

    standards: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Standards - ITS Architecture</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header><h1>ITS Standards</h1></header>
  ${navigation}
  <div class="content">
    ${data.standards.map(s => `
      <div class="card">
        <h3>${s.standard_id}</h3>
        <p><strong>${s.name}</strong></p>
        <p><span class="badge badge-orange">${s.organization}</span> Version: ${s.version || 'Latest'}</p>
        <p>${s.description || ''}</p>
      </div>
    `).join('')}
  </div>
</body>
</html>`,

    projects: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Projects - ITS Architecture</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header><h1>Deployment Projects</h1></header>
  ${navigation}
  <div class="content">
    ${data.projects.map(p => `
      <div class="card">
        <h3>${p.name}</h3>
        <p><strong>Lead:</strong> ${p.stakeholder_name || 'N/A'}</p>
        <p><strong>Status:</strong> <span class="badge badge-green">${p.status}</span></p>
        ${p.budget ? `<p><strong>Budget:</strong> $${p.budget.toLocaleString()}</p>` : ''}
        <p>${p.description || ''}</p>
      </div>
    `).join('')}
  </div>
</body>
</html>`
  };
}

module.exports = router;
