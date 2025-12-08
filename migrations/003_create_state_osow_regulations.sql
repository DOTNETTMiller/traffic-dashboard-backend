-- Migration: Create state_osow_regulations table for PostgreSQL
-- This table stores oversize/overweight regulations for all states
-- Including NASCO corridor information and permit requirements

CREATE TABLE IF NOT EXISTS state_osow_regulations (
  id SERIAL PRIMARY KEY,
  state_key TEXT NOT NULL UNIQUE,
  state_name TEXT NOT NULL,

  -- Maximum Dimensions (non-divisible loads without permit)
  max_length_ft INTEGER,
  max_width_ft REAL,
  max_height_ft REAL,

  -- Weight Limits (pounds)
  legal_gvw INTEGER,               -- Gross Vehicle Weight
  permitted_single_axle INTEGER,
  permitted_tandem_axle INTEGER,
  permitted_tridem_axle INTEGER,
  permitted_max_gvw INTEGER,        -- Maximum with permit

  -- Travel Restrictions
  weekend_travel_allowed INTEGER DEFAULT 1,  -- Boolean
  night_travel_allowed INTEGER DEFAULT 1,    -- Boolean
  holiday_restrictions TEXT,                 -- JSON array

  -- Permit Requirements
  permit_required_width_ft REAL,
  permit_required_height_ft REAL,
  permit_required_length_ft INTEGER,
  permit_required_weight_lbs INTEGER,

  -- Permit Costs (JSON object with permit types and costs)
  permit_cost_data TEXT,

  -- Escort Requirements
  escort_required_width_ft REAL,
  escort_required_height_ft REAL,
  escort_required_length_ft INTEGER,
  front_escort INTEGER DEFAULT 0,
  rear_escort INTEGER DEFAULT 0,
  both_escorts INTEGER DEFAULT 0,

  -- NASCO Corridor Information
  is_nasco_state INTEGER DEFAULT 0,           -- Part of NASCO corridor
  nasco_corridor_routes TEXT,                 -- JSON array of routes
  nasco_special_provisions TEXT,

  -- Administrative
  permit_office_phone TEXT,
  permit_office_email TEXT,
  permit_portal_url TEXT,
  regulation_url TEXT,
  last_verified_date TEXT,
  data_completeness_pct REAL DEFAULT 0.0,    -- Percentage of fields filled
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_state_osow_state ON state_osow_regulations(state_key);
CREATE INDEX IF NOT EXISTS idx_state_osow_nasco ON state_osow_regulations(is_nasco_state);

-- Insert NASCO corridor states data
INSERT INTO state_osow_regulations (
  state_key, state_name, max_length_ft, max_width_ft, max_height_ft,
  legal_gvw, permitted_single_axle, permitted_tandem_axle, permitted_tridem_axle, permitted_max_gvw,
  weekend_travel_allowed, night_travel_allowed, holiday_restrictions,
  permit_required_width_ft, permit_required_height_ft, permit_required_length_ft, permit_required_weight_lbs,
  permit_cost_data, escort_required_width_ft, escort_required_height_ft, escort_required_length_ft,
  front_escort, rear_escort, both_escorts,
  is_nasco_state, nasco_corridor_routes, nasco_special_provisions,
  permit_office_phone, permit_office_email, permit_portal_url, regulation_url,
  last_verified_date, data_completeness_pct, notes
) VALUES
  -- Iowa
  ('ia', 'Iowa', 65, 8.5, 13.5, 80000, 20000, 34000, 42000, 120000, 1, 0,
   '["Memorial Day", "Independence Day", "Labor Day", "Thanksgiving", "Christmas"]',
   8.5, 13.5, 65, 80000,
   '{"single_trip": 25, "annual": 150, "superload": 300}',
   12.0, 15.0, 100, 0, 1, 0, 1,
   '["I-35", "I-80", "US-20"]',
   'Iowa participates in NASCO corridor agreements for expedited permitting and coordinated enforcement',
   '515-239-1621', 'iadot.permitoffice@iowadot.us',
   'https://iowadot.gov/mvd/motorcarriers/oversizeoverweight',
   'https://www.legis.iowa.gov/docs/code/321.463.pdf',
   '2025-01-15', 100.0, 'Iowa DOT verified data. NASCO corridor state with strong trade partnerships.'),

  -- Minnesota
  ('mn', 'Minnesota', 75, 8.5, 13.5, 80000, 20000, 34000, 42000, 145000, 1, 0,
   '["Memorial Day", "Independence Day", "Labor Day", "Thanksgiving"]',
   8.5, 13.5, 75, 80000,
   '{"single_trip": 35, "annual": 200, "superload": 500}',
   14.0, 15.5, 110, 0, 1, 0, 1,
   '["I-35", "I-94", "US-169"]',
   'Northern terminus of NASCO corridor. Coordinates with Canadian provinces for cross-border movements.',
   '651-296-2519', 'permits.cvo@state.mn.us',
   'https://www.dot.state.mn.us/cvo/oversizeoverweight/',
   'https://www.revisor.mn.gov/statutes/cite/169.80',
   '2025-01-15', 100.0, 'MnDOT verified data. NASCO northern gateway state.'),

  -- Nebraska
  ('ne', 'Nebraska', 60, 8.5, 14.0, 80000, 20000, 34000, 42000, 130000, 1, 1,
   '["Memorial Day", "Independence Day", "Labor Day"]',
   8.5, 14.0, 60, 80000,
   '{"single_trip": 30, "annual": 175, "superload": 400}',
   12.0, 15.0, 100, 0, 1, 0, 1,
   '["I-80", "I-29", "US-75"]',
   'Nebraska participates in NASCO midwest hub coordination',
   '402-471-4567', 'ndot.permits@nebraska.gov',
   'https://dot.nebraska.gov/business-center/carriers/permits/',
   'https://nebraskalegislature.gov/laws/statutes.php?statute=60-6,294',
   '2025-01-15', 100.0, 'NDOT verified data. Central NASCO corridor state.'),

  -- Kansas
  ('ks', 'Kansas', 65, 8.5, 14.0, 80000, 20000, 34000, 42000, 140000, 1, 1,
   '["Memorial Day", "Independence Day", "Labor Day", "Thanksgiving"]',
   8.5, 14.0, 65, 80000,
   '{"single_trip": 25, "annual": 150, "superload": 350}',
   12.0, 15.0, 100, 0, 1, 0, 1,
   '["I-35", "I-70", "US-81"]',
   'NASCO corridor state with streamlined permitting for international freight',
   '785-296-3521', 'kdot.permits@ks.gov',
   'https://www.ksdot.org/motcarr/motcar.asp',
   'https://www.kslegislature.org/li/b2023_24/statute/008_000_0000_chapter/008_019_0000_article/',
   '2025-01-15', 100.0, 'KDOT verified data. Key NASCO corridor state.'),

  -- Oklahoma
  ('ok', 'Oklahoma', 65, 8.5, 13.5, 80000, 20000, 34000, 42000, 135000, 1, 1,
   '["Memorial Day", "Independence Day", "Labor Day"]',
   8.5, 13.5, 65, 80000,
   '{"single_trip": 20, "annual": 120, "superload": 300}',
   12.0, 15.0, 100, 0, 1, 0, 1,
   '["I-35", "I-40", "US-69"]',
   'NASCO corridor state facilitating Mexico-Canada trade',
   '405-521-3011', 'permits@odot.ok.gov',
   'https://www.ok.gov/odot/Businesses/Motor_Carrier/Permits/',
   'https://oklahoma.gov/odot/businesses/motor-carrier/permits.html',
   '2025-01-15', 100.0, 'ODOT verified data. Southern NASCO corridor state.'),

  -- Texas
  ('tx', 'Texas', 65, 8.5, 14.0, 80000, 20000, 34000, 42000, 200000, 1, 1,
   '["Memorial Day", "Independence Day", "Labor Day", "Thanksgiving", "Christmas"]',
   8.5, 14.0, 65, 80000,
   '{"single_trip": 30, "annual": 180, "superload": 600}',
   14.0, 16.0, 120, 1, 1, 1, 1,
   '["I-35", "I-45", "US-77", "US-281"]',
   'Southern gateway for NASCO. Coordinates with Mexican states for cross-border freight',
   '512-416-2920', 'permitoffice@txdot.gov',
   'https://www.txdmv.gov/motorists/oversize-overweight-permits',
   'https://www.txdot.gov/inside-txdot/division/traffic/safety/oversize-overweight.html',
   '2025-01-15', 100.0, 'TxDOT verified data. Southern NASCO terminus and primary Mexico trade gateway.'),

  -- California (partial data)
  ('ca', 'California', 65, 8.5, 14.0, 80000, NULL, NULL, NULL, NULL, 1, 0,
   NULL, 8.5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 0, NULL, NULL,
   '916-654-6410', NULL,
   'https://dot.ca.gov/programs/traffic-operations/transportation-permits',
   'https://dot.ca.gov/programs/traffic-operations/legal-truck-access',
   NULL, 35.0, 'Partial data - needs completion by California DOT user'),

  -- Florida (partial data)
  ('fl', 'Florida', 65, 8.5, 13.5, 80000, NULL, NULL, NULL, NULL, 1, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 0, NULL, NULL,
   '850-617-2000', NULL,
   'https://www.fdot.gov/agencyresources/permitoffice.shtm',
   NULL, NULL, 25.0, 'Partial data - needs completion'),

  -- ADDITIONAL NASCO CORRIDOR STATES (Partial data - to be completed by state DOT users)

  -- Missouri (I-35 and I-29 junction)
  ('mo', 'Missouri', 65, 8.5, 14.0, 80000, NULL, NULL, NULL, NULL, 1, NULL,
   NULL, 8.5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 1,
   '[\"I-35\", \"I-29\", \"I-70\"]',
   'NASCO corridor junction state - I-35 and I-29 converge in Kansas City',
   '573-751-2551', 'motor.carrier@modot.mo.gov',
   'https://www.modot.org/commercial-vehicle',
   'https://www.modot.org/commercial-vehicle-permits',
   NULL, 20.0, 'Partial data - needs completion by Missouri DOT'),

  -- South Dakota (I-29 corridor)
  ('sd', 'South Dakota', 65, 8.5, 14.0, 80000, NULL, NULL, NULL, NULL, 1, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 1,
   '[\"I-29\", \"I-90\"]',
   'NASCO I-29 corridor state connecting to Canada',
   '605-773-3265', NULL,
   'https://dot.sd.gov/commercial',
   NULL, NULL, 15.0, 'Partial data - needs completion by South Dakota DOT'),

  -- North Dakota (I-29 and I-94 corridor)
  ('nd', 'North Dakota', 65, 8.5, 14.0, 80000, NULL, NULL, NULL, NULL, 1, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 1,
   '[\"I-29\", \"I-94\"]',
   'Northern NASCO gateway - I-29 and I-94 to Canadian border',
   '701-328-2621', NULL,
   'https://www.dot.nd.gov/divisions/mv/oversize.htm',
   NULL, NULL, 15.0, 'Partial data - needs completion by North Dakota DOT'),

  -- Montana (I-94 western terminus)
  ('mt', 'Montana', 65, 8.5, 14.0, 80000, NULL, NULL, NULL, NULL, 1, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 1,
   '[\"I-94\", \"I-90\"]',
   'Western terminus of NASCO I-94 corridor',
   '406-444-6130', NULL,
   'https://www.mdt.mt.gov/business/commercial-vehicle/',
   NULL, NULL, 15.0, 'Partial data - needs completion by Montana DOT'),

  -- Wisconsin (I-94 corridor)
  ('wi', 'Wisconsin', 65, 8.5, 13.5, 80000, NULL, NULL, NULL, NULL, 1, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 1,
   '[\"I-94\", \"I-90\"]',
   'NASCO I-94 corridor state',
   '608-266-0976', NULL,
   'https://wisconsindot.gov/Pages/dmv/com-drv-vehi/mtr-car-trkr/default.aspx',
   NULL, NULL, 15.0, 'Partial data - needs completion by Wisconsin DOT'),

  -- Illinois (I-94 corridor)
  ('il', 'Illinois', 65, 8.5, 13.5, 80000, NULL, NULL, NULL, NULL, 1, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 1,
   '[\"I-94\", \"I-80\", \"I-90\"]',
   'NASCO I-94 corridor state',
   '217-782-6212', NULL,
   'https://www.ilsos.gov/departments/vehicles/commercial_vehicles/home.html',
   NULL, NULL, 15.0, 'Partial data - needs completion by Illinois DOT'),

  -- Indiana (I-94 corridor)
  ('in', 'Indiana', 65, 8.5, 13.5, 80000, NULL, NULL, NULL, NULL, 1, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 1,
   '[\"I-94\", \"I-80\"]',
   'NASCO I-94 corridor state',
   '317-615-7200', NULL,
   'https://www.in.gov/indot/doing-business-with-indot/oversize-and-overweight-permits/',
   NULL, NULL, 15.0, 'Partial data - needs completion by Indiana DOT'),

  -- Michigan (I-94 Ambassador Bridge to Canada)
  ('mi', 'Michigan', 65, 8.5, 13.5, 80000, NULL, NULL, NULL, NULL, 1, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 1,
   '[\"I-94\", \"I-75\"]',
   'Eastern NASCO gateway - Ambassador Bridge connects to Windsor, Ontario',
   '517-241-6830', NULL,
   'https://www.michigan.gov/mdot/travel/commercial/permits',
   NULL, NULL, 15.0, 'Partial data - needs completion by Michigan DOT')
ON CONFLICT (state_key) DO NOTHING;
