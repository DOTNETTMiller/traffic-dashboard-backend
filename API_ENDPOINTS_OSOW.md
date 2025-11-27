# State OS/OW Regulations API Endpoints

Add these endpoints to `backend_proxy_server.js` after the corridor-regulations endpoint (around line 7850):

```javascript
// ============================================================================
// STATE OS/OW REGULATIONS API
// ============================================================================

/**
 * Get all state OS/OW regulations
 */
app.get('/api/state-osow-regulations', async (req, res) => {
  try {
    const { nascoOnly } = req.query;

    let query = 'SELECT * FROM state_osow_regulations';
    const params = [];

    if (nascoOnly === 'true') {
      query += ' WHERE is_nasco_state = 1';
    }

    query += ' ORDER BY state_name';

    const regulations = db.db.prepare(query).all(...params);

    // Parse JSON fields
    regulations.forEach(reg => {
      if (reg.holiday_restrictions) {
        try {
          reg.holiday_restrictions = JSON.parse(reg.holiday_restrictions);
        } catch (e) {
          reg.holiday_restrictions = [];
        }
      }
      if (reg.permit_cost_data) {
        try {
          reg.permit_cost_data = JSON.parse(reg.permit_cost_data);
        } catch (e) {
          reg.permit_cost_data = {};
        }
      }
      if (reg.nasco_corridor_routes) {
        try {
          reg.nasco_corridor_routes = JSON.parse(reg.nasco_corridor_routes);
        } catch (e) {
          reg.nasco_corridor_routes = [];
        }
      }
    });

    res.json({
      success: true,
      regulations,
      count: regulations.length
    });
  } catch (error) {
    console.error('❌ Get state OS/OW regulations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get specific state OS/OW regulation
 */
app.get('/api/state-osow-regulations/:stateKey', async (req, res) => {
  try {
    const { stateKey } = req.params;

    const regulation = db.db.prepare(`
      SELECT * FROM state_osow_regulations WHERE state_key = ?
    `).get(stateKey.toLowerCase());

    if (!regulation) {
      return res.status(404).json({
        success: false,
        error: `No regulations found for state: ${stateKey}`
      });
    }

    // Parse JSON fields
    if (regulation.holiday_restrictions) {
      try {
        regulation.holiday_restrictions = JSON.parse(regulation.holiday_restrictions);
      } catch (e) {
        regulation.holiday_restrictions = [];
      }
    }
    if (regulation.permit_cost_data) {
      try {
        regulation.permit_cost_data = JSON.parse(regulation.permit_cost_data);
      } catch (e) {
        regulation.permit_cost_data = {};
      }
    }
    if (regulation.nasco_corridor_routes) {
      try {
        regulation.nasco_corridor_routes = JSON.parse(regulation.nasco_corridor_routes);
      } catch (e) {
        regulation.nasco_corridor_routes = [];
      }
    }

    res.json({
      success: true,
      regulation
    });
  } catch (error) {
    console.error('❌ Get state OS/OW regulation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update state OS/OW regulation
 */
app.put('/api/state-osow-regulations/:stateKey', async (req, res) => {
  try {
    const { stateKey } = req.params;
    const updates = req.body;

    // Build update query dynamically
    const allowedFields = [
      'max_length_ft', 'max_width_ft', 'max_height_ft',
      'legal_gvw', 'permitted_single_axle', 'permitted_tandem_axle',
      'permitted_tridem_axle', 'permitted_max_gvw',
      'weekend_travel_allowed', 'night_travel_allowed', 'holiday_restrictions',
      'permit_required_width_ft', 'permit_required_height_ft',
      'permit_required_length_ft', 'permit_required_weight_lbs',
      'permit_cost_data', 'escort_required_width_ft', 'escort_required_height_ft',
      'escort_required_length_ft', 'front_escort', 'rear_escort', 'both_escorts',
      'permit_office_phone', 'permit_office_email', 'permit_portal_url',
      'regulation_url', 'notes'
    ];

    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        // Stringify JSON fields
        if (['holiday_restrictions', 'permit_cost_data', 'nasco_corridor_routes'].includes(key)) {
          values.push(typeof updates[key] === 'string' ? updates[key] : JSON.stringify(updates[key]));
        } else {
          values.push(updates[key]);
        }
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    // Calculate data completeness
    const totalFields = 30; // Approximate number of important fields
    const filledFields = Object.keys(updates).filter(k => updates[k] !== null && updates[k] !== '').length;
    const completeness = Math.round((filledFields / totalFields) * 100);

    fields.push('data_completeness_pct = ?');
    values.push(completeness);

    fields.push('last_verified_date = ?');
    values.push(new Date().toISOString().split('T')[0]);

    fields.push('updated_at = CURRENT_TIMESTAMP');

    values.push(stateKey.toLowerCase());

    const query = `
      UPDATE state_osow_regulations
      SET ${fields.join(', ')}
      WHERE state_key = ?
    `;

    const result = db.db.prepare(query).run(...values);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: `State ${stateKey} not found`
      });
    }

    // Fetch updated record
    const updated = db.db.prepare(`
      SELECT * FROM state_osow_regulations WHERE state_key = ?
    `).get(stateKey.toLowerCase());

    res.json({
      success: true,
      regulation: updated,
      message: `Updated OS/OW regulations for ${stateKey.toUpperCase()}`
    });
  } catch (error) {
    console.error('❌ Update state OS/OW regulation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get NASCO corridor summary
 */
app.get('/api/nasco-corridor-summary', async (req, res) => {
  try {
    const nascoStates = db.db.prepare(`
      SELECT * FROM state_osow_regulations
      WHERE is_nasco_state = 1
      ORDER BY id
    `).all();

    const summary = {
      totalStates: nascoStates.length,
      states: nascoStates.map(s => ({
        stateKey: s.state_key,
        stateName: s.state_name,
        routes: s.nasco_corridor_routes ? JSON.parse(s.nasco_corridor_routes) : [],
        dataComplete: s.data_completeness_pct === 100.0
      })),
      tradeRoute: 'Mexico → Texas → Oklahoma → Kansas → Nebraska → Iowa → Minnesota → Canada'
    };

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('❌ Get NASCO corridor summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

Add these endpoints after line 7850 in backend_proxy_server.js.
