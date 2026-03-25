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
const proj4 = require('proj4');

// Define common DOT coordinate systems
// Iowa State Plane South NAD83 (US Survey Feet)
proj4.defs('IOWA_SP_SOUTH', '+proj=lcc +lat_0=40 +lon_0=-93.5 +lat_1=40.6166666667 +lat_2=41.7833333333 +x_0=500000.00001016 +y_0=0 +datum=NAD83 +units=us-ft +no_defs');
// Iowa State Plane North NAD83 (US Survey Feet)
proj4.defs('IOWA_SP_NORTH', '+proj=lcc +lat_0=41.5 +lon_0=-93.5 +lat_1=42.0666666667 +lat_2=43.2666666667 +x_0=1500000 +y_0=1000000 +datum=NAD83 +units=us-ft +no_defs');

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

    // Georeference entities (CAD coords → WGS84)
    this.georeferenceEntities(dxf);

    // Generate GeoJSON for GIS export
    const geojson = this.toGeoJSON();

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
      geojson,
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
   * Detect the coordinate system and unit scale from the DXF data.
   * Iowa DOT CADD files commonly use inches in State Plane coordinates.
   */
  detectCoordinateSystem(dxf) {
    const extMin = dxf.header?.['$EXTMIN'] || { x: 0, y: 0 };
    const extMax = dxf.header?.['$EXTMAX'] || { x: 0, y: 0 };
    const textStyle = dxf.header?.['$TEXTSTYLE'] || '';

    // Detect Iowa DOT files by text style or coordinate ranges
    const isIowaDOT = /IowaDOT/i.test(textStyle);

    // Iowa DOT CADD uses inches in State Plane.
    // Typical Iowa South x range in feet: ~400k-1.7M, y: 0-700k
    // In inches those become: ~4.8M-20M x, 0-8.4M y
    const avgX = (extMin.x + extMax.x) / 2;
    const avgY = (extMin.y + extMax.y) / 2;

    // Check if coordinates are in Iowa State Plane range (in inches)
    if (isIowaDOT || (avgX > 4000000 && avgX < 25000000 && avgY > 0 && avgY < 10000000)) {
      // Test: convert from inches to feet, then Iowa South to WGS84
      const testFtX = avgX / 12;
      const testFtY = avgY / 12;
      try {
        const [lon, lat] = proj4('IOWA_SP_SOUTH', 'EPSG:4326', [testFtX, testFtY]);
        if (lat >= 40.0 && lat <= 42.0 && lon >= -97 && lon <= -90) {
          this.log(`Detected Iowa State Plane South (NAD83), units: inches`);
          return { crs: 'IOWA_SP_SOUTH', unitScale: 1 / 12, unitName: 'inches' };
        }
      } catch (e) { /* not Iowa South */ }

      // Try Iowa North
      try {
        const [lon, lat] = proj4('IOWA_SP_NORTH', 'EPSG:4326', [testFtX, testFtY]);
        if (lat >= 41.5 && lat <= 43.5 && lon >= -97 && lon <= -90) {
          this.log(`Detected Iowa State Plane North (NAD83), units: inches`);
          return { crs: 'IOWA_SP_NORTH', unitScale: 1 / 12, unitName: 'inches' };
        }
      } catch (e) { /* not Iowa North */ }
    }

    // Check if already in feet (standard State Plane range)
    if (avgX > 300000 && avgX < 3000000 && avgY > 0 && avgY < 1500000) {
      try {
        const [lon, lat] = proj4('IOWA_SP_SOUTH', 'EPSG:4326', [avgX, avgY]);
        if (lat >= 40.0 && lat <= 42.0 && lon >= -97 && lon <= -90) {
          this.log(`Detected Iowa State Plane South (NAD83), units: US feet`);
          return { crs: 'IOWA_SP_SOUTH', unitScale: 1, unitName: 'US feet' };
        }
      } catch (e) { /* not Iowa South */ }
    }

    this.log('Could not auto-detect coordinate system, coordinates stored as-is');
    return { crs: null, unitScale: 1, unitName: 'unknown' };
  }

  /**
   * Georeference all entities: transform CAD coordinates to WGS84 lat/lng.
   * Adds latitude, longitude properties to each entity.
   */
  georeferenceEntities(dxf) {
    const coordSystem = this.detectCoordinateSystem(dxf);
    this.metadata.coordinateSystem = coordSystem;

    if (!coordSystem.crs) {
      this.log('Skipping georeferencing: coordinate system not detected');
      return;
    }

    const scale = coordSystem.unitScale;
    let georefCount = 0;
    let outlierCount = 0;

    // Get project extents for outlier filtering
    const extMin = dxf.header?.['$EXTMIN'] || { x: -Infinity, y: -Infinity };
    const extMax = dxf.header?.['$EXTMAX'] || { x: Infinity, y: Infinity };
    // Expand extents by 50% for tolerance
    const rangeX = (extMax.x - extMin.x) * 0.5;
    const rangeY = (extMax.y - extMin.y) * 0.5;
    const boundsMinX = extMin.x - rangeX;
    const boundsMaxX = extMax.x + rangeX;
    const boundsMinY = extMin.y - rangeY;
    const boundsMaxY = extMax.y + rangeY;

    function isInBounds(x, y) {
      return x >= boundsMinX && x <= boundsMaxX && y >= boundsMinY && y <= boundsMaxY;
    }

    const transform = (x, y) => {
      if (!isInBounds(x, y)) return null;
      try {
        const [lon, lat] = proj4(coordSystem.crs, 'EPSG:4326', [x * scale, y * scale]);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          return { latitude: lat, longitude: lon };
        }
      } catch (e) { /* transform failed */ }
      return null;
    };

    for (const entity of this.entities) {
      const g = entity.geometry;
      if (!g) continue;

      // Get representative point for the entity
      let refX, refY;
      if (g.position) { refX = g.position.x; refY = g.position.y; }
      else if (g.start) { refX = g.start.x; refY = g.start.y; }
      else if (g.center) { refX = g.center.x; refY = g.center.y; }
      else if (g.vertices && g.vertices.length > 0) { refX = g.vertices[0].x; refY = g.vertices[0].y; }

      if (refX != null && refY != null) {
        const result = transform(refX, refY);
        if (result) {
          entity.latitude = result.latitude;
          entity.longitude = result.longitude;
          entity.georeferenced = true;

          // Also transform all vertices for line/polyline GIS export
          if (g.vertices && g.vertices.length > 0) {
            entity.wgs84Vertices = [];
            for (const v of g.vertices) {
              const vResult = transform(v.x, v.y);
              if (vResult) {
                entity.wgs84Vertices.push(vResult);
              }
            }
          }
          // Transform line start/end
          if (g.start && g.end) {
            const startResult = transform(g.start.x, g.start.y);
            const endResult = transform(g.end.x, g.end.y);
            if (startResult && endResult) {
              entity.wgs84Vertices = [startResult, endResult];
            }
          }

          georefCount++;
        } else {
          entity.georeferenced = false;
          outlierCount++;
        }
      }
    }

    this.log(`Georeferenced ${georefCount} entities (${outlierCount} outliers filtered)`);

    // Calculate WGS84 bounding box
    const georefEntities = this.entities.filter(e => e.georeferenced);
    if (georefEntities.length > 0) {
      this.metadata.wgs84Bounds = {
        south: Math.min(...georefEntities.map(e => e.latitude)),
        north: Math.max(...georefEntities.map(e => e.latitude)),
        west: Math.min(...georefEntities.map(e => e.longitude)),
        east: Math.max(...georefEntities.map(e => e.longitude))
      };
      this.log(`WGS84 bounds: ${this.metadata.wgs84Bounds.south.toFixed(6)},${this.metadata.wgs84Bounds.west.toFixed(6)} to ${this.metadata.wgs84Bounds.north.toFixed(6)},${this.metadata.wgs84Bounds.east.toFixed(6)}`);
    }
  }

  /**
   * Export georeferenced entities to GeoJSON FeatureCollection.
   * Ready for ArcGIS, QGIS, or web mapping.
   */
  toGeoJSON(options = {}) {
    const features = [];

    // Build category lookup from entity handles (since classified arrays are copies)
    const entityCategories = new Map();
    const addCategory = (arr, cat, rel) => {
      for (const e of arr) {
        const key = e.handle || `${e.layer}-${e.type}-${JSON.stringify(e.geometry?.position || e.geometry?.start || '')}`;
        if (!entityCategories.has(key)) entityCategories.set(key, []);
        entityCategories.get(key).push({ category: cat, itsRelevance: rel, equipmentType: e.type });
      }
    };
    addCategory(this.itsEquipment, 'ITS Equipment', 'Direct - ITS device or communication');
    addCategory(this.roadGeometry, 'Road Geometry', 'Lane geometry for CV/AV navigation, V2X road model');
    addCategory(this.electricalInfrastructure, 'Electrical Infrastructure', 'Power source availability for ITS device placement');
    addCategory(this.pedestrianInfrastructure, 'Pedestrian Infrastructure', 'Pedestrian detection zones, ADA compliance, V2P safety');
    addCategory(this.trafficDevices, 'Traffic Control Device', 'Traffic control coordination with ITS');
    addCategory(this.utilities, 'Utility', 'Conflict avoidance for ITS device installation');
    addCategory(this.workZone, 'Work Zone', 'Active work zone - WZDx feed, dynamic messaging');

    for (const entity of this.entities) {
      if (!entity.georeferenced) continue;

      // Get category info
      const key = entity.handle || `${entity.layer}-${entity.type}-${JSON.stringify(entity.geometry?.position || entity.geometry?.start || '')}`;
      const cats = entityCategories.get(key);
      const primaryCat = cats ? cats[0] : { category: 'Uncategorized', itsRelevance: null };

      let geometry;

      // LineString for entities with multiple vertices
      if (entity.wgs84Vertices && entity.wgs84Vertices.length >= 2) {
        geometry = {
          type: 'LineString',
          coordinates: entity.wgs84Vertices.map(v => [v.longitude, v.latitude])
        };
      } else {
        geometry = {
          type: 'Point',
          coordinates: [entity.longitude, entity.latitude]
        };
      }

      features.push({
        type: 'Feature',
        geometry,
        properties: {
          entityType: entity.type,
          layer: entity.layer,
          category: primaryCat.category,
          itsRelevance: primaryCat.itsRelevance,
          blockName: entity.blockName || null,
          text: entity.text || null,
          handle: entity.handle || null
        }
      });
    }

    return {
      type: 'FeatureCollection',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
      features,
      metadata: {
        exportDate: new Date().toISOString(),
        sourceFile: this.metadata.version,
        coordinateSystem: this.metadata.coordinateSystem,
        featureCount: features.length,
        bounds: this.metadata.wgs84Bounds,
        categories: [...new Set(features.map(f => f.properties.category))]
      }
    };
  }

  /**
   * Get statistics about parsed file
   */
  getStatistics() {
    const totalITSRelevant = this.itsEquipment.length + this.roadGeometry.length +
      this.electricalInfrastructure.length + this.pedestrianInfrastructure.length +
      this.trafficDevices.length;
    const georeferenced = this.entities.filter(e => e.georeferenced).length;
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
      georeferenced,
      coordinateSystem: this.metadata.coordinateSystem || null,
      wgs84Bounds: this.metadata.wgs84Bounds || null,
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
