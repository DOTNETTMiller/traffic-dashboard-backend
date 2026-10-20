/* Offline, synthetic demonstration. No railroad data or partner transmission. */
const TRACK = [[350,330],[350,275],[350,240],[350,180],[400,130],[400,100],[350,85],[350,20]];
const METRES_PER_PIXEL = 10;
const CROSSING_M = 900;
const MAX_AGE_S = 60;
const DIRECT_S = 180, DETOUR_S = 300;
let elapsed = 0, scenario = 'approach', confirmation = null, clockStart = Date.now(), payload;

function pointAt(metres) {
  let remaining = Math.max(0, metres) / METRES_PER_PIXEL;
  for (let i = 1; i < TRACK.length; i++) {
    const a = TRACK[i-1], b = TRACK[i], length = Math.hypot(b[0]-a[0], b[1]-a[1]);
    if (remaining <= length) return [a[0]+(b[0]-a[0])*remaining/length, a[1]+(b[1]-a[1])*remaining/length];
    remaining -= length;
  }
  return TRACK[TRACK.length-1];
}
function calculate(input) {
  const speed = input.speedMph * 0.44704, lengthM = input.lengthFt * 0.3048;
  const currentHeadM = input.headM + speed * input.ageS, currentTailM = currentHeadM-lengthM;
  const fresh = Number.isFinite(input.ageS) && input.ageS >= 0 && input.ageS <= MAX_AGE_S;
  const occupied = fresh && currentHeadM >= CROSSING_M && currentTailM <= CROSSING_M;
  const etaS = fresh && speed > 0 && currentHeadM < CROSSING_M ? (CROSSING_M-currentHeadM)/speed : null;
  const remainingS = occupied && speed >= 1.34 ? (CROSSING_M-currentTailM)/speed : null;
  return { currentHeadM, currentTailM, lengthM, fresh, occupied, etaS, remainingS };
}
function exportEvent(input, projection, now) {
  if (!projection.fresh || input.confirmation === 'clear') return null;
  const confirmed = input.confirmation === 'blocked';
  if (!confirmed && (!projection.occupied || !input.shareEstimates)) return null;
  // Current estimated delay is a soft routing input. Only an observed blockage is BLOCKED.
  const event = {
    crossing_id:'DEMO-CROSSING-001', road_segment_id:'DEMO-ROAD-001',
    status:confirmed?'BLOCKED':'ESTIMATED_DELAY',
    observed_at:new Date(now-input.ageS*1000).toISOString(),
    expires_at:new Date(Math.min(now+30000,now+(MAX_AGE_S-input.ageS)*1000)).toISOString()
  };
  if (Date.parse(event.expires_at) <= now) return null;
  if (!confirmed && projection.remainingS !== null) event.estimated_delay_seconds = Math.ceil(projection.remainingS/30)*30;
  return event;
}
const formatSeconds = value => value === null ? 'Unknown' : `${Math.max(0,Math.round(value))} seconds`;
const formatMinutes = value => `${(value/60).toFixed(1)} min`;
function inputState() {
  return { headM:Number(document.getElementById('head').value), speedMph:Number(document.getElementById('speed').value),
    lengthFt:Number(document.getElementById('length').value), ageS:Number(document.getElementById('age').value)+elapsed,
    shareEstimates:document.getElementById('share-estimates').checked, confirmation,
    train_id:'DEMO-PRIVATE-TRAIN', cargo:'DEMO-PRIVATE-FIELD', direction:'northbound' };
}
function render() {
  const input=inputState(), projection=calculate(input), now=clockStart+elapsed*1000;
  const event=exportEvent(input,projection,now);
  payload={demo:true,generated_at:new Date(now).toISOString(),events:event?[event]:[]};
  const confirmed=event?.status==='BLOCKED', estimate=event?.status==='ESTIMATED_DELAY';
  const detour=confirmed || (estimate && event.estimated_delay_seconds != null && DIRECT_S+event.estimated_delay_seconds>DETOUR_S);
  let status='No current crossing event', note='Private approach estimates stay inside the processor.', state='unknown';
  if (!projection.fresh) { status='Unknown — observation expired';note='Withdraw the old advisory. No open-crossing assertion is made.'; }
  else if (input.confirmation==='clear') { status='Clear observed — event withdrawn';note='The partner closure is removed following a fresh clear observation.';state='clear'; }
  else if (confirmed) { status='Observed blocked';note='An observed road blockage supports a closure instruction and detour.';state='blocked'; }
  else if (estimate) { status='Estimated crossing delay';note=projection.remainingS===null?'The projected train is stopped; clearance time is unknown. Use an advisory, not a hard closure.':'Current projected occupancy supplies a soft delay estimate, not a confirmed closure.';state='estimated'; }
  else if (projection.occupied && !input.shareEstimates) { note='Confirmed-only mode withholds the projection from partners.'; }
  else if (projection.currentTailM>CROSSING_M) { note='The projection has passed the crossing. No closure instruction is retained.'; }
  document.getElementById('status-title').textContent=status;
  document.getElementById('status-note').textContent=note;
  document.getElementById('status').dataset.state=state;
  document.getElementById('partner-feed').textContent=JSON.stringify(payload,null,2);
  document.getElementById('feed-count').textContent=event?'1 current event':'0 current events';
  document.getElementById('route-direct').setAttribute('display',detour?'none':'inline');
  document.getElementById('route-detour').setAttribute('display',detour?'inline':'none');
  document.getElementById('route-detour').setAttribute('stroke',confirmed?'#1f5aa8':'#b7791f');
  document.getElementById('crossing-ring').setAttribute('stroke',confirmed?'#9b1b1b':estimate?'#b7791f':'#54637a');
  document.getElementById('road-impact').setAttribute('display',event?'inline':'none');
  document.getElementById('road-impact').setAttribute('stroke',confirmed?'#9b1b1b':'#b7791f');
  document.getElementById('road-impact').setAttribute('stroke-dasharray',confirmed?'':'5 4');
  const delay=event?.estimated_delay_seconds;
  document.getElementById('direct-time').textContent=confirmed?'Unavailable':formatMinutes(DIRECT_S+(delay||0));
  document.getElementById('detour-time').textContent=formatMinutes(DETOUR_S);
  document.getElementById('route-recommendation').textContent=detour?'Prefer the overpass route':estimate&&delay==null?'Delay duration unknown — partner routing policy applies':event?'Direct route remains faster with the estimated wait':'No current closure instruction; crossing occupancy may be unknown';
  document.getElementById('private-age').textContent=`${Math.round(input.ageS)} s`;
  document.getElementById('private-head').textContent=`${Math.round(projection.currentHeadM)} m`;
  document.getElementById('private-tail').textContent=`${Math.round(projection.currentTailM)} m`;
  document.getElementById('private-arrival').textContent=formatSeconds(projection.etaS);
  document.getElementById('private-clearance').textContent=formatSeconds(projection.remainingS);
  document.getElementById('private-state').textContent=!projection.fresh?'Expired':projection.occupied?'Projected across road':projection.currentHeadM<CROSSING_M?'Approaching':'Projected past crossing';
  const body=[];
  for(let m=Math.max(0,projection.currentTailM);m<projection.currentHeadM;m+=20)body.push(pointAt(m));
  body.push(pointAt(projection.currentHeadM));
  document.getElementById('private-train').setAttribute('d',body.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' '));
  const head=pointAt(projection.currentHeadM);document.getElementById('private-head-marker').setAttribute('cx',head[0]);document.getElementById('private-head-marker').setAttribute('cy',head[1]);
  ['head','speed','length','age'].forEach(id=>document.getElementById(`${id}-value`).textContent=document.getElementById(id).value);
  document.querySelectorAll('[data-scenario]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scenario===scenario)));
}
function chooseScenario(kind) {
  const presets={approach:[400,20,3500,10,null],projected:[1000,15,3500,10,null],confirmed:[1000,15,3500,10,'blocked'],
    clear:[2200,15,3500,0,'clear'],stale:[1000,15,3500,180,null],stopped:[1000,0,3500,10,null]};
  scenario=kind;elapsed=0;clockStart=Date.now();
  const [head,speed,length,age,confirm]=presets[kind];confirmation=confirm;
  Object.entries({head,speed,length,age}).forEach(([id,value])=>document.getElementById(id).value=value);
  render();
}
function chooseView(view) {
  const privateView=view==='private';
  document.getElementById('private-controls').hidden=!privateView;
  document.getElementById('private-metrics').hidden=!privateView;
  document.getElementById('private-graphics').setAttribute('display',privateView?'inline':'none');
  document.getElementById('view-label').textContent=privateView?'Private processor · synthetic inputs':'Mapping partner · crossing-only view';
  document.querySelectorAll('[data-view]').forEach(button=>{const selected=button.dataset.view===view;button.setAttribute('aria-selected',String(selected));button.setAttribute('tabindex',selected?'0':'-1');});
}
document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>chooseScenario(button.dataset.scenario)));
document.querySelectorAll('[data-view]').forEach(button=>{
  button.addEventListener('click',()=>chooseView(button.dataset.view));
  button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const view=button.dataset.view==='private'?'partner':'private';chooseView(view);document.querySelector(`[data-view="${view}"]`).focus();}});
});
['head','speed','length','age'].forEach(id=>document.getElementById(id).addEventListener('input',()=>{confirmation=null;scenario='custom';elapsed=0;clockStart=Date.now();render();}));
document.getElementById('share-estimates').addEventListener('change',render);
document.getElementById('advance').addEventListener('click',()=>{confirmation=null;elapsed+=10;render();});
document.getElementById('reset').addEventListener('click',()=>chooseScenario('approach'));
document.getElementById('download').addEventListener('click',()=>{
  render();const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='CCAI_SAMPLE_Projected_Crossing_Status.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
chooseScenario('projected');chooseView('partner');
