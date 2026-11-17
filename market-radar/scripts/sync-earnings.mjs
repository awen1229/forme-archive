/**
 * Official Taiwan EPS financial statements -> published cumulative YTD EPS.
 * Separately computes optional mechanical EPS scenarios, NEVER broker consensus.
 * All financial estimates are tagged as automated extrapolation.
 */
import fs from "node:fs/promises";
const dir="market-radar/data";
const urlBase={twse:"https://openapi.twse.com.tw/v1/opendata/t187ap06_L_",tpex:"https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap06_O_"};
const segments=["ci","basi","fh","ins","bd","mim"];
const now=new Date().toISOString();
const readNum=v=>{const s=String(v??"").replace(/,/g,"").trim();return s===""||s==="--"?null:Number.isFinite(Number(s))?Number(s):null;};
const find=(r,regex)=>{for(const [k,v] of Object.entries(r||{}))if(regex.test(k))return v;return undefined;};
async function json(url) {
 const response=await fetch(url,{signal:AbortSignal.timeout(23000),headers:{"accept":"application/json","user-agent":"MarketRadar/1.0 (official Taiwan OpenAPI financial disclosures)"}});
 if(!response.ok)throw Error("HTTP "+response.status);
 const data=await response.json();
 if(!Array.isArray(data))throw Error("not an array");
 return data;
}
function parse(r,url,sector){
 const code=String(r["公司代號"]??"").trim(),fy=readNum(r["年度"]),q=readNum(r["季別"]),eps=readNum(find(r,/^基本每股盈餘/)),rev=readNum(find(r,/^營業收入$/)),op=readNum(find(r,/^營業利益/)),gross=readNum(find(r,/^營業毛利（毛損）淨額$/))??readNum(find(r,/^營業毛利（毛損）$/));
 if(!/^\d{4}$/.test(code)||!Number.isInteger(fy)||!Number.isInteger(q)||q<1||q>4||eps===null||fy<110||fy>140)return null;
 const reportYear=fy+1911;
 const period=reportYear+"Q"+q;
 return {code,name:String(r["公司名稱"]||code),reportYear,quarter:q,period,epsYtd:eps,epsKind:"已公告當年度累計EPS（非單季、非TTM）",revenueYtd:rev,operatingMargin:rev!==null&&rev>0&&op!==null?Math.round(op/rev*10000)/100:null,grossMargin:rev!==null&&rev>0&&gross!==null?Math.round(gross/rev*10000)/100:null,source:url,segment:sector,extractedAt:now};
}
function model(row,market){
 // Scenario for comparing sensitivity only. NO model when EPS is negative or period too thin.
 if(!row||row.quarter<2||row.epsYtd<=0||row.reportYear<2024||row.reportYear>2028)return null;
 const revYoY=Number(market?.revYoY);
 if(!Number.isFinite(revYoY))return null;
 const growth=Math.max(-0.18,Math.min(0.18,revYoY/100*0.30));
 const base=row.epsYtd*4/row.quarter; // YTD annualization, not annual EPS or TTM
 const values={};
 for(const year of [2027,2028]){
  const delta=year-row.reportYear;
  values[year]=delta>=0&&delta<=3?Math.round(base*Math.pow(1+growth,delta)*100)/100:null;
 }
 return {
  label:"機械式情境，並非法人共識或買賣建議",
  eps2027:values[2027],eps2028:values[2028],
  anchorYear:row.reportYear,anchorQuarter:row.quarter,anchorEpsYtd:row.epsYtd,
  annualization:Math.round(base*100)/100,assumedEpsGrowthPct:Math.round(growth*10000)/100,
  inputRevenueYoYPct:revYoY,sourcePeriod:market?.revMonth||null,
  method:"當年度累計EPS × 4 ÷ 已公告季數，再按 max(-18%,min(18%,月營收YoY×0.30)) 逐年延伸。無季節性調整、無法人意見、無盈餘品質校驗。"
 };
}
async function main(){
 let market={rows:[]};
 try{market=JSON.parse(await fs.readFile(dir+"/latest.json","utf8"));}catch{}
 const prices=new Map((market.rows||[]).map(r=>[r.code,r]));
 const endpoints=Object.entries(urlBase).flatMap(([k,base])=>segments.map(seg=>({k,seg,url:base+seg})));
 const outcomes=await Promise.allSettled(endpoints.map(x=>json(x.url)));
 const sourceStatus={},rows=new Map();
 outcomes.forEach((o,i)=>{
  const x=endpoints[i];
  sourceStatus[x.k+"_"+x.seg]={ok:o.status==="fulfilled",url:x.url,records:o.status==="fulfilled"?o.value.length:0,error:o.status==="rejected"?String(o.reason?.message||o.reason).slice(0,150):null};
  if(o.status!=="fulfilled")return;
  for(const item of o.value){
   const r=parse(item,x.url,x.k+"/"+x.seg);
   if(!r)continue;
   const old=rows.get(r.code);
   if(!old||r.reportYear>old.reportYear||(r.reportYear===old.reportYear&&r.quarter>old.quarter))rows.set(r.code,r);
  }
 });
 const completeness=Object.values(sourceStatus).filter(x=>x.ok).length;
 if(completeness<2||rows.size<200)throw Error("Too few valid financial statements: sources="+completeness+" companies="+rows.size);
 const data=Object.fromEntries([...rows].map(([code,r])=>[code,{...r,scenario:model(r,prices.get(code))}]));
 const output={schema:1,generatedAt:now,disclaimer:"公開財報為已公告年度累計EPS（非單季、非TTM）。2027與2028值若有顯示，全部是機械式延伸情境，不是任何分析師預估。券商共識需另取得合法授權資料。",consensus:{status:"not_connected",provider:null,note:"尚未連接有授權的券商/法人預估資料源，不能使用模型結果冒充共識。"},sourceStatus,count:rows.size,companies:data};
 await fs.mkdir(dir,{recursive:true});
 let prior;
 try{prior=JSON.parse(await fs.readFile(dir+"/earnings.json","utf8"));}catch{}
 if(prior?.count>=rows.size*1.25 && Object.values(prior.sourceStatus||{}).filter(x=>x.ok).length>completeness){throw Error("Fewer financial sources than prior; previous snapshot preserved");}
 await fs.writeFile(dir+"/earnings.json",JSON.stringify(output)+"\n");
 console.log(JSON.stringify({count:rows.size,withModel:Object.values(data).filter(v=>v.scenario?.eps2027!==null&&v.scenario?.eps2027!==undefined).length,sources:sourceStatus},null,2));
}
main().catch(e=>{console.error("EPS SYNC FAILED",e);process.exitCode=1;});
