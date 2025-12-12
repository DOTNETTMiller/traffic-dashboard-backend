const fs = require('fs');
const path = require('path');

class IFCParser {
  constructor() {
    this.entities = new Map();
    this.schema = null;
    this.project = null;
    this.extractionLog = [];
    this.alignments = [];
    this.hasAlignments = false;
    this.siteLocation = null;
    this.hasSite = false;
    this.hasMapConversion = false;
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
      // Bridge Infrastructure
      'IFCBRIDGE', 'IFCBEAM', 'IFCCOLUMN', 'IFCPLATE', 'IFCPILE',
      'IFCTENDON', 'IFCFACILITYPART',

      // Roadway Infrastructure
      'IFCROAD', 'IFCROADPART', 'IFCPAVEMENT', 'IFCKERB',

      // ITS Equipment & Traffic Control
      'IFCSIGN',                    // Traffic signs (regulatory, warning, guide)
      'IFCSIGNAL',                  // Traffic signals
      'IFCTRAFFICSIGNAL',           // Traffic signal heads

      // Safety Infrastructure
      'IFCRAILING',                 // Guardrail, barriers
      'IFCVEHICLEBARRIER',          // Crash barriers

      // Pavement & Lane Infrastructure
      'IFCPAVEMENTMARKING',         // Lane lines, arrows, crosswalks
      'IFCMARKING',                 // General markings

      // Sensors & Monitoring
      'IFCSENSOR',                  // Structural health sensors, traffic sensors
      'IFCACTUATOR',                // Variable message signs, ramp meters

      // Catch-all for custom types (generic proxy elements from Bentley, etc.)
      'IFCBUILDINGELEMENTPROXY',
      'IFCPROXY'                    // Generic placeholder for unclassified elements
    ];

    const alignmentTypes = [
      'IFCALIGNMENT', 'IFCALIGNMENTHORIZONTAL', 'IFCALIGNMENTVERTICAL',
      'IFCALIGNMENTSEGMENT', 'IFCALIGNMENTCANT'
    ];

    // First pass: detect alignments and site information
    for (const [id, entity] of this.entities) {
      if (alignmentTypes.includes(entity.type)) {
        this.alignments.push({ id, type: entity.type });
        this.hasAlignments = true;
      }

      if (entity.type === 'IFCSITE') {
        this.hasSite = true;
        // Try to extract lat/long from RefLatitude/RefLongitude
        // IFC2X3: #123=IFCSITE('guid','owner','name','desc',$,#placement,$,$,.ELEMENT.,$,$,#refLat,#refLong,$);
        // IFC4: similar structure but may have address
        this.log('Found IFCSITE entity - checking for coordinates');
      }

      if (entity.type === 'IFCMAPCONVERSION') {
        this.hasMapConversion = true;
        this.log('Found IFCMAPCONVERSION entity - model has geolocation');
      }
    }

    if (this.hasAlignments) {
      this.log(`Found ${this.alignments.length} alignment entities in model`);
    } else {
      this.log('No alignment entities found - model uses absolute coordinates');
    }

    if (!this.hasSite && !this.hasMapConversion) {
      this.log('WARNING: No site location data (IFCSITE or IFCMAPCONVERSION) found in model');
    }

    // Second pass: extract infrastructure elements
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
      // Bridge Infrastructure
      'IFCBRIDGE': 'Bridge Structure',
      'IFCBEAM': 'Structural Element',
      'IFCCOLUMN': 'Structural Element',
      'IFCPLATE': 'Structural Element',
      'IFCPILE': 'Foundation',
      'IFCTENDON': 'Post-Tensioning',
      'IFCFACILITYPART': 'Bridge Component',

      // Roadway Infrastructure
      'IFCROAD': 'Roadway',
      'IFCROADPART': 'Roadway Component',
      'IFCPAVEMENT': 'Pavement',
      'IFCKERB': 'Lane Edge',

      // ITS Equipment & Traffic Control
      'IFCSIGN': 'Traffic Sign',
      'IFCSIGNAL': 'Traffic Signal',
      'IFCTRAFFICSIGNAL': 'Traffic Signal',

      // Safety Infrastructure
      'IFCRAILING': 'Guardrail/Barrier',
      'IFCVEHICLEBARRIER': 'Safety Barrier',

      // Pavement & Lane Infrastructure
      'IFCPAVEMENTMARKING': 'Pavement Marking',
      'IFCMARKING': 'Pavement Marking',

      // Sensors & Monitoring
      'IFCSENSOR': 'Sensor/Monitoring',
      'IFCACTUATOR': 'ITS Actuator',

      // Generic proxy elements (common in Bentley ProStructures exports)
      'IFCPROXY': 'Generic Element',
      'IFCBUILDINGELEMENTPROXY': 'Generic Element'
    };

    return categories[ifcType] || 'Other Infrastructure';
  }

  assessITSRelevance(ifcType) {
    // Map IFC types to ITS operational needs
    // This assessment informs buildingSMART IDM/IDS development for transportation infrastructure
    const relevance = {
      // ===== BRIDGE INFRASTRUCTURE =====
      'IFCBRIDGE': {
        purpose: 'Vertical clearance for routing and structural health monitoring',
        v2x: true,
        av: true,
        properties_needed: [
          'clearance_height',        // For oversize load routing
          'clearance_width',         // Lateral clearance
          'load_limit',              // Weight restrictions
          'bridge_condition_rating', // Structural health (NBI rating)
          'last_inspection_date',    // Maintenance tracking
          'functional_class'         // Route classification
        ]
      },
      'IFCBEAM': {
        purpose: 'Clearance verification and structural health',
        v2x: true,
        av: true,
        properties_needed: [
          'bottom_elevation',        // Lowest point for clearance
          'span_length',             // Structural span
          'material_condition',      // Health monitoring
          'load_capacity'            // Structural capacity
        ]
      },

      // ===== ITS EQUIPMENT & TRAFFIC CONTROL =====
      'IFCSIGN': {
        purpose: 'Traffic sign inventory and V2X message broadcasting',
        v2x: true,
        av: true,
        properties_needed: [
          'sign_type',               // Regulatory, warning, guide (MUTCD)
          'sign_text',               // Message content for V2X
          'mutcd_code',              // MUTCD sign designation
          'retroreflectivity',       // Visibility/condition
          'installation_date',       // Maintenance tracking
          'facing_direction',        // Sign orientation
          'height_above_road',       // Mounting height
          'support_type'             // Post, overhead, etc.
        ]
      },
      'IFCSIGNAL': {
        purpose: 'Traffic signal inventory and SPaT message broadcasting',
        v2x: true,
        av: true,
        properties_needed: [
          'signal_type',             // Vehicle, pedestrian, bicycle
          'phase_timing',            // Signal timing plan
          'spat_enabled',            // V2X SPaT capability
          'signal_controller_id',    // Controller identification
          'interconnect_type',       // Coordination method
          'preemption_enabled'       // Emergency vehicle preemption
        ]
      },

      // ===== SAFETY INFRASTRUCTURE =====
      'IFCRAILING': {
        purpose: 'Guardrail inventory and barrier performance',
        v2x: false,
        av: true,
        properties_needed: [
          'barrier_type',            // W-beam, cable, concrete
          'test_level',              // MASH/NCHRP 350 rating
          'length',                  // Barrier extent
          'condition',               // Maintenance status
          'offset_from_travel_lane', // Lateral offset
          'end_treatment_type'       // Terminal type
        ]
      },
      'IFCVEHICLEBARRIER': {
        purpose: 'Crash barrier and TMA inventory',
        v2x: false,
        av: true,
        properties_needed: [
          'barrier_type',            // Concrete, cable, TMA
          'test_level',              // Crash test rating
          'condition'                // Maintenance status
        ]
      },

      // ===== PAVEMENT & LANE INFRASTRUCTURE =====
      'IFCPAVEMENTMARKING': {
        purpose: 'Lane detection for AV systems and lane-level routing',
        v2x: false,
        av: true,
        properties_needed: [
          'marking_type',            // Solid, dashed, arrow, crosswalk
          'color',                   // White, yellow
          'width',                   // Marking width
          'retroreflectivity',       // Visibility/condition
          'material',                // Paint, thermoplastic, tape
          'lane_use',                // Through, turn, HOV, bike
          'last_application_date'    // Maintenance tracking
        ]
      },
      'IFCPAVEMENT': {
        purpose: 'Surface condition and friction for vehicle dynamics',
        v2x: false,
        av: true,
        properties_needed: [
          'pavement_type',           // Asphalt, concrete, gravel
          'surface_condition',       // IRI/roughness
          'friction_coefficient',    // Skid resistance
          'last_treatment_date',     // Maintenance history
          'distress_type',           // Cracking, rutting, etc.
          'structural_capacity'      // Pavement strength
        ]
      },
      'IFCKERB': {
        purpose: 'Lane boundaries and edge detection',
        v2x: false,
        av: true,
        properties_needed: [
          'kerb_height',             // Curb height
          'kerb_type',               // Barrier, mountable
          'edge_line_offset',        // Distance to edge line
          'geometry'                 // 3D path
        ]
      },
      'IFCROAD': {
        purpose: 'Roadway geometry and lane configuration',
        v2x: true,
        av: true,
        properties_needed: [
          'functional_class',        // Interstate, arterial, etc.
          'number_of_lanes',         // Lane count
          'lane_width',              // Width per lane
          'design_speed',            // Posted/design speed
          'surface_type',            // Pavement type
          'shoulder_width',          // Shoulder dimensions
          'median_type'              // Divided, undivided
        ]
      },

      // ===== SENSORS & MONITORING =====
      'IFCSENSOR': {
        purpose: 'Structural health monitoring and traffic detection',
        v2x: true,
        av: false,
        properties_needed: [
          'sensor_type',             // Strain, vibration, traffic, weather
          'measurement_type',        // What it measures
          'data_feed_url',           // Real-time data API
          'calibration_date',        // Maintenance tracking
          'alert_threshold',         // Alarm conditions
          'sampling_rate'            // Data frequency
        ]
      },
      'IFCACTUATOR': {
        purpose: 'Variable message signs and ramp metering',
        v2x: true,
        av: true,
        properties_needed: [
          'device_type',             // VMS, ramp meter, gate
          'control_protocol',        // NTCIP, etc.
          'message_capability',      // Character matrix, graphics
          'remote_control_enabled',  // TMC connectivity
          'current_status'           // Operational state
        ]
      },

      // ===== GENERIC PROXY ELEMENTS =====
      'IFCPROXY': {
        purpose: 'Generic infrastructure element (unclassified)',
        v2x: false,
        av: false,
        properties_needed: [
          'element_classification',  // What type of element this represents
          'functional_purpose',      // Intended use/function
          'asset_id',                // Unique identifier for asset tracking
          'installation_date'        // When installed
        ]
      },
      'IFCBUILDINGELEMENTPROXY': {
        purpose: 'Generic infrastructure element (unclassified)',
        v2x: false,
        av: false,
        properties_needed: [
          'element_classification',  // What type of element this represents
          'functional_purpose',      // Intended use/function
          'asset_id',                // Unique identifier for asset tracking
          'installation_date'        // When installed
        ]
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

    // Linear infrastructure types that should use alignment-based placement
    const linearInfraTypes = ['IFCROAD', 'IFCROADPART', 'IFCBRIDGE', 'IFCPAVEMENT', 'IFCKERB', 'IFCSIGN'];

    // Check for missing site location data (model-level gap)
    if (!this.hasSite && !this.hasMapConversion && elements.length > 0) {
      // Add one gap for the entire model (use first element's GUID as placeholder)
      gaps.push({
        element_ifc_guid: elements[0].ifc_guid,
        gap_type: 'missing_site_location',
        gap_category: 'Geolocation',
        severity: 'high',
        missing_property: 'IFCSITE or IFCMAPCONVERSION',
        required_for: 'Geographic location of infrastructure for mapping and spatial queries',
        its_use_case: 'GIS integration, asset location, V2X positioning, route planning, multi-project coordination',
        standards_reference: 'IFC2x3/IFC4x3 IFCSITE with RefLatitude/RefLongitude, or IFCMAPCONVERSION for projected coordinates',
        idm_recommendation: 'All infrastructure models should include an IFCSITE entity with RefLatitude and RefLongitude properties (for lat/long coordinates) or IFCMAPCONVERSION (for projected coordinate systems). This enables integration with GIS systems, V2X applications, and asset management platforms that require real-world geographic positioning.',
        ids_requirement: `<site required="true" purpose="Geographic_Positioning">
  <entity type="IfcSite" minOccurs="1">
    <attribute name="RefLatitude" required="true" />
    <attribute name="RefLongitude" required="true" />
  </entity>
</site>`
      });
    }

    // Temporary storage for all gaps (including duplicates)
    const allGaps = [];

    for (const element of elements) {
      const itsRequirements = this.assessITSRelevance(element.ifc_type);

      if (!itsRequirements.properties_needed) continue;

      // Check for missing critical properties
      for (const requiredProp of itsRequirements.properties_needed) {
        const gap = {
          element_ifc_guid: element.ifc_guid,
          element_ifc_type: element.ifc_type,
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

        allGaps.push(gap);
      }

      // Check for alignment-based placement gaps
      if (linearInfraTypes.includes(element.ifc_type)) {
        if (!this.hasAlignments) {
          // No alignments in model at all
          allGaps.push({
            element_ifc_guid: element.ifc_guid,
            element_ifc_type: element.ifc_type,
            gap_type: 'missing_alignment',
            gap_category: 'Alignment-Based Positioning',
            severity: 'high',
            missing_property: 'IfcAlignment',
            required_for: 'Alignment-based positioning for linear infrastructure',
            its_use_case: 'Linear referencing (station/offset), asset management, maintenance planning, route-based queries',
            standards_reference: 'IFC4x3 Road and Railway, buildingSMART Alignment standards',
            idm_recommendation: this.getAlignmentIDMRecommendation(element.ifc_type),
            ids_requirement: this.getAlignmentIDSRequirement(element.ifc_type)
          });
        } else {
          // Alignments exist but element may not use them (would need to check ObjectPlacement)
          allGaps.push({
            element_ifc_guid: element.ifc_guid,
            element_ifc_type: element.ifc_type,
            gap_type: 'absolute_placement',
            gap_category: 'Alignment-Based Positioning',
            severity: 'medium',
            missing_property: 'IfcLinearPlacement',
            required_for: 'Alignment-based positioning using station/offset coordinates',
            its_use_case: 'Linear referencing system for maintenance, asset management, ITS integration',
            standards_reference: 'IFC4x3 IfcLinearPlacement, buildingSMART IDM for Roads',
            idm_recommendation: `${element.ifc_type} should use IfcLinearPlacement referencing the project alignment instead of absolute IfcLocalPlacement. This enables station/offset coordinates for better integration with linear referencing systems, CAD/GIS workflows, and asset management.`,
            ids_requirement: `<placement type="IfcLinearPlacement" required="true" applicableEntity="${element.ifc_type}" purpose="Alignment_Based_Positioning" />`
          });
        }
      }
    }

    // Deduplicate gaps: group by unique combination of gap properties
    const gapMap = new Map();
    allGaps.forEach(gap => {
      const key = `${gap.gap_type}|${gap.missing_property}|${gap.gap_category}|${gap.severity}|${gap.element_ifc_type}`;

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

    // Convert map back to array and use first affected element as the representative GUID
    const deduplicatedGaps = Array.from(gapMap.values()).map(gap => {
      // Use first affected element as representative
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

    return [...gaps, ...deduplicatedGaps];
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

  getAlignmentIDMRecommendation(ifcType) {
    return `Linear infrastructure models containing ${ifcType} should include IfcAlignment entities with horizontal and vertical geometry. All ${ifcType} elements should use IfcLinearPlacement to position relative to the alignment using station/offset coordinates. This enables integration with linear referencing systems (LRS), CAD/GIS workflows, maintenance management systems, and ITS applications that require station-based queries.`;
  }

  getAlignmentIDSRequirement(ifcType) {
    return `<alignment required="true" purpose="Linear_Referencing">
  <entity type="IfcAlignment" minOccurs="1" />
  <entity type="${ifcType}">
    <placement type="IfcLinearPlacement" required="true" referencingAlignment="true" />
  </entity>
</alignment>`;
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
