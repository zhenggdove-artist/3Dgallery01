import * as THREE from 'three';
// Keep a guard band and the full native bounding sphere. Never retire any
// resource that could be drawn by the current camera.
const sphere=new THREE.Sphere(),matrix=new THREE.Matrix4(),frustum=new THREE.Frustum(),eye=new THREE.Vector3();
const view={frustum,eye,distance:0};
export function residencyView(camera){
 camera.updateWorldMatrix(true,false);
 frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 eye.setFromMatrixPosition(camera.matrixWorld);view.distance=camera.far;return view;
}
export function farMesh(mesh,v,margin=12){
 const g=mesh.geometry;if(!g)return false;
 if(!g.boundingSphere)g.computeBoundingSphere();
 if(!g.boundingSphere||!Number.isFinite(g.boundingSphere.radius))return false;
 mesh.updateWorldMatrix(true,false);sphere.copy(g.boundingSphere).applyMatrix4(mesh.matrixWorld);
 if(!Number.isFinite(sphere.radius)||sphere.center.distanceToSquared(v.eye)<=(v.distance+margin+sphere.radius)**2)return false;
 sphere.radius+=margin;return !v.frustum.intersectsSphere(sphere);
}
export function updateResidency(state,far,now,suspend,resume,allowSuspend=true){
 if(!far){state.farSince=null;if(state.dormant){resume();state.dormant=false;}return false;}
 if(state.farSince==null)state.farSince=now;
 if(!state.dormant&&allowSuspend&&now-state.farSince>=15000){suspend();state.dormant=true;return true;}
 return false;
}
// Lossless per-tile packing: solid tiles need only one word. Preserve
// all four RGBA bytes, even unused tiles and transparent pixel channels.
export function packTile(pixels,side,tile,x,y){
 const words=new Uint32Array(pixels.buffer,pixels.byteOffset,pixels.byteLength/4),first=words[y*side+x];
 let solid=true;
 for(let row=0;row<tile&&solid;row++)for(let col=0;col<tile;col++)if(words[(y+row)*side+x+col]!==first){solid=false;break;}
 if(solid)return first;
 const data=new Uint32Array(tile*tile);
 for(let row=0;row<tile;row++)data.set(words.subarray((y+row)*side+x,(y+row)*side+x+tile),row*tile);
 return data;
}
export function unpackTile(packed,pixels,side,tile,x,y){
 const words=new Uint32Array(pixels.buffer,pixels.byteOffset,pixels.byteLength/4);
 for(let row=0;row<tile;row++){const start=(y+row)*side+x;if(typeof packed==='number')words.fill(packed,start,start+tile);else words.set(packed.subarray(row*tile,(row+1)*tile),start);}
}
export function packAtlas(pixels,side,tile){
 const result=[];for(let y=0;y<side;y+=tile)for(let x=0;x<side;x+=tile)result.push(packTile(pixels,side,tile,x,y));return result;
}
export function unpackAtlas(packed,side,tile){
 const pixels=new Uint8Array(side*side*4),grid=side/tile;
 for(let i=0;i<packed.length;i++)unpackTile(packed[i],pixels,side,tile,(i%grid)*tile,Math.floor(i/grid)*tile);return pixels;
}
