import * as THREE from 'three';
export function createHeart(){
 const s=new THREE.Shape();s.moveTo(0,.2);s.bezierCurveTo(-.7,1,-1.4,.05,0,-.85);s.bezierCurveTo(1.4,.05,.7,1,0,.2);
 const g=new THREE.ExtrudeGeometry(s,{depth:.18,bevelEnabled:true,bevelThickness:.07,bevelSize:.07,bevelSegments:2,steps:1,curveSegments:12});
 const root=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#ff5185',emissive:'#d82955',emissiveIntensity:.25,roughness:.25,metalness:.15}));root.scale.setScalar(.45);return root;
}
