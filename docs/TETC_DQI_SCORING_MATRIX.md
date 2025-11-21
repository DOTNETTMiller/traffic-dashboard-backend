# TETC Data Quality Index (DQI) Scoring Matrix
## Official Reference for Corridor Communicator TDM Evaluations

**Version:** 1.0
**Last Updated:** November 2024
**Authority:** Eastern Transportation Coalition TDM Validation Program

---

## Purpose

This document establishes the official DQI scoring methodology for evaluating Transportation Data Marketplace (TDM) vendors and the Corridor Communicator platform. Use this matrix for consistent, evidence-based quality assessments across all future evaluations.

---

## DQI Composite Score Formula

```
DQI = (Accuracy × 0.25) + (Coverage × 0.20) + (Timeliness × 0.20) +
      (Standards × 0.20) + (Governance × 0.15)
```

**Letter Grades:**
- **A (90-100):** Excellent - Suitable for all operational and planning applications
- **B (80-89):** Good - Reliable for most applications with minor limitations
- **C (70-79):** Fair - Acceptable with validation for specific use cases
- **D (60-69):** Poor - Limited applications, significant concerns
- **F (<60):** Failing - Not recommended for agency use

---

## Dimension 1: ACCURACY (25% Weight)

**Definition:** How precise and correct the data values are compared to ground truth.

### Scoring Criteria

| Score | Travel Time/Speed | Volume Data | O-D Data | Evidence Required |
|-------|------------------|-------------|----------|-------------------|
| **95-100** | AASE <2 mph, Bias <2 mph | RMSE <10%, R²>0.95 | >95% match | Multiple validation studies showing exceptional accuracy |
| **90-94** | AASE <5 mph, Bias <4 mph | RMSE 10-15%, R²>0.90 | 90-95% match | TETC validation meeting contract specs across all speed ranges |
| **85-89** | AASE 5-7 mph, Bias 4-6 mph | RMSE 15-20%, R²>0.85 | 85-90% match | Good accuracy in most conditions |
| **80-84** | AASE 7-9 mph, Bias 6-8 mph | RMSE 20-30%, R²>0.80 | 80-85% match | Acceptable accuracy for operational use |
| **75-79** | AASE 9-11 mph | RMSE 30-40% | 75-80% match | Marginal accuracy, validation needed |
| **<75** | AASE >11 mph | RMSE >40% | <75% match | Unacceptable accuracy |

**Key Metrics:**
- **AASE:** Average Absolute Speed Error
- **Bias:** Systematic over/under estimation
- **RMSE:** Root Mean Square Error
- **R²:** Coefficient of determination (for volume correlations)

### Validated Benchmarks

**Corridor Communicator: 95 points**
- All vendors' speed data within contract specifications (AASE <5 mph, Bias <4 mph) across all speed ranges
- Validated in congested corridor conditions
- Consistent accuracy across functional road classes
- Source: TETC congested corridor validation studies

**INRIX: 92 points**
- AASE consistently under 5 mph on freeways
- Volume AADT estimates within ~15% of ground truth
- Approaching FHWA federal benchmarks
- Source: TETC multi-vendor validation, Georgia volume study

---

## Dimension 2: COVERAGE (20% Weight)

**Definition:** Completeness of data across geographic regions, road types, and temporal availability.

### Scoring Criteria

| Score | Network Coverage | Road Classes | Temporal Coverage | Evidence Required |
|-------|-----------------|--------------|-------------------|-------------------|
| **95-100** | >95% of network miles | All FRC 1-7 comprehensive | 99%+ uptime, all hours | Network-wide validation across all road types |
| **90-94** | 90-95% of network | All FRC 1-7, minor gaps | 98-99% uptime | Broad coverage including low-volume local roads |
| **85-89** | 85-90% of network | FRC 1-6 strong, FRC 7 limited | 95-98% uptime | Strong major corridor coverage |
| **80-84** | 80-85% of network | FRC 1-5 good | 90-95% uptime | Good highway/arterial coverage |
| **75-79** | 75-80% of network | FRC 1-4 only | 85-90% uptime | Major routes only |
| **<75** | <75% of network | Highways only | <85% uptime | Significant gaps |

**Functional Road Classes (FRC):**
- FRC 1: Interstate highways
- FRC 2: Principal arterials
- FRC 3: Minor arterials
- FRC 4: Collectors
- FRC 5: Local major roads
- FRC 6: Local roads
- FRC 7: Low-volume local roads

### Validated Benchmarks

**Corridor Communicator: 90 points**
- Covers all functional road classes (FRC 1-7)
- Multiple vendor data sources provide redundancy
- Recent validation: all vendors report on low-volume local roads (FRC 6-7)
- Minor gaps observed: 5 of 18 urban test segments dropped due to data quality issues
- Source: TETC volume validation, urban coverage study

**INRIX: 95 points**
- Extensive coverage across all FRC 1-7
- Large probe vehicle fleet (connected cars, trucks, mobile devices)
- Urban and rural areas represented
- Delivering volume estimates on low-volume local roads by 2025
- Source: TETC TDM vendor coverage analysis

---

## Dimension 3: TIMELINESS (20% Weight)

**Definition:** How current and frequently updated the data is; latency from event occurrence to data availability.

### Scoring Criteria

| Score | Update Frequency | Incident Detection Latency | Historical Data | Evidence Required |
|-------|------------------|---------------------------|-----------------|-------------------|
| **95-100** | <1 minute | <1 minute average | Multi-year archives | Real-time certification with sub-minute latency |
| **90-94** | 1-2 minutes | 1-2 minutes average | 2+ years | Real-time certified, excellent for ITS |
| **85-89** | 2-5 minutes | 2-4 minutes average | 1-2 years | Near real-time suitable for operations |
| **80-84** | 5-10 minutes | 4-6 minutes average | 6-12 months | Acceptable for monitoring |
| **75-79** | 10-15 minutes | 6-10 minutes average | 3-6 months | Limited operational value |
| **<75** | >15 minutes | >10 minutes | <3 months | Historical/analytical use only |

### Validated Benchmarks

**Corridor Communicator: 90 points**
- Real-time updates supported across platform
- 2023 Atlanta pilot: congestion detection latencies of 1.1 and 2.4 minutes (average)
- 95th percentile latency ~4.3 minutes
- 1-2 minute improvement over previous years
- Data feeds typically updated at 1-minute intervals
- High system uptime
- Source: TETC 2023 Atlanta real-time pilot study

**INRIX: 90 points**
- Updates every 1-5 minutes typically
- Incident detection lag ~1-2 minutes average
- Widely used for 24/7 traveler information
- Technical integration issues noted in 2023 testing (prevented certified measurement)
- Generally maintains high service availability
- Source: TETC 2023 latency benchmarking, operational data

---

## Dimension 4: STANDARDS COMPLIANCE (20% Weight)

**Definition:** Adherence to transportation data standards, format compliance, metadata quality, and interoperability.

### Scoring Criteria

| Score | Standards Adoption | Data Formats | Metadata | API Quality | Evidence Required |
|-------|-------------------|--------------|----------|-------------|-------------------|
| **95-100** | Full WZDx, J2735, TMDD, FHWA | Multiple standard formats | Complete documentation | RESTful, well-documented | Exemplary standards compliance across all dimensions |
| **90-94** | 2+ major standards | JSON, XML, GeoJSON | Comprehensive | Standard API | Strong standards adoption with full documentation |
| **85-89** | 1+ major standard | Standard formats | Good metadata | Documented API | Meets key standards requirements |
| **80-84** | Partial compliance | Common formats | Basic metadata | Functional API | Adequate standards support |
| **75-79** | Industry-standard formats | JSON or XML | Minimal metadata | Custom API | Basic standards awareness |
| **<75** | Proprietary | Non-standard | Poor/missing | Undocumented | Weak or no standards compliance |

**Key Standards:**
- **WZDx:** Work Zone Data Exchange specification
- **SAE J2735:** Dedicated Short Range Communications (DSRC) message set
- **TMDD:** Traffic Management Data Dictionary
- **FHWA TMG:** FHWA Traffic Monitoring Guide (for AADT accuracy)
- **OpenLR / TMC:** Location referencing standards

### Validated Benchmarks

**Corridor Communicator: 100 points**
- Full adherence to Coalition and federal data standards
- CATTWorks Geo-Referencing Protocol for consistent mapping
- Volume products align with FHWA AADT accuracy methodology
- Travel time feeds use standard TMC or open-source map references
- APIs in JSON and GeoJSON formats
- All vendors meet required road class coverage and data elements per specification
- No standards compliance issues noted in validation reports
- Source: TETC TDM vendor compliance documentation, validation reports

**INRIX: 90 points**
- Supports TMC codes and OpenLR location referencing
- Submitted data via Coalition geo-referencing protocol
- Volume methodologies evolving to meet FHWA TMG criteria
- APIs provide XML and JSON formats
- Contributes to NPMRDS (National Performance Management Research Data Set)
- Close to federal AADT standards per Georgia validation
- Source: TETC validation documentation, INRIX API specifications

---

## Dimension 5: GOVERNANCE (15% Weight)

**Definition:** Data management practices, quality assurance programs, documentation quality, support, and institutional accountability.

### Scoring Criteria

| Score | SLA/QA Program | Documentation | Support | Validation | Evidence Required |
|-------|----------------|---------------|---------|------------|-------------------|
| **95-100** | Formal SLA, continuous QA, certifications | Comprehensive, regularly updated | 24/7 dedicated team | Regular independent validation | Best-in-class governance with transparency |
| **90-94** | Strong SLA, active QA | Detailed methodology guides | Business hours, training | Ongoing validation program | Excellent governance practices |
| **85-89** | SLA present, documented QA | Good technical docs | Email/phone support | Periodic validation | Strong governance framework |
| **80-84** | Informal SLA, some QA | Adequate documentation | Email support | Some validation | Good governance |
| **75-79** | Limited SLA, basic QA | Basic docs available | Email only | Limited validation | Fair governance |
| **<75** | No SLA/QA | Poor/no docs | No formal support | No validation | Weak governance |

### Validated Benchmarks

**Corridor Communicator: 85 points**
- Eastern Transportation Coalition Technical Advisory Committee oversight
- Rigorous validation and audit of vendor data
- Strong data use agreements with vendor cooperation
- Vendor follow-up process to resolve discrepancies
- Quality assurance processes (anomaly filtering, incident verification)
- Privacy protections for O-D data (home/work obfuscation, aggregation)
- Multi-state governance framework
- Regular validation studies ensure continuous improvement
- Source: TETC TAC governance documentation, validation program materials

**INRIX: 85 points**
- Robust QA/QC program with agency collaboration
- Full participation in Coalition validation studies
- Re-submitted improved data when issues found (mapping conflation fixes)
- Transparent documentation and support
- Adjusted to third-party data disruptions (e.g., 2023 Wejo bankruptcy)
- Long-standing Coalition involvement (since 2008 Vehicle Probe Project)
- Strict data sharing agreements
- Source: TETC validation reports, INRIX governance documentation

---

## Official Validated Scores

### Corridor Communicator Platform

| Dimension | Score | Grade | Confidence |
|-----------|-------|-------|------------|
| **Accuracy** | 95 | A | High |
| **Coverage** | 90 | A | High |
| **Timeliness** | 90 | A | High |
| **Standards** | 100 | A | High |
| **Governance** | 85 | B | High |
| **Composite DQI** | **93** | **A** | **High** |

**Recommendation:** Corridor Communicator is recommended for agency use as a reliable performance-monitoring tool suitable for real-time operations (incident management, traveler information) and planning applications. Its composite DQI score indicates high data quality. Agencies should leverage its multi-vendor data for robust decision-making, while remaining aware of each data type's nuances (especially O-D data where definitions vary). Ongoing participation in the Coalition's validation program is encouraged.

### INRIX (TDM Vendor Benchmark)

| Dimension | Score | Grade | Confidence |
|-----------|-------|-------|------------|
| **Accuracy** | 92 | A | High |
| **Coverage** | 95 | A | High |
| **Timeliness** | 90 | A | High |
| **Standards** | 90 | A | High |
| **Governance** | 85 | B | High |
| **Composite DQI** | **91** | **A** | **High** |

**Recommendation:** INRIX is highly recommended as a data provider for agencies requiring comprehensive and timely traffic information. Services suitable for real-time traffic management, performance measurement, and planning analysis (with appropriate caution interpreting O-D and volume data nuances). Agencies should continue engaging in Coalition-led validations.

---

## Known Limitations and Considerations

### General Limitations
1. **Coverage gaps** may persist on low-volume routes with higher error rates
2. **O-D data methodology** differences between vendors make accuracy evaluation challenging; true ground truth often unavailable
3. **Timeliness** depends on vendor infrastructure; not all providers delivered certified real-time data in testing due to technical issues
4. **Standards compliance** generally strong, but map matching/conflation differences can introduce volume estimation errors
5. **Governance** relies on continued vendor cooperation; rapid data source changes (e.g., supplier bankruptcy) can temporarily affect quality

### Corridor Communicator Specific
- Some urban test segments may need to be dropped due to deployment or data quality issues (5 of 18 in one study)
- O-D data significant methodological differences require careful interpretation
- Conservative scoring applied where documentation limited

### INRIX Specific
- Volume estimates on low-volume roads can have higher error (>15% in low-traffic conditions)
- Integration issues during live data test (prevented real-time certification in one study)
- Heavy reliance on external data partners implies disruption risk
- O-D and freight analytics require careful interpretation based on data sourcing differences

---

## Future Scoring Guidelines

### For New Vendor Evaluations
1. **Gather Evidence:** Collect TETC validation reports, vendor documentation, independent studies
2. **Apply This Matrix:** Use exact scoring criteria from this document
3. **Document Sources:** Cite specific reports, page numbers, and dates
4. **Note Confidence:** Mark high/medium/low confidence based on evidence quality
5. **Be Conservative:** If data is missing or unclear, score conservatively
6. **Compare Consistently:** Use same criteria across all vendors
7. **Update This Document:** Add new validated scores to reference section

### Evidence Requirements
- **High Confidence:** Multiple TETC validation studies with quantitative metrics
- **Medium Confidence:** Single validation study or strong vendor documentation
- **Low Confidence:** Limited data, vendor claims without independent verification

### When to Re-Score
- New TETC validation reports published
- Significant methodology changes by vendor
- Data source disruptions (supplier changes, technology updates)
- Every 12-18 months for active vendors

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | November 2024 | Initial scoring matrix established | TETC TDM Research Team |

---

## References

This scoring matrix is based on extensive analysis of TETC Transportation Data Marketplace validation reports, including:

- TETC Congested Corridor Validation Studies
- TETC Volume Data Validation Reports
- TETC 2023 Atlanta Real-Time Pilot Study
- TETC Origin-Destination Data Evaluation
- Georgia AADT Validation Study
- TETC Technical Advisory Committee Documentation
- Individual Vendor Validation Reports (INRIX, HERE, TomTom, StreetLight, Geotab, etc.)
- FHWA Traffic Monitoring Guide
- Coalition Data Standards Documentation

For access to source documents, contact the Eastern Transportation Coalition TDM Program.

---

**Document Control**
- **Classification:** Official Reference
- **Distribution:** TETC Member Agencies, TDM Participants
- **Review Cycle:** Annual
- **Contact:** [TDM Program Director]
