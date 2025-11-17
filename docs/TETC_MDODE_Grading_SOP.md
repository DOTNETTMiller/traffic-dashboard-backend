# Standard Operating Procedure: TETC Data Marketplace Quality Grading

**Version:** 1.0
**Date:** November 2025
**Purpose:** Establish standardized methodology for grading Eastern Transportation Coalition (TETC) Data Marketplace feeds using MDODE-aligned quality framework

---

## 1. Executive Summary

This SOP defines the process for evaluating and grading traffic data feeds from TETC Data Marketplace vendors using a 5-component quality framework aligned with the Mobility Data Operations Data Exchange (MDODE) standards. The framework produces a Data Quality Index (DQI) score (0-100) and corresponding letter grade (A+ through F).

### 1.1 Scope
- **Applicable to**: All TETC Data Marketplace feed categories
  - Probe Travel Time & Speed
  - Origin-Destination (Personal and Freight)
  - Traffic Volume
  - Work Zones (WZDx)
  - Incidents
  - Road Weather
  - Truck Parking (TPIMS)
  - Connected Vehicle Telemetry

### 1.2 Quality Framework Components

| Component | Weight | Focus Area |
|-----------|--------|------------|
| **ACC** (Accuracy) | 40% | Measurement precision and correctness |
| **COV** (Coverage) | 25% | Spatial and temporal completeness |
| **TIM** (Timeliness) | 20% | Latency and update frequency |
| **STD** (Standards) | 10% | Specification conformance |
| **GOV** (Governance) | 5% | Documentation and reliability |

---

## 2. Validation Methodology

### 2.1 Ground Truth Data Collection

#### 2.1.1 Reference Data Requirements
For each validation study, collect ground truth data using:

**Primary Methods:**
- Wireless Re-Identification Traffic Monitoring (WRTM) sensors
- Bluetooth/WiFi MAC address matching
- License plate re-identification (anonymous)
- Inductive loop detectors (calibrated within 6 months)
- Automated Traffic Recorders (ATRs)

**Secondary Methods:**
- Manual field observations (for incidents/work zones)
- Official construction records (for WZDx validation)
- DOT CAD/ATMS systems (for incident validation)
- RWIS stations (for weather validation)

#### 2.1.2 Sample Requirements

**Minimum Sample Sizes:**
- **Probe Speed/Travel Time**: 500+ vehicle measurements per speed bin
- **Origin-Destination**: 1,000+ trips per origin zone
- **Volume**: 30 days continuous data, hourly aggregation
- **Work Zones**: 20+ active work zones, full lifecycle
- **Incidents**: 50+ incidents across severity levels
- **Truck Parking**: 30 days, 15-minute intervals, 10+ facilities

**Speed Bins for Probe Validation:**
1. 0-30 MPH (congested conditions) - 25% weight
2. 30-45 MPH (moderate flow) - 25% weight
3. 45-60 MPH (free flow) - 25% weight
4. 60+ MPH (highway speeds) - 25% weight

### 2.2 Validation Period

**Standard Validation Cycle:**
- **Duration**: 30-90 days per validation study
- **Frequency**: Quarterly updates, annual comprehensive review
- **Reporting Period**: Results published within 60 days of data collection

---

## 3. Component Scoring Methodology

### 3.1 ACCURACY (ACC) - 40% Weight

#### 3.1.1 Probe Travel Time & Speed

**Primary Metrics:**

**Average Absolute Speed Error (AASE):**
```
AASE = Σ|Speed_vendor - Speed_groundtruth| / N
```

**Speed Error Bias (SEB):**
```
SEB = Σ(Speed_vendor - Speed_groundtruth) / N
```

**Mean Absolute Error (MAE) for Travel Time:**
```
MAE_TT = Σ|TT_vendor - TT_groundtruth| / N
```

**Scoring Table:**

| Metric | Excellent (90-100) | Good (70-89) | Fair (50-69) | Poor (<50) |
|--------|-------------------|--------------|--------------|------------|
| AASE (all speeds) | < 3 MPH | 3-5 MPH | 5-8 MPH | > 8 MPH |
| AASE (< 45 MPH) | < 4 MPH | 4-6 MPH | 6-9 MPH | > 9 MPH |
| SEB | ± 1 MPH | ± 1-3 MPH | ± 3-5 MPH | > ± 5 MPH |
| Travel Time MAE | < 5% | 5-10% | 10-15% | > 15% |
| Pattern Fidelity | > 95% | 85-95% | 70-85% | < 70% |

**Calculation Example:**
```
ACC_probe = 0.30 × AASE_score +
            0.25 × AASE_congested_score +
            0.20 × SEB_score +
            0.15 × MAE_TT_score +
            0.10 × Pattern_score
```

#### 3.1.2 Origin-Destination Data

**Primary Metrics:**

**Trip Count Accuracy:**
```
Trip_Error = |Trips_vendor - Trips_groundtruth| / Trips_groundtruth × 100%
```

**Distance Accuracy:**
```
Distance_Error = |AvgDist_vendor - AvgDist_groundtruth| / AvgDist_groundtruth × 100%
```

**O-D Matrix Correlation:**
```
Correlation = Pearson(ODMatrix_vendor, ODMatrix_groundtruth)
```

**Scoring Table:**

| Metric | Excellent (90-100) | Good (70-89) | Fair (50-69) | Poor (<50) |
|--------|-------------------|--------------|--------------|------------|
| Trip Count Error | < 10% | 10-20% | 20-35% | > 35% |
| Avg Distance Error | < 15% | 15-25% | 25-40% | > 40% |
| O-D Matrix R² | > 0.85 | 0.70-0.85 | 0.50-0.70 | < 0.50 |
| Peak Hour Accuracy | < 12% | 12-22% | 22-35% | > 35% |

#### 3.1.3 Traffic Volume

**Primary Metrics:**

**Volume MAE:**
```
MAE_volume = Σ|Volume_vendor - Volume_groundtruth| / N
```

**Percent Error:**
```
PE = (Volume_vendor - Volume_groundtruth) / Volume_groundtruth × 100%
```

**Scoring Table:**

| Road Type | Excellent | Good | Fair | Poor |
|-----------|-----------|------|------|------|
| Interstate/Freeway | < 10% PE | 10-15% | 15-25% | > 25% |
| Major Arterial | < 15% PE | 15-20% | 20-30% | > 30% |
| Minor Arterial | < 20% PE | 20-30% | 30-40% | > 40% |
| Collector/Local | < 30% PE | 30-40% | 40-50% | > 50% |

#### 3.1.4 Work Zones (WZDx)

**Primary Metrics:**

| Metric | Excellent (90-100) | Good (70-89) | Fair (50-69) | Poor (<50) |
|--------|-------------------|--------------|--------------|------------|
| Location Accuracy | < 50 ft | 50-100 ft | 100-500 ft | > 500 ft |
| Start Time Accuracy | < 2 hrs | 2-6 hrs | 6-24 hrs | > 24 hrs |
| End Time Accuracy | < 4 hrs | 4-12 hrs | 12-48 hrs | > 48 hrs |
| Lane Closure Accuracy | > 95% | 85-95% | 70-85% | < 70% |
| Impact Classification | > 90% | 75-90% | 60-75% | < 60% |

#### 3.1.5 Incidents

**Primary Metrics:**

| Metric | Excellent (90-100) | Good (70-89) | Fair (50-69) | Poor (<50) |
|--------|-------------------|--------------|--------------|------------|
| Detection Rate | > 90% | 75-90% | 60-75% | < 60% |
| False Positive Rate | < 10% | 10-15% | 15-25% | > 25% |
| Time to Detection | < 3 min | 3-5 min | 5-10 min | > 10 min |
| Location Accuracy | < 100 ft | 100-300 ft | 300-1000 ft | > 1000 ft |
| Clearance Time Accuracy | < 15% error | 15-25% | 25-40% | > 40% |

#### 3.1.6 Truck Parking (TPIMS)

**Primary Metrics:**

| Metric | Excellent (90-100) | Good (70-89) | Fair (50-69) | Poor (<50) |
|--------|-------------------|--------------|--------------|------------|
| Occupancy MAE | < 5 spaces | 5-10 spaces | 10-20 spaces | > 20 spaces |
| Percent Error | < 10% | 10-20% | 20-30% | > 30% |
| Status Accuracy (Full/Not Full) | > 90% | 80-90% | 70-80% | < 70% |
| Peak Period Accuracy | > 85% | 75-85% | 65-75% | < 65% |

### 3.2 COVERAGE (COV) - 25% Weight

#### 3.2.1 Spatial Coverage

**Network Coverage:**
```
Spatial_Coverage = (Miles_with_data / Total_corridor_miles) × 100%
```

**Scoring:**

| Feed Type | Excellent | Good | Fair | Poor |
|-----------|-----------|------|------|------|
| Probe Speed | > 95% | 85-95% | 70-85% | < 70% |
| O-D Data | > 90% coverage of zones | 80-90% | 65-80% | < 65% |
| Volume | > 80% of count locations | 70-80% | 55-70% | < 55% |
| Work Zones | > 98% of active zones | 90-98% | 80-90% | < 80% |
| Incidents | > 95% of corridor | 85-95% | 70-85% | < 70% |

#### 3.2.2 Temporal Coverage

**Availability:**
```
Temporal_Coverage = (Hours_with_valid_data / Total_hours) × 100%
```

**Update Frequency Score:**

| Feed Type | Excellent | Good | Fair | Poor |
|-----------|-----------|------|------|------|
| Probe Speed | < 1 min | 1-2 min | 2-5 min | > 5 min |
| O-D Data | Daily | Weekly | Monthly | > Monthly |
| Volume | < 5 min | 5-15 min | 15-60 min | > 60 min |
| Work Zones | < 15 min | 15-60 min | 1-4 hrs | > 4 hrs |
| Incidents | < 1 min | 1-3 min | 3-5 min | > 5 min |

**Calculation:**
```
COV_score = 0.50 × Spatial_Coverage_score +
            0.35 × Temporal_Coverage_score +
            0.15 × Update_Frequency_score
```

### 3.3 TIMELINESS (TIM) - 20% Weight

#### 3.3.1 Latency Metrics

**Data Latency:**
```
Latency = Time_reported - Time_observed
```

**Scoring Table:**

| Feed Type | Excellent (90-100) | Good (70-89) | Fair (50-69) | Poor (<50) |
|-----------|-------------------|--------------|--------------|------------|
| Probe Speed (Median) | < 30 sec | 30-60 sec | 60-120 sec | > 120 sec |
| Probe Speed (P99) | < 90 sec | 90-180 sec | 180-300 sec | > 300 sec |
| O-D Data | < 24 hrs | 24-48 hrs | 48-96 hrs | > 96 hrs |
| Work Zones | < 30 min | 30-60 min | 60-180 min | > 180 min |
| Incidents | < 2 min | 2-5 min | 5-10 min | > 10 min |
| Truck Parking | < 5 min | 5-15 min | 15-30 min | > 30 min |

#### 3.3.2 Update Consistency

**Update Reliability:**
```
Reliability = (Updates_on_schedule / Total_expected_updates) × 100%
```

**Scoring:**
- Excellent (95-100): > 99% reliability
- Good (75-94): 95-99% reliability
- Fair (50-74): 90-95% reliability
- Poor (<50): < 90% reliability

**Calculation:**
```
TIM_score = 0.50 × Median_Latency_score +
            0.30 × P99_Latency_score +
            0.20 × Update_Reliability_score
```

### 3.4 STANDARDS CONFORMANCE (STD) - 10% Weight

#### 3.4.1 Specification Conformance

**ngTMDD v3.x / TMDD Conformance:**

Required fields by feed type (10 core fields):

**Probe Speed/Travel Time:**
1. Event ID (tmdd:eventID) - Critical
2. Organization/State (tmdd:organization-id) - Critical
3. Update Time (tmdd:event-update-time) - Critical
4. Roadway Name (tmdd:roadway-name) - High
5. Direction (tmdd:direction) - High
6. Coordinates (tmdd:point) - Medium
7. Speed Value (tmdd:speed) - Critical
8. Confidence Level - Medium

**Work Zones (WZDx v4.2+):**
1. Road Event ID - Critical
2. Start Date/Time - Critical
3. End Date/Time - High
4. Location Method (channel/method) - Critical
5. Road Names - High
6. Direction - High
7. Lane Closure Type - High
8. Vehicle Impact (all/some) - Medium
9. Geometry (LineString) - Medium
10. Event Type - Critical

**Scoring:**

| Conformance Level | Score | Criteria |
|-------------------|-------|----------|
| Full Conformance | 95-100 | All critical + high fields, 90%+ medium fields |
| Substantial | 80-94 | All critical, 90%+ high, 70%+ medium |
| Partial | 60-79 | All critical, 70%+ high, 50%+ medium |
| Minimal | 40-59 | All critical, 50%+ high |
| Non-Conformant | <40 | Missing critical fields |

#### 3.4.2 Field Validation

**Weighted Field Scoring:**
- **Critical fields** (60% weight): Must be present, valid format, non-null
- **High priority fields** (30% weight): Should be present, valid
- **Medium priority fields** (10% weight): Nice to have

**Calculation:**
```
Field_score = Σ(Field_weight × Field_present × Field_valid) / Total_weight

STD_score = 0.60 × Spec_Conformance_score +
            0.25 × Field_Completeness_score +
            0.15 × Data_Format_score
```

### 3.5 GOVERNANCE (GOV) - 5% Weight

#### 3.5.1 Documentation Quality

**Required Documentation:**
- [ ] Data dictionary with field definitions
- [ ] Update frequency specification
- [ ] Known limitations and caveats
- [ ] Methodology description
- [ ] Quality control procedures
- [ ] Issue reporting mechanism
- [ ] SLA/performance guarantees

**Scoring:**
```
Documentation_score = (Documents_present / 7) × 100
```

#### 3.5.2 Service Reliability

**Uptime:**
```
Uptime = (Time_available / Total_time) × 100%
```

**Scoring:**

| Uptime | Score |
|--------|-------|
| ≥ 99.5% | 100 |
| 99.0-99.5% | 90 |
| 98.0-99.0% | 75 |
| 95.0-98.0% | 60 |
| < 95.0% | 40 |

**Calculation:**
```
GOV_score = 0.50 × Documentation_score +
            0.30 × Uptime_score +
            0.20 × Support_Responsiveness_score
```

---

## 4. DQI Calculation and Grading

### 4.1 Data Quality Index (DQI) Formula

```
DQI = (ACC × 0.40) + (COV × 0.25) + (TIM × 0.20) + (STD × 0.10) + (GOV × 0.05)
```

**Where:**
- All component scores are on 0-100 scale
- DQI result is rounded to nearest integer
- Minimum reportable DQI: 0
- Maximum reportable DQI: 100

### 4.2 Letter Grade Assignment

| DQI Range | Letter Grade | Quality Level | Description |
|-----------|-------------|---------------|-------------|
| 97-100 | A+ | Exceptional | Exceeds all expectations |
| 93-96 | A | Excellent | Meets highest standards |
| 90-92 | A- | Excellent | Strong performance |
| 87-89 | B+ | Very Good | Above average |
| 83-86 | B | Good | Solid performance |
| 80-82 | B- | Good | Acceptable with minor issues |
| 77-79 | C+ | Satisfactory | Meets basic requirements |
| 73-76 | C | Satisfactory | Adequate but improvements needed |
| 70-72 | C- | Satisfactory | Minimal acceptable performance |
| 67-69 | D+ | Poor | Below standards |
| 63-66 | D | Poor | Significant deficiencies |
| 60-62 | D- | Poor | Major improvements required |
| <60 | F | Failing | Does not meet minimum standards |

### 4.3 Grade Interpretation

**A-range (90-100):** Data suitable for mission-critical applications, automated decision-making, and public safety applications.

**B-range (80-89):** Data suitable for operational planning, performance monitoring, and analytics with human oversight.

**C-range (70-79):** Data suitable for planning studies, trend analysis, and informational purposes with appropriate caveats.

**D-range (60-69):** Data requires significant improvement; use with extreme caution and extensive validation.

**F (<60):** Data does not meet minimum quality standards for TETC Data Marketplace.

---

## 5. Validation Process

### 5.1 Pre-Validation Planning

**Step 1: Define Scope**
- [ ] Select corridor(s) for validation
- [ ] Identify feed type(s) to validate
- [ ] Determine validation period (30-90 days)
- [ ] Allocate budget and resources

**Step 2: Ground Truth Deployment**
- [ ] Install/activate reference sensors
- [ ] Calibrate equipment
- [ ] Verify data collection
- [ ] Document sensor locations and specifications

**Step 3: Vendor Coordination**
- [ ] Notify vendor of validation study
- [ ] Request specific data coverage
- [ ] Establish data delivery mechanism
- [ ] Schedule kickoff meeting

### 5.2 Data Collection Phase

**Week 1-2:**
- [ ] Monitor ground truth data collection
- [ ] Verify vendor data delivery
- [ ] Perform initial data quality checks
- [ ] Address any setup issues

**Week 3-8 (ongoing):**
- [ ] Continue data collection
- [ ] Weekly quality checks
- [ ] Document any anomalies
- [ ] Maintain sensor calibration

**Week 9-10:**
- [ ] Complete data collection
- [ ] Finalize ground truth dataset
- [ ] Obtain final vendor dataset
- [ ] Prepare data for analysis

### 5.3 Analysis Phase

**Step 1: Data Preparation**
```python
# Example: Temporal alignment
vendor_data = align_timestamps(vendor_data, groundtruth_data, tolerance='30s')

# Spatial matching
matched_data = spatial_join(vendor_data, groundtruth_data, buffer='100ft')
```

**Step 2: Calculate Metrics**
- [ ] Compute accuracy metrics (AASE, SEB, MAE, etc.)
- [ ] Calculate coverage statistics
- [ ] Analyze latency distributions
- [ ] Evaluate standards conformance
- [ ] Assess governance factors

**Step 3: Score Components**
- [ ] Apply scoring rubrics to each metric
- [ ] Calculate weighted component scores
- [ ] Document any deviations from SOP
- [ ] Perform sensitivity analysis

**Step 4: Calculate DQI**
- [ ] Apply DQI formula
- [ ] Assign letter grade
- [ ] Generate comparison charts
- [ ] Prepare summary statistics

### 5.4 Reporting Phase

**Validation Report Structure:**

1. **Executive Summary** (1 page)
   - DQI score and letter grade
   - Key findings (3-5 bullet points)
   - Overall recommendation

2. **Methodology** (2-3 pages)
   - Validation period and location
   - Ground truth data sources
   - Sample sizes and coverage
   - Analysis procedures

3. **Results by Component** (5-8 pages)
   - ACC: Detailed accuracy metrics with charts
   - COV: Coverage maps and statistics
   - TIM: Latency distributions
   - STD: Conformance checklist
   - GOV: Documentation and reliability assessment

4. **Detailed Findings** (3-5 pages)
   - Performance by time of day
   - Performance by speed bin
   - Performance by road type
   - Performance by incident conditions

5. **Comparison to Standards** (1-2 pages)
   - Benchmark against contractual requirements
   - Comparison to previous validation studies
   - Comparison to peer vendors (anonymous)

6. **Recommendations** (1-2 pages)
   - Areas for improvement
   - Best use cases for this data
   - Cautionary notes
   - Timeline for re-validation

7. **Appendices**
   - Detailed metric tables
   - Statistical test results
   - Sensor deployment maps
   - Data quality flags

---

## 6. Quality Assurance

### 6.1 Validation Quality Checks

**Ground Truth Data Quality:**
- [ ] Sensor calibration documentation complete
- [ ] < 5% missing data in ground truth
- [ ] No systematic errors detected
- [ ] Cross-validation with secondary sources

**Analysis Quality:**
- [ ] Peer review of methodology
- [ ] Independent verification of calculations
- [ ] Sensitivity analysis performed
- [ ] Statistical significance testing

**Reporting Quality:**
- [ ] Technical review by subject matter expert
- [ ] Editorial review for clarity
- [ ] Vendor review for factual accuracy
- [ ] Final approval by TETC Technical Committee

### 6.2 Appeal Process

If vendor disagrees with validation results:

**Step 1:** Vendor submits formal appeal within 30 days
**Step 2:** TETC Technical Committee reviews appeal
**Step 3:** Independent third-party re-validation if warranted
**Step 4:** Final determination within 60 days of appeal
**Step 5:** Updated report published if results change

---

## 7. Continuous Improvement

### 7.1 SOP Review Cycle

- **Quarterly:** Review scoring thresholds based on industry trends
- **Annually:** Major SOP revision incorporating lessons learned
- **As needed:** Emergency updates for new feed types or standards

### 7.2 Benchmark Updates

Update scoring thresholds when:
- Industry average improves by 10%+ over 2 years
- New technology enables better performance
- USDOT/AASHTO publishes updated standards
- MDODE framework is revised

---

## 8. Appendices

### Appendix A: Calculation Examples

**Example 1: Probe Speed Validation**

Given validation results:
- AASE (all speeds) = 3.4 MPH → 95/100
- AASE (< 45 MPH) = 4.1 MPH → 93/100
- SEB = +1.2 MPH → 92/100
- Travel Time MAE = 6.2% → 88/100
- Pattern fidelity = 92.5% → 90/100

```
ACC_probe = (0.30 × 95) + (0.25 × 93) + (0.20 × 92) + (0.15 × 88) + (0.10 × 90)
          = 28.5 + 23.25 + 18.4 + 13.2 + 9.0
          = 92.35 ≈ 92/100
```

### Appendix B: Statistical Methods

**Confidence Intervals:**
```
95% CI = mean ± 1.96 × (std_dev / √n)
```

**Hypothesis Testing:**
- Use t-test for mean comparisons
- Use chi-square for categorical data
- Alpha = 0.05 for statistical significance

### Appendix C: Tool Recommendations

**Data Analysis:**
- Python pandas, numpy, scipy
- R statistical software
- PostgreSQL/PostGIS for spatial analysis
- Tableau/PowerBI for visualization

**Ground Truth Collection:**
- Wavetronix SmartSensor HD
- FLIR TrafiOne
- Blyncsy digital sensors
- INRIX Roadway Analytics (for validation only)

### Appendix D: Report Templates

Templates available at:
- `tetc-validation-report-template.docx`
- `tetc-scorecard-template.xlsx`
- `tetc-validation-slides-template.pptx`

---

## 9. Contacts

**TETC Data Marketplace Program Manager**
Email: tdm@tetcoalition.org
Phone: (XXX) XXX-XXXX

**Technical Committee Chair**
Email: tech-committee@tetcoalition.org

**Vendor Support**
Email: vendor-support@tetcoalition.org

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Nov 2025 | TETC Technical Committee | Initial release |

---

**END OF DOCUMENT**
