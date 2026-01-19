-- Phase 1.3: Procurement Transparency Dashboard
-- Track vendor contracts, costs, and ROI

-- Vendor contract information
CREATE TABLE IF NOT EXISTS vendor_contracts (
    id SERIAL PRIMARY KEY,
    state_key TEXT NOT NULL,
    vendor_name TEXT NOT NULL,
    contract_type TEXT, -- 'DATA_FEED', 'SYSTEM_INTEGRATION', 'EQUIPMENT', 'MAINTENANCE'
    data_type TEXT, -- 'wzdx', 'incidents', 'cameras', 'probe_data', etc.

    -- Financial terms
    contract_value_annual REAL,
    contract_value_total REAL,
    payment_structure TEXT, -- 'FIXED', 'PER_EVENT', 'PER_FEED', 'SUBSCRIPTION'
    cost_per_event REAL, -- Calculated
    cost_per_feed REAL, -- Calculated

    -- Contract dates
    contract_start_date DATE,
    contract_end_date DATE,
    renewal_option_available BOOLEAN DEFAULT FALSE,
    auto_renew BOOLEAN DEFAULT FALSE,

    -- Performance requirements
    sla_uptime_target REAL, -- 99.0, 99.9, etc.
    sla_data_freshness_minutes INTEGER,
    sla_completeness_target REAL, -- 95%, 99%, etc.
    sla_penalties_clause TEXT,

    -- Procurement details
    procurement_method TEXT, -- 'RFP', 'SOLE_SOURCE', 'PIGGYBACK', 'COOPERATIVE'
    original_rfp_number TEXT,
    award_date DATE,

    -- Status
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'PENDING', 'TERMINATED'
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(state_key, vendor_name, contract_type, data_type)
);

CREATE INDEX IF NOT EXISTS idx_contracts_state ON vendor_contracts(state_key);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor ON vendor_contracts(vendor_name);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON vendor_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON vendor_contracts(contract_end_date);

-- SLA compliance tracking
CREATE TABLE IF NOT EXISTS sla_compliance (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL,
    measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Uptime tracking
    uptime_percentage REAL,
    total_downtime_minutes INTEGER,
    outage_count INTEGER,

    -- Data quality tracking
    data_freshness_avg_minutes REAL,
    data_freshness_violations INTEGER,
    completeness_percentage REAL,

    -- Performance scores
    overall_sla_compliance_score REAL, -- 0-100
    sla_met BOOLEAN,
    penalty_amount REAL,

    -- Notes
    incidents TEXT, -- JSON array of incident descriptions
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (contract_id) REFERENCES vendor_contracts(id),
    UNIQUE(contract_id, measurement_date)
);

CREATE INDEX IF NOT EXISTS idx_sla_compliance_contract ON sla_compliance(contract_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_sla_compliance_violations ON sla_compliance(sla_met, measurement_date DESC);

-- Cost-benefit analysis
CREATE TABLE IF NOT EXISTS procurement_cost_analysis (
    id SERIAL PRIMARY KEY,
    state_key TEXT NOT NULL,
    analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Total costs
    total_annual_contract_costs REAL,
    total_maintenance_costs REAL,
    total_integration_costs REAL,
    total_training_costs REAL,
    total_operational_costs REAL,
    grand_total_cost REAL,

    -- Event metrics
    total_events_processed INTEGER,
    cost_per_event REAL,

    -- Comparative metrics (vs peer states)
    peer_state_avg_cost_per_event REAL,
    cost_efficiency_percentile INTEGER, -- 0-100, higher is more efficient

    -- ROI metrics
    estimated_time_saved_hours REAL,
    estimated_incident_response_improvement_pct REAL,
    estimated_traveler_delay_reduction_hours REAL,
    estimated_economic_benefit REAL,
    benefit_cost_ratio REAL,

    -- Contract renewal recommendations
    renewal_recommended BOOLEAN,
    renewal_reasoning TEXT,
    alternative_vendors TEXT, -- JSON array
    estimated_savings_with_alternative REAL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(state_key, analysis_date)
);

CREATE INDEX IF NOT EXISTS idx_cost_analysis_state ON procurement_cost_analysis(state_key, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_cost_analysis_efficiency ON procurement_cost_analysis(cost_efficiency_percentile DESC);

-- Budget justification exports
CREATE TABLE IF NOT EXISTS budget_justifications (
    id SERIAL PRIMARY KEY,
    state_key TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    document_type TEXT, -- 'ANNUAL_BUDGET', 'SUPPLEMENTAL', 'GRANT_APPLICATION'

    -- Financial summary
    requested_amount REAL,
    current_spending REAL,
    projected_spending REAL,

    -- Justification metrics (auto-populated)
    events_processed_ytd INTEGER,
    avg_data_quality_score REAL,
    sla_compliance_rate REAL,
    cost_per_event REAL,
    peer_comparison_percentile INTEGER,

    -- Impact metrics
    estimated_travelers_served INTEGER,
    estimated_delay_hours_saved REAL,
    estimated_economic_impact REAL,
    safety_improvement_metrics TEXT, -- JSON

    -- Generated exports
    executive_summary TEXT,
    detailed_metrics_json TEXT,
    comparison_table_json TEXT,

    -- Status
    status TEXT DEFAULT 'DRAFT', -- 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,

    created_by TEXT,
    notes TEXT,

    UNIQUE(state_key, fiscal_year, document_type)
);

CREATE INDEX IF NOT EXISTS idx_budget_justifications_state ON budget_justifications(state_key, fiscal_year DESC);

-- View: Contract expiration alerts
CREATE OR REPLACE VIEW contract_expiration_alerts AS
SELECT
    vc.id,
    vc.state_key,
    vc.vendor_name,
    vc.contract_type,
    vc.data_type,
    vc.contract_end_date,
    vc.contract_value_annual,
    (vc.contract_end_date - CURRENT_DATE) as days_until_expiration,
    CASE
        WHEN (vc.contract_end_date - CURRENT_DATE) < 30 THEN 'URGENT'
        WHEN (vc.contract_end_date - CURRENT_DATE) < 90 THEN 'WARNING'
        WHEN (vc.contract_end_date - CURRENT_DATE) < 180 THEN 'NOTICE'
        ELSE 'OK'
    END as alert_level,
    vc.renewal_option_available,
    vc.auto_renew
FROM vendor_contracts vc
WHERE vc.status = 'ACTIVE'
  AND vc.contract_end_date IS NOT NULL
  AND vc.contract_end_date > CURRENT_DATE
  AND (vc.contract_end_date - CURRENT_DATE) < 180
ORDER BY vc.contract_end_date ASC;

-- View: Vendor performance vs cost
CREATE OR REPLACE VIEW vendor_performance_cost_analysis AS
SELECT
    vc.vendor_name,
    vc.state_key,
    vc.data_type,
    vc.contract_value_annual,
    vc.cost_per_event,
    AVG(sc.overall_sla_compliance_score) as avg_sla_compliance,
    AVG(sc.uptime_percentage) as avg_uptime,
    COUNT(CASE WHEN sc.sla_met = FALSE THEN 1 END) as sla_violations_count,
    SUM(sc.penalty_amount) as total_penalties_ytd,
    CASE
        WHEN AVG(sc.overall_sla_compliance_score) >= 95 AND vc.cost_per_event <
             (SELECT AVG(cost_per_event) FROM vendor_contracts WHERE data_type = vc.data_type)
        THEN 'EXCELLENT'
        WHEN AVG(sc.overall_sla_compliance_score) >= 90 THEN 'GOOD'
        WHEN AVG(sc.overall_sla_compliance_score) >= 75 THEN 'FAIR'
        ELSE 'POOR'
    END as performance_rating
FROM vendor_contracts vc
LEFT JOIN sla_compliance sc ON vc.id = sc.contract_id
WHERE vc.status = 'ACTIVE'
  AND sc.measurement_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY vc.vendor_name, vc.state_key, vc.data_type, vc.contract_value_annual, vc.cost_per_event;

-- View: Peer state cost comparison
CREATE OR REPLACE VIEW peer_state_cost_comparison AS
SELECT
    pca.state_key,
    pca.cost_per_event,
    pca.peer_state_avg_cost_per_event,
    pca.cost_efficiency_percentile,
    (pca.peer_state_avg_cost_per_event - pca.cost_per_event) as savings_vs_peer_avg,
    pca.benefit_cost_ratio,
    pca.estimated_economic_benefit,
    pca.renewal_recommended,
    pca.analysis_date
FROM procurement_cost_analysis pca
WHERE pca.analysis_date = (
    SELECT MAX(analysis_date)
    FROM procurement_cost_analysis
    WHERE state_key = pca.state_key
)
ORDER BY pca.cost_efficiency_percentile DESC;
