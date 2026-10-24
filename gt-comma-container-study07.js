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

// STUDY 07 / COMMA CONTAINER
// A true contained initial state, then left-tail release and right-side return.
// The logo's exact raster glyphs and final intact wordmark are preserved.
const startButton=document.getElementById('gt-study-activate');
const skipButton=document.getElementById('gt-study-skip');
const hint=overlay.querySelector('.gt-scroll-entry-hint');
const totalMs=6650,firstExit=190,exitGap=135,exitDuration=1740;
const firstReturn=3330,returnGap=126,returnDuration=1080;
const startSeed=70971;
function rng(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function cubic2(a,b,c,d,u){
 const v=1-u;
 return v*v*v*a+3*v*v*u*b+3*v*u*u*c+u*u*u*d;
}
function blend(a,b,t){return a+(b-a)*t}
function localPoint(geometry,x,y){
 return {x:geometry.cx+(x/geometry.ww-.5)*geometry.w,
         y:geometry.cy+(y/geometry.hh-.5)*geometry.h};
}
function getGeometry(){
 const s=sculpture.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
 const border=overlay.getBoundingClientRect(), iw=largeComma.offsetWidth,ih=largeComma.offsetHeight;
 const ww=commaBox.w,hh=commaBox.h,ratio=ww/hh;
 const w=Math.min(iw,ih*ratio),h=Math.min(ih,iw/ratio);
 return {ww,hh,w,h,cx:s.left+s.width*.5,cy:s.top+s.height*.47,stageRect,border};
}
function inside(x,y,rx,ry){
 // All grid samples must remain in the genuine filled comma silhouette.
 const ww=commaBox.w,hh=commaBox.h;
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const xx=Math.round(x+dx*rx),yy=Math.round(y+dy*ry);
  if(xx<0||yy<0||xx>=ww||yy>=hh||!commaMask[yy*ww+xx])return false;
 }
 return true;
}
function centerAt(y){
 const hh=commaBox.h,ww=commaBox.w;let xSum=0,weight=0,spanSum=0;
 const y0=Math.round(clamp(y,0,1)*(hh-1));
 for(let dy=-5;dy<=5;dy++){
  const yy=clamp(y0+dy,0,hh-1),z=commaRail[yy];
  if(!z)continue;
  const density=5.5-Math.abs(dy),g=density>0?density:0;
  // Existing rail is safely inside the original comma's connected ink.
  xSum+=z.x*g;spanSum+=z.width*g;weight+=g;
 }
 return {x:(weight?xSum/weight:.5)*ww,
         y:y0,width:(weight?spanSum/weight:.2)*ww};
}
function prepareLayout(){
 if(!parts.length||!commaMask)return;
 const g=getGeometry(),random=rng(startSeed),maxHeight=clamp(g.h*.053,13.4,27);
 // Find a size that allows all ten original letter silhouettes to rest
 // inside the comma with breathing room, not clipped at the contour.
 let result=null;
 for(let shrink=1;shrink>=.60;shrink-=.06){
  const chosen=[];
  const sizes=parts.map(el=>{
   const scale=maxHeight*shrink/Math.max(1,el.offsetHeight);
   const pxW=el.offsetWidth*scale,pxH=el.offsetHeight*scale;
   return {scale,pxW,pxH,rx:(pxW*.5+3)*g.ww/g.w,
                        ry:(pxH*.5+3)*g.hh/g.h};
  });
  let failed=false;
  for(let i=0;i<parts.length;i++){
   const z=sizes[i];let best=null,bestScore=-Infinity;
   for(let tryNo=0;tryNo<1900;tryNo++){
    const x=(.11+random()*.78)*g.ww;
    const y=(.08+random()*.69)*g.hh;
    if(!inside(x,y,z.rx,z.ry))continue;
    let minSeparation=1e7,overlap=false;
    for(const q of chosen){
     const dx=Math.abs(x-q.x)*g.w/g.ww,dy=Math.abs(y-q.y)*g.h/g.hh;
     if(dx<(z.pxW+q.pxW)*.5+2.8&&dy<(z.pxH+q.pxH)*.5+3){overlap=true;break;}
     minSeparation=Math.min(minSeparation,Math.hypot(dx,dy));
    }
    if(overlap)continue;
    const score=Math.min(60,minSeparation)+random()*14-(y/g.hh)*3;
    if(score>bestScore){best={x,y,...z};bestScore=score;}
   }
   if(!best){failed=true;break;}
   chosen.push(best);
  }
  if(!failed){result=chosen;break;}
 }
 if(!result){
  // Defensive fallback, never leave glyphs visibly outside the comma.
  result=[];
  parts.forEach((el,i)=>{
   const y=.20+.43*(i/Math.max(1,parts.length-1));
   const r=centerAt(y);
   result.push({x:r.x,y:r.y,scale:.11,
                pxW:el.offsetWidth*.11,pxH:el.offsetHeight*.11});
  });
 }
 const home=parts.map(el=>({
  x:g.stageRect.left+el.offsetLeft+el.offsetWidth*.5,
  y:g.stageRect.top+el.offsetTop+el.offsetHeight*.5
 }));
 glyphs=result.map((pt,i)=>({
  ...pt,homeX:home[i].x,homeY:home[i].y,
  start:localPoint(g,pt.x,pt.y),
  angle:[-7,4,-3,6,-5,3,8,-4,2,-6][i]
 }));
 layout=g;
}
function drawGlyph(el,i,now){
 const c=glyphs[i],g=layout;if(!c||!g)return;
 const start=firstExit+i*exitGap,release=range(now,start,start+exitDuration);
 const rstart=firstReturn+i*returnGap;
 let x=c.start.x,y=c.start.y,scale=c.scale,opacity=1,rotate=c.angle;
 if(now<start){
  const phase=(running?now:performance.now())*.0013+i*1.8;
  x+=Math.sin(phase)*1.2;y+=Math.cos(phase*.88)*1.6;
 }else if(now<rstart){
  // Every letter follows the same inner corridor to the lower-left tail.
  if(release<.43){
   const q=smooth(release/.43),junction=centerAt(.47),join=localPoint(g,junction.x,junction.y);
   x=cubic2(c.start.x,c.start.x+g.w*.035,join.x+g.w*.015,join.x,q);
   y=cubic2(c.start.y,c.start.y+g.h*.045,join.y-g.h*.055,join.y,q);
   scale=blend(c.scale,Math.min(c.scale,clamp(g.w*.11/el.offsetWidth,.13,c.scale)),q);
  }else if(release<.76){
   const q=smooth((release-.43)/.33);
   const ry=.47+(.965-.47)*q;
   const middle=centerAt(ry),p=localPoint(g,middle.x,middle.y);
   x=p.x;y=p.y;
   const fit=Math.min(c.scale,Math.max(.055,(middle.width*g.w/g.ww*.57)/Math.max(1,el.offsetWidth)));
   scale=blend(Math.min(c.scale,g.w*.11/Math.max(1,el.offsetWidth)),fit,smooth(q));
  }else{
   const q=smooth((release-.76)/.24),tip=centerAt(.965);
   const from=localPoint(g,tip.x,tip.y);
   const offLeft=g.border.left-Math.max(120,g.w*.3);
   x=cubic2(from.x,from.x-g.w*.11,offLeft+g.w*.15,offLeft,q);
   y=cubic2(from.y,from.y+g.h*.085,from.y+g.h*.13,from.y+g.h*.14,q);
   scale=blend(Math.max(.095,c.scale*.34),c.scale*.89,q);
  }
  if(release>=1)opacity=0;
  rotate=blend(c.angle,0,smooth(release));
 }else{
  // Fully leave to the LEFT before the same glyph returns from the RIGHT.
  const arrival=range(now,rstart,rstart+returnDuration);
  const q=smooth(arrival);
  const from=g.border.right+Math.max(150,g.w*.34);
  const advance=c.homeX+Math.min(116,g.border.width*.20);
  x=cubic2(from,from-g.w*.02,advance,c.homeX,q);
  y=cubic2(c.homeY-g.h*.09,c.homeY-g.h*.085,c.homeY+g.h*.008,c.homeY,q);
  scale=blend(c.scale*.87,1,q);
  rotate=blend(c.angle*.5,0,q);
 }
 const intact=smooth(range(now,5740,6200));
 opacity*=1-intact;
 el.style.transform='translate3d('+(x-c.homeX).toFixed(2)+'px,'+
   (y-c.homeY).toFixed(2)+'px,0) rotate('+rotate.toFixed(2)+'deg) scale('+scale.toFixed(3)+')';
 el.style.opacity=String(opacity);
}
function paint(now){
 frame=0;
 if(ended||!glyphs.length)return;
 const elapsed=running?now-startedAt:0;
 if(!running){
  glyphs.forEach((_,i)=>drawGlyph(parts[i],i,elapsed));
  frame=requestAnimationFrame(paint);
  return;
 }
 parts.forEach((_,i)=>drawGlyph(parts[i],i,elapsed));
 const faded=smooth(range(elapsed,5180,5740));
 largeComma.style.opacity=String(.92*(1-faded));
 largeComma.style.transform='translate(-50%,-50%) scale('+(1+.012*smooth(range(elapsed,0,750))-.012*faded)+')';
 if(full)full.style.opacity=String(smooth(range(elapsed,5740,6200)));
 if(caption)caption.style.opacity=String(smooth(range(elapsed,5540,6060)));
 if(bar)bar.style.transform='scaleX('+clamp(elapsed/totalMs)+')';
 if(pct)pct.textContent=Math.round(clamp(elapsed/totalMs)*100)+'%';
 if(elapsed>=totalMs){enterSite();return;}
 frame=requestAnimationFrame(paint);
}
function request(){if(!frame)frame=requestAnimationFrame(paint)}
function startStudy(){
 if(running||ended)return;
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){enterSite();return;}
 running=true;
 startedAt=performance.now();
 startButton.disabled=true;
 overlay.classList.add('is-started');
 if(hint)hint.textContent='LET THE LETTERS GO / 字母正在離開逗號';
 request();
}
function enterSite(){
 if(ended)return;ended=true;cancelAnimationFrame(frame);
 try{sessionStorage.setItem('gt-scroll-entry-v16','done')}catch(e){}
 // The experiment never mutates or publishes the real site.
 overlay.classList.add('is-completing');
 setTimeout(()=>{location.assign('./')},470);
}
function showFallback(e){
 console.warn('Original comma study fallback:',e);
 overlay.classList.add('has-error');
 if(full){full.style.opacity='1';}
 if(hint)hint.textContent='ORIGINAL LOGO / 點擊進入網站';
 startButton.addEventListener('click',enterSite,{once:true});
}
startButton.addEventListener('click',startStudy);
startButton.addEventListener('keydown',e=>{
 if(e.key==='Enter'||e.key===' '){e.preventDefault();startStudy();}
});
skipButton.addEventListener('click',enterSite);
window.addEventListener('resize',()=>{
 if(!running&&!ended){prepareLayout();request();}
},{passive:true});
window.addEventListener('keydown',e=>{if(e.key==='Escape')enterSite()});
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',e=>{
 if(e.matches)enterSite();
});
extractOriginal().then(()=>largeComma.decode?.().catch(()=>{})||Promise.resolve()).then(()=>{
 prepareLayout();
 request();
}).catch(showFallback);
})();