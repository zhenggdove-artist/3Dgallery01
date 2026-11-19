// A true articulated rubber rod: GPU-skinned tube and spring-damped segments.
// The same asset is used by the hand-held toy and its airborne boomerang.
export function createFlexibleGiraffe(T){
 const root=new T.Group();root.name='Flexible spotted giraffe rubber baton';
 const segments=10,low=-.18,spacing=.245,length=spacing*(segments-1);
 const bones=[];
 for(let i=0;i<segments;i++){
  const bone=new T.Bone();bone.name='Giraffe flexible joint '+i;
  bone.position.y=i?spacing:low;
  if(i)bones[i-1].add(bone);bones.push(bone);
 }
 const geo=new T.CylinderGeometry(.095,.155,length,14,54,true);
 geo.translate(0,low+length*.5,0);
 const skin=[],weights=[],verts=geo.attributes.position;
 for(let i=0;i<verts.count;i++){
  const travel=Math.max(0,Math.min(segments-1,(verts.getY(i)-low)/spacing));
  const first=Math.min(segments-2,Math.floor(travel)),fraction=travel-first;
  skin.push(first,first+1,0,0);weights.push(1-fraction,fraction,0,0);
 }
 geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(skin,4));
 geo.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 const skinMesh=new T.SkinnedMesh(geo,new T.MeshStandardMaterial({
  color:'#e2b84f',roughness:.82,metalness:0,side:T.DoubleSide
 }));
 skinMesh.name='Rubber giraffe body (skinned, non-rigid)';
 skinMesh.add(bones[0]);skinMesh.bind(new T.Skeleton(bones));skinMesh.frustumCulled=false;
 root.add(skinMesh);
 // The spots, ears and head are fastened to the underlying flexible joints.
 const spots=new T.MeshStandardMaterial({color:'#85502b',roughness:.88});
 const skinMat=new T.MeshStandardMaterial({color:'#efce6a',roughness:.8});
 const dark=new T.MeshStandardMaterial({color:'#302437',roughness:.8});
 const spotGeo=new T.SphereGeometry(1,9,7),headGeo=new T.SphereGeometry(1,14,10);
 for(let i=1;i<segments-1;i++){
  const bone=bones[i],theta=i*2.399963;
  for(let j=0;j<2;j++){
   const a=theta+j*Math.PI,r=.12-(i/segments)*.02;
   const dot=new T.Mesh(spotGeo,spots);
   dot.scale.set(.046,.083,.018);
   dot.position.set(Math.cos(a)*r,.08+j*.09,Math.sin(a)*r);
   dot.rotation.y=-a;bone.add(dot);
  }
 }
 const tip=bones[segments-1],head=new T.Mesh(headGeo,skinMat);
 head.name='Soft giraffe head';head.scale.set(.18,.20,.17);
 head.position.set(0,.18,0);tip.add(head);
 for(const side of [-1,1]){
  const ear=new T.Mesh(spotGeo,skinMat);ear.scale.set(.07,.13,.065);
  ear.position.set(side*.13,.35,0);ear.rotation.z=-side*.27;tip.add(ear);
  const eye=new T.Mesh(spotGeo,dark);eye.scale.set(.027,.036,.018);
  eye.position.set(side*.085,.20,.153);tip.add(eye);
 }
 const nose=new T.Mesh(spotGeo,skinMat);
 nose.position.set(0,.11,.13);nose.scale.set(.13,.085,.12);tip.add(nose);
 const base=new T.Mesh(spotGeo,skinMat);
 base.scale.set(.17,.16,.15);base.position.y=low;root.add(base);
 root.userData.flexBones=bones;
 root.userData.flexState={
  angleX:new Float32Array(segments),velocityX:new Float32Array(segments),
  angleZ:new Float32Array(segments),velocityZ:new Float32Array(segments),
  lastTime:null
 };
 root.userData.reach=length+.48;
 return root;
}
export function animateFlexibleGiraffe(root,time,strength=0,airborne=false){
 const bones=root?.userData?.flexBones,state=root?.userData?.flexState;
 if(!bones||!state)return;
 const elapsed=state.lastTime===null?1/60:Math.max(1/240,Math.min(.055,time-state.lastTime));
 state.lastTime=time;
 const impulse=Math.max(0,Math.min(1,Number(strength)||0)),power=airborne?.53:.10+impulse*.37;
 for(let i=1;i<bones.length;i++){
  const travel=i/(bones.length-1);
  // Segment-wise phase delay creates lag; a critically damped elastic
  // response lets the torso and head continue moving after each reversal.
  const wave=time*(airborne?18:12)-travel*(airborne?5.1:3.9);
  const targetZ=Math.sin(wave)*power*(.40+travel*.7)+
   Math.sin(time*7-travel*9)*power*.23;
  const targetX=Math.cos(wave*.77+travel*2.4)*power*.56;
  const spring=airborne?135:110,damping=airborne?15:17;
  state.velocityZ[i]+=(targetZ-state.angleZ[i])*spring*elapsed;
  state.velocityX[i]+=(targetX-state.angleX[i])*spring*elapsed;
  const drag=Math.exp(-damping*elapsed);
  state.velocityZ[i]*=drag;state.velocityX[i]*=drag;
  state.angleZ[i]+=state.velocityZ[i]*elapsed;
  state.angleX[i]+=state.velocityX[i]*elapsed;
  bones[i].rotation.set(state.angleX[i],0,state.angleZ[i]);
 }
}
