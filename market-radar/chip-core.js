/* MARKET RADAR history analytics. Uses only persisted, verified official days. */
(function(){
 'use strict';
 const state={days:[],asOf:null,windows:new Map()};
 function normalize(history,asOf){
  state.asOf=asOf||null;
  state.days=(Array.isArray(history)?history:[])
   .filter(d=>d&&typeof d.date==="string"&&d.rows&&(!state.asOf||d.date<=state.asOf))
   .sort((a,b)=>b.date.localeCompare(a.date));
  state.windows.clear();
 }
 function windowData(code,n,who){
  const id=code+"|"+n+"|"+who;
  if(state.windows.has(id))return state.windows.get(id);
  const x=state.days.slice(0,n);
  const ok=x.length===n&&x.every(d=>typeof d.rows?.[code]?.[who]==="number");
  const result=ok?x.map(d=>({date:d.date,foreign:d.rows[code].foreign,trust:d.rows[code].trust,volume:d.rows[code].volume,close:d.rows[code].close})):null;
  state.windows.set(id,result);
  return result;
 }
 function sum(code,n,who){
  const rows=windowData(code,n,who);
  return rows?Math.round(rows.reduce((s,r)=>s+r[who],0)*100)/100:null;
 }
 function stats(code,n,who){
  const rows=windowData(code,n,who);
  if(!rows)return null;
  const positive=rows.filter(x=>x[who]>0).length;
  const negative=rows.filter(x=>x[who]<0).length;
  const amount=sum(code,n,who);
  const volumeReady=rows.every(x=>Number.isFinite(x.volume)&&x.volume>0);
  const volume=volumeReady?rows.reduce((s,x)=>s+x.volume,0):null;
  return {net:amount,positive,negative,zero:n-positive-negative,
   portion:volume===null?null:Math.round(amount/volume*10000)/100,
   first:rows[rows.length-1].date,last:rows[0].date};
 }
 function streak(code,who){
  if(!state.days.length||typeof state.days[0]?.rows?.[code]?.[who]!=="number")return null;
  const sign=Math.sign(state.days[0].rows[code][who]);
  if(sign===0)return {kind:"平",days:0};
  let n=0;
  for(const d of state.days){const v=d.rows?.[code]?.[who];if(typeof v!=="number"||Math.sign(v)!==sign)break;n++;}
  return {kind:sign>0?"連買":"連賣",days:n};
 }
 function interpretation(code){
  const trust=sum(code,20,"trust"),foreign=sum(code,20,"foreign");
  if(trust===null||foreign===null)return "20日籌碼資料不足";
  if(trust>0&&foreign>0)return "投信、外資同步淨買";
  if(trust<0&&foreign<0)return "投信、外資同步淨賣";
  if(trust>0&&foreign<0)return "投信淨買、外資淨賣";
  if(trust<0&&foreign>0)return "外資淨買、投信淨賣";
  return "法人方向分歧或接近零";
 }
 window.MarketChip={init:normalize,window:windowData,sum,stats,streak,interpretation,
  get count(){return state.days.length},
  get newest(){return state.days[0]?.date||null},
  get oldest(){return state.days[state.days.length-1]?.date||null}};
})();
