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
const releaseTimes=[.170,.222,.268,.286,.350,.405,.431,.490,.537,.583];
const travelTimes=[.345,.330,.355,.327,.345,.333,.338,.347,.335,.325];
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
 // First fill the wide bowl from the bottom upward, then stack the next
 // original characters over its shoulders, retaining an actual gap.
 let radius=Math.min(w*.064,h*.052,22);
 let positions=[];
 for(let attempt=0;attempt<11;attempt++){
  const candidates=[],step=Math.max(5,radius*.56);
  for(let y=h*.72;y>=h*.10;y-=step){
   for(let x=radius*1.2;x<w-radius*1.2;x+=step){
    const n=Math.sin(x*.083+y*.171)*.37;
    const px=x+n*step,py=y+Math.sin(x*.123-y*.079)*step*.17;
    if(!clampPoint(px,py,radius*1.12,w,h))continue;
    const score=-py+h*.13*Math.sin(x*.025+y*.04);
    candidates.push({x:px,y:py,score});
   }
  }
  candidates.sort((a,b)=>a.score-b.score);
  const selected=[];
  for(const c of candidates){
   if(selected.every(q=>Math.hypot(c.x-q.x,c.y-q.y)>radius*2.19)){
    selected.push({x:c.x,y:c.y});
    if(selected.length===10)break;
   }
  }
  if(selected.length===10){positions=selected;break;}
  radius*=.91;
 }
 if(positions.length!==10)throw Error('Original comma has insufficient room for ten separated glyphs');
 // Exit starts around the tail; other letters follow in loosely clustered
 // pairs. Each grain keeps its own independent position.
 positions.sort((a,b)=>b.y-a.y||(a.x-b.x));
 grainPacking={key,radius,positions};
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
  console.warn('Original comma particle packing fallback',error);
  fallback();
  if(grainField)grainField.style.opacity='0';
  bar.style.transform='scaleX('+p+')';
  pct.textContent=Math.round(p*100)+'%';
  return;
 }
 const radius=pack.radius;
 // Tilt and unwind the original comma. The pile rotates with its container,
 // not with an unrelated page coordinate system.
 const tilt=-11*smooth(range(p,.035,.285))
           +7*smooth(range(p,.48,.70))
           +4*smooth(range(p,.72,.88));
 const rad=tilt*Math.PI/180,co=Math.cos(rad),si=Math.sin(rad);
 const screen=(x,y)=>({
  x:cx+(x-w*.5)*co-(y-h*.5)*si,
  y:cy+(x-w*.5)*si+(y-h*.5)*co
 });
 grainField.style.width=w+'px';grainField.style.height=h+'px';
 grainField.style.transform='translate(-50%,-50%) rotate('+tilt.toFixed(2)+'deg)';
 grainField.style.opacity=String(1-smooth(range(p,.855,.948)));
 const commaFade=smooth(range(p,.785,.942));
 largeComma.style.opacity=String(.88*(1-commaFade));
 largeComma.style.transform='translate(-50%,-50%) rotate('+tilt.toFixed(2)+'deg)';
 const intact=smooth(range(p,.936,.985));
 if(full)full.style.opacity=String(intact);

 // Local contact solver: the remaining grains respond to the tilt and the
 // empty spaces left by neighbors, without intersecting one another.
 const occupied=pack.positions.map((q,i)=>({x:q.x,y:q.y,i}));
 const released=releaseTimes.filter(t=>p>t).length;
 for(let i=0;i<occupied.length;i++){
  if(p>=releaseTimes[i])continue;
  const q=occupied[i],trigger=smooth(range(p,releaseTimes[i]-.18,releaseTimes[i]));
  const dx=-radius*.43*smooth(range(p,.055,.39))
    +Math.sin(i*3.7+p*17)*radius*.11*trigger;
  const dy=Math.min(radius*.72,released*radius*.12)
    +Math.sin(i*2.37+p*20)*radius*.095*trigger;
  if(clampPoint(q.x+dx,q.y+dy,radius*1.1,w,h)){
   q.x+=dx;q.y+=dy;
  }
 }
 for(let pass=0;pass<5;pass++){
  for(let i=0;i<occupied.length;i++){
   if(p>=releaseTimes[i])continue;
   for(let j=i+1;j<occupied.length;j++){
    if(p>=releaseTimes[j])continue;
    const a=occupied[i],b=occupied[j];
    let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d<.001){dx=1;dy=0;d=1;}
    const overlap=radius*2.14-d;
    if(overlap<=0)continue;
    const ox=dx/d*overlap*.51,oy=dy/d*overlap*.51;
    if(clampPoint(a.x-ox,a.y-oy,radius*1.08,w,h)){a.x-=ox;a.y-=oy;}
    if(clampPoint(b.x+ox,b.y+oy,radius*1.08,w,h)){b.x+=ox;b.y+=oy;}
   }
  }
 }
 const tailRow=commaRail[Math.round(commaRail.length*.885)]||{x:.36};
 const tailX=tailRow.x*w,tailY=h*.885;
 const tail=screen(tailX,tailY);
 const outside=screen(-w*.14,h*.96);
 parts.forEach((el,i)=>{
  const homeX=lr.left+el.offsetLeft+el.offsetWidth*.5;
  const homeY=lr.top+el.offsetTop+el.offsetHeight*.5;
  const grain=grainPieces[i],boxW=el.offsetWidth,boxH=el.offsetHeight;
  const glyphScale=Math.min(1,(radius*1.38)/Math.max(1,boxW,boxH));
  grain.style.width=boxW+'px';grain.style.height=boxH+'px';
  const release=releaseTimes[i],u=range(p,release,release+travelTimes[i]);
  const before=p<release;
  let innerX=occupied[i].x,innerY=occupied[i].y;
  let innerScale=glyphScale,innerOpacity=before?1:0;
  if(!before){
   // A short pause, then a gravity-led slide through the real silhouette.
   // At the narrowing tail, glyphs become smaller rather than crossing ink.
   const f=smooth(range(u,.035,.565));
   innerY=pack.positions[i].y+(tailY-pack.positions[i].y)*f;
   const idx=Math.round(clamp(innerY/h)*(commaRail.length-1));
   const rail=commaRail[idx]||{x:.5,clearance:.13};
   const targetX=rail.x*w;
   innerX=pack.positions[i].x+(targetX-pack.positions[i].x)*f;
   const localR=radius*(1-.50*smooth(range(u,.20,.58)));
   if(!clampPoint(innerX,innerY,localR,w,h)){
    // Never paint an unmasked grain outside the supplied comma ink.
    const previous=pack.positions[i];
    innerX=previous.x+(targetX-previous.x)*smooth(range(u,.03,.36))*.4;
    innerY=previous.y+(tailY-previous.y)*smooth(range(u,.03,.36))*.4;
   }
   innerScale=glyphScale*(1-.42*smooth(range(u,.18,.58)));
   innerOpacity=1-smooth(range(u,.47,.635));
  }
  grain.style.left=innerX.toFixed(2)+'px';
  grain.style.top=innerY.toFixed(2)+'px';
  grain.style.opacity=String(innerOpacity*(1-intact));
  const rotation=(-13+(i*17%27))*(1-.5*smooth(range(u,.08,.5)));
  grain.style.transform='translate(-50%,-50%) rotate('+rotation.toFixed(2)+'deg) scale('+innerScale.toFixed(3)+')';

  // Crossfade at the tail from a strictly masked interior letter to the
  // same original glyph on the exterior; then each finds its unique slot.
  const outer=smooth(range(u,.485,.645));
  const q=range(u,.485,1);
  let pos=tail;
  if(q<.32){
   const t=smooth(q/.32);
   pos={
    x:bezier(tail.x,tail.x-w*.10,outside.x+w*.045,outside.x,t),
    y:bezier(tail.y,tail.y+h*.07,outside.y,outside.y,t)
   };
  }else{
   const t=smooth((q-.32)/.68);
   pos={
    x:bezier(outside.x,outside.x-w*.06,homeX+w*.11,homeX,t),
    y:bezier(outside.y,outside.y+h*.09,homeY-h*.075,homeY,t)
   };
  }
  const arrive=smooth(range(q,.34,1));
  const scale=innerScale+(1-innerScale)*arrive;
  el.style.opacity=String((before?0:outer)*(1-intact));
  el.style.transform='translate3d('+(pos.x-homeX).toFixed(2)+'px,'+
    (pos.y-homeY).toFixed(2)+'px,0) rotate('+
    (rotation*(1-arrive)).toFixed(2)+'deg) scale('+scale.toFixed(3)+')';
 });
 caption.style.opacity=String(smooth(range(p,.84,.955)));
 const out=smooth(range(p,.975,1));
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
 try{sessionStorage.setItem('gt-scroll-entry-v17','done')}catch{}
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
