-- Data Quality Grading System Schema (PostgreSQL)
-- Implements MDODE-aligned quality scoring framework

-- Core corridors table
CREATE TABLE IF NOT EXISTS corridors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    geometry_ref TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service types (probe speeds, work zones, incidents, etc.)
CREATE TABLE IF NOT EXISTS service_types (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    category TEXT,
    mdode_category TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data feeds per corridor/service
CREATE TABLE IF NOT EXISTS data_feeds (
    id TEXT PRIMARY KEY,
    corridor_id TEXT NOT NULL,
    service_type_id TEXT NOT NULL,
    provider_name TEXT,
    source_system TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (corridor_id) REFERENCES corridors(id),
    FOREIGN KEY (service_type_id) REFERENCES service_types(id)
);

-- Validation runs (TETC reports, internal validation, etc.)
CREATE TABLE IF NOT EXISTS validation_runs (
    id TEXT PRIMARY KEY,
    data_feed_id TEXT NOT NULL,
    run_name TEXT NOT NULL,
    period_start DATE,
    period_end DATE,
    methodology_ref TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (data_feed_id) REFERENCES data_feeds(id)
);

-- Individual metric values
CREATE TABLE IF NOT EXISTS metric_values (
    id SERIAL PRIMARY KEY,
    validation_run_id TEXT NOT NULL,
    metric_key TEXT NOT NULL,
    raw_value REAL,
    unit TEXT,
    score_0_100 REAL,
    notes TEXT,
    FOREIGN KEY (validation_run_id) REFERENCES validation_runs(id)
);

-- Computed quality scores (ACC, COV, TIM, STD, GOV, DQI)
CREATE TABLE IF NOT EXISTS quality_scores (
    id SERIAL PRIMARY KEY,
    validation_run_id TEXT NOT NULL,
    acc_score REAL,
    cov_score REAL,
    tim_score REAL,
    std_score REAL,
    gov_score REAL,
    dqi REAL NOT NULL,
    letter_grade TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (validation_run_id) REFERENCES validation_runs(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_feeds_corridor ON data_feeds(corridor_id);
CREATE INDEX IF NOT EXISTS idx_data_feeds_service ON data_feeds(service_type_id);
CREATE INDEX IF NOT EXISTS idx_validation_runs_feed ON validation_runs(data_feed_id);
CREATE INDEX IF NOT EXISTS idx_metric_values_run ON metric_values(validation_run_id);
CREATE INDEX IF NOT EXISTS idx_quality_scores_run ON quality_scores(validation_run_id);

-- View for latest quality score per corridor/service (for dashboard)
CREATE OR REPLACE VIEW corridor_service_quality_latest AS
SELECT
    c.id as corridor_id,
    c.name as corridor_name,
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
