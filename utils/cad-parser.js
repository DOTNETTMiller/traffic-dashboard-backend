const fs = require('fs');
const path = require('path');
const DxfParser = require('dxf-parser');

/**
 * CAD Parser for DWG/DXF/DGN files
 * Extracts infrastructure elements from CAD files for Digital Infrastructure analysis
 */
class CADParser {
  constructor() {
    this.entities = [];
    this.layers = new Map();
    this.blocks = new Map();
    this.extractionLog = [];
    this.schema = null;
    this.project = null;
  }

  log(message) {
    console.log(`  ${message}`);
    this.extractionLog.push(message);
  }

  /**
   * Parse a CAD file (DXF, DWG, DGN)
   */
  async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    this.log(`Starting CAD file parsing (${ext})...`);

    try {
      switch (ext) {
        case '.dxf':
          return await this.parseDXF(filePath);
        case '.dwg':
          return await this.parseDWG(filePath);
        case '.dgn':
          return await this.parseDGN(filePath);
        default:
          throw new Error(`Unsupported CAD file format: ${ext}`);
      }
    } catch (error) {
      this.log(`ERROR: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse DXF file
   */
  async parseDXF(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parser = new DxfParser();

    try {
      const dxf = parser.parseSync(fileContent);

      this.schema = 'DXF';
      this.project = path.basename(filePath, '.dxf');

      this.log(`DXF version: ${dxf.header?.$ACADVER || 'Unknown'}`);
      this.log(`Total entities: ${dxf.entities?.length || 0}`);

      // Extract layers
      if (dxf.tables?.layer?.layers) {
        Object.entries(dxf.tables.layer.layers).forEach(([layerName, layer]) => {
          this.layers.set(layerName, {
            name: layerName,
            color: layer.color,
            visible: !layer.flags || layer.flags === 0,
            frozen: layer.flags === 1
          });
        });
        this.log(`Found ${this.layers.size} layers`);
      }

      // Extract entities
      const elements = this.extractDXFElements(dxf);

      return {
        schema: this.schema,
        project: this.project,
        elements: elements,
        extractionLog: this.extractionLog,
        statistics: this.getStatistics(elements)
      };

    } catch (error) {
      throw new Error(`DXF parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse DWG file (requires conversion to DXF or special library)
   */
  async parseDWG(filePath) {
    // DWG is a proprietary format - for now, recommend converting to DXF
    throw new Error(
      'DWG files must be converted to DXF format. Please use AutoCAD, FreeCAD, or ODA File Converter to export as DXF.'
    );
  }

  /**
   * Parse DGN file (MicroStation format)
   */
  async parseDGN(filePath) {
    // DGN parsing would require GDAL/OGR or similar
    // For now, recommend converting to DXF or IFC
    throw new Error(
      'DGN files must be converted to DXF or IFC format. Please use Bentley MicroStation or ODA File Converter to export.'
    );
  }

  /**
   * Extract infrastructure elements from DXF entities
   */
  extractDXFElements(dxf) {
    const elements = [];
    const entities = dxf.entities || [];

    const infrastructureKeywords = {
      // Bridge elements
      bridge: ['BRIDGE', 'BEAM', 'GIRDER', 'PIER', 'ABUTMENT', 'DECK', 'SUPERSTRUCTURE', 'SUBSTRUCTURE'],

      // Signs
      sign: ['SIGN', 'REGULATORY', 'WARNING', 'GUIDE', 'MUTCD'],

      // Signals
      signal: ['SIGNAL', 'TRAFFIC LIGHT', 'SPAT', 'CONTROLLER'],

      // Pavement
      pavement: ['PAVEMENT', 'SURFACE', 'ASPHALT', 'CONCRETE', 'ROADWAY'],

      // Markings
      marking: ['MARKING', 'STRIPE', 'LINE', 'ARROW', 'CROSSWALK'],

      // Barriers
      barrier: ['GUARDRAIL', 'BARRIER', 'RAILING', 'FENCE', 'CABLE RAIL'],

      // Drainage
      drainage: ['DRAIN', 'INLET', 'GRATE', 'CULVERT', 'PIPE'],

      // Utilities
      utility: ['UTILITY', 'CONDUIT', 'MANHOLE', 'VALVE', 'HYDRANT']
    };

    entities.forEach((entity, idx) => {
      const layerName = entity.layer || 'DEFAULT';
      const entityType = entity.type?.toUpperCase() || 'UNKNOWN';

      // Determine infrastructure category based on layer name
      let category = 'Other CAD Element';
      let ifcType = 'CAD_ELEMENT';

      for (const [cat, keywords] of Object.entries(infrastructureKeywords)) {
        if (keywords.some(kw => layerName.toUpperCase().includes(kw))) {
          category = this.categorizeFromKeyword(cat);
          ifcType = this.mapToIFCType(cat);
          break;
        }
      }

      // Extract geometry-based info
      let description = `${entityType} on layer ${layerName}`;
      let hasLocation = false;

      if (entity.position || entity.startPoint || entity.center) {
        hasLocation = true;
        const point = entity.position || entity.startPoint || entity.center;
        description += ` at (${point.x?.toFixed(2)}, ${point.y?.toFixed(2)})`;
      }

      // Only add elements that might be infrastructure
      if (category !== 'Other CAD Element' || hasLocation) {
        elements.push({
          ifc_guid: `CAD_${idx}_${Date.now()}`,
          ifc_type: ifcType,
          element_name: layerName,
          element_description: description,
          category: category,
          its_relevance: this.assessCADRelevance(category),
          v2x_applicable: this.isV2XRelevant(category),
          av_critical: this.isAVCritical(category),
          raw_entity: JSON.stringify({
            type: entityType,
            layer: layerName,
            color: entity.color,
            hasGeometry: hasLocation
          })
        });
      }
    });

    this.log(`Extracted ${elements.length} infrastructure elements from DXF`);
    return elements;
  }

  categorizeFromKeyword(keyword) {
    const categoryMap = {
      bridge: 'Bridge Structure',
      sign: 'Traffic Sign',
      signal: 'Traffic Signal',
      pavement: 'Pavement',
      marking: 'Pavement Marking',
      barrier: 'Guardrail/Barrier',
      drainage: 'Drainage',
      utility: 'Utility'
    };
    return categoryMap[keyword] || 'Other Infrastructure';
  }

  mapToIFCType(keyword) {
    const ifcMap = {
      bridge: 'IFCBRIDGE',
      sign: 'IFCSIGN',
      signal: 'IFCSIGNAL',
      pavement: 'IFCPAVEMENT',
      marking: 'IFCPAVEMENTMARKING',
      barrier: 'IFCRAILING',
      drainage: 'IFCPROXY',
      utility: 'IFCPROXY'
    };
    return ifcMap[keyword] || 'IFCBUILDINGELEMENTPROXY';
  }

  assessCADRelevance(category) {
    const relevanceMap = {
      'Bridge Structure': 'Structural infrastructure for routing and clearance',
      'Traffic Sign': 'Traffic control and V2X messaging',
      'Traffic Signal': 'Signal timing and V2X SPaT',
      'Pavement': 'Surface condition and AV routing',
      'Pavement Marking': 'Lane detection and AV navigation',
      'Guardrail/Barrier': 'Safety infrastructure',
      'Drainage': 'Maintenance and flooding',
      'Utility': 'Underground infrastructure'
    };
    return relevanceMap[category] || 'Infrastructure element';
  }

  isV2XRelevant(category) {
    const v2xCategories = ['Traffic Sign', 'Traffic Signal', 'Pavement Marking'];
    return v2xCategories.includes(category);
  }

  isAVCritical(category) {
    const avCategories = ['Traffic Sign', 'Traffic Signal', 'Pavement Marking', 'Pavement'];
    return avCategories.includes(category);
  }

  getStatistics(elements) {
    const byType = {};
    elements.forEach(el => {
      byType[el.ifc_type] = (byType[el.ifc_type] || 0) + 1;
    });

    return {
      total_entities: elements.length,
      by_type: byType,
      v2x_elements: elements.filter(e => e.v2x_applicable).length,
      av_critical_elements: elements.filter(e => e.av_critical).length
    };
  }

  /**
   * Identify data gaps for CAD elements
   */
  identifyGaps(elements) {
    const gaps = [];
    const allGaps = [];

    // CAD files typically lack semantic data, so we add gaps for all critical properties
    elements.forEach(element => {
      const criticalProperties = this.getCriticalProperties(element.category);

      criticalProperties.forEach(prop => {
        allGaps.push({
          element_ifc_guid: element.ifc_guid,
          element_category: element.category,
          gap_type: 'missing_property',
          gap_category: 'CAD Data Enrichment',
          severity: prop.severity,
          missing_property: prop.name,
          required_for: prop.required_for,
          its_use_case: prop.its_use_case,
          standards_reference: 'IFC4x3 / CAD-to-BIM conversion requirements',
          idm_recommendation: `CAD elements should be converted to IFC with proper ${prop.name} properties. CAD files lack semantic infrastructure data needed for ITS operations. Recommend conversion to IFC using tools like Revit, Civil 3D, or FME Data Interoperability.`,
          ids_requirement: `<property name="${prop.name}" required="true" purpose="ITS_Operations" />`
        });
      });
    });

    // Deduplicate gaps: group by unique combination of gap properties
    const gapMap = new Map();
    allGaps.forEach(gap => {
      const key = `${gap.gap_type}|${gap.missing_property}|${gap.gap_category}|${gap.severity}|${gap.element_category}`;

      if (!gapMap.has(key)) {
        // First occurrence - store it with affected elements array
        gapMap.set(key, {
          ...gap,
          affected_element_guids: [gap.element_ifc_guid],
          affected_element_count: 1
        });
      } else {
        // Duplicate - just add to affected elements
        const existing = gapMap.get(key);
        existing.affected_element_guids.push(gap.element_ifc_guid);
        existing.affected_element_count++;
      }
    });

    // Convert map back to array
    const deduplicatedGaps = Array.from(gapMap.values()).map(gap => {
      return {
        element_ifc_guid: gap.affected_element_guids[0],
        gap_type: gap.gap_type,
        gap_category: gap.gap_category,
        severity: gap.severity,
        missing_property: gap.missing_property,
        required_for: gap.required_for,
        its_use_case: gap.its_use_case,
        standards_reference: gap.standards_reference,
        idm_recommendation: gap.idm_recommendation,
        ids_requirement: gap.ids_requirement,
        affected_element_count: gap.affected_element_count,
        affected_element_guids: gap.affected_element_guids.join(',')
      };
    });

    gaps.push(...deduplicatedGaps);

    // Add model-level gap about CAD limitations
    if (elements.length > 0) {
      gaps.push({
        element_ifc_guid: elements[0].ifc_guid,
        gap_type: 'cad_format_limitations',
        gap_category: 'Data Format',
        severity: 'high',
        missing_property: 'Semantic BIM Data',
        required_for: 'Full ITS integration requires semantic infrastructure data',
        its_use_case: 'V2X, AV routing, digital twin, asset management',
        standards_reference: 'buildingSMART IFC4.3, AASHTO BIM standards',
        idm_recommendation: 'CAD files (DXF/DWG/DGN) contain only geometry and layer information, lacking the semantic properties required for ITS operations. Recommend: 1) Convert to IFC format using Autodesk Civil 3D, Bentley OpenRoads, or FME, 2) Enrich with property sets during conversion, 3) Use this gap report to guide which properties to add during conversion.',
        ids_requirement: '<format required="IFC" purpose="Semantic_Infrastructure_Data" />',
        affected_element_count: elements.length,
        affected_element_guids: elements.map(e => e.ifc_guid).join(',')
      });
    }

    return gaps;
  }

  getCriticalProperties(category) {
    const propertyMap = {
      'Bridge Structure': [
        { name: 'nbi_structure_number', severity: 'high', required_for: 'Bridge inventory', its_use_case: 'Asset tracking, NBI reporting' },
        { name: 'vertical_clearance', severity: 'high', required_for: 'V2X warnings', its_use_case: 'Over-height vehicle routing' },
        { name: 'load_rating', severity: 'medium', required_for: 'Commercial vehicle routing', its_use_case: 'Truck routing, weight restrictions' }
      ],
      'Traffic Sign': [
        { name: 'mutcd_code', severity: 'high', required_for: 'Sign inventory', its_use_case: 'V2X message generation' },
        { name: 'message_text', severity: 'high', required_for: 'V2X broadcasting', its_use_case: 'Driver awareness, AV compliance' }
      ],
      'Traffic Signal': [
        { name: 'controller_id', severity: 'high', required_for: 'Signal system integration', its_use_case: 'SPaT messaging, NTCIP' },
        { name: 'phase_timing', severity: 'medium', required_for: 'Signal coordination', its_use_case: 'Adaptive signal control' }
      ],
      'Pavement': [
        { name: 'surface_type', severity: 'medium', required_for: 'Maintenance planning', its_use_case: 'Pavement management' },
        { name: 'functional_class', severity: 'high', required_for: 'Traffic modeling', its_use_case: 'HPMS reporting' }
      ],
      'Pavement Marking': [
        { name: 'marking_type', severity: 'high', required_for: 'Lane detection', its_use_case: 'AV navigation' },
        { name: 'retroreflectivity', severity: 'medium', required_for: 'Maintenance scheduling', its_use_case: 'Safety compliance' }
      ]
    };

    return propertyMap[category] || [
      { name: 'element_classification', severity: 'medium', required_for: 'Asset categorization', its_use_case: 'Inventory management' },
      { name: 'installation_date', severity: 'low', required_for: 'Lifecycle tracking', its_use_case: 'Maintenance forecasting' }
    ];
  }
}

module.exports = CADParser;
