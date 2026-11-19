import * as THREE from 'three';

// Five identifiable, detailed fragment types in FIVE InstancedMesh draw calls.
// Adding twenty flying parts to a building hit never constructs geometry,
// creates a material, or increases the number of WebGL draw calls.
const TYPES=['window','sheet','timber','stone','sign'];
function geometryFor(type){
 const positions=[],normals=[],colors=[],indices=[];
 const emit=(pts,col)=>{
  const start=positions.length/3,color=new THREE.Color(col);
  const a=new THREE.Vector3(...pts[0]),b=new THREE.Vector3(...pts[1]),c=new THREE.Vector3(...pts[2]);
  const n=b.sub(a).cross(c.sub(a)).normalize();
  for(const p of pts){positions.push(...p);normals.push(n.x,n.y,n.z);colors.push(color.r,color.g,color.b);}
  indices.push(start,start+1,start+2,start,start+2,start+3);
 };
 const box=(x,y,z,w,h,d,col)=>{
  const x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-d/2,z1=z+d/2;
  emit([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],col);
  emit([[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]],col);
  emit([[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]],col);
  emit([[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]],col);
  emit([[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]],col);
  emit([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],col);
 };
 const prism=(w,h,d,col)=>{
  const x=w*.5,y=h*.5;
  emit([[-x,-y,d],[x*.68,-y,d],[x,y*.6,d],[-x*.7,y,d]],col);
  emit([[-x,-y,d],[-x*.7,y,d],[-x*.55,y*.72,-d],[-x*.7,-y*.63,-d]],'#453b34');
  emit([[x*.68,-y,d],[x*.67,-y*.66,-d],[x*.6,y*.5,-d],[x,y*.6,d]],'#74685d');
 };
 if(type==='window'){
  box(0,0,0,.83,.85,.065,'#77817f');
  box(-.43,0,.055,.09,.96,.11,'#252e31');
  box(.43,0,.055,.09,.96,.11,'#252e31');
  box(0,.46,.055,.9,.08,.11,'#505d5e');
  box(0,-.46,.055,.9,.08,.11,'#3d4543');
  box(0,0,.09,.06,.9,.11,'#333838');
  box(0,.07,.09,.88,.05,.11,'#505858');
  box(-.23,.24,.105,.35,.27,.025,'#829c9f');
  box(.23,-.23,.105,.35,.28,.022,'#516a70');
  box(.22,.27,.13,.20,.015,.012,'#d2d9ce');
 }else if(type==='sheet'){
  box(0,0,0,1.03,.65,.055,'#866f62');
  for(let i=0;i<7;i++)
   box(-.45+i*.15,0,.055,.045,.65,.08,i%2?'#c1b6a1':'#5c7377');
  box(-.42,.26,.11,.08,.14,.04,'#544337');
  box(.38,-.29,.11,.22,.07,.04,'#d2c5ac');
  box(.12,.16,-.06,.5,.045,.04,'#444a47');
 }else if(type==='timber'){
  box(-.12,0,0,.22,1.17,.12,'#80583d');
  box(.11,-.04,.06,.19,.88,.12,'#b38b59');
  box(-.10,.19,.076,.08,.67,.015,'#45352b');
  box(.15,-.09,.132,.025,.51,.01,'#524337');
  for(let i=0;i<4;i++){
   box(-.13,-.42+i*.29,.08,.045,.028,.025,'#c5bca9');
   box(.13,-.33+i*.22,.14,.05,.027,.024,'#5b5b51');
  }
 }else if(type==='stone'){
  prism(.68,.54,.28,'#a09a8c');
  box(-.08,.04,.24,.18,.08,.045,'#655c4f');
  box(.16,-.17,.18,.18,.07,.035,'#d5c4a5');
  prism(.26,.21,.08,'#756b62');
 }else{ // A fallen shop sign keeps its panel, metal border and lettering.
  box(0,0,0,1.3,.53,.072,'#a56d52');
  box(0,0,.043,1.2,.43,.012,'#272c30');
  for(const y of [-.25,.25])box(0,y,.065,1.3,.065,.12,'#b6b6a9');
  for(const x of [-.62,.62])box(x,0,.065,.065,.5,.12,'#a2a296');
  for(let i=0;i<5;i++)box(-.38+i*.19,.05,.065,.13,.09,.01,'#e7ddd1');
  box(0,-.12,.065,.62,.035,.014,'#a49f93');
  box(-.48,.33,-.02,.07,.23,.06,'#5c5c56');
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);geometry.computeBoundingSphere();
 return geometry;
}
function random(seed){let x=seed>>>0;return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);}
const zero=new THREE.Matrix4().makeScale(0,0,0);
export class CitySplinterField{
 constructor(root,mobile=false){
  this.root=root;this.mobile=mobile;this.items=new Map();
  this.dummy=new THREE.Object3D();
  const cap=mobile?56:92;
  for(const type of TYPES){
   const geometry=geometryFor(type),material=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.8,metalness:type==='sheet'?.45:.06,
    side:THREE.DoubleSide
   });
   const mesh=new THREE.InstancedMesh(geometry,material,cap);
   mesh.name='Detailed flying '+type+' fragments';
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   mesh.frustumCulled=false;
   mesh.count=cap;
   for(let i=0;i<cap;i++)mesh.setMatrixAt(i,zero);
   mesh.instanceMatrix.needsUpdate=true;
   root.add(mesh);
   this.items.set(type,{mesh,records:new Array(cap).fill(null),cursor:0,cap});
  }
  this.active=0;
 }
 burst(lot,tier,point,seed,amount=this.mobile?12:20){
  const r=random(seed||lot.index*151+tier*911+2341);
  const base=Array.isArray(point)?point:[lot.x,Math.min(lot.height*.7,3),lot.z];
  for(let n=0;n<amount;n++){
   // Every hit contains glazing, corrugated metal, splintered timber,
   // chipped masonry and signage; changing frequencies gives variation.
   const type=TYPES[(n+(tier||0))%TYPES.length];
   const pool=this.items.get(type),i=pool.cursor++%pool.cap;
   const vx=(r()-.5)*11,vy=2.4+r()*5.5,vz=(r()-.5)*11;
   pool.records[i]={
    x:base[0]+(r()-.5)*1.35,y:Math.max(.4,base[1]+(r()-.5)*2),
    z:base[2]+(r()-.5)*1.35,vx,vy,vz,
    rx:r()*6.28,ry:r()*6.28,rz:r()*6.28,
    spinX:(r()-.5)*6,spinY:(r()-.5)*7,spinZ:(r()-.5)*6,
    age:0,scale:(this.mobile?.66:.73)*(0.6+r()*.75)
   };
  }
 }
 update(dt){
  const delta=Math.max(0,Math.min(.055,dt)),dummy=this.dummy;
  for(const pool of this.items.values()){
   let changed=false;
   for(let i=0;i<pool.cap;i++){
    const p=pool.records[i];if(!p)continue;
    changed=true;p.age+=delta;
    if(p.age>=3.25){
     pool.records[i]=null;pool.mesh.setMatrixAt(i,zero);continue;
    }
    p.vy-=12.6*delta;
    p.x+=p.vx*delta;p.y+=p.vy*delta;p.z+=p.vz*delta;
    if(p.y<.13){p.y=.13;p.vy=Math.abs(p.vy)*.19;p.vx*=.75;p.vz*=.75;}
    p.rx+=p.spinX*delta;p.ry+=p.spinY*delta;p.rz+=p.spinZ*delta;
    dummy.position.set(p.x,p.y,p.z);
    dummy.rotation.set(p.rx,p.ry,p.rz);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();pool.mesh.setMatrixAt(i,dummy.matrix);
   }
   if(changed)pool.mesh.instanceMatrix.needsUpdate=true;
  }
 }
 reset(){
  for(const pool of this.items.values()){
   pool.cursor=0;pool.records.fill(null);
   for(let i=0;i<pool.cap;i++)pool.mesh.setMatrixAt(i,zero);
   pool.mesh.instanceMatrix.needsUpdate=true;
  }
 }
 dispose(){
  for(const pool of this.items.values()){
   pool.mesh.removeFromParent();
   pool.mesh.geometry.dispose();pool.mesh.material.dispose();
  }
  this.items.clear();
 }
}
