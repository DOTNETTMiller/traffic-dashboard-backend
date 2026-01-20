-- Add geometry and bounds columns to corridors table for map visualization
-- This allows corridors to render as polylines on the map

-- Add geometry column (GeoJSON LineString)
ALTER TABLE corridors ADD COLUMN IF NOT EXISTS geometry JSONB;

-- Add bounds column (bounding box for map viewport)
ALTER TABLE corridors ADD COLUMN IF NOT EXISTS bounds JSONB;

-- Recreate the corridor_service_quality_latest view to include new columns
CREATE OR REPLACE VIEW corridor_service_quality_latest AS
SELECT
    c.id as corridor_id,
    c.name as corridor_name,
    c.geometry,
    c.bounds,
    st.id as service_type_id,
    st.display_name as service_display_name,
    st.category,
    df.id as data_feed_id,
    df.provider_name,
    qs.dqi,
    qs.letter_grade,
    qs.acc_score,
    qs.cov_score,
    qs.tim_score,
    qs.std_score,
    qs.gov_score,
    vr.period_start,
    vr.period_end,
    vr.methodology_ref,
    qs.created_at as last_updated
FROM corridors c
JOIN data_feeds df ON c.id = df.corridor_id
JOIN service_types st ON df.service_type_id = st.id
JOIN validation_runs vr ON df.id = vr.data_feed_id
JOIN quality_scores qs ON vr.id = qs.validation_run_id
WHERE df.is_active = true
  AND qs.id IN (
    SELECT MAX(qs2.id)
    FROM quality_scores qs2
    JOIN validation_runs vr2 ON qs2.validation_run_id = vr2.id
    WHERE vr2.data_feed_id = df.id
  );
