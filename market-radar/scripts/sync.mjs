/**
 * MARKET RADAR, official Taiwan market end-of-day collection.
 * Public data only. No financial forecasts or inferred values.
 * Dates / data quality are checked before merging.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = 'market-radar/data';
const WATCH = new Set('2317 2382 3231 6669 2376 2356 3706 8210 2059 3013 3693 4938 2330 3661 3443 3035 2454 2379 3034 5274 3529 4961 3711 2449 6239 6147 6223 6510 2360 3131 3583 2467 6488 3532 6770 2408 2344 8299 3260 2337 5289 4967 2451 3006 2383 6274 6213 3037 8046 3189 2368 3044 5439 8021 2313 8358 1815 4958 2327 3026 2492 2472 2375 6127 1717 1723 2308 3017 3324 2421 2301 3653 3338 6125 3015 3023 2345 3665 3081 3163 4979 3596 6285 5388 2455 6442 3363 4908 4977 1519 1503 1513 1514 2371 1605 1609 1618 1616 6214 3029 6180 6690 3130 8416 6112 2480 6811 5203 2049 1590 4583 4566 4551 4562 1536 2231 2634 2645 4916 8033 8222 5284 1584 2208 1476 1477 9904 9910 9921 9914 4438 1467 1419 9802 2603 2609 2615 2618 2610 5608 2637 2605 2617 2891 2886 2882 2881 2880 2884 2885 2892 5871 5880 4105 4743 4147 6491 6446 1795 6782 6612 4114 1760 4736 2002 2014 1301 1303 1326 6505 1402 9958 2027 2015 4739 4721 6443 3576 6869 3708 6244 2542 2520 5534 5522 2548 9945 1802 5904 2912 1216 1227 1231 8454 2727 2731 2707 9943 5903 2201 2207 2233 2105 1319 1537 3008 3406 2324 2353 2357 2385 2409 3481 3005'.split(' '));
const URLS = {
  twsePrices: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
  tpexPrices: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes',
  twseIndex: 'https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX',
  twsePe: 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL',
  twseRevenue: 'https://openapi.twse.com.tw/v1/opendata/t187ap05_L',
  tpexRevenue: 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O',
  tpexInst: 'https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading'
};
const key = s => String(s).toLowerCase().replace(/[\s_()（）－\-]/g,'');
const field=(r,names)=> { if (!r||typeof r!=='object') return undefined;for(const name of names){const k=Object.keys(r).find(k=>key(k)===key(name));if(k!==undefined)return r[k];}return undefined;};
const num=x=>{const s=String(x??'').trim().replace(/,/g,'');const n=Number(s);return s!==''&&s!=='--'&&Number.isFinite(n)?n:null;};
const code=x=>/^\d{4}$/.test(String(x??'').trim())?String(x).trim():null;
const lots=x=>x===null?null:Math.round(x/10)/100;
const pct=(p,ch)=>p!==null&&ch!==null&&p-ch!==0?Math.round(ch/(p-ch)*10000)/100:null;
const date=x=>{
 const v=String(x??'').replace(/\D/g,'');
 if(v.length===7) return String(Number(v.slice(0,3))+1911)+'-'+v.slice(3,5)+'-'+v.slice(5,7);
 if(v.length===8) return v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8);
 return null;
};
const month=x=>{const v=String(x??'').replace(/\D/g,'');return v.length===5?String(Number(v.slice(0,3))+1911)+'-'+v.slice(3,5):v.length===6?v.slice(0,4)+'-'+v.slice(4,6):null;};
async function getJSON(url){
 let err;
 for(let n=0;n<2;n++){
  try{
   const res=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{'accept':'application/json','user-agent':'MarketRadar/1.0 (+public market research dashboard)'}});
   if(!res.ok)throw new Error('HTTP '+res.status);
   const raw=await res.text();
   const val=JSON.parse(raw);
   if(!val||typeof val!=='object')throw new Error('Invalid JSON');
   return val;
  }catch(e){err=e;if(n===0)await new Promise(r=>setTimeout(r,1500));}
 }
 throw err;
}
function base(mkt,c,n,d,p,ch,vol,value) {
 if(!c||p===null||!d)return null;
 return {code:c,name:String(n??c).trim(),market:mkt,date:d,close:p,change:ch,pct:pct(p,ch),volume:lots(vol),value,
 foreign:null,trust:null,dealer:null,pe:null,revMonth:null,revYoY:null,revMoM:null};
}
function pricesListed(a){
 if(!Array.isArray(a))return [];
 return a.map(r=>base('上市',code(r.Code),r.Name,date(r.Date),num(r.ClosingPrice),num(r.Change),num(r.TradeVolume),num(r.TradeValue))).filter(Boolean);
}
function pricesOtc(a){
 if(!Array.isArray(a))return [];
 return a.map(r=>base('上櫃',code(field(r,['SecuritiesCompanyCode','SecuritiesCode','StockCode','Code'])),field(r,['CompanyName','SecuritiesCompanyName','SecuritiesName','Name']),date(field(r,['Date','TradingDate','TradeDate'])),num(field(r,['Close','ClosingPrice','ClosePrice'])),num(field(r,['Change','ChangePrice','PriceChange'])),num(field(r,['TradingShares','TradeVolume','TradeShares','TradingVolume'])),num(field(r,['TransactionAmount','TradingAmount','TradeValue'])))).filter(Boolean);
}
function pricesRwd(j, requestedDate){
 if(j?.stat!=='OK'||!Array.isArray(j.tables))return [];
 const officialDate=date(j.date);
 if(officialDate&&officialDate!==requestedDate)return [];
 const t=j.tables.find(t=>Array.isArray(t.fields)&&Array.isArray(t.data)&&t.fields.some(x=>String(x).includes('證券代號'))&&t.fields.some(x=>String(x).includes('收盤價')));
 if(!t)return [];
 const ix=needle=>t.fields.findIndex(x=>String(x).includes(needle));
 const cix=ix('證券代號'),nix=ix('證券名稱'),pix=ix('收盤價'),vix=ix('成交股數'),aix=ix('成交金額'),dix=ix('漲跌價差');
 const six=t.fields.findIndex(x=>String(x).includes('漲跌(+/-)')||String(x).includes('漲跌(+/-)'));
 const plain=x=>String(x??'').replace(/<[^>]*>/g,'').trim();
 return t.data.map(r=>{
  const c=code(plain(r[cix])),p=num(plain(r[pix]));
  const raw=plain(r[dix]),diff=num(raw.replace(/^[+-]/,''));
  const sign=six>=0?plain(r[six]):raw;
  const symbol=sign.match(/^[+-]/)?.[0]||null;
  // When the exchange's signed marker cannot be parsed, leave change null.
  const ch=diff===0?0:diff!==null&&symbol?(symbol==='-'?-diff:diff):null;
  return base('上市',c,plain(r[nix]),requestedDate,p,ch,num(plain(r[vix])),num(plain(r[aix])));
 }).filter(Boolean);
}
function indicesRwd(j,officialDate){
 if(!Array.isArray(j?.tables))return [];
 const t=j.tables.find(t=>Array.isArray(t.fields)&&t.fields.some(f=>String(f).includes('指數'))&&t.fields.some(f=>String(f).includes('收盤指數'))&&Array.isArray(t.data));
 if(!t)return [];
 const ix=s=>t.fields.findIndex(f=>String(f).includes(s));
 const name=ix('指數'),close=ix('收盤指數'),diff=ix('漲跌點數'),sign=ix('漲跌(+/-)'),ratio=ix('漲跌百分比');
 const text=x=>String(x??'').replace(/<[^>]*>/g,'').trim();
 const row=t.data.find(r=>text(r[name])==='發行量加權股價指數');
 if(!row)return [];
 const v=num(text(row[close]));if(v===null)return [];
 const symbol=sign>=0?text(row[sign]):text(row[diff]);
 const d=num(text(row[diff])),p=num(text(row[ratio]));
 const factor=symbol.startsWith('-')?-1:symbol.startsWith('+')?1:null;
 return [{name:'發行量加權股價指數',date:officialDate,value:v,change:d!==null&&factor!==null?d*factor:null,pct:p===null?null:(p<0?p:(factor!==null?p*factor:null))}];
}
function listedInstitutions(j){
 const m=new Map(); if(!Array.isArray(j?.data)||!Array.isArray(j?.fields))return m;
 const keys=j.fields.map(s=>key(s));
 const at=s=>keys.findIndex(x=>x===key(s));
 const fi=at('外陸資買賣超股數(不含外資自營商)'), ti=at('投信買賣超股數');
 const fd=at('外資自營商買賣超股數'),di=at('自營商買賣超股數(自行買賣)'),dh=at('自營商買賣超股數(避險)');
 if(fi<0||ti<0) return m;
 for(const a of j.data){const c=code(a[0]);if(!c)continue;const f=num(a[fi]),t=num(a[ti]);const f2=fd<0?0:num(a[fd]);const d1=di<0?null:num(a[di]),d2=dh<0?null:num(a[dh]);
  m.set(c,{foreign:f===null?null:lots(f+(f2??0)),trust:lots(t),dealer:d1===null||d2===null?null:lots(d1+d2)});
 }
 return m;
}
function otcInstitutions(a){
 const m=new Map();if(!Array.isArray(a))return m;
 for(const r of a){
  const c=code(field(r,['SecuritiesCompanyCode','SecuritiesCode','StockCode','Code']));if(!c)continue;
  const f=num(field(r,['ForeignInvestorsIncludeMainlandAreaInvestors-Difference','ForeignInvestorsIncludeMainlandAreaInvestorsDifference','ForeignInvestorsDifference']));
  const t=num(field(r,['InvestmentTrust-Difference','InvestmentTrustDifference','SecuritiesInvestmentTrustCompanies-Difference']));
  const d=num(field(r,['DealerDifference','DealersDifference','Dealers-Difference']));
  if(f!==null||t!==null||d!==null)m.set(c,{foreign:lots(f),trust:lots(t),dealer:lots(d)});
 }
 return m;
}
function revMap(a){
 const m=new Map();if(!Array.isArray(a))return m;
 for(const r of a){
  const c=code(field(r,['公司代號','公司代碼','CompanyCode','SecuritiesCompanyCode']));if(!c)continue;
  const mo=month(field(r,['資料年月','DataYearMonth','YearMonth']));
  const yoy=num(field(r,['營業收入-去年同月增減(%)','營業收入－去年同月增減(%)','YearOverYearRevenueChange','MonthlyRevenueYoY']));
  const mom=num(field(r,['營業收入-上月比較增減(%)','營業收入－上月比較增減(%)','MonthOverMonthRevenueChange','MonthlyRevenueMoM']));
  if(mo&&(yoy!==null||mom!==null))m.set(c,{revMonth:mo,revYoY:yoy,revMoM:mom});
 }
 return m;
}
function peMap(a){
 const m=new Map();if(!Array.isArray(a))return m;
 for(const r of a){const c=code(field(r,['Code','StockCode','證券代號'])),p=num(field(r,['PEratio','PERatio','本益比']));if(c&&p!==null&&p>0)m.set(c,p);}
 return m;
}
function indexMap(a,asOf){
 if(!Array.isArray(a))return [];
 return a.filter(r=>String(r['指數']??'')==='發行量加權股價指數'&&date(r['日期'])===asOf).slice(0,1).map(r=>{
 const sign=r['漲跌']==='-'?-1:1;return {name:String(r['指數']),date:asOf,value:num(r['收盤指數']),change:num(r['漲跌點數'])===null?null:num(r['漲跌點數'])*sign,pct:num(r['漲跌百分比'])===null?null:num(r['漲跌百分比'])*sign};
 });
}
function decodeXml(x) {
 return String(x??'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
}
function rssNvidia(xml) {
 const items=[];
 for(const match of String(xml).matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
  const x=match[1],read=tag=>{const m=x.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));return decodeXml(m?.[1]||'');};
  const title=read('title'),url=read('link'),rawDate=read('pubDate');
  const d=new Date(rawDate);
  if(!title||title.length>500||!Number.isFinite(d.valueOf()))continue;
  let valid=false;try{const u=new URL(url);valid=u.protocol==='https:'&&(u.hostname==='nvidianews.nvidia.com'||u.hostname==='www.nvidia.com'||u.hostname==='nvidia.com');}catch{}
  if(!valid)continue;
  items.push({date:d.toISOString().slice(0,10),time:d.toISOString(),title,url,category:'NVIDIA 官方新聞',source:'NVIDIA Newsroom',code:null});
 }
 return items.slice(0,24);
}
async function collectNews(){
 const feeds={
  listed:'https://openapi.twse.com.tw/v1/opendata/t187ap04_L',
  otc:'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap04_O',
  nvidia:'https://nvidianews.nvidia.com/rss.xml'
 };
 const res=await Promise.allSettled([
  getJSON(feeds.listed),
  getJSON(feeds.otc),
  fetch(feeds.nvidia,{signal:AbortSignal.timeout(25000)}).then(x=>{if(!x.ok)throw Error('HTTP '+x.status);return x.text();})
 ]);
 const status=Object.fromEntries(Object.entries(feeds).map(([k,url],i)=>[k,{ok:res[i].status==='fulfilled',url,error:res[i].status==='rejected'?String(res[i].reason.message).slice(0,120):null}]));
 const material=[];
 [0,1].forEach(i=>{
  const arr=res[i].status==='fulfilled'?res[i].value:null;
  if(!Array.isArray(arr))return;
  for(const r of arr){
   const c=code(field(r,['公司代號','公司代碼','Code']));
   const headline=String(field(r,['主旨','公告主旨'])??'').trim();
   const announced=date(field(r,['發言日期']));
   const facts=date(field(r,['事實發生日']));
   const time=String(field(r,['發言時間'])??'').replace(/\D/g,'').padStart(6,'0');
   if(!c||!headline||!announced)continue;
   material.push({date:announced,time:announced+'T'+time.slice(0,2)+':'+time.slice(2,4)+':'+time.slice(4,6),title:headline.slice(0,250),code:c,company:String(field(r,['公司名稱'])??'').trim(),eventDate:facts,source:i===0?'上市公司重大訊息':'上櫃公司重大訊息',category:'公司自行公告',url:i===0?feeds.listed:feeds.otc,tracked:WATCH.has(c)});
  }
 });
 material.sort((a,b)=>b.time.localeCompare(a.time));
 const watched=material.filter(x=>x.tracked).slice(0,38);
 const rest=material.filter(x=>!x.tracked).slice(0,10);
 const nvidia=res[2].status==='fulfilled'?rssNvidia(res[2].value):[];
 const items=[...watched,...nvidia,...rest].sort((a,b)=>String(b.time).localeCompare(String(a.time))).slice(0,65);
 return {generatedAt:new Date().toISOString(),items,sourceStatus:status,disclaimer:'本清單僅轉載官方公司公告標題與 NVIDIA 新聞室原文標題，不等同獨立查證、投資意見或全面新聞掃描。發言日期與事實發生日分開顯示。'};
}
async function main(){
 const fetched=await Promise.allSettled(Object.values(URLS).map(getJSON));
 const raw={},sourceStatus={};
 Object.entries(URLS).forEach(([name,url],i)=>{
  const good=fetched[i].status==='fulfilled';
  raw[name]=good?fetched[i].value:null;
  sourceStatus[name]={ok:good,url,error:good?null:String(fetched[i].reason.message||'擷取失敗').slice(0,100)};
 });
 let listed=pricesListed(raw.twsePrices);
 const otc=pricesOtc(raw.tpexPrices);
 const latestListed=listed.map(x=>x.date).filter(Boolean).sort().at(-1);
 const latestOtc=otc.map(x=>x.date).filter(Boolean).sort().at(-1);
 let rwdIndex=[];
 if(latestOtc&&(!latestListed||latestListed<latestOtc)){
  const rwdUrl='https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date='+latestOtc.replace(/-/g,'')+'&type=ALLBUT0999&response=json';
  try{
    const rwd=await getJSON(rwdUrl),fallback=pricesRwd(rwd,latestOtc);
    rwdIndex=indicesRwd(rwd,latestOtc);
    if(fallback.length>=500){
      listed=fallback;
      sourceStatus.twsePrices={ok:true,url:rwdUrl,error:null,note:'上市當日行情改由 TWSE 官方日期查詢補齊'};
    }else{
      console.warn('TWSE RWD fallback produced',fallback.length,'valid records');
    }
  }catch(e){console.warn('TWSE RWD fallback error:',e.message);}
 }
 if(listed.length<500&&otc.length<300)throw new Error('Listed and OTC snapshots unavailable; will not overwrite good data');
 const asOf=[...listed,...otc].map(x=>x.date).filter(Boolean).sort().at(-1);
 if(!asOf)throw new Error('No trustworthy trade date');
 // Never merge listed and OTC prices from different trading days.
 const rows=[...listed,...otc].filter(r=>r.date===asOf);
 if(listed.length&&listed[0].date!==asOf)sourceStatus.twsePrices={...sourceStatus.twsePrices,ok:false,error:'上市資料日期落後，未合併'};
 if(otc.length&&otc[0].date!==asOf)sourceStatus.tpexPrices={...sourceStatus.tpexPrices,ok:false,error:'上櫃資料日期落後，未合併'};
 if(rows.length<300)throw new Error('Insufficient aligned price records');
 // TWSE T86 is date-scoped, not a generic latest-record feed.
 const t86Url='https://www.twse.com.tw/rwd/zh/fund/T86?date='+asOf.replace(/-/g,'')+'&selectType=ALLBUT0999&response=json';
 let t86=null;
 try{t86=await getJSON(t86Url);sourceStatus.twseInst={ok:t86?.stat==='OK',url:t86Url,error:t86?.stat==='OK'?null:'交易所暫未公布或回傳錯誤'};}
 catch(e){sourceStatus.twseInst={ok:false,url:t86Url,error:String(e.message).slice(0,100)};}
 const li=listedInstitutions(t86),oi=otcInstitutions(raw.tpexInst),lr=revMap(raw.twseRevenue),or=revMap(raw.tpexRevenue),pm=peMap(raw.twsePe);
 // These latest-only endpoints require date alignment, or institutional fields are withheld.
 const oiDate=date(field(raw.tpexInst?.[0],['Date','TradingDate','TradeDate']));
 if(!oiDate||oiDate!==asOf){oi.clear();sourceStatus.tpexInst={...sourceStatus.tpexInst,ok:false,error:oiDate?'法人資料日期不同':'無法驗證法人日期'};}
 const indexDate=date(raw.twseIndex?.[0]?.['日期']);
 if(rwdIndex.length){sourceStatus.twseIndex={ok:true,url:'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date='+asOf.replace(/-/g,'')+'&type=ALLBUT0999&response=json',error:null};}
 else if(indexDate&&indexDate!==asOf){sourceStatus.twseIndex={...sourceStatus.twseIndex,ok:false,error:'指數日期不符'};}
 const resultRows=rows.map(r=>{
  const inst=(r.market==='上市'?li:oi).get(r.code)||{};
  const rev=(r.market==='上市'?lr:or).get(r.code)||{};
  return {...r,...inst,...rev,pe:r.market==='上市'?(pm.get(r.code)??null):null};
 });
 const summary={total:resultRows.length,up:resultRows.filter(x=>x.pct!==null&&x.pct>0).length,down:resultRows.filter(x=>x.pct!==null&&x.pct<0).length,flat:resultRows.filter(x=>x.pct===0).length,withInst:resultRows.filter(x=>x.foreign!==null&&x.trust!==null).length,withRevenue:resultRows.filter(x=>x.revYoY!==null).length};
 const snapshot={asOf,generatedAt:new Date().toISOString(),indices:rwdIndex.length?rwdIndex:indexMap(raw.twseIndex,asOf),rows:resultRows,summary,sourceStatus,origin:'official',disclaimer:'交易所官方盤後資料，非即時行情；法人買賣超以張為單位。若某來源日期不一致或無法驗證，會保留空值。'};
 await fs.mkdir(ROOT,{recursive:true});
 const latestFile=path.join(ROOT,'latest.json'),seriesFile=path.join(ROOT,'series.json');
 let prior=null,series=[];
 try{prior=JSON.parse(await fs.readFile(latestFile,'utf8'));}catch{}
 try{series=JSON.parse(await fs.readFile(seriesFile,'utf8'));if(!Array.isArray(series))series=[];}catch{}
 if(prior?.asOf&&prior.asOf>asOf)throw new Error('New data is older than published data; aborting');
 // Keep globally shared tracking history small, preserve only verified data and timestamps.
 const short={date:asOf,rows:Object.fromEntries(resultRows.filter(x=>WATCH.has(x.code)).map(x=>[x.code,{foreign:x.foreign,trust:x.trust,close:x.close,pct:x.pct}]))};
 series=series.filter(x=>x.date!==asOf);
 series.push(short);series.sort((a,b)=>b.date.localeCompare(a.date));series=series.slice(0,80);
 await fs.writeFile(latestFile,JSON.stringify(snapshot)+'\n');
 await fs.writeFile(seriesFile,JSON.stringify({asOf,generatedAt:snapshot.generatedAt,days:series})+'\n');
 try{
  const news=await collectNews();
  if(news.items.length){
   await fs.writeFile(path.join(ROOT,'news.json'),JSON.stringify(news)+'\n');
   console.log('Official announcements and NVIDIA news:',news.items.length);
  }else console.warn('No official news found; previous news archive preserved.');
 }catch(e){console.warn('Official news sync failed:',e.message);}

 console.log(JSON.stringify({asOf,total:summary.total,withInst:summary.withInst,withRevenue:summary.withRevenue,sources:sourceStatus},null,2));
}
main().catch(e=>{console.error('SYNC FAILED:',e);process.exitCode=1;});
