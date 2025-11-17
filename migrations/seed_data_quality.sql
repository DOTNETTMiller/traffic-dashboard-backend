-- Sample seed data for Data Quality Grading System
-- Based on spec example for I-80 Iowa corridor

-- Insert sample corridors
INSERT OR IGNORE INTO corridors (id, name, description) VALUES
('I80_IA', 'I-80 Iowa Segment', 'Interstate 80 corridor through Iowa'),
('I35_IA', 'I-35 Iowa Segment', 'Interstate 35 corridor through Iowa'),
('I29_IA', 'I-29 Iowa Segment', 'Interstate 29 corridor through Iowa');

-- Insert service types (aligned with MDODE)
INSERT OR IGNORE INTO service_types (id, display_name, category, mdode_category, description) VALUES
('probe_travel_time', 'Probe Travel Time', 'performance', 'travel_time', '3rd-party probe speeds/travel times'),
('od_personal', 'O-D Personal', 'mobility', 'origin_destination', 'Personal travel origin-destination products'),
('od_freight', 'O-D Freight', 'mobility', 'origin_destination', 'Freight origin-destination products'),
('volume', 'Traffic Volume', 'performance', 'volume', 'Volumes derived from probe or blended data'),
('work_zone', 'Work Zones', 'disruption', 'work_zone', 'WZDx lane closure feeds'),
('incident', 'Incidents', 'disruption', 'incident', 'Incident / CAD / ATMS event feeds'),
('road_weather', 'Road Weather', 'disruption', 'road_weather', 'Road weather disruptions (RWIS/WxDE/MDODE)'),
('truck_parking', 'Truck Parking', 'freight', 'truck_parking', 'TPIMS truck parking occupancy/availability'),
('cv_telemetry', 'CV Telemetry', 'safety', 'connected_vehicle', 'Connected vehicle / AVL feeds'),
('special_event', 'Special Events', 'disruption', 'special_event', 'Event-based disruption feeds');

-- Insert data feeds for I-80 Iowa (example from spec)
INSERT OR IGNORE INTO data_feeds (id, corridor_id, service_type_id, provider_name, source_system, is_active) VALUES
('I80_IA_probe_tt_inrix', 'I80_IA', 'probe_travel_time', 'INRIX', 'TETC Data Marketplace', 1),
('I80_IA_od_personal_replica', 'I80_IA', 'od_personal', 'Replica', 'TETC Data Marketplace', 1),
('I80_IA_od_freight_atri', 'I80_IA', 'od_freight', 'ATRI', 'TETC Data Marketplace', 1),
('I80_IA_volume_blend', 'I80_IA', 'volume', 'Iowa DOT', 'Internal Blended', 1),
('I80_IA_wzdx_ia511', 'I80_IA', 'work_zone', 'Iowa DOT', 'Iowa 511 WZDx', 1),
('I80_IA_incident_cad', 'I80_IA', 'incident', 'Iowa DOT', 'CAD System', 1),
('I80_IA_road_wx_rwis', 'I80_IA', 'road_weather', 'Iowa DOT', 'RWIS + MDODE', 1),
('I80_IA_truck_parking_tpims', 'I80_IA', 'truck_parking', 'Iowa DOT', 'TPIMS', 1),
('I80_IA_cv_pilot', 'I80_IA', 'cv_telemetry', 'Iowa DOT', 'CV Pilot', 1);

-- Insert validation runs (TETC 2025 Q1 example)
INSERT OR IGNORE INTO validation_runs (id, data_feed_id, run_name, period_start, period_end, methodology_ref) VALUES
('vr_probe_tt_2025q1', 'I80_IA_probe_tt_inrix', 'TETC TT Speed Validation 2025Q1', '2025-01-01', '2025-03-31', 'https://example.org/reports/TETC_TT_2025Q1.pdf'),
('vr_od_personal_2025q1', 'I80_IA_od_personal_replica', 'OD Personal Validation 2025Q1', '2025-01-01', '2025-03-31', 'https://example.org/reports/OD_Personal_2025Q1.pdf'),
('vr_od_freight_2025q1', 'I80_IA_od_freight_atri', 'OD Freight Validation 2025Q1', '2025-01-01', '2025-03-31', 'https://example.org/reports/OD_Freight_2025Q1.pdf'),
('vr_volume_2025q1', 'I80_IA_volume_blend', 'Volume Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_wzdx_2025q1', 'I80_IA_wzdx_ia511', 'WZDx Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_incident_2025q1', 'I80_IA_incident_cad', 'Incident Feed Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_road_wx_2025q1', 'I80_IA_road_wx_rwis', 'Road Weather Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_truck_parking_2025q1', 'I80_IA_truck_parking_tpims', 'Truck Parking Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_cv_2025q1', 'I80_IA_cv_pilot', 'CV Telemetry Validation 2025Q1', '2025-01-01', '2025-03-31', NULL);

-- Insert quality scores (example data from spec)
-- probe_travel_time: DQI 92, A-
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_probe_tt_2025q1', 94, 90, 88, 96, 90, 92, 'A-');

-- od_personal: DQI 84, B
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_od_personal_2025q1', 82, 88, 80, 86, 85, 84, 'B');

-- od_freight: DQI 88, B+
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_od_freight_2025q1', 90, 87, 85, 88, 90, 88, 'B+');

-- volume: DQI 79, C+
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_volume_2025q1', 75, 82, 78, 80, 85, 79, 'C+');

-- work_zone: DQI 81, B-
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_wzdx_2025q1', 78, 85, 80, 82, 88, 81, 'B-');

-- incident: DQI 76, C+
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_incident_2025q1', 72, 80, 75, 78, 80, 76, 'C+');

-- road_weather: DQI 90, A-
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_road_wx_2025q1', 92, 88, 90, 89, 91, 90, 'A-');

-- truck_parking: DQI 72, C
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_truck_parking_2025q1', 68, 75, 72, 74, 78, 72, 'C');

-- cv_telemetry: DQI 68, D
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_cv_2025q1', 65, 70, 68, 69, 72, 68, 'D');

-- Insert sample metric values for probe travel time (for drill-down detail)
INSERT OR IGNORE INTO metric_values (validation_run_id, metric_key, raw_value, unit, score_0_100, notes) VALUES
('vr_probe_tt_2025q1', 'aase_all_speeds', 3.4, 'mph', 95, 'Avg Absolute Speed Error'),
('vr_probe_tt_2025q1', 'seb_all_speeds', 1.2, 'mph', 93, 'Speed Error Bias'),
('vr_probe_tt_2025q1', 'pattern_error_pct', 7.5, '%', 92, 'Pattern fidelity error'),
('vr_probe_tt_2025q1', 'spatial_coverage_pct', 94, '%', 92, 'Spatial coverage'),
('vr_probe_tt_2025q1', 'temporal_coverage_pct', 98, '%', 95, 'Temporal coverage'),
('vr_probe_tt_2025q1', 'median_latency_sec', 27, 's', 92, 'Median latency'),
('vr_probe_tt_2025q1', 'p99_latency_sec', 85, 's', 85, '99th percentile latency'),
('vr_probe_tt_2025q1', 'uptime_pct', 99.7, '%', 95, 'Service uptime');
