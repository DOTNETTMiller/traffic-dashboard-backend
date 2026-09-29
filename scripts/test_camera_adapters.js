/**
 * Live probe of every camera adapter — which public camera feeds still answer.
 * Mirrors scripts/test_device_adapters.js. Run: node scripts/test_camera_adapters.js
 */
const { ADAPTERS } = require('../services/camera-adapters');
(async () => {
  const names = Object.keys(ADAPTERS);
  console.log('State camera adapters:');
  let live = 0, total = 0;
  for (const n of names) {
    const t = Date.now();
    try {
      const r = await ADAPTERS[n]();
      const c = Array.isArray(r) ? r.length : 0;
      total += c; if (c) live++;
      console.log(`  ${c ? '✅' : '⚠️ '} ${n.toUpperCase().padEnd(3)} ${String(c).padStart(5)} cameras | ${Date.now() - t}ms`);
    } catch (e) {
      console.log(`  ❌ ${n.toUpperCase().padEnd(3)} ${String(e.message).slice(0, 70)}`);
    }
  }
  console.log(`\n${live}/${names.length} camera adapters returned data — ${total} cameras total`);
})();
