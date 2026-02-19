# Railway Volume Setup for BIM File Storage

## Overview
Railway Pro plan includes 100 GB of persistent volume storage. This guide shows how to configure a volume for storing uploaded BIM/CAD files (IFC, DXF, DWG, DGN).

## Setup Steps

### 1. Add Volume in Railway Dashboard

1. Go to your Railway project dashboard
2. Select your backend service
3. Navigate to the **Volumes** tab
4. Click **+ New Volume**
5. Configure:
   - **Mount Path**: `/app/uploads`
   - **Size**: 100 GB (included with Pro plan)
6. Click **Add Volume**

### 2. Verify Volume Configuration

After adding the volume, Railway will automatically restart your service with the volume mounted at `/app/uploads`.

You can verify the mount in the deployment logs:
```bash
Volume mounted at /app/uploads
```

### 3. No Code Changes Required

The backend is already configured to save uploads to `/app/uploads/ifc/`:

**backend_proxy_server.js** (line 16695):
```javascript
const uploadIFC = multer({
  dest: path.join(__dirname, 'uploads/ifc'),  // Resolves to /app/uploads/ifc
  limits: { fileSize: 100 * 1024 * 1024 }
});
```

Since `__dirname` is `/app` in the Railway container, this automatically uses the volume path.

## Database Integration

BIM file metadata is stored in PostgreSQL in the `bim_models` table:

```sql
CREATE TABLE bim_models (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,              -- Generated filename (uuid)
  original_filename TEXT NOT NULL,     -- User's original filename
  file_path TEXT NOT NULL,             -- Relative path: uploads/ifc/filename
  file_type TEXT NOT NULL,             -- Extension: .ifc, .dxf, .dwg, .dgn
  file_size BIGINT,                    -- Size in bytes
  state_key TEXT,                      -- Which state DOT uploaded it
  uploaded_by TEXT,                    -- User identifier
  latitude DOUBLE PRECISION,           -- Location metadata
  longitude DOUBLE PRECISION,
  route TEXT,                          -- e.g., "I-80"
  milepost TEXT,                       -- e.g., "MM 125.3"
  elements_extracted INTEGER DEFAULT 0,
  gaps_identified INTEGER DEFAULT 0,
  v2x_applicable INTEGER DEFAULT 0,
  av_critical INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## File Persistence

- **Before volume**: Files saved to `/app/uploads/ifc/` were lost on container restart
- **After volume**: Files in `/app/uploads/` persist across deployments and restarts
- **Metadata**: PostgreSQL stores file paths and metadata permanently

## Testing

After volume setup, test persistence:

1. Upload a BIM file via the Digital Infrastructure page
2. Verify record created in `bim_models` table
3. Trigger a Railway deployment or restart
4. Verify file still accessible at the stored `file_path`

## Storage Limits

- **Volume size**: 100 GB (Railway Pro)
- **Per-file limit**: 100 MB (configured in multer)
- **Supported formats**: .ifc, .dxf, .dwg, .dgn

## Monitoring Usage

Check volume usage in Railway dashboard:
- Navigate to service → Volumes tab
- View storage consumption and remaining capacity
