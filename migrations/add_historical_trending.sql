-- Historical Trending & Progress Tracking Schema
-- Phase 5 of "Better than NAPCORE"

-- Store historical DQI snapshots for vendors
CREATE TABLE IF NOT EXISTS vendor_dqi_history (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    provider_name TEXT NOT NULL,
    avg_dqi REAL NOT NULL,
    total_feeds INTEGER NOT NULL,
    corridor_count INTEGER NOT NULL,
    a_grade_count INTEGER NOT NULL,
    consistency_score REAL,
    rank INTEGER,
    letter_grade TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(snapshot_date, provider_name)
);

-- Store historical DQI snapshots for states
CREATE TABLE IF NOT EXISTS state_dqi_history (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    state_abbr TEXT NOT NULL,
    state_name TEXT NOT NULL,
    avg_dqi REAL NOT NULL,
    total_feeds INTEGER NOT NULL,
    corridor_count INTEGER NOT NULL,
    a_grade_count INTEGER NOT NULL,
    consistency_score REAL,
    rank INTEGER,
    letter_grade TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(snapshot_date, state_abbr)
);

-- Store historical DQI snapshots for individual feeds
CREATE TABLE IF NOT EXISTS feed_dqi_history (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    feed_id TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    corridor_id TEXT NOT NULL,
    service_type_id TEXT NOT NULL,
    dqi REAL NOT NULL,
    letter_grade TEXT NOT NULL,
    acc_score REAL,
    cov_score REAL,
    tim_score REAL,
    std_score REAL,
    gov_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(snapshot_date, feed_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_vendor_history_provider ON vendor_dqi_history(provider_name, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_history_date ON vendor_dqi_history(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_state_history_state ON state_dqi_history(state_abbr, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_state_history_date ON state_dqi_history(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_feed_history_feed ON feed_dqi_history(feed_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_feed_history_date ON feed_dqi_history(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_feed_history_provider ON feed_dqi_history(provider_name, snapshot_date DESC);

-- View for latest vendor trends (30-day, 90-day changes)
CREATE OR REPLACE VIEW vendor_trends AS
SELECT
    current.provider_name,
    current.avg_dqi as current_dqi,
    current.rank as current_rank,
    prev_30.avg_dqi as dqi_30_days_ago,
    prev_90.avg_dqi as dqi_90_days_ago,
    (current.avg_dqi - prev_30.avg_dqi) as change_30d,
    (current.avg_dqi - prev_90.avg_dqi) as change_90d,
    (current.rank - prev_30.rank) as rank_change_30d,
    (current.rank - prev_90.rank) as rank_change_90d
FROM
    (SELECT * FROM vendor_dqi_history WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM vendor_dqi_history)) current
LEFT JOIN
    (SELECT provider_name, avg_dqi, rank
     FROM vendor_dqi_history
     WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM vendor_dqi_history WHERE snapshot_date <= CURRENT_DATE - INTERVAL '30 days')
    ) prev_30 ON current.provider_name = prev_30.provider_name
LEFT JOIN
    (SELECT provider_name, avg_dqi, rank
     FROM vendor_dqi_history
     WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM vendor_dqi_history WHERE snapshot_date <= CURRENT_DATE - INTERVAL '90 days')
    ) prev_90 ON current.provider_name = prev_90.provider_name;

-- View for latest state trends
CREATE OR REPLACE VIEW state_trends AS
SELECT
    current.state_abbr,
    current.state_name,
    current.avg_dqi as current_dqi,
    current.rank as current_rank,
    prev_30.avg_dqi as dqi_30_days_ago,
    prev_90.avg_dqi as dqi_90_days_ago,
    (current.avg_dqi - prev_30.avg_dqi) as change_30d,
    (current.avg_dqi - prev_90.avg_dqi) as change_90d,
    (current.rank - prev_30.rank) as rank_change_30d,
    (current.rank - prev_90.rank) as rank_change_90d
FROM
    (SELECT * FROM state_dqi_history WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM state_dqi_history)) current
LEFT JOIN
    (SELECT state_abbr, avg_dqi, rank
     FROM state_dqi_history
     WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM state_dqi_history WHERE snapshot_date <= CURRENT_DATE - INTERVAL '30 days')
    ) prev_30 ON current.state_abbr = prev_30.state_abbr
LEFT JOIN
    (SELECT state_abbr, avg_dqi, rank
     FROM state_dqi_history
     WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM state_dqi_history WHERE snapshot_date <= CURRENT_DATE - INTERVAL '90 days')
    ) prev_90 ON current.state_abbr = prev_90.state_abbr;
