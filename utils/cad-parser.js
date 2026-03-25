/**
 * CADD File Parser
 *
 * Parses CAD files (DXF, DWG, DGN) and extracts operational elements:
 * - ITS equipment (signs, signals, cameras, DMS)
 * - Road geometry (centerlines, lane markings)
 * - Traffic control devices
 * - Work zones and construction staging
 * - Utilities and drainage
 *
 * Similar to IFC parser but for CADD design files
 */

const fs = require('fs');
const path = require('path');
const DxfParser = require('dxf-parser');

class CADDParser {
  constructor() {
    this.entities = [];
    this.layers = new Map();
    this.blocks = new Map();
    this.metadata = {};
    this.extractionLog = [];
    this.itsEquipment = [];
    this.roadGeometry = [];
    this.trafficDevices = [];
  }

  /**
   * Parse a CADD file and extract operational elements
   */
  async parseFile(filePath) {
    this.log(`Starting CADD file parsing: ${path.basename(filePath)}`);

    const ext = path.extname(filePath).toLowerCase();

    try {
      switch (ext) {
        case '.dxf':
          return await this.parseDXF(filePath);
        case '.dwg':
          return await this.parseDWG(filePath);
        case '.dgn':
          return await this.parseDGN(filePath);
        default:
          throw new Error(`Unsupported CADD file format: ${ext}`);
      }
    } catch (error) {
      this.log(`ERROR: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Parse DXF file (AutoCAD Exchange Format)
   * Text-based, easiest to parse
   */
  async parseDXF(filePath) {
    this.log('Parsing DXF file...');

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parser = new DxfParser();
    const dxf = parser.parseSync(fileContent);

    if (!dxf) {
      throw new Error('Failed to parse DXF file');
    }

    this.log(`DXF parsed successfully. Version: ${dxf.header?.$ACADVER || 'Unknown'}`);

    // Extract metadata
    this.extractMetadata(dxf);

    // Extract layers
    this.extractLayers(dxf);

    // Extract entities (lines, polylines, circles, text, blocks, etc.)
    this.extractEntities(dxf);

    // Extract blocks (reusable symbols like ITS equipment)
    this.extractBlocks(dxf);

    // Classify elements by operational significance
    this.classifyOperationalElements();

    return {
      format: 'DXF',
      metadata: this.metadata,
      layers: Array.from(this.layers.values()),
      entities: this.entities,
      blocks: Array.from(this.blocks.values()),
      itsEquipment: this.itsEquipment,
      roadGeometry: this.roadGeometry,
      electricalInfrastructure: this.electricalInfrastructure,
      pedestrianInfrastructure: this.pedestrianInfrastructure,
      trafficDevices: this.trafficDevices,
      utilities: this.utilities,
      workZone: this.workZone,
      extractionLog: this.extractionLog,
      statistics: this.getStatistics()
    };
  }

  /**
   * Parse DWG file (AutoCAD native binary format)
   * More complex - would need conversion to DXF or specialized library
   */
  async parseDWG(filePath) {
    this.log('DWG parsing requested...');

    // DWG is binary and complex - two approaches:
    // 1. Use conversion service (AutoCAD ODA File Converter)
    // 2. Use specialized library (not available in Node easily)

    // For now, suggest conversion to DXF
    throw new Error(
      'DWG parsing not yet implemented. ' +
      'Please convert DWG to DXF using AutoCAD or FreeCAD: ' +
      'File > Save As > DXF'
    );

    // TODO: Implement DWG parsing via conversion or library
    // Could use child_process to call ODA FileConverter if installed
  }

  /**
   * Parse DGN file (MicroStation native format)
   * Very common in state DOT workflows
   */
  async parseDGN(filePath) {
    this.log('DGN parsing requested...');

    // DGN is Bentley MicroStation's format
    // Two versions: DGN v7 (older) and DGN v8 (newer, based on DWG)

    // For now, suggest conversion to DXF
    throw new Error(
      'DGN parsing not yet implemented. ' +
      'Please convert DGN to DXF using MicroStation or FME: ' +
      'File > Save As > DXF'
    );

    // TODO: Implement DGN parsing
    // Could use GDAL/OGR libraries (support DGN via libopendgn)
    // Or use FME/conversion service
  }

  /**
   * Extract metadata from parsed CAD file
   */
  extractMetadata(dxf) {
    this.metadata = {
      version: dxf.header?.$ACADVER || 'Unknown',
      units: dxf.header?.$INSUNITS || 0,
      extents: {
        min: dxf.header?.$EXTMIN || { x: 0, y: 0, z: 0 },
        max: dxf.header?.$EXTMAX || { x: 0, y: 0, z: 0 }
      },
      layers: dxf.tables?.layer?.layers ? Object.keys(dxf.tables.layer.layers).length : 0,
      blocks: dxf.blocks ? Object.keys(dxf.blocks).length : 0
    };

    this.log(`Metadata extracted: ${this.metadata.layers} layers, ${this.metadata.blocks} blocks`);
  }

  /**
   * Extract layers from DXF
   */
  extractLayers(dxf) {
    if (!dxf.tables?.layer?.layers) {
      this.log('No layers found in DXF');
      return;
    }

    for (const [layerName, layer] of Object.entries(dxf.tables.layer.layers)) {
      this.layers.set(layerName, {
        name: layerName,
        color: layer.color,
        visible: !layer.flags || (layer.flags & 1) === 0,
        frozen: layer.flags && (layer.flags & 2) !== 0,
        entityCount: 0
      });
    }

    this.log(`Extracted ${this.layers.size} layers`);
  }

  /**
   * Extract entities (lines, polylines, circles, text, inserts)
   */
  extractEntities(dxf) {
    if (!dxf.entities) {
      this.log('No entities found in DXF');
      return;
    }

    for (const entity of dxf.entities) {
      const processedEntity = {
        type: entity.type,
        layer: entity.layer || '0',
        handle: entity.handle,
        color: entity.color,
        lineWeight: entity.lineweight
      };

      // Extract geometry based on type
      switch (entity.type) {
        case 'LINE':
          processedEntity.geometry = {
            start: entity.vertices?.[0] || { x: 0, y: 0, z: 0 },
            end: entity.vertices?.[1] || { x: 0, y: 0, z: 0 }
          };
          break;

        case 'POLYLINE':
        case 'LWPOLYLINE':
          processedEntity.geometry = {
            vertices: entity.vertices || [],
            closed: entity.shape || false
          };
          break;

        case 'CIRCLE':
          processedEntity.geometry = {
            center: entity.center || { x: 0, y: 0, z: 0 },
            radius: entity.radius || 0
          };
          break;

        case 'ARC':
          processedEntity.geometry = {
            center: entity.center || { x: 0, y: 0, z: 0 },
            radius: entity.radius || 0,
            startAngle: entity.startAngle || 0,
            endAngle: entity.endAngle || 0
          };
          break;

        case 'TEXT':
        case 'MTEXT':
          processedEntity.text = entity.text || '';
          processedEntity.geometry = {
            position: entity.position || { x: 0, y: 0, z: 0 },
            height: entity.textHeight || 0
          };
          break;

        case 'INSERT':
          // Block reference (important for ITS equipment symbols)
          processedEntity.blockName = entity.name;
          processedEntity.geometry = {
            position: entity.position || { x: 0, y: 0, z: 0 },
            rotation: entity.rotation || 0,
            scale: entity.scale || { x: 1, y: 1, z: 1 }
          };
          break;

        case 'POINT':
          processedEntity.geometry = {
            position: entity.position || { x: 0, y: 0, z: 0 }
          };
          break;
      }

      this.entities.push(processedEntity);

      // Update layer entity count
      const layer = this.layers.get(entity.layer || '0');
      if (layer) {
        layer.entityCount++;
      }
    }

    this.log(`Extracted ${this.entities.length} entities`);
  }

  /**
   * Extract blocks (reusable symbols)
   */
  extractBlocks(dxf) {
    if (!dxf.blocks) {
      this.log('No blocks found in DXF');
      return;
    }

    for (const [blockName, block] of Object.entries(dxf.blocks)) {
      this.blocks.set(blockName, {
        name: blockName,
        entities: block.entities?.length || 0,
        basePoint: block.position || { x: 0, y: 0, z: 0 }
      });
    }

    this.log(`Extracted ${this.blocks.size} blocks`);
  }

  /**
   * Classify elements by operational significance for ITS
   *
   * Broad classification recognizing that many civil/infrastructure layers
   * are operationally relevant to ITS deployment and operations:
   * - ITS equipment (signs, signals, cameras, DMS, sensors, RSUs)
   * - Road geometry (centerlines, edges, curbs, lane markings, alignment)
   * - Electrical infrastructure (power, conduit, wiring - ITS device power)
   * - Pedestrian infrastructure (sidewalks, crosswalks, ADA - ped detection)
   * - Traffic control devices (barriers, guardrails, attenuators)
   * - Utilities (water, sewer, gas - conflict avoidance for ITS install)
   * - Work zones (staging, construction, detours)
   */
  classifyOperationalElements() {
    this.log('Classifying operational elements...');

    // Broader classification recognizing ITS relevance of civil infrastructure
    const layerPatterns = {
      itsEquipment: [
        /sign/i,
        /signal/i,
        /camera/i,
        /cctv/i,
        /dms/i,
        /vms/i,
        /detector/i,
        /sensor/i,
        /rsu/i,
        /beacon/i,
        /flasher/i,
        /fiber/i,
        /comm/i,
        /antenna/i,
        /controller/i,
        /cabinet/i,
        /luminaire/i,
        /light(?!ning)/i
      ],
      roadGeometry: [
        /centerline/i,
        /cl$/i,
        /edge/i,
        /lane/i,
        /pavement/i,
        /marking/i,
        /stripe/i,
        /curb/i,
        /median/i,
        /shoulder/i,
        /grading/i,
        /alignment/i,
        /geo_/i,
        /cor_/i,
        /profile/i,
        /cross.*section/i
      ],
      electricalInfrastructure: [
        /elec/i,
        /power/i,
        /wiring/i,
        /conduit/i,
        /junction/i,
        /jut/i,
        /transformer/i,
        /pole/i,
        /circuit/i,
        /voltage/i,
        /lumen/i
      ],
      pedestrianInfrastructure: [
        /sidewalk/i,
        /crosswalk/i,
        /ped/i,
        /ada/i,
        /ramp/i,
        /detectable.*warn/i,
        /dwp/i,
        /handrail/i,
        /walk/i
      ],
      trafficDevices: [
        /traffic/i,
        /trf/i,
        /control/i,
        /barrier/i,
        /guardrail/i,
        /attenuator/i,
        /turn/i
      ],
      utilities: [
        /util/i,
        /water/i,
        /sewer/i,
        /sanitary/i,
        /gas/i,
        /storm/i,
        /drain/i,
        /drn/i
      ],
      workZone: [
        /staging/i,
        /stg_/i,
        /construction/i,
        /work.*zone/i,
        /temporary/i,
        /detour/i
      ]
    };

    // Also track these new categories
    this.electricalInfrastructure = [];
    this.pedestrianInfrastructure = [];
    this.utilities = [];
    this.workZone = [];

    // Classify entities by layer name
    for (const entity of this.entities) {
      const layerName = entity.layer || '';
      let classified = false;

      // Check ITS equipment patterns
      if (layerPatterns.itsEquipment.some(pattern => pattern.test(layerName))) {
        this.itsEquipment.push({
          ...entity,
          category: 'ITS Equipment',
          itsRelevance: 'Direct - ITS device or communication',
          type: this.inferITSType(layerName, entity)
        });
        classified = true;
      }

      // Check road geometry patterns
      if (layerPatterns.roadGeometry.some(pattern => pattern.test(layerName))) {
        this.roadGeometry.push({
          ...entity,
          category: 'Road Geometry',
          itsRelevance: 'Lane geometry for CV/AV navigation, V2X road model'
        });
        classified = true;
      }

      // Check electrical infrastructure (ITS power availability)
      if (layerPatterns.electricalInfrastructure.some(pattern => pattern.test(layerName))) {
        this.electricalInfrastructure.push({
          ...entity,
          category: 'Electrical Infrastructure',
          itsRelevance: 'Power source availability for ITS device placement'
        });
        classified = true;
      }

      // Check pedestrian infrastructure (ped detection zones)
      if (layerPatterns.pedestrianInfrastructure.some(pattern => pattern.test(layerName))) {
        this.pedestrianInfrastructure.push({
          ...entity,
          category: 'Pedestrian Infrastructure',
          itsRelevance: 'Pedestrian detection zones, ADA compliance, V2P safety'
        });
        classified = true;
      }

      // Check traffic devices
      if (layerPatterns.trafficDevices.some(pattern => pattern.test(layerName))) {
        this.trafficDevices.push({
          ...entity,
          category: 'Traffic Control Device',
          itsRelevance: 'Traffic control coordination with ITS'
        });
        classified = true;
      }

      // Check utilities (conflict avoidance for ITS installation)
      if (layerPatterns.utilities.some(pattern => pattern.test(layerName))) {
        this.utilities.push({
          ...entity,
          category: 'Utility',
          itsRelevance: 'Conflict avoidance for ITS device installation'
        });
        classified = true;
      }

      // Check work zones
      if (layerPatterns.workZone.some(pattern => pattern.test(layerName))) {
        this.workZone.push({
          ...entity,
          category: 'Work Zone',
          itsRelevance: 'Active work zone - WZDx feed, dynamic messaging'
        });
        classified = true;
      }
    }

    this.log(`Classified: ${this.itsEquipment.length} ITS equipment, ${this.roadGeometry.length} road geometry, ${this.electricalInfrastructure.length} electrical, ${this.pedestrianInfrastructure.length} pedestrian, ${this.trafficDevices.length} traffic devices, ${this.utilities.length} utilities, ${this.workZone.length} work zone`);
  }

  /**
   * Infer specific ITS equipment type from layer name and entity
   */
  inferITSType(layerName, entity) {
    const name = layerName.toLowerCase();

    if (name.includes('sign')) return 'Sign';
    if (name.includes('signal')) return 'Traffic Signal';
    if (name.includes('camera') || name.includes('cctv')) return 'Camera';
    if (name.includes('dms') || name.includes('vms')) return 'DMS';
    if (name.includes('detector') || name.includes('sensor')) return 'Detector';
    if (name.includes('rsu')) return 'RSU';
    if (name.includes('beacon')) return 'Beacon';
    if (name.includes('flasher')) return 'Flasher';
    if (name.includes('fiber') || name.includes('comm')) return 'Communications';
    if (name.includes('luminaire') || name.includes('light')) return 'Lighting';
    if (name.includes('controller') || name.includes('cabinet')) return 'Controller Cabinet';
    if (name.includes('antenna')) return 'Antenna';

    return 'ITS Infrastructure';
  }

  /**
   * Get statistics about parsed file
   */
  getStatistics() {
    const totalITSRelevant = this.itsEquipment.length + this.roadGeometry.length +
      this.electricalInfrastructure.length + this.pedestrianInfrastructure.length +
      this.trafficDevices.length;
    return {
      totalEntities: this.entities.length,
      totalLayers: this.layers.size,
      totalBlocks: this.blocks.size,
      itsEquipment: this.itsEquipment.length,
      roadGeometry: this.roadGeometry.length,
      electricalInfrastructure: (this.electricalInfrastructure || []).length,
      pedestrianInfrastructure: (this.pedestrianInfrastructure || []).length,
      trafficDevices: this.trafficDevices.length,
      utilities: (this.utilities || []).length,
      workZone: (this.workZone || []).length,
      totalITSRelevant,
      entityTypes: this.getEntityTypeBreakdown()
    };
  }

  /**
   * Get breakdown of entity types
   */
  getEntityTypeBreakdown() {
    const breakdown = {};
    for (const entity of this.entities) {
      breakdown[entity.type] = (breakdown[entity.type] || 0) + 1;
    }
    return breakdown;
  }

  /**
   * Log extraction progress
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    this.extractionLog.push({ timestamp, level, message });
    console.log(`[CADD Parser] ${level.toUpperCase()}: ${message}`);
  }
}

module.exports = CADDParser;
