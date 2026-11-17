/**
 * MARKET RADAR - independently verify and backfill official per-stock
 * institutional flows (TWSE T86 / TPEx website historical API).
 * No inferred missing days, no automatic investment recommendations.
 *
 * BACKFILL_CALENDAR_DAYS=120 (initial six- to sixteen-week lookback)
 * DATA_CAPACITY=160 trading sessions (preserves daily live snapshots)
 */
import fs from "node:fs/promises";
import path from "node:path";

const DIR="market-radar/data";
const WATCH=new Set((await fs.readFile("market-radar/scripts/sync.mjs","utf8")).match(/const WATCH = new Set\('([^']+)'\.split/)[1].split(" "));
const daysBack=Math.max(7,Math.min(200,Number(process.env.BACKFILL_CALENDAR_DAYS)||112));
const keepDays=160;
const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const convert=(v)=>{let s=String(v??"").replace(/,/g,"").replace(/<[^>]*>/g,"").trim();return s===""||s==="--"||!Number.isFinite(Number(s))?null:Number(s)};
const lots=v=>v===null?null:Math.round(v/10)/100;
const stock=v=>/^\d{4}$/.test(String(v??"").trim())?String(v).trim():null;
const dayOnly=d=>d.toISOString().slice(0,10);
async function json(url){
 let error;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const res=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{"accept":"application/json","user-agent":"Mozilla/5.0 MARKET-RADAR/1.0"}});
   if(!res.ok)throw Error("HTTP "+res.status);
   const data=await res.json();
   if(typeof data!=="object"||!data)throw Error("Non-JSON payload");
   return data;
  }catch(e){error=e;if(attempt<2)await new Promise(r=>setTimeout(r,600*(attempt+1)));}
 }
 throw error;
}
function twseParse(j,expected){
 if(j?.stat!=="OK"||!Array.isArray(j.fields)||!Array.isArray(j.data))return null;
 const announced=String(j.date??"").replace(/\D/g,"");
 if(announced.length===8&&announced!==expected.replace(/-/g,""))throw Error("TWSE date mismatch "+announced);
 const norm=s=>String(s).replace(/[\s_()（）]/g,"");
 const fields=j.fields.map(norm);
 const index=(s)=>fields.findIndex(k=>k===norm(s));
 const fi=index("外陸資買賣超股數(不含外資自營商)"),ti=index("投信買賣超股數");
 if(fi<0||ti<0)throw Error("TWSE flow columns missing");
 if(j.data.length<400)throw Error("TWSE unexpectedly short table");
 const rows={};let valid=0;
 for(const r of j.data){const c=stock(r[0]);if(!c)continue;const f=convert(r[fi]),t=convert(r[ti]);if(f===null||t===null)continue;valid++;if(WATCH.has(c))rows[c]={foreign:lots(f),trust:lots(t)};}
 if(valid<400)throw Error("TWSE numeric schema validation failed");
 return {rows,market:"上市",valid};
}
function tpexParse(j,expected){
 // This official historical interface uses a table with duplicated
 // Chinese header names, so columns are POSITIONAL and checked by identities.
 // Position reference: official TPEx historical institutional trading detail.
 const table=(j?.tables||[]).find(t=>Array.isArray(t.data)&&t.data.some(r=>Array.isArray(r)&&r.length>=24));
 if(!table)return null;
 const rows={};let valid=0,errors=0;
 for(const r of table.data){
  if(!Array.isArray(r)||r.length<24)continue;
  const c=stock(String(r[0]??"").replace(/<[^>]+>/g,""));
  if(!c)continue;
  const f=convert(r[4]),trust=convert(r[13]),self=convert(r[16]),hedge=convert(r[19]),dealer=convert(r[22]),total=convert(r[23]);
  if([f,trust,self,hedge,dealer,total].some(v=>v===null)){errors++;continue;}
  if(Math.abs(self+hedge-dealer)>2||Math.abs(f+trust+dealer-total)>2){errors++;continue;}
  valid++;
  if(WATCH.has(c))rows[c]={foreign:lots(f),trust:lots(trust)};
 }
 if(valid<150||errors>Math.max(10,valid*.05))throw Error("TPEx column identity checks failed: valid "+valid+" errors "+errors);
 return {rows,market:"上櫃",valid};
}
const urlTwse=d=>"https://www.twse.com.tw/rwd/zh/fund/T86?date="+d.replace(/-/g,"")+"&selectType=ALLBUT0999&response=json";
const urlTpex=d=>{
 const [y,m,dd]=d.split("-").map(Number);
 return "https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade?type=Daily&sect=EW&date="+encodeURIComponent((y-1911)+"/"+String(m).padStart(2,"0")+"/"+String(dd).padStart(2,"0"))+"&id=&response=json";
};
async function collect(d){
 const [a,b]=await Promise.allSettled([json(urlTwse(d)),json(urlTpex(d))]);
 let twse=null,tpex=null;const errors=[];
 try{if(a.status==="fulfilled")twse=twseParse(a.value,d);else errors.push("TWSE "+a.reason?.message);}
 catch(e){errors.push("TWSE "+e.message);}
 try{if(b.status==="fulfilled")tpex=tpexParse(b.value,d);else errors.push("TPEx "+b.reason?.message);}
 catch(e){errors.push("TPEx "+e.message);}
 if(!twse&&!tpex)return {date:d,empty:true,errors};
 const rows={...twse?.rows,...tpex?.rows};
 return {date:d,rows,sourceCoverage:{twse:!!twse,tpex:!!tpex},sourceCount:{listed:twse?.valid||0,otc:tpex?.valid||0},errors};
}
async function main(){
 const file=path.join(DIR,"series.json");
 const existing=JSON.parse(await fs.readFile(file,"utf8"));
 const map=new Map((existing.days||[]).map(r=>[r.date,r]));
 const nowDate=new Date(today+"T00:00:00Z");
 const inputs=[];
 for(let i=1;i<=daysBack;i++){
  const d=new Date(nowDate.getTime()-i*86400000);const dow=d.getUTCDay();
  if(dow!==0&&dow!==6)inputs.push(dayOnly(d));
 }
 let loaded=0,merged=0,errors=[],skipped=0;
 // Bounded concurrency and small pacing so both exchanges remain responsive.
 let pos=0;
 async function work(){
  while(pos<inputs.length){
   const d=inputs[pos++];
   // Leave prior complete days intact, but revisit partial days and unvalidated legacy data.
   const old=map.get(d);
   if(old?.sourceCoverage?.twse&&old?.sourceCoverage?.tpex){skipped++;continue;}
   const res=await collect(d);
   loaded++;
   if(res.empty){if(res.errors?.length)errors.push({date:d,errors:res.errors});continue;}
   const oldRows=old?.rows||{},rows={...oldRows};
   for(const [code,value] of Object.entries(res.rows||{})){
    rows[code]={...oldRows[code],...value};
   }
   const sourceCoverage={twse:!!(old?.sourceCoverage?.twse||res.sourceCoverage?.twse),tpex:!!(old?.sourceCoverage?.tpex||res.sourceCoverage?.tpex)};
   map.set(d,{date:d,rows,sourceCoverage,origin:"official-backfill"});
   merged++;
   if(res.errors?.length)errors.push({date:d,errors:res.errors});
   await new Promise(r=>setTimeout(r,130));
  }
 }
 await Promise.all([work(),work(),work(),work(),work()]);
 const days=[...map.values()].filter(d=>d?.date&&d?.rows&&Object.keys(d.rows).length).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,keepDays);
 if(days.length<2||merged===0)throw Error("No verified new historical data; keeping old file intact. "+JSON.stringify(errors.slice(0,6)));
 const current=JSON.parse(await fs.readFile(file,"utf8")); // Do not lose daily work produced during collection
 const latest=new Map(days.map(x=>[x.date,x]));
 for(const x of current.days||[])if(!latest.has(x.date))latest.set(x.date,x);
 const ordered=[...latest.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,keepDays);
 const output={
  asOf:current.asOf||today,
  generatedAt:new Date().toISOString(),
  days:ordered,
  backfill:{generatedAt:new Date().toISOString(),calendarDaysRequested:daysBack,sourceUrls:{listed:"https://www.twse.com.tw/rwd/zh/fund/T86",otc:"https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade"},validatedDays:merged,skippedExisting:skipped,downloadedDays:loaded,coveredDays:ordered.length,fullMarketDays:ordered.filter(d=>d.sourceCoverage?.twse&&d.sourceCoverage?.tpex).length,partialFailureCount:errors.length,failedSamples:errors.slice(0,8),note:"歷史欄位是外資（不含外資自營商）與投信淨買賣張數；缺少官方回應或驗證失敗日不補零。"}
 };
 await fs.writeFile(file,JSON.stringify(output)+"\n");
 console.log(JSON.stringify({requested:inputs.length,loaded,merged,stored:ordered.length,fullyCovered:output.backfill.fullMarketDays,failed:errors.length,firstFailure:errors.slice(0,8)},null,2));
}
main().catch(e=>{console.error("BACKFILL FAILED",e);process.exitCode=1;});
