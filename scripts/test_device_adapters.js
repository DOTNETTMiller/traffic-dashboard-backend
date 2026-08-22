// Smoke-test the multi-state connected-device adapters (services/device-adapters.js).
// Runs every adapter (key-gated ones are skipped unless their env key is set) and
// prints device counts, portable counts, and field coverage so you can see which
// state feeds are live and usable. No writes, no side effects.
//
//   node scripts/test_device_adapters.js            # all no-key states
//   UT_511_KEY=xxx node scripts/test_device_adapters.js   # include Utah, etc.

const { ADAPTERS } = require('../services/device-adapters');

(async () => {
  const rows = [];
  for (const [k, a] of Object.entries(ADAPTERS)) {
    try {
      const t0 = Date.now();
      const devs = await a.run();
      if (devs && devs.skipped) { rows.push([k, a.name, 'skipped', devs.skipped]); continue; }
      const n = devs.length;
      const portable = devs.filter((d) => d.portable).length;
      const route = devs.filter((d) => d.route).length;
      const on = devs.filter((d) => d.mode.displaying).length;
      rows.push([k, a.name, 'ok', `${n} devices | portable:${portable} | route:${route} | on:${on} | ${Date.now() - t0}ms`]);
    } catch (e) {
      rows.push([k, a.name, 'error', e.message]);
    }
  }
  console.log('\nState device adapters:');
  for (const [k, name, status, detail] of rows) {
    const icon = status === 'ok' ? '✅' : status === 'skipped' ? '⏭️ ' : '❌';
    console.log(`  ${icon} ${k.toUpperCase().padEnd(3)} ${name.padEnd(16)} ${detail}`);
  }
  const ok = rows.filter((r) => r[2] === 'ok').length;
  console.log(`\n${ok}/${rows.length} adapters returned live data.`);
  process.exit(0);
})().catch((e) => { console.error('fatal:', e.message); process.exit(1); });
