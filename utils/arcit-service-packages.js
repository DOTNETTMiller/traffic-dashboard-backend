/**
 * ARC-IT 10.0 Service Package Definitions
 *
 * Maps ITS equipment to National ITS Architecture service packages
 * Source: https://www.arc-it.net/html/servicepackages/servicepackages.html
 */

const SERVICE_PACKAGES = {
  // TRAFFIC MANAGEMENT
  TM01: {
    id: 'TM01',
    name: 'Network Surveillance',
    category: 'Traffic Management',
    description: 'Monitor traffic conditions using sensors, CCTV, and probe data',
    equipment: ['camera', 'sensor', 'rsu'],
    equipment_subtypes: ['traffic', 'cctv', 'radar', 'loop'],
    physical_objects: ['Roadway', 'Traffic Management Center', 'Roadside Equipment'],
    functional_requirements: [
      'Collect traffic data',
      'Monitor roadway conditions',
      'Process and quality check data',
      'Archive traffic data'
    ],
    standards: ['NTCIP 1203', 'NTCIP 1204', 'IEEE 1512', 'TMDD'],
    information_flows: [
      { from: 'Roadway Sensors', to: 'TMC', data: 'Traffic data' },
      { from: 'Cameras', to: 'TMC', data: 'Video surveillance' }
    ]
  },

  TM06: {
    id: 'TM06',
    name: 'Traffic Information Dissemination',
    category: 'Traffic Management',
    description: 'Provide traffic information to travelers via DMS, websites, apps',
    equipment: ['dms', 'rsu'],
    equipment_subtypes: ['vms', 'changeable_message_sign'],
    physical_objects: ['Roadside Equipment', 'Traffic Management Center', 'Personal Device'],
    functional_requirements: [
      'Format traveler information',
      'Disseminate information via DMS',
      'Broadcast travel times',
      'Provide roadway warnings'
    ],
    standards: ['NTCIP 1203', 'SAE J2735', 'TMDD'],
    information_flows: [
      { from: 'TMC', to: 'DMS', data: 'Traffic information' },
      { from: 'DMS', to: 'Travelers', data: 'Visual messages' }
    ]
  },

  TM08: {
    id: 'TM08',
    name: 'Traffic Incident Management System',
    category: 'Traffic Management',
    description: 'Detect, verify, and respond to traffic incidents',
    equipment: ['camera', 'sensor', 'dms'],
    equipment_subtypes: ['cctv', 'traffic'],
    physical_objects: ['Traffic Management Center', 'Emergency Management', 'Roadway'],
    functional_requirements: [
      'Detect incidents automatically',
      'Verify incidents via CCTV',
      'Coordinate response',
      'Manage traffic around incidents'
    ],
    standards: ['IEEE 1512', 'NTCIP 1203', 'TMDD'],
    information_flows: [
      { from: 'Sensors', to: 'TMC', data: 'Incident detection' },
      { from: 'TMC', to: 'Emergency', data: 'Incident notifications' }
    ]
  },

  // WEATHER MONITORING
  WX01: {
    id: 'WX01',
    name: 'Weather Information Processing and Distribution',
    category: 'Weather',
    description: 'Collect weather data and distribute to stakeholders',
    equipment: ['sensor'],
    equipment_subtypes: ['rwis', 'weather', 'ess'],
    physical_objects: ['Roadway', 'Weather Service', 'Maintenance and Construction'],
    functional_requirements: [
      'Collect environmental sensor data',
      'Process weather information',
      'Forecast road conditions',
      'Distribute weather data'
    ],
    standards: ['NTCIP 1204', 'NTCIP 1201', 'TMDD'],
    information_flows: [
      { from: 'RWIS Sensors', to: 'TMC', data: 'Road weather data' },
      { from: 'TMC', to: 'Maintenance', data: 'Weather forecasts' }
    ]
  },

  // CONNECTED VEHICLE
  CV01: {
    id: 'CV01',
    name: 'Vehicle Basic Safety Communication',
    category: 'Connected Vehicle',
    description: 'V2V and V2I safety messaging (BSM, TIM)',
    equipment: ['rsu'],
    equipment_subtypes: ['v2x', 'dsrc', 'c-v2x'],
    physical_objects: ['RSU', 'Vehicle OBE', 'Traffic Management Center'],
    functional_requirements: [
      'Broadcast Basic Safety Messages (BSM)',
      'Distribute Traveler Information Messages (TIM)',
      'Enable V2V communication',
      'Support safety applications'
    ],
    standards: ['SAE J2735', 'SAE J2945', 'IEEE 1609', 'IEEE 802.11p'],
    information_flows: [
      { from: 'RSU', to: 'Vehicles', data: 'TIM/SPAT/MAP messages' },
      { from: 'Vehicles', to: 'RSU', data: 'BSM/Probe data' }
    ]
  },

  CV02: {
    id: 'CV02',
    name: 'Vehicle Probe Data',
    category: 'Connected Vehicle',
    description: 'Collect and use probe data from connected vehicles',
    equipment: ['rsu'],
    equipment_subtypes: ['v2x'],
    physical_objects: ['RSU', 'Vehicle OBE', 'Traffic Management Center'],
    functional_requirements: [
      'Collect BSM data',
      'Process probe data',
      'Generate traffic metrics',
      'Identify incidents'
    ],
    standards: ['SAE J2735', 'TMDD'],
    information_flows: [
      { from: 'Vehicles', to: 'RSU', data: 'Probe data' },
      { from: 'RSU', to: 'TMC', data: 'Traffic conditions' }
    ]
  },

  CV10: {
    id: 'CV10',
    name: 'Situational Awareness',
    category: 'Connected Vehicle',
    description: 'Enhanced situation awareness for drivers via V2X',
    equipment: ['rsu', 'camera', 'sensor'],
    equipment_subtypes: ['v2x', 'cctv'],
    physical_objects: ['RSU', 'Roadway', 'Traffic Management Center'],
    functional_requirements: [
      'Detect hazardous conditions',
      'Broadcast situational awareness messages',
      'Provide curve speed warnings',
      'Alert to weather conditions'
    ],
    standards: ['SAE J2735', 'SAE J2945'],
    information_flows: [
      { from: 'Sensors', to: 'RSU', data: 'Environmental conditions' },
      { from: 'RSU', to: 'Vehicles', data: 'Situational awareness data' }
    ]
  },

  // MAINTENANCE & CONSTRUCTION
  MC01: {
    id: 'MC01',
    name: 'Maintenance and Construction Activity Coordination',
    category: 'Maintenance',
    description: 'Coordinate maintenance and construction activities',
    equipment: ['sensor', 'camera', 'dms'],
    equipment_subtypes: ['rwis', 'cctv'],
    physical_objects: ['Maintenance and Construction', 'Traffic Management Center'],
    functional_requirements: [
      'Coordinate work activities',
      'Manage lane closures',
      'Monitor work zones',
      'Disseminate work zone information'
    ],
    standards: ['WZDx', 'TMDD', 'NTCIP 1203'],
    information_flows: [
      { from: 'Maintenance', to: 'TMC', data: 'Work zone information' },
      { from: 'TMC', to: 'DMS', data: 'Work zone alerts' }
    ]
  },

  MC08: {
    id: 'MC08',
    name: 'Work Zone Management',
    category: 'Maintenance',
    description: 'Manage traffic through work zones',
    equipment: ['sensor', 'dms', 'camera'],
    equipment_subtypes: ['traffic', 'portable_dms'],
    physical_objects: ['Roadway', 'Maintenance and Construction', 'Traffic Management Center'],
    functional_requirements: [
      'Monitor work zone traffic',
      'Provide work zone information',
      'Manage queue warnings',
      'Control work zone devices'
    ],
    standards: ['WZDx', 'NTCIP 1203', 'SAE J2735'],
    information_flows: [
      { from: 'Work Zone Sensors', to: 'TMC', data: 'Queue detection' },
      { from: 'TMC', to: 'Portable DMS', data: 'Queue warnings' }
    ]
  },

  // ARCHIVED DATA
  AD1: {
    id: 'AD1',
    name: 'ITS Data Warehouse',
    category: 'Archived Data',
    description: 'Collect, archive, and distribute ITS data',
    equipment: ['sensor', 'camera', 'rsu'],
    equipment_subtypes: ['traffic', 'rwis', 'v2x'],
    physical_objects: ['Data Archive', 'Traffic Management Center'],
    functional_requirements: [
      'Collect ITS data',
      'Archive data for analysis',
      'Support data requests',
      'Enable research and planning'
    ],
    standards: ['TMDD', 'IEEE 1512'],
    information_flows: [
      { from: 'TMC', to: 'Archive', data: 'Historical traffic data' },
      { from: 'Archive', to: 'Planners', data: 'Archived data sets' }
    ]
  }
};

/**
 * Analyze equipment and determine applicable service packages
 */
function analyzeEquipment(equipment) {
  const applicablePackages = [];

  for (const [packageId, packageDef] of Object.entries(SERVICE_PACKAGES)) {
    // Check if equipment type matches
    if (packageDef.equipment.includes(equipment.equipment_type)) {
      let score = 1;

      // Boost score if subtype matches
      if (equipment.equipment_subtype &&
          packageDef.equipment_subtypes.includes(equipment.equipment_subtype)) {
        score += 2;
      }

      // Check sensor_type for sensors
      if (equipment.equipment_type === 'sensor' && equipment.sensor_type) {
        if (packageDef.equipment_subtypes.includes(equipment.sensor_type)) {
          score += 2;
        }
      }

      applicablePackages.push({
        ...packageDef,
        score,
        match_reason: getMatchReason(equipment, packageDef)
      });
    }
  }

  // Sort by score (highest first)
  return applicablePackages.sort((a, b) => b.score - a.score);
}

function getMatchReason(equipment, packageDef) {
  const reasons = [];

  if (packageDef.equipment.includes(equipment.equipment_type)) {
    reasons.push(`Equipment type: ${equipment.equipment_type}`);
  }

  if (equipment.equipment_subtype &&
      packageDef.equipment_subtypes.includes(equipment.equipment_subtype)) {
    reasons.push(`Subtype: ${equipment.equipment_subtype}`);
  }

  if (equipment.sensor_type &&
      packageDef.equipment_subtypes.includes(equipment.sensor_type)) {
    reasons.push(`Sensor type: ${equipment.sensor_type}`);
  }

  return reasons.join(', ');
}

/**
 * Analyze all equipment and generate architecture summary
 */
function analyzeRegionalArchitecture(equipmentList) {
  const servicePackageUsage = {};
  const physicalObjects = new Set();
  const standards = new Set();
  const informationFlows = [];

  for (const equipment of equipmentList) {
    const packages = analyzeEquipment(equipment);

    for (const pkg of packages) {
      if (!servicePackageUsage[pkg.id]) {
        servicePackageUsage[pkg.id] = {
          ...pkg,
          equipment_count: 0,
          equipment_examples: []
        };
      }

      servicePackageUsage[pkg.id].equipment_count++;

      if (servicePackageUsage[pkg.id].equipment_examples.length < 5) {
        servicePackageUsage[pkg.id].equipment_examples.push({
          id: equipment.id,
          type: equipment.equipment_type,
          location: equipment.route || equipment.location_description
        });
      }

      // Collect physical objects
      pkg.physical_objects.forEach(obj => physicalObjects.add(obj));

      // Collect standards
      pkg.standards.forEach(std => standards.add(std));

      // Collect information flows
      informationFlows.push(...pkg.information_flows);
    }
  }

  return {
    total_equipment: equipmentList.length,
    service_packages: Object.values(servicePackageUsage),
    service_package_count: Object.keys(servicePackageUsage).length,
    physical_objects: Array.from(physicalObjects),
    standards_required: Array.from(standards),
    information_flows: informationFlows,
    compliance_score: calculateComplianceScore(equipmentList, servicePackageUsage)
  };
}

function calculateComplianceScore(equipmentList, servicePackageUsage) {
  // Simple compliance scoring
  let score = 0;
  let total = 0;

  for (const equipment of equipmentList) {
    total++;

    // Has ARC-IT ID?
    if (equipment.arc_its_id) score += 0.3;

    // Has manufacturer/model info?
    if (equipment.manufacturer && equipment.model) score += 0.2;

    // Has location info?
    if (equipment.latitude && equipment.longitude) score += 0.2;

    // Is active?
    if (equipment.status === 'active' || equipment.status === 'OK') score += 0.3;
  }

  return total > 0 ? Math.round((score / total) * 100) : 0;
}

module.exports = {
  SERVICE_PACKAGES,
  analyzeEquipment,
  analyzeRegionalArchitecture
};
