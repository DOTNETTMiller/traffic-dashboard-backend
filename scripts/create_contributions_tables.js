const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createContributionsTables() {
  console.log('🔨 Creating community contributions tables...\n');

  try {
    // Community contributions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS community_contributions (
        id SERIAL PRIMARY KEY,
        contribution_type TEXT NOT NULL,
        state_code TEXT,
        feed_url TEXT,
        feed_name TEXT,
        feed_description TEXT,
        contact_email TEXT,
        contact_name TEXT,
        submitter_ip TEXT,
        status TEXT DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        reviewed_by TEXT
      );
    `);
    console.log('✅ Created community_contributions table');

    // Coverage gap votes table - users can vote on priority
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gap_priority_votes (
        id SERIAL PRIMARY KEY,
        state_code TEXT NOT NULL,
        corridor_id TEXT,
        voter_ip TEXT NOT NULL,
        vote_weight INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(state_code, voter_ip)
      );
    `);
    console.log('✅ Created gap_priority_votes table');

    // Implementation status tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS implementation_status (
        id SERIAL PRIMARY KEY,
        state_code TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'not_started',
        priority_score INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT NOW(),
        notes TEXT
      );
    `);
    console.log('✅ Created implementation_status table');

    // Insert initial status for all 50 states
    const states = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];

    for (const state of states) {
      await pool.query(`
        INSERT INTO implementation_status (state_code, status, notes)
        VALUES ($1, 'not_started', 'Awaiting community contribution')
        ON CONFLICT (state_code) DO NOTHING
      `, [state]);
    }
    console.log('✅ Initialized implementation status for 50 states');

    console.log('\n✅ All community contribution tables created successfully!');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  createContributionsTables()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { createContributionsTables };
