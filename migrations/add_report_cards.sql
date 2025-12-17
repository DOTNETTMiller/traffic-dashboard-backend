-- Monthly Report Card System
-- Stores state performance scores and national rankings

-- Table: state_monthly_scores
-- Aggregated monthly performance metrics for each state
CREATE TABLE IF NOT EXISTS state_monthly_scores (
  score_id INTEGER PRIMARY KEY AUTOINCREMENT,
  state_code TEXT NOT NULL,
  month_year TEXT NOT NULL,  -- Format: "2025-01"

  -- Performance Scores (0-100)
  reliability_score REAL DEFAULT 0,
  safety_score REAL DEFAULT 0,
  congestion_score REAL DEFAULT 0,
  data_quality_score REAL DEFAULT 0,

  -- Overall Grade
  overall_score REAL DEFAULT 0,
  letter_grade TEXT,  -- A+, A, A-, B+, B, B-, C+, C, C-, D, F

  -- Rankings
  national_rank INTEGER,
  regional_rank INTEGER,
  peer_group_rank INTEGER,

  -- Movement
  rank_change INTEGER DEFAULT 0,  -- +/- from previous month
  score_change REAL DEFAULT 0,

  -- Economic Impact
  total_delay_hours REAL DEFAULT 0,
  economic_impact_dollars REAL DEFAULT 0,
  vehicles_affected INTEGER DEFAULT 0,

  -- Data Sources
  event_count INTEGER DEFAULT 0,
  provider_count INTEGER DEFAULT 0,

  -- Metadata
  report_generated BOOLEAN DEFAULT 0,
  report_sent BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(state_code, month_year)
);

-- Table: state_contact_info
-- DOT contact information for report delivery
CREATE TABLE IF NOT EXISTS state_contact_info (
  contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
  state_code TEXT NOT NULL UNIQUE,
  state_name TEXT NOT NULL,

  -- Primary Contact
  contact_name TEXT,
  contact_email TEXT,
  contact_title TEXT,

  -- Secondary Contacts (JSON array)
  additional_contacts TEXT,  -- [{"name": "...", "email": "...", "title": "..."}]

  -- Regional Classification
  region TEXT,  -- West, Midwest, Northeast, Southeast, Southwest
  peer_group TEXT,  -- Large Urban, Medium Urban, Rural, etc.

  -- Settings
  report_enabled BOOLEAN DEFAULT 1,
  report_frequency TEXT DEFAULT 'monthly',  -- monthly, quarterly

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: report_card_history
-- Track all sent reports
CREATE TABLE IF NOT EXISTS report_card_history (
  history_id INTEGER PRIMARY KEY AUTOINCREMENT,
  state_code TEXT NOT NULL,
  month_year TEXT NOT NULL,

  report_type TEXT DEFAULT 'monthly',  -- monthly, quarterly, annual
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  recipients TEXT,  -- JSON array of email addresses

  -- Report Data Snapshot (JSON)
  report_data TEXT,

  -- Delivery Status
  email_status TEXT DEFAULT 'sent',  -- sent, failed, bounced
  opened BOOLEAN DEFAULT 0,

  FOREIGN KEY (state_code) REFERENCES state_contact_info(state_code)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_monthly_scores_state ON state_monthly_scores(state_code);
CREATE INDEX IF NOT EXISTS idx_monthly_scores_month ON state_monthly_scores(month_year);
CREATE INDEX IF NOT EXISTS idx_monthly_scores_rank ON state_monthly_scores(national_rank);
CREATE INDEX IF NOT EXISTS idx_report_history_state ON report_card_history(state_code);
CREATE INDEX IF NOT EXISTS idx_report_history_month ON report_card_history(month_year);

-- Insert default state contact info for all 50 states
INSERT OR IGNORE INTO state_contact_info (state_code, state_name, region, peer_group) VALUES
('AL', 'Alabama', 'Southeast', 'Medium Urban'),
('AK', 'Alaska', 'West', 'Rural'),
('AZ', 'Arizona', 'Southwest', 'Large Urban'),
('AR', 'Arkansas', 'South', 'Medium Urban'),
('CA', 'California', 'West', 'Large Urban'),
('CO', 'Colorado', 'West', 'Large Urban'),
('CT', 'Connecticut', 'Northeast', 'Medium Urban'),
('DE', 'Delaware', 'Northeast', 'Small Urban'),
('FL', 'Florida', 'Southeast', 'Large Urban'),
('GA', 'Georgia', 'Southeast', 'Large Urban'),
('HI', 'Hawaii', 'West', 'Small Urban'),
('ID', 'Idaho', 'West', 'Rural'),
('IL', 'Illinois', 'Midwest', 'Large Urban'),
('IN', 'Indiana', 'Midwest', 'Medium Urban'),
('IA', 'Iowa', 'Midwest', 'Rural'),
('KS', 'Kansas', 'Midwest', 'Medium Urban'),
('KY', 'Kentucky', 'South', 'Medium Urban'),
('LA', 'Louisiana', 'South', 'Medium Urban'),
('ME', 'Maine', 'Northeast', 'Rural'),
('MD', 'Maryland', 'Northeast', 'Large Urban'),
('MA', 'Massachusetts', 'Northeast', 'Large Urban'),
('MI', 'Michigan', 'Midwest', 'Large Urban'),
('MN', 'Minnesota', 'Midwest', 'Large Urban'),
('MS', 'Mississippi', 'South', 'Rural'),
('MO', 'Missouri', 'Midwest', 'Medium Urban'),
('MT', 'Montana', 'West', 'Rural'),
('NE', 'Nebraska', 'Midwest', 'Rural'),
('NV', 'Nevada', 'West', 'Medium Urban'),
('NH', 'New Hampshire', 'Northeast', 'Small Urban'),
('NJ', 'New Jersey', 'Northeast', 'Large Urban'),
('NM', 'New Mexico', 'Southwest', 'Rural'),
('NY', 'New York', 'Northeast', 'Large Urban'),
('NC', 'North Carolina', 'Southeast', 'Large Urban'),
('ND', 'North Dakota', 'Midwest', 'Rural'),
('OH', 'Ohio', 'Midwest', 'Large Urban'),
('OK', 'Oklahoma', 'South', 'Medium Urban'),
('OR', 'Oregon', 'West', 'Medium Urban'),
('PA', 'Pennsylvania', 'Northeast', 'Large Urban'),
('RI', 'Rhode Island', 'Northeast', 'Small Urban'),
('SC', 'South Carolina', 'Southeast', 'Medium Urban'),
('SD', 'South Dakota', 'Midwest', 'Rural'),
('TN', 'Tennessee', 'Southeast', 'Medium Urban'),
('TX', 'Texas', 'South', 'Large Urban'),
('UT', 'Utah', 'West', 'Medium Urban'),
('VT', 'Vermont', 'Northeast', 'Rural'),
('VA', 'Virginia', 'Southeast', 'Large Urban'),
('WA', 'Washington', 'West', 'Large Urban'),
('WV', 'West Virginia', 'Southeast', 'Rural'),
('WI', 'Wisconsin', 'Midwest', 'Medium Urban'),
('WY', 'Wyoming', 'West', 'Rural');

-- Schema migration record (optional - only if schema_migrations table exists)
-- INSERT OR IGNORE INTO schema_migrations (version, description, applied_at)
-- VALUES ('008_add_report_cards', 'Add monthly report card system tables', CURRENT_TIMESTAMP);
