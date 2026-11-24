// Natural-history-inspired premium specimens. Rarity is violet in the UI,
// never a rule imposing purple pigment onto the butterfly itself.
const palettes={
 owl:['#796056','#bfa388','#372923','#edb63c'],
 amber:['#cf812a','#efa744','#63352a','#ecd3a2'],
 crimson:['#191820','#383442','#0b0b11','#ec2922'],
 emerald:['#121e24','#326258','#0b1116','#44dda6'],
 chestnut:['#53362b','#a67b5f','#241a1c','#e1b894']
};
export function epicSpecimenCanvas(item){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=640;
 const c=canvas.getContext('2d'),kind=item.specimen;
 const [base,light,ink,accent]=palettes[kind]||palettes.owl;
 const longTail=kind==='emerald'||kind==='crimson';
 const fore=()=>{
  c.beginPath();c.moveTo(65,384);
  c.bezierCurveTo(120,185,280,38,582,33);
  c.bezierCurveTo(707,26,736,108,694,199);
  c.bezierCurveTo(699,264,671,313,630,336);
  c.bezierCurveTo(526,365,333,344,65,384);c.closePath();
 };
 const hind=()=>{
  c.beginPath();c.moveTo(65,384);
  c.bezierCurveTo(233,318,482,286,621,349);
  c.bezierCurveTo(682,377,698,399,652,438);
  c.bezierCurveTo(661,475,652,486,609,494);
  c.bezierCurveTo(644,538,621,612,longTail?565:601,longTail?635:534);
  c.bezierCurveTo(longTail?554:560,longTail?556:515,550,481);
  c.bezierCurveTo(507,521,492,529,456,496);
  c.bezierCurveTo(380,539,322,511,290,486);
  c.bezierCurveTo(209,496,124,451,65,384);c.closePath();
 };
 for(const [index,path] of [fore,hind].entries()){
  c.save();path();c.clip();
  const gradient=c.createLinearGradient(150,60,645,555);
  gradient.addColorStop(0,ink);gradient.addColorStop(.27,base);
  gradient.addColorStop(.65,light);gradient.addColorStop(1,ink);
  c.fillStyle=gradient;c.fillRect(0,0,768,640);
  for(let j=0;j<21;j++){
   const t=(j+.45)/21,x=index?280+350*t:180+490*t;
   const y=index?365+180*t:65+258*Math.pow(t,.8);
   c.globalAlpha=.3;c.strokeStyle=j%3===0?light:ink;c.lineWidth=j%4===0?2.9:1.5;
   c.beginPath();c.moveTo(73,381);c.bezierCurveTo(185,index?420:120,370,index?430:170,x,y);c.stroke();
   c.beginPath();c.moveTo(215+t*270,index?431:250);
   c.quadraticCurveTo(410+t*110,index?459:208,x,y);c.stroke();
  }
  c.globalAlpha=1;
  if(kind==='owl'||kind==='amber'){
   const spots=kind==='owl'?[[536,171,46],[485,428,48],[624,257,24]]:
    [[573,173,42],[499,424,52],[377,410,27]];
   for(const [x,y,r] of spots)for(const [s,color] of [
    [1.3,ink],[1.15,'#eed5a0'],[.91,base],[.72,'#2d3140'],
    [.53,accent],[.31,ink],[.13,'#f0ebeb']]){
    c.fillStyle=color;c.beginPath();c.ellipse(x,y,r*s,r*s*.83,-.12,0,7);c.fill();
   }
   for(let j=0;j<12;j++){c.strokeStyle=ink;c.lineWidth=3+(j%3);
    c.globalAlpha=.47;c.beginPath();c.moveTo(280+j*29,62);
    c.quadraticCurveTo(300+j*24,150,356+j*24,157);c.stroke();}
  }else if(kind==='crimson'){
   for(let j=0;j<36;j++){const x=317+(j%9)*41,y=345+Math.floor(j/9)*35;
    c.fillStyle=j%3===0?'#f94b38':accent;c.globalAlpha=.92;
    c.beginPath();c.ellipse(x,y,6+j%3*2,9+j%3*3,-.2,0,7);c.fill();}
   for(let j=0;j<8;j++){c.fillStyle='#d4d4d0';c.globalAlpha=.78;
    c.beginPath();c.ellipse(344+j*33,135+j%3*18,16,7,-.35,0,7);c.fill();}
  }else if(kind==='emerald'){
   for(let j=0;j<17;j++){c.save();c.translate(235+j%3*14,64+j*27);
    c.rotate(-.24);c.fillStyle=j%2?'#37b38d':'#58e5b8';c.globalAlpha=.87;
    c.fillRect(0,0,467-j*8,j%4===0?18:9);c.restore();}
   for(let j=0;j<12;j++){c.fillStyle='#d2ffed';c.globalAlpha=.8;
    c.beginPath();c.ellipse(293+j*27,476+j%3*8,15,7,-.2,0,7);c.fill();}
  }else{
   for(let j=0;j<17;j++){c.strokeStyle=j%2?light:ink;
    c.lineWidth=12+j%4*3;c.globalAlpha=.58;c.beginPath();
    c.moveTo(238+j*27,35);c.bezierCurveTo(314+j*7,189,345+j*17,324,284+j*24,552);c.stroke();}
   for(let j=0;j<13;j++){c.fillStyle='#e9ccb3';c.globalAlpha=.7;
    c.beginPath();c.ellipse(340+j*25,457+j%2*18,10,4,-.2,0,7);c.fill();}
  }
  c.restore();path();c.strokeStyle=ink;c.lineWidth=10;c.stroke();
  path();c.strokeStyle=accent;c.globalAlpha=.6;c.lineWidth=2;c.stroke();
  c.globalAlpha=1;
 }
 return canvas;
}
export function addEpicDust(T,root){
 const n=72*20,positions=new Float32Array(n*3),colors=new Float32Array(n*3),seeds=new Float32Array(n),
  palette=[0xf7d6a2,0xb6ffe9,0xffb5b7,0xc0d8ff,0xffffff],clock={value:0};
 for(let i=0;i<n;i++){const col=new T.Color(palette[i%5]);colors.set([col.r,col.g,col.b],i*3);seeds[i]=i;}
 const geo=new T.BufferGeometry();
 geo.setAttribute('position',new T.BufferAttribute(positions,3));
 geo.setAttribute('color',new T.BufferAttribute(colors,3));
 geo.setAttribute('dustSeed',new T.BufferAttribute(seeds,1));
 const material=new T.PointsMaterial({size:.035/10,transparent:true,opacity:.75,sizeAttenuation:true,vertexColors:true,depthWrite:false});
 // Twenty times the particles, but their trajectories run in the vertex shader.
 // Each frame updates one uniform rather than reallocating or uploading buffers.
 material.onBeforeCompile=shader=>{
  shader.uniforms.dustTime=clock;
  shader.vertexShader='uniform float dustTime; attribute float dustSeed;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
   float i=dustSeed;
   float t=fract(dustTime*(.14+mod(i,7.)*.013)+i*.61803398875);
   vec3 transformed=vec3((mod(i,2.)>0.?-1.:1.)*(.24+mod(i*29.,71.)/70.)+sin(dustTime*.92+i)*.1,.76-t*1.8+sin(dustTime*11.+i*.8)*.12,.03+mod(i*13.,29.)/130.);
  `);
 };
 material.customProgramCacheKey=()=> 'epic-fine-dust-v027';
 const dust=new T.Points(geo,material);dust.frustumCulled=false;root.add(dust);root.userData.epicDust=dust;dust.userData.clock=clock;
}
export function animateEpicDust(root,time){
 const dust=root?.userData?.epicDust;if(dust?.userData.clock)dust.userData.clock.value=time;
}
