-- Phase 1.2: Event-Level Confidence Scoring
-- Implements per-event reliability and verification tracking

-- Event confidence scoring table
CREATE TABLE IF NOT EXISTS event_confidence (
    event_id TEXT PRIMARY KEY,
    confidence_score REAL NOT NULL, -- 0-100
    confidence_level TEXT NOT NULL, -- 'VERIFIED', 'HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED'

    -- Verification sources
    primary_source TEXT,
    verification_sources TEXT, -- JSON array of source names
    cctv_verified BOOLEAN DEFAULT FALSE,
    sensor_verified BOOLEAN DEFAULT FALSE,
    crowdsource_verified BOOLEAN DEFAULT FALSE,
    multi_source_confirmed BOOLEAN DEFAULT FALSE,

    -- Quality flags
    geometry_valid BOOLEAN DEFAULT TRUE,
    description_quality TEXT, -- 'GOOD', 'FAIR', 'POOR'
    has_end_time BOOLEAN DEFAULT FALSE,
    has_severity BOOLEAN DEFAULT FALSE,
    has_location_method TEXT, -- 'GPS', 'ADDRESS', 'APPROXIMATE', 'UNKNOWN'

    -- ML predictions (for future false positive detection)
    false_positive_probability REAL, -- 0-1
    estimated_duration_minutes INTEGER,
    ml_model_version TEXT,

    -- Metadata
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (event_id) REFERENCES cached_events(id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_event_confidence_level ON event_confidence(confidence_level);
CREATE INDEX IF NOT EXISTS idx_event_confidence_score ON event_confidence(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_event_confidence_verified ON event_confidence(multi_source_confirmed, cctv_verified);

-- Historical confidence tracking (for ML model training)
CREATE TABLE IF NOT EXISTS event_confidence_history (
    id SERIAL PRIMARY KEY,
    event_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confidence_score REAL NOT NULL,
    confidence_level TEXT NOT NULL,
    verification_method TEXT, -- 'CCTV', 'SENSOR', 'OPERATOR', 'AUTOMATIC'
    verified_by TEXT, -- Username or system
    notes TEXT,

    FOREIGN KEY (event_id) REFERENCES cached_events(id)
);

CREATE INDEX IF NOT EXISTS idx_confidence_history_event ON event_confidence_history(event_id, timestamp DESC);

-- Vendor reliability tracking
CREATE TABLE IF NOT EXISTS vendor_reliability (
    id SERIAL PRIMARY KEY,
    vendor_name TEXT NOT NULL,
    data_type TEXT NOT NULL, -- 'INCIDENT', 'WORK_ZONE', 'ROAD_CONDITION', etc.
    measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Accuracy metrics
    total_events INTEGER DEFAULT 0,
    verified_correct INTEGER DEFAULT 0,
    verified_incorrect INTEGER DEFAULT 0,
    false_positives INTEGER DEFAULT 0,
    missed_events INTEGER DEFAULT 0,

    -- Calculated scores
    accuracy_rate REAL, -- verified_correct / (verified_correct + verified_incorrect)
    false_positive_rate REAL, -- false_positives / total_events
    reliability_score REAL, -- 0-100 composite score

    -- Timeliness metrics
    avg_reporting_delay_minutes REAL,
    avg_clearance_time_accuracy_minutes REAL,

    UNIQUE(vendor_name, data_type, measurement_date)
);

CREATE INDEX IF NOT EXISTS idx_vendor_reliability_vendor ON vendor_reliability(vendor_name, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_reliability_score ON vendor_reliability(reliability_score DESC);

-- View: Current confidence scores with event details
CREATE OR REPLACE VIEW event_confidence_summary AS
SELECT
    ce.id,
    ce.event_type,
    ce.description,
    ce.corridor_id,
    ce.start_date,
    ce.end_date,
    ce.severity,
    ec.confidence_score,
    ec.confidence_level,
    ec.multi_source_confirmed,
    ec.cctv_verified,
    ec.sensor_verified,
    ec.crowdsource_verified,
    ec.primary_source,
    ec.verification_sources,
    ec.false_positive_probability,
    ec.last_updated as confidence_last_updated
FROM cached_events ce
LEFT JOIN event_confidence ec ON ce.id = ec.event_id
WHERE ce.end_date IS NULL OR ce.end_date > NOW();

-- View: Vendor reliability summary
CREATE OR REPLACE VIEW vendor_reliability_summary AS
SELECT
    vendor_name,
    data_type,
    AVG(reliability_score) as avg_reliability_score,
    AVG(accuracy_rate) as avg_accuracy_rate,
    AVG(false_positive_rate) as avg_false_positive_rate,
    SUM(total_events) as total_events_reported,
    MAX(measurement_date) as latest_measurement
FROM vendor_reliability
WHERE measurement_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY vendor_name, data_type
ORDER BY avg_reliability_score DESC;

-- Function to calculate confidence score based on verification factors
CREATE OR REPLACE FUNCTION calculate_confidence_score(
    p_multi_source BOOLEAN,
    p_cctv_verified BOOLEAN,
    p_sensor_verified BOOLEAN,
    p_crowdsource_verified BOOLEAN,
    p_has_end_time BOOLEAN,
    p_has_severity BOOLEAN,
    p_geometry_valid BOOLEAN,
    p_description_quality TEXT
) RETURNS REAL AS $$
DECLARE
    score REAL := 50.0; -- Base score
BEGIN
    -- Multi-source confirmation adds 20 points
    IF p_multi_source THEN
        score := score + 20;
    END IF;

    -- CCTV verification adds 15 points (most reliable)
    IF p_cctv_verified THEN
        score := score + 15;
    END IF;

    -- Sensor verification adds 10 points
    IF p_sensor_verified THEN
        score := score + 10;
    END IF;

    -- Crowdsource verification adds 5 points
    IF p_crowdsource_verified THEN
        score := score + 5;
    END IF;

    -- Complete data adds points
    IF p_has_end_time THEN
        score := score + 5;
    END IF;

    IF p_has_severity THEN
        score := score + 5;
    END IF;

    IF p_geometry_valid THEN
        score := score + 5;
    END IF;

    -- Description quality
    IF p_description_quality = 'GOOD' THEN
        score := score + 5;
    ELSIF p_description_quality = 'FAIR' THEN
        score := score + 2;
    END IF;

    -- Cap at 100
    IF score > 100 THEN
        score := 100;
    END IF;

    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to determine confidence level from score
CREATE OR REPLACE FUNCTION get_confidence_level(p_score REAL) RETURNS TEXT AS $$
BEGIN
    IF p_score >= 90 THEN
        RETURN 'VERIFIED';
    ELSIF p_score >= 75 THEN
        RETURN 'HIGH';
    ELSIF p_score >= 50 THEN
        RETURN 'MEDIUM';
    ELSIF p_score >= 25 THEN
        RETURN 'LOW';
    ELSE
        RETURN 'UNVERIFIED';
    END IF;
END;
$$ LANGUAGE plpgsql;
