import * as THREE from 'three';

// Closed, inflated heart: an actual rounded volume, not a flat extruded icon.
// Each longitudinal slice contracts the original Bézier silhouette to a smooth tip.
export function createHeart(){
 const outline=new THREE.Shape();
 outline.moveTo(0,.24);
 outline.bezierCurveTo(-.22,.60,-1.05,.91,-1.08,.20);
 outline.bezierCurveTo(-1.11,-.39,-.36,-.84,0,-1.01);
 outline.bezierCurveTo(.36,-.84,1.11,-.39,1.08,.20);
 outline.bezierCurveTo(1.05,.91,.22,.60,0,.24);
 const vertices=[],indices=[],uCount=64,vCount=28,points=outline.getSpacedPoints(uCount-1);
 const centerY=-.13,depth=.52;
 for(let k=0;k<=vCount;k++){
  const angle=-Math.PI/2+k*Math.PI/vCount;
  const spread=Math.max(.0003,Math.cos(angle)),z=depth*Math.sin(angle);
  for(let j=0;j<uCount;j++){
   const p=points[j];
   vertices.push(p.x*spread,centerY+(p.y-centerY)*spread,z);
  }
 }
 for(let k=0;k<vCount;k++)for(let j=0;j<uCount;j++){
  const next=(j+1)%uCount,a=k*uCount+j,b=k*uCount+next,
   c=(k+1)*uCount+next,d=(k+1)*uCount+j;
  indices.push(a,b,d,b,c,d); // outward winding for correct exterior PBR highlights
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const material=new THREE.MeshPhysicalMaterial({
  color:'#ff146c',emissive:'#e60040',emissiveIntensity:.29,
  roughness:.19,metalness:.04,clearcoat:1,clearcoatRoughness:.10,
  side:THREE.DoubleSide
 });
 const heart=new THREE.Mesh(geometry,material);
 heart.name='Inflated saturated three-dimensional healing heart';
 heart.scale.setScalar(.9); // twice the previous 0.45 world-model scale
 return heart;
}
