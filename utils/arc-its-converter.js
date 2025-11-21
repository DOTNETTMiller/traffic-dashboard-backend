/**
 * ARC-ITS Compliance Converter
 *
 * Converts ITS equipment inventory to ARC-ITS (Architecture Reference for
 * Cooperative and Intelligent Transportation) compliant format.
 *
 * References:
 * - ARC-IT Physical Architecture (https://www.arc-it.net/)
 * - SAE J2735 (DSRC Message Set Dictionary)
 * - NTCIP 1218 (ESS Interface)
 */

const crypto = require('crypto');

class ARCITSConverter {
  constructor() {
    // ARC-ITS Equipment Categories
    this.categories = {
      camera: 'Field Equipment > CCTV Camera',
      dms: 'Field Equipment > Dynamic Message Sign',
      rsu: 'Field Equipment > Roadside Equipment',
      sensor: 'Field Equipment > Environmental Sensor Station'
    };

    // ARC-ITS Functions by equipment type
    this.functions = {
      camera: [
        'traffic_surveillance',
        'incident_detection',
        'wrong_way_detection',
        'work_zone_monitoring'
      ],
      dms: [
        'traveler_information',
        'traffic_control',
        'warning_advisory',
        'incident_management'
      ],
      rsu: [
        'v2x_communication',
        'cv_safety_applications',
        'tim_broadcast',
        'spat_broadcast',
        'bsm_collection'
      ],
      sensor: [
        'environmental_monitoring',
        'traffic_detection',
        'weather_monitoring',
        'road_condition_monitoring'
      ]
    };

    // ARC-ITS Interfaces
    this.interfaces = {
      camera: 'NTCIP 1205 (Video)',
      dms: 'NTCIP 1203 (DMS)',
      rsu: 'IEEE 1609 / SAE J2735',
      sensor: 'NTCIP 1204 (ESS) / NTCIP 1218'
    };

    // V2X Application types
    this.v2xApplications = {
      safety: [
        'Forward Collision Warning',
        'Emergency Electronic Brake Lights',
        'Intersection Movement Assist',
        'Lane Change Warning',
        'Blind Spot Warning',
        'Do Not Pass Warning'
      ],
      mobility: [
        'Traveler Information Message (TIM)',
        'Signal Phase and Timing (SPaT)',
        'MAP Message',
        'Road Weather Information'
      ],
      environmental: [
        'Eco-Approach and Departure',
        'Queue Warning',
        'Reduced Speed Zone Warning'
      ]
    };
  }

  /**
   * Convert equipment record to ARC-ITS compliant format
   * @param {Object} equipment - Parsed equipment record
   * @returns {Object} ARC-ITS compliant equipment record
   */
  convertToARCITS(equipment) {
    const arcItsId = this.generateARCITSId(equipment);
    const category = this.getARCITSCategory(equipment.equipmentType);
    const functions = this.getARCITSFunctions(equipment);
    const interfaceType = this.getARCITSInterface(equipment.equipmentType);

    return {
      ...equipment,
      arcItsId,
      arcItsCategory: category,
      arcItsFunction: functions.join(', '),
      arcItsInterface: interfaceType,
      // Add V2X specific fields for RSUs
      ...(equipment.equipmentType === 'rsu' ? this.enhanceRSUData(equipment) : {}),
      // Add standardized metadata
      metadata: {
        arcItsCompliant: true,
        arcItsVersion: 'ARC-IT 10.0',
        conversionDate: new Date().toISOString(),
        standardsCompliance: this.getStandardsCompliance(equipment)
      }
    };
  }

  /**
   * Generate unique ARC-ITS identifier
   */
  generateARCITSId(equipment) {
    const prefix = this.getEquipmentPrefix(equipment.equipmentType);
    const stateCode = equipment.stateKey.toUpperCase();
    const hash = crypto.createHash('md5')
      .update(`${equipment.stateKey}-${equipment.latitude}-${equipment.longitude}`)
      .digest('hex')
      .substring(0, 8);

    return `${prefix}-${stateCode}-${hash}`.toUpperCase();
  }

  /**
   * Get ARC-ITS equipment prefix
   */
  getEquipmentPrefix(type) {
    const prefixes = {
      camera: 'CAM',
      dms: 'DMS',
      rsu: 'RSU',
      sensor: 'ESS' // Environmental Sensor Station
    };
    return prefixes[type] || 'EQP';
  }

  /**
   * Get ARC-ITS category for equipment type
   */
  getARCITSCategory(type) {
    return this.categories[type] || 'Field Equipment > Other';
  }

  /**
   * Determine ARC-ITS functions based on equipment attributes
   */
  getARCITSFunctions(equipment) {
    const baseFunctions = this.functions[equipment.equipmentType] || [];

    // Add specific functions based on equipment subtype or properties
    const additionalFunctions = [];

    if (equipment.equipmentType === 'camera') {
      if (equipment.cameraType?.includes('thermal')) {
        additionalFunctions.push('thermal_imaging');
      }
      if (equipment.cameraType?.includes('ptz')) {
        additionalFunctions.push('pan_tilt_zoom_control');
      }
    }

    if (equipment.equipmentType === 'rsu') {
      if (equipment.supportedProtocols?.includes('C-V2X')) {
        additionalFunctions.push('cv2x_communication');
      }
      if (equipment.supportedProtocols?.includes('DSRC')) {
        additionalFunctions.push('dsrc_communication');
      }
    }

    if (equipment.equipmentType === 'sensor') {
      if (equipment.sensorType?.includes('weather') || equipment.sensorType?.includes('rwis')) {
        additionalFunctions.push('rwis_data_collection');
      }
      if (equipment.measurementTypes?.includes('speed')) {
        additionalFunctions.push('speed_measurement');
      }
    }

    return [...baseFunctions, ...additionalFunctions];
  }

  /**
   * Get ARC-ITS interface standard
   */
  getARCITSInterface(type) {
    return this.interfaces[type] || 'Custom / Other';
  }

  /**
   * Enhance RSU data with V2X specific fields
   */
  enhanceRSUData(equipment) {
    return {
      rsuMode: equipment.rsuMode || 'continuous',
      communicationRange: equipment.communicationRange || 300, // default 300m
      supportedProtocols: this.standardizeProtocols(equipment.supportedProtocols),
      v2xApplications: this.determineV2XApplications(equipment),
      messageTypes: this.getSupportedMessageTypes(equipment)
    };
  }

  /**
   * Standardize protocol names
   */
  standardizeProtocols(protocols) {
    if (!protocols) return JSON.stringify(['DSRC']);

    const protocolList = typeof protocols === 'string' ? protocols.split(',') : protocols;
    const standardized = protocolList.map(p => {
      const normalized = p.trim().toUpperCase();
      if (normalized.includes('DSRC') || normalized.includes('5.9')) return 'DSRC';
      if (normalized.includes('C-V2X') || normalized.includes('CV2X')) return 'C-V2X';
      if (normalized.includes('5G')) return '5G';
      if (normalized.includes('LTE')) return 'LTE-V2X';
      return normalized;
    });

    return JSON.stringify([...new Set(standardized)]);
  }

  /**
   * Determine V2X applications supported by RSU
   */
  determineV2XApplications(equipment) {
    const applications = {
      safety: [],
      mobility: [],
      environmental: []
    };

    // Default safety applications for all RSUs
    applications.safety = [
      'Forward Collision Warning',
      'Emergency Electronic Brake Lights'
    ];

    // Add mobility applications
    applications.mobility = [
      'Traveler Information Message (TIM)',
      'Signal Phase and Timing (SPaT)'
    ];

    // Add based on location/context
    if (equipment.route?.includes('I-')) {
      applications.mobility.push('Road Weather Information');
    }

    if (equipment.rawProperties?.intersection) {
      applications.safety.push('Intersection Movement Assist');
    }

    return JSON.stringify(applications);
  }

  /**
   * Get supported SAE J2735 message types
   */
  getSupportedMessageTypes(equipment) {
    const messageTypes = [
      'BSM',  // Basic Safety Message
      'TIM',  // Traveler Information Message
      'RSA'   // Road Side Alert
    ];

    // Add SPaT and MAP for intersection RSUs
    if (equipment.rawProperties?.intersection || equipment.rawProperties?.signal) {
      messageTypes.push('SPaT'); // Signal Phase and Timing
      messageTypes.push('MAP');  // Map Data
    }

    // Add PSM for work zones
    if (equipment.rawProperties?.work_zone) {
      messageTypes.push('PSM'); // Personal Safety Message
    }

    return JSON.stringify(messageTypes);
  }

  /**
   * Determine standards compliance
   */
  getStandardsCompliance(equipment) {
    const compliance = {
      arcIt: true,
      ntcip: false,
      saeJ2735: false,
      ieee1609: false
    };

    switch (equipment.equipmentType) {
      case 'camera':
        compliance.ntcip = true; // NTCIP 1205
        break;
      case 'dms':
        compliance.ntcip = true; // NTCIP 1203
        break;
      case 'rsu':
        compliance.saeJ2735 = true;
        compliance.ieee1609 = true;
        break;
      case 'sensor':
        compliance.ntcip = true; // NTCIP 1204/1218
        break;
    }

    return compliance;
  }

  /**
   * Convert batch of equipment records
   * @param {Array} equipmentList - Array of equipment records
   * @returns {Array} ARC-ITS compliant records
   */
  convertBatch(equipmentList) {
    return equipmentList.map(equipment => this.convertToARCITS(equipment));
  }

  /**
   * Generate ARC-ITS XML export
   * @param {Array} equipmentList - ARC-ITS compliant equipment
   * @returns {string} XML string
   */
  generateARCITSXML(equipmentList) {
    const timestamp = new Date().toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ARCITSInventory xmlns="http://arc-it.net/inventory" version="10.0" timestamp="${timestamp}">
  <Equipment>`;

    equipmentList.forEach(eq => {
      xml += `
    <Item>
      <ARCITSID>${this.escapeXML(eq.arcItsId)}</ARCITSID>
      <Category>${this.escapeXML(eq.arcItsCategory)}</Category>
      <Function>${this.escapeXML(eq.arcItsFunction)}</Function>
      <Interface>${this.escapeXML(eq.arcItsInterface)}</Interface>
      <Location>
        <Latitude>${eq.latitude}</Latitude>
        <Longitude>${eq.longitude}</Longitude>
        ${eq.elevation ? `<Elevation>${eq.elevation}</Elevation>` : ''}
        ${eq.locationDescription ? `<Description>${this.escapeXML(eq.locationDescription)}</Description>` : ''}
        ${eq.route ? `<Route>${this.escapeXML(eq.route)}</Route>` : ''}
        ${eq.milepost ? `<Milepost>${eq.milepost}</Milepost>` : ''}
      </Location>
      <State>${this.escapeXML(eq.stateKey)}</State>
      <Status>${this.escapeXML(eq.status)}</Status>
      ${eq.manufacturer ? `<Manufacturer>${this.escapeXML(eq.manufacturer)}</Manufacturer>` : ''}
      ${eq.model ? `<Model>${this.escapeXML(eq.model)}</Model>` : ''}
      ${eq.installationDate ? `<InstallDate>${this.escapeXML(eq.installationDate)}</InstallDate>` : ''}
    </Item>`;
    });

    xml += `
  </Equipment>
</ARCITSInventory>`;

    return xml;
  }

  /**
   * Escape XML special characters
   */
  escapeXML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate ARC-ITS JSON export
   * @param {Array} equipmentList - ARC-ITS compliant equipment
   * @returns {Object} JSON object
   */
  generateARCITSJSON(equipmentList) {
    return {
      metadata: {
        standard: 'ARC-IT',
        version: '10.0',
        timestamp: new Date().toISOString(),
        totalEquipment: equipmentList.length
      },
      equipment: equipmentList.map(eq => ({
        arcItsId: eq.arcItsId,
        category: eq.arcItsCategory,
        function: eq.arcItsFunction,
        interface: eq.arcItsInterface,
        location: {
          latitude: eq.latitude,
          longitude: eq.longitude,
          elevation: eq.elevation,
          description: eq.locationDescription,
          route: eq.route,
          milepost: eq.milepost
        },
        state: eq.stateKey,
        status: eq.status,
        manufacturer: eq.manufacturer,
        model: eq.model,
        installationDate: eq.installationDate,
        ...(eq.equipmentType === 'rsu' ? {
          v2x: {
            protocols: eq.supportedProtocols,
            applications: eq.v2xApplications,
            messageTypes: eq.messageTypes,
            range: eq.communicationRange
          }
        } : {})
      }))
    };
  }
}

module.exports = ARCITSConverter;
