import * as THREE from 'three';

// A genuinely inflated, closed heart: every front/back vertex curves into
// the centre. Unlike ExtrudeGeometry, there are no flat front or rear faces.
export function createHeart(){
 const segments=64,latitudes=20,vertices=[],uv=[],indices=[];
 for(let ring=0;ring<=latitudes;ring++){
  const latitude=-Math.PI/2+Math.PI*ring/latitudes;
  const radial=Math.max(.00001,Math.cos(latitude));
  const z=.56*Math.sin(latitude);
  for(let i=0;i<=segments;i++){
   const t=2*Math.PI*i/segments;
   const x=16*Math.sin(t)**3/19;
   const y=(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/19-.04;
   vertices.push(x*radial,y*radial,z);
   uv.push(i/segments,ring/latitudes);
   if(ring&&i){const b=ring*(segments+1)+i, a=b-(segments+1);
    indices.push(a-1,b-1,a,a,b-1,b);}
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 // Correct winding may differ by hemisphere; use double-sided material so the
 // smooth, bulging front/back are visible from every camera rotation.
 const material=new THREE.MeshPhysicalMaterial({
  color:'#ff276b',emissive:'#e81750',emissiveIntensity:.48,
  metalness:.08,roughness:.19,clearcoat:1,clearcoatRoughness:.12,
  side:THREE.DoubleSide
 });
 const heart=new THREE.Mesh(geometry,material);
 heart.name='Inflated floating health heart';
 return heart;
}
