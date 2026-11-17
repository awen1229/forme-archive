/**
 * MARKET RADAR daily evidence-led follow list.
 *
 * Deterministic, source-grounded research priorities, not trading orders.
 * Score: verified multi-day institution flows 45, reported financials 35,
 * current-day breadth-relative action / liquidity 20.
 * News: official headlines as source-linked event/risk flags, NEVER
 * inferred positive catalysts. Macro: market-wide caution overlay.
 * EPS consensus is NOT used (no licensed coverage).
 */
import fs from 'node:fs/promises';
const DIR='market-radar/data';
const now=new Date().toISOString();
const round=(n,p=2)=>Number.isFinite(n)?Math.round(n*10**p)/10**p:null;
const amount=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const isoDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))?d:null;
const safeURL=u=>{try{const v=new URL(String(u));return v.protocol==='https:'?v.href:null;}catch{return null;}};
async function load(name,optional=false){try{return JSON.parse(await fs.readFile(DIR+'/'+name,'utf8'));}catch(e){if(optional)return null;throw e;}}
const market=await load('latest.json');
const history=await load('series.json');
const earnings=await load('earnings.json',true);
const news=await load('news.json',true);
if(!isoDate(market.asOf)||!Array.isArray(market.rows)||market.rows.length<300||!Array.isArray(history.days))throw Error('Missing current market snapshot');
const days=history.days.filter(d=>isoDate(d.date)&&d.date<=market.asOf&&d.rows).sort((a,b)=>b.date.localeCompare(a.date));
const reportDate=market.asOf;
const idx=amount(market.indices?.[0]?.pct);
const breadth=(market.summary?.up!=null&&market.summary?.down!=null)?market.summary.up/(market.summary.up+market.summary.down):null;
const readMap=new Map(market.rows.map(x=>[x.code,x]));
const reports=earnings?.companies||{};
const headlines=(news?.items||[]).filter(n=>isoDate(n.date)&&n.date<=reportDate);
const currentAnnounced=headlines.filter(n=>{
 const diff=Math.round((Date.parse(reportDate+'T00:00:00Z')-Date.parse(n.date+'T00:00:00Z'))/86400000);
 return diff>=0&&diff<=7;
});
const byCode=new Map();
for(const n of currentAnnounced)if(n.code){const a=byCode.get(n.code)||[];a.push({date:n.date,title:n.title,url:safeURL(n.url),category:n.category||'公司自行公告',source:n.source});byCode.set(n.code,a);}
const watchHit=new Set((await fs.readFile('market-radar/scripts/sync.mjs','utf8')).match(/const WATCH = new Set\('([^']+)'\.split/)[1].split(' '));
function windowRows(code,n,key){
 const a=days.slice(0,n);
 if(a.length<n||a.some(d=>amount(d.rows[code]?.[key])===null))return null;
 return a.map(d=>({...d.rows[code],date:d.date}));
}
function chipStats(code,n,key){
 const a=windowRows(code,n,key);
 if(!a)return null;
 const net=round(a.reduce((s,r)=>s+r[key],0));
 const buys=a.filter(r=>r[key]>0).length;
 return {net,buys,days:n,first:a.at(-1).date,last:a[0].date};
}
function passMax(x,limit){return Math.max(0,Math.min(limit,x));}
async function fetchFred(id){
 const url='https://fred.stlouisfed.org/graph/fredgraph.csv?id='+encodeURIComponent(id)+'&cosd=2026-04-01';
 const res=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'accept':'text/csv'}});
 if(!res.ok)throw Error('HTTP '+res.status);
 const csv=await res.text();
 const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(!lines[0].includes(id))throw Error('FRED CSV unexpected columns');
 return {id,url,points:lines.slice(1).map(t=>t.split(',')).filter(v=>isoDate(v[0])&&amount(Number(v[1]))!==null&&v[1]!==''&&v[1]!=='.').map(v=>({date:v[0],value:Number(v[1])})).filter(v=>Number.isFinite(v.value)).slice(-45)};
}
const macro={generatedAt:now,sourceStatus:{},series:{},message:'資料不足，暫不對總經趨勢做明確判讀',grade:'unknown'};
await Promise.all(['DGS10','DGS2'].map(async id=>{
 try{
  const d=await fetchFred(id);
  if(d.points.length<5)throw Error('Insufficient valid Treasury yields');
  const recent=d.points.at(-1),previous=d.points[Math.max(0,d.points.length-6)];
  const age=(Date.parse(reportDate+'T00:00:00Z')-Date.parse(recent.date+'T00:00:00Z'))/86400000;
  macro.series[id]={name:id==='DGS10'?'美國10年期公債殖利率':'美國2年期公債殖利率',date:recent.date,value:recent.value,change5:round(recent.value-previous.value,3),source:d.url,fresh:age>=-1&&age<=10};
  macro.sourceStatus[id]={ok:true,date:recent.date,url:d.url};
 }catch(e){macro.sourceStatus[id]={ok:false,error:String(e.message||e).slice(0,150),url:'https://fred.stlouisfed.org/graph/fredgraph.csv?id='+id};}
}));
if(macro.series.DGS10?.fresh&&macro.series.DGS2?.fresh){
 const ten=macro.series.DGS10,short=macro.series.DGS2;
 macro.grade=ten.change5>=.20?'caution':ten.change5<=-.15?'easing':'mixed';
 macro.message=macro.grade==='caution'?'美債10年期殖利率近5筆明顯上升，成長股估值壓力需留意':macro.grade==='easing'?'美債10年期殖利率近5筆下降，但不能單獨推論風險偏好回升':'美國2年／10年期公債殖利率資料已更新，利率訊號尚不單邊';
}
const riskyHeadline=/駭客|資安事件|停工|停產|重大損失|違約|重大訴訟|財報重編|裁罰|減資|重訊更正|獨立董事辭任/;
const evidenceHeadline=/法說|營收|獲利|財報|新增產能|產能擴充|訂單|資本支出|接單|新產品|財務報告|重大投資/;
function scoreOne(r){
 const chip={f5:chipStats(r.code,5,'foreign'),t5:chipStats(r.code,5,'trust'),
  f20:chipStats(r.code,20,'foreign'),t20:chipStats(r.code,20,'trust'),
  f60:chipStats(r.code,60,'foreign'),t60:chipStats(r.code,60,'trust')};
 const report=reports[r.code]||null;
 const events=(byCode.get(r.code)||[]).slice(0,3);
 const risks=events.filter(e=>riskyHeadline.test(e.title));
 let chipScore=0,finance=0,technical=0;
 const why=[],concerns=[];
 const chipQualified=chip.f20&&chip.t20;
 if(chipQualified){
  if(chip.t20.net>0){chipScore+=11;why.push('投信20日累計淨買 '+round(chip.t20.net,0)+' 張');}
  else if(chip.t20.net<0)concerns.push('投信20日累計淨賣 '+round(chip.t20.net,0)+' 張');
  if(chip.f20.net>0){chipScore+=8;why.push('外資20日累計淨買 '+round(chip.f20.net,0)+' 張');}
  else if(chip.f20.net<0)concerns.push('外資20日累計淨賣');
  if(chip.t60?.net>0){chipScore+=7;why.push('投信60日累計淨買');}
  if(chip.f60?.net>0)chipScore+=5;
  if(chip.t20.buys>=14){chipScore+=7;why.push('投信20日內買超 '+chip.t20.buys+' 天');}
  if(chip.f20.buys>=13)chipScore+=4;
  if(chip.t5?.net>0){chipScore+=3;why.push('近5日投信持續淨買');}
 }else concerns.push('缺少完整20日法人歷史');
 const rev=amount(r.revYoY),revMoM=amount(r.revMoM);
 if(rev!==null){
  if(rev>=25){finance+=14;why.push('最近月營收年增 '+round(rev,1)+'%');}
  else if(rev>=10){finance+=9;why.push('最近月營收年增 '+round(rev,1)+'%');}
  else if(rev>=0)finance+=4;
  else if(rev<0)concerns.push('營收年減 '+round(rev,1)+'%');
 }
 if(revMoM!==null&&revMoM>0&&rev!==null&&rev>5)finance+=3;
 if(report&&amount(report.epsYtd)!==null){
  if(report.epsYtd>0){finance+=9;why.push(report.period+' 累計 EPS 為正');}
  else if(report.epsYtd<0)concerns.push('累計 EPS 虧損');
  if(report.operatingMargin>10)finance+=6;
  else if(report.operatingMargin>0)finance+=3;
  else if(report.operatingMargin<0)concerns.push('營業利益率為負');
  if(report.grossMargin>20)finance+=3;
 }
 const liquidity=amount(r.value);
 if(liquidity!==null&&liquidity>=50000000)technical+=6;
 if(idx!==null&&amount(r.pct)!==null){
  const excess=round(r.pct-idx,2);
  if(excess>=3){technical+=9;why.push('當日相對大盤強 '+excess+' 個百分點');}
  else if(excess>=1){technical+=6;why.push('當日相對大盤強 '+excess+' 個百分點');}
  else if(excess>=0)technical+=3;
 }
 if(amount(r.pct)!==null&&r.pct>=0)technical+=5;
 const currentScore=Math.round(chipScore+finance+technical);
 if(risks.length)concerns.push('有需詳讀的公司風險公告');
 if(breadth!==null&&breadth<.4)concerns.push('大盤上漲家數偏少，環境不利追價');
 if(macro.grade==='caution')concerns.push('美債殖利率快速上行，留意估值壓力');
 const dataChecks={chip20:!!chipQualified,financial:rev!==null&&!!report,news:news?.items?.length>0,macro:macro.grade!=='unknown'};
 const status=chipQualified&&currentScore>=62&&chip.t20.net>0&&chip.f20.net>0&&risks.length===0?'重點持續研究':
   chipQualified&&currentScore>=50&&chip.t20.net>0&&risks.length===0?'持續追蹤':
   chipQualified?'條件待確認':'新發現・長期籌碼不足';
 return {code:r.code,name:r.name,market:r.market,sector:null,price:{close:r.close,pct:r.pct,date:reportDate},
  score:currentScore,scoreComponents:{institutional:chipScore,financial:finance,relativeAction:technical},
  dataChecks,status,chip,monthly:{month:r.revMonth,yoy:rev,mom:revMoM},financial:report?{
  period:report.period,epsYtd:report.epsYtd,operatingMargin:report.operatingMargin,grossMargin:report.grossMargin,source:report.source}:null,
  why:why.slice(0,6),risks:concerns.slice(0,5),events,
  newsWarning:risks.length>0,sourceNote:'官方盤後與公告財報；研究優先度為規則式篩選，非法人 EPS 共識或買進建議'};
}
const ranked=market.rows.filter(r=>r?.code&&r.close>0).map(scoreOne);
const core=ranked.filter(x=>watchHit.has(x.code)&&x.dataChecks.chip20&&x.dataChecks.financial)
 .sort((a,b)=>b.score-a.score);
const known=ranked.filter(x=>!watchHit.has(x.code)&&x.score>=25&&x.monthly.yoy!==null)
 .sort((a,b)=>b.score-a.score);
const allCandidates=ranked.filter(x=>x.dataChecks.chip20&&x.score>=45).sort((a,b)=>b.score-a.score);
function diverse(list,limit,cap=2){
 const picked=[],industry=new Map();
 for(const x of list){const group=x.sector||x.market;
  if((industry.get(group)||0)>=cap)continue;
  picked.push(x);industry.set(group,(industry.get(group)||0)+1);
  if(picked.length>=limit)break;
 }
 return picked;
}
// Use company-specific keyword and market tagging only where a sector catalog
// is verified; global candidate list is NOT assumed to be classified by API.
const codeToSector=new Map();
// Read static category source from app, strict JSON object (no eval).
const app=await fs.readFile('market-radar/index.html','utf8');
const source=app.match(/const SECTOR_POOL = (\{[\s\S]*?\});\nconst defaultPool/);
if(source){try{const p=JSON.parse(source[1]);for(const [cat,arr] of Object.entries(p))for(const [code] of arr)codeToSector.set(code,cat);}catch(e){console.warn('Could not parse sector pool',e.message)}}
for(const a of ranked)a.sector=codeToSector.get(a.code)||null;
const previous=await load('picks.json',true);
const prevCodes=new Map((previous?.tracking||[]).map(x=>[x.code,x.rank]));
const sameDate=previous?.asOf===reportDate;
const selected=diverse(core,10,2).map((x,i)=>({...x,rank:i+1,change:sameDate?(previous.tracking.find(z=>z.code===x.code)?.change||'同日重新評估'):(prevCodes.has(x.code)?'持續追蹤':'新進觀察')}));
const second=known.filter(x=>x.financial?.epsYtd>0).slice(0,6).map((x,i)=>({...x,rank:i+1,change:'新發現'}));
const info={
 schema:1,asOf:reportDate,generatedAt:now,
 headline:'依官方資料建立每日持續研究名單，非當日買賣建議',
 methodology:{score:'籌碼45＋基本面35＋相對強弱與流動性20；此為未回測的規則式研究優先度，不是報酬預測。',news:'僅使用已收錄的公司官方公告，標示風險及事件，不根據標題推測利多。',macro:'美債殖利率與台股市場廣度為全市場風險提醒，並未驗證所有總經變數。',consensus:'未取得合法授權的2027／2028法人共識，不納入評分。'},
 macro:{...macro,marketBreadth:breadth===null?null:round(breadth*100,1),taiwanMarketDate:reportDate,indexChangePct:idx,marketCaution:breadth!==null&&breadth<.4?'市場廣度偏弱，候選僅供追蹤、不宜直接視為進場訊號':null},
 news:{updatedAt:news?.generatedAt||null,records:headlines.length,latestByCompany:currentAnnounced.length,
  global:currentAnnounced.filter(x=>!x.code).slice(0,4).map(x=>({date:x.date,title:x.title,url:safeURL(x.url),source:x.source}))},
 tracking:selected,emerging:second,
 removed:(sameDate?[]:previous?.tracking||[]).filter(x=>!selected.some(c=>c.code===x.code)).slice(0,15).map(x=>({code:x.code,name:x.name,formerRank:x.rank})),
 sourceDates:{prices:market.asOf,chip:history.asOf,earnings:earnings?.generatedAt||null,news:news?.generatedAt||null,macro:now},
 universeCount:market.rows.length,qualifiedHistory:ranked.filter(x=>x.dataChecks.chip20).length,
 disclaimer:'研究持續追蹤名單，不是買進或目標價；單日相對強弱不等於中長期強勢；新聞原始標題不代表證實其對EPS的因果。外資買賣超非主動基金持股的完整代理。'
};
if(selected.length<1)console.warn('No verified 20d + financial overlap yet. Publishing empty, clearly labeled monitoring list until history is restored.');
await fs.writeFile(DIR+'/macro.json',JSON.stringify(macro)+'\n');
await fs.writeFile(DIR+'/picks.json',JSON.stringify(info)+'\n');
console.log(JSON.stringify({asOf:reportDate,tracking:selected.map(x=>({code:x.code,score:x.score,rank:x.rank})),emerging:second.length,qualifiedHistory:info.qualifiedHistory,macro:macro.sourceStatus,marketBreadth:info.macro.marketBreadth},null,2));
