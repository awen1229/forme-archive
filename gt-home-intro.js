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
let parts=[],full=null,commaBox=null,commaRail=[],commaOuterRail=[],p=0,frame=0,ended=false,startTouch=null,wheelTime=0;
let grainMask=null,grainField=null,grainPieces=[],grainPacking=null;
let autoplayFrame=0,autoplayStart=0,autoplayFrom=0,touchDragged=false;
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
  // The grains are copies of the extracted ORIGINAL glyphs, not a new font.
  grainField=document.createElement('div');
  grainField.className='gt-scroll-entry-grains';
  grainField.setAttribute('aria-hidden','true');
  sculpture.insertBefore(grainField,stage);
  grainPieces=parts.map(el=>{
   const piece=document.createElement('span');
   piece.className='gt-scroll-entry-grain';
   const image=document.createElement('img');
   image.src=el.firstElementChild.src;image.alt='';
   piece.append(image);grainField.append(piece);return piece;
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
  const maskSVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+ww+' '+hh+'"><path d="'+d+'" fill="white"/></svg>';
  const maskURL='url("data:image/svg+xml;charset=utf-8,'+encodeURIComponent(maskSVG)+'")';
  grainField.style.webkitMaskImage=maskURL;
  grainField.style.maskImage=maskURL;
  grainMask={ink,ww,hh};
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
  // Derive the outside-right edge from the ORIGINAL comma ink, not a
  // hand-drawn approximation. Smooth source pixels without altering its form.
  commaOuterRail=rows.map((_,y)=>{
   let right=0,total=0;
   for(let dy=-9;dy<=9;dy++){
    const index=clamp(y+dy,0,hh-1),row=rows[index];
    if(row.right<0)continue;
    const weight=Math.exp(-.5*Math.pow(dy/4.3,2));
    right+=row.right*weight;total+=weight;
   }
   return {x:clamp((total?right/total:ww*.78)/ww),y:y/Math.max(1,hh-1)};
  });
  largeComma.dataset.originalComma='vector-trace';

 });
}
// GOOD THINGS, / V17 ORIGINAL-LETTER GRANULAR COMMA STUDY.
// A fixed, seeded packing made from the actual original glyph bitmaps.
// The comma's actual traced ink is the containment mask. No traced guide
// line, fake character, or substitute logo is introduced.
// V18: ten original letter cutouts, one real comma contour. Inverted
// collection, upright release, exit LEFT, return from RIGHT, exact-logo finish.
const releaseTimes=Array.from({length:10},(_,i)=>.274+i*.031);
const reentryTimes=Array.from({length:10},(_,i)=>.674+i*.018);
const arrivalTimes=Array.from({length:10},(_,i)=>.884+i*.007);
const exitDuration=.188;
const clampPoint=(x,y,r,w,h)=>{
 if(!grainMask)return false;
 const {ink,ww,hh}=grainMask;
 const test=(px,py)=>{
  const ix=Math.floor(px/w*ww),iy=Math.floor(py/h*hh);
  return ix>=0&&iy>=0&&ix<ww&&iy<hh&&ink[iy*ww+ix]===1;
 };
 if(!test(x,y))return false;
 for(let j=0;j<12;j++){
  const a=j*Math.PI/6;
  if(!test(x+Math.cos(a)*r,y+Math.sin(a)*r))return false;
 }
 return true;
};
function generatePacking(w,h){
 const key=Math.round(w)+'x'+Math.round(h);
 if(grainPacking&&grainPacking.key===key)return grainPacking;
 let radius=Math.min(w*.064,h*.052,22),positions=null,initialPositions=null;
 // The source comma is upright: its broad upper bowl becomes the
 // lower "container" when rotated by 180 degrees at the opening.
 for(let attempt=0;attempt<15;attempt++){
  const candidates=[],step=Math.max(4,radius*.52);
  for(let y=h*.09;y<=h*.82;y+=step){
   for(let x=radius*1.15;x<w-radius*1.15;x+=step){
    const px=x+Math.sin(x*.083+y*.171)*step*.22;
    const py=y+Math.cos(x*.123-y*.079)*step*.13;
    if(!clampPoint(px,py,radius*1.08,w,h))continue;
    candidates.push({x:px,y:py});
   }
  }
  function choose(top){
   const sorted=candidates.slice().sort((a,b)=>
    (top?a.y-b.y:b.y-a.y)+Math.sin(a.x*.044+a.y*.025)*h*.003);
   const result=[];
   for(const q of sorted){
    if(result.every(x=>Math.hypot(q.x-x.x,q.y-x.y)>radius*2.16)){
     result.push({x:q.x,y:q.y});
     if(result.length===10)break;
    }
   }
   // Exit order follows the old pile nearest the pointed lower tail.
   return result.length===10?result:null;
  }
  const bottom=choose(false),top=choose(true);
  if(bottom&&top){
   positions=bottom;
   // Pair each initial letter with a release slot to prevent bunching.
   initialPositions=top.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
   break;
  }
  radius*=.92;
 }
 if(!positions||!initialPositions)throw Error('Original comma cannot fit ten letters');
 grainPacking={key,radius,positions,initialPositions};
 return grainPacking;
}
function bezier(a,b,c,d,t){
 const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;
}
function paint(){
 frame=0;if(ended)return;
 if(!grainMask){bar.style.transform='scaleX('+p+')';pct.textContent=Math.round(p*100)+'%';return;}
 const sr=sculpture.getBoundingClientRect(),lr=stage.getBoundingClientRect();
 const iw=largeComma.offsetWidth||260,ih=largeComma.offsetHeight||440;
 const aspect=grainMask.ww/grainMask.hh;
 const w=Math.min(iw,ih*aspect),h=Math.min(ih,iw/aspect);
 if(w<4||h<4)return;
 const cx=sr.left+sr.width*.5,cy=sr.top+sr.height*.47;
 let pack;
 try{pack=generatePacking(w,h)}
 catch(error){
  console.warn('Original glyph packing fallback',error);
  fallback();if(grainField)grainField.style.opacity='0';
  bar.style.transform='scaleX('+p+')';pct.textContent=Math.round(p*100)+'%';return;
 }
 const {radius}=pack;
 const orientation=180*(1-smooth(range(p,.024,.236)));
 const rad=orientation*Math.PI/180,co=Math.cos(rad),si=Math.sin(rad);
 const screen=(x,y)=>({
  x:cx+(x-w*.5)*co-(y-h*.5)*si,
  y:cy+(x-w*.5)*si+(y-h*.5)*co
 });
 // Both the comma and its precisely matched containment mask turn as one.
 // Counter-rotation lets individual letters stay readable while it flips.
 grainField.style.width=w+'px';grainField.style.height=h+'px';
 grainField.style.transform='translate(-50%,-50%) rotate('+orientation.toFixed(2)+'deg)';
 grainField.style.opacity=String(1-smooth(range(p,.715,.795)));
 const commaFade=smooth(range(p,.733,.825));
 largeComma.style.opacity=String(.88*(1-commaFade));
 largeComma.style.transform='translate(-50%,-50%) rotate('+orientation.toFixed(2)+'deg)';
 const intact=smooth(range(p,.954,.991));
 if(full)full.style.opacity=String(intact);

 // The slender lower-left comma tail acts as the real release point.
 // Use original source pixels to identify the path, not an invented shape.
 const tailRow=commaRail[Math.round((commaRail.length-1)*.89)]||{x:.37};
 const tail=screen(tailRow.x*w,h*.89);
 // Fully off-screen on the left before a separate entrance on the right.
 const leftOff={x:-Math.max(110,innerWidth*.16),y:tail.y+Math.min(56,h*.16)};
 const rightOffX=innerWidth+Math.max(110,innerWidth*.14);
 const settled=smooth(range(p,.045,.249));

 parts.forEach((el,i)=>{
  const homeX=lr.left+el.offsetLeft+el.offsetWidth*.5;
  const homeY=lr.top+el.offsetTop+el.offsetHeight*.5;
  const boxW=el.offsetWidth,boxH=el.offsetHeight;
  const grain=grainPieces[i];
  const glyphScale=Math.min(1,(radius*1.43)/Math.max(1,boxW,boxH));
  grain.style.width=boxW+'px';grain.style.height=boxH+'px';
  const start=pack.initialPositions[i],stop=pack.positions[i];
  const at={
   x:start.x+(stop.x-start.x)*settled,
   y:start.y+(stop.y-start.y)*settled
  };
  const release=releaseTimes[i];
  const ex=range(p,release,release+exitDuration);
  const released=p>=release;
  let insideX=at.x,insideY=at.y;
  // A very small independent wobble instead of rigidly glued letters.
  const wobble=Math.sin(i*2.43+p*31)*Math.min(radius*.13,2.4);
  if(!released){
   const tx=insideX+wobble,ty=insideY+Math.sin(i*3.16+p*21)*radius*.065;
   if(clampPoint(tx,ty,radius*.8,w,h)){insideX=tx;insideY=ty;}
  }else{
   const approach=smooth(range(ex,0,.57));
   insideY=at.y+(h*.89-at.y)*approach;
   const row=commaRail[Math.round(clamp(insideY/h)*(commaRail.length-1))]||tailRow;
   insideX=at.x+(row.x*w-at.x)*approach;
  }
  grain.style.left=insideX.toFixed(2)+'px';
  grain.style.top=insideY.toFixed(2)+'px';
  const grainHide=released?smooth(range(ex,.42,.59)):0;
  grain.style.opacity=String((1-grainHide)*(1-intact));
  const grainAngle=(-orientation+Math.sin(i*1.8+p*22)*7
    -115*smooth(range(ex,.16,.59)));
  grain.style.transform='translate(-50%,-50%) rotate('+grainAngle.toFixed(2)+
   'deg) scale('+(glyphScale*(1-.29*smooth(range(ex,.12,.6)))).toFixed(3)+')';

  let opacity=0,spin=0,scale=glyphScale*.77,pos=tail;
  const endExit=release+exitDuration,enter=reentryTimes[i],arrive=arrivalTimes[i];
  if(released&&p<endExit){
   // Interior cutout and exterior glyph briefly overlap at the opening.
   const emergence=smooth(range(ex,.46,.62));
   const roll=smooth(range(ex,.5,1));
   pos={
    x:bezier(tail.x,tail.x-w*.17,leftOff.x+innerWidth*.08,leftOff.x,roll),
    y:bezier(tail.y,tail.y+h*.15,leftOff.y-h*.025,leftOff.y,roll)
   };
   spin=-320*roll;opacity=emergence;scale=glyphScale*(.71+.10*roll);
  }else if(p>=enter){
   // A distinct right-side entrance. No teleporting from the comma
   // directly into the wordmark and no mid-screen respawn.
   const t=smooth(range(p,enter,arrive));
   const fromY=cy+h*.27+Math.sin(i*1.13)*h*.045;
   pos={
    x:bezier(rightOffX,rightOffX-innerWidth*.23,
      homeX+Math.min(innerWidth*.15,140),homeX,t),
    y:bezier(fromY,fromY+h*.07,homeY+h*.07,homeY,t)
   };
   spin=250*(1-t);
   scale=glyphScale*.79+(1-glyphScale*.79)*t;
   opacity=smooth(range(p,enter,enter+.035))*(1-intact);
  }else{
   // Hold beyond the left viewport until its own right-side entrance.
   pos=leftOff;
  }
  el.style.opacity=String(opacity*(1-intact));
  el.style.transform='translate3d('+(pos.x-homeX).toFixed(2)+'px,'+
   (pos.y-homeY).toFixed(2)+'px,0) rotate('+spin.toFixed(2)+
   'deg) scale('+scale.toFixed(3)+')';
 });
 caption.style.opacity=String(smooth(range(p,.894,.965)));
 const out=smooth(range(p,.985,1));
 sculpture.style.opacity=String(1-.08*out);
 overlay.style.transform='translate3d(0,'+(-12*out)+'%,0)';
 bar.style.transform='scaleX('+p+')';
 pct.textContent=Math.round(p*100)+'%';
}
function request(){if(!frame)frame=requestAnimationFrame(paint)}
function cleanup(){
 cancelAnimationFrame(autoplayFrame);
 if(overlay.dataset.cleanup)return;overlay.dataset.cleanup='1';
 root.classList.remove('gt-scroll-entry-ready');overlay.remove();
 window.removeEventListener('wheel',wheel,true);
 window.removeEventListener('touchstart',touchStart,true);
 window.removeEventListener('touchmove',touchMove,true);
 window.removeEventListener('keydown',key);
 overlay.removeEventListener('click',clickPlay);
 window.scrollTo(0,0);
}
function finish(){
 if(ended)return;ended=true;cancelAnimationFrame(frame);cancelAnimationFrame(autoplayFrame);
 try{sessionStorage.setItem('gt-scroll-entry-v18','done')}catch{}
 overlay.classList.add('is-completing');overlay.style.removeProperty('transform');
 overlay.addEventListener('transitionend',e=>{if(e.target===overlay)cleanup()},{once:true});
 setTimeout(cleanup,580);
}
function move(amount){
 if(ended)return;
 if(autoplayFrame){cancelAnimationFrame(autoplayFrame);autoplayFrame=0;}
 p=clamp(p+amount);if(p>=.999){p=1;paint();finish();}else request();
}
function clickPlay(e){
 if(ended||e.target.closest('button'))return;
 if(touchDragged){touchDragged=false;return;}
 if(autoplayFrame)return;
 autoplayFrom=p;autoplayStart=performance.now();
 const run=now=>{
  autoplayFrame=0;
  if(ended)return;
  const t=clamp((now-autoplayStart)/4050);
  p=autoplayFrom+(1-autoplayFrom)*smooth(t);
  paint();
  if(t>=1){finish();return;}
  autoplayFrame=requestAnimationFrame(run);
 };
 autoplayFrame=requestAnimationFrame(run);
}
function wheel(e){
 if(ended)return;e.preventDefault();
 const now=performance.now();if(now-wheelTime<5)return;wheelTime=now;
 move(clamp(e.deltaY*(e.deltaMode===1?19:e.deltaMode===2?innerHeight:1),-180,180)/1120);
}
function touchStart(e){startTouch=e.changedTouches[0]?.clientY??null;touchDragged=false}
function touchMove(e){
 if(ended||startTouch===null)return;e.preventDefault();
 const y=e.changedTouches[0]?.clientY??startTouch;
 if(Math.abs(startTouch-y)>3)touchDragged=true;
 move((startTouch-y)/Math.max(700,innerHeight*1.6));startTouch=y;
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
overlay.addEventListener('click',clickPlay);
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
