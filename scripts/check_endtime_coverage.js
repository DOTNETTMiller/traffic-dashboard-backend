#!/usr/bin/env node

/**
 * Check end time coverage across all configured states
 */

const axios = require('axios');
const db = require('../database.js');

async function checkEndTimeCoverage() {
  console.log('📊 Checking end time coverage across all states...\n');

  try {
    await db.init();
    const states = await db.getAllStates(false);

    console.log(`Found ${states.length} configured states\n`);

    const results = [];
    let totalEvents = 0;
    let totalWithEndTime = 0;

    for (const state of states) {
      try {
        // Fetch events for this state
        const response = await axios.get(`http://localhost:3001/api/events/${state.stateKey}`, {
          timeout: 10000
        });

        const events = response.data.events || [];
        const withEndTime = events.filter(e => e.endTime).length;
        const coverage = events.length > 0 ? Math.round((withEndTime / events.length) * 100) : 0;

        totalEvents += events.length;
        totalWithEndTime += withEndTime;

        results.push({
          state: state.stateName,
          stateKey: state.stateKey,
          apiType: state.apiType,
          format: state.format,
          totalEvents: events.length,
          withEndTime,
          coverage,
          sampleEndTime: events.find(e => e.endTime)?.endTime || null
        });

        console.log(`✓ ${state.stateName.padEnd(20)} ${events.length.toString().padStart(4)} events, ${withEndTime.toString().padStart(4)} with end time (${coverage}%)`);
      } catch (error) {
        console.log(`✗ ${state.stateName.padEnd(20)} Error: ${error.message}`);
        results.push({
          state: state.stateName,
          stateKey: state.stateKey,
          apiType: state.apiType,
          format: state.format,
          totalEvents: 0,
          withEndTime: 0,
          coverage: 0,
          error: error.message
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📈 SUMMARY BY API TYPE\n');

    // Group by API type
    const byApiType = {};
    results.forEach(r => {
      if (!r.error) {
        const type = r.apiType || 'Unknown';
        if (!byApiType[type]) {
          byApiType[type] = { total: 0, withEndTime: 0, states: [] };
        }
        byApiType[type].total += r.totalEvents;
        byApiType[type].withEndTime += r.withEndTime;
        byApiType[type].states.push(r.state);
      }
    });

    Object.entries(byApiType).forEach(([type, data]) => {
      const coverage = data.total > 0 ? Math.round((data.withEndTime / data.total) * 100) : 0;
      console.log(`${type.padEnd(15)} ${data.total.toString().padStart(5)} events, ${data.withEndTime.toString().padStart(5)} with end time (${coverage}%)`);
      console.log(`  States: ${data.states.join(', ')}`);
    });

    const overallCoverage = totalEvents > 0 ? Math.round((totalWithEndTime / totalEvents) * 100) : 0;
    console.log('\n' + '='.repeat(80));
    console.log(`📊 OVERALL: ${totalEvents} total events, ${totalWithEndTime} with end time (${overallCoverage}%)`);

    // Show states with good coverage (>70%)
    console.log('\n✅ States with GOOD end time coverage (>70%):');
    results
      .filter(r => !r.error && r.coverage >= 70)
      .sort((a, b) => b.coverage - a.coverage)
      .forEach(r => {
        console.log(`   ${r.state.padEnd(20)} ${r.coverage}% (${r.withEndTime}/${r.totalEvents})`);
      });

    // Show states with poor coverage (<40%)
    console.log('\n⚠️  States with POOR end time coverage (<40%):');
    results
      .filter(r => !r.error && r.totalEvents > 0 && r.coverage < 40)
      .sort((a, b) => a.coverage - b.coverage)
      .forEach(r => {
        console.log(`   ${r.state.padEnd(20)} ${r.coverage}% (${r.withEndTime}/${r.totalEvents})`);
      });

    // Sample end time formats
    console.log('\n📝 Sample end time formats:');
    const samples = results
      .filter(r => r.sampleEndTime)
      .slice(0, 5);
    samples.forEach(r => {
      console.log(`   ${r.state.padEnd(20)} ${r.sampleEndTime}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  checkEndTimeCoverage()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { checkEndTimeCoverage };
