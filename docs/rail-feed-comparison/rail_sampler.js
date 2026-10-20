/**
 * Sample Amtrak's official feed and the Amtraker mirror side by side.
 *
 * The question is which source should drive the projection, and two snapshots gave
 * contradictory answers. Timestamps cannot settle it -- LastValTS has no timezone and
 * unclear semantics. So this measures something unambiguous instead:
 *
 *   for each train, WHEN DOES ITS POSITION CHANGE in each feed?
 *
 * Whichever feed reflects a new position first is the fresher source, regardless of what
 * either claims about its own timestamps.
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'rail_samples.jsonl');
const off = require('/Users/mattmiller/Projects/DOT & Transportation Apps/DOT/DOT Corridor Communicator/services/amtrak-official-feed');

const INTERVAL_MS = 2 * 60 * 1000;      // every 2 min: finer than either feed updates
const RUN_MS = 4 * 60 * 60 * 1000;      // 4 hours

function getJSON(url) {
  return new Promise((res, rej) => {
    require('https').get(url, { timeout: 30000 }, r => {
      let b = ''; r.setEncoding('utf8');
      r.on('data', d => { b += d; });
      r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

async function sample() {
  const t = Date.now();
  let official = [], mirror = [];
  try {
    const o = await off.fetchTrains({ force: true });
    official = (o || []).filter(x => x.trainState === 'Active')
      .map(x => ({ n: x.trainNum, lat: +x.lat.toFixed(5), lon: +x.lon.toFixed(5), ts: x.updatedAt, v: x.velocity }));
  } catch (e) { /* record the gap rather than dying */ }
  try {
    const j = await getJSON('https://api-v3.amtraker.com/v3/trains');
    for (const k of Object.keys(j)) for (const x of j[k]) {
      if (x.trainState === 'Active' && x.lat) {
        mirror.push({ n: String(x.trainNum), lat: +x.lat.toFixed(5), lon: +x.lon.toFixed(5), ts: x.updatedAt, v: x.velocity });
      }
    }
  } catch (e) { /* ditto */ }
  fs.appendFileSync(OUT, JSON.stringify({ t, official, mirror }) + '\n');
  console.log(new Date(t).toISOString(), 'official', official.length, 'mirror', mirror.length);
}

(async () => {
  const stopAt = Date.now() + RUN_MS;
  await sample();
  const timer = setInterval(async () => {
    if (Date.now() >= stopAt) { clearInterval(timer); console.log('sampling complete'); process.exit(0); }
    await sample();
  }, INTERVAL_MS);
})();
