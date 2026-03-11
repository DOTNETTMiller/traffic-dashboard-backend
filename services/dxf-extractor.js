/**
 * DXF Extractor Service
 *
 * Parses AutoCAD DXF files and extracts:
 * - ITS equipment from blocks and text entities
 * - Road geometry from polylines, lines, and arcs
 * - Asset attributes from entity data
 */

const DxfParser = require('dxf-parser');
const fs = require('fs');

class DXFExtractor {
  constructor() {
    this.parser = new DxfParser();

    // Layer patterns for ITS equipment detection
    this.itsLayerPatterns = {
      camera: /camera|cctv|cam/i,
      dms: /dms|sign|message|vms/i,
      detector: /detector|sensor|loop|radar/i,
      rsu: /rsu|v2x|dsrc/i,
      signal: /signal|traffic.*light|tl/i,
      beacon: /beacon|flasher|warning/i
    };

    // Layer patterns for road geometry
    this.roadLayerPatterns = {
      centerline: /centerline|cl|center.*line/i,
      edge: /edge|pavement.*edge|pe/i,
      lane: /lane|stripe|marking/i,
      curb: /curb|gutter/i
    };

    // Text patterns for equipment type detection
    this.equipmentTextPatterns = {
      camera: /\b(camera|cctv|cam|ptz)\b/i,
      dms: /\b(dms|vms|sign|message)\b/i,
      detector: /\b(detector|sensor|loop|radar|video)\b/i,
      rsu: /\b(rsu|v2x|dsrc|cv)\b/i,
      signal: /\b(signal|light|tl)\b/i
    };
  }

  /**
   * Parse DXF file and extract data
   */
  async extractFromFile(filePath) {
    console.log(`📄 Parsing DXF file: ${filePath}`);

    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const dxf = this.parser.parseSync(fileContent);

      if (!dxf) {
        throw new Error('Failed to parse DXF file');
      }

      console.log(`   Version: ${dxf.header.$ACADVER || 'Unknown'}`);
      console.log(`   Units: ${this.getUnits(dxf)}`);

      // Extract extents
      const extents = this.extractExtents(dxf);
      console.log(`   Extents: (${extents.minX}, ${extents.minY}) to (${extents.maxX}, ${extents.maxY})`);

      // Extract layers
      const layers = Object.keys(dxf.tables.layer.layers || {});
      console.log(`   Layers: ${layers.length}`);

      // Extract entities
      const entities = dxf.entities || [];
      console.log(`   Total Entities: ${entities.length}`);

      // Extract blocks (commonly used for equipment symbols)
      const blocks = Object.keys(dxf.blocks || {});
      console.log(`   Blocks: ${blocks.length}`);

      // Process entities to extract ITS equipment and road geometry
      const itsEquipment = this.extractITSEquipment(dxf);
      console.log(`   ✅ Extracted ${itsEquipment.length} ITS equipment items`);

      const roadGeometry = this.extractRoadGeometry(dxf);
      console.log(`   ✅ Extracted ${roadGeometry.length} road geometry elements`);

      return {
        success: true,
        metadata: {
          version: dxf.header.$ACADVER,
          units: this.getUnits(dxf),
          extents,
          layers,
          blocks,
          totalEntities: entities.length
        },
        itsEquipment,
        roadGeometry
      };
    } catch (error) {
      console.error(`❌ Error parsing DXF file:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get units from DXF header
   */
  getUnits(dxf) {
    const insunits = dxf.header.$INSUNITS;
    const unitsMap = {
      0: 'Unitless',
      1: 'Inches',
      2: 'Feet',
      3: 'Miles',
      4: 'Millimeters',
      5: 'Centimeters',
      6: 'Meters',
      7: 'Kilometers',
      8: 'Microinches',
      9: 'Mils',
      10: 'Yards',
      11: 'Angstroms',
      12: 'Nanometers',
      13: 'Microns',
      14: 'Decimeters',
      15: 'Decameters',
      16: 'Hectometers',
      17: 'Gigameters',
      18: 'Astronomical Units',
      19: 'Light Years',
      20: 'Parsecs'
    };
    return unitsMap[insunits] || 'Unknown';
  }

  /**
   * Extract drawing extents
   */
  extractExtents(dxf) {
    // Try to get from header
    if (dxf.header.$EXTMIN && dxf.header.$EXTMAX) {
      return {
        minX: dxf.header.$EXTMIN.x,
        minY: dxf.header.$EXTMIN.y,
        maxX: dxf.header.$EXTMAX.x,
        maxY: dxf.header.$EXTMAX.y
      };
    }

    // Calculate from entities
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const entities = dxf.entities || [];
    for (const entity of entities) {
      if (entity.vertices) {
        for (const vertex of entity.vertices) {
          if (vertex.x < minX) minX = vertex.x;
          if (vertex.y < minY) minY = vertex.y;
          if (vertex.x > maxX) maxX = vertex.x;
          if (vertex.y > maxY) maxY = vertex.y;
        }
      } else if (entity.startPoint) {
        if (entity.startPoint.x < minX) minX = entity.startPoint.x;
        if (entity.startPoint.y < minY) minY = entity.startPoint.y;
        if (entity.startPoint.x > maxX) maxX = entity.startPoint.x;
        if (entity.startPoint.y > maxY) maxY = entity.startPoint.y;
      }
    }

    return {
      minX: isFinite(minX) ? minX : null,
      minY: isFinite(minY) ? minY : null,
      maxX: isFinite(maxX) ? maxX : null,
      maxY: isFinite(maxY) ? maxY : null
    };
  }

  /**
   * Extract ITS equipment from DXF entities
   */
  extractITSEquipment(dxf) {
    const equipment = [];
    const entities = dxf.entities || [];

    for (const entity of entities) {
      // Check for INSERT entities (block references)
      if (entity.type === 'INSERT') {
        const equipmentType = this.detectEquipmentTypeFromLayer(entity.layer);
        if (equipmentType) {
          equipment.push({
            type: equipmentType,
            layer: entity.layer,
            blockName: entity.name,
            geometry: {
              type: 'point',
              position: {
                x: entity.position.x,
                y: entity.position.y,
                z: entity.position.z || 0
              }
            },
            attributes: entity.attributes || {},
            text: entity.name
          });
        }
      }

      // Check for TEXT and MTEXT entities near equipment layers
      if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
        const equipmentType = this.detectEquipmentTypeFromText(entity.text);
        if (equipmentType) {
          equipment.push({
            type: equipmentType,
            layer: entity.layer,
            text: entity.text,
            geometry: {
              type: 'point',
              position: {
                x: entity.startPoint ? entity.startPoint.x : (entity.position ? entity.position.x : 0),
                y: entity.startPoint ? entity.startPoint.y : (entity.position ? entity.position.y : 0),
                z: entity.startPoint ? (entity.startPoint.z || 0) : (entity.position ? (entity.position.z || 0) : 0)
              }
            },
            attributes: entity.attributes || {}
          });
        }
      }

      // Check for POINT entities on ITS layers
      if (entity.type === 'POINT') {
        const equipmentType = this.detectEquipmentTypeFromLayer(entity.layer);
        if (equipmentType) {
          equipment.push({
            type: equipmentType,
            layer: entity.layer,
            geometry: {
              type: 'point',
              position: {
                x: entity.position.x,
                y: entity.position.y,
                z: entity.position.z || 0
              }
            },
            attributes: entity.attributes || {}
          });
        }
      }
    }

    return equipment;
  }

  /**
   * Extract road geometry from DXF entities
   */
  extractRoadGeometry(dxf) {
    const geometry = [];
    const entities = dxf.entities || [];

    for (const entity of entities) {
      // Check if layer matches road geometry patterns
      const geometryType = this.detectRoadGeometryType(entity.layer);
      if (!geometryType) continue;

      // Extract LWPOLYLINE (lightweight polyline)
      if (entity.type === 'LWPOLYLINE') {
        geometry.push({
          type: 'polyline',
          geometryType,
          layer: entity.layer,
          geometry: {
            vertices: entity.vertices.map(v => ({ x: v.x, y: v.y, z: 0 })),
            isClosed: entity.shape || false
          },
          attributes: entity.attributes || {}
        });
      }

      // Extract POLYLINE
      if (entity.type === 'POLYLINE') {
        geometry.push({
          type: 'polyline',
          geometryType,
          layer: entity.layer,
          geometry: {
            vertices: entity.vertices.map(v => ({ x: v.x, y: v.y, z: v.z || 0 })),
            isClosed: entity.shape || false
          },
          attributes: entity.attributes || {}
        });
      }

      // Extract LINE
      if (entity.type === 'LINE') {
        geometry.push({
          type: 'line',
          geometryType,
          layer: entity.layer,
          geometry: {
            vertices: [
              { x: entity.vertices[0].x, y: entity.vertices[0].y, z: entity.vertices[0].z || 0 },
              { x: entity.vertices[1].x, y: entity.vertices[1].y, z: entity.vertices[1].z || 0 }
            ],
            isClosed: false
          },
          attributes: entity.attributes || {}
        });
      }

      // Extract ARC
      if (entity.type === 'ARC') {
        // Convert arc to polyline approximation (10 segments)
        const segments = 10;
        const vertices = [];
        const angleRange = entity.endAngle - entity.startAngle;
        const angleStep = angleRange / segments;

        for (let i = 0; i <= segments; i++) {
          const angle = entity.startAngle + (angleStep * i);
          const x = entity.center.x + entity.radius * Math.cos(angle * Math.PI / 180);
          const y = entity.center.y + entity.radius * Math.sin(angle * Math.PI / 180);
          vertices.push({ x, y, z: entity.center.z || 0 });
        }

        geometry.push({
          type: 'arc',
          geometryType,
          layer: entity.layer,
          geometry: {
            vertices,
            isClosed: false
          },
          attributes: {
            ...entity.attributes,
            radius: entity.radius,
            startAngle: entity.startAngle,
            endAngle: entity.endAngle
          }
        });
      }
    }

    return geometry;
  }

  /**
   * Detect equipment type from layer name
   */
  detectEquipmentTypeFromLayer(layerName) {
    if (!layerName) return null;

    for (const [type, pattern] of Object.entries(this.itsLayerPatterns)) {
      if (pattern.test(layerName)) {
        return type;
      }
    }

    return null;
  }

  /**
   * Detect equipment type from text content
   */
  detectEquipmentTypeFromText(text) {
    if (!text) return null;

    for (const [type, pattern] of Object.entries(this.equipmentTextPatterns)) {
      if (pattern.test(text)) {
        return type;
      }
    }

    return null;
  }

  /**
   * Detect road geometry type from layer name
   */
  detectRoadGeometryType(layerName) {
    if (!layerName) return null;

    for (const [type, pattern] of Object.entries(this.roadLayerPatterns)) {
      if (pattern.test(layerName)) {
        return type;
      }
    }

    return null;
  }
}

module.exports = new DXFExtractor();
