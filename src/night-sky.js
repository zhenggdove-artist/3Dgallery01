import * as THREE from 'three';

// The sky is an infinitely distant WORLD-ORIENTED backdrop. Only its origin
// follows the camera position: it never follows the camera's rotation.
// Every cloud is a translucent object hundreds of metres away with depth
// testing enabled, so scene geometry always occludes it.
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function makeCloudTexture(seed){
  const rnd=random(seed),canvas=document.createElement('canvas');
  canvas.width=640;canvas.height=256;
  const ctx=canvas.getContext('2d');
  const mask=document.createElement('canvas');mask.width=640;mask.height=256;
  const outline=mask.getContext('2d');outline.fillStyle='#ffffff';
  // Build one continuous cloud mass from unequal silhouette lobes.
  const lobes=[];
  for(let i=0;i<23;i++){
    const x=72+rnd()*495,y=150+(rnd()-.5)*35-(rnd()<.65?rnd()*37:0);
    const rx=28+rnd()*61,ry=23+rnd()*39;
    lobes.push({x,y,rx,ry});
    outline.beginPath();outline.ellipse(x,y,rx,ry,-.25+rnd()*.5,0,Math.PI*2);outline.fill();
  }
  outline.beginPath();outline.ellipse(320,181,265,31,0,0,Math.PI*2);outline.fill();
  // Blurred outline stays an aerial cloud with broad, definite contours;
  // it never becomes a peppered point overlay attached to the camera.
  ctx.filter='blur(5px)';ctx.drawImage(mask,0,0);ctx.filter='none';
  ctx.globalCompositeOperation='source-in';
  const body=ctx.createLinearGradient(0,70,0,238);
  body.addColorStop(0,'rgba(162,177,215,.92)');
  body.addColorStop(.37,'rgba(113,137,182,.90)');
  body.addColorStop(.72,'rgba(63,84,135,.92)');
  body.addColorStop(1,'rgba(24,35,78,.89)');
  ctx.fillStyle=body;ctx.fillRect(0,0,640,256);
  // World-facing warm upper rims and cool deep undersides.
  ctx.globalCompositeOperation='source-atop';
  for(const l of lobes){
    const g=ctx.createRadialGradient(l.x-l.rx*.18,l.y-l.ry*.5,l.ry*.06,l.x,l.y,l.rx*1.2);
    g.addColorStop(0,'rgba(198,210,229,.35)');
    g.addColorStop(.5,'rgba(139,157,194,.12)');
    g.addColorStop(1,'rgba(17,28,63,0)');
    ctx.fillStyle=g;ctx.beginPath();
    ctx.ellipse(l.x,l.y,l.rx,l.ry,0,0,Math.PI*2);ctx.fill();
  }
  const shade=ctx.createLinearGradient(0,130,0,240);
  shade.addColorStop(0,'rgba(31,45,87,0)');
  shade.addColorStop(.63,'rgba(31,45,87,.10)');
  shade.addColorStop(1,'rgba(15,21,55,.32)');
  ctx.fillStyle=shade;ctx.fillRect(0,105,640,151);
  ctx.globalCompositeOperation='source-over';
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;
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
