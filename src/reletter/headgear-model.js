// Original stylized wearable sculptures, centered around the skull in local head space.
export function createHeadgear(T,item){const root=new T.Group();root.name=item.name;root.userData.headgear=item.id;const mats=[],mat=(color,metal=.1)=>{const m=new T.MeshStandardMaterial({color,roughness:.4,metalness:metal});mats.push(m);return m;},main=mat(item.color),white=mat('#f5eee2'),dark=mat('#24303d'),gold=mat('#e8bd65',.65),pink=mat('#e6aab6'),green=mat('#78ab73'),glass=new T.MeshStandardMaterial({color:'#c0edff',transparent:true,opacity:.2,roughness:.1,metalness:.2});mats.push(glass);
const mesh=(geo,p,scale=[1,1,1],m=main)=>{const o=new T.Mesh(geo,m);o.position.set(...p);o.scale.set(...scale);root.add(o);return o;},ball=(p,s,m=main)=>mesh(new T.SphereGeometry(1,20,14),p,s,m),box=(p,s,m=main)=>mesh(new T.BoxGeometry(1,1,1),p,s,m),cone=(p,r,h,m=main)=>mesh(new T.ConeGeometry(r,h,20),p,[1,1,1],m),tube=(pts,r=.06,m=main)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),24,r,7,false),[0,0,0],[1,1,1],m),ring=(p,r=.6,t=.045,m=main)=>mesh(new T.TorusGeometry(r,t,8,36),p,[1,1,1],m),eyes=(y=.15,z=.62)=>{for(const x of [-.24,.24]){ball([x,y,z],[.14,.17,.07],white);ball([x,y,z+.055],[.07,.11,.04],dark);}},cap=()=>mesh(new T.SphereGeometry(.69,24,16,0,Math.PI*2,0,Math.PI*.58),[0,.15,0]),wing=(side,y=.4)=>{for(let i=0;i<6;i++){const f=ball([side*(.55+i*.12),y+i*.1,-.05],[.13,.42-i*.04,.08],white);f.rotation.z=-side*(.4+i*.14);}},horn=(side,y=.5)=>tube([[side*.45,y,0],[side*.8,y+.35,0],[side*.8,y+.8,0],[side*.5,y+1,0]],.085,gold),mask=()=>ball([0,.05,.52],[.57,.68,.13]);
const d=item.design;
if(d==='hydra-dragon'){
 cap();const necks=[];const fire=mat('#ff9137');fire.emissive=new T.Color('#ff4420');fire.emissiveIntensity=.7;
 for(let n=0;n<3;n++){
  const base=new T.Group();base.position.set((n-1)*.38,.65,0);base.rotation.z=(1-n)*.37;root.add(base);let parent=base;const joints=[];
  for(let j=0;j<5;j++){const joint=new T.Group();joint.position.y=j?.31:0;parent.add(joint);joints.push(joint);const segment=ball([0,.15,0],[.13-j*.009,.22,.13-j*.009]);joint.add(segment);const spine=cone([0,.11,-.13],.055,.18,gold);spine.rotation.x=-Math.PI/2;joint.add(spine);parent=joint;}
  const skull=ball([0,.30,.10],[.23,.22,.27]);parent.add(skull);const snout=ball([0,.20,.34],[.16,.11,.24]);parent.add(snout);
  for(const side of [-1,1]){const eye=ball([side*.14,.34,.29],[.052,.058,.04],gold);parent.add(eye);const pupil=ball([side*.14,.34,.326],[.02,.04,.015],dark);parent.add(pupil);const horn=cone([side*.13,.57,-.02],.055,.26,white);horn.rotation.z=-side*.24;parent.add(horn);const tooth=cone([side*.09,.12,.43],.026,.10,white);tooth.rotation.z=Math.PI;parent.add(tooth);}
  const flame=cone([0,.16,.60],.09,.27,fire);flame.rotation.x=Math.PI/2;parent.add(flame);necks.push({joints,flame});
 }root.userData.hydraNecks=necks;
}else if(d==='ram-skull'){
 ball([0,.20,.55],[.51,.60,.20],white);box([0,-.34,.63],[.36,.28,.16],white);
 for(const side of [-1,1]){ball([side*.22,.23,.72],[.19,.22,.075],dark);tube([[side*.37,.58,.12],[side*.72,.82,.07],[side*.89,.53,.13],[side*.78,.13,.3],[side*.51,.02,.42]],.13,gold);for(let i=0;i<4;i++)box([side*(.045+i*.042),-.30,.73],[.025,.10,.025],dark);}
 cone([0,-.08,.76],.10,.16,dark).rotation.z=Math.PI;
}else if(['trump-mask','huang-mask','musk-mask'].includes(d)){
 // Continuous sculpted facial surface. Individual silhouettes and landmark
 // proportions replace the shared oval face and separate spherical cheeks.
 const trump=d==='trump-mask',huang=d==='huang-mask';
 const skin=mat(trump?'#dfa078':huang?'#c9a28b':'#dfb5a5',0);
 const hair=mat(trump?'#ddbd76':huang?'#b6b4b0':'#634b3f',0);
 const shading=mat(trump?'#b77c60':huang?'#a27a64':'#b58d7e',0);
 const lip=mat(trump?'#bd7f70':huang?'#946c62':'#ac7d72',0);
 const iris=mat(trump?'#7c9ba7':huang?'#35291f':'#68867f',0);
 const rows=trump?[
 [-.60,.02,.53],[-.52,.26,.63],[-.36,.43,.67],[-.15,.51,.66],[.04,.53,.62],[.24,.49,.58],[.46,.48,.53],[.65,.38,.45],[.76,.02,.41]
 ]:huang?[
 [-.59,.02,.48],[-.49,.19,.58],[-.30,.34,.63],[-.10,.45,.64],[.13,.48,.61],[.32,.45,.56],[.51,.44,.51],[.67,.31,.45],[.74,.02,.40]
 ]:[
 [-.61,.02,.53],[-.51,.29,.63],[-.33,.45,.65],[-.12,.46,.64],[.09,.49,.62],[.30,.47,.57],[.52,.44,.49],[.69,.30,.43],[.76,.02,.40]
 ];
 // Interpolate the independent facial landmark profiles for a smooth mask.
 const sample=(t)=>{const i=Math.min(rows.length-2,Math.floor(t)),f=t-i,a=rows[Math.max(0,i-1)],b=rows[i],c=rows[i+1],d=rows[Math.min(rows.length-1,i+2)];return b.map((v,k)=>.5*((2*v)+(-a[k]+c[k])*f+(2*a[k]-5*v+4*c[k]-d[k])*f*f+(-a[k]+3*v-3*c[k]+d[k])*f*f*f));};
 const positions=[],indices=[],colors=[],steps=80,vertical=(rows.length-1)*7;
 const baseTone=new T.Color(trump?'#dfa078':huang?'#c9a28b':'#dfb5a5');
 const warmTone=new T.Color(trump?'#cb8560':huang?'#b88d78':'#c99a90'),eyeTone=new T.Color(trump?'#e6c7b1':huang?'#ae877a':'#c2a199');
 for(let j=0;j<=vertical;j++){
  const [y,rawW,z]=sample(j/vertical*(rows.length-1)),w=Math.max(.014,rawW);
  for(let k=0;k<=steps;k++){
   const angle=-Math.PI/2+Math.PI*k/steps,x=w*Math.sin(angle);
   const eyeSocket=.045*Math.exp(-Math.pow((Math.abs(x)-.20)/.13,2)-Math.pow((y-.25)/.12,2));
   const cheek=(trump?.055:huang?.045:.025)*Math.exp(-Math.pow((Math.abs(x)-.32)/.16,2)-Math.pow((y-.03)/.18,2));
   const g=(cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
   const noseBridge=(trump?.075:huang?.10:.115)*g(0,.11,.095,.24);
   const noseTip=(trump?.105:huang?.065:.09)*g(0,-.035,.12,.095);
   const muzzle=(trump?.035:huang?.02:.055)*g(0,-.19,.23,.12);
   const chin=(trump?.06:huang?.035:.07)*g(0,-.43,.25,.13);
   positions.push(x,y,.22+(z-.22)*Math.cos(angle)+cheek-eyeSocket+noseBridge+noseTip+muzzle+chin);
   const tone=baseTone.clone().lerp(warmTone,Math.min(.65,.5*g(Math.sign(x)*.33,-.04,.17,.21)+.22*g(0,-.04,.14,.13))).lerp(eyeTone,.52*g(Math.sign(x)*.20,.24,.18,.105));
   const grain=.006*Math.sin(x*520+y*113)*Math.cos(y*421-x*73);tone.multiplyScalar(1+grain);
   colors.push(tone.r,tone.g,tone.b);
   if(j&&k){const i=j*(steps+1)+k;indices.push(i-steps-2,i-steps-1,i,i-steps-2,i,i-1);}
  }
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
 const faceMat=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.83,metalness:0,side:T.DoubleSide});mats.push(faceMat);mesh(geo,[0,0,0],[1,1,1],faceMat);
 const eyeY=huang?.25:trump?.25:.29,eyeZ=huang?.59:trump?.59:.60,eyeW=huang?.115:trump?.115:.122,eyeH=huang?.029:trump?.032:.047;
 for(const side of [-1,1]){
  const x=side*(huang?.205:.20);
  ball([side*(trump?.52:huang?.46:.49),.10,.29],[.08,.15,.10],skin);
  ball([x,eyeY,eyeZ],[eyeW,eyeH,.026],white);
  ball([x,eyeY,eyeZ+.028],[.037,.036,.015],iris);
  ball([x,eyeY,eyeZ+.042],[.018,.019,.009],dark);
  tube([[x-eyeW,eyeY,eyeZ],[x,eyeY+eyeH,eyeZ+.024],[x+eyeW,eyeY,eyeZ]],.014,shading);
  const brow=ball([x,eyeY+.105,.59],[eyeW+.02,trump?.022:huang?.014:.028,.021],hair);
  brow.rotation.z=side*(huang?.10:trump?-.07:.16);
  tube([[side*.09,.04,.69],[side*.20,-.08,.65],[side*.25,-.20,.59]],.012,shading);
  if(trump||huang){
   tube([[x-.10,eyeY-.075,.60],[x,eyeY-.09,.61],[x+.10,eyeY-.065,.60]],.009,shading);
   for(let k=0;k<3;k++)tube([[side*.30,eyeY-.035-k*.024,.57],[side*.36,eyeY-.035-k*.035,.53],[side*.40,eyeY-.07-k*.025,.48]],.0045,shading);
  }
  for(let k=0;k<9;k++){const dx=(k-4)*.022;const y=eyeY+.105+Math.sin(k/8*Math.PI)*.014;tube([[x+dx,y-.012,.607],[x+dx+side*.013,y+.009,.615]],.0035,hair);}
  const upper=eyeH*(huang?.76:.95);tube([[x-eyeW,eyeY,eyeZ],[x-eyeW*.45,eyeY+upper,eyeZ+.023],[x+eyeW*.42,eyeY+upper,eyeZ+.023],[x+eyeW,eyeY,eyeZ]],.007,shading);
 }
 const nose=ball([0,huang?.10:.08,.64],[huang?.065:trump?.080:.077,huang?.17:trump?.14:.19,huang?.09:.12],skin);
 if(!trump&&!huang)nose.rotation.z=-.055;
 ball([0,-.035,.745],[trump?.105:huang?.075:.086,.055,.075],skin);
 for(const side of [-1,1])ball([side*.075,-.06,.745],[.035,.016,.021],shading);
 const mouthY=trump?-.23:huang?-.17:-.19,mouthW=trump?.135:huang?.185:.205;
 tube([[-mouthW,mouthY,.64],[0,mouthY+(trump?-.022:.015),.73],[mouthW,mouthY,.64]],.023,lip);
 tube([[-mouthW*.93,mouthY-.008,.65],[0,mouthY+(trump?-.027:.01),.747],[mouthW*.93,mouthY-.008,.65]],.009,dark);
 // Distinct age and expression details: Trump pursed lips and heavy jowls,
 // Huang smiling cheek folds and angular temples, Musk fuller lower lip.
 const wrinkle=mat(trump?'#bb876a':huang?'#ac8570':'#bc9287',0);
 if(trump||huang){
  for(let k=0;k<(trump?3:2);k++){const yy=.44+k*.046;tube([[-.27,yy,.51],[-.12,yy+.015,.57],[.12,yy+.015,.57],[.27,yy,.51]],.0045,wrinkle);}
  for(const side of [-1,1])tube([[side*.22,-.12,.65],[side*.28,-.25,.60],[side*.25,-.36,.58]],.008,wrinkle);
 }
 if(!trump&&!huang){ball([0,mouthY-.042,.70],[.11,.024,.034],lip);for(const side of [-1,1])tube([[side*.17,mouthY,.65],[side*.23,mouthY+.016,.61]],.006,wrinkle);}
 if(trump){
  const sweep=ball([-.06,.68,.39],[.55,.21,.27],hair);sweep.rotation.z=.25;
  const highlight=mat('#f2d898',0),lowlight=mat('#bc9858',0);for(let i=0;i<25;i++)tube([[-.46,.49+i*.013,.45],[-.14,.77+i*.004,.65],[.40,.63+i*.004,.53]],.014,i%5===0?lowlight:i%3===0?highlight:hair);
  for(const side of [-1,1])ball([side*.44,.43,.27],[.10,.20,.19],hair);
 }else if(huang){
  ball([0,.66,.34],[.45,.16,.23],hair);
  for(const side of [-1,1]){
   const silver=mat('#dedbd5',0);for(let i=0;i<15;i++)tube([[side*.43,.33+i*.018,.29],[side*.33,.54+i*.012,.43],[side*.10,.73,.42]],.011,i%3===0?silver:hair);
   const frame=new T.Shape();frame.moveTo(-.15,-.075);frame.quadraticCurveTo(-.16,.09,-.10,.09);frame.lineTo(.10,.09);frame.quadraticCurveTo(.16,.09,.15,-.075);frame.quadraticCurveTo(0,-.115,-.15,-.075);
   const pts=frame.getPoints(18).map(v=>[side*.205+v.x,eyeY+v.y,.69]);pts.push(pts[0]);tube(pts,.018,dark);
   box([side*.40,eyeY,.46],[.028,.027,.42],dark);
  }
  box([0,eyeY+.025,.69],[.11,.022,.027],dark);
 }else{
  ball([0,.66,.32],[.45,.20,.25],hair);
  const lighter=mat('#826657',0);for(let i=0;i<19;i++)tube([[-.39+i*.040,.51,.45],[-.24+i*.040,.78,.55],[.06+i*.031,.67,.44]],.015,i%4===0?lighter:hair);
  for(const side of [-1,1])ball([side*.43,.48,.27],[.08,.16,.17],hair);
 }
 // Thin rear straps make the piece visibly a wearable mask, not a second head.
 const strap=mat('#39333a',0);tube([[-.45,.12,.24],[-.54,.11,-.05],[0,.11,-.40],[.54,.11,-.05],[.45,.12,.24]],.032,strap);

}
else if(['elephant','rooster','anteater','guinea-pig','penguin','polar-bear','lion','eggplant'].includes(d)){
 cap();
 if(d==='elephant'){
  for(const side of [-1,1]){ball([side*.69,.36,.08],[.44,.58,.13]);ball([side*.72,.35,.22],[.28,.39,.055],pink);}
  eyes(.27,.62);
  tube([[0,.15,.63],[0,-.14,.89],[.10,-.47,1.03],[.25,-.50,1.03]],.16);
  for(const side of [-1,1]){const tusk=cone([side*.32,-.18,.84],.07,.28,white);tusk.rotation.x=Math.PI/2;}
 }else if(d==='rooster'){
  for(let i=0;i<5;i++)ball([0,.76+i*.13,-.29+i*.11],[.20,.24,.12],i%2?pink:main);
  eyes(.25,.65);const beak=cone([0,.05,.79],.19,.35,gold);beak.rotation.x=Math.PI/2;
  ball([0,-.22,.73],[.14,.17,.12],pink);
 }else if(d==='anteater'){
  ball([0,.20,.66],[.40,.27,.42]);const snout=cone([0,-.14,.99],.22,.83);
  snout.rotation.x=Math.PI/2;ball([0,-.17,1.31],[.12,.09,.10],dark);
  for(const side of [-1,1]){ball([side*.46,.72,0],[.16,.35,.13]);ball([side*.33,.27,.69],[.08,.09,.04],dark);}
 }else if(d==='guinea-pig'){
  ball([0,.23,.50],[.60,.48,.40],white);for(const side of [-1,1]){ball([side*.43,.68,.12],[.23,.26,.12],pink);ball([side*.23,.25,.85],[.10,.12,.04],dark);}
  ball([0,.05,.92],[.12,.09,.07],pink);for(const side of [-1,1])ball([side*.15,-.10,.85],[.08,.05,.04],white);
 }else if(d==='penguin'){
  ball([0,.19,.55],[.47,.55,.22],white);for(const side of [-1,1]){ball([side*.24,.26,.75],[.08,.10,.04],dark);ball([side*.60,.1,0],[.15,.3,.12]);}
  const beak=cone([0,.01,.82],.13,.25,gold);beak.rotation.x=Math.PI/2;
 }else if(d==='polar-bear'){
  for(const side of [-1,1]){ball([side*.49,.68,0],[.24,.25,.14]);ball([side*.49,.68,.13],[.13,.13,.025],pink);}
  ball([0,.03,.58],[.32,.25,.22],white);eyes(.28,.60);ball([0,.04,.82],[.13,.11,.09],dark);
 }else if(d==='lion'){
  for(let i=0;i<14;i++){const a=i*Math.PI*2/14;ball([Math.sin(a)*.61,.25+Math.cos(a)*.55,-.10],[.25,.31,.23],i%2?gold:main);}
  for(const side of [-1,1]){ball([side*.42,.66,.16],[.20,.20,.13],gold);ball([side*.20,.21,.68],[.085,.11,.035],dark);}
  ball([0,.02,.73],[.30,.22,.23],white);ball([0,.11,.92],[.12,.10,.08],dark);
 }else if(d==='eggplant'){
  ball([0,.40,0],[.53,.79,.50]);for(let i=0;i<5;i++){const a=i*6.283/5;const leaf=cone([Math.cos(a)*.35,1.12,Math.sin(a)*.35],.26,.36,green);leaf.rotation.z=-Math.cos(a)*.6;}
  tube([[0,1.2,0],[0,1.55,0],[.25,1.72,0]],.12,green);eyes(.23,.52);
 }
}
else if(['dinosaur','shark','dragon'].includes(d)){cap();ball([0,.25,.65],[.53,.3,.55]);eyes(.45,.8);for(let i=0;i<7;i++){cone([0,.7+i*.05,-.55+i*.19],.13,.3,d==='dragon'?gold:green);if(i<5)for(const side of [-1,1]){const tooth=cone([side*.43,.06,.3+i*.18],.07,.18,white);tooth.rotation.z=Math.PI;}}if(d==='dragon'){horn(-1);horn(1);}if(d==='shark'){const fin=cone([0,.97,-.1],.25,.65);fin.scale.z=.25;}}
else if(d==='poop'){for(let i=0;i<4;i++)ball([Math.sin(i)*.08,.55+i*.2,0],[.62-i*.12,.22,.5-i*.09]);cone([.04,1.35,0],.18,.4);eyes(.62,.45);}
else if(d==='angel'||d==='bat'){for(const side of [-1,1]){wing(side);if(d==='bat')root.children.slice(-6).forEach(o=>o.material=main);}if(d==='angel'){const halo=ring([0,1.15,0],.45,.045,gold);halo.rotation.x=Math.PI/2;}}
else if(d==='hockey'){mask();for(const side of [-1,1]){ball([side*.22,.23,.66],[.12,.08,.025],dark);for(let j=0;j<5;j++)ball([side*(.12+(j%2)*.15),-.03-Math.floor(j/2)*.16,.66],[.035,.035,.02],dark);}tube([[-.4,.43,.64],[0,.29,.68],[.4,.43,.64]],.035,main);}
else if(d==='hero'){cap();mask();for(const side of [-1,1])ball([side*.25,.17,.67],[.23,.28,.1],pink);box([0,.18,.7],[.07,1,.08],gold);for(const side of [-1,1])tube([[side*.12,.65,0],[side*.23,1.12,.08]],.035,dark);}
else if(['cat','bear','fox','frog','bunny'].includes(d)){cap();for(const side of [-1,1]){if(d==='frog')ball([side*.4,.73,.2],[.28,.25,.23],main);else if(d==='bear')ball([side*.5,.72,0],[.24,.25,.14]);else if(d==='bunny'){ball([side*.25,1.05,0],[.18,.65,.13]);ball([side*.25,1.08,.11],[.09,.48,.04],pink);}else{cone([side*.48,.85,0],.25,.5);cone([side*.48,.85,.11],.13,.35,pink);}}eyes(d==='frog'?.77:.22,d==='frog'?.4:.63);if(d==='fox')ball([0,-.08,.65],[.3,.2,.25],white);ball([0,.03,.79],[.08,.065,.05],dark);}
else if(d==='squid'||d==='jelly'||d==='jellyfish'){ball([0,.65,0],[.65,d==='squid'?.8:.4,.6]);for(let i=0;i<8;i++){const a=i*Math.PI/4;tube([[Math.cos(a)*.55,.45,Math.sin(a)*.55],[Math.cos(a)*.75,-.05,Math.sin(a)*.75],[Math.cos(a+.4)*.6,-.4,Math.sin(a+.4)*.6]],.045);}if(d==='squid')eyes(.6,.6);}
else if(d==='cactus'||d==='flower'||d==='lotus'){if(d==='cactus'){box([0,.55,0],[.75,.4,.65],gold);ball([0,1.08,0],[.22,.55,.23],green);for(const side of [-1,1])tube([[0,.95,0],[side*.36,.95,0],[side*.4,1.25,0]],.1,green);for(let i=0;i<16;i++)cone([Math.sin(i*2.4)*.22,.75+i*.035,Math.cos(i*2.4)*.23],.02,.12,white);}else{const n=d==='lotus'?12:16;for(let i=0;i<n;i++){const a=i*6.283/n,p=ball([Math.cos(a)*.52,.6+(d==='lotus'?Math.sin(a)*.15:Math.sin(a)*.5),d==='lotus'?Math.sin(a)*.52:.25],[.2,.38,.1]);p.rotation.z=-a;}ball([0,.6,.3],[.31,.31,.2],gold);}}
else if(d==='teapot'){ball([0,.7,0],[.6,.44,.5]);ball([0,1.12,0],[.45,.08,.4],white);ball([0,1.25,0],[.08,.1,.08],gold);tube([[-.4,.65,0],[-.85,.72,0],[-1,.98,0]],.14);ring([.62,.7,0],.3,.07,gold);}
else if(d==='crown'||d==='samurai'){const band=ring([0,.5,0],.62,.1,gold);band.rotation.x=Math.PI/2;for(let i=0;i<7;i++){const a=i*6.283/7;cone([Math.cos(a)*.58,.78,Math.sin(a)*.58],.14,.5,gold);ball([Math.cos(a)*.58,.62,Math.sin(a)*.58],[.08,.1,.07],pink);}if(d==='samurai'){cap();horn(-1,.6);horn(1,.6);}}
else if(d==='pumpkin'){for(let i=0;i<8;i++){const a=i*6.283/8;ball([Math.cos(a)*.25,.15,Math.sin(a)*.25],[.45,.65,.45]);}eyes(.3,.65);box([0,-.1,.68],[.5,.13,.05],dark);tube([[0,.75,0],[.04,1.05,0],[.2,1.1,0]],.09,green);}
else if(d==='mushroom'){ball([0,.55,0],[.28,.35,.25],white);ball([0,.95,0],[.85,.32,.75]);for(let i=0;i<12;i++){const a=i*2.4,r=.2+i%3*.18;ball([Math.cos(a)*r,1.19-r*.13,Math.sin(a)*r],[.09,.03,.09],white);}}
else if(d==='ghost'){ball([0,.24,0],[.7,.8,.62],white);eyes(.35,.59);ball([0,-.1,.65],[.14,.2,.05],dark);for(const side of [-1,1])tube([[side*.55,.3,0],[side*.9,.4,.1],[side*1,.6,.1]],.12,white);}
else if(d==='crab'||d==='crab-claw'){ball([0,.7,0],[.7,.25,.5]);for(const side of [-1,1]){for(let i=0;i<3;i++)tube([[side*.5,.7,(i-1)*.3],[side*.85,.6,(i-1)*.4]],.04);tube([[side*.5,.7,.3],[side*.9,1,.5]],.09);for(const k of [-1,1])tube([[side*.9,1,.5],[side*(.9+k*.15),1.3,.5],[side*.9,1.4,.5]],.06);}eyes(.82,.49);}
else if(d==='snail'){ball([0,.7,0],[.6,.6,.38]);const pts=[];for(let i=0;i<80;i++){const a=i*.17,r=.03+i*.006;pts.push([Math.cos(a)*r,.7+Math.sin(a)*r,.38]);}tube(pts,.035,gold);for(const side of [-1,1]){tube([[side*.3,.45,.3],[side*.4,.85,.7]],.04);ball([side*.4,.85,.7],[.08,.08,.08],dark);}}
else if(d==='ufo'||d==='saturn'){ball([0,.8,0],d==='ufo'?[.5,.25,.5]:[.45,.45,.45],d==='ufo'?glass:main);const r=ring([0,.72,0],.85,.12,gold);r.rotation.x=d==='ufo'?Math.PI/2:1.1;for(let i=0;i<10;i++){const a=i*.628;ball([Math.sin(a)*.85,.72,Math.cos(a)*.85],[.055,.055,.055],pink);}}
else if(['toaster','tv','dice','book','clock'].includes(d)){box([0,.25,0],[1.25,1.15,.95]);if(d==='tv'){box([0,.25,.5],[1,.8,.08],glass);for(const side of [-1,1])tube([[0,.8,0],[side*.4,1.3,0]],.025,dark);}if(d==='toaster'){for(const z of [-.2,.2]){box([0,.86,z],[.85,.08,.12],dark);box([0,1.03,z],[.7,.35,.11],white);}}if(d==='dice'){for(const [x,y] of [[-.35,.55],[.35,.55],[0,.25],[-.35,-.05],[.35,-.05]])ball([x,y,.49],[.085,.085,.025],dark);}if(d==='book'){box([0,.25,.5],[.95,.95,.04],gold);for(let i=0;i<7;i++)box([0,.55-i*.1,.53],[.68,.018,.02],white);}if(d==='clock'){const dial=ring([0,.25,.5],.43,.04,gold);ball([0,.25,.5],[.4,.4,.03],white);tube([[0,.55,.55],[0,.25,.55],[.22,.15,.55]],.025,dark);}}
else if(d==='ramen'||d==='sushi'){if(d==='ramen'){ball([0,.6,0],[.65,.3,.6]);ball([0,.8,0],[.61,.04,.56],gold);for(let i=0;i<6;i++)tube([[-.4+i*.14,.85,-.35],[-.3+i*.12,.88,0],[-.4+i*.14,.85,.35]],.025,white);tube([[-.65,.9,-.3],[.65,1.1,.3]],.025,dark);}else{box([0,.68,0],[1.2,.45,.75],white);box([0,.95,0],[1.3,.15,.8]);for(let i=0;i<6;i++)box([-.5+i*.2,1.035,0],[.025,.015,.8],white);}}
else if(d==='windmill'){cap();tube([[0,.6,0],[0,1.15,0]],.035,gold);for(let i=0;i<4;i++){const a=i*Math.PI/2,b=box([Math.cos(a)*.25,1.15+Math.sin(a)*.25,.05],[.42,.12,.08],i%2?pink:white);b.rotation.z=a;}ball([0,1.15,.1],[.08,.08,.06],gold);}
else if(d==='lantern'){box([0,.8,0],[.8,.75,.65],gold);box([0,.8,.34],[.58,.54,.04],white);cone([0,1.3,0],.65,.3,dark);ring([0,1.6,0],.15,.03,gold);}
else if(d==='bee'){cap();for(let i=0;i<3;i++)tube([[-.5,.2+i*.18,.4],[0,.3+i*.18,.64],[.5,.2+i*.18,.4]],.065,dark);for(const side of [-1,1]){wing(side);tube([[side*.2,.7,0],[side*.3,1,.15]],.03,dark);ball([side*.3,1,.15],[.09,.09,.09],gold);}}
else if(d==='antler'||d==='ram'||d==='unicorn'){cap();if(d==='unicorn')cone([0,1.1,.1],.18,1,gold);else for(const side of [-1,1]){if(d==='ram'){const pts=[];for(let i=0;i<40;i++){const a=i*.13,r=.38-i*.006;pts.push([side*(.65+Math.cos(a)*r),.45+Math.sin(a)*r,0]);}tube(pts,.09,gold);}else{horn(side);for(let i=0;i<3;i++)tube([[side*.75,.7+i*.18,0],[side*(1+i*.1),.85+i*.18,0]],.045,gold);}}}
else if(d==='astronaut'||d==='diver'){ball([0,.2,0],[.78,.8,.78],d==='astronaut'?glass:main);const r=ring([0,.2,.69],.47,.1,d==='diver'?gold:white);if(d==='diver'){ball([0,.2,.7],[.4,.4,.08],glass);for(let i=-1;i<=1;i++)tube([[i*.2,-.1,.78],[i*.2,.5,.78]],.025,dark);}else for(const side of [-1,1])ball([side*.77,.2,0],[.12,.24,.24],white);}
else if(d==='plague'){mask();const beak=cone([0,.05,.95],.24,.9,white);beak.rotation.x=Math.PI/2;for(const side of [-1,1]){const eye=ring([side*.23,.3,.67],.16,.04,gold);ball([side*.23,.3,.67],[.13,.13,.025],dark);}}
else if(d==='wizard'){const brim=ring([0,.55,0],.72,.18);brim.rotation.x=Math.PI/2;cone([0,1.1,0],.59,1.3);for(let i=0;i<8;i++)ball([Math.sin(i)*.35,.8+i*.07,Math.cos(i)*.35],[.04,.04,.02],gold);}
else if(d==='knight'){cap();box([0,.1,.6],[1,.7,.12]);for(let i=0;i<7;i++)box([-.36+i*.12,.1,.67],[.05,.4,.02],dark);tube([[0,.8,-.45],[0,1,.1],[0,.85,.5]],.12,pink);}
else if(d==='jester'){cap();for(let i=-1;i<=1;i++){tube([[i*.3,.6,0],[i*.6,1.3,0],[i*.8,.95,.1]],.16,i%2?pink:main);ball([i*.8,.95,.1],[.12,.12,.12],gold);}}
else if(d==='pirate'){const brim=ball([0,.55,0],[.95,.18,.6]);cap();ball([0,.65,.58],[.16,.17,.04],white);for(const side of [-1,1])ball([side*.065,.69,.62],[.04,.05,.02],dark);}
else if(d==='banana'||d==='banana-bunch'){for(let i=0;i<4;i++){const a=i*1.57;tube([[0,.7,0],[Math.cos(a)*.5,.5,Math.sin(a)*.5],[Math.cos(a)*.8,.1,Math.sin(a)*.8]],.13);}cone([0,1,0],.17,.7,white);}
else if(d==='cloud'){for(let i=0;i<7;i++)ball([Math.sin(i*2.4)*.5,.65+i%2*.15,Math.cos(i*2.4)*.35],[.38,.3,.32],white);for(let i=0;i<5;i++)ball([-.5+i*.25,.16,0],[.04,.13,.04],glass);}
root.userData.materials=mats;return root;}
export function disposeHeadgear(root){const geo=new Set(),mat=new Set(root.userData.materials||[]);root.traverse(o=>{if(o.geometry)geo.add(o.geometry);if(o.material)mat.add(o.material);});root.removeFromParent();geo.forEach(g=>g.dispose());mat.forEach(m=>m.dispose());}
export function attachHeadgear(T,model,item){let head=null,top=null;model.traverse(o=>{if(o.isBone&&/Head$/i.test(o.name))head=o;if(o.isBone&&/HeadTop/i.test(o.name))top=o;});if(!head)return null;model.updateMatrixWorld(true);const scale=head.getWorldScale(new T.Vector3()),height=top?head.getWorldPosition(new T.Vector3()).distanceTo(top.getWorldPosition(new T.Vector3())):.28,root=createHeadgear(T,item);head.add(root);const portraitMask=['trump-mask','huang-mask','musk-mask'].includes(item.design),safe=v=>Math.max(.00001,Math.abs(v));root.position.set(0,height*(portraitMask?.35:.48)/safe(scale.y),height*(portraitMask?.25:.12)/safe(scale.z));root.scale.set(height/safe(scale.x),height/safe(scale.y),height/safe(scale.z));root.userData.anchor=head.name;return root;}

// Reuse articulated neck groups; no geometry allocation on animation frames.
export function animateHeadgear(root,time,moving=false){
 for(const [n,neck] of (root?.userData?.hydraNecks||[]).entries()){
  for(const [j,joint] of neck.joints.entries()){
   joint.rotation.z=Math.sin(time*(moving?5:2.1)-j*.63+n*1.7)*(.10+j*.028)*(moving?1.7:1);
   joint.rotation.x=Math.sin(time*2.8-j*.7+n)*.11;
  }
  neck.flame.scale.setScalar(.74+.25*Math.sin(time*12+n*2));
 }
}
