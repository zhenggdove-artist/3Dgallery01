import * as THREE from 'three';
import {CITY_INNER_RADIUS,CITY_OUTER_RADIUS,CITY_SHOP_STYLES,CITY_LOTS,
 cityLots,citySignSpecs,cityShopSignSpec,citySignArtOptions,cityRooftopVisual,highRiseCompanySign,cityStage,cityDamageTier,cityCollapseProgress,cityCollapsePosition,cityBlocked,cityRoofHeight,CITY_MAX_HP} from './shared/city-layout.js';
export {CITY_INNER_RADIUS,CITY_OUTER_RADIUS,CITY_SHOP_STYLES,cityLots} from './shared/city-layout.js';
import {buildDetachableFixture,buildBrokenStructure,installFacadeCracks,installAttachedFlash,createPlumeResources,CityImpactPlumes,packRubble,packedRubbleMaterial} from './city-ruins-vfx.js';
import {drawSignArtwork,drawRooftopSignArtwork,rooftopSignMode,installRooftopSignLighting,updateRooftopSignClock,rooftopBillboardParts,rooftopBillboardFaces} from './sign-art.js';
import {CityWallPaint} from './city-wall-paint.js';
import {paintAtlasBands,useStablePaintPixels} from './paint-texture-source.js';
import {CityFireField} from './city-fire-field.js';
import {CitySplinterField} from './city-splinter-field.js';
import {CityVisibleIndices} from './city-visible-indices.js';

// All 432 lots remain present on mobile. Simplification changes only geometry
// detail, never collision or position; a single batched mesh draws the district.
function random(seed){let n=seed>>>0;return ()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
const rgb=c=>{const color=new THREE.Color(c);return [color.r,color.g,color.b];};
const scraps=['#706b61','#a78557','#744c43','#9b9889','#565d5b'];
function localToWorld(lot,x,z){
 const c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
 return [lot.x+c*x+s*z,lot.z-s*x+c*z];
}
function compactedSand(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=768;
 const g=canvas.getContext('2d'),r=random(91911);
 g.fillStyle='#7e652e';g.fillRect(0,0,768,768);
 for(let i=0;i<5700;i++){
  const size=1+r()*8;g.globalAlpha=.09+r()*.25;
  g.fillStyle=i%3?'#d3aa68':'#382719';
  g.fillRect(r()*768,r()*768,size,1+r()*3);
 }
 for(let i=0;i<200;i++){
  g.globalAlpha=.05+r()*.16;
  g.fillStyle=i%2?'#44331a':'#bb9250';
  g.beginPath();g.ellipse(r()*768,r()*768,12+r()*44,2+r()*9,r()*6,0,Math.PI*2);g.fill();
 }
 g.globalAlpha=1;
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
}
const roofVisual=cityRooftopVisual;
function batchGeometry(lots,mobile){
 const position=[],normal=[],color=[],indices=[],lotRanges=new Map(),partRanges=new Map(),lotIds=[],localPoints=[],tilePoints=[];
 let category='core',current=-1;
 const face=(corners,n,col,lot,locals,axis)=>{
  const at=position.length/3,c=rgb(col);
  for(let i=0;i<corners.length;i++){position.push(...corners[i]);normal.push(...n);color.push(...c);
   lotIds.push(lot.index??-1);localPoints.push(...(locals?.[i]||[0,0,0]));const p=locals?.[i]||[0,0,0];tilePoints.push((axis===0?p[2]:p[0])/2.4,p[1]/1.2,category==='core'&&lot.index>=0&&axis!==1?1:0);}
  indices.push(at,at+1,at+2,at,at+2,at+3);
 };
 const box=(lot,x,y,z,w,h,d,c,rotation=0)=>{
  if(w<=0||h<=0||d<=0)return;
  const at=position.length/3;
  const locals=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
   [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,k])=>rotation?[x+a*w/2*Math.cos(rotation)-b*h/2*Math.sin(rotation),y+a*w/2*Math.sin(rotation)+b*h/2*Math.cos(rotation),z+k*d/2]:[x+a*w/2,y+b*h/2,z+k*d/2]);
  const vertices=locals.map(([vx,vy,vz])=>{const q=localToWorld(lot,vx,vz);return [q[0],vy,q[1]];});
  const cs=Math.cos(lot.yaw),sn=Math.sin(lot.yaw);
  for(const [ids,n] of [[[4,5,6,7],[0,0,1]],[[1,0,3,2],[0,0,-1]],
   [[5,1,2,6],[1,0,0]],[[0,4,7,3],[-1,0,0]],[[7,6,2,3],[0,1,0]],[[0,1,5,4],[0,-1,0]]]){
    const nx=rotation?n[0]*Math.cos(rotation)-n[1]*Math.sin(rotation):n[0],ny=rotation?n[0]*Math.sin(rotation)+n[1]*Math.cos(rotation):n[1];
    face(ids.map(i=>vertices[i]),[nx*cs+n[2]*sn,ny,-nx*sn+n[2]*cs],c,lot,ids.map(i=>locals[i]),Math.abs(n[0])>.5?0:Math.abs(n[1])>.5?1:2);
  }
  if(current>=0&&category!=='core'){
   const key=current+':'+category,group=partRanges.get(key)||[];
   group.push([at,position.length/3]);partRanges.set(key,group);
  }
 };
 for(const lot of lots){
  const begin=position.length/3,r=random(lot.index*551+15),w=lot.width,d=lot.depth,h=lot.height,floorH=h/lot.floors;
  const frontage=d/2;
  current=lot.index;category='core';
  // Solid, six-faced volumes: cubes, deep rectangular blocks, offsets and
  // three / four stacked floors instead of equal flat black facades.
  for(let level=0;level<lot.floors;level++){
   const taper=level&&lot.silhouette%3===0?.79:1;
   const shift=level?lot.offset*(level%2?1:-.4):0;
   const setback=level&&lot.silhouette%4===0?(level%2?.8:-.4):0;
   const col=level&&lot.silhouette%4===1?lot.detail:lot.color;
   box(lot,shift,(level+.5)*floorH,setback,w*taper,floorH,d*(level&&lot.silhouette%5===0?.86:1),col);
  }
  box(lot,0,.19,0,w+.4,.38,d+.4,lot.trim);
  category='pillars';
  for(const side of [-1,1]){
   category='pillars-'+(side<0?0:1);
   box(lot,side*(w/2-.18),h/2,frontage+.1,.22,h,.25,lot.trim);
  }
  category='windows';
  for(let level=0;level<lot.floors;level++){
   const y=level*floorH+floorH*.49;
   const count=3;
   for(let k=0;k<count;k++){
    const x=(k-(count-1)/2)*w/(count+1);
    const windowWidth=w/(count+2),windowHeight=Math.min(1.3,floorH*.53);
    // A window hole, warped frame and rusted mullion are integral masonry:
    // knocking off a pane must NOT expose a featureless solid-color block.
    category='window-scars';
    box(lot,x,y,frontage+.015,windowWidth*.96,windowHeight*.93,.035,'#272b2a');
    box(lot,x-windowWidth*.49,y,frontage+.12,.065,windowHeight,.09,lot.trim);
    box(lot,x+windowWidth*.49,y,frontage+.12,.065,windowHeight,.09,lot.trim);
    box(lot,x,y,frontage+.125,.04,windowHeight,.075,lot.trim);
    category='windows-'+level+'-'+k;
    const windowColor=(k+level+lot.index)%4===0?'#6b5547':'#313a3a';
    box(lot,x,y,frontage+.06,windowWidth,windowHeight,.13,windowColor);
    box(lot,x,y+Math.min(.42,floorH*.13),frontage+.16,windowWidth+.08,.08,.13,lot.detail);
    if((k+lot.index)%2===0)box(lot,x,y-.1,frontage+.18,.065,.75,.1,lot.trim);
   }
  }
  // Retail fronts remain intact when an upstairs window is knocked free.
  category='storefront';
  // Retail fronts retain distinctive bilingual shop signs and equipment.
  box(lot,0,1.1,frontage+.17,w*.83,1.8,.18,lot.trim);
  box(lot,-w*.24,.96,frontage+.32,w*.27,1.5,.06,'#303c3a');
  box(lot,w*.20,1.12,frontage+.31,w*.32,1.18,.09,'#41504c');
  category='sheets-awning';
  box(lot,0,2.58,frontage+.58,w*1.03,.17,1.1,lot.style[3]);
  for(let k=0;k<(mobile?4:8);k++){
   box(lot,-w*.44+k*w*.12,2.52,frontage+1.04,w*.11,.12,.24,k%2?lot.detail:lot.style[3]);
  }
  const flatSign=cityShopSignSpec(lot);if(flatSign){category='sign';box(lot,flatSign.x,flatSign.y,flatSign.z,flatSign.width,flatSign.height,flatSign.depth,flatSign.color);for(const p of flatSign.supports)box(lot,p.x,p.y,p.z,p.width,p.height,p.depth,lot.trim);}
  for(const sign of citySignSpecs(lot)){
   category=sign.id;
   if(sign.id.startsWith('sign-roof-')){for(const p of rooftopBillboardParts(roofVisual(lot,sign)))box(lot,p.x,p.y,p.z,p.width,p.height,p.depth,p.color,p.rotation||0);}
   else{box(lot,sign.x,sign.y,sign.z,sign.width,sign.height,sign.depth,sign.color);for(const p of sign.supports)box(lot,p.x,p.y,p.z,p.width,p.height,p.depth,lot.trim);}
  }
  category='roof-clutter';
  for(let k=0;k<(mobile?2:5);k++){
   box(lot,(r()-.5)*w,h+.12+r()*.15,(r()-.5)*d,.18,.08,1+r()*3,scraps[(lot.index+k)%scraps.length]);
  }
  // The roof deck is structural, not detachable decoration. Damage may
  // tear away the corrugated roofing without creating an invisible hole.
  category='roof-foundation';
  box(lot,0,h-.045,0,w+.35,.33,d+.31,lot.trim);
  category='sheets-roof';
  box(lot,0,h+.06,0,w+.4,.14,d+.36,lot.roof);
  category='pipes';
  for(const side of [-1,1]){
   const pipeX=side*(w/2-.42);
   box(lot,pipeX,h*.48,frontage+.24,.10,Math.max(.65,h*.87),.11,'#777b78');
   box(lot,pipeX+side*.19,h*.89,frontage+.26,.43,.10,.14,'#777b78');
   for(let clampIndex=0;clampIndex<3;clampIndex++)
    box(lot,pipeX,(clampIndex+.5)*h/3,frontage+.32,.20,.055,.17,'#4d534f');
  }
  category='masonry';
  // Material-specific relief (timber planks, irregular stone and brick courses)
  // together with broken cladding, exposed supports and ripped-out shutters.
  for(let k=0;k<(mobile?5:16);k++){
   const side=k%2?1:-1,xx=(r()-.5)*w*.9,yy=.5+r()*(h-.7);
   const wood=lot.material==='timber',brick=lot.material==='red-brick';
   const ww=wood?.10:brick?.52:.2+r()*.6,hh=wood?1+r():brick?.14:.22+r()*.35;
   box(lot,xx,yy,side*(frontage+.075),ww,hh,.14,k%3?lot.detail:lot.trim);
  }
  for(let k=0;k<(mobile?2:5);k++){
   const x=(r()-.5)*w*.73;
   box(lot,x,.37,frontage+1+r()*.9,.5+r()*.7,.56,.55,k%2?lot.trim:lot.detail);
  }
  // Pre-existing damage ranges from exposed broken windows to missing parapets.
  if(lot.decay>.45){
   box(lot,w*.29,h-.25,frontage+.34,w*.34,.3,.66,'#51483c');
   if(lot.decay>.72)box(lot,-w*.25,h-.5,frontage+.38,w*.3,.37,.65,'#342f29');
  }
  lotRanges.set(lot.index,[begin,position.length/3]);
 }
 current=-1;
 // Visibly tilted, broken power poles and corrugated roofs built from solid geometry rather than planes.
 for(let i=0;i<34;i++){
  const angle=i*Math.PI*2/34,r=98+(i%7)*20;
  const pole={x:Math.cos(angle)*r,z:Math.sin(angle)*r,yaw:-angle};
  box(pole,(i%2?1:-1)*.8,3.3,0,.24,6.6,.24,'#5e5b54');
  box(pole,0,6.1,0,2.5,.2,.3,'#514b44');
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
 geo.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(color,3));
 geo.setAttribute('cityLotId',new THREE.Float32BufferAttribute(lotIds,1));
 geo.setAttribute('cityLocal',new THREE.Float32BufferAttribute(localPoints,3));
 geo.setAttribute('cityTile',new THREE.Float32BufferAttribute(tilePoints,3));
 geo.setIndex(indices);geo.computeBoundingSphere();
 const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:.02,side:THREE.FrontSide}));
 mesh.name='Batched solid concrete, timber, red-brick, stone and ochre ruined homes';
 mesh.userData.lotRanges=lotRanges;mesh.userData.partRanges=partRanges;
 return mesh;
}
export function signAtlas(lots,stablePixels=false){
 // Three separately designed layouts, packed under the 4096px texture limit.
 const columns=40,tile=96,slots=new Map(),entries=[];
 // Allocate only artwork actually referenced by the geometry, at the original resolution.
 for(const lot of lots){
  const signs=citySignSpecs(lot),flat=cityShopSignSpec(lot),roof=signs.find(s=>!s.blade);
  for(const [variant,sign] of [[0,flat],[1,signs.find(s=>s.blade)],[2,roof]]){
   if(!sign)continue;
   slots.set(lot.index*3+variant,entries.length);entries.push({lot,variant,sign});
  }
 }
 const rows=Math.max(1,Math.ceil(entries.length/columns));
 const draw=(g,i,x,y)=>{
  const {lot,variant,sign}=entries[i];
  (variant===2?drawRooftopSignArtwork:drawSignArtwork)(g,x,y,tile,tile,{color:variant===2?sign.color||lot.style[3]:lot.style[3],title:variant===2?lot.style[1]:lot.shopName,subtitle:variant===2?lot.style[2]:lot.enName,shopKind:lot.style[0],vertical:variant===1,aspect:variant===1?.5:variant===2?roofVisual(lot,sign).width/roofVisual(lot,sign).height:sign.width/sign.height,...citySignArtOptions(lot,variant),...(variant===2?{seed:lot.index}:{}),...(highRiseCompanySign(lot.floors,lot.index)||{})});
 };
 let map;
 if(stablePixels){
  try{map=paintAtlasBands(THREE,columns,rows,tile,entries.length,draw);}
  catch(error){console.warn('Banded city sign atlas unavailable; original upload retained',error);}
 }
 if(!map){
  const canvas=document.createElement('canvas');canvas.width=columns*tile;canvas.height=rows*tile;
  const g=canvas.getContext('2d');if(!g)throw Error('City sign atlas canvas unavailable');
  entries.forEach((_,i)=>draw(g,i,i%columns*tile,Math.floor(i/columns)*tile));
  map=new THREE.CanvasTexture(canvas);
 }
 map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=2;
 return {map,columns,rows,tile,slots};
}
function buildShopSigns(lots,stablePixels=false){
 const atlas=signAtlas(lots,stablePixels),p=[],uv=[],ids=[],lotIds=[],roofLights=[],ranges=new Map(),partRanges=new Map();
 const quad=(lot,points,variant)=>{
  const base=p.length/3;for(const [x,y,z] of points){const q=localToWorld(lot,x,z);p.push(q[0],y,q[1]);lotIds.push(lot.index);}
  const i=atlas.slots.get(lot.index*3+variant),col=i%atlas.columns,row=Math.floor(i/atlas.columns),mx=.8/(atlas.columns*atlas.tile),my=.8/(atlas.rows*atlas.tile);
  const l=col/atlas.columns+mx,r=(col+1)/atlas.columns-mx,t=1-(row+1)/atlas.rows+my,b=1-row/atlas.rows-my;
  uv.push(l,t,r,t,r,b,l,b);ids.push(base,base+1,base+2,base,base+2,base+3);
   const mode=variant===2?rooftopSignMode(lot.index)+1:0,phase=variant===2?(lot.index%97)*.73:0;
   for(const u of [0,1,1,0])roofLights.push(mode,phase,u);
 };
 for(const lot of lots){
  const begin=p.length/3,flat=cityShopSignSpec(lot);
  if(flat){const y=flat.y,z=flat.z+flat.depth/2+.008,a=flat.x-flat.width/2,b=flat.x+flat.width/2;quad(lot,[[a,y-.39,z],[b,y-.39,z],[b,y+.39,z],[a,y+.39,z]],0);partRanges.set(lot.index+':sign',[[begin,p.length/3]]);}
  for(const s of citySignSpecs(lot)){
   const start=p.length/3,a=s.x-s.width/2,b=s.x+s.width/2,c=s.y-s.height/2+.035,d=s.y+s.height/2-.035,e=s.z-s.depth/2+.035,g=s.z+s.depth/2-.035;
   if(s.blade){quad(lot,[[a-.008,c,e],[a-.008,c,g],[a-.008,d,g],[a-.008,d,e]],1);quad(lot,[[b+.008,c,g],[b+.008,c,e],[b+.008,d,e],[b+.008,d,g]],1);}
   else{for(const points of rooftopBillboardFaces(roofVisual(lot,s)))quad(lot,points,2);}
   partRanges.set(lot.index+':'+s.id,[[start,p.length/3]]);
  }
  ranges.set(lot.index,[begin,p.length/3]);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('cityLotId',new THREE.Float32BufferAttribute(lotIds,1));geo.setAttribute('roofSignLight',new THREE.Float32BufferAttribute(roofLights,3));geo.setIndex(ids);geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:atlas.map,side:THREE.DoubleSide}));mesh.name='Unique bilingual shop sign atlas';mesh.userData.lotRanges=ranges;mesh.userData.partRanges=partRanges;return mesh;
}
function buildWallGraffiti(lots){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
 const g=canvas.getContext('2d'),words=['廢','拆','NO FUTURE','POST NO BILLS','觀光勝地','NOT FOR SALE','404','尋人','KEEP OUT','GHOST TOWN','STAY ALIVE','花開在廢墟','ERROR','誰在看','NIGHT RATS','NEW WORLD'];
 for(let i=0;i<16;i++){
  const x=(i%4)*256+128,y=Math.floor(i/4)*256+128;
  g.fillStyle=['#b15b4e','#d3b894','#5e9084','#d19650'][i%4];
  g.font='bold 40px sans-serif';g.textAlign='center';
  g.fillText(words[i],x,y,220);
 }
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const p=[],uv=[],indices=[],lotIds=[],ranges=new Map();
 for(const lot of lots){
  const base=p.length/3,idx=lot.index%16,c=idx%4,row=Math.floor(idx/4);
  const y=Math.min(lot.height-.8,3.7),z=lot.depth/2+.012,w=lot.width*.25;
  for(const [x,h] of [[-w,y-.43],[w,y-.43],[w,y+.43],[-w,y+.43]]){
   const v=localToWorld(lot,x,z);p.push(v[0],h,v[1]);
  }
  const m=.012,l=c/4+m,r=(c+1)/4-m,t=1-(row+1)/4+m,b=1-row/4-m;
  uv.push(l,t,r,t,r,b,l,b);indices.push(base,base+1,base+2,base,base+2,base+3);
   lotIds.push(lot.index,lot.index,lot.index,lot.index);
  ranges.set(lot.index,[base,p.length/3]);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setAttribute('cityLotId',new THREE.Float32BufferAttribute(lotIds,1));
  geo.setIndex(indices);geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
 mesh.name='Batched hand-sprayed bilingual wall graffiti and vandalism';mesh.userData.lotRanges=ranges;return mesh;
}
function wires(lots){
 const p=[],line=(a,b)=>p.push(...a,...b);
 for(let i=0;i<lots.length;i+=3){
  const a=lots[i],b=lots[i+1];if(!b||a.band!==b.band)continue;
  let prev=[a.x,a.height*.81,a.z];
  for(let j=1;j<=7;j++){
   const t=j/7,next=[a.x+(b.x-a.x)*t,a.height*.81+(b.height*.8-a.height*.81)*t-1.2*Math.sin(Math.PI*t),a.z+(b.z-a.z)*t];
   line(prev,next);prev=next;
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 return new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#29271e',opacity:.85,transparent:true}));
}
function instance(geometry,material,count,name){
 const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=name;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;return mesh;
}
// Three.js can upload only the damaged lot's contiguous vertex range.
// Marking the entire city buffer dirty on every shake previously sent all
// 432 houses' vertices to the GPU on each rendered frame.
export function markPositionRangeDirty(attribute,start,end){
 if(end<=start)return;
 if(typeof attribute.addUpdateRange==='function')attribute.addUpdateRange(start*3,(end-start)*3);
 attribute.needsUpdate=true;
}
// The 77cb8c5 dirty-range GPU upload is retained. The remaining spike was
// calculating 5+ trigonometric functions and many per-vertex arrays on EVERY
// animation frame. Factor the exact original shear / roof / corner formulas
// into coefficients once, and update the damaged lot with multiplications.
const clamp01=v=>Math.max(0,Math.min(1,v));
export function buildCityDeformationBasis(lot,original,start,end,roofRanges=[]){
 const count=end-start,base=new Float32Array(count*3),
  cut=new Float32Array(count*3),corner=new Uint8Array(count);
 const cs=Math.cos(lot.yaw),sn=Math.sin(lot.yaw);
 const survivor=(lot.height/lot.floors)*(lot.floors===1?.32:.76);
 const length=Math.max(1,lot.height-survivor);
 const roofCollapse=(lot.height/lot.floors)*(lot.floors===1?.32:.76);
 const ruinRoof=roofCollapse+(lot.height+.13-roofCollapse)*.10;
 const width=lot.width*.5,depth=lot.depth*.5;
 for(let i=start;i<end;i++){
  const o=i*3,k=(i-start)*3,x=original[o],y=original[o+1],z=original[o+2];
  let isRoof=false;
  for(let j=0;j<roofRanges.length;j++){
   if(i>=roofRanges[j][0]&&i<roofRanges[j][1]){isRoof=true;break;}
  }
  const dx=x-lot.x,dz=z-lot.z,lx=dx*cs-dz*sn,lz=dx*sn+dz*cs;
  const edge=Math.min(1,(Math.abs(lx)/width+Math.abs(lz)/depth)*.5);
  const weight=isRoof?1:.38+.62*edge;
  const rise=Math.max(0,y-survivor),factor=Math.min(1,rise/length);
  const noise=Math.sin(lot.index*.73+x*.81+z*.59+y*1.13);
  const compression=.08+.075*(.5+.5*noise);
  const ruinedY=isRoof?ruinRoof+(y-(lot.height+.13))*.16:
   y<=survivor?y:survivor+rise*compression;
  base[k]=Math.sin(y*1.9+lot.index*.9)*factor*.35*weight;
  base[k+1]=(ruinedY-y)*weight;
  base[k+2]=Math.cos(y*1.5+lot.index*.7)*factor*.35*weight;
  const diagonal=clamp01((Math.abs(lx)/width+Math.abs(lz)/depth-1.02)/.98);
  const upper=clamp01((y-lot.height*.15)/Math.max(.2,lot.height*.85));
  const intensity=diagonal*upper;
  if(intensity<=0)continue;
  const sx=lx>=0?1:-1,sz=lz>=0?1:-1;
  const id=(sx<0?1:0)+(sz<0?2:0);
  corner[i-start]=1+((id-(lot.index&3)+4)&3);
  const insideX=-sx*Math.min(2.65,lot.width*.39)*intensity;
  const insideZ=-sz*Math.min(2.65,lot.depth*.39)*intensity;
  cut[k]=cs*insideX+sn*insideZ;
  cut[k+1]=-Math.min(isRoof?2.15:4.2,lot.height*(isRoof?.31:.49))*intensity;
  cut[k+2]=-sn*insideX+cs*insideZ;
 }
 return {base,cut,corner};
}
function cornerTiers(tier){
 const strength=new Float32Array(5);
 for(let first=1;first<=4;first++){
  const hits=clamp01(tier-first+1)+clamp01(tier-first-3)+clamp01(tier-first-7);
  strength[first]=Math.min(1,hits*.82);
 }
 return strength;
}
export function applyCityDeformationBasis(original,positions,start,end,basis,tier,shakeX=0,shakeZ=0){
 const amount=cityCollapseProgress(tier),strength=cornerTiers(tier);
 const {base,cut,corner}=basis;
 for(let i=start;i<end;i++){
  const j=i*3,k=(i-start)*3;
  if(positions[j+1]<-50)continue; // Detached fixtures never grow back.
  const f=strength[corner[i-start]];
  positions[j]=original[j]+base[k]*amount+cut[k]*f+shakeX;
  positions[j+1]=original[j+1]+base[k+1]*amount+cut[k+1]*f;
  positions[j+2]=original[j+2]+base[k+2]*amount+cut[k+2]*f+shakeZ;
 }
}
function chunkDescriptions(lot){
  const floorH=lot.height/lot.floors;
  const descriptions=[
   [0,.22,0,lot.width+.15,.44,lot.depth+.15,lot.trim],
   ...Array.from({length:lot.floors},(_,level)=>{
    const taper=level&&lot.silhouette%3===0?.79:1;
    const shift=level?lot.offset*(level%2?1:-.4):0;
    const setback=level&&lot.silhouette%4===0?(level%2?.8:-.4):0;
    return [shift,(level+.5)*floorH,setback,lot.width*taper,floorH*.97,
      lot.depth*(level&&lot.silhouette%5===0?.86:1),level&&lot.silhouette%4===1?lot.detail:lot.color];
   }),
   [0,lot.height+.09,0,lot.width+.4,.24,lot.depth+.36,lot.roof],
   [-lot.width*.36,lot.height*.52,lot.depth*.43,.24,Math.max(.7,lot.height*.75),.3,lot.trim],
   [lot.width*.37,lot.height*.46,-lot.depth*.45,.3,Math.max(.7,lot.height*.74),.35,lot.detail],
   [0,.3,lot.depth*.53,lot.width*.72,.52,.44,lot.color]
  ];
 return descriptions;
}

// One 24 KiB texture replaces streamed position buffers for all 432 buildings.
// The shader evaluates exactly the same shear, roof and angular cut as the
// shared collision model. Only detached vertices still update the buffers.
export function cityDeformationTexture(lots){
 const width=512,data=new Float32Array(width*3*4);
 for(const l of lots){const i=l.index*4;data.set([l.x,l.z,Math.cos(l.yaw),Math.sin(l.yaw)],width*4+i);data.set([l.width,l.depth,l.height,l.floors],width*8+i);}
 const texture=new THREE.DataTexture(data,width,3,THREE.RGBAFormat,THREE.FloatType);
 texture.needsUpdate=true;
 return {texture,set(index,tier,x,z){data.set([tier,x,z,cityCollapseProgress(tier)],index*4);texture.needsUpdate=true;},reset(){data.fill(0,0,width*4);texture.needsUpdate=true;}};
}

function installDeformation(mesh,pose){
 const {geometry,material}=mesh,flags=new Uint8Array(geometry.attributes.position.count);
 for(const [key,ranges] of mesh.userData.partRanges||[])if(/:(?:sheets-roof|roof-foundation)$/.test(key))for(const [a,b] of ranges)flags.fill(1,a,b);
 geometry.setAttribute('cityRoofFlag',new THREE.BufferAttribute(flags,1));
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>key+'-gpu-pose-v1';
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.uniforms.uCityPose={value:pose.texture};
  shader.vertexShader='uniform sampler2D uCityPose;\nattribute float cityRoofFlag;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  if(cityLotId>=0. && position.y>=-50.){
   float id=floor(cityLotId+.5),u=(id+.5)/512.;
   vec4 pose=texture2D(uCityPose,vec2(u,1./6.));
   transformed.xz+=pose.yz;
   if(pose.x>0.){
    vec4 frame=texture2D(uCityPose,vec2(u,.5));
    vec4 lot=texture2D(uCityPose,vec2(u,5./6.));
    vec2 d=position.xz-frame.xy;
    vec2 local=vec2(d.x*frame.z-d.y*frame.w,d.x*frame.w+d.y*frame.z);
    float y=position.y,edge=dot(abs(local),2./lot.xy),roof=cityRoofFlag;
    float survivor=lot.z/lot.w*(lot.w<1.5?.32:.76),rise=max(0.,y-survivor);
    float weight=mix(.38+.62*min(1.,edge*.5),1.,roof);
    float noise=sin(id*.73+position.x*.81+position.z*.59+y*1.13);
    float ruinedY=mix(min(y,survivor)+rise*(.08+.075*(.5+.5*noise)),survivor+(lot.z+.13-survivor)*.1+(y-lot.z-.13)*.16,roof);
    float shear=min(1.,rise/max(1.,lot.z-survivor))*.35;
    transformed+=vec3(sin(y*1.9+id*.9)*shear,ruinedY-y,cos(y*1.5+id*.7)*shear)*weight*pose.w;
    float intensity=clamp((edge-1.02)/.98,0.,1.)*clamp((y-lot.z*.15)/max(.2,lot.z*.85),0.,1.);
    float quadrant=step(local.x,-.0000001)+2.*step(local.y,-.0000001);
    float first=1.+mod(quadrant-mod(id,4.)+4.,4.);
    float strength=min(1.,.82*(clamp(pose.x-first+1.,0.,1.)+clamp(pose.x-first-3.,0.,1.)+clamp(pose.x-first-7.,0.,1.)));
    vec2 cut=mix(vec2(-1.),vec2(1.),step(local,vec2(-.0000001)))*min(vec2(2.65),lot.xy*.39);
    transformed+=vec3(cut.x*frame.z+cut.y*frame.w,-min(mix(4.2,2.15,roof),lot.z*mix(.49,.31,roof)), -cut.x*frame.w+cut.y*frame.z)*intensity*strength;
   }
  }`);
 };
}

export class OuterCity{
 constructor(scene,{mobile=false,renderer=null}={}){
  this.scene=scene;this.mobile=mobile;this.root=new THREE.Group();
  this.root.name='High-density ruined city, solid collision and staged destruction';scene.add(this.root);
  this.lots=CITY_LOTS;this.lotById=new Map(this.lots.map(lot=>[lot.id,lot]));this.damage={};this.lastDamage=null;this.hidden=new Set();this.flashes=[];this.debris=[];this.chunks=new Map();
   this.renderedTiers=new Map();this.poseCache=new Map();this.collapseAnimations=new Map();this.shakes=new Map();this.seenCityEvents=new Set();
  this.plumeResources=createPlumeResources();this.partsHidden=new Set();
  this.impactPlumes=new CityImpactPlumes(this.root,this.plumeResources,mobile);
  this.fireField=new CityFireField(this.root,this.lots,this.plumeResources,mobile);
  this.splinters=new CitySplinterField(this.root,mobile);
  this.preparedChunks=new Map();this.preparingChunks=new Map();this.chunkBuildQueue=[];
  this.pendingEjections=[];this.pendingEjectionKeys=new Set();
  this.fixturePrefabs=new Map();this.fixtureWarmQueue=[];
  this.deformationBasis=new Map();this.basisIdleQueue=[];this.basisIdleHandle=null;
  this.basisLastNearby=0;this.basisDisposed=false;
  this.cube=new THREE.BoxGeometry(1,1,1);
  // Build detailed chipped plaster, framed glass, reinforcement and brick
  // templates at scene load rather than extruding dozens of shapes PER HIT.
  // Every house of the same material uses the same original palette; each
  // animated clone retains the complete native mesh/material detail.
  this.scrapPrefabs=new Map();this.scrapBatches=[];this.rubbleMaterial=packedRubbleMaterial();
  for(const lot of this.lots){
   if(this.scrapPrefabs.has(lot.material))continue;
   this.scrapPrefabs.set(lot.material,Array.from({length:4},(_,i)=>
    buildBrokenStructure(lot,18+i,.24+i*.07,.31+i*.06,.16+i*.014,
     i%3===0?'#87979c':i%2?lot.trim:lot.detail)));
  }
  for(const templates of this.scrapPrefabs.values())for(const template of templates){
   const packed=packRubble(template,this.rubbleMaterial);
   const batch=instance(packed.geometry,this.rubbleMaterial,32,'Instanced chipped facade fragments');
   batch.count=0;batch.visible=false;this.scrapBatches.push(batch);template.userData.batch=batch;this.root.add(batch);
  }
  // Outer district is covered by GrassField's continuous living grass canopy.
  this.walls=batchGeometry(this.lots,mobile);this.facade=installFacadeCracks(this.walls);
  this.signs=buildShopSigns(this.lots,renderer?.capabilities?.isWebGL2===true&&useStablePaintPixels());this.graffiti=buildWallGraffiti(this.lots);
   installAttachedFlash(this.signs,this.facade.texture);installRooftopSignLighting(this.signs.material,{batched:true});installAttachedFlash(this.graffiti,this.facade.texture);
  this.gpuPose=cityDeformationTexture(this.lots);
  for(const mesh of [this.walls,this.signs,this.graffiti]){
    mesh.userData.originalPositions=mesh.geometry.attributes.position.array.slice();
    mesh.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false; // The vertex positions change during staged structural collapse.
    installDeformation(mesh,this.gpuPose);
   }
  this.visibilityBatches=[this.walls,this.signs,this.graffiti].map(mesh=>new CityVisibleIndices(mesh.geometry,mesh));
  this.root.add(this.walls,this.signs,this.graffiti,wires(this.lots));
  this.wallPaint=new CityWallPaint(this.root,this);
  const rand=random(78142),bins=mobile?16:30;
  this.dumpsters=instance(new THREE.CylinderGeometry(.5,.47,1.1,7),new THREE.MeshStandardMaterial({color:'#4b615a'}),bins,'Open foul dumpsters');
  this.bags=instance(new THREE.IcosahedronGeometry(.3,0),new THREE.MeshStandardMaterial({color:'#202426'}),mobile?75:150,'Scattered black rubbish bags');
  this.litter=instance(new THREE.PlaneGeometry(.4,.3),new THREE.MeshBasicMaterial({color:'#d7cbb3',side:THREE.DoubleSide}),mobile?75:160,'Windblown tissue paper, leaflets and plastic');
  this.rats=instance(new THREE.SphereGeometry(.2,7,5),new THREE.MeshStandardMaterial({color:'#48413e'}),mobile?15:30,'Small alley rats');
  this.tails=instance(new THREE.CylinderGeometry(.02,.015,.5,4),new THREE.MeshStandardMaterial({color:'#866c62'}),this.rats.count,'Moving rat tails');
  this.root.add(this.dumpsters,this.bags,this.litter,this.rats,this.tails);
  this.ratRecords=[];this.litterRecords=[];this.bagRecords=[];
  const tmp=new THREE.Object3D();
  for(let i=0;i<bins;i++){
   const lot=this.lots[(i*23)%this.lots.length],a=lot.angle,r=Math.hypot(lot.x,lot.z)-5;
   tmp.position.set(Math.cos(a)*r,.55,Math.sin(a)*r);tmp.rotation.y=rand()*6;tmp.updateMatrix();this.dumpsters.setMatrixAt(i,tmp.matrix);
  }
  for(let i=0;i<this.bags.count;i++){
   const lot=this.lots[(i*19)%this.lots.length],a=rand()*6.28,r=5+rand()*6,x=lot.x+Math.cos(a)*r,z=lot.z+Math.sin(a)*r;
   this.bagRecords.push({x,z,phase:rand()*20});
  }
  for(let i=0;i<this.litter.count;i++){
   const a=rand()*6.28,r=CITY_INNER_RADIUS+rand()*(CITY_OUTER_RADIUS-CITY_INNER_RADIUS);
   this.litterRecords.push({x:Math.cos(a)*r,z:Math.sin(a)*r,phase:rand()*20});
  }
  for(let i=0;i<this.rats.count;i++){
   const lot=this.lots[(i*13)%this.lots.length],a=rand()*6.28;
   this.ratRecords.push({x:lot.x+Math.cos(a)*6,z:lot.z+Math.sin(a)*6,phase:rand()*20});
  }
  // Buzzing dumpster flies: GPU point cloud with one material and draw.
  const flyCount=mobile?32:96,positions=new Float32Array(flyCount*3);
  for(let i=0;i<flyCount;i++){
   const lot=this.lots[(i*7)%this.lots.length];
   positions.set([lot.x,1+rand()*2,lot.z],i*3);
  }
  const flyGeo=new THREE.BufferGeometry();flyGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  this.flies=new THREE.Points(flyGeo,new THREE.PointsMaterial({color:'#22211f',size:.12}));
  this.flies.name='Buzzing dumpster flies';this.root.add(this.flies);
  this.update(0,0);
 }
 async warmEffects(renderer,camera){
  // Warm the actual world target permutation (including the existing lights
  // and fog). These templates are normally detached and skipped at boot.
  const testLot=this.lots[0],group=new THREE.Group();group.name='City shader warmup';
  this.impactPlumes.setVisible(true);
  for(const part of ['windows-0-0','sign','pipes','sheets-awning','timber','tiles','stone','sheets-roof','pillars-0'])group.add(this.cloneFixture(testLot,part));
  for(const batch of this.scrapBatches){batch.visible=true;batch.count=1;batch.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,-1000,0));}
  group.position.copy(camera.position);group.position.y-=2;
  this.scene.add(group);
  const before=renderer.getRenderTarget(),target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
  try{renderer.setRenderTarget(target);await renderer.compileAsync(this.scene,camera);for(const program of renderer.info.programs)program.getUniforms();}
  finally{this.impactPlumes.setVisible(false);for(const batch of this.scrapBatches){batch.visible=false;batch.count=0;}renderer.setRenderTarget(before);group.removeFromParent();group.clear();target.dispose();}
 }
 // Distinct physical windows, signs, iron sheets and stone assemblies
 // remain detailed. Keep their complete geometry/material/texture once per
 // (house,part) rather than rebuilding an ExtrudeGeometry and 512px sign
 // canvas on every attack. Clones only duplicate transform nodes.
 getFixtureTemplate(lot,part){
  const key=lot.index+':'+part;
  let template=this.fixturePrefabs.get(key);
  if(!template){
   template=buildDetachableFixture(lot,part,lot.index*101+part.length*137);
   if(this.rubbleMaterial)packRubble(template,this.rubbleMaterial);
   this.fixturePrefabs.set(key,template);
   this.pruneFixtureTemplates();
  }else{
   this.fixturePrefabs.delete(key);this.fixturePrefabs.set(key,template);
  }
  return template;
 }
 pruneFixtureTemplates(){
  if(!this.fixturePrefabs)return; // Legacy/test objects may not own a cache.
  const max=this.mobile?24:72;
  let scanned=0;
  while(this.fixturePrefabs.size>max&&scanned++<this.fixturePrefabs.size){
   const key=this.fixturePrefabs.keys().next().value;
   const inUse=this.debris.some(effect=>effect.pieces.some(piece=>
    piece.mesh.userData.fixtureCacheKey===key));
   if(inUse){
    const template=this.fixturePrefabs.get(key);
    this.fixturePrefabs.delete(key);this.fixturePrefabs.set(key,template);
    continue;
   }
   const template=this.fixturePrefabs.get(key);
   this.fixturePrefabs.delete(key);
   template.traverse(o=>{o.geometry?.dispose();if(o.material)
    for(const mat of Array.isArray(o.material)?o.material:[o.material]){
     mat.map?.dispose();if(mat!==this.rubbleMaterial)mat.dispose();
    }});
  }
 }
 cloneFixture(lot,part){
  const instance=this.getFixtureTemplate(lot,part).clone(true);
  instance.userData.sharedCityFixture=true;
  instance.userData.fixtureCacheKey=lot.index+':'+part;
  return instance;
 }
 hideRange(mesh,start,end){
  const attr=mesh.geometry.attributes.position;
  for(let i=start;i<end;i++)attr.array[i*3+1]=-120;
  markPositionRangeDirty(attr,start,end);
 }
 // Reuse the native detailed geometry from 77cb8c5. Cache its unchanged
 // collapse + diagonal-shatter coefficients once per lot, with a small LRU.
 getLotBasis(index){
  const lot=this.lots[index];if(!lot)return null;
  let coefficients=this.deformationBasis.get(index);
  if(!coefficients){
   const roofRanges=[
    ...(this.walls.userData.partRanges?.get(index+':sheets-roof')||[]),
    ...(this.walls.userData.partRanges?.get(index+':roof-foundation')||[])
   ];
   coefficients=[this.walls,this.signs,this.graffiti].map(mesh=>{
    const range=mesh.userData.lotRanges?.get(index),original=mesh.userData.originalPositions;
    return range&&original?buildCityDeformationBasis(lot,original,...range,
     mesh===this.walls?roofRanges:[]):null;
   });
  }
  this.deformationBasis.delete(index);this.deformationBasis.set(index,coefficients);
  this.pruneDeformationBasis();
  return coefficients;
 }
 pruneDeformationBasis(){
  // 24 city targets from a single ultimate plus other simultaneous hits can
  // exceed the fixed 12/32-slot LRU. The prior loop evicted an ACTIVE house
  // on every frame, recomputed its expensive three-buffer deformation basis
  // on the next frame, and caused recurring animation slow motion.
  const pinned=new Set([
   ...this.collapseAnimations.keys(),...this.shakes.keys()
  ]);
  const cap=Math.max(this.mobile?12:32,pinned.size+4);
  if(this.deformationBasis.size<=cap)return;
  // Reclaim cold entries only. Preserve the same 432 detailed facades and
  // the same continuous damage stages, with no visual quality reductions.
  for(const key of this.deformationBasis.keys()){
   if(this.deformationBasis.size<=cap)break;
   if(!pinned.has(key))this.deformationBasis.delete(key);
  }
 }
 // Populate likely attack targets during idle time, never during a skill
 // or while the 77cb8c5 per-frame rubble/ejection scheduler is busy.
 queueNearbyBasis(camera){
  if(!camera?.position||typeof requestIdleCallback!=='function')return;
  if(this.collapseAnimations.size||this.pendingEjections.length||this.debris.length)return;
  const now=performance.now();
  if(now-this.basisLastNearby<1500)return;
  this.basisLastNearby=now;
  const x=camera.position.x,z=camera.position.z;
  const nearest=this.lots.map(lot=>({index:lot.index,dist:(lot.x-x)**2+(lot.z-z)**2}))
   .sort((a,b)=>a.dist-b.dist).slice(0,this.mobile?12:32);
  this.basisIdleQueue=(this.gpuPose?[]:nearest).map(item=>item.index)
   .filter(index=>!this.deformationBasis.has(index));
  // Prime the most likely next detached fixtures only during idle time.
  // The five-instanced-splinter bursts are still immediate on every impact.
  const priority=['windows-0-0','sign','pipes','sheets-awning','timber',
   'tiles','stone','sheets-roof','pillars-0'];
  // Keep speculative fixture count below the LRU limit, reserving slots for
  // actual impacts. The old mobile 3*9=27 exceeded its 24-entry cache.
  const warmLots=Math.min(this.mobile?2:7,Math.floor(((this.mobile?24:72)-6)/priority.length));
  this.fixtureWarmQueue=nearest.slice(0,warmLots)
   .flatMap(({index})=>priority.map(part=>[index,part]))
   .filter(([index,part])=>!this.fixturePrefabs.has(index+':'+part));
  this.scheduleIdleBasisWarmup();
 }
 scheduleIdleBasisWarmup(){
  if(this.basisDisposed||this.basisIdleHandle!==null||
   !(this.basisIdleQueue.length||this.fixtureWarmQueue.length)||
   typeof requestIdleCallback!=='function')return;
  this.basisIdleHandle=requestIdleCallback(deadline=>{
   this.basisIdleHandle=null;
   if(this.basisDisposed)return;
   if(this.collapseAnimations.size||this.pendingEjections.length||this.debris.length){
    // Leave the main thread completely free while attacks are active.
    this.basisIdleQueue.length=0;return;
   }
   let built=0;
   while(deadline.timeRemaining()>8&&this.basisIdleQueue.length&&built<2){
    const index=this.basisIdleQueue.shift();
    if(!this.deformationBasis.has(index)){this.getLotBasis(index);built++;}
   }
   // Exactly one complex fixture may be generated in an idle deadline.
   // Never build a sign canvas or detailed wood/glass mesh on a spell tick.
   if(!built&&deadline.timeRemaining()>13&&this.fixtureWarmQueue.length){
    const [index,part]=this.fixtureWarmQueue.shift(),lot=this.lots[index];
    if(lot&&!this.fixturePrefabs.has(index+':'+part))this.getFixtureTemplate(lot,part);
   }
   this.scheduleIdleBasisWarmup();
  });
 }
 collapseLot(index,tier=10,shakeX=0,shakeZ=0){
  const lot=this.lots[index];if(!lot)return;
  const stamp=[tier.toFixed(4),shakeX.toFixed(4),shakeZ.toFixed(4)].join(':');
  if(this.poseCache.get(index)===stamp)return;
  this.poseCache.set(index,stamp);this.renderedTiers.set(index,tier);
  if(tier>=10)this.hidden.add(index);else this.hidden.delete(index);
  // Each animated frame applies exact precomputed diagonal geometry,
  // keeping all mesh, sign, window, paint and roof details intact.
  if(this.gpuPose)this.gpuPose.set(index,tier,shakeX,shakeZ);
  else {
  const coefficients=this.getLotBasis(index);
  for(const [meshIndex,mesh] of [this.walls,this.signs,this.graffiti].entries()){
   const range=mesh.userData.lotRanges?.get(index),original=mesh.userData.originalPositions;
   const basis=coefficients[meshIndex];
   if(!range||!original||!basis)continue;
   const attr=mesh.geometry.attributes.position;
   applyCityDeformationBasis(original,attr.array,...range,basis,tier,shakeX,shakeZ);
   markPositionRangeDirty(attr,range[0],range[1]);
  }
  }
  if(tier>=10&&shakeX===0&&shakeZ===0)this.wallPaint?.collapseLot(index);
  else this.wallPaint?.deformTier(index,tier,shakeX,shakeZ);
 }
 hidePart(index,part){
  const key=index+':'+part;
  this.partsHidden??=new Set();if(this.partsHidden.has(key))return;
  this.partsHidden.add(key);this.wallPaint?.hideSign(index,part);
  for(const [a,b] of this.walls.userData.partRanges?.get(key)||[])this.hideRange(this.walls,a,b);
  for(const [a,b] of this.signs.userData.partRanges?.get(key)||[])this.hideRange(this.signs,a,b);
  // Independent street signs and painted wall grime must survive the loss of
  // a corrugated awning or a small masonry component.
 }
 createChunks(lot,stage,animate=false){
  if(stage!==3||this.chunks.has(lot.index))return;
  const prepared=this.preparedChunks.get(lot.index);
  if(prepared){this.activatePreparedChunks(lot,prepared);return;}
  // Snapshot-created ruins also build in free-frame slices rather than
  // constructing every destroyed house synchronously during login.
  this.prepareChunks(lot);
  const job=this.preparingChunks.get(lot.index);
  if(job)job.activate=true;
 }
 // The full-resolution collapsed-house sculpture is prepared incrementally
 // after the first hit, not synchronously at the expensive killing blow.
 prepareChunks(lot){
  const index=lot.index;
  if(this.chunks.has(index)||this.preparedChunks.has(index)||this.preparingChunks.has(index))return;
  const root=new THREE.Group();root.position.set(lot.x,0,lot.z);root.rotation.y=-lot.yaw;
  root.name='Solid volumetric collapse '+lot.id;
  const job={lot,root,pieces:[],descriptions:chunkDescriptions(lot),
   random:random(900+index*73),step:0,activate:false};
  this.preparingChunks.set(index,job);this.chunkBuildQueue.push(job);
 }
 activatePreparedChunks(lot,effect){
  this.preparedChunks.delete(lot.index);
  if(this.chunks.has(lot.index))return;
  effect.stage=3;effect.animateStarted=true;effect.age=0;effect.staticRubble=true;
  const rand=random(lot.index*9067+311);
  for(const part of effect.pieces){
   // NEVER resurrect original-height floor sections for a second collapse.
   // All sculpted ruins are first revealed in their already-short, grounded
   // state, below the remaining solid roof and amid the ejected debris.
   part.mesh.scale.set(.88,.17,.86);
   part.mesh.position.set(
    part.home.x+(rand()-.5)*lot.width*.37,
    .20+part.h*.087,
    part.home.z+(rand()-.5)*lot.depth*.37);
   part.mesh.rotation.set((rand()-.5)*.32,(rand()-.5)*.24,(rand()-.5)*.33);
   part.velocity.set(0,0,0);
   part.moving=false;part.settled=true;
  }
  this.root.add(effect.root);effect.root.updateMatrixWorld(true);
  effect.worldBounds=new THREE.Box3().setFromObject(effect.root);effect.lastVisibleAt=performance.now();
  this.chunks.set(lot.index,effect);
 }
 disposePreparedChunks(effect){
  effect.root.traverse(o=>{o.geometry?.dispose();if(o.material)
   for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();});
  effect.root.removeFromParent();
 }
 stepChunkPreparation(){
  const job=this.chunkBuildQueue.shift();if(!job)return;
  if(this.preparingChunks.get(job.lot.index)!==job)return;
  const {lot,random:r}=job,index=job.step;
  const [x,y,z,w,h,d,c]=job.descriptions[index];
  const mesh=buildBrokenStructure(lot,index,w,h,d,c);
  const home=new THREE.Vector3(x,y,z);
  mesh.position.copy(home);job.root.add(mesh);
  job.pieces.push({mesh,index,home,velocity:new THREE.Vector3((r()-.5)*2,1+r()*2,(r()-.5)*2),
   spin:new THREE.Vector3((r()-.5)*1.5,0,(r()-.5)*1.5),
   h,moving:false,settled:true,wasInitiallySettled:true});
  job.step++;
  if(job.step<job.descriptions.length){this.chunkBuildQueue.push(job);return;}
  this.preparingChunks.delete(lot.index);
  const effect={root:job.root,pieces:job.pieces,stage:3,age:0,animateStarted:false};
  if(job.activate)this.activatePreparedChunks(lot,effect);
  else{
   this.preparedChunks.set(lot.index,effect);
   const limit=this.mobile?8:16;
   if(this.preparedChunks.size>limit){
    const oldest=this.preparedChunks.keys().next().value;
    this.disposePreparedChunks(this.preparedChunks.get(oldest));
    this.preparedChunks.delete(oldest);
   }
  }
 }
 flash(lot){
  // The actual facade, roof, shop sign and graffiti flash crimson, without
  // an exterior-invisible BackSide box.
  this.facade.pulse(lot.index,1);
  const existing=this.flashes.find(hit=>hit.index===lot.index);
  if(existing)existing.age=0;
  else this.flashes.push({index:lot.index,age:0});
  const shake=this.shakes.get(lot.index);
  if(shake){shake.age=0;shake.power=Math.min(.42,shake.power+.07);}
  else this.shakes.set(lot.index,{age:0,power:.19});
 }
 eject(lot,part,point,detached=false){
  // All bursts remain visible, but dozens of overlapping area-of-effect
  // hits cannot synchronously extrude dozens of architectural assemblies.
  const key=lot.index+':'+part+':'+Number(detached);
  if(this.pendingEjectionKeys?.has(key))return;
  this.pendingEjectionKeys?.add(key);
  this.pendingEjections.push({key,lot,part,point:point?.slice?.()||null,detached});
 }
 processEjections(){
  const job=this.pendingEjections.shift();
  if(!job)return false;
  this.pendingEjectionKeys?.delete(job.key);
  this.spawnEjection(job.lot,job.part,job.point,job.detached);
  return true;
 }
 spawnEjection(lot,part,point,detached=false){
  const r=random(lot.index*1259+Math.floor(performance.now())),root=new THREE.Group(),pieces=[];
  root.position.set(lot.x,0,lot.z);root.rotation.y=-lot.yaw;
  root.name='Real mounted windows, water pipes, steel awnings and chipped facade';
  const add=(mesh,speed=1)=>{
   root.add(mesh);pieces.push({mesh,velocity:new THREE.Vector3((r()-.5)*5*speed,2.5+r()*4*speed,(r()-.5)*5*speed),
    spin:new THREE.Vector3((r()-.5)*3,(r()-.5)*4,(r()-.5)*3)});
  };
  if(detached){
   // The actual detailed mounted fixture remains recognizable; this is a
   // shared deep clone and never compiles/upload a fresh GPU material on hit.
   if(part.startsWith('sign-')){
    const fixture=this.cloneFixture(lot,part);fixture.updateMatrixWorld(true);
    for(const child of [...fixture.children]){child.position.add(fixture.position);child.userData.sharedCityFixture=true;child.userData.fixtureCacheKey=fixture.userData.fixtureCacheKey;add(child,1.15);}
   }else add(this.cloneFixture(lot,part),1.15);
  }
  const local=point?this.toLocal(lot,point):[0,Math.min(2,lot.height*.5),lot.depth*.5];
  const prototypes=this.scrapPrefabs.get(lot.material);
  for(let i=0;i<(this.mobile?2:4);i++){
   // Clone transform nodes only: detailed geometry, crack shaders, windows,
   // torn metal and textures all remain shared and GPU-resident.
   const batch=prototypes[i].userData.batch;
   const fragment=batch?new THREE.Object3D():prototypes[i].clone(true);
   fragment.userData.sharedCityScrap=true;
   fragment.userData.batch=batch;
   fragment.position.set(local[0]+(r()-.5)*.5,local[1]+(r()-.5)*.6,local[2]+(r()-.5)*.4);
   fragment.scale.setScalar(.38+r()*.35);add(fragment,.75);
  }
  this.root.add(root);this.debris.push({root,pieces,age:0});
  if(this.debris.length>(this.mobile?18:32))this.removeDebris(this.debris.shift());
 }
 toLocal(lot,point){
  const dx=point[0]-lot.x,dz=point[2]-lot.z,c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
  return [dx*c-dz*s,point[1],dx*s+dz*c];
 }
 removeDebris(effect){
  for(const piece of effect.pieces){
   if(piece.mesh.userData.sharedCityScrap||piece.mesh.userData.sharedCityFixture)continue;
   // Shared architectural prefab owns this mesh's original geometry/material.
   piece.mesh.traverse(object=>{object.geometry?.dispose();if(object.material)
    for(const mat of Array.isArray(object.material)?object.material:[object.material]){
     mat.map?.dispose();if(mat!==this.rubbleMaterial)mat.dispose();
    }});
  }
  effect.root.removeFromParent();
  this.pruneFixtureTemplates?.();
 }
 spawnPlume(position,seed,limit=this.mobile?15:24){
  this.impactPlumes.spawn(position,seed,limit);
 }
 // Each 10%-HP boundary causes an independent structural drop and debris burst.
 // Strong weapons can cross multiple boundaries in one hit; animate all rapidly.
 beginCollapse(lot,previousTier,nextTier,event=null){
  if(nextTier<=previousTier)return;
  const visible=this.renderedTiers.get(lot.index)??previousTier;
  let motion=this.collapseAnimations.get(lot.index);
  // Out-of-order snapshots may already have displayed the fully collapsed
  // structure before the late final-hit event. Never animate BACKWARDS and
  // temporarily regrow a storey that has already vanished.
  if(!motion&&visible>=nextTier-.001){
   if(nextTier===10)this.createChunks(lot,3,false);
   return;
  }
  this.prepareChunks(lot);
  if(!motion){
   const start=Math.max(previousTier,Math.floor(visible));
   motion={tier:Math.max(0,start),elapsed:0,target:nextTier,triggered:0,event,lastWallAt:performance.now()};
   this.collapseAnimations.set(lot.index,motion);
  }else{
   motion.target=Math.max(nextTier,motion.target);
   if(event)motion.event=event;
  }
 }
 emitCollapseStep(lot,tier,event){
  const sequence=['windows-0-0','pipes','sign','sheets-awning','timber',
   'tiles',`windows-${Math.min(1,lot.floors-1)}-2`,'pillars-0','sheets-roof','stone'];
  const part=sequence[Math.min(9,tier-1)];
  const impact=event?.position||[lot.x,Math.min(lot.height*.65,5),lot.z+lot.depth*.5];
  this.eject(lot,part,impact,true);
  if(part==='sign'){this.hidePart(lot.index,'sign');for(const sign of citySignSpecs(lot))if(!this.partsHidden.has(lot.index+':'+sign.id)){this.eject(lot,sign.id,impact,true);this.hidePart(lot.index,sign.id);}}
  if(part==='sheets-awning')this.hidePart(lot.index,part);
  this.spawnPlume(impact,lot.index*131+tier*499);
  // More identifiable flying windows, iron sheets, wooden planks,
  // masonry and sign fragments, with only five shared draw calls.
  this.splinters?.burst(lot,tier,impact,lot.index*131+tier*499);
 }
 previewDamage(event,inputId){
  const lot=this.lots[event?.cityLotIndex];if(!lot||!inputId)return;
  this.predictedDamage??=new Map();
  const records=this.predictedDamage.get(lot.id)||new Map();
  const previousHp=Number(event.previousHp),hp=Number(event.hp);
  if(!records.has(inputId))records.set(inputId,{amount:0,expiresAt:performance.now()+1250});
  if(Number.isFinite(previousHp)&&Number.isFinite(hp))records.get(inputId).amount+=Math.max(0,previousHp-hp);
  this.predictedDamage.set(lot.id,records);this.applyPredictedFacade(lot);
  this.flash(lot);
  const point=event.position||[lot.x,1.5,lot.z];this.splinters?.burst(lot,this.damage[lot.id]?.tier||0,point,lot.index+Math.floor(performance.now()),this.mobile?5:8);
 }
 applyPredictedFacade(lot){
  const actual=this.damage[lot.id],maxHp=actual?.maxHp||CITY_MAX_HP,records=this.predictedDamage?.get(lot.id);
  const amount=[...(records?.values()||[])].reduce((n,v)=>n+v.amount,0);
  this.facade.set(lot.index,Math.max(0,(actual?.hp??maxHp)-amount),maxHp);
 }
 finishPredictedContact(inputId){
  for(const [id,records] of this.predictedDamage||[]){if(!records.delete(inputId))continue;if(!records.size)this.predictedDamage.delete(id);const lot=this.lotById.get(id);if(lot)this.applyPredictedFacade(lot);}
 }
 expirePredictedContacts(){
  const now=performance.now();for(const [id,records] of this.predictedDamage||[]){let changed=false;for(const [inputId,record] of records)if(record.expiresAt<=now){records.delete(inputId);changed=true;}if(!records.size)this.predictedDamage.delete(id);if(changed){const lot=this.lotById.get(id);if(lot)this.applyPredictedFacade(lot);}}
 }
 applyDamageEvent(event){
  const lot=this.lots[event?.cityLotIndex];if(!lot)return;
  if(event.id&&this.seenCityEvents.has(event.id))return;
  if(event.id){this.seenCityEvents.add(event.id);if(this.seenCityEvents.size>200)
   this.seenCityEvents.delete(this.seenCityEvents.values().next().value);}
  this.liveDamageRevisions??=new Map();
  if(Number.isFinite(event.revision)){
   if(event.revision<(this.liveDamageRevisions.get(lot.id)??-1))return;
   this.liveDamageRevisions.set(lot.id,event.revision);
  }
  const predicted=this.predictedDamage?.get(lot.id),alreadyFlashed=!!event.inputId&&predicted?.has(event.inputId);
  if(alreadyFlashed){predicted.delete(event.inputId);if(!predicted.size)this.predictedDamage.delete(lot.id);}
  const maxHp=event.maxHp||CITY_MAX_HP,existing=this.damage[lot.id];
  const oldHp=Number.isFinite(event.previousHp)?event.previousHp:
   existing?.hp??Math.min(maxHp,event.hp+Math.max(0,event.damage||0));
  const from=Number.isFinite(event.previousTier)?event.previousTier:cityDamageTier(oldHp,maxHp);
  const tier=cityDamageTier(event.hp,maxHp),stage=cityStage(event.hp,maxHp);
  this.damage[lot.id]={...existing,hp:event.hp,maxHp,stage,tier};
  this.fireField?.setLot(lot,event.hp,maxHp,{live:true});
  this.applyPredictedFacade(lot);
  if(!alreadyFlashed)this.flash(lot);
  // Non-threshold hits still throw fine chips, smoke and shake the building.
  if(tier===from){
   this.eject(lot,event.part||'masonry',event.position,!!event.partDestroyed);
   const impact=event.position||[lot.x,1.5,lot.z];
   this.spawnPlume(impact,lot.index+Math.floor(performance.now()),22);
   this.splinters?.burst(lot,tier,impact,lot.index+Math.floor(performance.now()),
    this.mobile?5:8);
  }else this.beginCollapse(lot,from,tier,event);
  if(event.partDestroyed&&event.part!=='masonry'){if(tier!==from&&event.part.startsWith('sign-')&&!this.partsHidden.has(lot.index+':'+event.part))this.eject(lot,event.part,event.position,true);this.hidePart(lot.index,event.part);}
 }
 syncDamage(damage={},revision=-1){
  if(damage===this.lastDamage&&(!this.liveDamageRevisions?.size||revision===this.lastDamageRevision))return;
  this.lastDamageRevision=revision;
  for(const [id,liveRevision] of this.liveDamageRevisions||[])if(liveRevision<=revision)this.liveDamageRevisions.delete(id);
  if(!Object.keys(damage).length&&Object.keys(this.damage).length&&!this.liveDamageRevisions?.size)this.resetBuildings();
  const firstSnapshot=this.lastDamage===null;
  this.lastDamage=damage;
  const byId=this.lotById??=new Map(this.lots.map(lot=>[lot.id,lot]));
  for(const [id,record] of Object.entries(damage)){
   const lot=byId.get(id);if(!lot||!record||this.liveDamageRevisions?.has(id))continue;
   const maxHp=record.maxHp||CITY_MAX_HP;
   const tier=cityDamageTier(record.hp,maxHp),stage=cityStage(record.hp,maxHp);
   const existing=this.damage[lot.id],knownTier=existing?.tier??0;
   // Combat snapshots always clone cityDamage. An unchanged HP does not
   // warrant 3 facade updates, part scans, or geometry preparation again.
   const destroyedParts=Object.entries(record.parts||{})
    .filter(([part,hp])=>hp<=0&&part!=='masonry').map(([part])=>part).sort();
   const partSig=destroyedParts.join('|');
   if(existing?.hp===record.hp&&existing?.maxHp===maxHp&&
      existing.partSig===partSig)continue;
   // A world snapshot is state, not an attack animation. On initial join
   // an empty placeholder snapshot often precedes the real damaged-city
   // snapshot; replaying all historical tiers here launched hundreds of
   // debris bursts and the whole district visibly flew apart at login.
   // Only applyDamageEvent() starts animated debris on a real live hit.
   const staticChange=!firstSnapshot&&tier!==knownTier
    &&!this.collapseAnimations.has(lot.index);
   this.damage[lot.id]={hp:record.hp,maxHp,stage,tier,partSig};
   this.fireField?.setLot(lot,record.hp,maxHp,{snapshot:true});
   this.applyPredictedFacade(lot);
   for(const part of destroyedParts)this.hidePart(lot.index,part);
   if(firstSnapshot||staticChange){
    this.collapseLot(lot.index,tier);
    if(tier>=3){
     this.hidePart(lot.index,'sign');for(const sign of citySignSpecs(lot))this.hidePart(lot.index,sign.id);
    }
    if(stage===3)this.createChunks(lot,stage,false);
   }
  }
 }
 resetBuildings(){
  this.damage={};this.lastDamage=null;this.liveDamageRevisions?.clear();this.predictedDamage?.clear();this.hidden.clear();this.partsHidden.clear();this.facade.reset();
  this.fireField?.reset();this.splinters?.reset();
  this.gpuPose?.reset();
  this.renderedTiers.clear();this.poseCache.clear();this.deformationBasis?.clear();
  this.basisIdleQueue.length=0;this.fixtureWarmQueue.length=0;this.basisLastNearby=0;
  this.collapseAnimations.clear();this.shakes.clear();this.seenCityEvents.clear();
  this.wallPaint?.resetBuildings();
  for(const mesh of [this.walls,this.signs,this.graffiti]){
   const attr=mesh.geometry.attributes.position,original=mesh.userData.originalPositions;
   if(original){attr.array.set(original);attr.clearUpdateRanges?.();attr.needsUpdate=true;}
  }
  for(const effect of this.chunks.values()){
   effect.root.traverse(obj=>{obj.geometry?.dispose();if(obj.material)
    for(const mat of Array.isArray(obj.material)?obj.material:[obj.material])mat.dispose();});
   effect.root.removeFromParent();
  }
  this.chunks.clear();
  for(const job of this.preparingChunks.values())this.disposePreparedChunks(job);
  for(const effect of this.preparedChunks.values())this.disposePreparedChunks(effect);
  this.preparingChunks.clear();this.preparedChunks.clear();this.chunkBuildQueue=[];
  this.pendingEjections=[];this.pendingEjectionKeys?.clear();this.deformationBasis?.clear();
  for(const effect of this.debris)this.removeDebris(effect);this.debris=[];
  this.impactPlumes.reset();
  // Hit tints are stored in the shared damage texture and have no overlay meshes.
  this.flashes=[];
 }
 blocked(x,z,y=0){return cityBlocked(x,z,y,this.damage);}
 update(time,dt=1/60,camera=null){
  updateRooftopSignClock(time);
  const tmp=this.frameTransform??=new THREE.Object3D();
  this.updateRubbleResidency(camera);
  for(let i=0;i<this.bagRecords.length;i++){
   const p=this.bagRecords[i];tmp.position.set(p.x,.18+Math.abs(Math.sin(time+p.phase))*.1,p.z);
   tmp.scale.set(.6,.7,.6);tmp.rotation.set(p.phase,time*.15,0);tmp.updateMatrix();this.bags.setMatrixAt(i,tmp.matrix);
  }
  this.bags.instanceMatrix.needsUpdate=true;
  for(let i=0;i<this.litterRecords.length;i++){
   const p=this.litterRecords[i];tmp.position.set(p.x+Math.sin(time*.4+p.phase)*.5,.12+Math.abs(Math.sin(time+p.phase))*.6,p.z);
   tmp.rotation.set(time+p.phase,time*.7,p.phase);tmp.scale.set(.5,.7,1);tmp.updateMatrix();this.litter.setMatrixAt(i,tmp.matrix);
  }
  this.litter.instanceMatrix.needsUpdate=true;
  for(let i=0;i<this.ratRecords.length;i++){
   const p=this.ratRecords[i],a=time*.8+p.phase,x=p.x+Math.cos(a)*1.25,z=p.z+Math.sin(a)*1.15;
   tmp.position.set(x,.25,z);tmp.rotation.set(0,-a,0);tmp.scale.set(1.3,.67,1.8);tmp.updateMatrix();this.rats.setMatrixAt(i,tmp.matrix);
   tmp.position.set(x-.3*Math.sin(a),.15,z-.3*Math.cos(a));tmp.scale.set(1,1,1);tmp.rotation.set(.7,a,0);tmp.updateMatrix();this.tails.setMatrixAt(i,tmp.matrix);
  }
  this.rats.instanceMatrix.needsUpdate=this.tails.instanceMatrix.needsUpdate=true;
  this.expirePredictedContacts();
  // Flash and deformation apply to the actual building geometry and decals.
  for(let i=this.flashes.length-1;i>=0;i--){
   const flash=this.flashes[i];flash.age+=dt;
   this.facade.pulse(flash.index,Math.pow(Math.max(0,1-flash.age/.34),1.15));
   if(flash.age>=.34)this.flashes.splice(i,1);
  }
  const animated=this.animatedLots??=new Set();animated.clear();
  for(const index of this.collapseAnimations.keys())animated.add(index);
  for(const index of this.shakes.keys())animated.add(index);
  for(const index of animated){
   const lot=this.lots[index],motion=this.collapseAnimations.get(index),shake=this.shakes.get(index);
   if(!lot)continue;
   let visibleTier=this.renderedTiers.get(index)??this.damage[lot.id]?.tier??0;
   if(motion){
    const remaining=motion.target-motion.tier;
    const duration=Math.max(.095,.22-Math.min(8,remaining)*.013);
    if(remaining>0){
     if(motion.triggered!==motion.tier+1){
      motion.triggered=motion.tier+1;this.emitCollapseStep(lot,motion.tier+1,motion.event);
     }
     // V035's authored per-tier duration is retained, but a slow GPU
     // frame must not stretch a confirmed demolition into slow motion.
     const wallNow=performance.now();motion.elapsed+=Math.max(dt,Math.min(.25,(wallNow-(motion.lastWallAt??wallNow))/1000));motion.lastWallAt=wallNow;
     const t=Math.min(1,motion.elapsed/duration),ease=t*t*(3-2*t);
     visibleTier=motion.tier+ease;
     if(t>=1){
      motion.tier++;motion.elapsed=0;visibleTier=motion.tier;
      if(motion.tier>=motion.target){
       this.collapseAnimations.delete(index);
       if(motion.tier===10)this.createChunks(lot,3,true);
      }
     }
    }else this.collapseAnimations.delete(index);
   }
   let shakeX=0,shakeZ=0;
   if(shake){
    shake.age+=dt;
    const fade=Math.pow(Math.max(0,1-shake.age/.45),2);
    shakeX=Math.sin(shake.age*97+index)*shake.power*fade;
    shakeZ=Math.cos(shake.age*87+index*.17)*shake.power*fade;
    if(shake.age>=.45)this.shakes.delete(index);
   }
   this.collapseLot(index,visibleTier,shakeX,shakeZ);
  }
  this.fireField?.update(time);
  this.splinters?.update(dt);
  this.queueNearbyBasis(camera);
  this.impactPlumes.update(dt);
  for(const batch of this.scrapBatches){batch.count=0;batch.visible=false;}
  for(let i=this.debris.length-1;i>=0;i--){
   const effect=this.debris[i];effect.age+=dt;
   if(effect.age>3.5){this.removeDebris(effect);this.debris.splice(i,1);continue;}
   effect.root.updateMatrixWorld(true);
   for(const piece of effect.pieces){
    piece.velocity.y-=14*dt;piece.mesh.position.addScaledVector(piece.velocity,dt);
    piece.mesh.rotation.x+=piece.spin.x*dt;piece.mesh.rotation.y+=piece.spin.y*dt;piece.mesh.rotation.z+=piece.spin.z*dt;
    if(effect.root.position.y+piece.mesh.position.y<.14){
     piece.mesh.position.y=.14-effect.root.position.y;piece.velocity.y=Math.abs(piece.velocity.y)*.22;
     piece.velocity.x*=.65;piece.velocity.z*=.65;
    }
    const batch=piece.mesh.userData.batch;
    if(batch){piece.mesh.updateMatrix();batch.setMatrixAt(batch.count++,tmp.matrix.multiplyMatrices(effect.root.matrixWorld,piece.mesh.matrix));batch.visible=true;}
   }
  }
  for(const batch of this.scrapBatches)if(batch.count){batch.instanceMatrix.clearUpdateRanges();batch.instanceMatrix.addUpdateRange(0,batch.count*16);batch.instanceMatrix.needsUpdate=true;}
  // One costly VFX geometry job per frame, including simultaneous AOE hits.
  // Structural tiers, collision, hit tint and smoke still react immediately.
  if(!this.processEjections())this.stepChunkPreparation();
  this.pruneDeformationBasis();
  // Ruined buildings are already grounded; the fragment pools handle all
  // falling motion without iterating through every destroyed house each frame.
 }
 prepareVisibility(camera){
  if(!this.visibilityBatches)return;
  camera.updateWorldMatrix(true,false);
  const matrix=this.cityVisibleMatrix??=new THREE.Matrix4(),frustum=this.cityVisibleFrustum??=new THREE.Frustum();
  matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  if(this.cityLastView?.equals(matrix))return;
  (this.cityLastView??=new THREE.Matrix4()).copy(matrix);frustum.setFromProjectionMatrix(matrix);
  for(const batch of this.visibilityBatches)batch.prepare(frustum);
 }
 updateRubbleResidency(camera){
  if(!camera||!this.chunks.size)return;
  camera.updateMatrixWorld(true);
  const matrix=this.rubbleViewMatrix??=new THREE.Matrix4();
  const frustum=this.rubbleFrustum??=new THREE.Frustum();
  frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const now=performance.now();
  for(const effect of this.chunks.values()){
   if(!effect.staticRubble||!effect.worldBounds)continue;
   const visible=frustum.intersectsBox(effect.worldBounds);
   effect.root.visible=visible;
   if(visible){effect.lastVisibleAt=now;if(effect.gpuReleased)this.memoryManager?.recordWake('rubble');effect.gpuReleased=false;continue;}
   // Full original geometry remains in CPU memory; release only GPU buffers
   // of distant, off-camera static rubble. Three reuploads the identical
   // geometry automatically upon its next render. Never remove a ruin.
   if(!effect.gpuReleased&&now-effect.lastVisibleAt>30000&&effect.worldBounds.distanceToPoint(camera.position)>75){
    const retire=()=>{const geometries=new Set(),materials=new Set();
     effect.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});
     geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());effect.gpuReleased=true;
    };if(this.memoryManager)this.memoryManager.retire('rubble',retire);else retire();
   }
  }
 }
 dispose(){
  this.basisDisposed=true;this.basisIdleQueue.length=0;this.fixtureWarmQueue.length=0;
  if(this.basisIdleHandle!==null&&typeof cancelIdleCallback==='function')
   cancelIdleCallback(this.basisIdleHandle);
  this.basisIdleHandle=null;this.deformationBasis.clear();
  this.fireField?.dispose();this.splinters?.dispose();
  this.gpuPose?.texture.dispose();
  for(const job of this.preparingChunks.values())this.disposePreparedChunks(job);
  for(const effect of this.preparedChunks.values())this.disposePreparedChunks(effect);
  this.preparingChunks.clear();this.preparedChunks.clear();this.chunkBuildQueue=[];
  this.pendingEjections=[];this.pendingEjectionKeys?.clear();
  for(const effect of this.debris)this.removeDebris(effect);
  this.impactPlumes.dispose();
  for(const templates of this.scrapPrefabs.values())for(const template of templates)
   template.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}});
  this.scrapPrefabs.clear();
  for(const template of this.fixturePrefabs.values())
   template.traverse(o=>{o.geometry?.dispose();if(o.material)
    for(const mat of Array.isArray(o.material)?o.material:[o.material]){
     mat.map?.dispose();if(mat!==this.rubbleMaterial)mat.dispose();
    }});
  this.fixturePrefabs.clear();
  this.plumeResources.flame.dispose();this.plumeResources.smoke.dispose();this.facade.texture.dispose();
  this.root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}});
  this.rubbleMaterial?.dispose();this.cube.dispose();this.root.removeFromParent();
 }
}
