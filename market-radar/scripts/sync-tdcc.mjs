/**
 * MARKET RADAR: TDCC weekly shareholder concentration and retail ownership.
 * Source: https://opendata.tdcc.com.tw/getOD.ashx?id=1-5
 * Preserve immutable month-partitioned historical snapshots; compute an
 * OBSERVATIONAL overlay, never silently modify the 45/35/20 ranking.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const ROOT='market-radar/data/tdcc';
const URL='https://opendata.tdcc.com.tw/getOD.ashx?id=1-5';
const integer=v=>/^\d+$/.test(String(v));
const rounded=(n,p=2)=>Number.isFinite(n)?Math.round(n*10**p)/10**p:null;
function csvRows(content){
 const lines=content.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(!lines[0]?.includes('資料日期')||!lines[0]?.includes('持股分級'))throw Error('TDCC CSV header unexpected');
 const first=lines[1]?.split(',')?.[0];
 if(!/^\d{8}$/.test(first))throw Error('TDCC statement lacks valid date');
 const date=first.slice(0,4)+'-'+first.slice(4,6)+'-'+first.slice(6,8);
 const rows={};
 for(const s of lines.slice(1)){
  const parts=s.split(','),rawDay=parts[0],code=parts[1]?.trim(),level=Number(parts[2]),holders=Number(parts[3]),shares=Number(parts[4]),pct=Number(parts[5]);
  if(rawDay!==first||!/^\d{4}$/.test(code)||!Number.isInteger(level)||level<1||level>17||!Number.isFinite(holders)||!Number.isFinite(shares)||!Number.isFinite(pct))continue;
  const d=rows[code]||[0,0,0,null,null,0,0,0];
  if(level===15){d[0]=pct;d[5]=holders;d[6]=shares}
  if(level<=3)d[1]+=pct;
  if(level<=8)d[2]+=pct;
  if(level===17){d[3]=holders;d[4]=shares;d[7]=pct}
  rows[code]=d;
 }
 for(const [code,d]of Object.entries(rows)){
  if(!(d[4]>0)||d[3]<1||d[7]<99||d[7]>101||d[0]<0||d[0]>100||d[1]>100)delete rows[code];
  else{d.pop();d[0]=rounded(d[0]);d[1]=rounded(d[1]);d[2]=rounded(d[2])}
 }
 return {date,rows};
}
function makeOverlay(weeks){
 const sorted=[...weeks].sort((a,b)=>a.date.localeCompare(b.date)),latest=sorted.at(-1);
 if(!latest)throw Error('No TDCC history');
 const output={schema:1,asOf:latest.date,updatedAt:new Date().toISOString(),
  status:'research_only_not_in_100_score',
  source:'https://opendata.tdcc.com.tw/getOD.ashx?id=1-5',
  origin:'TDCC weekly ID-aggregated custody holdings; denominator is TDCC custody shares, not free float',
  ranges:{large:'1,000,001 shares and above (TDCC class 15)',
    retail10:'up to 10,000 shares (classes 1-3)',retail50:'up to 50,000 shares (classes 1-8)'},
  caveats:['Includes custody and financing special accounts', 'Holder tier is not equivalent to informed trading or beneficial control',
   'Percentages can change with changes in issued/custody shares',
   'Date labels are statement dates, not guaranteed intraday release timestamps'],
  horizons:[4,8,12],tickerCount:Object.keys(latest.rows).length,rows:{}};
 const trend=(code,offset)=>{
  const previous=sorted[sorted.length-1-offset];
  if(!previous||!latest.rows[code]||!previous.rows[code])return null;
  const now=latest.rows[code],was=previous.rows[code];
  const stockChange=was[4]>0?(now[4]/was[4]-1)*100:null;
  if(stockChange===null)return null;
  return {from:previous.date,to:latest.date,largePpt:rounded(now[0]-was[0]),retail10Ppt:rounded(now[1]-was[1]),
   retail50Ppt:rounded(now[2]-was[2]),holdersPct:was[3]>0?rounded((now[3]/was[3]-1)*100):null,
   custodySharesChangePct:rounded(stockChange),comparable:Math.abs(stockChange)<=5};
 };
 for(const [code,arr]of Object.entries(latest.rows)){
  const t4=trend(code,4),t8=trend(code,8),t12=trend(code,12);
  let hint='不足以判讀';
  if(t4?.comparable){
   hint=t4.largePpt>=0.5&&t4.retail10Ppt<=-.25?'籌碼相對集中':
    t4.largePpt<=-.5&&t4.retail10Ppt>=.25?'籌碼相對分散':'變化未達警示門檻';
  }else if(t4&&!t4.comparable)hint='股數變動過大，暫不判斷';
  output.rows[code]={largePct:arr[0],retail10Pct:arr[1],retail50Pct:arr[2],holders:arr[3],
   custodyShares:arr[4],largeHolders:arr[5],largeShares:arr[6],
   w4:t4,w8:t8,w12:t12,hint};
 }
 return output;
}
async function getOfficial(){
 let last;
 for(let i=0;i<3;i++)try{
  const response=await fetch(URL,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'MarketRadar/1.0 (research; TDCC open data)',accept:'text/csv'}});
  if(!response.ok)throw Error('TDCC HTTP '+response.status);
  const text=await response.text();
  if(text.length<100000)throw Error('TDCC file suspiciously small');
  return csvRows(text);
 }catch(e){last=e;await new Promise(r=>setTimeout(r,1000*(i+1)))}
 throw last;
}
async function main(){
 await fs.mkdir(ROOT,{recursive:true});
 let downloaded=null;try{downloaded=await getOfficial()}catch(e){console.warn('TDCC official fetch unavailable, retaining existing snapshots: '+e.message)}
 if(downloaded){
  if(Object.keys(downloaded.rows).length<900)throw Error('TDCC parse quality below threshold; refuse overwrite');
  const month=downloaded.date.slice(0,7),filename=path.join(ROOT,month+'.json');
  let old={schema:1,month,source:'TDCC 集保戶股權分散表',archive:'https://opendata.tdcc.com.tw/getOD.ashx?id=1-5',
   lagPolicy:'use only date before weekly signal (unknown intraday release)',columns:['big1000Pct','retail10Pct','retail50Pct','totalHolders','totalShares','bigHolders','bigShares'],weeks:[]};
  try{old=JSON.parse(await fs.readFile(filename,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
  if(!Array.isArray(old.weeks)||old.month!==month)throw Error('Malformed TDCC monthly archive');
  if(!old.weeks.some(x=>x.date===downloaded.date)){
   old.weeks.push(downloaded);old.weeks.sort((a,b)=>a.date.localeCompare(b.date));
   await fs.writeFile(filename,JSON.stringify(old)+'\n');
   console.log('Appended immutable TDCC ownership data dated '+downloaded.date);
  }else console.log('TDCC date already archived: '+downloaded.date);
 }
 const files=(await fs.readdir(ROOT)).filter(f=>/^\d{4}-\d{2}\.json$/.test(f)).sort();
 let w=[];
 for(const f of files){const m=JSON.parse(await fs.readFile(path.join(ROOT,f),'utf8'));if(!Array.isArray(m.weeks))throw Error('Invalid TDCC month '+f);w=w.concat(m.weeks)}
 if(!w.length)throw Error('No TDCC snapshot to build overlay');
 const overlay=makeOverlay(w);
 await fs.writeFile(path.join(ROOT,'latest.json'),JSON.stringify(overlay)+'\n');
 console.log(JSON.stringify({asOf:overlay.asOf,stocks:overlay.tickerCount,
  with4Weeks:Object.values(overlay.rows).filter(x=>x.w4?.comparable).length,
  concentration:Object.values(overlay.rows).filter(x=>x.hint==='籌碼相對集中').length,
  distribution:Object.values(overlay.rows).filter(x=>x.hint==='籌碼相對分散').length}));
}
function test(){
 const records=['資料日期,證券代號,持股分級,人數,股數,占集保庫存數比例%',
  '20261113,2330,1,5,1000,2.00','20261113,2330,2,4,1000,3.00',
  '20261113,2330,3,3,1000,1.00','20261113,2330,15,2,30000,90.00',
  '20261113,2330,17,14,40000,100.00'].join('\n');
 const r=csvRows(records);assert.equal(r.date,'2026-11-13');assert.equal(r.rows['2330'][0],90);assert.equal(r.rows['2330'][1],6);assert.equal(r.rows['2330'][3],14);
 const weeks=Array.from({length:5},(_,i)=>({date:'2026-10-'+String(15+i*7).padStart(2,'0'),rows:{'2330':[60+i,14-i,20,100,10000,2,6000]}}));
 const o=makeOverlay(weeks);assert.equal(o.rows['2330'].w4.largePpt,4);assert.equal(o.rows['2330'].w4.retail10Ppt,-4);
 assert.equal(o.rows['2330'].hint,'籌碼相對集中');
 console.log('TDCC SELF-TEST PASS');
}
if(process.argv.includes('--self-test'))test();else main().catch(e=>{console.error('TDCC SYNC FAILED',e);process.exitCode=1});
