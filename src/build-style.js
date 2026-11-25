import * as THREE from 'three';
export const originalBuildSizes={cube:[2,2,2],bar:[6,2,2],cylinder:[2,2,2],wall:[5,2.5,.45],column:[1.4,4,1.4],platform:[4,.7,4]};
const textures=new Map();
export function buildMaterial(surface){const material=new THREE.MeshStandardMaterial({color:'#c6a5dc',roughness:.72,metalness:.03});if(surface){if(!textures.has(surface)){const t=new THREE.TextureLoader().load(window.TEMPLE_CONFIG.backendUrl+'/api/media/'+surface);t.colorSpace=THREE.SRGBColorSpace;textures.set(surface,t);}material.map=textures.get(surface);material.color.set('#ffffff');}return material;}
export function buildGeometry(kind){return kind==='cylinder'?new THREE.CylinderGeometry(.5,.5,1,24):new THREE.BoxGeometry(1,1,1);}

let wallTile;
export function houseTileTexture(){
 if(wallTile)return wallTile;
 const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
 let seed=70219;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 g.fillStyle='#675d54';g.fillRect(0,0,512,256);
 const shades=['#b4a395','#b6a095','#c1b3a5','#ac998a','#bda89a','#c9bcb0'];
 for(let row=0;row<4;row++)for(let col=-1;col<3;col++){
  const x=col*256+(row%2)*128,y=row*64;g.fillStyle=shades[(row*3+col+12)%shades.length];g.fillRect(x+1,y+1,254,62);
  g.save();g.beginPath();g.rect(x+2,y+2,252,60);g.clip();
  for(let i=0;i<450;i++){g.globalAlpha=.04+rand()*.13;g.fillStyle=i%2?'#f5e9dc':'#766556';g.fillRect(x+rand()*256,y+rand()*64,1+rand()*11,.5+rand()*2);}
  for(let i=0;i<18;i++){g.globalAlpha=.065;g.strokeStyle=i%2?'#f4e7dc':'#78675c';g.beginPath();const px=x+rand()*256,py=y+rand()*64;g.moveTo(px,py);g.lineTo(px+30+rand()*55,py-4-rand()*18);g.stroke();}
  g.restore();g.globalAlpha=1;g.fillStyle='#e2d2c1';g.fillRect(x+1,y+1,254,1);
 }wallTile=new THREE.CanvasTexture(c);wallTile.colorSpace=THREE.SRGBColorSpace;wallTile.wrapS=wallTile.wrapT=THREE.RepeatWrapping;wallTile.anisotropy=4;return wallTile;
}
export function houseWallMaterial(){return new THREE.MeshStandardMaterial({color:'#ffffff',map:houseTileTexture(),roughness:.96});}
export function createGmHouseMesh(spec,{preview=false}={}){
 const root=new THREE.Group(),{width:w,depth:d,height:h,floors,windows,signs,pipes,metal}=spec;
 const tile=houseWallMaterial(),trim=new THREE.MeshStandardMaterial({color:'#8b8073',roughness:.96}),glass=new THREE.MeshStandardMaterial({color:'#465c60',roughness:.42,metalness:.12}),steel=new THREE.MeshStandardMaterial({color:'#83837e',roughness:.78,metalness:.25}),sign=new THREE.MeshStandardMaterial({color:'#964b42',roughness:.8}),black=new THREE.MeshStandardMaterial({color:'#292b2b'});
 const materials=[tile,trim,glass,steel,sign,black],box=(x,y,z,a,b,c,m)=>{const geo=new THREE.BoxGeometry(a,b,c);if(m===tile){const uv=geo.attributes.uv;for(let face=0;face<6;face++){const su=(face<2?c:a)/2.4,sv=(face<4?b:c)/1.2;for(let k=0;k<4;k++){const i=face*4+k;uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);}}}const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
 box(0,h/2,0,w,h,d,tile);box(0,h+.07,0,w+.18,.14,d+.18,trim);box(0,Math.min(1,h*.24),d/2+.04,Math.min(1.4,w*.24),Math.min(2,h*.48),.10,black);
 for(let level=0;level<floors;level++){const y=(level+.53)*h/floors;for(let i=0;i<windows;i++){const x=(i-(windows-1)/2)*w/(windows+1),ww=Math.min(1.45,w/(windows+2)),wh=Math.min(1.35,h/floors*.46);for(const z of [-d/2-.035,d/2+.035]){box(x,y,z,ww+.12,wh+.12,.075,trim);box(x,y,z+Math.sign(z)*.055,ww,wh,.045,glass);box(x,y,z+Math.sign(z)*.085,.045,wh,.04,trim);}}}
 for(let i=0;i<signs;i++){const x=(i-(signs-1)/2)*w/(signs+1),y=Math.min(h-.35,2.35);box(x,y,d/2+.15,Math.min(w/(signs+1),2.5),.46,.25,sign);box(x,y,d/2+.29,Math.min(w/(signs+1),2.5)*.72,.055,.02,trim);}
 if(pipes)for(const side of [-1,1]){box(side*(w/2-.16),h*.47,d/2+.17,.12,h*.88,.12,steel);box(side*(w/2-.29),h*.9,d/2+.17,.38,.12,.12,steel);}
 if(metal){box(0,Math.min(2.6,h-.2),d/2+.45,w+.12,.12,.85,steel);const count=Math.min(32,Math.ceil(w*4));for(let i=0;i<count;i++)box(-w/2+(i+.5)*w/count,Math.min(2.67,h-.13),d/2+.45,.045,.065,.86,trim);}
 if(preview)for(const m of materials){m.color.lerp(new THREE.Color('#247fff'),.35);m.transparent=true;m.opacity=.82;}
 root.userData.gmHouseMaterials=materials;return root;
}
export function disposeGmHouseMesh(root){if(!root)return;root.removeFromParent();root.traverse(o=>o.geometry?.dispose());for(const m of root.userData.gmHouseMaterials||[])m.dispose();}
