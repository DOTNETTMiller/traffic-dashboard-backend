-- Phase 2.1 & 2.2: Real-Time Asset Health & Predictive Maintenance
-- Monitor ITS equipment status, performance, and predict failures

-- Core asset health tracking
CREATE TABLE IF NOT EXISTS asset_health (
    asset_id TEXT PRIMARY KEY,
    asset_type TEXT NOT NULL, -- 'CCTV', 'RSU', 'DMS', 'RWIS', 'DETECTOR', 'BEACON'
    asset_name TEXT,
    location_lat REAL,
    location_lon REAL,
    state_key TEXT,
    corridor TEXT,

    -- Current status
    status TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'OPERATIONAL', 'DEGRADED', 'FAILED', 'MAINTENANCE', 'OFFLINE'
    last_online TIMESTAMP,
    last_successful_ping TIMESTAMP,
    last_data_received TIMESTAMP,

    -- Performance metrics (last 30 days)
    uptime_percentage_30d REAL,
    uptime_percentage_7d REAL,
    uptime_percentage_24h REAL,

    -- Type-specific performance
    message_success_rate REAL, -- for RSUs
    video_quality_score REAL, -- for cameras (0-100)
    display_error_count INTEGER, -- for DMS
    sensor_accuracy_score REAL, -- for RWIS (0-100)
    detection_accuracy_score REAL, -- for detectors (0-100)

    -- Maintenance tracking
    last_maintenance_date DATE,
    next_maintenance_due DATE,
    maintenance_vendor TEXT,
    maintenance_frequency_days INTEGER DEFAULT 365,

    -- Equipment details
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    firmware_version TEXT,
    install_date DATE,
    warranty_expiration DATE,
    age_years REAL,
    expected_lifespan_years REAL,
    estimated_remaining_life_years REAL,

    -- Cost tracking
    purchase_cost REAL,
    annual_maintenance_cost REAL,
    total_repair_costs REAL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_health_type ON asset_health(asset_type, status);
CREATE INDEX IF NOT EXISTS idx_asset_health_status ON asset_health(status);
CREATE INDEX IF NOT EXISTS idx_asset_health_state ON asset_health(state_key);
CREATE INDEX IF NOT EXISTS idx_asset_health_maintenance ON asset_health(next_maintenance_due);
CREATE INDEX IF NOT EXISTS idx_asset_health_warranty ON asset_health(warranty_expiration);

-- Historical asset health tracking
CREATE TABLE IF NOT EXISTS asset_health_history (
    id SERIAL PRIMARY KEY,
    asset_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    performance_metric REAL, -- Type-specific performance score
    uptime_percentage REAL,
    alert_triggered BOOLEAN DEFAULT FALSE,
    alert_type TEXT, -- 'OFFLINE', 'DEGRADED', 'FAILURE', 'MAINTENANCE_DUE'
    notes TEXT,

    FOREIGN KEY (asset_id) REFERENCES asset_health(asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_history_asset ON asset_health_history(asset_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_asset_history_alerts ON asset_health_history(alert_triggered, timestamp DESC);

-- Predictive maintenance scores
CREATE TABLE IF NOT EXISTS predictive_maintenance (
    id SERIAL PRIMARY KEY,
    asset_id TEXT NOT NULL,
    prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Failure predictions
    failure_probability_7d REAL, -- 0-1
    failure_probability_14d REAL,
    failure_probability_30d REAL,
    failure_risk_level TEXT, -- 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'

    -- Contributing factors
    age_factor_score REAL, -- 0-100 (higher = more risk)
    performance_trend_score REAL,
    maintenance_overdue_score REAL,
    environmental_factor_score REAL,
    historical_failure_pattern_score REAL,

    -- Recommendations
    recommended_action TEXT, -- 'MONITOR', 'SCHEDULE_MAINTENANCE', 'IMMEDIATE_INSPECTION', 'REPLACE'
    recommended_action_by_date DATE,
    estimated_repair_cost REAL,
    estimated_downtime_hours REAL,

    -- Cost-benefit analysis
    preventive_maintenance_cost REAL,
    emergency_repair_cost REAL,
    cost_of_downtime REAL,
    roi_preventive_maintenance REAL, -- emergency_cost / preventive_cost

    -- Model metadata
    ml_model_version TEXT,
    prediction_confidence REAL, -- 0-100

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (asset_id) REFERENCES asset_health(asset_id),
    UNIQUE(asset_id, prediction_date)
);

CREATE INDEX IF NOT EXISTS idx_predictive_maint_asset ON predictive_maintenance(asset_id, prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_predictive_maint_risk ON predictive_maintenance(failure_risk_level, prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_predictive_maint_action ON predictive_maintenance(recommended_action, recommended_action_by_date);

-- Maintenance events tracking
CREATE TABLE IF NOT EXISTS maintenance_events (
    id SERIAL PRIMARY KEY,
    asset_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'SCHEDULED', 'PREVENTIVE', 'CORRECTIVE', 'EMERGENCY'
    event_date DATE NOT NULL,
    completion_date DATE,

    -- Issue details
    issue_description TEXT,
    root_cause TEXT,
    actions_taken TEXT,

    -- Resources
    technician_name TEXT,
    vendor_name TEXT,
    parts_replaced TEXT, -- JSON array

    -- Costs
    labor_cost REAL,
    parts_cost REAL,
    total_cost REAL,
    downtime_hours REAL,

    -- Status
    status TEXT DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    was_predicted BOOLEAN DEFAULT FALSE, -- Was this caught by predictive model?

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (asset_id) REFERENCES asset_health(asset_id)
);

CREATE INDEX IF NOT EXISTS idx_maint_events_asset ON maintenance_events(asset_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_maint_events_type ON maintenance_events(event_type, status);
CREATE INDEX IF NOT EXISTS idx_maint_events_predicted ON maintenance_events(was_predicted, completion_date DESC);

-- Asset failure incidents
CREATE TABLE IF NOT EXISTS asset_failures (
    id SERIAL PRIMARY KEY,
    asset_id TEXT NOT NULL,
    failure_date TIMESTAMP NOT NULL,
    restored_date TIMESTAMP,
    downtime_hours REAL,

    -- Failure details
    failure_type TEXT, -- 'HARDWARE', 'SOFTWARE', 'NETWORK', 'POWER', 'ENVIRONMENTAL'
    failure_severity TEXT, -- 'MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'
    failure_description TEXT,
    root_cause TEXT,

    -- Impact
    events_missed INTEGER,
    travelers_affected_estimate INTEGER,
    economic_impact_estimate REAL,

    -- Detection
    detected_by TEXT, -- 'AUTOMATED_MONITORING', 'OPERATOR', 'USER_REPORT', 'PREDICTIVE_MODEL'
    was_predicted BOOLEAN DEFAULT FALSE,
    prediction_accuracy_days INTEGER, -- How many days in advance was it predicted?

    -- Response
    response_time_minutes INTEGER,
    repair_time_hours REAL,
    total_repair_cost REAL,

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (asset_id) REFERENCES asset_health(asset_id)
);

CREATE INDEX IF NOT EXISTS idx_failures_asset ON asset_failures(asset_id, failure_date DESC);
CREATE INDEX IF NOT EXISTS idx_failures_predicted ON asset_failures(was_predicted, failure_date DESC);
CREATE INDEX IF NOT EXISTS idx_failures_severity ON asset_failures(failure_severity, failure_date DESC);

-- Coverage gap analysis (enhanced from existing)
CREATE TABLE IF NOT EXISTS coverage_gaps (
    id SERIAL PRIMARY KEY,
    corridor TEXT NOT NULL,
    state_key TEXT NOT NULL,
    segment_start_mile REAL,
    segment_end_mile REAL,
    segment_length_miles REAL,

    -- Asset coverage
    has_cctv BOOLEAN DEFAULT FALSE,
    has_dms BOOLEAN DEFAULT FALSE,
    has_rsu BOOLEAN DEFAULT FALSE,
    has_rwis BOOLEAN DEFAULT FALSE,
    has_detector BOOLEAN DEFAULT FALSE,

    cctv_count INTEGER DEFAULT 0,
    dms_count INTEGER DEFAULT 0,
    rsu_count INTEGER DEFAULT 0,
    rwis_count INTEGER DEFAULT 0,
    detector_count INTEGER DEFAULT 0,

    -- Gap analysis
    coverage_score REAL, -- 0-100 based on asset density
    gap_severity TEXT, -- 'NONE', 'MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'

    -- Traffic characteristics
    aadt INTEGER, -- Average Annual Daily Traffic
    truck_percentage REAL,
    crash_rate REAL, -- crashes per million vehicle-miles

    -- Recommendations
    recommended_assets TEXT, -- JSON array
    estimated_installation_cost REAL,
    priority_score REAL, -- 0-100 for deployment prioritization
    roi_estimate REAL,

    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(corridor, segment_start_mile)
);

CREATE INDEX IF NOT EXISTS idx_coverage_gaps_corridor ON coverage_gaps(corridor);
CREATE INDEX IF NOT EXISTS idx_coverage_gaps_severity ON coverage_gaps(gap_severity);
CREATE INDEX IF NOT EXISTS idx_coverage_gaps_priority ON coverage_gaps(priority_score DESC);

-- View: Critical assets needing attention
CREATE OR REPLACE VIEW critical_assets_alert AS
SELECT
    ah.asset_id,
    ah.asset_type,
    ah.asset_name,
    ah.state_key,
    ah.corridor,
    ah.status,
    ah.uptime_percentage_30d,
    pm.failure_risk_level,
    pm.failure_probability_30d,
    pm.recommended_action,
    pm.recommended_action_by_date,
    pm.roi_preventive_maintenance,
    CASE
        WHEN ah.status = 'FAILED' THEN 'IMMEDIATE'
        WHEN pm.failure_risk_level = 'CRITICAL' THEN 'URGENT'
        WHEN pm.failure_risk_level = 'HIGH' THEN 'HIGH'
        WHEN ah.next_maintenance_due < CURRENT_DATE THEN 'OVERDUE'
        ELSE 'NORMAL'
    END as alert_priority
FROM asset_health ah
LEFT JOIN predictive_maintenance pm ON ah.asset_id = pm.asset_id
    AND pm.prediction_date = (
        SELECT MAX(prediction_date)
        FROM predictive_maintenance
        WHERE asset_id = ah.asset_id
    )
WHERE ah.status IN ('FAILED', 'DEGRADED', 'OFFLINE')
   OR pm.failure_risk_level IN ('HIGH', 'CRITICAL')
   OR ah.next_maintenance_due < CURRENT_DATE
ORDER BY
    CASE
        WHEN ah.status = 'FAILED' THEN 1
        WHEN pm.failure_risk_level = 'CRITICAL' THEN 2
        WHEN pm.failure_risk_level = 'HIGH' THEN 3
        WHEN ah.next_maintenance_due < CURRENT_DATE THEN 4
        ELSE 5
    END,
    pm.failure_probability_30d DESC NULLS LAST;

-- View: Maintenance cost savings from predictive maintenance
CREATE OR REPLACE VIEW predictive_maintenance_roi AS
SELECT
    me.asset_id,
    ah.asset_type,
    ah.state_key,
    COUNT(CASE WHEN me.was_predicted = TRUE THEN 1 END) as predicted_maintenance_count,
    COUNT(CASE WHEN me.was_predicted = FALSE AND me.event_type = 'EMERGENCY' THEN 1 END) as emergency_repair_count,
    AVG(CASE WHEN me.was_predicted = TRUE THEN me.total_cost END) as avg_preventive_cost,
    AVG(CASE WHEN me.was_predicted = FALSE AND me.event_type = 'EMERGENCY' THEN me.total_cost END) as avg_emergency_cost,
    SUM(CASE WHEN me.was_predicted = TRUE
             THEN (SELECT AVG(total_cost) FROM maintenance_events WHERE event_type = 'EMERGENCY' AND asset_id = me.asset_id) - me.total_cost
             ELSE 0 END) as estimated_cost_savings,
    AVG(me.downtime_hours) as avg_downtime_hours
FROM maintenance_events me
JOIN asset_health ah ON me.asset_id = ah.asset_id
WHERE me.completion_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY me.asset_id, ah.asset_type, ah.state_key;

-- View: Asset lifecycle and replacement planning
CREATE OR REPLACE VIEW asset_replacement_planning AS
SELECT
    ah.asset_id,
    ah.asset_type,
    ah.asset_name,
    ah.state_key,
    ah.corridor,
    ah.age_years,
    ah.expected_lifespan_years,
    ah.estimated_remaining_life_years,
    ah.purchase_cost,
    ah.total_repair_costs,
    (ah.total_repair_costs / NULLIF(ah.purchase_cost, 0)) as repair_to_purchase_ratio,
    CASE
        WHEN ah.estimated_remaining_life_years < 1 THEN 'REPLACE_NOW'
        WHEN ah.estimated_remaining_life_years < 2 THEN 'PLAN_REPLACEMENT'
        WHEN (ah.total_repair_costs / NULLIF(ah.purchase_cost, 0)) > 0.7 THEN 'CONSIDER_REPLACEMENT'
        ELSE 'MAINTAIN'
    END as replacement_recommendation,
    pm.failure_probability_30d,
    COUNT(af.id) as failure_count_12mo
FROM asset_health ah
LEFT JOIN predictive_maintenance pm ON ah.asset_id = pm.asset_id
    AND pm.prediction_date = CURRENT_DATE
LEFT JOIN asset_failures af ON ah.asset_id = af.asset_id
    AND af.failure_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY ah.asset_id, ah.asset_type, ah.asset_name, ah.state_key, ah.corridor,
         ah.age_years, ah.expected_lifespan_years, ah.estimated_remaining_life_years,
         ah.purchase_cost, ah.total_repair_costs, pm.failure_probability_30d
ORDER BY ah.estimated_remaining_life_years ASC NULLS LAST;
