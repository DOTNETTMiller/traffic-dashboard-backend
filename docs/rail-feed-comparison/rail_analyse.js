/**
 * Which feed is fresher? Decided by observation, not by trusting either timestamp.
 *
 * For every train, walk the samples and find each moment its position CHANGED. A feed that
 * reports a given new position earlier is the one carrying fresher data. Timestamps are
 * reported alongside but are not what the verdict rests on.
 */
const fs = require('fs');
const path = require('path');
const rows = fs.readFileSync(path.join(__dirname, 'rail_samples.jsonl'), 'utf8')
  .trim().split('\n').filter(Boolean).map(JSON.parse);

if (rows.length < 3) { console.log('not enough samples yet:', rows.length); process.exit(0); }

const R = 6371008.8, rad = d => d * Math.PI / 180;
const dM = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const idx = (arr) => { const m = new Map(); for (const x of arr) if (!m.has(x.n)) m.set(x.n, x); return m; };

const span = (rows[rows.length - 1].t - rows[0].t) / 3600000;
console.log(`samples: ${rows.length} over ${span.toFixed(1)}h`);
console.log(`trains per sample — official ${Math.round(rows.reduce((s,r)=>s+r.official.length,0)/rows.length)}, mirror ${Math.round(rows.reduce((s,r)=>s+r.mirror.length,0)/rows.length)}`);

// How often does each feed actually move a train? A feed that updates more often is fresher.
let offMoves = 0, mirMoves = 0, offPairs = 0, mirPairs = 0;
const offStep = [], mirStep = [];
for (let i = 1; i < rows.length; i++) {
  const a = idx(rows[i-1].official), b = idx(rows[i].official);
  for (const [n, cur] of b) { const prev = a.get(n); if (!prev) continue; offPairs++;
    const d = dM(prev, cur); if (d > 50) { offMoves++; offStep.push(d); } }
  const c = idx(rows[i-1].mirror), e = idx(rows[i].mirror);
  for (const [n, cur] of e) { const prev = c.get(n); if (!prev) continue; mirPairs++;
    const d = dM(prev, cur); if (d > 50) { mirMoves++; mirStep.push(d); } }
}
const pct = (a,b) => b ? Math.round(100*a/b) : 0;
const med = a => a.length ? Math.round(a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)]) : null;
console.log(`\nposition updates between consecutive 2-min samples:`);
console.log(`  official: ${offMoves}/${offPairs} (${pct(offMoves,offPairs)}%)  median step ${med(offStep)}m`);
console.log(`  mirror  : ${mirMoves}/${mirPairs} (${pct(mirMoves,mirPairs)}%)  median step ${med(mirStep)}m`);

// Does one feed reach a position the other only reaches LATER? That is the lead/lag test.
let offLeads = 0, mirLeads = 0, tie = 0, compared = 0;
for (let i = 0; i < rows.length; i++) {
  const o = idx(rows[i].official), m = idx(rows[i].mirror);
  for (const [n, ov] of o) {
    const mv = m.get(n); if (!mv) continue;
    if (dM(ov, mv) <= 100) { tie++; compared++; continue; }
    // find which feed's CURRENT position the other reaches in a LATER sample
    let offSeenLater = null, mirSeenLater = null;
    for (let j = i + 1; j < Math.min(i + 8, rows.length); j++) {
      const mj = idx(rows[j].mirror).get(n);
      if (mj && offSeenLater === null && dM(ov, mj) <= 100) offSeenLater = j - i;
      const oj = idx(rows[j].official).get(n);
      if (oj && mirSeenLater === null && dM(mv, oj) <= 100) mirSeenLater = j - i;
    }
    if (offSeenLater !== null && mirSeenLater === null) offLeads++;
    else if (mirSeenLater !== null && offSeenLater === null) mirLeads++;
    compared++;
  }
}
console.log(`\nlead/lag (whose position the other only reaches later):`);
console.log(`  official led : ${offLeads}`);
console.log(`  mirror led   : ${mirLeads}`);
console.log(`  same position: ${tie} of ${compared} comparisons`);
console.log(`\nVERDICT: ${offLeads > mirLeads * 1.5 ? 'official is fresher' : mirLeads > offLeads * 1.5 ? 'mirror is fresher' : 'no clear winner — keep the mirror, it needs no decryption'}`);
