import * as THREE from 'three';
export const originalBuildSizes={cube:[2,2,2],bar:[6,2,2],cylinder:[2,2,2],wall:[5,2.5,.45],column:[1.4,4,1.4],platform:[4,.7,4]};
const textures=new Map();
export function buildMaterial(surface){const material=new THREE.MeshStandardMaterial({color:'#c6a5dc',roughness:.72,metalness:.03});if(surface){if(!textures.has(surface)){const t=new THREE.TextureLoader().load(window.TEMPLE_CONFIG.backendUrl+'/api/media/'+surface);t.colorSpace=THREE.SRGBColorSpace;textures.set(surface,t);}material.map=textures.get(surface);material.color.set('#ffffff');}return material;}
export function buildGeometry(kind){return kind==='cylinder'?new THREE.CylinderGeometry(.5,.5,1,24):new THREE.BoxGeometry(1,1,1);}
