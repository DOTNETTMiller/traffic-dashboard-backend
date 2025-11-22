#!/usr/bin/env node

/**
 * Update TETC Scores with Validated Data
 *
 * Replaces existing TETC scores with official validation results from
 * TETC Coalition validation reports.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'traffic_data.db');
const db = new Database(dbPath);

// Validated TETC data from official reports
const validatedVendors = [
  {
    "vendor_name": "AirSage",
    "data_categories": ["Origin-Destination"],
    "scores": {
      "accuracy": 85,
      "coverage": 60,
      "timeliness": 70,
      "standards": 90,
      "governance": 90
    },
    "composite_DQI": 79,
    "letter_grade": "C",
    "confidence_level": "Medium",
    "key_findings": "AirSage's OD data closely matched population-level trip totals from independent surveys, indicating its person-trip modeling is on target. However, AirSage reports only origin-destination pairs that it directly observes, resulting in a sparse OD matrix (only ~16% of possible zone pairs contained trips). The data captured major travel patterns well, but many minor flows are simply not reported due to this conservative approach.",
    "limitations": "Because AirSage only outputs trips for OD pairs with detected movements, smaller or infrequent travel connections may be missing entirely. This approach protects against over-estimating unobserved flows but means coverage is incomplete, especially in rural or low-traffic areas. Additionally, its data is not real-time; analyses are done on historical data, which limits use for real-time monitoring.",
    "recommendation": "AirSage is recommended for regional planning applications where person-trip estimates are needed and an emphasis on data privacy and conservative reporting is valued. Its estimates of total travel demand are reliable at high levels (e.g., matching household survey totals), making it useful for model calibration or validation. However, agencies should be aware of the sparse matrix output – AirSage may omit low-volume connections – and consider supplementing those gaps if a complete OD matrix is required."
  },
  {
    "vendor_name": "Carto",
    "data_categories": ["Travel Time & Speed"],
    "scores": {
      "accuracy": 95,
      "coverage": 95,
      "timeliness": 100,
      "standards": 100,
      "governance": 85
    },
    "composite_DQI": 96,
    "letter_grade": "A",
    "confidence_level": "Medium",
    "key_findings": "Carto's travel time data proved to be highly accurate and responsive. In the Atlanta corridor test, Carto met all accuracy specifications – its speed error metrics were within required thresholds at all times. Notably, Carto excelled in timeliness: it was able to provide real-time traffic data feeds with an average latency around 1.1 minutes (with 95% of latency observations under 3 minutes), the best performance of all vendors.",
    "limitations": "The primary limitation is that Carto's validation to date has been limited to a single corridor and scenario. While results were excellent in this test, Carto is a relatively new entrant, and its performance on a broader network or under different conditions (e.g., arterials, different regions) has not yet been independently validated in Coalition reports.",
    "recommendation": "Carto is recommended for agencies seeking high-quality, real-time travel time data. Its ability to meet stringent accuracy requirements and deliver low-latency speed information makes it well-suited for operational use cases like congestion monitoring and traveler information. Agencies should conduct pilot deployments on their own networks to confirm Carto's performance at scale."
  },
  {
    "vendor_name": "Geotab",
    "data_categories": ["Origin-Destination"],
    "scores": {
      "accuracy": 60,
      "coverage": 40,
      "timeliness": 80,
      "standards": 90,
      "governance": 90
    },
    "composite_DQI": 71,
    "letter_grade": "C",
    "confidence_level": "Low",
    "key_findings": "Geotab's OD product is specialized to commercial freight movements. In the validation, it contributed data for truck trips only, which means it did not reflect the majority of passenger travel. Geotab's OD patterns had minimal overlap with those of other vendors or the household travel survey, underscoring that its data captures a different (freight-specific) segment of travel. Spatially, Geotab covered all zones but only a tiny fraction (~2%) of possible OD pairs had any trips reported – essentially only the freight-intensive connections.",
    "limitations": "The main limitation is the narrow focus: Geotab's data covers only commercial vehicle trips. For general-purpose OD analysis, this leaves huge gaps (most personal travel is not captured). While extremely valuable for freight planning, the data cannot on its own inform passenger travel patterns or total travel demand.",
    "recommendation": "Geotab is recommended for agency use only in the context of freight or commercial vehicle analysis. Agencies looking to understand truck travel patterns, freight origin-destination flows, or to supplement passenger data with freight insights will find Geotab's data useful and reliable. However, it should not be used as a standalone source for comprehensive OD analysis of all traffic."
  },
  {
    "vendor_name": "HERE",
    "data_categories": ["Travel Time & Speed", "Volume"],
    "scores": {
      "accuracy": 90,
      "coverage": 95,
      "timeliness": 70,
      "standards": 80,
      "governance": 95
    },
    "composite_DQI": 86,
    "letter_grade": "B",
    "confidence_level": "High",
    "key_findings": "HERE's data performed very well in both travel time and volume validations. Its travel time data continues to be highly accurate (meeting all error metrics in the test), consistent with its long-standing reputation. In the Georgia volume study, HERE was one of the top performers, passing 7 out of 9 FHWA accuracy/precision benchmarks for AADT and coming close to meeting them all. This indicates HERE's volume estimates have improved substantially and are approaching the accuracy needed for official reporting.",
    "limitations": "The main limitation observed was in data delivery speed and adaptability. HERE's travel time feed was not live during the test, suggesting potential integration or policy constraints for real-time data sharing at that time. In terms of adaptiveness, earlier validations showed HERE's volume model had difficulty with nuanced patterns like weekend versus weekday differences, although recent improvements have been made.",
    "recommendation": "HERE is a dependable choice for agencies in need of both real-time traffic speeds and volume data. Its travel time data is field-proven and suitable for real-time traffic monitoring and traveler information systems (once a real-time feed is confirmed). The volume data has reached a quality level sufficient for many planning and reporting purposes (e.g., AADT estimation)."
  },
  {
    "vendor_name": "INRIX",
    "data_categories": ["Travel Time & Speed", "Volume", "Origin-Destination"],
    "scores": {
      "accuracy": 85,
      "coverage": 95,
      "timeliness": 75,
      "standards": 85,
      "governance": 95
    },
    "composite_DQI": 87,
    "letter_grade": "B",
    "confidence_level": "High",
    "key_findings": "INRIX delivered solid performance across travel time, volume, and OD validations. Its travel time data remains very accurate (meeting all error metrics in the Atlanta test). For origin-destination, INRIX's data closely mirrored patterns from the National Household Travel Survey – its trip distance distributions were among the closest match to NHTS of any vendor, indicating that INRIX's blend of connected vehicle data effectively captures real-world travel behavior.",
    "limitations": "One limitation observed is that INRIX's volume data, while improved, did not meet every accuracy benchmark in the rigorous FHWA test – particularly under some conditions – so agencies should use caution if using INRIX volumes for critical reporting without additional validation. Another limitation was technical: the failure of the real-time feed during the travel time test implies that integration or system issues might arise when pushing live data.",
    "recommendation": "INRIX is a proven, all-around data provider and is recommended for agencies looking for a balanced solution across multiple data types. It offers reliable real-time traffic speed data (with the caveat to ensure technical setup is robust) and reasonably accurate volume and OD information. Agencies can confidently use INRIX for real-time traffic monitoring and traveler information systems."
  },
  {
    "vendor_name": "Iteris",
    "data_categories": ["Travel Time & Speed", "Volume"],
    "scores": {
      "accuracy": 85,
      "coverage": 95,
      "timeliness": 95,
      "standards": 100,
      "governance": 90
    },
    "composite_DQI": 93,
    "letter_grade": "A",
    "confidence_level": "High",
    "key_findings": "Iteris performed at a top-tier level in both validated categories. In the travel time study, Iteris was able to deliver live data as specified, achieving an average latency of about 2.4 minutes for speed updates while maintaining accuracy within all required thresholds. In the volume validation, Iteris's data showed very good alignment with ground truth for moderate and high traffic volumes, and it was one of the vendors capable of detecting atypical volume changes on specific days – a notable strength.",
    "limitations": "Iteris's only notable weakness appeared at very low traffic volumes – the data tended to be less accurate on low-volume roads or locations, occasionally significantly mis-estimating those counts. This suggests that while the model performs well in typical or high-demand scenarios, it may overestimate or otherwise err in sparse traffic conditions.",
    "recommendation": "Iteris is highly recommended for agencies interested in both accurate travel times and the ability to monitor volume patterns with a level of real-time sensitivity. Agencies deploying Iteris data can expect excellent performance on busy corridors and during typical conditions. If monitoring of daily or irregular events (e.g., special events, incidents) is a priority, Iteris's volume product provides an advantage by reflecting those anomalies."
  },
  {
    "vendor_name": "Replica",
    "data_categories": ["Volume", "Origin-Destination"],
    "scores": {
      "accuracy": 75,
      "coverage": 100,
      "timeliness": 60,
      "standards": 90,
      "governance": 80
    },
    "composite_DQI": 81,
    "letter_grade": "B",
    "confidence_level": "Medium",
    "key_findings": "Replica's data offers very high coverage by design – it essentially attempts to populate an OD matrix or volume for every location by modeling travel demand. In the OD validation, Replica was able to output trips for around two-thirds of all possible origin-destination pairs, far exceeding the coverage of data sourced purely from observations. However, the accuracy of these estimates is moderate. Replica's trip totals were higher than those observed in surveys.",
    "limitations": "The principal limitation of Replica is that it is not based on real-time or continuous observation – it's a model. This leads to two concerns: (1) lower fidelity in certain metrics (as seen by the overestimation of total trips and some misalignment with observed patterns), and (2) lack of responsiveness to current conditions (it cannot easily account for unexpected events or rapid shifts without re-running the model).",
    "recommendation": "Replica's data should be used with caution and primarily for planning-level analyses where having a complete picture of travel is more important than pinpoint accuracy on any single flow. It is well-suited for sketch planning, scenario modeling, or as a supplement to fill gaps between observed data points. For real-time operations or performance measurement, Replica is not appropriate due to its lack of timeliness."
  },
  {
    "vendor_name": "StreetLight",
    "data_categories": ["Volume", "Origin-Destination"],
    "scores": {
      "accuracy": 95,
      "coverage": 90,
      "timeliness": 90,
      "standards": 100,
      "governance": 95
    },
    "composite_DQI": 94,
    "letter_grade": "A",
    "confidence_level": "High",
    "key_findings": "StreetLight's data quality was found to be among the best across multiple validation efforts. In volume validation, StreetLight was a top performer – it passed 7 out of 9 accuracy tests for AADT and narrowly missed the remaining two by small margins, indicating that its volume estimates are highly reliable, even approaching the precision of ground counts in most conditions. StreetLight's OD data was also very credible: its patterns of trip lengths and distributions were virtually in line with travel survey data (NHTS).",
    "limitations": "StreetLight's tendency to slightly overestimate certain metrics was observed. In low-volume conditions, StreetLight's volume data showed a bias of overestimation, meaning on very lightly traveled roads it might overshoot actual counts. Another limitation is that StreetLight's OD coverage, while broad, is not total: roughly 60-65% of lesser OD pairs had no trips recorded.",
    "recommendation": "StreetLight is highly recommended for agencies seeking robust, all-purpose data for both planning and certain operational applications. Its accuracy and consistency make it suitable for use in performance measurement, congestion studies, and even for supporting official metrics (like AADT or travel demand model inputs) with minimal calibration. The dynamic nature of StreetLight's volume product also means it can be used to monitor traffic patterns in near-real-time."
  }
];

function generateId(prefix) {
  const crypto = require('crypto');
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}

async function updateValidatedScores() {
  console.log('🔄 Updating TETC scores with validated data from official reports...\n');

  try {
    db.exec('BEGIN TRANSACTION');

    // Delete existing validated evaluations (keep user votes)
    console.log('🗑️  Clearing existing validated evaluations...');
    db.prepare(`
      DELETE FROM vendor_quality_scores
      WHERE evaluation_id IN (
        SELECT id FROM vendor_evaluations
        WHERE evaluator LIKE '%TETC%' OR evaluator LIKE '%Coalition%'
      )
    `).run();

    db.prepare(`
      DELETE FROM vendor_evaluations
      WHERE evaluator LIKE '%TETC%' OR evaluator LIKE '%Coalition%'
    `).run();

    console.log('✅ Existing validated scores cleared\n');

    // Insert validated scores
    console.log('📊 Inserting validated vendor scores...\n');

    for (const vendor of validatedVendors) {
      // Map vendor names to vendor IDs
      const vendorIdMap = {
        'AirSage': 'vendor-airsage',
        'Carto': 'vendor-carto',
        'Geotab': 'vendor-geotab',
        'HERE': 'vendor-here',
        'INRIX': 'vendor-inrix',
        'Iteris': 'vendor-iteris',
        'Replica': 'vendor-replica',
        'StreetLight': 'vendor-streetlight'
      };

      const vendorId = vendorIdMap[vendor.vendor_name];
      if (!vendorId) {
        console.log(`⚠️  Skipping unknown vendor: ${vendor.vendor_name}`);
        continue;
      }

      // Check if vendor exists, if not create it
      const existingVendor = db.prepare('SELECT id FROM tetc_vendors WHERE id = ?').get(vendorId);
      if (!existingVendor) {
        db.prepare(`
          INSERT INTO tetc_vendors (id, vendor_name, vendor_type, data_categories)
          VALUES (?, ?, ?, ?)
        `).run(
          vendorId,
          vendor.vendor_name,
          'tdm_provider',
          JSON.stringify(vendor.data_categories)
        );
      }

      // Create evaluation
      const evalId = generateId('eval');
      db.prepare(`
        INSERT INTO vendor_evaluations (
          id,
          vendor_id,
          evaluation_name,
          evaluation_date,
          evaluator,
          methodology_ref,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        evalId,
        vendorId,
        'TETC Coalition Official Validation',
        '2025-01-15',
        'Eastern Transportation Coalition',
        'https://tetcoalition.org/data-marketplace/validation/',
        `${vendor.key_findings}\n\nLimitations: ${vendor.limitations}\n\nRecommendation: ${vendor.recommendation}`
      );

      // Insert quality scores
      db.prepare(`
        INSERT INTO vendor_quality_scores (
          evaluation_id,
          acc_score,
          cov_score,
          tim_score,
          std_score,
          gov_score,
          dqi,
          letter_grade
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        evalId,
        vendor.scores.accuracy,
        vendor.scores.coverage,
        vendor.scores.timeliness,
        vendor.scores.standards,
        vendor.scores.governance,
        vendor.composite_DQI,
        vendor.letter_grade
      );

      console.log(`✅ ${vendor.vendor_name}: DQI ${vendor.composite_DQI} (${vendor.letter_grade}) - ${vendor.confidence_level} confidence`);
    }

    db.exec('COMMIT');

    console.log('\n✨ Validated TETC scores successfully imported!');
    console.log('\n📈 Summary:');

    const summary = db.prepare(`
      SELECT
        letter_grade,
        COUNT(*) as count
      FROM vendor_quality_scores vqs
      JOIN vendor_evaluations ve ON vqs.evaluation_id = ve.id
      WHERE ve.evaluator LIKE '%Coalition%'
      GROUP BY letter_grade
      ORDER BY letter_grade
    `).all();

    summary.forEach(row => {
      console.log(`   Grade ${row.letter_grade}: ${row.count} vendors`);
    });

    // Verify data
    console.log('\n🔍 Verification:');
    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM vendor_quality_scores vqs
      JOIN vendor_evaluations ve ON vqs.evaluation_id = ve.id
      WHERE ve.evaluator LIKE '%Coalition%'
    `).get();

    console.log(`   ${total.count} validated vendor evaluations inserted`);

  } catch (error) {
    db.exec('ROLLBACK');
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    db.close();
  }
}

updateValidatedScores();
