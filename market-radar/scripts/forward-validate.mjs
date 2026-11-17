/**
 * Prospective out-of-sample evaluation of what MARKET RADAR actually published.
 * Unlike retrospective rankings, these immutable daily cohorts cannot select
 * winners after their future return is already known.
 *
 * At each completed trading date T:
 * - use first trading date after T close as the entry reference
 * - compare its close with close 5/20/60 more trading sessions later
 * - account for stock vs ETF round-trip estimated trading costs
 * - refuse incomplete corporate price panels rather than selecting survivors
 *
 * Overlapping daily cohorts are correlated, never compound them as a portfolio.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const ROOT='market-radar/data',HORIZONS=[5,20,60];
const pct=x=>Math.round(x*100000)/1000;
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const median=xs=>{const a=[...xs].sort((a,b)=>a-b),n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2};
async function readMonths(dir){
 let names=[];try{names=(await fs.readdir(dir)).filter(x=>/^\d{4}-\d{2}\.json$/.test(x)).sort()}catch(e){if(e.code!=='ENOENT')throw e}
 const entries=[];
 for(const name of names){
  const o=JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));
  if(!Array.isArray(o.days))throw Error('Malformed month: '+name);
  for(const d of o.days)if(d.date?.startsWith(name.slice(0,7)))entries.push(d);
 }
 return entries;
}
function realizedSnapshot(rec,sessionDays,byDate,h){
 const signal=byDate.get(rec.date);
 if(!signal)return {status:'pending',reason:'signal date not archived yet'};
 const index=sessionDays.indexOf(rec.date),entryDate=sessionDays[index+1],exitDate=sessionDays[index+1+h];
 if(!entryDate||!exitDate)return {status:'pending',reason:'future horizon not yet finished'};
 const entry=byDate.get(entryDate),exit=byDate.get(exitDate);
 const benchmarkEnter=entry.benchmark0050?.close,benchmarkExit=exit.benchmark0050?.close;
 if(!(benchmarkEnter>0)||!(benchmarkExit>0))return {status:'incomplete',reason:'0050 daily close missing',signalDate:rec.date,entryDate,exitDate};
 const selected=rec.selected||[];
 if(selected.length<5)return {status:'incomplete',reason:'fewer than five historical selected names',signalDate:rec.date};
 const misses=[],hold=[];
 for(const s of selected){
  const p0=entry.rows?.[s.code]?.close,p1=exit.rows?.[s.code]?.close;
  if(!(p0>0)||!(p1>0)){misses.push(s.code);continue;}
  hold.push({code:s.code,rank:s.rank,score:s.score,returnPct:pct(p1/p0-1)});
 }
 if(misses.length)return {status:'incomplete',reason:'stock price missing; cohort excluded to avoid cherry picking',missing:misses,signalDate:rec.date,entryDate,exitDate};
 const gross=mean(hold.map(x=>x.returnPct))/100,stockRoundTrip=0.001425+0.004425;
 const etfGross=benchmarkExit/benchmarkEnter-1,etfCost=0.001425+0.002425;
 const stockNet=gross-stockRoundTrip,etfNet=etfGross-etfCost;
 const top=hold.filter(x=>x.rank<=5),bottom=hold.filter(x=>x.rank>5);
 return {status:'complete',signalDate:rec.date,entryDate,exitDate,
  selectedCount:hold.length,stockGrossPct:pct(gross),stockNetPct:pct(stockNet),
  etf0050GrossPct:pct(etfGross),etf0050NetPct:pct(etfNet),
  excessNetPpt:pct(stockNet-etfNet),positive:stockNet>0,beatBenchmark:stockNet>etfNet,
  topHalfGrossPct:top.length?pct(mean(top.map(x=>x.returnPct))/100):null,
  bottomHalfGrossPct:bottom.length?pct(mean(bottom.map(x=>x.returnPct))/100):null,
  rankGapPpt:top.length&&bottom.length?pct((mean(top.map(x=>x.returnPct))-mean(bottom.map(x=>x.returnPct)))/100):null};
}
function summarize(rows){
 if(!rows.length)return {completedCohorts:0,meanStockNetPct:null,mean0050NetPct:null,meanExcessNetPpt:null,
  positiveRatePct:null,beat0050RatePct:null,meanTopBottomSpreadPpt:null,firstSignal:null,lastSignal:null};
 const vals=rows.map(x=>x.stockNetPct),bench=rows.map(x=>x.etf0050NetPct),excess=rows.map(x=>x.excessNetPpt);
 const spread=rows.map(x=>x.rankGapPpt).filter(Number.isFinite);
 return {completedCohorts:rows.length,meanStockNetPct:pct(mean(vals)/100),medianStockNetPct:pct(median(vals)/100),
  mean0050NetPct:pct(mean(bench)/100),meanExcessNetPpt:pct(mean(excess)/100),
  positiveRatePct:Math.round(rows.filter(x=>x.positive).length/rows.length*1000)/10,
  beat0050RatePct:Math.round(rows.filter(x=>x.beatBenchmark).length/rows.length*1000)/10,
  meanTopBottomSpreadPpt:spread.length?pct(mean(spread)/100):null,
  firstSignal:rows[0].signalDate,lastSignal:rows.at(-1).signalDate};
}
function unitTests(){
 const stocks=Array.from({length:6},(_,i)=>({code:'23'+String(i).padStart(2,'0'),rank:i+1,score:90-i}));
 const dates=['2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-23','2026-11-24','2026-11-25'];
 const by=new Map(dates.map((date,index)=>[date,{date,benchmark0050:{close:100+index},rows:Object.fromEntries(stocks.map(z=>[z.code,{close:50+index+Number(z.code.slice(-1))}]))}]));
 const r=realizedSnapshot({date:dates[0],selected:stocks},dates,by,5);
 assert.equal(r.status,'complete');assert.equal(r.entryDate,dates[1]);assert.equal(r.exitDate,dates[6]);assert.equal(r.selectedCount,6);
 const waiting=realizedSnapshot({date:dates[4],selected:stocks},dates,by,5);
 assert.equal(waiting.status,'pending');
 const bad=new Map(by);bad.set(dates[6],{date:dates[6],benchmark0050:{close:106},rows:{}});
 assert.equal(realizedSnapshot({date:dates[0],selected:stocks},dates,bad,5).status,'incomplete');
 console.log('PROSPECTIVE SELF-TEST PASSED: horizon, fills, incomplete-panel guard');
}
async function main(){
 const history=await readMonths(path.join(ROOT,'history')),cohorts=await readMonths(path.join(ROOT,'picks-history'));
 if(!history.length)throw Error('No durable price history');
 const byDate=new Map(history.map(d=>[d.date,d])),sessionDays=[...byDate.keys()].sort();
 const records=[...new Map(cohorts.map(x=>[x.date,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(!records.length)throw Error('No prospective selection snapshots archived');
 const out={schema:1,status:'collecting',generatedAt:new Date().toISOString(),asOf:sessionDays.at(-1),
  firstRecordedSignal:records[0].date,lastRecordedSignal:records.at(-1).date,
  observations:records.length,horizons:{},recentCompletions:{},
  methodology:{signal:'App actual after-close picks stored before future outcomes',
   entry:'next trading session close',exit:'5/20/60 trading sessions after entry close',
   weights:'equally weighted, names fixed per cohort',
   costs:'estimated stock round-trip 0.585%, ETF round-trip 0.385% before broker discount',
   selection:'exclude all incomplete cohorts with explicit missing reason; do not replace missing prices with zero or survivors',
   samples:'daily cohorts overlap; cohort averages are not independent samples nor compoundable portfolio returns',
   adjustment:'cash dividends, corporate actions, intraday execution and slippage omitted'},
  warnings:['Requires prospective data after first logged recommendation date',
   'No Sharpe or statistical significance is published until sufficient independent history',
   'Being selected by an App is a research observation, not an executed order']};
 for(const h of HORIZONS){
  const all=records.map(x=>realizedSnapshot(x,sessionDays,byDate,h));
  const good=all.filter(x=>x.status==='complete'),pending=all.filter(x=>x.status==='pending'),bad=all.filter(x=>x.status==='incomplete');
  out.horizons[String(h)]={...summarize(good),pendingCohorts:pending.length,incompleteCohorts:bad.length,
   recentIncomplete:bad.slice(-5),latestCompleted:good.at(-1)?.signalDate||null};
  out.recentCompletions[String(h)]=good.slice(-30);
 }
 if(HORIZONS.some(h=>out.horizons[String(h)].completedCohorts>0))out.status='partially_evaluated';
 await fs.writeFile(ROOT+'/forward-validation.json',JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify({asOf:out.asOf,snapshots:records.length,
  horizons:Object.fromEntries(HORIZONS.map(h=>[h,out.horizons[String(h)].completedCohorts]))}));
}
if(process.argv.includes('--self-test'))unitTests();else await main().catch(e=>{console.error('FORWARD VALIDATION FAILED:',e);process.exitCode=1});
