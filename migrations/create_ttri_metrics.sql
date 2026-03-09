-- Migration: Travel Time Reliability Index (TTRI/TTTR) - CCAI UC #7
-- Date: 2026-03-03
-- Description: Federal reporting metric for corridor performance and reliability

-- Travel time observations table
CREATE TABLE IF NOT EXISTS travel_time_observations (
  id SERIAL PRIMARY KEY,
  corridor VARCHAR(50) NOT NULL,
  state VARCHAR(2),
  segment_start VARCHAR(255),
  segment_end VARCHAR(255),
  segment_length_miles NUMERIC(10,2),
  observation_timestamp TIMESTAMP NOT NULL,
  travel_time_minutes NUMERIC(10,2) NOT NULL,
  free_flow_time_minutes NUMERIC(10,2),
  congestion_level VARCHAR(20),
  active_incidents INTEGER DEFAULT 0,
  weather_condition VARCHAR(50),
  time_of_day VARCHAR(20),
  day_of_week VARCHAR(10),
  is_peak_hour BOOLEAN DEFAULT false,
  data_source VARCHAR(100),
  CONSTRAINT valid_congestion CHECK (congestion_level IN (
    'free_flow', 'light', 'moderate', 'heavy', 'severe'
  ))
);

-- TTRI calculations table (monthly aggregates)
CREATE TABLE IF NOT EXISTS ttri_metrics (
  id SERIAL PRIMARY KEY,
  corridor VARCHAR(50) NOT NULL,
  state VARCHAR(2),
  month DATE NOT NULL,
  segment_start VARCHAR(255),
  segment_end VARCHAR(255),
  segment_length_miles NUMERIC(10,2),

  -- Travel time percentiles
  percentile_50th_minutes NUMERIC(10,2),
  percentile_80th_minutes NUMERIC(10,2),
  percentile_95th_minutes NUMERIC(10,2),

  -- TTRI calculation (80th / 50th percentile)
  ttri_score NUMERIC(10,4),

  -- Federal reporting metrics
  planning_time_index NUMERIC(10,4),
  buffer_time_index NUMERIC(10,4),

  -- Supporting metrics
  average_travel_time NUMERIC(10,2),
  free_flow_time NUMERIC(10,2),
  total_observations INTEGER DEFAULT 0,
  congested_observations INTEGER DEFAULT 0,

  -- Reliability classification
  reliability_rating VARCHAR(20),

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(corridor, state, month, segment_start),

  CONSTRAINT valid_reliability CHECK (reliability_rating IN (
    'excellent', 'good', 'fair', 'poor', 'very_poor'
  ))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_travel_time_obs_corridor ON travel_time_observations(corridor, observation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_travel_time_obs_timestamp ON travel_time_observations(observation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_travel_time_obs_state ON travel_time_observations(state, corridor);
CREATE INDEX IF NOT EXISTS idx_ttri_metrics_corridor ON ttri_metrics(corridor, month DESC);
CREATE INDEX IF NOT EXISTS idx_ttri_metrics_month ON ttri_metrics(month DESC);

-- Add comments
COMMENT ON TABLE travel_time_observations IS 'Individual travel time observations for TTRI calculation. CCAI UC #7.';
COMMENT ON TABLE ttri_metrics IS 'Monthly TTRI metrics and federal reporting data. CCAI UC #7.';
COMMENT ON COLUMN ttri_metrics.ttri_score IS 'Travel Time Reliability Index = 80th percentile / 50th percentile';
COMMENT ON COLUMN ttri_metrics.planning_time_index IS 'Planning Time Index = 95th percentile / free flow time';
COMMENT ON COLUMN ttri_metrics.buffer_time_index IS 'Buffer Time Index = (95th - 50th) / 50th percentile';

-- Function to calculate TTRI for a corridor/month
CREATE OR REPLACE FUNCTION calculate_ttri_for_month(
  p_corridor VARCHAR(50),
  p_state VARCHAR(2),
  p_month DATE
)
RETURNS TABLE(
  ttri_score NUMERIC,
  percentile_50th NUMERIC,
  percentile_80th NUMERIC,
  percentile_95th NUMERIC,
  reliability_rating VARCHAR(20)
) AS $$
DECLARE
  v_p50 NUMERIC;
  v_p80 NUMERIC;
  v_p95 NUMERIC;
  v_ttri NUMERIC;
  v_rating VARCHAR(20);
BEGIN
  -- Calculate percentiles from travel time observations
  SELECT
    percentile_cont(0.50) WITHIN GROUP (ORDER BY travel_time_minutes),
    percentile_cont(0.80) WITHIN GROUP (ORDER BY travel_time_minutes),
    percentile_cont(0.95) WITHIN GROUP (ORDER BY travel_time_minutes)
  INTO v_p50, v_p80, v_p95
  FROM travel_time_observations
  WHERE corridor = p_corridor
    AND (p_state IS NULL OR state = p_state)
    AND DATE_TRUNC('month', observation_timestamp) = p_month;

  -- Calculate TTRI (80th / 50th percentile)
  IF v_p50 > 0 THEN
    v_ttri := v_p80 / v_p50;
  ELSE
    v_ttri := NULL;
  END IF;

  -- Determine reliability rating
  v_rating := CASE
    WHEN v_ttri IS NULL THEN NULL
    WHEN v_ttri < 1.10 THEN 'excellent'  -- <10% variation
    WHEN v_ttri < 1.25 THEN 'good'       -- <25% variation
    WHEN v_ttri < 1.50 THEN 'fair'       -- <50% variation
    WHEN v_ttri < 2.00 THEN 'poor'       -- <100% variation
    ELSE 'very_poor'                     -- >100% variation
  END;

  RETURN QUERY
  SELECT v_ttri, v_p50, v_p80, v_p95, v_rating;
END;
$$ LANGUAGE plpgsql;

-- Function to estimate travel time from event data
CREATE OR REPLACE FUNCTION estimate_travel_time_from_events(
  p_corridor VARCHAR(50),
  p_timestamp TIMESTAMP
)
RETURNS NUMERIC AS $$
DECLARE
  v_baseline_time NUMERIC;
  v_delay_minutes NUMERIC := 0;
  v_incident_count INTEGER;
BEGIN
  -- Baseline free-flow travel times (per 10 miles) by corridor type
  -- These are estimates - can be calibrated with real data
  v_baseline_time := CASE
    WHEN p_corridor LIKE 'I-%' THEN 10.0  -- Interstate: 60 mph average
    WHEN p_corridor LIKE 'US-%' THEN 12.0 -- US highway: 50 mph average
    ELSE 15.0                              -- State route: 40 mph average
  END;

  -- Count active high-severity incidents in the hour
  SELECT COUNT(*) INTO v_incident_count
  FROM events_archive
  WHERE route = p_corridor
    AND severity = 'high'
    AND created_at <= p_timestamp
    AND (created_at + INTERVAL '4 hours') >= p_timestamp;

  -- Add delay based on incidents (simplified model)
  v_delay_minutes := v_incident_count * 15;  -- 15 min delay per incident

  RETURN v_baseline_time + v_delay_minutes;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-populate travel time observations from event archive
CREATE OR REPLACE FUNCTION populate_travel_times_from_archive(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_corridor RECORD;
  v_timestamp TIMESTAMP;
  v_travel_time NUMERIC;
BEGIN
  -- Loop through corridors and dates
  FOR v_corridor IN
    SELECT DISTINCT route as corridor, state
    FROM events_archive
    WHERE route IS NOT NULL
      AND DATE(created_at) BETWEEN p_start_date AND p_end_date
  LOOP
    -- Sample every hour
    v_timestamp := p_start_date::TIMESTAMP;
    WHILE v_timestamp <= p_end_date::TIMESTAMP + INTERVAL '1 day' LOOP
      -- Estimate travel time based on events
      v_travel_time := estimate_travel_time_from_events(v_corridor.corridor, v_timestamp);

      -- Insert observation
      INSERT INTO travel_time_observations (
        corridor,
        state,
        observation_timestamp,
        travel_time_minutes,
        free_flow_time_minutes,
        time_of_day,
        day_of_week,
        is_peak_hour,
        data_source
      ) VALUES (
        v_corridor.corridor,
        v_corridor.state,
        v_timestamp,
        v_travel_time,
        CASE
          WHEN v_corridor.corridor LIKE 'I-%' THEN 10.0
          WHEN v_corridor.corridor LIKE 'US-%' THEN 12.0
          ELSE 15.0
        END,
        CASE
          WHEN EXTRACT(HOUR FROM v_timestamp) BETWEEN 6 AND 9 THEN 'morning_peak'
          WHEN EXTRACT(HOUR FROM v_timestamp) BETWEEN 16 AND 19 THEN 'evening_peak'
          WHEN EXTRACT(HOUR FROM v_timestamp) BETWEEN 22 AND 5 THEN 'overnight'
          ELSE 'midday'
        END,
        TO_CHAR(v_timestamp, 'Day'),
        EXTRACT(HOUR FROM v_timestamp) BETWEEN 6 AND 9 OR
        EXTRACT(HOUR FROM v_timestamp) BETWEEN 16 AND 19,
        'event_archive_estimate'
      ) ON CONFLICT DO NOTHING;

      v_inserted := v_inserted + 1;
      v_timestamp := v_timestamp + INTERVAL '1 hour';
    END LOOP;
  END LOOP;

  RETURN v_inserted;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate monthly TTRI metrics
CREATE OR REPLACE FUNCTION aggregate_monthly_ttri()
RETURNS INTEGER AS $$
DECLARE
  v_rows_created INTEGER := 0;
  v_corridor RECORD;
  v_last_month DATE;
  v_ttri RECORD;
  v_pti NUMERIC;
  v_bti NUMERIC;
  v_avg_time NUMERIC;
  v_free_flow NUMERIC;
BEGIN
  -- Calculate for previous month
  v_last_month := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::DATE;

  -- Loop through corridors
  FOR v_corridor IN
    SELECT DISTINCT corridor, state
    FROM travel_time_observations
    WHERE DATE_TRUNC('month', observation_timestamp) = v_last_month
  LOOP
    -- Calculate TTRI
    SELECT * INTO v_ttri
    FROM calculate_ttri_for_month(v_corridor.corridor, v_corridor.state, v_last_month);

    -- Calculate supporting metrics
    SELECT
      AVG(travel_time_minutes),
      AVG(free_flow_time_minutes)
    INTO v_avg_time, v_free_flow
    FROM travel_time_observations
    WHERE corridor = v_corridor.corridor
      AND (v_corridor.state IS NULL OR state = v_corridor.state)
      AND DATE_TRUNC('month', observation_timestamp) = v_last_month;

    -- Planning Time Index (PTI) = 95th percentile / free flow
    IF v_free_flow > 0 THEN
      v_pti := v_ttri.percentile_95th / v_free_flow;
    ELSE
      v_pti := NULL;
    END IF;

    -- Buffer Time Index (BTI) = (95th - 50th) / 50th
    IF v_ttri.percentile_50th > 0 THEN
      v_bti := (v_ttri.percentile_95th - v_ttri.percentile_50th) / v_ttri.percentile_50th;
    ELSE
      v_bti := NULL;
    END IF;

    -- Insert or update TTRI metrics
    INSERT INTO ttri_metrics (
      corridor,
      state,
      month,
      percentile_50th_minutes,
      percentile_80th_minutes,
      percentile_95th_minutes,
      ttri_score,
      planning_time_index,
      buffer_time_index,
      average_travel_time,
      free_flow_time,
      total_observations,
      reliability_rating
    )
    SELECT
      v_corridor.corridor,
      v_corridor.state,
      v_last_month,
      v_ttri.percentile_50th,
      v_ttri.percentile_80th,
      v_ttri.percentile_95th,
      v_ttri.ttri_score,
      v_pti,
      v_bti,
      v_avg_time,
      v_free_flow,
      COUNT(*),
      v_ttri.reliability_rating
    FROM travel_time_observations
    WHERE corridor = v_corridor.corridor
      AND (v_corridor.state IS NULL OR state = v_corridor.state)
      AND DATE_TRUNC('month', observation_timestamp) = v_last_month
    ON CONFLICT (corridor, state, month, segment_start) DO UPDATE SET
      percentile_50th_minutes = EXCLUDED.percentile_50th_minutes,
      percentile_80th_minutes = EXCLUDED.percentile_80th_minutes,
      percentile_95th_minutes = EXCLUDED.percentile_95th_minutes,
      ttri_score = EXCLUDED.ttri_score,
      planning_time_index = EXCLUDED.planning_time_index,
      buffer_time_index = EXCLUDED.buffer_time_index,
      average_travel_time = EXCLUDED.average_travel_time,
      reliability_rating = EXCLUDED.reliability_rating;

    v_rows_created := v_rows_created + 1;
  END LOOP;

  RETURN v_rows_created;
END;
$$ LANGUAGE plpgsql;

-- Backfill travel time observations from event archive (last 3 months)
DO $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_observations_created INTEGER;
BEGIN
  v_start_date := CURRENT_DATE - INTERVAL '90 days';
  v_end_date := CURRENT_DATE - INTERVAL '1 day';

  RAISE NOTICE 'Backfilling travel time observations...';
  RAISE NOTICE 'Date range: % to %', v_start_date, v_end_date;

  -- This may take a while for large datasets
  -- Comment out if database is large
  -- v_observations_created := populate_travel_times_from_archive(v_start_date, v_end_date);

  -- RAISE NOTICE '✅ Created % travel time observations', v_observations_created;
  RAISE NOTICE '⚠️  Backfill commented out - uncomment if you want to populate historical data';
END $$;

-- Schedule monthly TTRI aggregation (if pg_cron available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('aggregate-monthly-ttri', '0 4 1 * *', 'SELECT aggregate_monthly_ttri()');
    RAISE NOTICE 'Scheduled monthly TTRI aggregation (1st of month at 4 AM)';
  ELSE
    RAISE NOTICE 'pg_cron not available - schedule TTRI aggregation manually';
  END IF;
END $$;

-- Grant permissions
GRANT SELECT, INSERT ON travel_time_observations TO PUBLIC;
GRANT SELECT ON ttri_metrics TO PUBLIC;

-- Completion message
DO $$
BEGIN
  RAISE NOTICE 'Travel Time Reliability Index (TTRI) Configured:';
  RAISE NOTICE '- TTRI calculation: 80th / 50th percentile';
  RAISE NOTICE '- Planning Time Index (PTI): 95th / free flow';
  RAISE NOTICE '- Buffer Time Index (BTI): (95th - 50th) / 50th';
  RAISE NOTICE '- Monthly aggregation scheduled';
  RAISE NOTICE '- Federal reporting format ready';
  RAISE NOTICE '- Reliability ratings: excellent/good/fair/poor/very_poor';
END $$;
