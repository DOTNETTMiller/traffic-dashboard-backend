/**
 * Populate ITS Standards Library
 *
 * Seeds the architecture database with common ITS standards
 * that can be referenced in architecture documentation
 */

const db = require('../database');

const ITS_STANDARDS = [
  // SAE Standards
  {
    standard_id: 'SAE J2735',
    name: 'Dedicated Short Range Communications (DSRC) Message Set Dictionary',
    organization: 'SAE International',
    category: 'Message Sets',
    version: '2016',
    description: 'Defines a message set, and its data frames and data elements specifically for use by applications intended to utilize the 5.9 GHz Dedicated Short Range Communications for Wireless Access in Vehicular Environments (DSRC/WAVE).',
    document_url: 'https://www.sae.org/standards/content/j2735_201603/',
    purchase_url: 'https://www.sae.org/standards/content/j2735_201603/',
    scope: 'V2X message definitions (BSM, TIM, SPaT, MAP, PSM, etc.)',
    related_standards: ['IEEE 1609.3', 'IEEE 1609.2']
  },
  {
    standard_id: 'SAE J2945/1',
    name: 'On-Board System Requirements for V2V Safety Communications',
    organization: 'SAE International',
    category: 'Applications',
    version: '2016',
    description: 'Minimum performance requirements for OBE in support of V2V safety applications',
    document_url: 'https://www.sae.org/standards/content/j2945/1_201603/',
    scope: 'V2V safety application requirements'
  },

  // IEEE Standards
  {
    standard_id: 'IEEE 1609.2',
    name: 'Security Services for Applications and Management Messages',
    organization: 'IEEE',
    category: 'Security',
    version: '2016',
    description: 'Defines secure message formats and processing for use by WAVE devices',
    document_url: 'https://standards.ieee.org/standard/1609_2-2016.html',
    scope: 'WAVE security certificates and message signing',
    related_standards: ['SAE J2735', 'IEEE 1609.3']
  },
  {
    standard_id: 'IEEE 1609.3',
    name: 'Networking Services',
    organization: 'IEEE',
    category: 'Protocols',
    version: '2016',
    description: 'Defines network and transport layer services for WAVE devices',
    document_url: 'https://standards.ieee.org/standard/1609_3-2016.html',
    scope: 'WAVE networking protocols',
    related_standards: ['IEEE 1609.2', 'IEEE 1609.4']
  },
  {
    standard_id: 'IEEE 1609.4',
    name: 'Multi-Channel Operation',
    organization: 'IEEE',
    category: 'Protocols',
    version: '2016',
    description: 'Defines multi-channel wireless radio operations',
    document_url: 'https://standards.ieee.org/standard/1609_4-2016.html',
    scope: 'DSRC channel management'
  },

  // NTCIP Standards (Traffic Signal Control)
  {
    standard_id: 'NTCIP 1202',
    name: 'Actuated Signal Controller (ASC) Interface',
    organization: 'AASHTO/ITE/NEMA',
    category: 'Protocols',
    version: 'v3',
    description: 'Standard for communication between traffic signal controllers and management systems',
    document_url: 'https://www.ntcip.org/library/documents/',
    scope: 'Traffic signal controller communications',
    related_standards: ['NTCIP 1218']
  },
  {
    standard_id: 'NTCIP 1218',
    name: 'Roadside Equipment (RSE) to TMC Communications',
    organization: 'AASHTO/ITE/NEMA',
    category: 'Protocols',
    version: '1.0',
    description: 'Standard for communication between RSUs and traffic management centers',
    document_url: 'https://www.ntcip.org/library/documents/',
    scope: 'RSU-TMC data exchange'
  },

  // TMDD (Traffic Management Data Dictionary)
  {
    standard_id: 'TMDD',
    name: 'Traffic Management Data Dictionary',
    organization: 'AASHTO',
    category: 'Data Dictionaries',
    version: 'v3.1',
    description: 'Standard data dictionary for center-to-center communications in traffic management',
    document_url: 'https://www.standards.its.dot.gov/Catalog/TMDD',
    scope: 'TMC-to-TMC data exchange protocols and message definitions'
  },

  // IFC/BIM Standards
  {
    standard_id: 'IFC 4.3',
    name: 'Industry Foundation Classes for Infrastructure',
    organization: 'buildingSMART International',
    category: 'Data Models',
    version: '4.3',
    description: 'Open data schema for Building Information Modeling including infrastructure extensions',
    document_url: 'https://standards.buildingsmart.org/IFC',
    scope: 'BIM for bridges, roads, and infrastructure assets',
    related_standards: ['IDS 1.0']
  },
  {
    standard_id: 'IDS 1.0',
    name: 'Information Delivery Specification',
    organization: 'buildingSMART International',
    category: 'Data Exchange',
    version: '1.0',
    description: 'XML-based specification for defining BIM exchange requirements',
    document_url: 'https://technical.buildingsmart.org/projects/information-delivery-specification-ids/',
    scope: 'BIM model validation and requirements specification',
    related_standards: ['IFC 4.3']
  },

  // WZDx (Work Zone Data Exchange)
  {
    standard_id: 'WZDx v4.2',
    name: 'Work Zone Data Exchange',
    organization: 'USDOT',
    category: 'Data Exchange',
    version: '4.2',
    description: 'Specification for publishing work zone activity data in a standard format',
    document_url: 'https://github.com/usdot-jpo-ode/wzdx',
    scope: 'Work zone and construction information sharing'
  },

  // ISO Standards
  {
    standard_id: 'ISO 19091',
    name: 'Cooperative ITS - Using V2I and I2V communications for applications related to signalized intersections',
    organization: 'ISO',
    category: 'Applications',
    version: '2019',
    description: 'International standard for intersection-related V2I applications',
    document_url: 'https://www.iso.org/standard/69897.html',
    scope: 'SPaT and MAP message definitions (international version of SAE J2735)',
    related_standards: ['SAE J2735']
  },

  // FHWA Standards
  {
    standard_id: 'ARNOLD',
    name: 'All Roads Network of Linear Referencing Data',
    organization: 'FHWA',
    category: 'Linear Referencing',
    version: '1.0',
    description: 'Standard for highway linear referencing systems',
    document_url: 'https://www.fhwa.dot.gov/policyinformation/arnold/',
    scope: 'Milepost-based asset location and referencing'
  },

  // Transit Standards
  {
    standard_id: 'GTFS',
    name: 'General Transit Feed Specification',
    organization: 'Google/MobilityData',
    category: 'Data Exchange',
    version: 'Latest',
    description: 'Specification for public transportation schedules and geographic information',
    document_url: 'https://gtfs.org/',
    scope: 'Transit schedule and routing data',
    related_standards: ['GTFS-RT']
  },
  {
    standard_id: 'GTFS-RT',
    name: 'General Transit Feed Specification - Realtime',
    organization: 'Google/MobilityData',
    category: 'Data Exchange',
    version: 'Latest',
    description: 'Real-time extension to GTFS for transit vehicle positions and service alerts',
    document_url: 'https://gtfs.org/realtime/',
    scope: 'Real-time transit data',
    related_standards: ['GTFS']
  },

  // Geospatial Standards
  {
    standard_id: 'GeoJSON',
    name: 'GeoJSON Format Specification',
    organization: 'IETF',
    category: 'Data Formats',
    version: 'RFC 7946',
    description: 'JSON-based format for encoding geographic data structures',
    document_url: 'https://datatracker.ietf.org/doc/html/rfc7946',
    scope: 'Geographic feature representation'
  },
  {
    standard_id: 'Shapefile',
    name: 'ESRI Shapefile Format',
    organization: 'ESRI',
    category: 'Data Formats',
    version: 'Latest',
    description: 'Geospatial vector data format',
    document_url: 'https://www.esri.com/content/dam/esrisites/sitecore-archive/Files/Pdfs/library/whitepapers/pdfs/shapefile.pdf',
    scope: 'GIS vector data storage and exchange'
  }
];

async function populateStandards() {
  console.log('Populating ITS Standards Library...\n');

  try {
    let added = 0;
    let skipped = 0;

    for (const standard of ITS_STANDARDS) {
      try {
        await db.runAsync(`
          INSERT INTO arch_standards (
            standard_id, name, organization, category, version,
            description, document_url, purchase_url, scope, related_standards
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          standard.standard_id,
          standard.name,
          standard.organization,
          standard.category,
          standard.version || 'Latest',
          standard.description,
          standard.document_url,
          standard.purchase_url || '',
          standard.scope,
          JSON.stringify(standard.related_standards || [])
        ]);

        console.log(`✓ Added: ${standard.standard_id}`);
        added++;

      } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
          console.log(`⊘ Skipped (already exists): ${standard.standard_id}`);
          skipped++;
        } else {
          console.error(`✗ Error adding ${standard.standard_id}:`, error.message);
        }
      }
    }

    console.log(`\n✅ Standards population complete!`);
    console.log(`   Added: ${added}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total in library: ${added + skipped}\n`);

  } catch (error) {
    console.error('❌ Error populating standards:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  populateStandards()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { populateStandards, ITS_STANDARDS };
