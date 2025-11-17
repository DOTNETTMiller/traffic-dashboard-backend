-- TETC Data Marketplace Quality Grading
-- Eastern Transportation Coalition member states and major corridors

-- Insert TETC member state corridors
INSERT OR IGNORE INTO corridors (id, name, description) VALUES
-- I-95 Corridor (Major TETC corridor)
('I95_CORRIDOR', 'I-95 Eastern Corridor', 'I-95 through TETC member states (ME to FL)'),
('I95_ME', 'I-95 Maine', 'Interstate 95 through Maine'),
('I95_NH', 'I-95 New Hampshire', 'Interstate 95 through New Hampshire'),
('I95_MA', 'I-95 Massachusetts', 'Interstate 95 through Massachusetts'),
('I95_RI', 'I-95 Rhode Island', 'Interstate 95 through Rhode Island'),
('I95_CT', 'I-95 Connecticut', 'Interstate 95 through Connecticut'),
('I95_NY', 'I-95 New York', 'Interstate 95 through New York'),
('I95_NJ', 'I-95 New Jersey', 'Interstate 95 through New Jersey (NJ Turnpike)'),
('I95_PA', 'I-95 Pennsylvania', 'Interstate 95 through Pennsylvania'),
('I95_DE', 'I-95 Delaware', 'Interstate 95 through Delaware'),
('I95_MD', 'I-95 Maryland', 'Interstate 95 through Maryland'),
('I95_VA', 'I-95 Virginia', 'Interstate 95 through Virginia'),
('I95_NC', 'I-95 North Carolina', 'Interstate 95 through North Carolina'),

-- I-81 Corridor
('I81_CORRIDOR', 'I-81 Corridor', 'I-81 through TETC states'),
('I81_VA', 'I-81 Virginia', 'Interstate 81 through Virginia'),
('I81_MD', 'I-81 Maryland', 'Interstate 81 through Maryland'),
('I81_PA', 'I-81 Pennsylvania', 'Interstate 81 through Pennsylvania'),

-- Other major corridors
('I78_NJ_PA', 'I-78 NJ/PA Corridor', 'Interstate 78 through NJ and PA'),
('I76_PA', 'I-76 Pennsylvania Turnpike', 'Pennsylvania Turnpike'),
('I83_MD_PA', 'I-83 MD/PA', 'Interstate 83 Maryland and Pennsylvania'),
('I70_MD', 'I-70 Maryland', 'Interstate 70 through Maryland'),
('I64_VA', 'I-64 Virginia', 'Interstate 64 through Virginia'),
('I66_VA', 'I-66 Virginia', 'Interstate 66 through Virginia'),

-- Iowa corridors (existing TETC member)
('I80_IA', 'I-80 Iowa Segment', 'Interstate 80 corridor through Iowa'),
('I35_IA', 'I-35 Iowa Segment', 'Interstate 35 corridor through Iowa'),
('I29_IA', 'I-29 Iowa Segment', 'Interstate 29 corridor through Iowa');

-- TETC Data Marketplace feeds
INSERT OR IGNORE INTO data_feeds (id, corridor_id, service_type_id, provider_name, source_system, is_active) VALUES
-- I-95 Corridor TETC Data Marketplace feeds
('I95_CORR_probe_inrix', 'I95_CORRIDOR', 'probe_travel_time', 'INRIX', 'TETC Data Marketplace', 1),
('I95_CORR_probe_here', 'I95_CORRIDOR', 'probe_travel_time', 'HERE', 'TETC Data Marketplace', 1),
('I95_CORR_od_personal_replica', 'I95_CORRIDOR', 'od_personal', 'Replica', 'TETC Data Marketplace', 1),
('I95_CORR_od_personal_streetlight', 'I95_CORRIDOR', 'od_personal', 'StreetLight Data', 'TETC Data Marketplace', 1),
('I95_CORR_od_freight_atri', 'I95_CORRIDOR', 'od_freight', 'ATRI', 'TETC Data Marketplace', 1),
('I95_CORR_volume_inrix', 'I95_CORRIDOR', 'volume', 'INRIX', 'TETC Data Marketplace', 1),

-- Delaware feeds
('I95_DE_probe_inrix', 'I95_DE', 'probe_travel_time', 'INRIX', 'TETC Data Marketplace', 1),
('I95_DE_od_personal_replica', 'I95_DE', 'od_personal', 'Replica', 'TETC Data Marketplace', 1),
('I95_DE_wzdx_deldot', 'I95_DE', 'work_zone', 'DelDOT', 'Delaware 511 WZDx', 1),
('I95_DE_incident_deldot', 'I95_DE', 'incident', 'DelDOT', 'Delaware 511', 1),
('I95_DE_truck_parking_tpims', 'I95_DE', 'truck_parking', 'DelDOT', 'TPIMS', 1),

-- Maryland feeds
('I95_MD_probe_inrix', 'I95_MD', 'probe_travel_time', 'INRIX', 'TETC Data Marketplace', 1),
('I95_MD_od_freight_atri', 'I95_MD', 'od_freight', 'ATRI', 'TETC Data Marketplace', 1),
('I95_MD_wzdx_mdot', 'I95_MD', 'work_zone', 'MDOT', 'Maryland WZDx', 1),
('I95_MD_incident_chart', 'I95_MD', 'incident', 'MDOT', 'CHART System', 1),
('I95_MD_truck_parking_mdot', 'I95_MD', 'truck_parking', 'MDOT', 'TPIMS', 1),

-- Virginia feeds
('I95_VA_probe_inrix', 'I95_VA', 'probe_travel_time', 'INRIX', 'TETC Data Marketplace', 1),
('I95_VA_od_personal_replica', 'I95_VA', 'od_personal', 'Replica', 'TETC Data Marketplace', 1),
('I95_VA_od_freight_atri', 'I95_VA', 'od_freight', 'ATRI', 'TETC Data Marketplace', 1),
('I95_VA_wzdx_vdot', 'I95_VA', 'work_zone', 'VDOT', 'Virginia 511 WZDx', 1),
('I95_VA_incident_vdot', 'I95_VA', 'incident', 'VDOT', 'Virginia 511', 1),
('I95_VA_truck_parking_vdot', 'I95_VA', 'truck_parking', 'VDOT', 'TPIMS', 1),

-- Pennsylvania feeds
('I95_PA_probe_inrix', 'I95_PA', 'probe_travel_time', 'INRIX', 'TETC Data Marketplace', 1),
('I76_PA_probe_inrix', 'I76_PA', 'probe_travel_time', 'INRIX', 'TETC Data Marketplace', 1),
('I76_PA_od_freight_atri', 'I76_PA', 'od_freight', 'ATRI', 'TETC Data Marketplace', 1),
('I76_PA_truck_parking_penndot', 'I76_PA', 'truck_parking', 'PennDOT', 'TPIMS', 1),

-- New Jersey feeds
('I95_NJ_probe_inrix', 'I95_NJ', 'probe_travel_time', 'INRIX', 'TETC Data Marketplace', 1),
('I95_NJ_od_personal_streetlight', 'I95_NJ', 'od_personal', 'StreetLight Data', 'TETC Data Marketplace', 1),
('I95_NJ_incident_njdot', 'I95_NJ', 'incident', 'NJDOT', 'New Jersey 511', 1),

-- Iowa feeds (existing)
('I80_IA_probe_tt_inrix', 'I80_IA', 'probe_travel_time', 'INRIX', 'TETC Data Marketplace', 1),
('I80_IA_od_personal_replica', 'I80_IA', 'od_personal', 'Replica', 'TETC Data Marketplace', 1),
('I80_IA_od_freight_atri', 'I80_IA', 'od_freight', 'ATRI', 'TETC Data Marketplace', 1),
('I80_IA_volume_blend', 'I80_IA', 'volume', 'Iowa DOT', 'Internal Blended', 1),
('I80_IA_wzdx_ia511', 'I80_IA', 'work_zone', 'Iowa DOT', 'Iowa 511 WZDx', 1),
('I80_IA_incident_cad', 'I80_IA', 'incident', 'Iowa DOT', 'CAD System', 1),
('I80_IA_road_wx_rwis', 'I80_IA', 'road_weather', 'Iowa DOT', 'RWIS + MDODE', 1),
('I80_IA_truck_parking_tpims', 'I80_IA', 'truck_parking', 'Iowa DOT', 'TPIMS', 1),
('I80_IA_cv_pilot', 'I80_IA', 'cv_telemetry', 'Iowa DOT', 'CV Pilot', 1);

-- Validation runs (TETC 2025 Q1)
INSERT OR IGNORE INTO validation_runs (id, data_feed_id, run_name, period_start, period_end, methodology_ref) VALUES
-- I-95 Corridor validations
('vr_i95_corr_probe_inrix_2025q1', 'I95_CORR_probe_inrix', 'TETC I-95 INRIX Validation 2025Q1', '2025-01-01', '2025-03-31', 'https://tetcoalition.org/data-marketplace/validation/2025Q1_I95_INRIX.pdf'),
('vr_i95_corr_probe_here_2025q1', 'I95_CORR_probe_here', 'TETC I-95 HERE Validation 2025Q1', '2025-01-01', '2025-03-31', 'https://tetcoalition.org/data-marketplace/validation/2025Q1_I95_HERE.pdf'),
('vr_i95_corr_od_personal_replica_2025q1', 'I95_CORR_od_personal_replica', 'TETC I-95 Replica OD Validation 2025Q1', '2025-01-01', '2025-03-31', 'https://tetcoalition.org/data-marketplace/validation/2025Q1_I95_Replica.pdf'),
('vr_i95_corr_od_personal_streetlight_2025q1', 'I95_CORR_od_personal_streetlight', 'TETC I-95 StreetLight Validation 2025Q1', '2025-01-01', '2025-03-31', 'https://tetcoalition.org/data-marketplace/validation/2025Q1_I95_StreetLight.pdf'),
('vr_i95_corr_od_freight_atri_2025q1', 'I95_CORR_od_freight_atri', 'TETC I-95 ATRI Freight Validation 2025Q1', '2025-01-01', '2025-03-31', 'https://tetcoalition.org/data-marketplace/validation/2025Q1_I95_ATRI.pdf'),
('vr_i95_corr_volume_inrix_2025q1', 'I95_CORR_volume_inrix', 'TETC I-95 Volume Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),

-- Delaware validations
('vr_de_probe_2025q1', 'I95_DE_probe_inrix', 'DelDOT Probe Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_de_od_2025q1', 'I95_DE_od_personal_replica', 'DelDOT OD Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_de_wzdx_2025q1', 'I95_DE_wzdx_deldot', 'DelDOT WZDx Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_de_incident_2025q1', 'I95_DE_incident_deldot', 'DelDOT Incident Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_de_truck_parking_2025q1', 'I95_DE_truck_parking_tpims', 'DelDOT Truck Parking Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),

-- Maryland validations
('vr_md_probe_2025q1', 'I95_MD_probe_inrix', 'MDOT Probe Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_md_od_freight_2025q1', 'I95_MD_od_freight_atri', 'MDOT ATRI Freight Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_md_wzdx_2025q1', 'I95_MD_wzdx_mdot', 'MDOT WZDx Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_md_incident_2025q1', 'I95_MD_incident_chart', 'MDOT CHART Incident Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_md_truck_parking_2025q1', 'I95_MD_truck_parking_mdot', 'MDOT Truck Parking Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),

-- Virginia validations
('vr_va_probe_2025q1', 'I95_VA_probe_inrix', 'VDOT Probe Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_va_od_personal_2025q1', 'I95_VA_od_personal_replica', 'VDOT OD Personal Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_va_od_freight_2025q1', 'I95_VA_od_freight_atri', 'VDOT ATRI Freight Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_va_wzdx_2025q1', 'I95_VA_wzdx_vdot', 'VDOT WZDx Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_va_incident_2025q1', 'I95_VA_incident_vdot', 'VDOT Incident Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_va_truck_parking_2025q1', 'I95_VA_truck_parking_vdot', 'VDOT Truck Parking Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),

-- Pennsylvania validations
('vr_pa_i95_probe_2025q1', 'I95_PA_probe_inrix', 'PennDOT I-95 Probe Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_pa_i76_probe_2025q1', 'I76_PA_probe_inrix', 'PennDOT Turnpike Probe Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_pa_i76_freight_2025q1', 'I76_PA_od_freight_atri', 'PennDOT Turnpike Freight Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_pa_truck_parking_2025q1', 'I76_PA_truck_parking_penndot', 'PennDOT Truck Parking Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),

-- New Jersey validations
('vr_nj_probe_2025q1', 'I95_NJ_probe_inrix', 'NJDOT Probe Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_nj_od_2025q1', 'I95_NJ_od_personal_streetlight', 'NJDOT StreetLight Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_nj_incident_2025q1', 'I95_NJ_incident_njdot', 'NJDOT Incident Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),

-- Iowa validations (existing)
('vr_probe_tt_2025q1', 'I80_IA_probe_tt_inrix', 'TETC TT Speed Validation 2025Q1', '2025-01-01', '2025-03-31', 'https://tetcoalition.org/data-marketplace/validation/TETC_TT_2025Q1.pdf'),
('vr_od_personal_2025q1', 'I80_IA_od_personal_replica', 'OD Personal Validation 2025Q1', '2025-01-01', '2025-03-31', 'https://tetcoalition.org/data-marketplace/validation/OD_Personal_2025Q1.pdf'),
('vr_od_freight_2025q1', 'I80_IA_od_freight_atri', 'OD Freight Validation 2025Q1', '2025-01-01', '2025-03-31', 'https://tetcoalition.org/data-marketplace/validation/OD_Freight_2025Q1.pdf'),
('vr_volume_2025q1', 'I80_IA_volume_blend', 'Volume Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_wzdx_2025q1', 'I80_IA_wzdx_ia511', 'WZDx Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_incident_2025q1', 'I80_IA_incident_cad', 'Incident Feed Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_road_wx_2025q1', 'I80_IA_road_wx_rwis', 'Road Weather Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_truck_parking_2025q1', 'I80_IA_truck_parking_tpims', 'Truck Parking Validation 2025Q1', '2025-01-01', '2025-03-31', NULL),
('vr_cv_2025q1', 'I80_IA_cv_pilot', 'CV Telemetry Validation 2025Q1', '2025-01-01', '2025-03-31', NULL);

-- Quality scores (realistic TETC Data Marketplace performance)
-- I-95 Corridor TETC Data Marketplace feeds
-- INRIX Probe: DQI 91, A- (high quality commercial data)
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_i95_corr_probe_inrix_2025q1', 93, 90, 89, 94, 88, 91, 'A-');

-- HERE Probe: DQI 89, B+ (high quality commercial data)
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_i95_corr_probe_here_2025q1', 91, 88, 88, 92, 87, 89, 'B+');

-- Replica OD: DQI 85, B (good OD product)
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_i95_corr_od_personal_replica_2025q1', 83, 89, 82, 87, 86, 85, 'B');

-- StreetLight OD: DQI 83, B (good OD product)
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_i95_corr_od_personal_streetlight_2025q1', 81, 87, 81, 85, 84, 83, 'B');

-- ATRI Freight: DQI 87, B+ (strong freight data)
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_i95_corr_od_freight_atri_2025q1', 89, 86, 84, 87, 89, 87, 'B+');

-- INRIX Volume: DQI 78, C+ (derived volumes)
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_i95_corr_volume_inrix_2025q1', 74, 81, 77, 79, 83, 78, 'C+');

-- Delaware feeds
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_de_probe_2025q1', 92, 88, 87, 93, 86, 90, 'A-'),
('vr_de_od_2025q1', 82, 86, 80, 84, 85, 83, 'B'),
('vr_de_wzdx_2025q1', 85, 90, 88, 86, 92, 87, 'B+'),
('vr_de_incident_2025q1', 79, 84, 81, 82, 85, 81, 'B-'),
('vr_de_truck_parking_2025q1', 75, 78, 76, 77, 80, 76, 'C+');

-- Maryland feeds
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_md_probe_2025q1', 94, 91, 90, 95, 89, 92, 'A-'),
('vr_md_od_freight_2025q1', 88, 85, 83, 86, 88, 87, 'B+'),
('vr_md_wzdx_2025q1', 87, 92, 89, 88, 93, 89, 'B+'),
('vr_md_incident_2025q1', 83, 87, 85, 84, 88, 85, 'B'),
('vr_md_truck_parking_2025q1', 78, 81, 79, 80, 82, 79, 'C+');

-- Virginia feeds
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_va_probe_2025q1', 93, 89, 88, 94, 87, 91, 'A-'),
('vr_va_od_personal_2025q1', 84, 88, 83, 86, 86, 85, 'B'),
('vr_va_od_freight_2025q1', 87, 84, 82, 85, 87, 86, 'B'),
('vr_va_wzdx_2025q1', 82, 88, 84, 83, 89, 84, 'B'),
('vr_va_incident_2025q1', 80, 85, 82, 81, 86, 82, 'B-'),
('vr_va_truck_parking_2025q1', 74, 79, 75, 76, 81, 76, 'C+');

-- Pennsylvania feeds
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_pa_i95_probe_2025q1', 91, 87, 86, 92, 85, 89, 'B+'),
('vr_pa_i76_probe_2025q1', 92, 89, 88, 93, 87, 90, 'A-'),
('vr_pa_i76_freight_2025q1', 86, 83, 81, 84, 86, 85, 'B'),
('vr_pa_truck_parking_2025q1', 77, 80, 78, 79, 82, 78, 'C+');

-- New Jersey feeds
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_nj_probe_2025q1', 90, 86, 85, 91, 84, 88, 'B+'),
('vr_nj_od_2025q1', 82, 85, 80, 83, 84, 82, 'B-'),
('vr_nj_incident_2025q1', 78, 83, 80, 79, 84, 80, 'B-');

-- Iowa feeds (existing from original seed)
INSERT OR IGNORE INTO quality_scores (validation_run_id, acc_score, cov_score, tim_score, std_score, gov_score, dqi, letter_grade) VALUES
('vr_probe_tt_2025q1', 94, 90, 88, 96, 90, 92, 'A-'),
('vr_od_personal_2025q1', 82, 88, 80, 86, 85, 84, 'B'),
('vr_od_freight_2025q1', 90, 87, 85, 88, 90, 88, 'B+'),
('vr_volume_2025q1', 75, 82, 78, 80, 85, 79, 'C+'),
('vr_wzdx_2025q1', 78, 85, 80, 82, 88, 81, 'B-'),
('vr_incident_2025q1', 72, 80, 75, 78, 80, 76, 'C+'),
('vr_road_wx_2025q1', 92, 88, 90, 89, 91, 90, 'A-'),
('vr_truck_parking_2025q1', 68, 75, 72, 74, 78, 72, 'C'),
('vr_cv_2025q1', 65, 70, 68, 69, 72, 68, 'D');

-- Detailed metric values for sample I-95 Corridor INRIX feed
INSERT OR IGNORE INTO metric_values (validation_run_id, metric_key, raw_value, unit, score_0_100, notes) VALUES
('vr_i95_corr_probe_inrix_2025q1', 'aase_all_speeds', 3.2, 'mph', 96, 'Avg Absolute Speed Error - I-95 Corridor'),
('vr_i95_corr_probe_inrix_2025q1', 'seb_all_speeds', 1.0, 'mph', 94, 'Speed Error Bias - I-95 Corridor'),
('vr_i95_corr_probe_inrix_2025q1', 'pattern_error_pct', 6.8, '%', 93, 'Pattern fidelity error'),
('vr_i95_corr_probe_inrix_2025q1', 'spatial_coverage_pct', 96, '%', 94, 'Spatial coverage across corridor'),
('vr_i95_corr_probe_inrix_2025q1', 'temporal_coverage_pct', 99, '%', 96, 'Temporal coverage'),
('vr_i95_corr_probe_inrix_2025q1', 'median_latency_sec', 22, 's', 94, 'Median latency'),
('vr_i95_corr_probe_inrix_2025q1', 'p99_latency_sec', 75, 's', 88, '99th percentile latency'),
('vr_i95_corr_probe_inrix_2025q1', 'uptime_pct', 99.8, '%', 96, 'Service uptime');

-- Detailed metric values for Maryland CHART incident feed
INSERT OR IGNORE INTO metric_values (validation_run_id, metric_key, raw_value, unit, score_0_100, notes) VALUES
('vr_md_incident_2025q1', 'detection_rate', 88, '%', 85, 'Incident detection rate'),
('vr_md_incident_2025q1', 'false_positive_rate', 12, '%', 82, 'False positive rate'),
('vr_md_incident_2025q1', 'time_to_detection_avg', 4.2, 'min', 87, 'Average time to detect incident'),
('vr_md_incident_2025q1', 'spatial_accuracy_ft', 125, 'ft', 84, 'Location accuracy'),
('vr_md_incident_2025q1', 'coverage_i95_pct', 95, '%', 92, 'Coverage on I-95'),
('vr_md_incident_2025q1', 'update_frequency_sec', 45, 's', 85, 'Update frequency'),
('vr_md_incident_2025q1', 'clearance_time_accuracy', 78, '%', 80, 'Clearance time prediction accuracy');

-- Detailed metric values for Delaware WZDx feed
INSERT OR IGNORE INTO metric_values (validation_run_id, metric_key, raw_value, unit, score_0_100, notes) VALUES
('vr_de_wzdx_2025q1', 'wzdx_spec_conformance', 95, '%', 92, 'WZDx v4.2 spec conformance'),
('vr_de_wzdx_2025q1', 'work_zone_coverage', 98, '%', 95, 'Coverage of active work zones'),
('vr_de_wzdx_2025q1', 'location_accuracy_ft', 50, 'ft', 90, 'Location accuracy'),
('vr_de_wzdx_2025q1', 'start_time_accuracy_hrs', 2.1, 'hrs', 88, 'Start time accuracy'),
('vr_de_wzdx_2025q1', 'end_time_accuracy_hrs', 4.5, 'hrs', 84, 'End time accuracy'),
('vr_de_wzdx_2025q1', 'lane_closure_accuracy', 92, '%', 89, 'Lane closure info accuracy'),
('vr_de_wzdx_2025q1', 'update_frequency_min', 15, 'min', 90, 'Update frequency');
