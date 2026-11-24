// Lightweight rigid flight vehicles use real 3D geometry, shared materials
// and transform-only motion. No per-frame mesh or texture allocation.
export function createFlightVehicle(T,item){
 const g=new T.Group();g.userData.wingId=item.id;g.userData.flightVehicle=item.motif;
 const mat=(color,metalness=0)=>new T.MeshStandardMaterial({color,metalness,roughness:.64});
 const wood=mat('#ad7544'),dark=mat('#67452c'),steel=mat('#858c90',.5),cream=mat('#e3d3b1'),red=mat('#a54c36'),bamboo=mat('#b5a16b'),rubber=mat('#32302e');
 const mesh=(geo,m,x,y,z,parent=g)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);parent.add(o);return o;};
 const box=(m,x,y,z,w,h,d,p=g)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,p);
 const sphere=(m,x,y,z,a,b,c,p=g)=>{const o=mesh(new T.SphereGeometry(1,20,14),m,x,y,z,p);o.scale.set(a,b,c);return o;};
 const rod=(m,a,b,r,p=g)=>{const v=new T.Vector3(...a),w=new T.Vector3(...b),delta=w.clone().sub(v),o=mesh(new T.CylinderGeometry(r,r,delta.length(),10),m,0,0,0,p);o.position.copy(v).add(w).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;};
 const rotor=(y,m,span)=>{const p=new T.Group();p.position.y=y;g.add(p);p.name='vehicle-rotor';box(m,0,0,0,span,.035,.15,p);box(m,0,0,0,.15,.035,span*.8,p);sphere(steel,0,.035,0,.07,.065,.07,p);return p;};
 if(item.motif==='pedal-helicopter'){
  box(wood,0,.09,0,.79,.12,.98);box(dark,0,.46,-.28,.38,.09,.32);
  for(const s of [-1,1]){
   box(wood,s*.39,.30,0,.06,.35,.92);rod(dark,[s*.38,.13,-.39],[s*.38,1.33,-.26],.035);
   rod(wood,[s*.38,.13,.40],[s*.38,1.33,-.26],.028);
   rod(steel,[s*.29,.09,-.29],[s*.52,-.04,-.48],.027);
   rod(steel,[s*.29,.09,.29],[s*.52,-.04,.48],.027);
   rod(dark,[s*.52,-.04,-.55],[s*.52,-.04,.58],.035);
  }
  rod(wood,[0,.18,-.42],[0,.45,-1.10],.055);rod(steel,[0,1.22,-.26],[0,1.58,0],.045);
  rotor(1.62,wood,2.15);
  const crank=new T.Group();crank.position.set(0,.24,.32);crank.name='vehicle-crank';g.add(crank);
  const ring=mesh(new T.TorusGeometry(.14,.018,8,20),steel,0,0,0,crank);ring.rotation.y=Math.PI/2;
  for(const s of [-1,1]){rod(steel,[0,0,0],[s*.19,s*.10,0],.02,crank);box(rubber,s*.22,s*.10,0,.15,.035,.08,crank);}
  rod(wood,[0,.37,.37],[0,.80,.37],.025);box(steel,0,.81,.37,.40,.04,.05);
 }else if(item.motif==='zeppelin'){
  sphere(cream,0,1.84,-.04,.64,.48,1.24);
  for(let i=0;i<10;i++){const a=i*Math.PI/5;rod(red,[Math.sin(a)*.55,1.84+Math.cos(a)*.42,-.53],[Math.sin(a)*.55,1.84+Math.cos(a)*.42,.48],.012);}
  box(wood,0,.17,0,.78,.18,.93);box(dark,0,.40,-.29,.45,.10,.29);
  for(const s of [-1,1]){box(wood,s*.38,.32,0,.065,.35,.92);for(const z of [-.35,.35])rod(steel,[s*.34,.48,z],[s*.28,1.49,z],.017);}
  box(red,0,1.94,-1.19,.08,.49,.50);box(red,0,1.84,-1.19,.75,.06,.46);
  const p=new T.Group();p.name='vehicle-propeller';p.position.set(0,.43,-.63);g.add(p);box(wood,0,0,0,.08,.58,.04,p);box(wood,0,0,0,.58,.08,.04,p);
 }else{
  rod(bamboo,[0,0,0],[0,.32,0],.045);rotor(.35,bamboo,1.18);
 }
 return g;
}
export function animateFlightVehicle(root,time,flying){
 if(!root?.userData.flightVehicle)return false;
 const rotor=root.getObjectByName('vehicle-rotor'),crank=root.getObjectByName('vehicle-crank'),prop=root.getObjectByName('vehicle-propeller');
 if(rotor)rotor.rotation.y=time*(flying?25:2);
 if(crank)crank.rotation.x=time*(flying?8:1);
 if(prop)prop.rotation.z=time*(flying?22:2);
 return true;
}
