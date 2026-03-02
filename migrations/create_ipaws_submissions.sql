-- IPAWS Submissions Table for Supervisor Approval Workflow

CREATE TABLE IF NOT EXISTS ipaws_submissions (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_data JSONB NOT NULL,
  alert_data JSONB NOT NULL,
  cap_xml TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ipaws_submissions_event_id ON ipaws_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_ipaws_submissions_status ON ipaws_submissions(status);
CREATE INDEX IF NOT EXISTS idx_ipaws_submissions_submitted_at ON ipaws_submissions(submitted_at DESC);
