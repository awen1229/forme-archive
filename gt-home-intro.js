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
  for(let k=-8;k<=8;k++)gaussian.push(Math.exp(-.5*Math.pow(k/3.25,2)));
  const weight=gaussian.reduce((a,b)=>a+b,0);
  const softened=ring.map((_,i)=>{
   let x=0,y=0;
   for(let k=-8;k<=8;k++){
    const p=ring[(i+k+ring.length)%ring.length],w=gaussian[k+8];
    x+=p[0]*w;y+=p[1]*w;
   }
   return [x/weight,y/weight];
  });
  const sampled=[];
  const step=Math.max(3,Math.round(softened.length/155));
  for(let i=0;i<softened.length;i+=step)sampled.push(softened[i]);
  if(sampled.length<14)throw Error('Not enough points for smooth comma outline');
  const crisp=n=>Number(n.toFixed(2));
  let d='M'+crisp(sampled[0][0])+' '+crisp(sampled[0][1]);
  for(let i=0;i<sampled.length;i++){
   const p0=sampled[(i+sampled.length-1)%sampled.length];
   const p1=sampled[i],p2=sampled[(i+1)%sampled.length];
   const p3=sampled[(i+2)%sampled.length];
   // Lower tangent tension deliberately removes the sawtooth effect.
   const tension=.115;
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
   return {x:(a+(b-a)*.60)/ww,width:Math.max(0,b-a)/ww,y:y/hh};
  });
    largeComma.dataset.originalComma='vector-trace';

 });
}
// A two-bend inner-right slide: vertical drop, then a long accelerating
// curve following the comma's right inner wall and its descending tail.
function bezier(a,b,c,d,t){
 const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;
}
function rail(t){
 const enter=.22,bend=.65;
 if(t<enter){
  const k=smooth(t/enter);
  return {x:bezier(.44,.47,.64,.72,k),y:bezier(-.42,-.24,-.02,.13,k)};
 }
 if(t<bend){
  const k=(t-enter)/(bend-enter);
  return {x:bezier(.72,.96,.94,.76,k),y:bezier(.13,.16,.38,.57,k)};
 }
 const k=(t-bend)/(1-bend);
 return {x:bezier(.76,.66,.31,.06,k),y:bezier(.57,.76,.89,1.03,k)};
}
function paint(){
 frame=0;if(ended)return;
 const bounds=largeComma.getBoundingClientRect();
 const logoRect=stage.getBoundingClientRect();
 const sculptureRect=sculpture.getBoundingClientRect();
 const assembling=smooth(range(p,.79,.92));
 // Large original comma remains a clean outline while the letters slide.
 // At the end it collapses into the small comma of the untouched final LOGO.
 let deltaX=0,deltaY=0,logoScale=.12;
 if(commaBox){
  const c=commaBox;
  const targetX=logoRect.left+(c.x+c.w/2)/c.sourceW*logoRect.width;
  const targetY=logoRect.top+(c.y+c.h/2)/c.sourceH*logoRect.height;
  deltaX=targetX-(sculptureRect.left+sculptureRect.width*.5);
  deltaY=targetY-(sculptureRect.top+sculptureRect.height*.47);
  logoScale=clamp((c.w/c.sourceW*logoRect.width)/(largeComma.offsetWidth||180),.06,.40);
 }
 const scale=(1+.05*smooth(range(p,.03,.22)))*(1-assembling)+logoScale*assembling;
 largeComma.style.opacity=String(.90*(1-assembling));
 largeComma.style.transform='translate(calc(-50% + '+(deltaX*assembling)+'px),calc(-50% + '+(deltaY*assembling)+'px)) scale('+scale+')';
 // Use the comma's untransformed CSS geometry for absolute path points. Its
 // center and dimensions are stable while transforms move the outline.
 const cx=sculptureRect.left+sculptureRect.width*.5;
 const cy=sculptureRect.top+sculptureRect.height*.47;
 const w=largeComma.offsetWidth||Math.max(1,bounds.width);
 const h=largeComma.offsetHeight||Math.max(1,bounds.height);
 const point=(u,v)=>({x:cx+(u-.5)*w,y:cy+(v-.5)*h});
 const tip=point(.06,1.03);
 parts.forEach((el,i)=>{
  // Ten letters enter one-by-one. The last letter finishes before the full
  // logo crossfade, so the actual letters always reach their real positions.
  const t=range(p,.065+i*.034,.065+i*.034+.44);
  // Calculate the untransformed component center from its layout metrics.
  const homeX=logoRect.left+el.offsetLeft+el.offsetWidth/2;
  const homeY=logoRect.top+el.offsetTop+el.offsetHeight/2;
  let position,angle=0;
  if(t<.77){
   const q=rail(smooth(t/.77));
   position=point(q.x,q.y);
   const ahead=rail(clamp(smooth(t/.77)+.025));
   const tangent=point(ahead.x,ahead.y);
   angle=clamp(Math.atan2(tangent.y-position.y,tangent.x-position.x)*180/Math.PI-90,-24,24);
  }else{
   const q=smooth((t-.77)/.23);
   // A short outbound curve releases each letter from the comma's tail,
   // before it gently lands in its exact spot within the original LOGO.
   position={
    x:bezier(tip.x,tip.x-w*.32,homeX-w*.11,homeX,q),
    y:bezier(tip.y,tip.y+h*.16,homeY+h*.20,homeY,q)
   };
   angle=(1-q)*-10;
  }
  const reveal=smooth(range(t,0,.11));
  el.style.opacity=String(reveal*(1-assembling));
  el.style.transform='translate3d('+(position.x-homeX).toFixed(2)+'px,'+(position.y-homeY).toFixed(2)+'px,0) rotate('+angle.toFixed(2)+'deg)';
 });
 if(full)full.style.opacity=String(assembling);
 caption.style.opacity=String(smooth(range(p,.78,.92)));
 const out=smooth(range(p,.92,1));
 sculpture.style.opacity=String(1-.08*out);
 overlay.style.transform='translate3d(0,'+(-13*out)+'%,0)';
 bar.style.transform='scaleX('+p+')';pct.textContent=Math.round(p*100)+'%';
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
 try{sessionStorage.setItem('gt-scroll-entry-v5','done')}catch{}
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
