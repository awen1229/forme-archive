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
const source=document.getElementById('gt-study-source');
if(!stage||!largeComma||!source){root.classList.remove('gt-scroll-entry-ready');overlay.remove();return}
let parts=[],full=null,commaBox=null,commaRail=[],commaOuterRail=[],commaMask=null,commaOutline='',
    glyphs=[],layout=null,frame=0,ended=false,running=false,startedAt=0;
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
  commaMask=ink;
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
  commaOutline=d;
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+ww+' '+hh+'" width="'+ww+'" height="'+hh+'" shape-rendering="geometricPrecision">'+
   '<path d="'+d+'" fill="#dce8d9" fill-opacity=".21" stroke="#397541" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
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

// STUDY 07 / BOTTLE JAM, revision 2
// Use the ORIGINAL logo glyph bitmaps and ACTUAL comma ink silhouette.
// Packing tests the complete rotated glyph box against the silhouette and every other box.
// There is deliberately no visual clipping used to conceal packing errors.
const startButton=document.getElementById('gt-study-activate');
const skipButton=document.getElementById('gt-study-skip');
const hint=overlay.querySelector('.gt-scroll-entry-hint');
const prompt=overlay.querySelector('.gt-study-prompt');
const totalMs=8150;
const SHAKE_END=1350, POUR_START=1230, POUR_GAP=215, POUR_LENGTH=1580;
const RETURN_START=4930, RETURN_GAP=135, RETURN_LENGTH=1100;
const startSeed=4379085;
let order=[],ready=false,hasFallback=false;
function rng(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function cubic(a,b,c,d,t){const v=1-t;return v*v*v*a+3*v*v*t*b+3*v*t*t*c+t*t*t*d}
function blend(a,b,t){return a+(b-a)*t}
function getGeometry(){
 const sr=sculpture.getBoundingClientRect(),r=stage.getBoundingClientRect(),screen=overlay.getBoundingClientRect();
 const ww=commaBox.w,hh=commaBox.h,aspect=ww/hh;
 const iw=largeComma.offsetWidth||260,ih=largeComma.offsetHeight||430;
 const w=Math.min(iw,ih*aspect),h=Math.min(ih,iw/aspect);
 return {ww,hh,w,h,cx:sr.left+sr.width*.5,cy:sr.top+sr.height*.47,stageRect:r,screen};
}
function point(g,x,y){return {x:g.cx+(x/g.ww-.5)*g.w,y:g.cy+(y/g.hh-.5)*g.h}}
function bodyAt(y){
 const n=commaRail.length,yy=Math.round(clamp(y,0,1)*(n-1));
 const r=commaRail[yy];if(!r)return {x:commaBox.w*.5,y:yy,width:commaBox.w*.2};
 // CommaRail is already derived from the exact, connected source-ink silhouette.
 const x=r.x*commaBox.w, width=r.width*commaBox.w;
 return {x,y:yy,width};
}
function rotatedInside(item,g,x,y,scale=1){
 const a=item.angle*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a);
 const rx=(item.pw*scale/2+1.5)*g.ww/g.w;
 const ry=(item.ph*scale/2+1.5)*g.hh/g.h;
 // Check 25 points of rotated painted bounds, not just its center/corners.
 for(let iy=-2;iy<=2;iy++)for(let ix=-2;ix<=2;ix++){
  const xx=x+(ix/2*rx)*cs-(iy/2*ry)*sn;
  const yy=y+(ix/2*rx)*sn+(iy/2*ry)*cs;
  const ix0=Math.round(xx),iy0=Math.round(yy);
  if(ix0<0||iy0<0||ix0>=g.ww||iy0>=g.hh||
     commaMask[iy0*g.ww+ix0]!==1)return false;
 }
 return true;
}
function separate(a,b,g){
 // SAT rotated rectangular collision with ~2 px of breathing room.
 const ar=a.angle*Math.PI/180,br=b.angle*Math.PI/180;
 const axes=[[Math.cos(ar),Math.sin(ar)],[-Math.sin(ar),Math.cos(ar)],
             [Math.cos(br),Math.sin(br)],[-Math.sin(br),Math.cos(br)]];
 const dx=(a.x-b.x)*g.w/g.ww,dy=(a.y-b.y)*g.h/g.hh;
 for(const axis of axes){
  const pa=Math.abs(axis[0]*Math.cos(ar)+axis[1]*Math.sin(ar))*(a.pw*.5+1.3)
          +Math.abs(-axis[0]*Math.sin(ar)+axis[1]*Math.cos(ar))*(a.ph*.5+1.3);
  const pb=Math.abs(axis[0]*Math.cos(br)+axis[1]*Math.sin(br))*(b.pw*.5+1.3)
          +Math.abs(-axis[0]*Math.sin(br)+axis[1]*Math.cos(br))*(b.ph*.5+1.3);
  if(Math.abs(dx*axis[0]+dy*axis[1])>=pa+pb)return true;
 }
 return false;
}
function attemptPack(g,nominal,seed){
 const random=rng(seed),angles=[-11,7,-8,10,-4,8,-10,5,-7,9];
 const info=parts.map((el,i)=>{
  const scale=nominal/Math.max(1,el.offsetHeight);
  return {i,angle:angles[i],scale,pw:el.offsetWidth*scale,ph:el.offsetHeight*scale};
 });
 // Place the widest glyphs first; otherwise the thin strokes consume the
 // few roomy positions in the shoulder of the comma.
 const queue=info.slice().sort((a,b)=>b.pw*b.ph-a.pw*a.ph);
 const settled=[];
 for(let q=0;q<queue.length;q++){
  const item=queue[q];
  let best=null,bestScore=-Infinity;
  for(let n=0;n<2550;n++){
   const y=(.095+random()*.77)*g.hh;
   const row=bodyAt(y/g.hh);
   const x=(.06+random()*.88)*g.ww;
   if(!rotatedInside(item,g,x,y))continue;
   const probe={...item,x,y};
   if(settled.some(c=>!separate(probe,c,g)))continue;
   let nearest=1e5;
   for(const c of settled){
    const dx=(x-c.x)*g.w/g.ww,dy=(y-c.y)*g.h/g.hh;
    const dist=Math.hypot(dx,dy)-(Math.max(item.pw,item.ph)+Math.max(c.pw,c.ph))*.43;
    nearest=Math.min(nearest,dist);
   }
   // Seek the compact shoulder around the neck, not evenly scattered dots.
   const wantedY=.54*g.hh;
   const closeness=settled.length?(-Math.abs(nearest-4.5)*.50):0;
   const score=closeness-Math.abs(y-wantedY)*g.h/g.hh*.08
     -Math.abs(x-row.x)*g.w/g.ww*.025+random()*3;
   if(score>bestScore){bestScore=score;best=probe;}
  }
  if(!best)return null;
  settled.push(best);
 }
 return settled.sort((a,b)=>a.i-b.i);
}
function verifyPacking(items,g){
 if(!items||items.length!==parts.length)return false;
 return items.every((c,i)=>rotatedInside(c,g,c.x,c.y)&&
              items.every((other,j)=>i===j||separate(c,other,g)));
}
function pack(){
 const g=getGeometry();
 let winner=null;
 // Ask for ~9-10% of the real comma height rather than the previous ~5%.
 // Reduce proportionally only if all ten ORIGINAL shapes cannot safely fit.
 const base=clamp(g.h*.104,28,55);
 for(const multiplier of [1, .96, .92, .88, .84, .8, .76, .72, .68, .64, .60]){
  const nominal=base*multiplier;
  for(let n=0;n<5;n++){
   const items=attemptPack(g,nominal,startSeed+n*1177+Math.round(multiplier*10000));
   if(verifyPacking(items,g)){winner=items;break;}
  }
  if(winner)break;
 }
 if(!winner){
  throw Error("Insufficient safe space for all ten original glyphs");
 }
 const homes=parts.map(el=>({x:g.stageRect.left+el.offsetLeft+el.offsetWidth*.5,
                             y:g.stageRect.top+el.offsetTop+el.offsetHeight*.5}));
 glyphs=winner.map((item,i)=>({
  ...item,homeX:homes[i].x,homeY:homes[i].y,
  start:point(g,item.x,item.y),releaseIndex:-1
 }));
 // Gravity/left-tip order: the letters nearest the comma's lower exit are freed first.
 order=glyphs.map((c,i)=>({...c,i})).sort((a,b)=>b.y-a.y||a.x-b.x).map(c=>c.i);
 order.forEach((glyphIndex,slot)=>glyphs[glyphIndex].releaseIndex=slot);
 layout=g;
 ready=true;
 overlay.dataset.packing='verified';
 overlay.dataset.glyphHeight=Math.round(winner[0].ph).toString();
 if(hint&&!running)hint.textContent='LETTERS ARE STUCK / 點擊逗號，把它們搖出來';
 if(prompt)prompt.textContent='SHAKE TO RELEASE / 點擊逗號';
}
function shake(t){
 if(t>=SHAKE_END)return 0;
 const rise=smooth(range(t,0,170)),decay=1-smooth(range(t,750,SHAKE_END));
 return rise*decay*(5.5*Math.sin(t*.029)+2.3*Math.sin(t*.061));
}
function wiggle(i,t,g){
 // Keep collisions and outline respected even during the shake.
 // If a proposed jiggle fails, this particle stays wedged in its valid slot.
 const c=glyphs[i],amp=2.5*(1-smooth(range(t,700,1700)));
 const x=c.x+(Math.sin(t*.019+i*2.47)*amp)*g.ww/g.w;
 const y=c.y+(Math.cos(t*.024+i*3.13)*amp)*g.hh/g.h;
 const proposal={...c,x,y};
 if(rotatedInside(proposal,g,x,y)&&glyphs.every((other,j)=>i===j||separate(proposal,other,g))){
  return point(g,x,y);
 }
 return c.start;
}
function animateGlyph(i,t){
 const c=glyphs[i],g=layout,el=parts[i];
 const turn=c.releaseIndex,releaseAt=POUR_START+turn*POUR_GAP;
 const returnAt=RETURN_START+turn*RETURN_GAP;
 let x=c.start.x,y=c.start.y,rotation=c.angle,scale=c.scale,alpha=1;
 if(t<releaseAt){
  const pos=wiggle(i,t,g);x=pos.x;y=pos.y;
 }else if(t<returnAt){
  const q=range(t,releaseAt,releaseAt+POUR_LENGTH);
  const mid=bodyAt(.57),neck=bodyAt(.80),mouth=bodyAt(.90);
  const a=point(g,mid.x,mid.y),b=point(g,neck.x,neck.y),cMouth=point(g,mouth.x,mouth.y);
  if(q<.40){
   const u=smooth(q/.40);
   x=cubic(c.start.x,c.start.x,a.x+g.w*.08,a.x,u);
   y=cubic(c.start.y,c.start.y+g.h*.06,a.y-g.h*.075,a.y,u);
   rotation=blend(c.angle,-13,u);
  }else if(q<.71){
   const u=smooth((q-.40)/.31);
   x=cubic(a.x,a.x-g.w*.055,b.x+g.w*.02,b.x,u);
   y=cubic(a.y,a.y+g.h*.035,b.y-g.h*.02,b.y,u);
   scale=blend(c.scale,c.scale*.74,u);
   rotation=blend(-13,-28,u);
  }else{
   const u=smooth((q-.71)/.29),farLeft=g.screen.left-Math.max(140,g.w*.48);
   x=cubic(b.x,cMouth.x-g.w*.10,farLeft+g.w*.20,farLeft,u);
   y=cubic(b.y,cMouth.y+g.h*.03,cMouth.y+g.h*.14,cMouth.y+g.h*.17,u);
   scale=blend(c.scale*.74,c.scale*.93,u);
   rotation=blend(-28,-17,u);
  }
  if(q>=1)alpha=0;
 }else{
  const u=smooth(range(t,returnAt,returnAt+RETURN_LENGTH));
  const offRight=g.screen.right+Math.max(150,g.w*.45);
  x=cubic(offRight,offRight-g.w*.02,c.homeX+Math.min(110,g.screen.width*.19),c.homeX,u);
  y=cubic(c.homeY-g.h*.06,c.homeY-g.h*.11,c.homeY,c.homeY,u);
  scale=blend(c.scale*.95,1,u);
  rotation=blend(c.angle,0,u);
 }
 alpha*=1-smooth(range(t,6920,7300));
 el.style.transform='translate3d('+(x-c.homeX).toFixed(2)+'px,'+
  (y-c.homeY).toFixed(2)+'px,0) rotate('+rotation.toFixed(2)+'deg) scale('+scale.toFixed(3)+')';
 el.style.opacity=String(alpha);
}
function render(now){
 frame=0;if(ended||!ready)return;
 const t=running?now-startedAt:0;
 if(!running){
  // Fixed large jammed characters, without incessant floating or edge escapes.
  glyphs.forEach((_,i)=>animateGlyph(i,0));
  return;
 }
 sculpture.style.transform='rotate('+shake(t).toFixed(2)+'deg)';
 glyphs.forEach((_,i)=>animateGlyph(i,t));
 const fading=smooth(range(t,6760,7160));
 largeComma.style.opacity=String(.95*(1-fading));
 if(full)full.style.opacity=String(smooth(range(t,6920,7350)));
 if(caption)caption.style.opacity=String(smooth(range(t,7130,7390)));
 if(bar)bar.style.transform='scaleX('+clamp(t/totalMs)+')';
 if(pct)pct.textContent=Math.round(clamp(t/totalMs)*100)+'%';
 if(t>=totalMs){finish();return}
 frame=requestAnimationFrame(render);
}
function request(){if(!frame)frame=requestAnimationFrame(render)}
function startStudy(){
 if(ended||running||!ready)return;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return}
 running=true;startedAt=performance.now();startButton.disabled=true;
 overlay.classList.add('is-started');
 if(hint)hint.textContent='SHAKE / TILT / POUR / 字母正在擠出瓶口';
 request();
}
function finish(){
 if(ended)return;ended=true;cancelAnimationFrame(frame);
 try{sessionStorage.setItem('gt-scroll-entry-v16','done')}catch(e){}
 overlay.classList.add('is-completing');
 setTimeout(()=>location.assign('./'),460);
}
function fallback(error){
 console.warn('Comma Container packing fallback:',error);
 hasFallback=true;overlay.classList.add('has-error');
 // Never display letters outside the original boundary or overlapping.
 parts.forEach(el=>el.style.opacity='0');
 largeComma.style.opacity='0';
 if(full)full.style.opacity='1';
 if(hint)hint.textContent='ORIGINAL LOGO / 點擊進入首頁';
 startButton.addEventListener('click',finish,{once:true});
}
startButton.addEventListener('click',()=>{if(hasFallback)finish();else startStudy()});
skipButton.addEventListener('click',finish);
window.addEventListener('resize',()=>{
 if(!running&&!ended){
  try{pack();request()}catch(e){fallback(e)}
 }
},{passive:true});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape')finish();
});
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',e=>{
 if(e.matches)finish();
});
extractOriginal()
 .then(()=>largeComma.decode?.().catch(()=>{})||Promise.resolve())
 .then(()=>{pack();request()})
 .catch(fallback);
})();