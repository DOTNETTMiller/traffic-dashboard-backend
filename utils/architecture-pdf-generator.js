/**
 * ITS Architecture PDF Generator
 *
 * Generates FHWA-compliant Regional ITS Architecture documentation in PDF format
 * Similar to traditional RAD-IT PDF outputs
 */

const fs = require('fs');
const path = require('path');

// Optional dependency - gracefully handle if not installed
let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (error) {
  console.warn('⚠️  pdfkit not available - PDF generation disabled');
  PDFDocument = null;
}

class ArchitecturePDFGenerator {
  constructor() {
    this.doc = null;
    this.pageNumber = 0;
    this.margin = 50;
    this.pageWidth = 612; // Letter size
    this.pageHeight = 792;
    this.pdfAvailable = PDFDocument !== null;
  }

  /**
   * Generate complete architecture PDF
   */
  async generatePDF(architectureData, outputPath) {
    return new Promise((resolve, reject) => {
      if (!this.pdfAvailable) {
        return reject(new Error('PDF generation not available - pdfkit module not installed'));
      }

      try {
        this.doc = new PDFDocument({
          size: 'letter',
          margins: {
            top: this.margin,
            bottom: this.margin,
            left: this.margin,
            right: this.margin
          },
          info: {
            Title: architectureData.metadata.architecture_name,
            Author: 'DOT Corridor Communicator',
            Subject: 'Regional ITS Architecture',
            Keywords: 'ITS, Architecture, FHWA, 23 CFR 940.9'
          }
        });

        const stream = fs.createWriteStream(outputPath);
        this.doc.pipe(stream);

        // Generate document sections
        this.addCoverPage(architectureData.metadata);
        this.addTableOfContents();
        this.addExecutiveSummary(architectureData);
        this.addStakeholdersSection(architectureData.stakeholders);
        this.addElementsSection(architectureData.elements);
        this.addInterfacesSection(architectureData.interfaces);
        this.addStandardsSection(architectureData.standards);
        this.addProjectsSection(architectureData.projects);
        this.addComplianceSection();

        this.doc.end();

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Cover Page
   */
  addCoverPage(metadata) {
    this.doc.fillColor('#4285F4')
      .fontSize(36)
      .text(metadata.architecture_name, {
        align: 'center'
      });

    this.doc.moveDown(2);

    this.doc.fillColor('#333')
      .fontSize(20)
      .text('Regional ITS Architecture', {
        align: 'center'
      });

    this.doc.moveDown(1);

    this.doc.fontSize(14)
      .text(metadata.geographic_scope, {
        align: 'center'
      });

    this.doc.moveDown(0.5);

    this.doc.fontSize(12)
      .fillColor('#666')
      .text(`Time Horizon: ${metadata.time_horizon}`, {
        align: 'center'
      });

    // Add logo/seal area
    this.doc.moveDown(4);
    this.doc.fontSize(10)
      .fillColor('#999')
      .text('FHWA Compliant (23 CFR 940.9)', {
        align: 'center'
      });

    this.doc.moveDown(8);

    this.doc.fontSize(12)
      .fillColor('#333')
      .text(`Version: ${metadata.version}`, { align: 'center' });

    this.doc.text(`Last Updated: ${new Date(metadata.last_updated).toLocaleDateString()}`, {
      align: 'center'
    });

    this.addPageNumber();
    this.doc.addPage();
  }

  /**
   * Table of Contents
   */
  addTableOfContents() {
    this.addSectionHeader('Table of Contents', 1);

    const sections = [
      { title: '1. Executive Summary', page: 3 },
      { title: '2. Stakeholders', page: 5 },
      { title: '3. ITS Elements', page: 8 },
      { title: '4. Interfaces and Data Flows', page: 12 },
      { title: '5. Standards', page: 16 },
      { title: '6. Deployment Projects', page: 19 },
      { title: '7. FHWA Compliance', page: 22 },
      { title: 'Appendix A: Acronyms and Abbreviations', page: 24 }
    ];

    this.doc.moveDown(1);

    sections.forEach(section => {
      this.doc.fontSize(12)
        .fillColor('#333')
        .text(section.title, {
          continued: true,
          width: 450
        })
        .text(section.page.toString(), {
          align: 'right'
        });

      this.doc.moveDown(0.5);
    });

    this.addPageNumber();
    this.doc.addPage();
  }

  /**
   * Executive Summary
   */
  addExecutiveSummary(data) {
    this.addSectionHeader('1. Executive Summary', 1);

    this.doc.fontSize(12)
      .fillColor('#333')
      .text(data.metadata.vision_statement, {
        align: 'justify',
        lineGap: 4
      });

    this.doc.moveDown(1);

    // Statistics table
    this.addSubsectionHeader('Architecture Overview');

    const stats = [
      ['Component', 'Count'],
      ['Stakeholders', data.stakeholders.length],
      ['ITS Elements', data.elements.length],
      ['Interfaces', data.interfaces.length],
      ['Standards Referenced', data.standards.length],
      ['Deployment Projects', data.projects.length]
    ];

    this.addTable(stats);

    this.doc.moveDown(1);

    // Geographic scope
    this.addSubsectionHeader('Geographic Scope');
    this.doc.fontSize(11)
      .text(data.metadata.geographic_scope, {
        align: 'justify'
      });

    this.doc.moveDown(1);

    // Time horizon
    this.addSubsectionHeader('Planning Time Horizon');
    this.doc.fontSize(11)
      .text(`This architecture covers the period: ${data.metadata.time_horizon}`, {
        align: 'justify'
      });

    this.addPageNumber();
    this.doc.addPage();
  }

  /**
   * Stakeholders Section
   */
  addStakeholdersSection(stakeholders) {
    this.addSectionHeader('2. Stakeholders', 1);

    this.doc.fontSize(11)
      .fillColor('#333')
      .text('The following organizations are stakeholders in this Regional ITS Architecture:', {
        align: 'justify'
      });

    this.doc.moveDown(1);

    stakeholders.forEach((stakeholder, index) => {
      if (this.doc.y > this.pageHeight - 150) {
        this.addPageNumber();
        this.doc.addPage();
      }

      this.doc.fontSize(12)
        .fillColor('#4285F4')
        .text(`${stakeholder.name}${stakeholder.abbreviation ? ` (${stakeholder.abbreviation})` : ''}`, {
          underline: true
        });

      this.doc.moveDown(0.3);

      this.doc.fontSize(10)
        .fillColor('#666')
        .text(`Type: ${stakeholder.type.replace('_', ' ').toUpperCase()}`);

      if (stakeholder.description) {
        this.doc.fontSize(10)
          .fillColor('#333')
          .text(stakeholder.description, {
            align: 'justify'
          });
      }

      if (stakeholder.roles && stakeholder.roles.length > 0) {
        this.doc.fontSize(10)
          .fillColor('#666')
          .text(`Roles: ${stakeholder.roles.join(', ')}`);
      }

      if (stakeholder.email || stakeholder.phone) {
        this.doc.fontSize(9)
          .fillColor('#999')
          .text(`Contact: ${stakeholder.email || ''} ${stakeholder.phone || ''}`);
      }

      this.doc.moveDown(0.8);
    });

    this.addPageNumber();
    this.doc.addPage();
  }

  /**
   * Elements Section
   */
  addElementsSection(elements) {
    this.addSectionHeader('3. ITS Elements', 1);

    this.doc.fontSize(11)
      .fillColor('#333')
      .text('The following ITS elements are documented in this architecture:', {
        align: 'justify'
      });

    this.doc.moveDown(1);

    // Group by type
    const grouped = {};
    elements.forEach(el => {
      if (!grouped[el.element_type]) grouped[el.element_type] = [];
      grouped[el.element_type].push(el);
    });

    Object.keys(grouped).forEach(type => {
      this.addSubsectionHeader(`${type.charAt(0).toUpperCase() + type.slice(1)} Elements`);

      grouped[type].forEach(element => {
        if (this.doc.y > this.pageHeight - 120) {
          this.addPageNumber();
          this.doc.addPage();
        }

        this.doc.fontSize(11)
          .fillColor('#4285F4')
          .text(element.name, { underline: true });

        this.doc.fontSize(9)
          .fillColor('#666')
          .text(`Owner: ${element.stakeholder_name || 'N/A'} | Status: ${element.status} | Category: ${element.category || 'N/A'}`);

        if (element.description) {
          this.doc.fontSize(9)
            .fillColor('#333')
            .text(element.description);
        }

        if (element.location) {
          this.doc.fontSize(9)
            .fillColor('#666')
            .text(`Location: ${element.location}`);
        }

        this.doc.moveDown(0.6);
      });

      this.doc.moveDown(0.5);
    });

    this.addPageNumber();
    this.doc.addPage();
  }

  /**
   * Interfaces Section
   */
  addInterfacesSection(interfaces) {
    this.addSectionHeader('4. Interfaces and Data Flows', 1);

    this.doc.fontSize(11)
      .fillColor('#333')
      .text('The following interfaces define data exchanges between ITS elements:', {
        align: 'justify'
      });

    this.doc.moveDown(1);

    interfaces.forEach((iface, index) => {
      if (this.doc.y > this.pageHeight - 140) {
        this.addPageNumber();
        this.doc.addPage();
      }

      this.doc.fontSize(11)
        .fillColor('#4285F4')
        .text(`${index + 1}. ${iface.name}`, { underline: true });

      this.doc.fontSize(9)
        .fillColor('#333')
        .text(`${iface.source_name} → ${iface.destination_name}`);

      if (iface.description) {
        this.doc.fontSize(9)
          .text(iface.description);
      }

      this.doc.fontSize(9)
        .fillColor('#666')
        .text(`Protocol: ${iface.protocol || 'N/A'} | Data Type: ${iface.data_type || 'N/A'} | Status: ${iface.status}`);

      if (iface.standards && Array.isArray(iface.standards) && iface.standards.length > 0) {
        this.doc.fontSize(9)
          .fillColor('#666')
          .text(`Standards: ${iface.standards.join(', ')}`);
      }

      this.doc.moveDown(0.7);
    });

    this.addPageNumber();
    this.doc.addPage();
  }

  /**
   * Standards Section
   */
  addStandardsSection(standards) {
    this.addSectionHeader('5. Standards', 1);

    this.doc.fontSize(11)
      .fillColor('#333')
      .text('The following ITS standards are referenced in this architecture:', {
        align: 'justify'
      });

    this.doc.moveDown(1);

    standards.forEach((standard, index) => {
      if (this.doc.y > this.pageHeight - 120) {
        this.addPageNumber();
        this.doc.addPage();
      }

      this.doc.fontSize(11)
        .fillColor('#4285F4')
        .text(standard.standard_id, { underline: true });

      this.doc.fontSize(10)
        .fillColor('#333')
        .text(standard.name);

      this.doc.fontSize(9)
        .fillColor('#666')
        .text(`Organization: ${standard.organization} | Version: ${standard.version || 'Latest'}`);

      if (standard.description) {
        this.doc.fontSize(9)
          .fillColor('#333')
          .text(standard.description, { align: 'justify' });
      }

      if (standard.scope) {
        this.doc.fontSize(9)
          .fillColor('#666')
          .text(`Scope: ${standard.scope}`);
      }

      this.doc.moveDown(0.6);
    });

    this.addPageNumber();
    this.doc.addPage();
  }

  /**
   * Projects Section
   */
  addProjectsSection(projects) {
    this.addSectionHeader('6. Deployment Projects', 1);

    this.doc.fontSize(11)
      .fillColor('#333')
      .text('The following ITS deployment projects implement this architecture:', {
        align: 'justify'
      });

    this.doc.moveDown(1);

    projects.forEach((project, index) => {
      if (this.doc.y > this.pageHeight - 150) {
        this.addPageNumber();
        this.doc.addPage();
      }

      this.doc.fontSize(12)
        .fillColor('#4285F4')
        .text(project.name, { underline: true });

      if (project.description) {
        this.doc.fontSize(10)
          .fillColor('#333')
          .text(project.description, { align: 'justify' });
      }

      this.doc.fontSize(9)
        .fillColor('#666')
        .text(`Lead Agency: ${project.stakeholder_name || 'N/A'}`);

      if (project.start_date) {
        this.doc.text(`Timeline: ${new Date(project.start_date).toLocaleDateString()} - ${project.completion_date ? new Date(project.completion_date).toLocaleDateString() : 'Ongoing'}`);
      }

      if (project.budget) {
        this.doc.text(`Budget: $${project.budget.toLocaleString()}`);
      }

      this.doc.text(`Status: ${project.status}`);

      if (project.systems_engineering_required) {
        this.doc.fontSize(9)
          .fillColor('#E65100')
          .text('✓ Systems Engineering Documentation Required');
      }

      this.doc.moveDown(0.8);
    });

    this.addPageNumber();
    this.doc.addPage();
  }

  /**
   * FHWA Compliance Section
   */
  addComplianceSection() {
    this.addSectionHeader('7. FHWA Compliance (23 CFR 940.9)', 1);

    this.doc.fontSize(11)
      .fillColor('#333')
      .text('This Regional ITS Architecture complies with Federal Highway Administration requirements as specified in 23 CFR 940.9.', {
        align: 'justify'
      });

    this.doc.moveDown(1);

    const requirements = [
      'Stakeholder identification and roles',
      'ITS inventory (existing and planned systems)',
      'Operational concepts',
      'Functional requirements',
      'Interface requirements and data flows',
      'ITS standards identification',
      'Project sequencing and implementation'
    ];

    this.addSubsectionHeader('Compliance Checklist');

    requirements.forEach(req => {
      this.doc.fontSize(10)
        .fillColor('#2E7D32')
        .text(`✓ ${req}`);
      this.doc.moveDown(0.3);
    });

    this.doc.moveDown(1);

    this.addSubsectionHeader('Systems Engineering');
    this.doc.fontSize(10)
      .fillColor('#333')
      .text('All ITS projects funded with Highway Trust Fund money will follow systems engineering processes as documented in project records and architecture updates.', {
        align: 'justify'
      });

    this.addPageNumber();
  }

  /**
   * Helper: Add section header
   */
  addSectionHeader(text, level = 1) {
    const fontSize = level === 1 ? 18 : 14;
    const color = level === 1 ? '#4285F4' : '#333';

    if (this.doc.y > this.pageHeight - 100) {
      this.addPageNumber();
      this.doc.addPage();
    }

    this.doc.moveDown(0.5);
    this.doc.fontSize(fontSize)
      .fillColor(color)
      .text(text);
    this.doc.moveDown(0.5);
  }

  /**
   * Helper: Add subsection header
   */
  addSubsectionHeader(text) {
    this.doc.fontSize(12)
      .fillColor('#666')
      .text(text, { underline: true });
    this.doc.moveDown(0.3);
  }

  /**
   * Helper: Add table
   */
  addTable(data) {
    const startY = this.doc.y;
    const colWidth = 250;
    const rowHeight = 25;

    data.forEach((row, rowIndex) => {
      const y = startY + (rowIndex * rowHeight);

      if (y > this.pageHeight - 100) {
        this.addPageNumber();
        this.doc.addPage();
      }

      row.forEach((cell, colIndex) => {
        const x = this.margin + (colIndex * colWidth);

        if (rowIndex === 0) {
          // Header row
          this.doc.fillColor('#4285F4')
            .fontSize(11)
            .text(cell, x, y, { width: colWidth - 10 });
        } else {
          // Data row
          this.doc.fillColor('#333')
            .fontSize(10)
            .text(cell.toString(), x, y, { width: colWidth - 10 });
        }
      });

      // Draw line after row
      this.doc.strokeColor('#E0E0E0')
        .lineWidth(0.5)
        .moveTo(this.margin, y + rowHeight - 2)
        .lineTo(this.pageWidth - this.margin, y + rowHeight - 2)
        .stroke();
    });

    this.doc.y = startY + (data.length * rowHeight) + 10;
  }

  /**
   * Helper: Add page number
   */
  addPageNumber() {
    this.pageNumber++;
    this.doc.fontSize(9)
      .fillColor('#999')
      .text(
        `Page ${this.pageNumber}`,
        this.margin,
        this.pageHeight - 30,
        { align: 'center', width: this.pageWidth - (2 * this.margin) }
      );
  }
}

/**
 * Generate Architecture Report from Analysis Data
 * Simpler function for quick export from equipment analysis
 */
function generateQuickArchitectureReport(analysis, options = {}) {
  return new Promise((resolve, reject) => {
    if (!PDFDocument) {
      return reject(new Error('PDF generation not available - pdfkit module not installed'));
    }

    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `${options.stateName || 'Regional'} ITS Architecture Report`,
          Author: 'DOT Corridor Communicator',
          Subject: 'Regional ITS Architecture Analysis',
          Keywords: 'ITS, ARC-IT, Regional Architecture, FHWA'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const stateName = options.stateName || 'Regional';
      const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      // Cover Page
      doc.fillColor('#667eea')
         .fontSize(28)
         .text('Regional ITS Architecture', { align: 'center' })
         .moveDown(0.5);

      doc.fontSize(24)
         .text(stateName, { align: 'center' })
         .moveDown(2);

      doc.fillColor('#333')
         .fontSize(14)
         .text('Based on ARC-IT 10.0 National ITS Architecture', { align: 'center' })
         .moveDown(3);

      // Stats Box
      const boxTop = 300;
      doc.rect(100, boxTop, 412, 200)
         .strokeColor('#667eea')
         .lineWidth(2)
         .stroke();

      doc.fillColor('#667eea')
         .fontSize(12)
         .text('ARCHITECTURE SUMMARY', 100, boxTop + 20, { width: 412, align: 'center' })
         .moveDown(1);

      doc.fillColor('#000')
         .fontSize(11)
         .text(`Total Equipment: ${analysis.total_equipment}`, 120, boxTop + 60)
         .text(`Service Packages: ${analysis.service_package_count}`, 120, boxTop + 85)
         .text(`Physical Objects: ${analysis.physical_objects?.length || 0}`, 120, boxTop + 110)
         .text(`Standards Required: ${analysis.standards_required?.length || 0}`, 120, boxTop + 135)
         .text(`Compliance Score: ${analysis.compliance_score}%`, 120, boxTop + 160);

      doc.fillColor('#666')
         .fontSize(10)
         .text(date, 50, 700, { align: 'center', width: 512 })
         .fontSize(9)
         .text('Generated by DOT Corridor Communicator', 50, 720, { align: 'center', width: 512 });

      // Page 2: Executive Summary
      doc.addPage();
      doc.fillColor('#667eea')
         .fontSize(20)
         .text('Executive Summary', 50, 50)
         .moveDown(1);

      doc.fillColor('#000')
         .fontSize(11)
         .text(
           `The ${stateName} regional Intelligent Transportation System (ITS) architecture ` +
           `comprises ${analysis.total_equipment} deployed equipment assets supporting ` +
           `${analysis.service_package_count} ARC-IT service packages from the National ITS Architecture.`,
           { align: 'justify' }
         )
         .moveDown(1);

      doc.text(
        `This architecture involves ${analysis.physical_objects?.length || 0} physical objects ` +
        `and requires compliance with ${analysis.standards_required?.length || 0} industry ` +
        `standards including NTCIP, SAE J2735, and TMDD protocols.`,
        { align: 'justify' }
      )
      .moveDown(1);

      doc.text(
        `Current architecture compliance score: ${analysis.compliance_score}%.`,
        { align: 'justify' }
      )
      .moveDown(2);

      // Page 3: Service Packages
      doc.addPage();
      doc.fillColor('#667eea')
         .fontSize(20)
         .text('ARC-IT Service Packages', 50, 50)
         .moveDown(1);

      let y = doc.y;
      (analysis.service_packages || []).forEach((pkg, idx) => {
        if (y > 650) {
          doc.addPage();
          y = 50;
        }

        doc.rect(50, y, 512, 25)
           .fillAndStroke('#667eea', '#667eea');

        doc.fillColor('#fff')
           .fontSize(12)
           .text(`${pkg.id}: ${pkg.name}`, 55, y + 8, { width: 500 });

        y += 30;

        doc.fillColor('#000')
           .fontSize(10)
           .text(`Category: ${pkg.category}`, 55, y)
           .text(`Equipment: ${pkg.equipment_count} assets`, 55, y + 15)
           .text(`Description: ${pkg.description}`, 55, y + 30, { width: 500 });

        y += 60;

        if (pkg.standards && pkg.standards.length > 0) {
          doc.fontSize(9)
             .text('Standards: ' + pkg.standards.join(', '), 55, y, { width: 500 });
          y += 15;
        }

        y += 15;
      });

      // Page: Standards
      doc.addPage();
      doc.fillColor('#667eea')
         .fontSize(20)
         .text('Standards & Compliance', 50, 50)
         .moveDown(1);

      doc.fillColor('#000')
         .fontSize(11)
         .text(`Architecture Compliance Score: `, { continued: true })
         .fontSize(14)
         .fillColor(analysis.compliance_score >= 80 ? '#10b981' :
                    analysis.compliance_score >= 60 ? '#f59e0b' : '#ef4444')
         .text(`${analysis.compliance_score}%`)
         .moveDown(2);

      doc.fillColor('#667eea')
         .fontSize(14)
         .text('Required Industry Standards')
         .moveDown(0.5);

      y = doc.y;
      (analysis.standards_required || []).forEach((std, idx) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        doc.fillColor('#000')
           .fontSize(11)
           .text(`${std}`, 55, y);
        y += 25;
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  ArchitecturePDFGenerator,
  generateQuickArchitectureReport
};
