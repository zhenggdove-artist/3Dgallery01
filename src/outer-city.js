import * as THREE from 'three';
import {CITY_INNER_RADIUS,CITY_OUTER_RADIUS,CITY_SHOP_STYLES,CITY_LOTS,
 cityLots,cityStage,cityBlocked,cityRoofHeight,CITY_MAX_HP} from './shared/city-layout.js';
export {CITY_INNER_RADIUS,CITY_OUTER_RADIUS,CITY_SHOP_STYLES,cityLots} from './shared/city-layout.js';
import {buildDetachableFixture,buildBrokenStructure,installFacadeCracks,createPlumeResources,emitFireSmoke,updateFireSmoke,disposePlume} from './city-ruins-vfx.js';

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
function batchGeometry(lots,mobile){
 const position=[],normal=[],color=[],indices=[],lotRanges=new Map(),partRanges=new Map(),lotIds=[],localPoints=[];
 let category='core',current=-1;
 const face=(corners,n,col,lot,locals)=>{
  const at=position.length/3,c=rgb(col);
  for(let i=0;i<corners.length;i++){position.push(...corners[i]);normal.push(...n);color.push(...c);
   lotIds.push(lot.index??-1);localPoints.push(...(locals?.[i]||[0,0,0]));}
  indices.push(at,at+1,at+2,at,at+2,at+3);
 };
 const box=(lot,x,y,z,w,h,d,c)=>{
  if(w<=0||h<=0||d<=0)return;
  const at=position.length/3;
  const locals=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
   [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,k])=>[x+a*w/2,y+b*h/2,z+k*d/2]);
  const vertices=locals.map(([vx,vy,vz])=>{const q=localToWorld(lot,vx,vz);return [q[0],vy,q[1]];});
  const cs=Math.cos(lot.yaw),sn=Math.sin(lot.yaw);
  for(const [ids,n] of [[[4,5,6,7],[0,0,1]],[[1,0,3,2],[0,0,-1]],
   [[5,1,2,6],[1,0,0]],[[0,4,7,3],[-1,0,0]],[[7,6,2,3],[0,1,0]],[[0,1,5,4],[0,-1,0]]]){
    face(ids.map(i=>vertices[i]),[n[0]*cs+n[2]*sn,n[1],-n[0]*sn+n[2]*cs],c,lot,ids.map(i=>locals[i]));
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
  category='roof-clutter';
  for(let k=0;k<(mobile?2:5);k++){
   box(lot,(r()-.5)*w,h+.12+r()*.15,(r()-.5)*d,.18,.08,1+r()*3,scraps[(lot.index+k)%scraps.length]);
  }
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
 geo.setIndex(indices);geo.computeBoundingSphere();
 const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:.02,side:THREE.FrontSide}));
 mesh.name='Batched solid concrete, timber, red-brick, stone and ochre ruined homes';
 mesh.userData.lotRanges=lotRanges;mesh.userData.partRanges=partRanges;
 return mesh;
}
function signAtlas(lots){
 const columns=16,rows=Math.ceil(lots.length/columns),tile=128;
 const canvas=document.createElement('canvas');canvas.width=columns*tile;canvas.height=rows*tile;
 const g=canvas.getContext('2d');
 for(const lot of lots){
  const x=(lot.index%columns)*tile,y=Math.floor(lot.index/columns)*tile;
  g.fillStyle=lot.style[3];g.fillRect(x,y,tile,tile);
  g.fillStyle='#222425';g.globalAlpha=.58;g.fillRect(x+3,y+4,tile-6,tile-8);g.globalAlpha=1;
  g.textAlign='center';g.fillStyle='#f9ead2';g.font='bold 15px sans-serif';
  g.fillText(lot.shopName,x+tile/2,y+49,tile-10);
  g.font='bold 10px sans-serif';g.fillText(lot.enName,x+tile/2,y+75,tile-10);
  g.font='9px sans-serif';g.fillText('OPEN / 營業中',x+tile/2,y+94,tile-12);
 }
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=2;
 return {map,columns,rows};
}
function buildShopSigns(lots){
 const atlas=signAtlas(lots),p=[],uv=[],ids=[],ranges=new Map();
 for(const lot of lots){
  const base=p.length/3,y=2.96,z=lot.depth/2+.62,w=lot.width*.45;
  for(const [x,h] of [[-w,y-.39],[w,y-.39],[w,y+.39],[-w,y+.39]]){
   const pos=localToWorld(lot,x,z);p.push(pos[0],h,pos[1]);
  }
  const col=lot.index%atlas.columns,row=Math.floor(lot.index/atlas.columns),m=.008;
  const l=col/atlas.columns+m,r=(col+1)/atlas.columns-m;
  const t=1-(row+1)/atlas.rows+m,b=1-row/atlas.rows-m;
  uv.push(l,t,r,t,r,b,l,b);ids.push(base,base+1,base+2,base,base+2,base+3);
  ranges.set(lot.index,[base,p.length/3]);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ids);geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:atlas.map,side:THREE.DoubleSide}));
 mesh.name='Unique bilingual shop sign atlas';mesh.userData.lotRanges=ranges;return mesh;
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
 const p=[],uv=[],indices=[],ranges=new Map();
 for(const lot of lots){
  const base=p.length/3,idx=lot.index%16,c=idx%4,row=Math.floor(idx/4);
  const y=Math.min(lot.height-.8,3.7),z=lot.depth/2+.21,w=lot.width*.25;
  for(const [x,h] of [[-w,y-.43],[w,y-.43],[w,y+.43],[-w,y+.43]]){
   const v=localToWorld(lot,x,z);p.push(v[0],h,v[1]);
  }
  const m=.012,l=c/4+m,r=(c+1)/4-m,t=1-(row+1)/4+m,b=1-row/4-m;
  uv.push(l,t,r,t,r,b,l,b);indices.push(base,base+1,base+2,base,base+2,base+3);
  ranges.set(lot.index,[base,p.length/3]);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
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
export class OuterCity{
 constructor(scene,{mobile=false}={}){
  this.scene=scene;this.mobile=mobile;this.root=new THREE.Group();
  this.root.name='High-density ruined city, solid collision and staged destruction';scene.add(this.root);
  this.lots=CITY_LOTS;this.damage={};this.lastDamage=null;this.hidden=new Set();this.flashes=[];this.debris=[];this.chunks=new Map();this.plumes=[];
  this.plumeResources=createPlumeResources();this.partsHidden=new Set();
  this.cube=new THREE.BoxGeometry(1,1,1);
  // Outer district is covered by GrassField's continuous living grass canopy.
  this.walls=batchGeometry(this.lots,mobile);this.facade=installFacadeCracks(this.walls);
  this.signs=buildShopSigns(this.lots);this.graffiti=buildWallGraffiti(this.lots);
  for(const mesh of [this.walls,this.signs,this.graffiti])mesh.userData.originalPositions=mesh.geometry.attributes.position.array.slice();
  this.root.add(this.walls,this.signs,this.graffiti,wires(this.lots));
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
 hideRange(mesh,start,end){
  const attr=mesh.geometry.attributes.position;
  for(let i=start;i<end;i++)attr.array[i*3+1]=-120;
  attr.needsUpdate=true;
 }
 collapseLot(index){
  // Previous implementation sent every facade vertex to y=-120, including
  // shop signs, spray-painted plaster, windows and all material colours.
  // The replacement rubble was much plainer than the original house.
  // Compress the SAME geometry into a fractured low ruin instead; its paint,
  // trim, attachments and material-integrated crack shader survive impact.
  if(this.hidden.has(index))return;
  const lot=this.lots[index];if(!lot)return;
  this.hidden.add(index);
  const firstFloor=lot.height/lot.floors;
  const survivorHeight=firstFloor*(lot.floors===1?.32:.76);
  const ruinTop=cityRoofHeight(lot,3);
  const roofRanges=this.walls.userData.partRanges?.get(index+':sheets-roof')||[];
  for(const mesh of [this.walls,this.signs,this.graffiti]){
   const range=mesh.userData.lotRanges?.get(index);
   const originals=mesh.userData.originalPositions;
   if(!range||!originals)continue;
   const positions=mesh.geometry.attributes.position;
   for(let i=range[0];i<range[1];i++){
    const j=i*3,ox=originals[j],oy=originals[j+1],oz=originals[j+2];
    // Preserve any fixture already detached by a precise hit.
    if(positions.array[j+1]<-50)continue;
    if(oy<=survivorHeight)continue;
    const collapse=oy-survivorHeight;
    const noise=Math.sin(index*.73+ox*.81+oz*.59+oy*1.13);
    const compression=.08+.075*(.5+.5*noise);
    const factor=Math.min(1,collapse/Math.max(1,lot.height-survivorHeight));
    positions.array[j]=ox+Math.sin(oy*1.9+index*.9)*factor*.35;
    // The original corrugated roof becomes the walkable top of the ruin.
    // All its top vertices lie exactly at the shared physics roofHeight;
    // the rest of the original painted structure fractures underneath it.
    const isRoof=mesh===this.walls&&roofRanges.some(([a,b])=>i>=a&&i<b);
    positions.array[j+1]=isRoof?
      ruinTop+(oy-(lot.height+.13))*.16:
      survivorHeight+collapse*compression;
    positions.array[j+2]=oz+Math.cos(oy*1.5+index*.7)*factor*.35;
   }
   positions.needsUpdate=true;
  }
 }
 hidePart(index,part){
  const key=index+':'+part;
  this.partsHidden??=new Set();if(this.partsHidden.has(key))return;
  this.partsHidden.add(key);
  for(const [a,b] of this.walls.userData.partRanges?.get(key)||[])this.hideRange(this.walls,a,b);
  // Independent street signs and painted wall grime must survive the loss of
  // a corrugated awning or a small masonry component.
 }
 createChunks(lot,stage,animate=false){
  let effect=this.chunks.get(lot.index);
  if(effect){
   if(stage===3&&(effect.stage!==3||(animate&&!effect.animateStarted))){
    effect.stage=3;effect.animateStarted=true;
    for(const piece of effect.pieces){
     if(!piece.settled){/* preserve prior partial collapse */}
     else if(animate&&piece.wasInitiallySettled){
      // A world snapshot may arrive before this impact; reconstruct its
      // 3D pre-fall height so the final collapse remains visible on all clients.
      piece.mesh.position.copy(piece.home);
      piece.mesh.rotation.set(0,0,0);
     }
     piece.moving=true;piece.settled=false;piece.velocity.y+=1.4+piece.index*.13;
    }
   }else if(stage===2&&animate&&!effect.animateStarted){
    effect.animateStarted=true;
    for(const piece of effect.pieces.slice(2)){piece.moving=true;piece.settled=false;}
   }
   return;
  }
  const root=new THREE.Group();root.position.set(lot.x,0,lot.z);root.rotation.y=-lot.yaw;
  root.name='Solid volumetric collapse '+lot.id;
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
  const r=random(900+lot.index*73),pieces=[];
  descriptions.forEach(([x,y,z,w,h,d,c],index)=>{
   const mesh=buildBrokenStructure(lot,index,w,h,d,c);
   const home=new THREE.Vector3(x,y,z);
   mesh.position.copy(home);root.add(mesh);
   if(!animate&&stage===3){
    mesh.position.set(x+(r()-.5)*lot.width*.55,h*.22,z+(r()-.5)*lot.depth*.55);
    mesh.rotation.set((r()-.5)*.7,(r()-.5)*.3,(r()-.5)*.8);
   }
   pieces.push({mesh,index,home,velocity:new THREE.Vector3((r()-.5)*2,1+r()*2,(r()-.5)*2),
    spin:new THREE.Vector3((r()-.5)*1.5,0,(r()-.5)*1.5),
    h,moving:animate?(stage===3||index>2):false,settled:!animate,wasInitiallySettled:!animate});
  });
  this.root.add(root);this.chunks.set(lot.index,{root,pieces,stage,age:0,animateStarted:animate});
 }
 flash(lot){
  const material=new THREE.MeshBasicMaterial({color:'#f01422',transparent:true,opacity:.55,depthWrite:false,side:THREE.BackSide});
  const mesh=new THREE.Mesh(this.cube,material);mesh.position.set(lot.x,lot.height/2,lot.z);mesh.rotation.y=-lot.yaw;
  mesh.scale.set(lot.width+.1,lot.height+.1,lot.depth+.1);this.root.add(mesh);this.flashes.push({mesh,age:0});
 }
 eject(lot,part,point,detached=false){
  const r=random(lot.index*1259+Math.floor(performance.now())),root=new THREE.Group(),pieces=[];
  root.position.set(lot.x,0,lot.z);root.rotation.y=-lot.yaw;
  root.name='Real mounted windows, water pipes, steel awnings and chipped facade';
  const add=(mesh,speed=1)=>{
   root.add(mesh);pieces.push({mesh,velocity:new THREE.Vector3((r()-.5)*5*speed,2.5+r()*4*speed,(r()-.5)*5*speed),
    spin:new THREE.Vector3((r()-.5)*3,(r()-.5)*4,(r()-.5)*3)});
  };
  if(detached){
   // First unfasten the architectural fixture from its actual mounted position.
   add(buildDetachableFixture(lot,part,lot.index+Math.floor(performance.now())),1.15);
  }
  const local=point?this.toLocal(lot,point):[0,Math.min(2,lot.height*.5),lot.depth*.5];
  for(let i=0;i<(this.mobile?3:6);i++){
   const fragment=buildBrokenStructure(lot,18+i,.15+r()*.36,.2+r()*.45,.12+r()*.13,
    i%3===0?'#87979c':i%2?lot.trim:lot.detail);
   fragment.position.set(local[0]+(r()-.5)*.5,local[1]+(r()-.5)*.6,local[2]+(r()-.5)*.4);
   fragment.scale.setScalar(.38+r()*.35);add(fragment,.75);
  }
  this.root.add(root);this.debris.push({root,pieces,age:0});
  if(this.debris.length>35)this.removeDebris(this.debris.shift());
 }
 toLocal(lot,point){
  const dx=point[0]-lot.x,dz=point[2]-lot.z,c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
  return [dx*c-dz*s,point[1],dx*s+dz*c];
 }
 removeDebris(effect){
  effect.root.traverse(object=>{object.geometry?.dispose();if(object.material)
   for(const mat of Array.isArray(object.material)?object.material:[object.material])mat.dispose();});
  effect.root.removeFromParent();
 }
 applyDamageEvent(event){
  const lot=this.lots[event?.cityLotIndex];if(!lot)return;
  const stage=cityStage(event.hp,event.maxHp||CITY_MAX_HP);
  this.damage[lot.id]={hp:event.hp,stage};this.facade.set(lot.index,event.hp,event.maxHp||CITY_MAX_HP);
  this.flash(lot);this.eject(lot,event.part||'masonry',event.position,!!event.partDestroyed);
  const plume=emitFireSmoke(this.root,event.position||[lot.x,1.5,lot.z],
   this.plumeResources,this.mobile,lot.index+Math.floor(performance.now()));
  this.plumes.push(plume);if(this.plumes.length>22)disposePlume(this.plumes.shift());
  if(event.partDestroyed&&event.part!=='masonry')this.hidePart(lot.index,event.part);
  // Mid-health: keep the detailed original facade and grow shader-native
  // cracks; a second full-size overlapping shell looked like plain blocks.
  // Total destruction folds the old decorated mesh into rubble and adds
  // jagged physical fragments, never substitutes an undecorated cube.
  if(stage===3){this.collapseLot(lot.index);this.createChunks(lot,stage,true);}
 }
 syncDamage(damage={}){
  if(damage===this.lastDamage)return;
  if(!Object.keys(damage).length&&Object.keys(this.damage).length)this.resetBuildings();
  this.lastDamage=damage;
  for(const lot of this.lots){
   const record=damage[lot.id];if(!record)continue;
   const stage=cityStage(record.hp,record.maxHp||CITY_MAX_HP);
   this.damage[lot.id]={hp:record.hp,stage};this.facade.set(lot.index,record.hp,record.maxHp||CITY_MAX_HP);
   for(const [part,hp] of Object.entries(record.parts||{}))if(hp<=0&&part!=='masonry')this.hidePart(lot.index,part);
   if(stage===3){this.collapseLot(lot.index);this.createChunks(lot,stage,false);}
  }
 }
 resetBuildings(){
  this.damage={};this.lastDamage=null;this.hidden.clear();this.partsHidden.clear();this.facade.reset();
  for(const mesh of [this.walls,this.signs,this.graffiti]){
   const attr=mesh.geometry.attributes.position,original=mesh.userData.originalPositions;
   if(original){attr.array.set(original);attr.needsUpdate=true;}
  }
  for(const effect of this.chunks.values()){
   effect.root.traverse(obj=>{obj.geometry?.dispose();if(obj.material)
    for(const mat of Array.isArray(obj.material)?obj.material:[obj.material])mat.dispose();});
   effect.root.removeFromParent();
  }
  this.chunks.clear();
  for(const effect of this.debris)this.removeDebris(effect);this.debris=[];
  for(const effect of this.plumes)disposePlume(effect);this.plumes=[];
  for(const effect of this.flashes){effect.mesh.material.dispose();effect.mesh.removeFromParent();}
  this.flashes=[];
 }
 blocked(x,z,y=0){return cityBlocked(x,z,y,this.damage);}
 update(time,dt=1/60){
  const tmp=new THREE.Object3D();
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
  for(let i=this.flashes.length-1;i>=0;i--){
   const effect=this.flashes[i];effect.age+=dt;effect.mesh.material.opacity=.5*Math.max(0,1-effect.age/.35);
   if(effect.age>.35){effect.mesh.material.dispose();effect.mesh.removeFromParent();this.flashes.splice(i,1);}
  }
  for(let i=this.plumes.length-1;i>=0;i--)if(updateFireSmoke(this.plumes[i],dt)){
   disposePlume(this.plumes[i]);this.plumes.splice(i,1);
  }
  for(let i=this.debris.length-1;i>=0;i--){
   const effect=this.debris[i];effect.age+=dt;
   for(const piece of effect.pieces){
    piece.velocity.y-=14*dt;piece.mesh.position.addScaledVector(piece.velocity,dt);
    piece.mesh.rotation.x+=piece.spin.x*dt;piece.mesh.rotation.y+=piece.spin.y*dt;piece.mesh.rotation.z+=piece.spin.z*dt;
    if(effect.root.position.y+piece.mesh.position.y<.14){
     piece.mesh.position.y=.14-effect.root.position.y;piece.velocity.y=Math.abs(piece.velocity.y)*.22;
     piece.velocity.x*=.65;piece.velocity.z*=.65;
    }
   }
   if(effect.age>3.5){this.removeDebris(effect);this.debris.splice(i,1);}
  }
  for(const effect of this.chunks.values()){
   effect.age+=dt;
   for(const part of effect.pieces){
    if(!part.moving||part.settled)continue;
    part.velocity.y-=11*dt;
    part.mesh.position.addScaledVector(part.velocity,dt);
    part.mesh.rotation.x+=part.spin.x*dt;part.mesh.rotation.z+=part.spin.z*dt;
    const floor=part.h*.22;
    if(part.mesh.position.y<floor){
     part.mesh.position.y=floor;part.velocity.y=Math.abs(part.velocity.y)*.17;
     part.velocity.x*=.66;part.velocity.z*=.66;
     if(Math.abs(part.velocity.y)<.45)part.settled=true;
    }
   }
  }
 }
 dispose(){
  for(const effect of this.debris)this.removeDebris(effect);
  for(const effect of this.plumes)disposePlume(effect);
  this.plumeResources.flame.dispose();this.plumeResources.smoke.dispose();this.facade.texture.dispose();
  this.root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}});
  this.cube.dispose();this.root.removeFromParent();
 }
}
