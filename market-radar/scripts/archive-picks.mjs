/**
 * Append-only forward research cohort log for MARKET RADAR.
 * Records what the App REALLY showed on a trade date, before any future price is known.
 * Never rewrites a date that has already been archived.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const ROOT='market-radar/data',OUT=path.join(ROOT,'picks-history');
const isDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''));
const finite=x=>Number.isFinite(x)?x:null;
function makeRecord(picks,market){
 if(!isDay(picks?.asOf)||picks.asOf!==market?.asOf)throw Error('Recommendation and price trade dates differ');
 const spot=new Map((market.rows||[]).map(x=>[x.code,x]));
 const benchmark=spot.get('0050');
 if(!(benchmark?.close>0))throw Error('0050 benchmark close not available; no archive');
 const source=(picks.tracking||[]).filter(x=>x.code&&x.dataChecks?.chip20&&spot.get(x.code)?.close>0);
 if(source.length<5)throw Error('Too few complete historical top-ranked picks; no archive');
 const seen=new Set(),items=[];
 for(const item of source){
  if(seen.has(item.code))continue;seen.add(item.code);
  const listed=spot.get(item.code);
  if(!listed||listed.close<=0)continue;
  items.push({code:item.code,name:item.name||listed.name||item.code,
   rank:Number.isFinite(item.rank)?item.rank:items.length+1,
   sector:item.sector||null,score:finite(item.score),
   components:{institutional:finite(item.scoreComponents?.institutional),
    financial:finite(item.scoreComponents?.financial),
    relativeAction:finite(item.scoreComponents?.relativeAction)},
   close:listed.close,market:listed.market,status:item.status||null,
   sourcePriceDate:listed.date||market.asOf});
 }
 if(items.length<5)throw Error('Fewer than five verified recommendations');
 items.sort((a,b)=>a.rank-b.rank||a.code.localeCompare(b.code));
 return {date:market.asOf,firstCapturedAt:new Date().toISOString(),publishedPicksAt:picks.generatedAt||null,
  benchmark0050:{close:benchmark.close,date:benchmark.date||market.asOf},
  indexPct:finite(market.indices?.[0]?.pct),
  marketBreadth:finite(picks.macro?.marketBreadth),
  sourceDates:picks.sourceDates||null,rule:picks.methodology?.score||null,
  selectedCount:items.length,selected:items,
  note:'Append-only historical research observation. Not a trade or performance claim.'};
}
function test(){
 const m={asOf:'2026-11-17',rows:[{code:'0050',close:94},...Array.from({length:6},(_,i)=>({code:'123'+i,close:70+i,date:'2026-11-17'}))]};
 const p={asOf:'2026-11-17',tracking:Array.from({length:6},(_,i)=>({code:'123'+i,rank:i+1,dataChecks:{chip20:true},score:i}))};
 assert.equal(makeRecord(p,m).selectedCount,6);
 assert.equal(makeRecord(p,m).benchmark0050.close,94);
 assert.throws(()=>makeRecord({...p,asOf:'2026-11-18'},m));
 console.log('APPEND-ONLY SNAPSHOT SELF-TEST PASSED');
}
async function main(){
 const [market,picks]=await Promise.all(['latest.json','picks.json'].map(async n=>JSON.parse(await fs.readFile(path.join(ROOT,n),'utf8'))));
 let record;try{record=makeRecord(picks,market)}catch(e){console.warn('Skipping incomplete forward snapshot: '+e.message);return}
 await fs.mkdir(OUT,{recursive:true});
 const month=record.date.slice(0,7),p=path.join(OUT,month+'.json');
 let prev={schema:1,month,days:[]};
 try{prev=JSON.parse(await fs.readFile(p,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 if(!Array.isArray(prev.days)||prev.month!==month)throw Error('Malformed existing cohort archive '+month);
 if(prev.days.some(x=>x.date===record.date)){
  console.log('Immutable cohort already archived for '+record.date+'; no rewrite');
  return;
 }
 prev.days.push(record);prev.days.sort((a,b)=>a.date.localeCompare(b.date));
 await fs.writeFile(p,JSON.stringify(prev,null,2)+'\n');
 console.log(JSON.stringify({archivedDate:record.date,picks:record.selectedCount,benchmark0050:record.benchmark0050.close}));
}
if(process.argv.includes('--self-test'))test();else await main().catch(e=>{console.error(e);process.exitCode=1});
