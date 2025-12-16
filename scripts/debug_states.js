#!/usr/bin/env node

const db = require('../database');

(async () => {
  try {
    console.log('🔍 Initializing database...');
    await db.init();

    console.log('\n📊 Getting all states from getAllStates()...');
    const allStates = await db.getAllStates(true);
    console.log(`Total states returned: ${allStates.length}`);

    console.log('\n🔍 Looking for TX and OK:');
    const txok = allStates.filter(s => s.stateKey === 'tx' || s.stateKey === 'ok');
    console.log(`Found ${txok.length} matching states:`);
    txok.forEach(s => {
      console.log(`  ${s.stateKey}: ${s.stateName} - ${s.apiType} - ${s.apiUrl.substring(0, 60)}...`);
    });

    console.log('\n📋 All state keys:');
    console.log(allStates.map(s => s.stateKey).sort().join(', '));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
