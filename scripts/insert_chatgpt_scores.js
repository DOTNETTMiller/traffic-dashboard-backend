#!/usr/bin/env node
/**
 * Insert ChatGPT-generated MDODE scores into PostgreSQL database
 *
 * Usage:
 *   railway run node scripts/insert_chatgpt_scores.js [path-to-scores.json]
 *   OR
 *   node scripts/insert_chatgpt_scores.js [path-to-scores.json]  # for local testing
 *
 * The JSON file should contain an array of score objects with all MDODE fields populated.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function insertScores() {
  const scoresPath = process.argv[2] || path.join(__dirname, '../data/chatgpt_responses/scores.json');

  if (!fs.existsSync(scoresPath)) {
    console.error(`❌ File not found: ${scoresPath}`);
    console.error('Usage: node insert_chatgpt_scores.js [path-to-scores.json]');
    console.error('\nExpected JSON format: Array of score objects with MDODE fields');
    process.exit(1);
  }

  let scores;
  try {
    const fileContent = fs.readFileSync(scoresPath, 'utf8');
    scores = JSON.parse(fileContent);

    // Handle both single object and array
    if (!Array.isArray(scores)) {
      scores = [scores];
    }
  } catch (error) {
    console.error('❌ Failed to parse JSON file:', error.message);
    process.exit(1);
  }

  console.log(`📊 Loaded ${scores.length} score(s) from ${scoresPath}`);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    console.error('For Railway: railway run node scripts/insert_chatgpt_scores.js');
    process.exit(1);
  }

  console.log('🐘 Connecting to PostgreSQL database...');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const score of scores) {
      try {
        // Validate required fields
        const requiredFields = ['feed_name', 'service_type', 'provider'];
        const missingFields = requiredFields.filter(field => !score[field]);

        if (missingFields.length > 0) {
          console.error(`❌ Skipping score - missing fields: ${missingFields.join(', ')}`);
          failed++;
          continue;
        }

        // Calculate DQI if not provided
        if (score.dqi === null || score.dqi === undefined) {
          const scores = [
            score.metadata_score,
            score.data_quality_score,
            score.operational_score,
            score.documentation_score,
            score.extensibility_score
          ].filter(s => s !== null && s !== undefined);

          if (scores.length === 5) {
            score.dqi = scores.reduce((a, b) => a + b, 0) / 5;
          }
        }

        // Determine letter grade if not provided
        if (!score.letter_grade || score.letter_grade === 'INCOMPLETE') {
          if (score.dqi >= 90) score.letter_grade = 'A';
          else if (score.dqi >= 80) score.letter_grade = 'B';
          else if (score.dqi >= 70) score.letter_grade = 'C';
          else if (score.dqi >= 60) score.letter_grade = 'D';
          else if (score.dqi !== null) score.letter_grade = 'F';
        }

        console.log(`📝 Processing: ${score.feed_name} (${score.provider})`);

        // Check if score already exists
        const existingResult = await client.query(
          `SELECT id FROM quality_scores
           WHERE feed_name = $1 AND provider = $2`,
          [score.feed_name, score.provider]
        );

        if (existingResult.rows.length > 0) {
          // Update existing score
          await client.query(`
            UPDATE quality_scores SET
              service_type = $1,
              metadata_score = $2,
              data_quality_score = $3,
              operational_score = $4,
              documentation_score = $5,
              extensibility_score = $6,
              dqi = $7,
              letter_grade = $8,
              evaluation_date = $9,
              validation_report_id = $10,
              validation_report_title = $11,
              validation_report_url = $12,
              validation_geography = $13,
              validation_study_period = $14,
              evaluator_notes = $15,
              metadata_notes = $16,
              data_quality_notes = $17,
              operational_notes = $18,
              documentation_notes = $19,
              extensibility_notes = $20,
              updated_at = CURRENT_TIMESTAMP
            WHERE feed_name = $21 AND provider = $22
          `, [
            score.service_type,
            score.metadata_score,
            score.data_quality_score,
            score.operational_score,
            score.documentation_score,
            score.extensibility_score,
            score.dqi,
            score.letter_grade,
            score.evaluation_date || new Date().toISOString().split('T')[0],
            score.validation_report_id,
            score.validation_report_title,
            score.validation_report_url,
            score.validation_geography,
            score.validation_study_period,
            score.evaluator_notes,
            score.metadata_notes,
            score.data_quality_notes,
            score.operational_notes,
            score.documentation_notes,
            score.extensibility_notes,
            score.feed_name,
            score.provider
          ]);

          console.log(`   ✅ Updated existing score (DQI: ${score.dqi?.toFixed(1)}, Grade: ${score.letter_grade})`);
          updated++;
        } else {
          // Insert new score
          await client.query(`
            INSERT INTO quality_scores (
              feed_name, service_type, provider,
              metadata_score, data_quality_score, operational_score,
              documentation_score, extensibility_score,
              dqi, letter_grade, evaluation_date,
              validation_report_id, validation_report_title, validation_report_url,
              validation_geography, validation_study_period,
              evaluator_notes, metadata_notes, data_quality_notes,
              operational_notes, documentation_notes, extensibility_notes
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
              $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
            )
          `, [
            score.feed_name,
            score.service_type,
            score.provider,
            score.metadata_score,
            score.data_quality_score,
            score.operational_score,
            score.documentation_score,
            score.extensibility_score,
            score.dqi,
            score.letter_grade,
            score.evaluation_date || new Date().toISOString().split('T')[0],
            score.validation_report_id,
            score.validation_report_title,
            score.validation_report_url,
            score.validation_geography,
            score.validation_study_period,
            score.evaluator_notes,
            score.metadata_notes,
            score.data_quality_notes,
            score.operational_notes,
            score.documentation_notes,
            score.extensibility_notes
          ]);

          console.log(`   ✅ Inserted new score (DQI: ${score.dqi?.toFixed(1)}, Grade: ${score.letter_grade})`);
          inserted++;
        }

      } catch (error) {
        console.error(`   ❌ Failed to process ${score.feed_name}:`, error.message);
        failed++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Summary:`);
    console.log(`   - Inserted: ${inserted}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Total: ${scores.length}`);

    if (inserted + updated > 0) {
      console.log('\n🔍 Verifying data...');
      const verifyResult = await client.query(`
        SELECT
          COUNT(*) as total_scores,
          COUNT(*) FILTER (WHERE dqi IS NOT NULL) as scored,
          COUNT(*) FILTER (WHERE letter_grade != 'INCOMPLETE') as graded,
          ROUND(AVG(dqi), 2) as avg_dqi
        FROM quality_scores
      `);

      const stats = verifyResult.rows[0];
      console.log(`\n📊 Database Statistics:`);
      console.log(`   - Total scores: ${stats.total_scores}`);
      console.log(`   - Scored feeds: ${stats.scored}`);
      console.log(`   - Graded feeds: ${stats.graded}`);
      console.log(`   - Average DQI: ${stats.avg_dqi || 'N/A'}`);
    }

  } catch (error) {
    console.error('\n❌ Database operation failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🐘 PostgreSQL connection closed');
  }
}

insertScores();
