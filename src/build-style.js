import * as THREE from 'three';
import {houseSignSpecs} from './shared/city-layout.js';
import {drawSignArtwork} from './sign-art.js';
export const originalBuildSizes={cube:[2,2,2],bar:[6,2,2],cylinder:[2,2,2],wall:[5,2.5,.45],column:[1.4,4,1.4],platform:[4,.7,4]};
const textures=new Map();
export function buildMaterial(surface){const material=new THREE.MeshStandardMaterial({color:'#c6a5dc',roughness:.72,metalness:.03});if(surface){if(!textures.has(surface)){const t=new THREE.TextureLoader().load(window.TEMPLE_CONFIG.backendUrl+'/api/media/'+surface);t.colorSpace=THREE.SRGBColorSpace;textures.set(surface,t);}material.map=textures.get(surface);material.color.set('#ffffff');}return material;}
export function buildGeometry(kind){return kind==='cylinder'?new THREE.CylinderGeometry(.5,.5,1,24):new THREE.BoxGeometry(1,1,1);}

let wallTile;
export function houseTileTexture(){
 if(wallTile)return wallTile;
 // Deterministic shared RGBA texture; no DOM, canvas or platform-specific
 // drawing API is needed, so CI and browsers use exactly the same texture.
 const w=512,h=256,data=new Uint8Array(w*h*4);
 // Neutral luminance only: the original wall/instance color supplies all hue.
 const shades=[249,244,253,246,251,248];
 const hash=(x,y)=>{let n=Math.imul(x+70219,374761393)^Math.imul(y+931,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
 const noise=(x,y,sx,sy)=>{const a=Math.floor(x/sx),b=Math.floor(y/sy),u=x/sx-a,v=y/sy-b;const k=u*u*(3-2*u),l=v*v*(3-2*v);const ix=i=>((i%(w/sx))+(w/sx))%(w/sx),iy=i=>((i%(h/sy))+(h/sy))%(h/sy);return (hash(ix(a),iy(b))*(1-k)+hash(ix(a+1),iy(b))*k)*(1-l)+(hash(ix(a),iy(b+1))*(1-k)+hash(ix(a+1),iy(b+1))*k)*l;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const row=Math.floor(y/64),localX=(x+(row%2)*128)%256,localY=y%64,col=Math.floor((x+(row%2)*128)/256)%2,base=shades[(row*3+col)%shades.length];
  const seam=localX<1||localX>=255||localY<1||localY>=63;
  const grain=(hash(x,y)-.5)*17+(noise(x,y,8,2)-.5)*14+(noise(x,y,64,32)-.5)*13;
  const vein=(noise((x+y*4)%w,y,32,8)-.5)*12;
  const edge=localY===1||localX===1?13:localY===62||localX===254?-8:0;
  const i=(y*w+x)*4;
  const tone=Math.max(0,Math.min(255,Math.round((seam?158:base)+grain*(seam?.18:.64)+(seam?0:vein*.65+edge))));
  data[i]=data[i+1]=data[i+2]=tone;
  data[i+3]=255;
 }
 wallTile=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.UnsignedByteType);
 wallTile.colorSpace=THREE.SRGBColorSpace;wallTile.wrapS=wallTile.wrapT=THREE.RepeatWrapping;
 wallTile.magFilter=THREE.LinearFilter;wallTile.minFilter=THREE.LinearMipmapLinearFilter;wallTile.generateMipmaps=true;wallTile.anisotropy=4;wallTile.needsUpdate=true;
 return wallTile;
}
export function houseWallMaterial(color='#ffffff'){return new THREE.MeshStandardMaterial({color,map:houseTileTexture(),roughness:.96});}
export function createGmHouseMesh(spec,{preview=false}={}){
 const root=new THREE.Group(),{width:w,depth:d,height:h,floors,windows,signs,pipes,metal}=spec;
 const tile=houseWallMaterial(spec.wallColor||'#b4a395'),roofMat=new THREE.MeshStandardMaterial({color:spec.roofColor||'#8b8073',roughness:.96}),trim=new THREE.MeshStandardMaterial({color:'#8b8073',roughness:.96}),glass=new THREE.MeshStandardMaterial({color:'#465c60',roughness:.42,metalness:.12}),steel=new THREE.MeshStandardMaterial({color:'#83837e',roughness:.78,metalness:.25}),sign=new THREE.MeshStandardMaterial({color:'#964b42',roughness:.8}),black=new THREE.MeshStandardMaterial({color:spec.doorColor||'#292b2b'});
 const materials=[tile,roofMat,trim,glass,steel,sign,black],box=(x,y,z,a,b,c,m)=>{const geo=new THREE.BoxGeometry(a,b,c);if(m===tile){const uv=geo.attributes.uv;for(let face=0;face<6;face++){const su=(face<2?c:a)/2.4,sv=(face<4?b:c)/1.2;for(let k=0;k<4;k++){const i=face*4+k;uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);}}}const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
 box(0,h/2,0,w,h,d,tile);box(0,h+.07,0,w+.18,.14,d+.18,roofMat);box(0,Math.min(1,h*.24),d/2+.04,Math.min(1.4,w*.24),Math.min(2,h*.48),.10,black);
 for(let level=0;level<floors;level++){const y=(level+.53)*h/floors;for(let i=0;i<windows;i++){const x=(i-(windows-1)/2)*w/(windows+1),ww=Math.min(1.45,w/(windows+2)),wh=Math.min(1.35,h/floors*.46);for(const z of [-d/2-.035,d/2+.035]){box(x,y,z,ww+.12,wh+.12,.075,trim);box(x,y,z+Math.sign(z)*.055,ww,wh,.045,glass);box(x,y,z+Math.sign(z)*.085,.045,wh,.04,trim);}}}
 if(pipes)for(const side of [-1,1]){box(side*(w/2-.16),h*.47,d/2+.17,.12,h*.88,.12,steel);box(side*(w/2-.29),h*.9,d/2+.17,.38,.12,.12,steel);}
 if(metal){box(0,Math.min(2.6,h-.2),d/2+.45,w+.12,.12,.85,steel);const count=Math.min(32,Math.ceil(w*4));for(let i=0;i<count;i++)box(-w/2+(i+.5)*w/count,Math.min(2.67,h-.13),d/2+.45,.045,.065,.86,trim);}
 for(const s of houseSignSpecs({...spec,bladeCount:spec.bladeCount??0,roofCount:spec.roofCount??0})){
  const group=new THREE.Group();group.name=s.id;group.userData.houseSignId=s.id;group.position.set(s.x,s.y,s.z);root.add(group);
  const mat=new THREE.MeshStandardMaterial({color:s.color,roughness:.75});materials.push(mat);
  const panel=new THREE.Mesh(new THREE.BoxGeometry(s.width,s.height,s.depth),mat);group.add(panel);
  const border=new THREE.Mesh(new THREE.BoxGeometry(s.blade?s.width+.025:s.width*.94,s.height*.93,s.blade?s.depth*.94:s.depth+.025),mat);group.add(border);
  if(typeof document!=='undefined'){
   const c=document.createElement('canvas');c.width=s.blade?128:256;c.height=s.blade?256:128;const ctx=c.getContext('2d');drawSignArtwork(ctx,0,0,c.width,c.height,{color:s.color,title:'商店',subtitle:'TEMPLE SHOP',vertical:s.blade,aspect:s.blade?s.depth/s.height:s.width/s.height,seed:s.seed,style:s.style,font:s.font,saturation:s.saturation});
   const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const faceMat=new THREE.MeshStandardMaterial({map:tex,roughness:.8,side:THREE.DoubleSide});faceMat.userData.ownedSignMap=true;materials.push(faceMat);
   for(const side of [-1,1]){const face=new THREE.Mesh(new THREE.PlaneGeometry((s.blade?s.depth:s.width)*.92,s.height*.92),faceMat);if(s.blade){face.rotation.y=side*Math.PI/2;face.position.x=side*(s.width/2+.02);}else{face.rotation.y=side===1?0:Math.PI;face.position.z=side*(s.depth/2+.02);}group.add(face);}
  }
  for(const p of s.supports){const support=new THREE.Mesh(new THREE.BoxGeometry(p.width,p.height,p.depth),steel);support.position.set(p.x-s.x,p.y-s.y,p.z-s.z);group.add(support);}
 }
 if(preview)for(const m of materials){m.transparent=true;m.opacity=.86;}
 root.userData.gmHouseMaterials=materials;return root;
}
export function disposeGmHouseMesh(root){if(!root)return;root.removeFromParent();root.traverse(o=>o.geometry?.dispose());for(const m of root.userData.gmHouseMaterials||[]){if(m.userData.ownedSignMap)m.map?.dispose();m.dispose();}}
