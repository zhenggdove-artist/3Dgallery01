import * as THREE from 'three';

// The sky is an infinitely distant WORLD-ORIENTED backdrop. Only its origin
// follows the camera position: it never follows the camera's rotation.
// Every cloud is a translucent object hundreds of metres away with depth
// testing enabled, so scene geometry always occludes it.
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function makeCloudTexture(seed){
  const rand=random(seed),canvas=document.createElement('canvas');
  canvas.width=640;canvas.height=256;
  const ctx=canvas.getContext('2d');
  // Large overlapping lobes give silhouettes and weight, not film-grain dots.
  const lobes=[];
  for(let i=0;i<27;i++){
    const x=90+rand()*455,base=142+rand()*37;
    const r=25+rand()*55;
    lobes.push({x,y:base-(rand()*.76)*r,r,light:.35+rand()*.27});
  }
  lobes.sort((a,b)=>a.y-b.y);
  for(const l of lobes){
    const g=ctx.createRadialGradient(l.x,l.y,l.r*.13,l.x,l.y,l.r);
    g.addColorStop(0,'rgba(199,210,232,.66)');
    g.addColorStop(.36,'rgba(148,165,202,.51)');
    g.addColorStop(.70,'rgba(101,125,170,.26)');
    g.addColorStop(1,'rgba(84,107,148,0)');
    ctx.fillStyle=g;ctx.fillRect(l.x-l.r,l.y-l.r,2*l.r,2*l.r);
  }
  // A dark, shallow underside visually anchors the layered cloud banks.
  const under=ctx.createLinearGradient(0,150,0,230);
  under.addColorStop(0,'rgba(23,35,74,0)');
  under.addColorStop(.6,'rgba(24,35,73,.10)');
  under.addColorStop(1,'rgba(24,35,73,0)');
  ctx.fillStyle=under;ctx.fillRect(38,135,566,96);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=2;
  return texture;
}
function cloudBank(root,index,rand,touch){
  const angle=index*Math.PI*2/9+(index%2)*.12;
  const distance=250+(index%3)*19,altitude=82+(index%4)*23;
  const width=touch?115:135+(index%3)*21,height=47+(index%4)*10;
  const group=new THREE.Group();group.name='Distant sky cloud bank '+index;
  group.position.set(Math.cos(angle)*distance,altitude,Math.sin(angle)*distance);
  // The plane faces the arena at a fixed WORLD angle, not the camera.
  group.lookAt(0,70,0);
  const texture=makeCloudTexture(0xc0124+index*2997);
  const material=new THREE.MeshBasicMaterial({
    map:texture,transparent:true,opacity:.81,depthTest:true,depthWrite:false,
    side:THREE.DoubleSide,alphaTest:.012,blending:THREE.NormalBlending,
    fog:false,toneMapped:false
  });
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
  plane.renderOrder=-120;group.add(plane);
  root.add(group);
  return {group,base:angle,distance,altitude,phase:index*1.17};
}
export function createMoonlitSky(scene){
  const touch=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
  const rand=random(173331);
  const root=new THREE.Group();
  root.name='World-oriented distant cloud sky (no moon)';
  scene.add(root);
  const clouds=Array.from({length:9},(_,i)=>cloudBank(root,i,rand,touch));
  const stars=[],colors=[];
  for(let i=0;i<(touch?900:1900);i++){
    const a=rand()*Math.PI*2,el=.24+rand()*1.17,r=345;
    stars.push(r*Math.cos(a)*Math.cos(el),r*Math.sin(el),r*Math.sin(a)*Math.cos(el));
    const c=new THREE.Color(rand()<.12?'#f3e2bd':'#adc8ff');const shade=.43+rand()*.57;
    colors.push(c.r*shade,c.g*shade,c.b*shade);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const starfield=new THREE.Points(geo,new THREE.PointsMaterial({
    size:1.15,vertexColors:true,opacity:.77,transparent:true,depthTest:true,
    depthWrite:false,sizeAttenuation:false,toneMapped:false,fog:false
  }));
  starfield.name='Distant stars';starfield.renderOrder=-150;root.add(starfield);
  return {root,clouds,update(camera,time){
    if(camera)root.position.copy(camera.position);
    // Slow wind in world-space; no camera-relative quad or screen-space dirt.
    for(const cloud of clouds){
      const theta=cloud.base+Math.sin(time*.006+cloud.phase)*.014;
      cloud.group.position.set(Math.cos(theta)*cloud.distance,cloud.altitude+Math.sin(time*.018+cloud.phase)*1.3,Math.sin(theta)*cloud.distance);
    }
  }};
}
