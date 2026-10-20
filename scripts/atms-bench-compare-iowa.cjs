'use strict';
// Compares a read-only bench report against Iowa DOT's public DMS_View feed for
// the same sign. DMS_View publishes the sign's raw NTCIP MULTI string, so the
// controller readback and the public feed should agree exactly. Agreement is
// independent corroboration that the inspected controller is the named sign.
const fs = require('node:fs');
const { fetchIowaDevices } = require('../services/device-ingest');

// DMS_View HTML-escapes the MULTI string; a controller holds the raw characters.
const unescapeFeed = s => String(s || '').replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]);
// Strip MULTI tags and whitespace so a formatting-only difference is reported
// separately from a different message.
const plain = multi => String(multi || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

async function main() {
  const [reportPath, signId] = process.argv.slice(2);
  if (!reportPath || !signId) throw new Error('Use <bench-report.json> "<DMS_View sign id, e.g. I-80 EB @ Morningstar - SM>".');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (report.result !== 'observed' || !report.observation) throw new Error('The bench report has no controller observation to compare.');
  // DMS_View drops connections under load; retry before reporting a failure.
  let signs;
  for (let attempt = 1; !signs; attempt++) {
    try { signs = await fetchIowaDevices({ all: true }); }
    catch (error) { if (attempt === 3) throw error; await new Promise(r => setTimeout(r, 2000 * attempt)); }
  }
  const sign = signs.find(d => d.id === signId);
  if (!sign) throw new Error(`No DMS_View sign named "${signId}". Names must match the feed exactly.`);
  const controller = report.observation.multi || '';
  const feed = unescapeFeed(sign.ntcip);
  const ageS = Math.round((Date.parse(report.observation.observedAt) - Date.parse(sign.updated)) / 1000);
  const verdict = controller === feed ? 'exact-match'
    : plain(controller) === plain(feed) ? 'text-match-formatting-differs'
    : 'different';
  console.log(JSON.stringify({
    verdict, sign: sign.id, route: sign.route, direction: sign.direction,
    controllerMulti: controller, feedMulti: feed,
    controllerObservedAt: report.observation.observedAt, feedUpdatedAt: sign.updated,
    secondsBetween: ageS,
    note: verdict === 'different' && Math.abs(ageS) > 300
      ? 'Feed and controller were read more than 5 minutes apart; the message may have changed. Re-read both together.'
      : undefined
  }, null, 2));
  if (verdict === 'different') process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
