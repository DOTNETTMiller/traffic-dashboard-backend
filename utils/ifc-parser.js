const fs = require('fs');
const path = require('path');

class IFCParser {
  constructor() {
    this.entities = new Map();
    this.schema = null;
    this.project = null;
    this.extractionLog = [];
  }

  /**
   * Parse an IFC file and extract infrastructure elements
   */
  async parseFile(filePath) {
    this.log('Starting IFC file parsing...');

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Parse header
    this.parseHeader(lines);

    // Parse data section
    this.parseDataSection(lines);

    // Extract infrastructure elements
    const elements = this.extractInfrastructureElements();

    return {
      schema: this.schema,
      project: this.project,
      elements: elements,
      extractionLog: this.extractionLog,
      statistics: this.getStatistics()
    };
  }

  parseHeader(lines) {
    let inHeader = false;

    for (const line of lines) {
      if (line.includes('FILE_SCHEMA')) {
        const match = line.match(/FILE_SCHEMA\s*\(\s*\('([^']+)'\)/);
        if (match) {
          this.schema = match[1];
          this.log(`IFC Schema detected: ${this.schema}`);
        }
      }

      if (line.includes('FILE_NAME')) {
        const match = line.match(/FILE_NAME\s*\(\s*'([^']+)'/);
        if (match) {
          this.project = match[1];
          this.log(`Project name: ${this.project}`);
        }
      }
    }
  }

  parseDataSection(lines) {
    let inData = false;
    let currentEntity = '';
    let currentId = null;
    let currentType = null;

    for (const line of lines) {
      if (line.includes('DATA;')) {
        inData = true;
        continue;
      }
      if (line.includes('ENDSEC;')) {
        inData = false;
        // Save last entity if exists
        if (currentEntity && currentId) {
          this.saveEntity(currentId, currentType, currentEntity);
        }
        continue;
      }

      if (inData) {
        // Check if this is start of new entity
        const startMatch = line.match(/^#(\d+)\s*=\s*([A-Z0-9_]+)\(/);

        if (startMatch) {
          // Save previous entity if exists
          if (currentEntity && currentId) {
            this.saveEntity(currentId, currentType, currentEntity);
          }

          // Start new entity
          currentId = `#${startMatch[1]}`;
          currentType = startMatch[2];
          currentEntity = line.trim();
        } else if (currentEntity) {
          // Continue multi-line entity
          currentEntity += line.trim();
        }

        // Check if entity is complete (ends with semicolon)
        if (currentEntity && currentEntity.endsWith(';')) {
          this.saveEntity(currentId, currentType, currentEntity);
          currentEntity = '';
          currentId = null;
          currentType = null;
        }
      }
    }

    this.log(`Parsed ${this.entities.size} IFC entities`);
  }

  saveEntity(id, type, raw) {
    // Extract params from the full entity string
    const paramsMatch = raw.match(/^#\d+\s*=\s*[A-Z0-9_]+\((.*)\);?\s*$/);
    const params = paramsMatch ? paramsMatch[1] : '';

    this.entities.set(id, {
      id: id,
      type: type,
      params: params,
      raw: raw
    });
  }

  extractInfrastructureElements() {
    const elements = [];
    const relevantTypes = [
      'IFCBRIDGE', 'IFCBEAM', 'IFCCOLUMN', 'IFCPLATE', 'IFCPILE',
      'IFCTENDON', 'IFCSIGN', 'IFCFACILITYPART', 'IFCROAD',
      'IFCROADPART', 'IFCPAVEMENT', 'IFCKERB', 'IFCBUILDINGELEMENTPROXY'
    ];

    for (const [id, entity] of this.entities) {
      if (relevantTypes.includes(entity.type)) {
        const element = this.extractElementProperties(id, entity);
        if (element) {
          elements.push(element);
        }
      }
    }

    this.log(`Extracted ${elements.length} infrastructure elements`);
    return elements;
  }

  extractElementProperties(id, entity) {
    // Extract GUID (first parameter in most IFC entities)
    const guidMatch = entity.params.match(/'([^']+)'/);
    const guid = guidMatch ? guidMatch[1] : null;

    // Extract name (typically third parameter)
    const params = this.splitParams(entity.params);
    const name = params[2] ? params[2].replace(/'/g, '') : null;
    const description = params[3] ? params[3].replace(/'/g, '') : null;

    // Categorize element for ITS operations
    const category = this.categorizeElement(entity.type);
    const itsRelevance = this.assessITSRelevance(entity.type);

    return {
      ifc_guid: guid,
      ifc_type: entity.type,
      element_name: name !== '$' ? name : null,
      element_description: description !== '$' ? description : null,
      category: category,
      its_relevance: itsRelevance.purpose,
      v2x_applicable: itsRelevance.v2x,
      av_critical: itsRelevance.av,
      raw_entity: entity.raw
    };
  }

  categorizeElement(ifcType) {
    const categories = {
      'IFCBRIDGE': 'Bridge Structure',
      'IFCBEAM': 'Structural Element',
      'IFCCOLUMN': 'Structural Element',
      'IFCPLATE': 'Structural Element',
      'IFCPILE': 'Foundation',
      'IFCTENDON': 'Post-Tensioning',
      'IFCSIGN': 'Traffic Control',
      'IFCFACILITYPART': 'Bridge Component',
      'IFCROAD': 'Roadway',
      'IFCROADPART': 'Roadway Component',
      'IFCPAVEMENT': 'Pavement',
      'IFCKERB': 'Roadway Edge'
    };

    return categories[ifcType] || 'Other Infrastructure';
  }

  assessITSRelevance(ifcType) {
    // Map IFC types to ITS operational needs
    const relevance = {
      'IFCBRIDGE': {
        purpose: 'Vertical clearance for routing',
        v2x: true,
        av: true,
        properties_needed: ['clearance_height', 'load_limit', 'width']
      },
      'IFCBEAM': {
        purpose: 'Clearance verification',
        v2x: true,
        av: true,
        properties_needed: ['bottom_elevation', 'span_length']
      },
      'IFCSIGN': {
        purpose: 'Traffic sign inventory and content',
        v2x: true,
        av: true,
        properties_needed: ['sign_type', 'sign_text', 'location', 'orientation']
      },
      'IFCPAVEMENT': {
        purpose: 'Surface condition and type',
        v2x: false,
        av: true,
        properties_needed: ['material', 'roughness', 'condition']
      },
      'IFCKERB': {
        purpose: 'Lane boundaries',
        v2x: false,
        av: true,
        properties_needed: ['height', 'geometry']
      }
    };

    return relevance[ifcType] || {
      purpose: 'General infrastructure element',
      v2x: false,
      av: false,
      properties_needed: []
    };
  }

  identifyGaps(elements) {
    const gaps = [];

    for (const element of elements) {
      const itsRequirements = this.assessITSRelevance(element.ifc_type);

      if (!itsRequirements.properties_needed) continue;

      // Check for missing critical properties
      for (const requiredProp of itsRequirements.properties_needed) {
        const gap = {
          element_ifc_guid: element.ifc_guid,
          gap_type: 'missing_property',
          gap_category: 'ITS Operations',
          severity: itsRequirements.av ? 'high' : 'medium',
          missing_property: requiredProp,
          required_for: itsRequirements.purpose,
          its_use_case: this.getUseCase(requiredProp),
          standards_reference: this.getStandardReference(requiredProp),
          idm_recommendation: this.getIDMRecommendation(element.ifc_type, requiredProp),
          ids_requirement: this.getIDSRequirement(element.ifc_type, requiredProp)
        };

        gaps.push(gap);
      }
    }

    return gaps;
  }

  getUseCase(property) {
    const useCases = {
      'clearance_height': 'AV route planning, oversize load routing',
      'sign_text': 'V2X sign message broadcasting, AV decision making',
      'location': 'Digital mapping, asset management, V2X positioning',
      'material': 'Surface friction estimation, AV traction control',
      'load_limit': 'Truck routing, infrastructure preservation'
    };

    return useCases[property] || 'Infrastructure operations';
  }

  getStandardReference(property) {
    const standards = {
      'clearance_height': 'AASHTO Geometric Design, SAE J3216 (V2X)',
      'sign_text': 'MUTCD, ISO 14823 (V2X)',
      'location': 'ISO 19111 (Spatial Reference), buildingSMART IFC4x3',
      'material': 'ASTM E1960 (Pavement Friction)'
    };

    return standards[property] || 'IFC4x3 Road and Railway';
  }

  getIDMRecommendation(ifcType, property) {
    return `All ${ifcType} elements should include '${property}' property in property sets for ITS operational data exchange. This enables digital infrastructure workflows including V2X, autonomous vehicle routing, and intelligent transportation systems.`;
  }

  getIDSRequirement(ifcType, property) {
    return `<property name="${property}" required="true" applicableEntity="${ifcType}" purpose="ITS_Operations" />`;
  }

  splitParams(paramString) {
    // Simple param splitter (doesn't handle nested parentheses perfectly, but works for basic cases)
    const params = [];
    let current = '';
    let depth = 0;
    let inString = false;

    for (let i = 0; i < paramString.length; i++) {
      const char = paramString[i];

      if (char === "'" && paramString[i-1] !== '\\') {
        inString = !inString;
      }

      if (!inString) {
        if (char === '(') depth++;
        if (char === ')') depth--;

        if (char === ',' && depth === 0) {
          params.push(current.trim());
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current) params.push(current.trim());
    return params;
  }

  getStatistics() {
    const stats = {
      total_entities: this.entities.size,
      by_type: {}
    };

    for (const [, entity] of this.entities) {
      if (!stats.by_type[entity.type]) {
        stats.by_type[entity.type] = 0;
      }
      stats.by_type[entity.type]++;
    }

    // Sort by count
    stats.by_type = Object.fromEntries(
      Object.entries(stats.by_type).sort((a, b) => b[1] - a[1])
    );

    return stats;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    this.extractionLog.push(`[${timestamp}] ${message}`);
    console.log(message);
  }
}

module.exports = IFCParser;
