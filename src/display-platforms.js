import * as THREE from 'three';
import {artworkDefinitions} from './shared/artwork-library.js';

// Only the thirteen original exhibition works use display decks and pedestals.
// Player uploads have no surrounding discs, staircases or cone bases.
export class DisplayPlatforms{
 constructor(arena){
  this.arena=arena;this.discs=[];this.cones=[];this.lastFloatAt=-Infinity;
  this.floatMatrix=new THREE.Matrix4();this.floatPosition=new THREE.Vector3();
  this.floatScale=new THREE.Vector3();this.floatQuaternion=new THREE.Quaternion();
  this.geometry=new THREE.CylinderGeometry(1,1.06,.4,48);
  this.coneGeometry=new THREE.ConeGeometry(1,1,3,1);
  this.highlight=new THREE.Mesh(new THREE.CylinderGeometry(1.015,1.07,.45,48),new THREE.MeshBasicMaterial({color:'#1676ff',transparent:true,opacity:.88,depthTest:true,depthWrite:false,toneMapped:false}));
  this.highlight.name='GM selected disc';this.highlight.visible=false;arena.scene.add(this.highlight);
  this.coneHighlight=new THREE.Mesh(this.coneGeometry,new THREE.MeshBasicMaterial({color:'#1676ff',transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));
  this.coneHighlight.name='GM selected gray pedestal';this.coneHighlight.visible=false;arena.scene.add(this.coneHighlight);
  this.selectedKey=null;this.editPreview=null;this.placement=null;
  this.placementMesh=new THREE.Mesh(this.geometry,new THREE.MeshBasicMaterial({color:'#E84887',transparent:true,opacity:.72,depthWrite:false}));
  this.placementCone=new THREE.Mesh(this.coneGeometry,new THREE.MeshBasicMaterial({color:'#777d85',transparent:true,opacity:.72,depthWrite:false}));
  this.placementMesh.visible=this.placementCone.visible=false;
  arena.scene.add(this.placementMesh,this.placementCone);
  this.material=new THREE.MeshPhysicalMaterial({color:'#E84887',roughness:.25,metalness:.1,clearcoat:.8,iridescence:.6,emissive:'#E84887',emissiveIntensity:.06});
  this.coneMaterial=new THREE.MeshStandardMaterial({color:'#777d85',roughness:.89,metalness:.06,flatShading:true});
 }
 sync(){
  const a=this.arena,defs=artworkDefinitions(a.world);
  const signature=JSON.stringify([a.world?.artworkLayout||a.defaultLayout,a.world?.floatingPlatforms,defs.map(d=>d.id),a.artworks.size,a.world?.removedPlatformIds,a.world?.customPedestals,a.world?.platformOverrides,defs.map(d=>a.artworks.get(d.id)?.userData.previewPlatformRadius??null)]);
  if(signature===this.signature)return;this.signature=signature;
  const discs=[],cones=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
  const customIds=new Set((a.world?.customArtworks||[]).map(d=>d.id)),removed=new Set(a.world?.removedPlatformIds||[]);
  const overrides=a.world?.platformOverrides||{};
  for(const d of defs){
   if(customIds.has(d.id))continue;
   const root=a.artworks.get(d.id);if(!root)continue;
   let box=root.userData.displayBounds;
   if(!box){
    root.updateMatrixWorld(true);
    const inverse=root.matrixWorld.clone().invert();box=new THREE.Box3();
    root.traverse(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();
     box.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));
    });
    root.userData.displayBounds=box;
   }
   const l=a.world?.artworkLayout?.[d.id]||a.defaultLayout[d.id]||{position:d.artPosition,rotation:[0,d.artYaw,0],scale:[1,1,1]};
   const transformed=box.clone().applyMatrix4(matrix.compose(new THREE.Vector3(),q.setFromEuler(new THREE.Euler(...l.rotation)),scale.fromArray(l.scale)));
   // Exhibition decks are world fixtures: moving the artwork does not relocate its floor.
   const top=Math.max(0,d.size[1]);
   // Radius is a standalone GM-editable property, never hard-locked to art scale.
   const automatic=Math.min(14,2*Math.max(2.4,Math.min(8,Math.max(transformed.max.x-transformed.min.x,transformed.max.z-transformed.min.z)*.54+.75)));
   const chosenRadius=root.userData.previewPlatformRadius??l.platformRadius;
   const radius=Number.isFinite(chosenRadius)?THREE.MathUtils.clamp(chosenRadius,1.5,14):automatic;
   const displayKey='display:'+d.id,displayOverride=overrides[displayKey];
   const deckTop=displayOverride?.position?.[1]??top;
   const deckRadius=displayOverride?.radius??radius;
   const position=[displayOverride?.position?.[0]??d.position[0],deckTop-.2,displayOverride?.position?.[2]??d.position[2]];
   if(!removed.has(displayKey))
    discs.push({position,radius:deckRadius,top:deckTop,artwork:d.id,display:true,key:displayKey,
     editPosition:[position[0],deckTop,position[2]]});
   const pedestalKey='pedestal:'+d.id,pedestalOverride=overrides[pedestalKey],coneHeight=pedestalOverride?.height??.62;
   const coneRadius=pedestalOverride?.radius??Math.min(.72,Math.max(.3,deckRadius*.13));
   const pedestalBase=pedestalOverride?.position||[position[0],deckTop+.015,position[2]];
   if(!removed.has(pedestalKey))cones.push({position:[pedestalBase[0],pedestalBase[1]+coneHeight*.5,pedestalBase[2]],radius:coneRadius,height:coneHeight,artwork:d.id,key:pedestalKey,
    editPosition:[...pedestalBase]});
   // Narrow jumpable access steps remain independent of artwork dimensions.
   // Ground-level art needs no stairs; elevated works now need roughly half as many.
   // Two access discs per formerly five-step route: roughly half as many
   // total pink discs while keeping stairs distributed across the ascent.
   const steps=top<=.25?0:Math.max(1,Math.round(Math.max(5,Math.ceil(top/1.7))/3));
   const angle=Math.atan2(position[2],position[0]);
   for(let i=0;i<steps;i++){
    const t=(i+1)/(steps+1),dist=radius+1.2+(1-t)*4;
    const turn=angle+(1-t)*Math.PI*1.6,x=position[0]+Math.cos(turn)*dist,z=position[2]+Math.sin(turn)*dist,stepTop=Math.max(.15,top*t);
    const key='stair:'+d.id+':'+i,override=overrides[key],rise=override?.position?.[1]??stepTop;
    const place=override?.position||[x,rise,z];
    if(!removed.has(key))discs.push({position:[place[0],rise-.2,place[2]],top:rise,
     radius:override?.radius??5.4,artwork:d.id,stair:true,key,editPosition:[...place]});
   }
  }
  for(const d of a.world?.floatingPlatforms||[])discs.push({position:[d.position[0],d.position[1]-.2,d.position[2]],top:d.position[1],radius:d.radius*2,id:d.id,key:'floating:'+d.id,editPosition:[...d.position]});
  for(const d of a.world?.customPedestals||[])cones.push({position:[d.position[0],d.position[1]+d.height*.5,d.position[2]],
    radius:d.radius,height:d.height,id:d.id,key:'pedestal:custom:'+d.id,editPosition:[...d.position]});
  for(const mesh of [this.mesh,this.pedestals]){mesh?.removeFromParent();mesh?.dispose();}
  const draw=(list,name,geometry,material)=>{
   if(!list.length)return null;
   const mesh=new THREE.InstancedMesh(geometry,material,list.length);mesh.name=name;
   list.forEach((d,i)=>{
    mesh.setMatrixAt(i,matrix.compose(new THREE.Vector3(...d.position),q.identity(),scale.set(d.radius,d.height||1,d.radius)));
   });
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();a.scene.add(mesh);return mesh;
  };
  this.mesh=draw(discs,'Original artwork platforms and access stairs',this.geometry,this.material);
  this.pedestals=draw(cones,'Gray triangular-cone artwork pedestals',this.coneGeometry,this.coneMaterial);
  // Precompute each deterministic drift phase once per world sync.
  const seedPhase=(key)=>{
   let hash=2166136261;
   for(const c of key){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}
   return (hash>>>0)/4294967296;
  };
  for(const d of [...discs,...cones])d.floatPhase=seedPhase(d.key);
  this.discs=discs;this.cones=cones;this.select(this.selectedKey);
  this.lastFloatAt=-Infinity;this.update(a.clock||0);
 }
 // Cosmetic motion only: physics uses the fixed deck surface to avoid
 // server/client reconciliation, jitter and fall-through on moving platforms.
 update(time=0){
  if((!this.mesh&&!this.pedestals)||!Number.isFinite(time)||time-this.lastFloatAt<.04)return;
  this.lastFloatAt=time;
  const drift=(d)=>{
   const phase=d.floatPhase;
   return [Math.sin(time*(.29+phase*.12)+phase*19)*.09,
    Math.sin(time*(.39+phase*.15)+phase*21)*.075,
    Math.cos(time*(.32+phase*.1)+phase*17)*.09];
  };
  const apply=(mesh,list)=>{
   if(!mesh)return;
   list.forEach((d,i)=>{
    const [dx,dy,dz]=drift(d);
    const edited=this.editPreview?.key===d.key?this.editPreview:null;
    this.floatPosition.set(d.position[0]+dx,d.position[1]+dy,d.position[2]+dz);
    this.floatScale.set(edited?0:d.radius,edited?0:(d.height||1),edited?0:d.radius);
    mesh.setMatrixAt(i,this.floatMatrix.compose(this.floatPosition,this.floatQuaternion,this.floatScale));
    if(d.key===this.selectedKey){
      const visual=mesh===this.pedestals?this.coneHighlight:this.highlight;
      if(edited){
        const centerY=edited.position[1]+(mesh===this.pedestals?edited.height*.5:-.2);
        visual.position.set(edited.position[0],centerY,edited.position[2]);
        visual.scale.set(edited.radius,mesh===this.pedestals?edited.height:1,edited.radius);
      }else{
        visual.position.copy(this.floatPosition);
        visual.scale.set(d.radius,mesh===this.pedestals?d.height:1,d.radius);
      }
    }
   });
   mesh.instanceMatrix.needsUpdate=true;
  };
  apply(this.mesh,this.discs);apply(this.pedestals,this.cones);
 }
 select(key){
  const disc=this.discs.find(d=>d.key===key)||this.cones.find(d=>d.key===key);
  this.selectedKey=disc?.key||null;
  const cone=!!disc&&disc.key.startsWith('pedestal:');
  this.highlight.visible=!!disc&&!cone;
  this.coneHighlight.visible=!!disc&&cone;
  if(disc){
   const mesh=cone?this.coneHighlight:this.highlight;
   mesh.position.set(...disc.position);mesh.scale.set(disc.radius,cone?disc.height:1,disc.radius);
  }
  this.lastFloatAt=-Infinity;
  return disc||null;
 }
 pick(ray){
  const meshes=[this.mesh,this.pedestals].filter(Boolean);
  if(!meshes.length)return null;
  const hit=ray.intersectObjects(meshes,false).find(h=>Number.isInteger(h.instanceId));
  return hit?(hit.object===this.pedestals?this.cones:this.discs)[hit.instanceId]||null:null;
 }
 previewSelected(key,position,radius,height){
  this.editPreview={key,position:[...position],radius,height:height||.62};
  this.lastFloatAt=-Infinity;this.update(this.arena.clock||0);
 }
 clearPreview(){
  this.editPreview=null;this.lastFloatAt=-Infinity;this.update(this.arena.clock||0);
 }
 previewPlacement(kind,position,radius,height=.62){
  this.placement={kind,position:[...position],radius,height};
  const cone=kind==='pedestal',mesh=cone?this.placementCone:this.placementMesh;
  this.placementCone.visible=cone;this.placementMesh.visible=!cone;
  mesh.position.set(position[0],position[1]+(cone?height*.5:-.2),position[2]);
  mesh.scale.set(radius,cone?height:1,radius);
 }
 stopPlacement(){
  this.placement=null;this.placementMesh.visible=this.placementCone.visible=false;
 }

 ground(x,z,y){
  let h=0;
  // A disc only supports a foot at/above its top. The old half-metre
  // underside tolerance could latch falling players back onto an edge.
  for(const d of this.discs)if(y>=d.top-.06&&Math.hypot(x-d.position[0],z-d.position[2])<d.radius)h=Math.max(h,d.top);
  return h;
 }
}
