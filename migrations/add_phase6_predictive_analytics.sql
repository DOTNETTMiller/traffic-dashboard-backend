-- Phase 6: AI-Powered Predictive Analytics Schema
-- Q2 2026 Implementation

-- ============================================
-- 6.1 Predictive Congestion Modeling
-- ============================================

-- Store congestion predictions for corridors
CREATE TABLE IF NOT EXISTS congestion_predictions (
    id SERIAL PRIMARY KEY,
    corridor_id TEXT NOT NULL,
    prediction_time TIMESTAMP NOT NULL,
    forecast_time TIMESTAMP NOT NULL, -- time being forecasted
    forecast_horizon_minutes INTEGER NOT NULL, -- 15, 30, 60, 120, 240 min

    -- Predicted metrics
    predicted_speed_mph REAL,
    predicted_volume_vph INTEGER, -- vehicles per hour
    predicted_density_vpm REAL, -- vehicles per mile
    congestion_level TEXT, -- 'FREE_FLOW', 'MODERATE', 'HEAVY', 'SEVERE'
    confidence_score REAL, -- 0-100

    -- Impact factors
    work_zone_impact BOOLEAN DEFAULT FALSE,
    incident_impact BOOLEAN DEFAULT FALSE,
    weather_impact BOOLEAN DEFAULT FALSE,
    special_event_impact BOOLEAN DEFAULT FALSE,

    -- Recommendations
    recommended_alternate_routes TEXT, -- JSON array of corridor IDs
    recommended_departure_window TEXT, -- e.g., "Depart 30 mins earlier"
    estimated_delay_minutes INTEGER,

    -- Model metadata
    model_version TEXT,
    model_confidence TEXT, -- 'HIGH', 'MEDIUM', 'LOW'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(corridor_id, prediction_time, forecast_time)
);

CREATE INDEX IF NOT EXISTS idx_congestion_pred_corridor ON congestion_predictions(corridor_id, forecast_time);
CREATE INDEX IF NOT EXISTS idx_congestion_pred_time ON congestion_predictions(prediction_time DESC);

-- ============================================
-- 6.2 Incident Impact Forecasting
-- ============================================

-- Store predictions for active incidents
CREATE TABLE IF NOT EXISTS incident_impact_predictions (
    id SERIAL PRIMARY KEY,
    event_id TEXT NOT NULL,
    prediction_time TIMESTAMP NOT NULL,

    -- Queue predictions
    predicted_queue_length_miles REAL,
    predicted_max_delay_minutes INTEGER,
    affected_volume_vehicles INTEGER,

    -- Clearance predictions
    predicted_clearance_time TIMESTAMP,
    predicted_duration_minutes INTEGER,
    clearance_confidence_score REAL, -- 0-100

    -- Economic impact
    estimated_economic_cost_usd REAL,
    estimated_fuel_wasted_gallons REAL,
    estimated_emissions_kg_co2 REAL,

    -- Evacuation modeling
    evacuation_timeline_minutes INTEGER,
    critical_decision_point TIMESTAMP,

    -- Diversion strategies
    recommended_diversion_routes TEXT, -- JSON array
    dms_message_recommendations TEXT, -- JSON array
    estimated_diversion_benefit_minutes INTEGER,

    -- Model metadata
    model_version TEXT,
    confidence_level TEXT, -- 'HIGH', 'MEDIUM', 'LOW'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (event_id) REFERENCES cached_events(id)
);

CREATE INDEX IF NOT EXISTS idx_incident_pred_event ON incident_impact_predictions(event_id, prediction_time DESC);
CREATE INDEX IF NOT EXISTS idx_incident_pred_time ON incident_impact_predictions(prediction_time DESC);

-- ============================================
-- 6.3 Work Zone Safety Risk Scoring
-- ============================================

-- Store safety risk scores for work zones
CREATE TABLE IF NOT EXISTS work_zone_safety_scores (
    id SERIAL PRIMARY KEY,
    event_id TEXT NOT NULL,
    assessment_time TIMESTAMP NOT NULL,

    -- Overall risk
    risk_score REAL NOT NULL, -- 0-100 (higher = more dangerous)
    risk_level TEXT NOT NULL, -- 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'

    -- Historical analysis
    historical_crash_rate REAL, -- crashes per million vehicle-miles
    similar_site_crash_rate REAL,
    crash_rate_percentile INTEGER, -- 0-100 (higher = more dangerous than peers)

    -- Site characteristics (risk factors)
    lane_closure_risk_score REAL,
    speed_differential_risk_score REAL,
    visibility_risk_score REAL,
    geometry_risk_score REAL,
    duration_risk_score REAL,

    -- Real-time conditions
    current_weather_risk TEXT, -- 'LOW', 'MODERATE', 'HIGH'
    time_of_day_risk TEXT, -- 'LOW', 'MODERATE', 'HIGH'
    traffic_volume_risk TEXT, -- 'LOW', 'MODERATE', 'HIGH'

    -- Safety countermeasures
    recommended_countermeasures TEXT, -- JSON array
    countermeasure_costs TEXT, -- JSON object with cost-benefit
    estimated_crash_reduction_pct REAL,
    estimated_roi_ratio REAL,

    -- Predictions
    predicted_crash_probability REAL, -- 0-1
    predicted_severity_level TEXT, -- 'PDO', 'INJURY', 'FATAL'

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (event_id) REFERENCES cached_events(id)
);

CREATE INDEX IF NOT EXISTS idx_safety_score_event ON work_zone_safety_scores(event_id, assessment_time DESC);
CREATE INDEX IF NOT EXISTS idx_safety_score_risk ON work_zone_safety_scores(risk_level, risk_score DESC);

-- ============================================
-- 6.4 Demand-Based Dynamic Routing
-- ============================================

-- Store optimal route calculations
CREATE TABLE IF NOT EXISTS dynamic_route_recommendations (
    id SERIAL PRIMARY KEY,
    origin_lat REAL NOT NULL,
    origin_lon REAL NOT NULL,
    destination_lat REAL NOT NULL,
    destination_lon REAL NOT NULL,
    calculation_time TIMESTAMP NOT NULL,

    -- Route options (up to 3 alternatives)
    route_1_corridors TEXT, -- JSON array of corridor IDs
    route_1_distance_miles REAL,
    route_1_estimated_time_minutes INTEGER,
    route_1_reliability_score REAL, -- 0-100
    route_1_recommended BOOLEAN DEFAULT FALSE,

    route_2_corridors TEXT,
    route_2_distance_miles REAL,
    route_2_estimated_time_minutes INTEGER,
    route_2_reliability_score REAL,
    route_2_recommended BOOLEAN DEFAULT FALSE,

    route_3_corridors TEXT,
    route_3_distance_miles REAL,
    route_3_estimated_time_minutes INTEGER,
    route_3_reliability_score REAL,
    route_3_recommended BOOLEAN DEFAULT FALSE,

    -- Load balancing
    corridor_load_balancing_active BOOLEAN DEFAULT FALSE,
    target_corridor_distribution TEXT, -- JSON object {corridor_id: target_pct}
    current_corridor_distribution TEXT, -- JSON object {corridor_id: current_pct}

    -- DMS messaging
    dms_locations TEXT, -- JSON array of DMS IDs to update
    recommended_dms_messages TEXT, -- JSON array

    -- Fleet routing
    vehicle_type TEXT, -- 'PASSENGER', 'COMMERCIAL', 'OVERSIZE', 'HAZMAT'
    vehicle_restrictions_applied TEXT, -- JSON array

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_route_rec_origin ON dynamic_route_recommendations(origin_lat, origin_lon, calculation_time DESC);
CREATE INDEX IF NOT EXISTS idx_route_rec_time ON dynamic_route_recommendations(calculation_time DESC);

-- ============================================
-- ML Model Training Data
-- ============================================

-- Store actual outcomes for model training
CREATE TABLE IF NOT EXISTS prediction_actuals (
    id SERIAL PRIMARY KEY,
    prediction_id INTEGER NOT NULL,
    prediction_type TEXT NOT NULL, -- 'CONGESTION', 'INCIDENT', 'SAFETY', 'ROUTING'
    prediction_time TIMESTAMP NOT NULL,

    -- Actual outcomes
    actual_value REAL,
    predicted_value REAL,
    error_value REAL,
    error_percentage REAL,

    -- Accuracy tracking
    within_10pct BOOLEAN,
    within_25pct BOOLEAN,
    within_50pct BOOLEAN,

    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pred_actuals_type ON prediction_actuals(prediction_type, prediction_time DESC);

-- ============================================
-- ML Model Performance Metrics
-- ============================================

CREATE TABLE IF NOT EXISTS model_performance (
    id SERIAL PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    evaluation_date DATE NOT NULL,

    -- Accuracy metrics
    mean_absolute_error REAL,
    mean_absolute_percentage_error REAL,
    root_mean_squared_error REAL,
    r_squared REAL,

    -- Reliability metrics
    predictions_within_10pct INTEGER,
    predictions_within_25pct INTEGER,
    predictions_within_50pct INTEGER,
    total_predictions INTEGER,
    accuracy_10pct_rate REAL,
    accuracy_25pct_rate REAL,

    -- Confidence calibration
    overconfident_predictions INTEGER,
    underconfident_predictions INTEGER,
    well_calibrated_predictions INTEGER,

    -- Model info
    training_dataset_size INTEGER,
    last_retrain_date TIMESTAMP,
    next_retrain_scheduled TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(model_name, model_version, evaluation_date)
);

CREATE INDEX IF NOT EXISTS idx_model_perf_name ON model_performance(model_name, evaluation_date DESC);

-- ============================================
-- Views for Analytics
-- ============================================

-- View: Current congestion predictions (next 4 hours)
CREATE OR REPLACE VIEW current_congestion_forecasts AS
SELECT
    cp.*,
    EXTRACT(EPOCH FROM (forecast_time - prediction_time))/60 as minutes_ahead
FROM congestion_predictions cp
WHERE cp.prediction_time >= NOW() - INTERVAL '1 hour'
  AND cp.forecast_time <= NOW() + INTERVAL '4 hours'
ORDER BY cp.corridor_id, cp.forecast_time;

-- View: Active incident predictions
CREATE OR REPLACE VIEW active_incident_predictions AS
SELECT
    iip.*,
    ce.event_type,
    ce.corridor_id,
    ce.start_date
FROM incident_impact_predictions iip
JOIN cached_events ce ON iip.event_id = ce.id
WHERE iip.prediction_time >= NOW() - INTERVAL '2 hours'
  AND ce.end_date IS NULL OR ce.end_date > NOW()
ORDER BY iip.predicted_economic_cost_usd DESC;

-- View: High-risk work zones
CREATE OR REPLACE VIEW high_risk_work_zones AS
SELECT
    wzss.*,
    ce.corridor_id,
    ce.description,
    ce.start_date
FROM work_zone_safety_scores wzss
JOIN cached_events ce ON wzss.event_id = ce.id
WHERE wzss.assessment_time >= NOW() - INTERVAL '24 hours'
  AND wzss.risk_level IN ('HIGH', 'CRITICAL')
  AND (ce.end_date IS NULL OR ce.end_date > NOW())
ORDER BY wzss.risk_score DESC;

-- View: Model accuracy summary
CREATE OR REPLACE VIEW model_accuracy_summary AS
SELECT
    model_name,
    model_version,
    AVG(accuracy_10pct_rate) as avg_accuracy_10pct,
    AVG(accuracy_25pct_rate) as avg_accuracy_25pct,
    AVG(mean_absolute_percentage_error) as avg_mape,
    MAX(evaluation_date) as latest_evaluation,
    SUM(total_predictions) as total_predictions
FROM model_performance
GROUP BY model_name, model_version
ORDER BY model_name, model_version DESC;
