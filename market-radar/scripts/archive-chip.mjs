/**
 * MARKET RADAR durable history ledger.
 * Keep each month in its own small JSON file. Never truncate months when
 * the UI's rolling series.json is reduced to the most recent 160 sessions.
 * Only already-reported exchange data is preserved. No inferred values.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const dataDir='market-radar/data';
const historyDir=path.join(dataDir,'history');
const short=JSON.parse(await fs.readFile(path.join(dataDir,'series.json'),'utf8'));
if(!Array.isArray(short.days)||short.days.length<1)throw Error('No history days to archive');
await fs.mkdir(historyDir,{recursive:true});
const months=new Map();
for(const day of short.days){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day?.date)||!day.rows||Object.keys(day.rows).length<10)continue;
 const mon=day.date.slice(0,7);
 if(!months.has(mon))months.set(mon,[]);
 months.get(mon).push(day);
}
if(months.size===0)throw Error('History input failed date/coverage checks');
let touched=0;
for(const [month,incoming] of months){
 const name=path.join(historyDir,month+'.json');
 let previous=null;
 try{previous=JSON.parse(await fs.readFile(name,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e}
 if(previous&&!Array.isArray(previous.days))throw Error('Malformed existing archive '+name);
 const byDate=new Map((previous?.days||[]).map(d=>[d.date,d]));
 for(const next of incoming){
  const prior=byDate.get(next.date);
  // Preserve the more complete historical snapshot, rather than replacing it
  // with a partial feed after an exchange API outage.
  const oldValid=prior?Object.values(prior.rows||{}).filter(r=>Number.isFinite(r.foreign)||Number.isFinite(r.trust)).length:0;
  const newValid=Object.values(next.rows||{}).filter(r=>Number.isFinite(r.foreign)||Number.isFinite(r.trust)).length;
  if(!prior||newValid>=oldValid)byDate.set(next.date,next);
 }
 const days=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(days.some(d=>d.date.slice(0,7)!==month))throw Error('Wrong month in '+name);
 const payload={schema:1,month,seededAt:previous?.seededAt||short.generatedAt||new Date().toISOString(),days};
 if(JSON.stringify(previous?.days||[])===JSON.stringify(days))continue;
 await fs.writeFile(name,JSON.stringify(payload)+'\n');
 touched++;
}
console.log(JSON.stringify({archivedMonths:months.size,updatedMonths:touched,latest:short.asOf}));
