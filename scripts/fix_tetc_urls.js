#!/usr/bin/env node

/**
 * Fix TETC Validation Report URLs
 *
 * Updates placeholder example.org URLs to correct tetcoalition.org URLs
 */

const { Client } = require('pg');

async function fixTETCUrls() {
  console.log('🔧 Fixing TETC validation report URLs...\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Update TETC URLs
    const updates = [
      {
        id: 'vr_probe_tt_2025q1',
        url: 'https://tetcoalition.org/data-marketplace/validation/TETC_TT_2025Q1.pdf',
        name: 'TETC TT Speed Validation'
      },
      {
        id: 'vr_od_personal_2025q1',
        url: 'https://tetcoalition.org/data-marketplace/validation/OD_Personal_2025Q1.pdf',
        name: 'OD Personal Validation'
      },
      {
        id: 'vr_od_freight_2025q1',
        url: 'https://tetcoalition.org/data-marketplace/validation/OD_Freight_2025Q1.pdf',
        name: 'OD Freight Validation'
      },
      {
        id: 'vr_i95_corr_probe_inrix_2025q1',
        url: 'https://tetcoalition.org/data-marketplace/validation/2025Q1_I95_INRIX.pdf',
        name: 'TETC I-95 INRIX Validation'
      },
      {
        id: 'vr_i95_corr_probe_here_2025q1',
        url: 'https://tetcoalition.org/data-marketplace/validation/2025Q1_I95_HERE.pdf',
        name: 'TETC I-95 HERE Validation'
      },
      {
        id: 'vr_i95_corr_od_personal_replica_2025q1',
        url: 'https://tetcoalition.org/data-marketplace/validation/2025Q1_I95_Replica.pdf',
        name: 'TETC I-95 Replica OD Validation'
      },
      {
        id: 'vr_i95_corr_od_personal_streetlight_2025q1',
        url: 'https://tetcoalition.org/data-marketplace/validation/2025Q1_I95_StreetLight.pdf',
        name: 'TETC I-95 StreetLight Validation'
      },
      {
        id: 'vr_i95_corr_od_freight_atri_2025q1',
        url: 'https://tetcoalition.org/data-marketplace/validation/2025Q1_I95_ATRI.pdf',
        name: 'TETC I-95 ATRI Freight Validation'
      }
    ];

    for (const update of updates) {
      const result = await client.query(
        'UPDATE validation_runs SET methodology_ref = $1 WHERE id = $2 RETURNING id',
        [update.url, update.id]
      );

      if (result.rowCount > 0) {
        console.log(`✅ Updated ${update.name}`);
        console.log(`   ${update.url}\n`);
      } else {
        console.log(`⚠️  Record not found: ${update.id}\n`);
      }
    }

    // Verify updates
    console.log('🔍 Verifying updates...\n');
    const verify = await client.query(`
      SELECT id, run_name, methodology_ref
      FROM validation_runs
      WHERE methodology_ref IS NOT NULL
      ORDER BY id
    `);

    console.log(`📊 Found ${verify.rows.length} validation runs with methodology references:\n`);
    verify.rows.forEach(row => {
      console.log(`   ${row.run_name}`);
      console.log(`   → ${row.methodology_ref}\n`);
    });

    console.log('✨ TETC URL fix complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixTETCUrls();
