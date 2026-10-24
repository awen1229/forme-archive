/* GOOD THINGS / Original logo only. Isolate connected ink components from
   the existing PNG; no font substitution, path reconstruction or vector redraw.
   The comma outline is the actual comma's alpha silhouette. */
(()=>{
'use strict';
const root=document.documentElement,overlay=document.getElementById('gt-scroll-entry');
const home=()=>!location.hash||location.hash==='#'||location.hash==='#/';
if(!overlay||!root.classList.contains('gt-scroll-entry-ready')||!home())return;
const stage=overlay.querySelector('.gt-scroll-entry-logo-stage');
const sculpture=overlay.querySelector('.gt-scroll-entry-sculpture');
const largeComma=overlay.querySelector('.gt-scroll-entry-comma-backdrop');
const caption=overlay.querySelector('.gt-scroll-entry-caption');
const bar=overlay.querySelector('.gt-scroll-entry-progress i'),pct=overlay.querySelector('.gt-scroll-entry-percent');
const source=document.querySelector('.site-header .gt-brand-logo');
if(!stage||!largeComma||!source){root.classList.remove('gt-scroll-entry-ready');overlay.remove();return}
let parts=[],full=null,commaBox=null,commaRail=[],p=0,frame=0,ended=false,startTouch=null,wheelTime=0;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const range=(v,a,b)=>clamp((v-a)/(b-a));
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function extractOriginal(){
 return new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=source.src;
 }).then(img=>{
  const W=img.naturalWidth,H=img.naturalHeight;
  if(W*H>2500000)throw Error('large logo');
  const original=makeCanvas(W,H),ctx=original.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0);const rgba=ctx.getImageData(0,0,W,H).data;
  // Connected ink components are the real painted glyphs. Use a low alpha
  // threshold so antialiased edges are retained in each extracted crop.
  const mask=new Uint8Array(W*H),seen=new Uint8Array(W*H),labels=new Uint16Array(W*H),stack=new Int32Array(W*H);
  let nextId=0;
  for(let i=0;i<mask.length;i++)mask[i]=rgba[i*4+3]>24?1:0;
  const comps=[];
  for(let start=0;start<mask.length;start++){
   if(!mask[start]||seen[start])continue;
   const id=++nextId;
   let head=0,tail=1,minX=W,minY=H,maxX=0,maxY=0;
   stack[0]=start;seen[start]=1;
   while(head<tail){
    const n=stack[head++],x=n%W,y=(n/W)|0;
    labels[n]=id;
    if(x<minX)minX=x;if(x>maxX)maxX=x;
    if(y<minY)minY=y;if(y>maxY)maxY=y;
    const neighbors=[n-1,n+1,n-W,n+W];
    for(let k=0;k<4;k++){
     const nx=k===0?x-1:k===1?x+1:x,ny=k===2?y-1:k===3?y+1:y;
     if(nx<0||nx>=W||ny<0||ny>=H)continue;
     const j=neighbors[k];if(mask[j]&&!seen[j]){seen[j]=1;stack[tail++]=j}
    }
   }
   if(tail>150){
    const padding=3,x=Math.max(0,minX-padding),y=Math.max(0,minY-padding);
    const right=Math.min(W,maxX+padding+1),bottom=Math.min(H,maxY+padding+1);
    comps.push({x,y,w:right-x,h:bottom-y,area:tail,seed:start,id});
   }
  }
  // The separate comma at the bottom-right has the greatest horizontal
  // extent among eligible lower-half components.
  const comma=comps.filter(c=>c.x>W*.78&&c.y>H*.50).sort((a,b)=>b.x-a.x)[0];
  if(!comma||comps.length<10)throw Error('logo ink components not separable');
  const letterComps=comps.filter(c=>c!==comma && c.area>500).sort((a,b)=>{
   const rowA=a.y<H*.46?0:1,rowB=b.y<H*.46?0:1;
   return rowA-rowB||a.x-b.x;
  });
  if(letterComps.length!==10)throw Error('unexpected glyph segmentation '+letterComps.length);
  // Include only pixels belonging to this original glyph component.
  // A rectangular crop alone can carry slivers of adjacent letters.
  function bitmap(c){
   const canvas=makeCanvas(c.w,c.h),cc=canvas.getContext('2d');
   cc.drawImage(original,c.x,c.y,c.w,c.h,0,0,c.w,c.h);
   const data=cc.getImageData(0,0,c.w,c.h);
   for(let y=0;y<c.h;y++)for(let x=0;x<c.w;x++){
    const k=(y*c.w+x)*4,g=(y+c.y)*W+x+c.x;
    if(labels[g]===c.id)continue;
    // Preserve antialiasing only adjacent to the same glyph's hard edge.
    let edge=false;
    if(rgba[g*4+3]<28){
     for(let dy=-1;dy<=1&&!edge;dy++)for(let dx=-1;dx<=1;dx++){
      const yy=y+c.y+dy,xx=x+c.x+dx;
      if(xx>=0&&xx<W&&yy>=0&&yy<H&&labels[yy*W+xx]===c.id){edge=true;break}
     }
    }
    if(!edge)data.data[k+3]=0;
   }
   cc.putImageData(data,0,0);
   return canvas.toDataURL('image/png');
  }
  full=document.createElement('img');full.src=source.src;full.alt='GOOD THINGS,';
  full.className='gt-scroll-entry-full-logo';stage.append(full);
  parts=letterComps.map((c,i)=>{
   const img=document.createElement('img');img.src=bitmap(c);img.alt='';
   const el=document.createElement('span');el.className='gt-scroll-entry-piece';
   el.style.left=(c.x/W*100)+'%';el.style.top=(c.y/H*100)+'%';
   el.style.width=(c.w/W*100)+'%';el.style.height=(c.h/H*100)+'%';
   el.append(img);stage.append(el);return el;
  });
  // Isolate ONLY the connected component belonging to the original comma.
  // The previous rectangular raster crop could contain nearby S pixels and
  // was enlarged 5x, causing dirty edges and visible blur.
  commaBox={...comma,sourceW:W,sourceH:H};
  const ww=comma.w,hh=comma.h,ink=new Uint8Array(ww*hh);
  const visited=new Uint8Array(W*H),q=new Int32Array(comma.area+20);
  let front=0,back=1;
  q[0]=comma.seed;visited[comma.seed]=1;
  while(front<back){
   const i=q[front++],x=i%W,y=(i/W)|0;
   const lx=x-comma.x,ly=y-comma.y;
   if(lx<0||ly<0||lx>=ww||ly>=hh)throw Error('Comma component exceeded crop bounds');
   ink[ly*ww+lx]=1;
   const neighbors=[x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1];
   for(const n of neighbors)if(n>=0&&mask[n]&&!visited[n]){
    if(back>=q.length)throw Error('Comma trace exceeded measured component');
    visited[n]=1;q[back++]=n;
   }
  }
  if(back<400||back>ww*hh*.92)throw Error('Invalid original comma shape');
  const filled=(x,y)=>x>=0&&y>=0&&x<ww&&y<hh&&ink[y*ww+x]===1;
  // Trace the connected component as a closed vector contour. Only genuine
  // comma pixels participate, so neighboring letters cannot leak into it.
  const ends=new Map(),edges=[];
  const key=(x,y)=>y*(ww+1)+x;
  function edge(x1,y1,x2,y2){
   const k=key(x1,y1),id=edges.length;
   edges.push({x1,y1,x2,y2,used:false});
   const list=ends.get(k);if(list)list.push(id);else ends.set(k,[id]);
  }
  for(let y=0;y<hh;y++)for(let x=0;x<ww;x++){
   if(!filled(x,y))continue;
   if(!filled(x,y-1))edge(x,y,x+1,y);
   if(!filled(x+1,y))edge(x+1,y,x+1,y+1);
   if(!filled(x,y+1))edge(x+1,y+1,x,y+1);
   if(!filled(x-1,y))edge(x,y+1,x,y);
  }
  const contours=[];
  for(let i=0;i<edges.length;i++){
   if(edges[i].used)continue;
   let current=i,loops=0,points=[];
   const first=key(edges[i].x1,edges[i].y1);
   while(++loops<=edges.length){
    const step=edges[current];if(step.used)break;
    step.used=true;points.push([step.x1,step.y1]);
    const dest=key(step.x2,step.y2);
    if(dest===first)break;
    const options=ends.get(dest)||[];
    const next=options.find(idx=>!edges[idx].used);
    if(next===undefined)break;
    current=next;
   }
   if(points.length>10){
    let area=0;
    for(let j=0;j<points.length;j++){
     const c=points[j],n=points[(j+1)%points.length];
     area+=c[0]*n[1]-n[0]*c[1];
    }
    contours.push({points,area:Math.abs(area)});
   }
  }
  contours.sort((a,b)=>b.area-a.area);
  const outline=contours[0]?.points;
  if(!outline||contours[0].area<ww*hh*.03)throw Error('No usable comma outline');
  // Smooth the original comma silhouette at the source-image scale.
  // Previous midpoint quads still traced every one-pixel stair step.
  // A closed Gaussian filter followed by coarse sampling and Catmull–Rom
  // cubics gives flowing curves while keeping the logo's broad silhouette.
  const ring=outline.slice();
  const gaussian=[];
  for(let k=-19;k<=19;k++)gaussian.push(Math.exp(-.5*Math.pow(k/6.8,2)));
  const weight=gaussian.reduce((a,b)=>a+b,0);
  const softened=ring.map((_,i)=>{
   let x=0,y=0;
   for(let k=-19;k<=19;k++){
    const p=ring[(i+k+ring.length)%ring.length],w=gaussian[k+19];
    x+=p[0]*w;y+=p[1]*w;
   }
   return [x/weight,y/weight];
  });
  const sampled=[];
  const step=Math.max(4,Math.round(softened.length/90));
  for(let i=0;i<softened.length;i+=step)sampled.push(softened[i]);
  if(sampled.length<14)throw Error('Not enough points for smooth comma outline');
  const crisp=n=>Number(n.toFixed(2));
  let d='M'+crisp(sampled[0][0])+' '+crisp(sampled[0][1]);
  for(let i=0;i<sampled.length;i++){
   const p0=sampled[(i+sampled.length-1)%sampled.length];
   const p1=sampled[i],p2=sampled[(i+1)%sampled.length];
   const p3=sampled[(i+2)%sampled.length];
   // Lower tangent tension deliberately removes the sawtooth effect.
   const tension=.16;
   const c1x=p1[0]+(p2[0]-p0[0])*tension;
   const c1y=p1[1]+(p2[1]-p0[1])*tension;
   const c2x=p2[0]-(p3[0]-p1[0])*tension;
   const c2y=p2[1]-(p3[1]-p1[1])*tension;
   d+=' C'+crisp(c1x)+' '+crisp(c1y)+' '+crisp(c2x)+' '+crisp(c2y)+' '+crisp(p2[0])+' '+crisp(p2[1]);
  }
  d+=' Z';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+ww+' '+hh+'" width="'+ww+'" height="'+hh+'" shape-rendering="geometricPrecision">'+
   '<path d="'+d+'" fill="none" stroke="#397541" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  largeComma.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  largeComma.dataset.originalComma='smooth-vector';
  
  // Measure the connected ink in each source-image row. The letters can
  // follow the ACTUAL inside-right curve, instead of a rectangle-relative
  // guessed Bezier that escapes the comma.
  const rows=Array.from({length:hh},()=>({left:ww,right:-1}));
  for(let y=0;y<hh;y++)for(let x=0;x<ww;x++){
   if(!ink[y*ww+x])continue;
   const row=rows[y];if(x<row.left)row.left=x;if(x>row.right)row.right=x;
  }
  // Fill sparse rows without jumping across gaps.
  for(let y=0;y<hh;y++)if(rows[y].right<0){
   let before=y-1,after=y+1;
   while(before>=0&&rows[before].right<0)before--;
   while(after<hh&&rows[after].right<0)after++;
   if(before>=0&&after<hh){
    const t=(y-before)/(after-before);
    rows[y]={left:rows[before].left*(1-t)+rows[after].left*t,
             right:rows[before].right*(1-t)+rows[after].right*t};
   }else if(before>=0)rows[y]={...rows[before]};
   else if(after<hh)rows[y]={...rows[after]};
  }
  commaRail=rows.map((_,y)=>{
   let left=0,right=0,n=0;
   for(let dy=-5;dy<=5;dy++){
    const row=rows[Math.max(0,Math.min(hh-1,y+dy))];
    if(row.right<0)continue;
    const w=1+5-Math.abs(dy);
    left+=row.left*w;right+=row.right*w;n+=w;
   }
   const a=n?left/n:ww*.4,b=n?right/n:ww*.6;
   const span=Math.max(1,b-a),center=a+span*.77;
   return {x:center/ww,width:span/ww,
    clearance:2*Math.min(center-a,b-center)/ww,y:y/hh};
  });
    largeComma.dataset.originalComma='vector-trace';

 });
}
// GOOD THINGS, / V13 CONSTANT-SPACING COMMA TRACK
// Letter movement is based on distance along ONE sampled arc-length track,
// not individually eased segments. This prevents bunching at tight bends.
// The user's red guideline is a motion reference, never a visible element.
const trackCache={key:'',points:null,length:0};
function bezier(a,b,c,d,t){
 const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;
}
function buildTrack(cx,cy,w,h,bounds){
 const key=[cx,cy,w,h,bounds.left,bounds.right].map(v=>Math.round(v)).join(':');
 if(trackCache.key===key&&trackCache.points)return trackCache;
 // From upper-left, glide through the upper-right interior, sweep down
 // the comma's RIGHT bowl and smoothly leave beyond the LEFT viewport.
 // These points scale with the unchanged original comma's bounding box.
 const outside=bounds.left-100;
 const C=(x,y)=>({x:cx+x*w,y:cy+y*h});
 const p0={x:outside,y:cy-h*.91};
 const p1=C(-.61,-.74);
 const p2=C(.245,-.35);
 const p3=C(.345,.025);
 const p4=C(.055,.315);
 const p5={x:outside,y:cy+h*.54};
 const curves=[
  [p0,{x:bounds.left+Math.min(48,w*.23),y:cy-h*.89},
      C(-.82,-.83),p1],
  [p1,C(-.32,-.64),C(.135,-.49),p2],
  [p2,C(.355,-.25),C(.385,-.105),p3],
  [p3,C(.295,.18),C(.18,.25),p4],
  [p4,C(-.24,.44),{x:bounds.left+Math.min(77,w*.39),y:cy+h*.55},p5]
 ];
 const points=[];let length=0,prev=null;
 for(const seg of curves){
  for(let j=0;j<=48;j++){
   if(points.length&&j===0)continue;
   const t=j/48;
   const x=bezier(seg[0].x,seg[1].x,seg[2].x,seg[3].x,t);
   const y=bezier(seg[0].y,seg[1].y,seg[2].y,seg[3].y,t);
   if(prev)length+=Math.hypot(x-prev.x,y-prev.y);
   const item={x,y,d:length};points.push(item);prev=item;
  }
 }
 Object.assign(trackCache,{key,points,length});
 return trackCache;
}
function atDistance(track,d){
 const pts=track.points;
 if(d<=0)return pts[0];
 if(d>=track.length)return pts[pts.length-1];
 let lo=0,hi=pts.length-1;
 while(lo+1<hi){
  const mid=(lo+hi)>>1;
  if(pts[mid].d<d)lo=mid;else hi=mid;
 }
 const a=pts[lo],b=pts[hi];
 const f=(d-a.d)/Math.max(.00001,b.d-a.d);
 return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
}
function paint(){
 frame=0;if(ended)return;
 const sr=sculpture.getBoundingClientRect(),lr=stage.getBoundingClientRect();
 const bounds=overlay.getBoundingClientRect();
 const original=commaBox||{w:1,h:1};
 const iw=largeComma.offsetWidth||260,ih=largeComma.offsetHeight||440;
 const aspect=original.w/original.h;
 const w=Math.min(iw,ih*aspect),h=Math.min(ih,iw/aspect);
 const cx=sr.left+sr.width*.5,cy=sr.top+sr.height*.47;
 const track=buildTrack(cx,cy,w,h,bounds);
 // Keep original curved comma dominant until most letters have exited.
 const commaFade=smooth(range(p,.69,.90));
 largeComma.style.opacity=String(.88*(1-commaFade));
 largeComma.style.transform='translate(-50%,-50%) scale('+
  (1+.025*smooth(range(p,.02,.28))-.025*commaFade)+')';
 // Final composite uses original PNG without reconstructing its shapes.
 const intact=smooth(range(p,.986,.999));
 const maxDiagonal=Math.max(1,...parts.map(el=>Math.hypot(el.offsetWidth,el.offsetHeight)));
 // V13: modestly larger glyphs, closer spacing while keeping a gap around bends.
 const targetGlyphPx=clamp(w*.132,22,31);
 const glideScale=clamp(targetGlyphPx/maxDiagonal,.26,.58);
 const letterGap=Math.max(28,targetGlyphPx*1.55);
 // Every letter follows exactly the same physical distance profile,
 // separated by a stable interval. No crowding at the entrance or turn.
 const leadingDistance=range(p,.035,.72)*(track.length+(parts.length-1)*letterGap);
 const returnStart=.746,returnStagger=.012,returnDuration=.125;
 parts.forEach((el,i)=>{
  const homeX=lr.left+el.offsetLeft+el.offsetWidth*.5;
  const homeY=lr.top+el.offsetTop+el.offsetHeight*.5;
  const distance=leadingDistance-i*letterGap;
  const returnT=range(p,returnStart+i*returnStagger,
                         returnStart+i*returnStagger+returnDuration);
  const returning=p>=returnStart+i*returnStagger;
  let pos,scale=glideScale,opacity=0;
  if(returning){
   // Re-enter individually from fully beyond the RIGHT edge, then settle
   // into the exact position of each original glyph.
   const u=smooth(returnT);
   const offRight=bounds.right+Math.max(100,maxDiagonal);
   const approach=homeX+Math.min(115,bounds.width*.19);
   pos={
    x:bezier(offRight,bounds.right+30,approach,homeX,u),
    y:bezier(homeY-h*.065,homeY-h*.035,homeY,homeY,u)
   };
   scale=glideScale+(1-glideScale)*u;
   opacity=1-intact;
  }else{
   pos=atDistance(track,distance);
   // The start and end of the path are physically off-screen.
   opacity=(distance>=0&&distance<=track.length)?1:0;
  }
  el.style.opacity=String(opacity);
  el.style.transform='translate3d('+(pos.x-homeX).toFixed(2)+'px,'+
   (pos.y-homeY).toFixed(2)+'px,0) scale('+scale.toFixed(3)+')';
 });
 if(full)full.style.opacity=String(intact);
 caption.style.opacity=String(smooth(range(p,.87,.965)));
 const out=smooth(range(p,.977,1));
 sculpture.style.opacity=String(1-.08*out);
 overlay.style.transform='translate3d(0,'+(-12*out)+'%,0)';
 bar.style.transform='scaleX('+p+')';
 pct.textContent=Math.round(p*100)+'%';
}
function request(){if(!frame)frame=requestAnimationFrame(paint)}
function cleanup(){
 if(overlay.dataset.cleanup)return;overlay.dataset.cleanup='1';
 root.classList.remove('gt-scroll-entry-ready');overlay.remove();
 window.removeEventListener('wheel',wheel,true);
 window.removeEventListener('touchstart',touchStart,true);
 window.removeEventListener('touchmove',touchMove,true);
 window.removeEventListener('keydown',key);
 window.scrollTo(0,0);
}
function finish(){
 if(ended)return;ended=true;cancelAnimationFrame(frame);
 try{sessionStorage.setItem('gt-scroll-entry-v13','done')}catch{}
 overlay.classList.add('is-completing');overlay.style.removeProperty('transform');
 overlay.addEventListener('transitionend',e=>{if(e.target===overlay)cleanup()},{once:true});
 setTimeout(cleanup,580);
}
function move(amount){if(ended)return;p=clamp(p+amount);if(p>=.999)finish();else request()}
function wheel(e){
 if(ended)return;e.preventDefault();
 const now=performance.now();if(now-wheelTime<5)return;wheelTime=now;
 move(clamp(e.deltaY*(e.deltaMode===1?19:e.deltaMode===2?innerHeight:1),-180,180)/1120);
}
function touchStart(e){startTouch=e.changedTouches[0]?.clientY??null}
function touchMove(e){
 if(ended||startTouch===null)return;e.preventDefault();
 const y=e.changedTouches[0]?.clientY??startTouch;move((startTouch-y)/Math.max(700,innerHeight*1.6));startTouch=y;
}
function key(e){
 if(ended||e.target?.closest?.('.gt-scroll-entry-skip'))return;
 if(['ArrowDown','PageDown',' ','Enter'].includes(e.key)){e.preventDefault();move(e.key==='ArrowDown'?.13:.27)}
 else if(['ArrowUp','PageUp'].includes(e.key)){e.preventDefault();move(-.15)}
 else if(e.key==='Escape'){e.preventDefault();finish()}
}
window.addEventListener('wheel',wheel,{passive:false,capture:true});
window.addEventListener('touchstart',touchStart,{passive:true,capture:true});
window.addEventListener('touchmove',touchMove,{passive:false,capture:true});
window.addEventListener('touchend',()=>startTouch=null,{passive:true});
window.addEventListener('keydown',key);
overlay.querySelector('.gt-scroll-entry-skip')?.addEventListener('click',finish);
window.addEventListener('hashchange',()=>{if(!home())finish()},{once:true});
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',e=>{if(e.matches)finish()},{once:true});
const fallback=()=>{
 // If original-logo segmentation fails, render intact source artwork.
 if(!full){full=document.createElement('img');full.src=source.src;full.alt='GOOD THINGS,';full.className='gt-scroll-entry-full-logo';stage.append(full);}
 full.style.opacity='1';
 largeComma.style.opacity='0';
};
extractOriginal().then(request).catch(error=>{console.warn('Using intact original LOGO fallback',error);fallback();request()});
})();
