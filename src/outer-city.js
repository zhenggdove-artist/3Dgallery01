import * as THREE from 'three';
import {ARENA_RADIUS} from './shared/arena.js';

// Deterministic, entirely JS-built environment: no GLB downloads or one-mesh-per-plank draw calls.
export const CITY_INNER_RADIUS=ARENA_RADIUS/2;
export const CITY_OUTER_RADIUS=ARENA_RADIUS;
export const CITY_SHOP_STYLES=Object.freeze([
 ['noodle','阿明古早味麵店','AH MING NOODLES','#c84730'],
 ['repair','老吳機車修配','WU MOTOR REPAIR','#d69a32'],
 ['laundry','藍月自助洗衣','BLUE MOON LAUNDRY','#4c9ea1'],
 ['fish','海角鮮魚市場','CAPE FISH MARKET','#328e9d'],
 ['electronics','閃電電器維修','SPARK ELECTRONICS','#a05aab'],
 ['pharmacy','仁心藥房','REN XIN PHARMACY','#439a6e'],
 ['tea','三輪珍珠奶茶','TRICYCLE TEA','#dc8f5b'],
 ['barber','阿鴻理髮廳','HONG BARBER SHOP','#d15264'],
 ['hardware','鐵拳五金百貨','IRON FIST HARDWARE','#a8a055'],
 ['tailor','桂香裁縫工作室','GUI XIANG TAILOR','#b56286'],
 ['pawn','金福當舖','GOLDEN PAWN','#b5a451'],
 ['grocery','南星雜貨店','SOUTH STAR MART','#5d9d69'],
 ['internet','夜貓子網咖','NIGHT OWL INTERNET','#556bc9'],
 ['clinic','和平牙科','PEACE DENTAL','#6599bd'],
 ['streetfood','火車頭烤肉','LOCO GRILL','#c87945'],
 ['flower','野草花店','WILD FLOWER SHOP','#668d53'],
 ['printing','黑墨影印店','BLACK INK PRINT','#777ca0'],
 ['fortune','天后求籤館','HEAVEN FORTUNE','#b04c4a'],
 ['tattoo','地下刺青','UNDERGROUND TATTOO','#875997'],
 ['rice','金穗米行','GOLDEN GRAIN RICE','#b3a568'],
 ['shoes','一步鞋行','ONE STEP SHOES','#a6795b'],
 ['shipping','長風快遞站','LONG WIND PARCEL','#4d8997'],
 ['fruit','黃昏水果攤','DUSK FRUIT','#9c994b'],
 ['motel','檳榔街旅社','BETEL STREET INN','#9a5e75']
]);

function seeded(seed=912744){let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const palette=['#8a867b','#a49a89','#aaa9a0','#827c73','#9e8e80','#898d87','#c2b29a','#777873','#b0a597'];
const corrugate=['#6d7475','#9f8e76','#b2a499','#a56854','#687676','#b6b3a6'];
const dark='#252a2c',mud='#605c53',rust='#a16447';
const rgb=color=>{const c=new THREE.Color(color);return [c.r,c.g,c.b];};

// World-space OBBs preserve irregular alleys rather than making an invisible circular wall.
export function cityLots(seed=912744,limit=72){
 const rand=seeded(seed),lots=[];const ringCounts=[20,24,28],ringRadii=[107,133,162];
 for(let band=0;band<ringCounts.length;band++)for(let n=0;n<ringCounts[band];n++){
  const index=lots.length,number=ringCounts[band];
  const angle=(n+(band%2)*.48+(rand()-.5)*.37)*2*Math.PI/number;
  const radius=ringRadii[band]+(rand()-.5)*10;
  const width=5.6+rand()*5.2,depth=5.8+rand()*4.6;
  const floors=1+Math.floor(rand()*3),height=floors*(2.5+rand()*.6)+1.6;
  const style=CITY_SHOP_STYLES[(index*5+band*3)%CITY_SHOP_STYLES.length];
  const yaw=-Math.PI/2-angle+(rand()-.5)*.35;
  lots.push({index,band,angle,x:Math.cos(angle)*radius,z:Math.sin(angle)*radius,yaw,
   width,depth,height,floors,style,shopName:style[1]+'・'+String(index+1).padStart(2,'0')+'號',
   enName:style[2]+' / '+String(index+1).padStart(2,'0'),color:palette[Math.floor(rand()*palette.length)],
   roof:corrugate[Math.floor(rand()*corrugate.length)]});
 }
 return limit>=lots.length?lots:lots.filter(lot=>lot.index%3!==0).slice(0,limit);
}
function localToWorld(lot,x,z){
 return [lot.x+Math.cos(lot.yaw)*x+Math.sin(lot.yaw)*z,lot.z-Math.sin(lot.yaw)*x+Math.cos(lot.yaw)*z];
}
function paintConcrete(rand){
 const c=document.createElement('canvas');c.width=c.height=1024;
 const ctx=c.getContext('2d');ctx.fillStyle='#77746c';ctx.fillRect(0,0,1024,1024);
 for(let i=0;i<3600;i++){const x=rand()*1024,y=rand()*1024,w=1+rand()*78,h=1+rand()*18;
  ctx.globalAlpha=.05+rand()*.15;ctx.fillStyle=i%3?'#282e2e':'#d2c7a6';ctx.fillRect(x,y,w,h);}
 ctx.globalAlpha=1;
 for(let i=0;i<240;i++){let x=rand()*1024,y=rand()*1024;ctx.beginPath();ctx.moveTo(x,y);
  for(let j=0;j<3+rand()*10;j++){x+=(rand()-.5)*28;y+=(rand()-.5)*24;ctx.lineTo(x,y);}
  ctx.strokeStyle=i%3===0?'#a6a49b':'#484b47';ctx.lineWidth=.5+rand()*2;ctx.globalAlpha=.2+rand()*.32;ctx.stroke();}
 ctx.globalAlpha=1;const glyphs=['廢','拆','NO FUTURE','POST NO BILLS','觀光勝地','NOT FOR SALE','404','尋人','新世界','KEEP OUT'];
 for(let i=0;i<110;i++){ctx.save();ctx.translate(rand()*1024,rand()*1024);ctx.rotate((rand()-.5)*2.4);
  ctx.font='bold '+(12+rand()*31)+'px sans-serif';ctx.fillStyle=['#34282d','#c65e59','#c9c0a4','#3c6d74'][i%4];ctx.globalAlpha=.18+rand()*.35;ctx.fillText(glyphs[i%glyphs.length],0,0);ctx.restore();}
 return new THREE.CanvasTexture(c);
}
function signAtlas(lots){
 const columns=8,rows=Math.ceil((Math.max(...lots.map(l=>l.index))+1)/columns),tile=256;
 const c=document.createElement('canvas');c.width=columns*tile;c.height=rows*tile;
 const ctx=c.getContext('2d');const rand=seeded(2011);
 for(const lot of lots){const col=lot.index%columns,row=Math.floor(lot.index/columns),x=col*tile,y=row*tile;
  ctx.fillStyle=lot.style[3];ctx.fillRect(x,y,tile,tile);
  ctx.fillStyle='rgba(10,17,19,.45)';ctx.fillRect(x+7,y+7,tile-14,tile-14);
  ctx.strokeStyle='#d3ccae';ctx.lineWidth=4;ctx.strokeRect(x+12,y+12,tile-24,tile-24);
  for(let j=0;j<5;j++){ctx.fillStyle='rgba(255,255,255,.13)';ctx.fillRect(x+rand()*tile,y+rand()*tile,4+rand()*50,1+rand()*4);}
  ctx.fillStyle='#f6e7c3';ctx.textAlign='center';ctx.font='bold 33px sans-serif';
  ctx.fillText(lot.shopName,x+tile/2,y+tile*.44,tile-22);
  ctx.fillStyle='#f5d7a9';ctx.font='bold 17px Arial, sans-serif';
  ctx.fillText(lot.enName,x+tile/2,y+tile*.64,tile-22);
  ctx.font='13px sans-serif';ctx.fillText('OPEN / 營業中',x+tile/2,y+tile*.77,tile-25);
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
 return {texture:t,columns,rows};
}
function buildStaticCity(lots){
 const vertices=[],normals=[],colors=[],uvs=[],indices=[];
 const face=(points,n,color)=>{
  const at=vertices.length/3,col=rgb(color);
  for(const p of points){vertices.push(...p);normals.push(...n);colors.push(...col);uvs.push(0,0);}
  indices.push(at,at+1,at+2,at,at+2,at+3);
 };
 const box=(lot,x,y,z,w,h,d,color)=>{
  if(w<=0||h<=0||d<=0)return;
  const pts=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const world=pts.map(([a,b,c])=>{
   const [wx,wz]=localToWorld(lot,x+a*w/2,z+c*d/2);return [wx,y+b*h/2,wz];
  });
  const rotate=n=>[n[0]*Math.cos(lot.yaw)+n[2]*Math.sin(lot.y),n[1],-n[0]*Math.sin(lot.y)+n[2]*Math.cos(lot.y)];
  for(const [ids,n] of [[[4,5,6,7],[0,0,1]],[[1,0,3,2],[0,0,-1]],[[5,1,2,6],[1,0,0]],[[0,4,7,3],[-1,0,0]],[[7,6,2,3],[0,1,0]],[[0,1,5,4],[0,-1,0]]])
   face(ids.map(i=>world[i]),rotate(n),color);
 };
 const rand=seeded(9383);
 for(const lot of lots){
  const {width:w,depth:d,height:h,floors,style}=lot,trim=style[3],front=d/2;
  // Stacked, offset concrete cells, chipped plaster, balconies, exposed beams.
  box(lot,0,h/2,0,w,h,d,lot.color);
  box(lot,0,.22,0,w+.45,.44,d+.45,mud);
  box(lot,-w*.46,h*.5,0,.22,h,.24,'#484742');
  box(lot,w*.44,h*.5,0,.28,h,.23,'#575550');
  for(let fl=1;fl<floors;fl++){
   const y=fl*2.6,offset=(rand()-.5)*.7;
   box(lot,offset,y,front+.31,w+.9,.21,.7,'#58534d');
   box(lot,offset,y+.83,front+.33,w*.83,1.45,.11,'#555c5a');
   for(let k=0;k<3;k++){const cx=(k-1)*w*.26+offset;
    box(lot,cx,y+.9,front+.46,w*.17,.82,.09,'#171e24');
    // Half-missing glass, rusty grilles, crooked crossbars.
    if(k%2===0)box(lot,cx-w*.027,y+1.12,front+.53,w*.08,.08,.02,'#8ea3a2');
    box(lot,cx,y+.88,front+.56,w*.19,.06,.06,'#765d4f');
    box(lot,cx-w*.075,y+.87,front+.57,.04,.72,.05,'#b0a395');
    box(lot,cx+w*.07,y+.84,front+.56,.035,.8,.05,'#766156');
   }
  }
  // A legible street-front shop with a different front geometry per retail category.
  box(lot,0,1.27,front+.11,w*.88,2.15,.16,'#333533');
  box(lot,-w*.27,1.34,front+.25,w*.3,1.75,.11,'#131e22');
  box(lot,w*.19,1.18,front+.3,w*.4,1.4,.09,'#273b3c');
  for(let k=0;k<6;k++)box(lot,-w*.3+k*w*.12,1.35,front+.33,.04,1.66,.05,'#7f7c6c');
  // Per-shop paint, shopfront lintel, sagging multicolour awnings.
  box(lot,0,2.65,front+.52,w*1.04,.14,1.3,trim);
  for(let k=0;k<9;k++)box(lot,-w*.49+k*w*.12,2.55,front+1.03,w*.115,.11,.2,k%2?'#c4b9a2':trim);
  for(let k=0;k<4;k++){
   const y=h-1.0+k*.18;
   box(lot,0,y,0,w+1+k*.09,.045,d+.75,corrugate[(lot.index+k)%corrugate.length]);
  }
  // Individual strips: corrugated, damaged metal piled in conflicting directions.
  for(let k=0;k<10;k++){
   const rx=(rand()-.5)*w*1.2,rz=(rand()-.5)*d,ry=h+.08+rand()*.25;
   box(lot,rx,ry,rz,.12+rand()*.15,.055,1.2+rand()*3,corrugate[(lot.index+k)%corrugate.length]);
  }
  for(let k=0;k<3;k++){
   const x=(rand()-.5)*w*.75,zz=(rand()-.5)*d*.6;
   box(lot,x,h+.38,zz,1.1+rand()*.8,.55+rand()*.55,.7+rand()*.8,'#5d625d');
   box(lot,x,h+.85,zz,.15,.3,.15,'#343a39');
  }
  // Rust streaks, torn patch panels, exposed unfinished wiring.
  for(let k=0;k<9;k++){
   const x=(rand()-.5)*w*.92,yy=2.9+rand()*(h-3.2);
   box(lot,x,yy,front+.015,.07+rand()*.2,.25+rand()*.8,.035,k%2?rust:'#525b57');
  }
  const left=-w*.55,right=w*.57;
  box(lot,left,1.0,front+1.0,.16,2,.17,'#7e7664');
  box(lot,right,1.5,front+.8,.17,2.8,.19,'#746658');
  // Stage-specific recognizable inventory, different silhouettes.
  switch(style[0]){
   case 'noodle':case 'streetfood':
    for(let i=0;i<3;i++){box(lot,-w*.25+i*.95,.56,front+1.6,.86,.95,.7,'#655b50');box(lot,-w*.25+i*.95,1.08,front+1.6,.69,.15,.55,'#c3aaa0');}break;
   case 'repair':case 'hardware':case 'shoes':
    for(let i=0;i<4;i++){box(lot,-w*.3+i*.86,.55,front+1.35,.68,.8,.55,i%2?'#272929':'#786449');box(lot,-w*.3+i*.86,.95,front+1.65,.5,.12,.2,'#a48e72');}break;
   case 'laundry':
    for(let i=0;i<3;i++){box(lot,-w*.3+i*1.25,.83,front+1.4,1.08,1.55,.82,'#e2ddd2');box(lot,-w*.3+i*1.25,1.0,front+1.85,.75,.74,.04,'#35414a');}break;
   case 'fish':case 'fruit':case 'grocery':case 'flower':case 'rice':
    for(let i=0;i<4;i++){box(lot,-w*.35+i*.92,.44,front+1.3,.8,.7,.82,'#8c6851');box(lot,-w*.35+i*.92,.83,front+1.3,.64,.16,.62,i%2?'#8d964e':'#4d8771');}break;
   case 'pharmacy':case 'clinic':
    box(lot,w*.2,3.85,front+.42,1.65,.35,.17,'#e2e8d8');box(lot,w*.2,3.85,front+.48,.35,1.65,.17,'#d9ede5');break;
   case 'electronics':case 'internet':case 'printing':
    for(let i=0;i<3;i++){box(lot,-w*.33+i*1.16,.65,front+1.34,1.0,.8,.85,'#252e34');box(lot,-w*.33+i*1.16,.75,front+1.79,.74,.48,.06,'#6da6bb');}break;
   case 'barber':case 'tailor':
    for(let i=0;i<5;i++)box(lot,-w*.38+i*.74,.63,front+1.1,.32,1.25,.24,corrugate[(lot.index+i)%6]);break;
   case 'pawn':
    for(let i=0;i<6;i++)box(lot,-w*.37+i*.6,1.35,front+.51,.065,2.1,.09,'#b49d62');break;
   case 'tea':
    for(let i=0;i<5;i++)box(lot,-w*.33+i*.68,.76,front+1.3,.36,.87,.4,i%2?'#d8a47d':'#ae6d58');break;
   case 'tattoo':case 'fortune':
    for(let i=0;i<5;i++)box(lot,-w*.35+i*.83,1.0,front+1.0,.53,1.56,.05,i%2?'#b55950':'#6f515a');break;
   case 'shipping':case 'motel':
    for(let i=0;i<4;i++)box(lot,-w*.3+i*.95,.6,front+1.2,.75,.8,.58,'#a78b6b');break;
  }
 }
 // Visibly tilted, broken power poles; cables are drawn by a separate shared line batch.
 for(let i=0;i<16;i++){
  const a=(i+.23)*Math.PI*2/16,r=100+(i%4)*20,tilt=(i%2?1:-1)*(.8+(i%5)*.25);
  const pole={x:Math.cos(a)*r,z:Math.sin(a)*r,yaw:-a};
  for(let j=0;j<9;j++){const t=j/9;box(pole,tilt*t*t,5.3*t,0,.26-t*.08,1.28,.3,'#65625b');}
  box(pole,tilt*.9,9.5/2,0,.16,1.3,.16,'#544b43');
  box(pole,tilt*.86,8.3,.04,2.6,.16,.17,'#463d39');
  for(let n=0;n<3;n++)box(pole,tilt*.86+(n-1)*.87,8.5,0,.19,.36,.25,'#9b8d72');
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);
 geometry.computeBoundingSphere();
 return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:.035,side:THREE.DoubleSide}));
}
function buildShopSigns(lots){
 const atlas=signAtlas(lots),p=[],u=[],ind=[];
 for(const lot of lots){
  const {width:w,depth:d}=lot,y=2.95,z=d/2+.53;
  const corners=[[-w*.43,y-.37,z],[w*.43,y-.37,z],[w*.43,y+.37,z],[-w*.43,y+.37,z]];
  const at=p.length/3;for(const [x,h,zz] of corners){const [wx,wz]=localToWorld(lot,x,zz);p.push(wx,h,wz);}
  const col=lot.index%atlas.columns,row=Math.floor(lot.index/atlas.columns);
  const eps=.005,ul=col/atlas.columns+eps,ur=(col+1)/atlas.columns-eps,vt=1-(row+1)/atlas.rows+eps,vb=1-row/atlas.rows-eps;
  u.push(ul,vt,ur,vt,ur,vb,ul,vb);ind.push(at,at+1,at+2,at,at+2,at+3);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setIndex(ind);g.computeVertexNormals();
 const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:atlas.texture,side:THREE.DoubleSide}));
 mesh.name='Unique bilingual shop sign atlas';return mesh;
}
function buildStreetLines(lots){
 const rand=seeded(419),p=[];
 const line=(a,b)=>p.push(...a,...b);
 for(let k=0;k<12;k++){
  const a=(k/12)*2*Math.PI,base=102+rand()*75,x=Math.cos(a)*base,z=Math.sin(a)*base;
  const leaning=[x+(rand()-.5)*2.4,7+rand()*3,z+(rand()-.5)*2.2];
  line([x,0,z],leaning);line(leaning,[leaning[0]+(rand()-.5)*2,leaning[1]+.4,leaning[2]+(rand()-.5)]);
  for(let n=0;n<3;n++){const angle=a+(n+1)*.08,r=base+8+n*7;line(leaning,[Math.cos(angle)*r,3.2+rand()*2,Math.sin(angle)*r]);}
 }
 // Across mismatched upper storeys, sloppy dangling electric cable catenaries.
 for(let i=0;i<lots.length;i+=2){
  const a=lots[i],b=lots[(i+1)%lots.length];
  if(a.band!==b.band)continue;
  const from=[a.x,a.height*.89,a.z],to=[b.x,b.height*.84,b.z];
  let prev=from;
  for(let j=1;j<=8;j++){const t=j/8,pnt=[from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t-1.75*Math.sin(t*Math.PI),from[2]+(to[2]-from[2])*t];line(prev,pnt);prev=pnt;}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 return new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#282725',transparent:true,opacity:.92}));
}
function instance(geometry,material,count,name){const m=new THREE.InstancedMesh(geometry,material,count);m.name=name;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;return m;}
function scatterItems(scene,rand,near,geometry,material,count,name,make){
 const m=instance(geometry,material,count,name),tmp=new THREE.Object3D();
 for(let i=0;i<count;i++){const d=make(i);tmp.position.set(d[0],d[1],d[2]);tmp.rotation.set(0,rand()*Math.PI*2,0);tmp.scale.setScalar(.8+rand()*.7);tmp.updateMatrix();m.setMatrixAt(i,tmp.matrix);}
 m.instanceMatrix.needsUpdate=true;scene.add(m);return m;
}
export class OuterCity{
 constructor(scene,{mobile=false}={}){
  this.scene=scene;this.mobile=mobile;this.root=new THREE.Group();this.root.name='JS drawn sprawling ruined Southeast Asian neighbourhood';scene.add(this.root);
  const rand=seeded(817713),lots=cityLots(912744,mobile?48:72);
  this.lots=lots;
  const ground=new THREE.Mesh(new THREE.RingGeometry(CITY_INNER_RADIUS,CITY_OUTER_RADIUS,160),new THREE.MeshStandardMaterial({map:paintConcrete(rand),roughness:1,side:THREE.DoubleSide}));
  ground.rotation.x=-Math.PI/2;ground.position.y=.01;ground.name='Graffiti cracked cement streets beyond grass';this.root.add(ground);
  const walls=buildStaticCity(lots);walls.name='Batched damaged concrete homes, shops, roofs and storefront goods';this.root.add(walls,buildShopSigns(lots),buildStreetLines(lots));
  // Dumpsters and garbage bags: instanced geometry shared across the district.
  const dumpCount=mobile?9:15,bin=instance(new THREE.CylinderGeometry(.52,.48,1.1,8),new THREE.MeshStandardMaterial({color:'#4b615a',roughness:.94}),dumpCount,'Open foul dumpsters'),lid=instance(new THREE.CylinderGeometry(.58,.55,.09,8),new THREE.MeshStandardMaterial({color:'#232f2a',roughness:.96}),dumpCount,'Bent dumpster rims');
  const bagCount=mobile?36:95,bags=instance(new THREE.IcosahedronGeometry(.27,0),new THREE.MeshStandardMaterial({color:'#202426',roughness:1}),bagCount,'Scattered black rubbish bags');this.bags=bags;this.bagRecords=[];
  const tmp=new THREE.Object3D(),bins=[];
  for(let i=0;i<dumpCount;i++){
   const lot=lots[(i*5)%lots.length],angle=lot.angle,radial=Math.hypot(lot.x,lot.z)-6;
   const x=Math.cos(angle)*radial,z=Math.sin(angle)*radial;bins.push([x,z]);
   tmp.position.set(x,.57,z);tmp.rotation.set(0,i*.38,.05);tmp.scale.setScalar(1);tmp.updateMatrix();bin.setMatrixAt(i,tmp.matrix);
   tmp.position.y=1.12;tmp.rotation.z=.22*Math.sin(i*1.3);tmp.updateMatrix();lid.setMatrixAt(i,tmp.matrix);
  }
  bin.instanceMatrix.needsUpdate=lid.instanceMatrix.needsUpdate=true;this.root.add(bin,lid);
  for(let i=0;i<bagCount;i++){const pos=bins[i%bins.length],theta=rand()*Math.PI*2,r=.55+rand()*3.5;
   const x=pos[0]+Math.cos(theta)*r,z=pos[1]+Math.sin(theta)*r,phase=rand()*20,size=.6+rand()*.7;
   this.bagRecords.push({x,z,phase,size,loose:i%4===0});
   tmp.position.set(x,.25,z);tmp.rotation.set(phase,rand()*6,phase*.3);tmp.scale.set(size,.8*size,size*.9);tmp.updateMatrix();bags.setMatrixAt(i,tmp.matrix);}
  bags.instanceMatrix.needsUpdate=true;this.root.add(bags);
  // Billboard and leaflet litter drift independently, updated with one instanced draw.
  this.litterCount=mobile?34:90;this.litter=instance(new THREE.PlaneGeometry(.39,.26),new THREE.MeshBasicMaterial({color:'#d7cbb3',side:THREE.DoubleSide}),this.litterCount,'Windblown tissue paper, leaflets and plastic');
  this.litterRecords=[];
  for(let i=0;i<this.litterCount;i++){const angle=rand()*Math.PI*2,r=94+rand()*83;
   this.litterRecords.push({x:Math.cos(angle)*r,z:Math.sin(angle)*r,seed:rand()*100,phase:rand()*10,size:.55+rand()*1.6});
   this.litter.setColorAt(i,new THREE.Color(['#f7f2e1','#f6e7a6','#c9d9db','#ccb7b2'][i%4]));
  }
  this.root.add(this.litter);
  // Mice and tails are one instance batch each; flies use an animated GPU point shader.
  this.ratCount=mobile?9:18;
  this.rats=instance(new THREE.SphereGeometry(.18,7,5),new THREE.MeshStandardMaterial({color:'#48413e',roughness:1}),this.ratCount,'Small alley rats');
  this.tails=instance(new THREE.CylinderGeometry(.022,.012,.5,4),new THREE.MeshStandardMaterial({color:'#866c62',roughness:1}),this.ratCount,'Moving rat tails');
  this.ratRecords=[];
  for(let i=0;i<this.ratCount;i++){const angle=rand()*Math.PI*2,r=99+rand()*73;this.ratRecords.push({x:Math.cos(angle)*r,z:Math.sin(angle)*r,a:angle,phase:rand()*10,speed:.4+rand()*.9});}
  this.root.add(this.rats,this.tails);
  const count=mobile?36:120,flyPositions=new Float32Array(count*3),flySeeds=new Float32Array(count);
  for(let i=0;i<count;i++){const base=bins[i%bins.length];flyPositions.set([base[0],1.3,base[1]],i*3);flySeeds[i]=rand()*100;}
  const flyGeo=new THREE.BufferGeometry();flyGeo.setAttribute('position',new THREE.BufferAttribute(flyPositions,3));flyGeo.setAttribute('aSeed',new THREE.BufferAttribute(flySeeds,1));
  const flyMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0}},
   vertexShader:'attribute float aSeed;uniform float time;void main(){vec3 p=position;p.x+=sin(time*8.+aSeed)*(.25+mod(aSeed,.5));p.z+=cos(time*7.+aSeed*2.)*.35;p.y+=sin(time*10.+aSeed*4.)*.38;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=2.4;}',
   fragmentShader:'void main(){vec2 q=gl_PointCoord-.5;if(dot(q,q)>.22)discard;gl_FragColor=vec4(.06,.055,.045,.9);}'});
  this.flies=new THREE.Points(flyGeo,flyMat);this.flies.frustumCulled=false;this.flies.name='Buzzing dumpster flies';this.root.add(this.flies);
  this.update(0);
 }
 blocked(x,z,y=0){
  if(y>15)return false;
  for(const lot of this.lots){
   if((x-lot.x)**2+(z-lot.z)**2>180)continue;
   const dx=x-lot.x,dz=z-lot.z;
   const lx=dx*Math.cos(lot.yaw)-dz*Math.sin(lot.y),lz=dx*Math.sin(lot.y)+dz*Math.cos(lot.y);
   if(Math.abs(lx)<lot.width*.5+.21&&Math.abs(lz)<lot.depth*.5+.18&&y<lot.height)return true;
  }
  return false;
 }
 update(time){
  const tmp=new THREE.Object3D(),move=time;
  for(let i=0;i<this.bagRecords.length;i++){
   const a=this.bagRecords[i],drift=a.loose?Math.sin(move*.75+a.phase)*1.1:0;
   tmp.position.set(a.x+drift,.22+(a.loose?.3*Math.abs(Math.sin(move*1.15+a.phase)):0),a.z+(a.loose?Math.cos(move*.5+a.phase)*.75:0));
   tmp.rotation.set(.2*Math.sin(move*.6+a.phase),a.phase+(a.loose?move*.28:0),a.loose?Math.sin(move+a.phase)*.6:0);
   tmp.scale.set(a.size,.8*a.size,a.size*.9);tmp.updateMatrix();this.bags.setMatrixAt(i,tmp.matrix);
  }
  this.bags.instanceMatrix.needsUpdate=true;
  for(let i=0;i<this.litterRecords.length;i++){
   const a=this.litterRecords[i],wind=.55*Math.sin(move*.76+a.seed),side=.65*Math.cos(move*.48+a.phase);
   tmp.position.set(a.x+wind,.055+Math.abs(Math.sin(move*1.3+a.phase))*.62,a.z+side);
   tmp.rotation.set(Math.sin(move*1.8+a.phase)*.8,move*.42+a.seed,Math.sin(move*.9+a.seed)*.7);
   tmp.scale.setScalar(a.size);tmp.updateMatrix();this.litter.setMatrixAt(i,tmp.matrix);
  }
  this.litter.instanceMatrix.needsUpdate=true;
  for(let i=0;i<this.ratRecords.length;i++){
   const m=this.ratRecords[i],direction=m.a+Math.sin(move*.4+m.phase)*1.6,t=move*m.speed+m.phase;
   const x=m.x+Math.sin(t)*1.25,z=m.z+Math.cos(t*.83)*1.12;
   tmp.position.set(x,.24+Math.sin(t*7)*.035,z);
   tmp.rotation.set(0,direction,0);tmp.scale.set(1.12,.65,1.6);tmp.updateMatrix();this.rats.setMatrixAt(i,tmp.matrix);
   tmp.position.set(x-Math.sin(direction)*.35,.2,z-Math.cos(direction)*.35);tmp.rotation.set(.82,direction,0);tmp.scale.setScalar(1);tmp.updateMatrix();this.tails.setMatrixAt(i,tmp.matrix);
  }
  this.rats.instanceMatrix.needsUpdate=this.tails.instanceMatrix.needsUpdate=true;this.flies.material.uniforms.time.value=time;
 }
 dispose(){this.root.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});this.root.removeFromParent();}
}
