/**
 * Aerial Overlays service.
 *
 * Stores user-uploaded raster overlays (drone GeoTIFFs, PDF site plans) so
 * they can be drawn on the map at a known geographic bounds. Workflow:
 *
 *   TIF: server reads bounds from TIFF tags via `geotiff`, downsamples
 *        with `sharp` to ≤2048px JPEG q80, uploads to S3, stores DB row
 *        with bounds.
 *   PDF: client rasterizes page 1 via pdfjs-dist to a JPEG blob and posts
 *        it here as a generic image upload. Bounds are set later by the
 *        user dragging two corner handles on the map.
 *
 * Storage is S3-compatible (Cloudflare R2 recommended for free egress).
 * The whole feature is gated on env-var presence — without S3 configured
 * the upload endpoints respond 503 with a setup hint, so the dashboard
 * doesn't crash if no one has set credentials yet.
 *
 * DB row shape (table: aerial_overlays):
 *   id            serial PK
 *   name          text         user-provided or filename
 *   file_url      text         public URL on S3
 *   file_key      text         S3 object key (for delete)
 *   file_type     text         'tif' | 'pdf' | 'image'
 *   bounds        jsonb        { south, west, north, east } or null
 *   width_px      integer      output JPEG width
 *   height_px     integer      output JPEG height
 *   uploaded_by   text         username
 *   created_at    timestamptz  default now()
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { fromArrayBuffer } = require('geotiff');

const ENABLED =
  !!process.env.S3_BUCKET &&
  !!process.env.S3_ACCESS_KEY_ID &&
  !!process.env.S3_SECRET_ACCESS_KEY &&
  !!process.env.S3_ENDPOINT;

const S3_PUBLIC_URL_BASE =
  (process.env.S3_PUBLIC_URL_BASE || '').replace(/\/$/, '');

let s3 = null;
if (ENABLED) {
  s3 = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
  });
}

function isEnabled() { return ENABLED; }

function setupHint() {
  return {
    success: false,
    error: 'Aerial overlays storage is not configured.',
    hint: 'Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_PUBLIC_URL_BASE in the Railway environment.'
  };
}

/**
 * Initialize the aerial_overlays table. Idempotent — safe to call at startup.
 */
async function initSchema(db) {
  if (!db?.isPostgres) return;
  await db.db.query(`
    CREATE TABLE IF NOT EXISTS aerial_overlays (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      file_url    TEXT NOT NULL,
      file_key    TEXT NOT NULL,
      file_type   TEXT NOT NULL,
      bounds      JSONB,
      width_px    INTEGER,
      height_px   INTEGER,
      uploaded_by TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await db.db.query(`CREATE INDEX IF NOT EXISTS idx_aerial_overlays_created ON aerial_overlays(created_at DESC);`);
}

/**
 * Process a TIF buffer: extract geographic bounds via the TIFF tags, then
 * downsample to a JPEG. Returns { jpeg: Buffer, bounds, width, height }.
 *
 * If the TIFF has no geo tags (e.g. a plain TIFF, not a GeoTIFF), bounds
 * is null and the user gets to set them manually like a PDF upload.
 */
async function processTif(buffer) {
  let bounds = null;
  try {
    const tiff = await fromArrayBuffer(toArrayBuffer(buffer));
    const image = await tiff.getImage();
    const bbox = image.getBoundingBox();  // [minX, minY, maxX, maxY] in image SRS
    if (Array.isArray(bbox) && bbox.length === 4 && bbox.every(Number.isFinite)) {
      // GeoTIFFs are typically in EPSG:4326 (lat/lng) or web mercator.
      // We assume 4326 here. The bounds object uses geographic semantics.
      const [minX, minY, maxX, maxY] = bbox;
      bounds = { south: minY, west: minX, north: maxY, east: maxX };
    }
  } catch (err) {
    console.warn('GeoTIFF parse failed (treating as plain raster):', err.message);
  }

  // Downsample to a sane web-display size. q80 JPEG keeps detail visible
  // on the map while shrinking 50-200MB drone TIFs to typically <2MB.
  const jpegOutput = await sharp(buffer, { failOn: 'none' })
    .rotate()                                  // honor EXIF orientation
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    jpeg: jpegOutput.data,
    bounds,
    width: jpegOutput.info.width,
    height: jpegOutput.info.height
  };
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * Upload a JPEG buffer to S3 and return its public URL + key.
 * Public URL is built from S3_PUBLIC_URL_BASE + key so the frontend can
 * load images via the user's chosen CDN/domain (R2 public access, custom
 * domain on a bucket, etc.).
 */
async function uploadJpeg(buffer, idHint) {
  if (!ENABLED) throw new Error('Aerial overlay storage not configured');
  const key = `aerial-overlays/${idHint || Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=86400'
  }));
  const url = S3_PUBLIC_URL_BASE
    ? `${S3_PUBLIC_URL_BASE}/${key}`
    : `${process.env.S3_ENDPOINT.replace(/\/$/, '')}/${process.env.S3_BUCKET}/${key}`;
  return { key, url };
}

async function deleteObject(key) {
  if (!ENABLED || !key) return;
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key
    }));
  } catch (err) {
    console.warn('S3 delete failed (continuing anyway):', err.message);
  }
}

module.exports = {
  isEnabled,
  setupHint,
  initSchema,
  processTif,
  uploadJpeg,
  deleteObject
};
