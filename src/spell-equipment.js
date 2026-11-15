import * as THREE from 'three';

// Every spell receives a hand-held model rather than the old generic lash or
// an invisible weapon. Geometry is deterministic from family + rank + id.
const FAMILIES=new Set(['water','ice','fire','lightning','beam','petal','wave']);
export const isSpellWeapon=item=>!!item&&item.slot==='weapon'&&FAMILIES.has(item.family)&&!item.exotic;

export function makeSpellEquipment(item){
 const tier=Math.max(1,Math.min(5,Number(item.tier)||1)),g=new THREE.Group();
 const base=new THREE.Color(item.color||'#9de8ff');
 const accent=base.clone().lerp(new THREE.Color('#ffffff'),.18+.11*tier);
 const metal=new THREE.MeshStandardMaterial({color:tier>3?'#e9c48b':'#838b9f',metalness:.72,roughness:.3});
 const body=new THREE.MeshStandardMaterial({color:base,metalness:.23,roughness:.24,emissive:base,emissiveIntensity:.44});
 const bright=new THREE.MeshStandardMaterial({color:accent,metalness:.18,roughness:.14,emissive:accent,emissiveIntensity:.8});
 const dark=new THREE.MeshStandardMaterial({color:'#2c344b',metalness:.3,roughness:.55});
 const seed=[...String(item.id||'')].reduce((v,c)=>(v*33+c.charCodeAt(0))>>>0,5381);
 const pick=(i)=>((seed+Math.imul(i,2654435761))>>>0)/4294967296;
 const mesh=(geo,mat,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m;};
 const sphere=(r,x,y,z,mat=bright,detail=1)=>mesh(new THREE.IcosahedronGeometry(r,detail),mat,x,y,z);
 const bar=(a,b,r,mat=metal)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),m=mesh(new THREE.CylinderGeometry(r*.75,r,delta.length(),8),mat);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;};
 const ring=(r,y,vertical=false,mat=bright)=>{const m=mesh(new THREE.TorusGeometry(r,.018+tier*.002,7,24),mat,0,y,0);m.rotation.x=vertical?0:Math.PI/2;return m;};
 // A short shaft keeps the model readable and fully visible on the right hand.
 bar([0,-.08,0],[0,.64,0],.05,dark);
 for(let i=0;i<tier;i++)ring(.085+i*.014,.05+i*.13,false,metal);
 const h=.78+tier*.055;
 switch(item.family){
  case 'water':{
   // Multi-pronged tidal trident, with one unique number of suspended droplets per rank.
   bar([0,.54,0],[0,h+.34,0],.04,metal);
   for(const side of [-1,1]){
    bar([0,h-.05,0],[side*.26,h+.18,0],.027,bright);
    bar([side*.26,h+.18,0],[side*.27,h+.42,0],.025,metal);
   }
   for(let i=0;i<tier+1;i++){const a=i*Math.PI*2/(tier+1)+pick(1)*.35;sphere(.06+pick(i+5)*.03,Math.sin(a)*.22,h+.05+Math.cos(a)*.2,Math.cos(a)*.16,body);}
   sphere(.13,0,h+.38,0,bright);break;
  }
  case 'ice':{
   // Radial frost lattice with different crystal cuts at each tier.
   const crystal=mesh(new THREE.OctahedronGeometry(.2+tier*.028,0),bright,0,h+.2,0);
   crystal.scale.set(1+pick(2)*.4,1.6+tier*.15,.8+pick(3)*.4);
   for(let i=0;i<4+tier*2;i++){const a=i*Math.PI*2/(4+tier*2),r=.34+pick(i)*.08;
    const shard=mesh(new THREE.ConeGeometry(.05+.01*tier,.21+pick(i+12)*.16,4),i%2?body:bright,Math.cos(a)*r,h+.2+Math.sin(a)*r,0);shard.rotation.z=a-Math.PI/2;
   }ring(.24,h+.15,true,metal);break;
  }
  case 'fire':{
   // Stacked asymmetrical tongues of flame, ember cages for higher ranks.
   for(let i=0;i<3+tier;i++){const a=i*Math.PI*2/(3+tier),length=.28+.06*tier+.14*pick(i+4);
    const flame=mesh(new THREE.ConeGeometry(.09,length,5),i%2?body:bright,Math.cos(a)*.1,h+length*.5+Math.sin(a)*.06,Math.sin(a)*.1);
    flame.rotation.z=Math.sin(a)*.36;
   }
   sphere(.13+tier*.02,0,h+.1,0,body);
   for(let i=0;i<tier+2;i++){const a=i*2.399;sphere(.025+i%3*.008,Math.cos(a)*(.2+pick(i)*.11),h+.1+i*.06,Math.sin(a)*.15,bright);}
   break;
  }
  case 'lightning':{
   // Branching conductive lightning rods, not the same gem as Glacier.
   for(let side=-1;side<=1;side+=2){let x=0,y=.65;for(let i=0;i<tier+2;i++){
    const nx=x+side*(.12+(i%2)*-.07),ny=y+.12+pick(i+2)*.025;
    bar([x,y,0],[nx,ny,0],.027,i%2?body:bright);x=nx;y=ny;
   }}
   const orb=mesh(new THREE.DodecahedronGeometry(.12+tier*.02,0),bright,0,h+.15,0);
   orb.rotation.z=pick(3)*Math.PI;
   ring(.22+tier*.02,h+.1,true,metal);break;
  }
  case 'beam':{
   // Concentric focusing-lens mechanism, perpendicular prisms and emitters.
   const lens=mesh(new THREE.CylinderGeometry(.2+tier*.02,.2+tier*.02,.07,10),body,0,h+.13,0);
   lens.rotation.x=Math.PI/2;
   for(let i=0;i<tier+2;i++){const a=i*Math.PI*2/(tier+2),r=.26+tier*.025;
    const node=sphere(.045,Math.cos(a)*r,h+.12+Math.sin(a)*r,0,bright);
    node.scale.set(.8,1.4,.8);
   }
   ring(.25+tier*.025,h+.13,true,metal);
   sphere(.09,0,h+.1,.13+tier*.02,bright);break;
  }
  case 'petal':{
   // Five-to-nine visible flower blades and a botanically distinct corolla.
   const count=4+tier;
   sphere(.11,0,h+.1,0,body);
   for(let i=0;i<count;i++){const a=i*Math.PI*2/count;
    const petal=mesh(new THREE.SphereGeometry(.13+tier*.012,10,7),i%2?bright:body,Math.cos(a)*.2,h+.1+Math.sin(a)*.2,0);
    petal.scale.set(.6,1.35,.27);petal.rotation.z=-a+Math.PI/2;
   }
   sphere(.08+tier*.01,0,h+.1,.05,bright);
   for(let i=0;i<tier;i++)bar([0,.35,0],[Math.sin(i*2.1)*.12,.5+i*.04,Math.cos(i*2.1)*.11],.017,body);break;
  }
  case 'wave':{
   // Helical conch/staff with several differently sized crescent wave fins.
   const turns=2+tier,curve=[];for(let i=0;i<42;i++){const t=i/41,a=turns*Math.PI*2*t;
    curve.push(new THREE.Vector3(Math.cos(a)*(.08+t*.17),.48+t*.73,Math.sin(a)*(.08+t*.17)));}
   mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve),80,.027,6,false),bright);
   for(let i=0;i<tier+1;i++){
    const fin=mesh(new THREE.TorusGeometry(.12+i*.03,.028,6,20,Math.PI*1.2),i%2?body:metal,0,.75+i*.11,0);
    fin.rotation.y=i*.65;fin.rotation.z=.3;
   }
   sphere(.12+tier*.01,0,h+.23,0,bright);
   // Distinct suspended foam droplets improve the low-rank silhouette.
   for(let i=0;i<4+tier;i++){
    const angle=i*Math.PI*2/(4+tier)+pick(i)*.2;
    const foam=sphere(.03+.012*pick(i+16),Math.sin(angle)*(.22+tier*.025),h+.11+Math.cos(angle)*.29,Math.cos(angle*.7)*.09,i%2?body:bright);
    foam.scale.y=1.3+pick(i+22)*.5;
   }
   break;
  }
 }
 // Every rank changes its silhouette and has an extra distinctive orbit crown.
 if(tier>=3){const crown=mesh(new THREE.TorusGeometry(.17+tier*.025,.02,7,24),metal,0,h+.45,0);crown.rotation.x=.25*tier;crown.rotation.y=pick(13)*Math.PI;}
 if(tier===5)for(let i=0;i<5;i++){const a=i*Math.PI*2/5;sphere(.045,Math.cos(a)*.31,h+.48,Math.sin(a)*.31,bright);}
 g.name=item.name+' / '+item.id;
 g.userData={family:item.family,spell:true,reach:1.6,weaponId:item.id};
 return g;
}
