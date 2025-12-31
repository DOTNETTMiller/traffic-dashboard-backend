/**
 * Populate ARC-IT Service Packages
 *
 * Seeds the architecture database with key ARC-IT service packages
 * Full ARC-IT has ~200 service packages - this includes the most relevant ones
 * for corridor/V2X/ITS deployments
 */

const db = require('../database');

// Most commonly used ARC-IT service packages for corridor ITS
const SERVICE_PACKAGES = [
  // Traffic Management (TM)
  {
    package_id: 'TM01',
    name: 'Infrastructure-Based Traffic Surveillance',
    category: 'Traffic Management',
    description: 'Monitor traffic conditions using loop detectors, CCTV, and other sensors to support traffic operations',
    user_needs: ['Real-time traffic monitoring', 'Incident detection', 'Traffic data collection'],
    requirements: ['Traffic sensors', 'Data collection systems', 'TMC infrastructure'],
    standards: ['NTCIP 1202', 'NTCIP 1203', 'TMDD']
  },
  {
    package_id: 'TM02',
    name: 'Vehicle-Based Traffic Surveillance',
    category: 'Traffic Management',
    description: 'Use connected vehicle data (probe data) for traffic monitoring',
    user_needs: ['Enhanced traffic monitoring', 'Coverage beyond fixed sensors', 'Real-time speed data'],
    requirements: ['V2X communication', 'Probe data processing', 'Data aggregation'],
    standards: ['SAE J2735', 'IEEE 1609', 'TMDD']
  },
  {
    package_id: 'TM03',
    name: 'Traffic Signal Control',
    category: 'Traffic Management',
    description: 'Control traffic signals to optimize traffic flow',
    user_needs: ['Optimized signal timing', 'Coordination between signals', 'Adaptive control'],
    requirements: ['Signal controllers', 'Communication to controllers', 'TMC integration'],
    standards: ['NTCIP 1202', 'NTCIP 1218']
  },
  {
    package_id: 'TM06',
    name: 'Traffic Information Dissemination',
    category: 'Traffic Management',
    description: 'Provide traffic information via DMS, HAR, 511, websites, apps',
    user_needs: ['Traveler information', 'Incident notifications', 'Travel time estimates'],
    requirements: ['DMS', 'Communication infrastructure', '511 system'],
    standards: ['NTCIP 1203', 'TMDD', 'WZDx']
  },
  {
    package_id: 'TM08',
    name: 'Traffic Incident Management System',
    category: 'Traffic Management',
    description: 'Detect, verify, and respond to traffic incidents',
    user_needs: ['Fast incident detection', 'Coordination with emergency services', 'Incident clearance'],
    requirements: ['Incident detection algorithms', 'CAD integration', 'Multi-agency coordination'],
    standards: ['TMDD', 'ITS Data Dictionary']
  },

  // Freeway Management (FM)
  {
    package_id: 'FM01',
    name: 'Freeway Operations',
    category: 'Freeway Management',
    description: 'Monitor and manage freeway operations including ramp metering',
    user_needs: ['Congestion management', 'Incident response', 'Ramp metering'],
    requirements: ['Freeway sensors', 'Ramp meters', 'TMC systems'],
    standards: ['NTCIP 1202', 'TMDD']
  },

  // V2X and Connected Vehicles (CV)
  {
    package_id: 'CV01',
    name: 'Vehicle Basic Safety',
    category: 'Connected Vehicles',
    description: 'Basic V2V safety applications using BSM',
    user_needs: ['Collision avoidance', 'Situational awareness', 'Safety warnings'],
    requirements: ['OBU in vehicles', 'V2V communication', 'Safety applications'],
    standards: ['SAE J2735', 'SAE J2945/1', 'IEEE 1609.2', 'IEEE 1609.3']
  },
  {
    package_id: 'CV02',
    name: 'V2I Safety',
    category: 'Connected Vehicles',
    description: 'Infrastructure-to-vehicle safety communications',
    user_needs: ['Curve speed warnings', 'Wrong-way driver alerts', 'Work zone warnings'],
    requirements: ['RSUs', 'Infrastructure sensors', 'Safety message generation'],
    standards: ['SAE J2735', 'IEEE 1609', 'NTCIP 1218']
  },
  {
    package_id: 'CV03',
    name: 'Intelligent Traffic Signal System (I-SIG)',
    category: 'Connected Vehicles',
    description: 'SPaT and MAP data broadcast for signal awareness',
    user_needs: ['Signal phase information', 'Green light optimal speed', 'Red light warning'],
    requirements: ['Signal controllers with SPaT', 'RSUs', 'MAP data'],
    standards: ['SAE J2735', 'ISO 19091', 'NTCIP 1202']
  },
  {
    package_id: 'CV04',
    name: 'Cooperative Adaptive Cruise Control',
    category: 'Connected Vehicles',
    description: 'Platooning and cooperative ACC using V2V',
    user_needs: ['Fuel efficiency', 'Reduced congestion', 'Automated following'],
    requirements: ['V2V communication', 'Vehicle automation', 'Cooperative algorithms'],
    standards: ['SAE J2735', 'SAE J2945']
  },
  {
    package_id: 'CV05',
    name: 'Road Weather Motorist Alert and Warning',
    category: 'Connected Vehicles',
    description: 'Provide weather and road condition information to vehicles',
    user_needs: ['Weather warnings', 'Road condition alerts', 'Visibility information'],
    requirements: ['RWIS', 'RSUs', 'Weather data integration'],
    standards: ['SAE J2735', 'NTCIP 1204']
  },

  // Work Zone (WZ)
  {
    package_id: 'WZ01',
    name: 'Work Zone Management',
    category: 'Work Zones',
    description: 'Manage and disseminate work zone information',
    user_needs: ['Work zone awareness', 'Speed reduction', 'Safety'],
    requirements: ['Work zone data systems', 'Dynamic speed limits', 'Variable message signs'],
    standards: ['WZDx', 'NTCIP 1203']
  },

  // Commercial Vehicle Operations (CVO)
  {
    package_id: 'CVO01',
    name: 'Fleet Administration',
    category: 'Commercial Vehicle Operations',
    description: 'Fleet management and dispatch',
    user_needs: ['Fleet tracking', 'Route optimization', 'Communication with drivers'],
    requirements: ['Fleet management systems', 'Mobile data terminals', 'GPS'],
    standards: ['TMDD']
  },
  {
    package_id: 'CVO06',
    name: 'Freight-Specific Dynamic Travel Planning',
    category: 'Commercial Vehicle Operations',
    description: 'Provide freight-specific routing and travel information',
    user_needs: ['Truck routing', 'Bridge clearance info', 'Parking availability'],
    requirements: ['Freight data systems', 'Bridge/tunnel databases', 'Truck parking systems'],
    standards: ['TMDD']
  },

  // Maintenance and Construction (MC)
  {
    package_id: 'MC01',
    name: 'Maintenance and Construction Vehicle and Equipment Tracking',
    category: 'Maintenance & Construction',
    description: 'Track maintenance vehicles and equipment',
    user_needs: ['Asset tracking', 'Fleet management', 'Resource allocation'],
    requirements: ['AVL systems', 'Fleet management', 'GPS'],
    standards: ['TMDD']
  },
  {
    package_id: 'MC08',
    name: 'Winter Maintenance',
    category: 'Maintenance & Construction',
    description: 'Coordinate winter maintenance operations',
    user_needs: ['Snow plow tracking', 'Treatment application', 'Route optimization'],
    requirements: ['AVL on plows', 'RWIS', 'Material tracking'],
    standards: ['NTCIP 1204']
  },

  // Emergency Management (EM)
  {
    package_id: 'EM01',
    name: 'Emergency Response',
    category: 'Emergency Management',
    description: 'Coordinate emergency response to incidents',
    user_needs: ['Fast emergency dispatch', 'Route optimization', 'Multi-agency coordination'],
    requirements: ['CAD integration', 'AVL on emergency vehicles', 'Communication systems'],
    standards: ['TMDD']
  },

  // Transit (PT)
  {
    package_id: 'PT01',
    name: 'Transit Vehicle Tracking',
    category: 'Public Transportation',
    description: 'Track transit vehicles in real-time',
    user_needs: ['Real-time bus locations', 'Schedule adherence', 'Fleet management'],
    requirements: ['AVL on buses', 'Dispatch systems', 'GPS'],
    standards: ['GTFS-RT']
  },
  {
    package_id: 'PT02',
    name: 'Transit Fixed-Route Operations',
    category: 'Public Transportation',
    description: 'Manage fixed-route transit operations',
    user_needs: ['Schedule management', 'Route planning', 'Real-time information'],
    requirements: ['Transit management systems', 'Real-time data', 'Passenger information'],
    standards: ['GTFS', 'GTFS-RT']
  },

  // Archived Data (AD)
  {
    package_id: 'AD1',
    name: 'ITS Data Mart',
    category: 'Archived Data',
    description: 'Archive and provide access to ITS data',
    user_needs: ['Historical data analysis', 'Performance measurement', 'Research'],
    requirements: ['Data warehouse', 'Data collection interfaces', 'Query tools'],
    standards: ['TMDD']
  },

  // Traveler Information (TI)
  {
    package_id: 'TI01',
    name: 'Broadcast Traveler Information',
    category: 'Traveler Information',
    description: 'Provide traveler information via multiple channels',
    user_needs: ['Pre-trip planning', 'En-route information', 'Multi-modal info'],
    requirements: ['511 system', 'Website', 'Mobile apps', 'DMS'],
    standards: ['TMDD', '511 Deployment Coalition specs']
  },

  // Parking Management (PM)
  {
    package_id: 'PM01',
    name: 'Parking Space Management',
    category: 'Parking Management',
    description: 'Manage parking facility operations and availability',
    user_needs: ['Parking availability info', 'Reservations', 'Payment'],
    requirements: ['Parking sensors', 'Reservation systems', 'Dynamic pricing'],
    standards: []
  }
];

async function populateServicePackages() {
  console.log('Populating ARC-IT Service Packages...\n');

  try {
    let added = 0;
    let skipped = 0;

    for (const sp of SERVICE_PACKAGES) {
      try {
        await db.runAsync(`
          INSERT INTO arch_service_packages (
            package_id, name, category, description,
            user_needs, requirements, standards, active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          sp.package_id,
          sp.name,
          sp.category,
          sp.description,
          JSON.stringify(sp.user_needs),
          JSON.stringify(sp.requirements),
          JSON.stringify(sp.standards)
        ]);

        console.log(`✓ Added: ${sp.package_id} - ${sp.name}`);
        added++;

      } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
          console.log(`⊘ Skipped (already exists): ${sp.package_id}`);
          skipped++;
        } else {
          console.error(`✗ Error adding ${sp.package_id}:`, error.message);
        }
      }
    }

    console.log(`\n✅ Service packages population complete!`);
    console.log(`   Added: ${added}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total in library: ${added + skipped}\n`);

  } catch (error) {
    console.error('❌ Error populating service packages:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  populateServicePackages()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { populateServicePackages, SERVICE_PACKAGES };
