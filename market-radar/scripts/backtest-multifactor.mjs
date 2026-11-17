/**
 * MARKET RADAR historical multi-factor score/ablation study.
 * Rebuilds actual past weekly signal dates using archived Taiwan public data.
 * The engine approximates the App's 45/35/20 scores; news, macro and consensus
 * EPS are NOT backtested. Survivorship and financial vintage bias remain.
 *
 * Run from repository root:
 *   node market-radar/scripts/backtest-multifactor.mjs --self-test
 *   node market-radar/scripts/backtest-multifactor.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const ROOT='market-radar/data';
const CACHE='market-radar/.backtest-cache/multifactor';
const RAW='https://raw.githubusercontent.com/joy40217/TWSE-daily/main/data/';
const START='2026-09-04';
const STRATS=['chip','fundamental','relative','full','noChip','noFundamental','noRelative','fullDiv'];
const num=x=>x===undefined||x===null||String(x).trim()===''?null:
  Number.isFinite(Number(String(x).replaceAll(',','')))?Number(String(x).replaceAll(',','')):null;
const round=(x,n=3)=>Number.isFinite(x)?Number(x.toFixed(n)):null;
const assertDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x));
function csv(input){
 const data=String(input).replace(/^\uFEFF/,'');
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<data.length;i++){
  const c=data[i];
  if(c==='"'){if(quoted&&data[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(value);value='';}
  else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&data[i+1]==='\n')i++;row.push(value);if(row.length>1)rows.push(row);row=[];value='';}
  else value+=c;
 }
 if(row.length||value){row.push(value);rows.push(row);}
 if(!rows.length)throw Error('Empty CSV archive');
 const headers=rows.shift().map(x=>x.replace(/^\uFEFF/,''));
 return rows.map(row=>Object.fromEntries(headers.map((k,i)=>[k,row[i]??''])));
}
function pubDate(raw){
 const s=String(raw??'').replace(/\D/g,'');
 if(s.length===7)return String(Number(s.slice(0,3))+1911)+'-'+s.slice(3,5)+'-'+s.slice(5);
 if(s.length===8)return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6);
 return null;
}
function monthKey(iso,offset){
 const dt=new Date(iso.slice(0,7)+'-01T00:00:00Z');
 dt.setUTCMonth(dt.getUTCMonth()+offset);
 return dt.toISOString().slice(0,7);
}
function fallbackRevenueDate(month){return monthKey(month+'-01',1)+'-18';}
function fiscalQuarter(signal){
 const cutoff=new Date(signal+'T00:00:00Z').getTime();
 const year=Number(signal.slice(0,4));
 for(let y=year;y>=year-2;y--)for(let q=4;q>=1;q--){
  const quarterEnd=Date.UTC(y,q*3,0);
  const conservativePublished=quarterEnd+55*86400000;
  if(conservativePublished<=cutoff)return String(y)+'Q'+q;
 }
 return null;
}
function weeklyMonday(iso){
 const d=new Date(iso+'T00:00:00Z');
 d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 return d.toISOString().slice(0,10);
}
function calendarDays(days){
 const m=new Map();
 for(const x of days){const mon=weeklyMonday(x.date);const arr=m.get(mon)||[];arr.push(x.date);m.set(mon,arr);}
 return [...m].sort((a,b)=>a[0].localeCompare(b[0])).map(([week,v])=>({week,first:v[0],last:v.at(-1)}));
}
async function remoteText(dataset,filename){
 const dest=path.join(CACHE,dataset,filename);
 try{const b=await fs.readFile(dest,'utf8');if(b.length>100)return b;}catch{}
 const url=RAW+dataset+'/'+filename;
 let last;
 for(let i=0;i<4;i++){
  try{
   const resp=await fetch(url,{signal:AbortSignal.timeout(32000),headers:{'user-agent':'MarketRadarHistoricalBacktest/1.0'}});
   if(!resp.ok)throw Error('archive HTTP '+resp.status+' '+url);
   const content=await resp.text();
   if(content.length<100)throw Error('Suspiciously short archive '+url);
   await fs.mkdir(path.dirname(dest),{recursive:true});
   await fs.writeFile(dest,content,'utf8');
   return content;
  }catch(e){last=e;await new Promise(r=>setTimeout(r,600*(i+1)));}
 }
 throw Error('archive unavailable after retries: '+String(last));
}
async function mapLimit(items,limit,fn){
 const out=new Array(items.length);let next=0;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(next<items.length){const i=next++;out[i]=await fn(items[i]);}
 }));
 return out;
}
async function readChipArchive(){
 const dir=path.join(ROOT,'history'),list=(await fs.readdir(dir)).filter(x=>/^\d{4}-\d{2}\.json$/.test(x)).sort();
 if(!list.length)throw Error('Monthly chip archive is missing');
 const byDate=new Map();
 for(const name of list){
  const o=JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));
  if(!Array.isArray(o.days))throw Error('Malformed chip archive '+name);
  for(const x of o.days){
   if(assertDate(x.date)&&x.date.startsWith(name.slice(0,7))&&x.rows){
    const existing=byDate.get(x.date);
    if(!existing||Object.keys(x.rows).length>Object.keys(existing.rows).length)byDate.set(x.date,x);
   }
  }
 }
 const days=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(days.length<65)throw Error('Need at least 65 archived trading sessions');
 return days;
}
function priceMap(rows){
 const map={};
 for(const r of rows){
  const code=String(r.Code??'').trim(),close=num(r.ClosingPrice),delta=num(r.Change);
  if(!/^\d{4}$/.test(code)||close===null||close<=0)continue;
  map[code]={close,pct:delta!==null&&close-delta>0?100*delta/(close-delta):null,value:num(r.TradeValue)};
 }
 return map;
}
function revenueMap(rows){
 const map={};
 for(const r of rows){
  const code=String(r['公司代號']??'').trim();
  if(!/^\d{4}$/.test(code))continue;
  map[code]={yoy:num(r['營業收入-去年同月增減(%)']),mom:num(r['營業收入-上月比較增減(%)']),
   sector:String(r['產業別']||'未分類'),publishDate:pubDate(r['出表日期'])};
 }
 return map;
}
function earningsMap(rows){
 const m={};const first=(r,fields)=>{for(const k of fields){const v=num(r[k]);if(v!==null)return v}return null};
 for(const r of rows){
  const code=String(r['公司代號']??'').trim();
  if(!/^\d{4}$/.test(code))continue;
  const rev=first(r,['營業收入','收益']),op=first(r,['營業利益（損失）','營業利益']),
    gross=first(r,['營業毛利（毛損）淨額','營業毛利（毛損）']);
  m[code]={eps:first(r,['基本每股盈餘（元）']),
   opMargin:rev>0&&op!==null?op/rev*100:null,
   grossMargin:rev>0&&gross!==null?gross/rev*100:null};
 }
 return m;
}
function rolling(history,code,index,count,field){
 if(index<count-1)return null;
 let net=0,buys=0;
 for(let i=index-count+1;i<=index;i++){
  const z=history[i].rows?.[code]?.[field];
  if(!Number.isFinite(z))return null;
  net+=z;buys+=z>0?1:0;
 }
 return {net,buys};
}
function monthlyAt(signal,code,revenue){
 for(let offset=-1;offset>=-4;offset--){
  const month=monthKey(signal,offset),row=revenue[month]?.[code];
  if(!row||row.yoy===null)continue;
  if((row.publishDate||fallbackRevenueDate(month))<=signal)return {...row,month};
 }
 return null;
}
function rank(list,field){return [...list].sort((a,b)=>b[field]-a[field]||a.code.localeCompare(b.code));}
function candidates(signal,history,price,revenue,earnings){
 const i=history.findIndex(x=>x.date===signal),day=price[signal];
 if(i<59||!day)throw Error('Insufficient 60-day history for '+signal);
 const proxy=day['0050']?.pct;
 if(!Number.isFinite(proxy))throw Error('0050 market proxy missing for '+signal);
 const q=fiscalQuarter(signal),qFinancial=earnings[q];
 if(!qFinancial)throw Error('Missing quarter '+q+' for signal '+signal);
 const all=[];
 for(const [code,r] of Object.entries(day)){
  if(!history[i].rows?.[code]||!Number.isFinite(r.pct))continue;
  const f20=rolling(history,code,i,20,'foreign'),t20=rolling(history,code,i,20,'trust');
  if(!f20||!t20)continue;
  const f60=rolling(history,code,i,60,'foreign'),t60=rolling(history,code,i,60,'trust'),t5=rolling(history,code,i,5,'trust');
  const rev=monthlyAt(signal,code,revenue),qf=qFinancial[code];
  if(!rev||qf?.eps===null||qf?.eps===undefined)continue;
  const chip=(t20.net>0?11:0)+(f20.net>0?8:0)+(t60?.net>0?7:0)+(f60?.net>0?5:0)+(t20.buys>=14?7:0)+(f20.buys>=13?4:0)+(t5?.net>0?3:0);
  const fundamental=(rev.yoy>=25?14:rev.yoy>=10?9:rev.yoy>=0?4:0)+
    (rev.mom>0&&rev.yoy>5?3:0)+(qf.eps>0?9:0)+
    (qf.opMargin>10?6:qf.opMargin>0?3:0)+(qf.grossMargin>20?3:0);
  const excess=r.pct-proxy;
  const relative=(r.value>=50000000?6:0)+(excess>=3?9:excess>=1?6:excess>=0?3:0)+(r.pct>=0?5:0);
  all.push({code,sector:rev.sector,revenueMonth:rev.month,chip,fundamental,relative,
   full:chip+fundamental+relative,noChip:fundamental+relative,
   noFundamental:chip+relative,noRelative:chip+fundamental});
 }
 return all;
}
function pick(c){
 if(c.length<75)throw Error('Insufficient qualified candidates '+c.length);
 const picks={};for(const k of STRATS.filter(x=>x!=='fullDiv'))picks[k]=rank(c,k).slice(0,10).map(x=>x.code);
 const industries=new Map();picks.fullDiv=[];
 for(const row of rank(c,'full')){
  if((industries.get(row.sector)||0)>=2)continue;
  industries.set(row.sector,(industries.get(row.sector)||0)+1);
  picks.fullDiv.push(row.code);if(picks.fullDiv.length===10)break;
 }
 if(Object.values(picks).some(a=>a.length!==10))throw Error('Insufficient diversified stock choices');
 return picks;
}
function evaluate(signals,prices){
 const state=Object.fromEntries(STRATS.map(s=>[s,{capital:1,high:1,dd:0,positive:0,beat:0,cost:0,turnover:0,prev:new Set(),weekly:[]}]));
 let base=1,baseHigh=1,baseDrawdown=0;
 const rows=[];
 for(const sig of signals){
  const {entryDate,exitDate,picks,signalDate,eligible}=sig;
  const entry=prices[entryDate],exit=prices[exitDate];
  if(!entry?.['0050']||!exit?.['0050'])throw Error('Missing benchmark prices '+signalDate);
  const baseline=exit['0050'].close/entry['0050'].close-1;
  base*=1+baseline;baseHigh=Math.max(baseHigh,base);baseDrawdown=Math.min(baseDrawdown,base/baseHigh-1);
  const row={signalDate,entryDate,exitDate,eligible,etf0050GrossPct:round(baseline*100),models:{}};
  for(const key of STRATS){
   const c=picks[key],st=state[key];
   if(c.length!==10||new Set(c).size!==10)throw Error('Malformed selection '+key+' '+signalDate);
   const returns=c.map(code=>{
    const p0=entry[code]?.close,p1=exit[code]?.close;
    if(!p0||!p1)throw Error('Missing stock price '+code+' '+signalDate);
    return p1/p0-1;
   });
   const gross=returns.reduce((a,b)=>a+b,0)/returns.length,next=new Set(c);
   const buy=[...next].filter(x=>!st.prev.has(x)).length/10,sell=[...st.prev].filter(x=>!next.has(x)).length/10;
   const cost=buy*.001425+sell*.004425,net=gross-cost;
   st.capital*=1+net;st.high=Math.max(st.high,st.capital);st.dd=Math.min(st.dd,st.capital/st.high-1);
   st.positive+=net>0?1:0;st.beat+=net>baseline?1:0;st.cost+=cost;st.turnover+=buy+sell;st.prev=next;st.weekly.push(net);
   row.models[key]={grossPct:round(gross*100),costPct:round(cost*100),netPct:round(net*100),codes:c};
  }
  rows.push(row);
 }
 const metrics=Object.fromEntries(STRATS.map(key=>{
  const s=state[key],n=s.weekly.length,avg=s.weekly.reduce((x,y)=>x+y,0)/n;
  const varWeekly=s.weekly.reduce((x,y)=>x+(y-avg)**2,0)/(n-1),sd=Math.sqrt(varWeekly);
  return [key,{cumulativePct:round((s.capital-1)*100),maxWeeklyDrawdownPct:round(s.dd*100),
   positiveWeeks:s.positive,beat0050Weeks:s.beat,
   estimatedTotalTradingCostPpt:round(s.cost*100),grossTurnover:round(s.turnover),
   annualizedWeeklySharpe0Cash:sd>0?round(avg/sd*Math.sqrt(52),2):null}];
 }));
 return {metrics,weekly:rows,baseline:{name:'0050',cumulativePct:round((base-1)*100),
   maxWeeklyDrawdownPct:round(baseDrawdown*100),gross:true,includesDividends:false}};
}
function selfTest(){
 assert.equal(pubDate('1151017'),'2026-10-17');
 assert.equal(pubDate(''),'');
}
async function runTests(){
 assert.equal(pubDate('1151017'),'2026-10-17');
 assert.equal(fallbackRevenueDate('2026-09'),'2026-10-18');
 assert.equal(fiscalQuarter('2026-09-04'),'2026Q2');
 assert.equal(fiscalQuarter('2026-11-17'),'2026Q2');
 assert.equal(fiscalQuarter('2026-11-27'),'2026Q3');
 assert.equal(weeklyMonday('2026-09-24'),'2026-09-21');
 const two=[{code:'1001',chip:1,fundamental:3},{code:'1002',chip:10,fundamental:3}];
 assert.deepEqual(rank(two,'fundamental').map(x=>x.code),['1001','1002'],'Independent tie break');
 const rev={'2026-09':{'2330':{yoy:20,publishDate:'2026-10-17'}},
   '2026-08':{'2330':{yoy:10,publishDate:null}}};
 assert.equal(monthlyAt('2026-10-16','2330',rev).month,'2026-08');
 assert.equal(monthlyAt('2026-10-22','2330',rev).month,'2026-09');
 console.log('SELF TEST PASSED: announcement lag, quarter lag, independent ties, calendar');
}
async function main(){
 const chip=await readChipArchive(),asOf=chip.at(-1).date,calendar=calendarDays(chip),signals=[];
 for(let i=0;i+2<calendar.length;i++){
  if(calendar[i].last<START||calendar[i+2].first>asOf)continue;
  if(chip.findIndex(x=>x.date===calendar[i].last)<59)continue;
  signals.push({signalDate:calendar[i].last,entryDate:calendar[i+1].first,exitDate:calendar[i+2].first});
 }
 if(signals.length<4)throw Error('Not enough completed historical weeks yet');
 const dates=[...new Set(signals.flatMap(x=>[x.signalDate,x.entryDate,x.exitDate]))];
 const monthNames=new Set(),quarterNames=new Set();
 for(const {signalDate} of signals){
  for(let delta=-1;delta>=-4;delta--)monthNames.add(monthKey(signalDate,delta));
  quarterNames.add(fiscalQuarter(signalDate));
 }
 const jobs=[
  ...dates.map(x=>({kind:'price',id:x,ds:'stock_day_all',file:x.slice(0,4)+'/'+x+'.csv'})),
  ...[...monthNames].map(x=>({kind:'revenue',id:x,ds:'monthly_revenue',file:x.slice(0,4)+'/'+x+'.csv'})),
  ...[...quarterNames].map(x=>({kind:'quarter',id:x,ds:'income_statement',file:x.slice(0,4)+'/'+x.slice(0,4)+'-Q'+x.slice(-1)+'.csv'}))
 ];
 console.log('Archival files to load: '+jobs.length+'; weeks '+signals.length+'; chip sessions '+chip.length);
 const archived=await mapLimit(jobs,6,async j=>({kind:j.kind,id:j.id,records:csv(await remoteText(j.ds,j.file))}));
 const price={},revenue={},quarters={};for(const a of archived){
  if(a.kind==='price')price[a.id]=priceMap(a.records);
  else if(a.kind==='revenue')revenue[a.id]=revenueMap(a.records);
  else quarters[a.id]=earningsMap(a.records);
 }
 const chosen=signals.map(s=>{
  const c=candidates(s.signalDate,chip,price,revenue,quarters);
  return {...s,eligible:c.length,
   sourceMonthly:Object.fromEntries([...monthNames].sort().map(m=>[m,c.filter(x=>x.revenueMonth===m).length])),
   quarterVintage:fiscalQuarter(s.signalDate),picks:pick(c)};
 });
 const evals=evaluate(chosen,price),last=chosen.at(-1).exitDate;
 const sourceInfo={schema:2,status:'historical_signal_snapshot',strategyNames:STRATS,
  asOf:last,createdAt:new Date().toISOString(),
  formula:'chip45 + fundamental35 + 0050-relative20; ticker ascending tie break (no other factor)',
  revenueVintage:'Per-row published date when provided, else next-month day18',
  quarterVintage:'Quarter-end plus 55 days conservative proxy; original issuer vintages not independently audited',
  universe:'Today-listed watch universe with archived 20d chip + published monthly + quarterly EPS',
  selection:chosen};
 const result={schema:2,status:'exploratory_partial_pit',
  study:'MARKET RADAR historical 45/35/20 factor ablation',asOf:last,producedAt:new Date().toISOString(),
  period:{firstSignal:chosen[0].signalDate,lastExit:last,weeks:chosen.length,qualifyingPerWeek:chosen.map(x=>x.eligible),
   eligibleMarket:'TWSE listed currently-tracked survivors with complete institution, revenue and financial data'},
  formula:{institutional:'45 points: foreign/trust 5/20/60d nets and buy-day counts',
   fundamental:'35 points: published monthly revenue and quarterly EPS, op/gross margin',
   relative:'20 points: same-day 0050-relative action and NT$50m volume value',
   diversification:'fullDiv max 2 selected stocks per published revenue sector',
   ablation:'noChip=35+20, noFundamental=45+20, noRelative=45+35',
   ties:'Within any strategy ties broken by ascending ticker only, no other factor leakage'},
  execution:{signal:'weekly last close',entry:'next week first listed session close',exit:'following week first listed session close',
   portfolio:'10 equal-weight names; weekly re-selection',buyCostPct:.1425,sellCostPct:.4425,
   slippage:false,corporateActions:'unadjusted closes; cash dividends, all other actions and delistings not audited'},
  vintage:{monthly:'publication date or next-month 18th if missing',
   earnings:'quarter-end plus 55 calendar days; not immutable point-in-time filings',
   stockPrices:'TWSE-daily public archived price CSV',
   chip:'official institution results archived by MARKET RADAR'},
  metricNotes:['Short and retrospectively selected sample, not out-of-sample proof',
   'Survivor bias; unavailable historical delisted / watch list entrants',
   'Corporate actions, dividends, market impact and intraday drawdown omitted',
   'Historic quarterly records may reflect later restatements'],
  ...evals,
  sourceLinks:[{name:'Public TWSE daily price and filings archives',url:'https://github.com/joy40217/TWSE-daily'},
   {name:'Auditable selected signals',url:'./data/backtest-multifactor-signals.json'}]};
 const check=await fs.readFile(ROOT+'/backtest-multifactor.json','utf8').then(JSON.parse).catch(()=>null);
 if(check?.asOf===last&&check?.status==='exploratory_partial_pit'){
  const diff=Math.abs(check.metrics.fullDiv.cumulativePct-result.metrics.fullDiv.cumulativePct);
  if(diff>0.5)console.warn('Historical result changed by '+diff.toFixed(2)+'ppt; check vintage revisions and source data');
 }
 await fs.writeFile(ROOT+'/backtest-multifactor-signals.json',JSON.stringify(sourceInfo,null,2)+'\n');
 await fs.writeFile(ROOT+'/backtest-multifactor.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({lastExit:last,weeks:chosen.length,first:chosen[0].signalDate,fullDiv:result.metrics.fullDiv,benchmark:result.baseline},null,2));
}
if(process.argv.includes('--self-test'))await runTests();
else await main().catch(e=>{console.error('MULTIFACTOR BACKTEST FAILED:',e);process.exitCode=1});
