// Landmark-warped facial albedo from the three supplied reference photographs.
const PORTRAIT_REFERENCE=Object.freeze({"huang-mask":"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","kim-mask":"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABcQERQRDhcUEhQaGBcbIjklIh8fIkYyNSk5UkhXVVFIUE5bZoNvW2F8Yk5QcptzfIeLkpSSWG2grJ+OqoOPko3/2wBDARgaGiIeIkMlJUONXlBejY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY3/wAARCABwAFgDASIAAhEBAxEB/8QAGgAAAgMBAQAAAAAAAAAAAAAAAwQAAQIFBv/EAC0QAAEEAQMCBQMEAwAAAAAAAAEAAgMRIQQSMSJBBRNRYXEjMoEGFFKhYnLh/8QAFwEBAQEBAAAAAAAAAAAAAAAAAQIAA//EABsRAQEBAQEBAQEAAAAAAAAAAAABEQIxIWFx/9oADAMBAAIRAxEAPwDjxStaCHMBCy42cLUZa01S24F+Nte6iL69ZghklPT2Kd0+hldIAW9+U14ZEBF7rpsaAVNqpGdLo2xMN5W36UE4qkdvC0toJy6RpaT37Lh6yExniqXpykNXA2W8BbTjzJftwFkkHuAnNZoi2y0UueGG67qvU2YJ01zaiojaKIURjGvEIxDq3AUM3tHZSJ28jK6H6g0wZJFKKtwo49Fy9PZcBSnjreV9T67uh+xOA5S2jbTBhNhu5F9aNseOLW7WGx1wFdFIU91ILjaOWWEJzaRTCmoiD43WOQuA9uyR3oF6SYdBXB1oAcb5VcjopI7caUUhidPMyNv3PcAPyotepGk+PU+MQCVkTTd7if6/6k9PoGMO45KaOs/dhpIA29qWsluFy4lkxX9WOkdItQv1NfTjjPy5KTSSRHDSUu/XaxrAWMZk1Rsn+lcFdWPUSV9Ru13oDaL5+OFzopJXP2yt6gLscH8pzyz5e5Oti5NS8DoZuPpay2Wci3w0P9glJppGPDI22459ktH4jqpGOJYKbigclZsdJzt3Ir5SWo0LJjfBWodQZuxBTI4yp1WA+E+HsZrmyHJY0kfPCiYh1DdM90hbfTSi5dS2pst8JxtDDhOxEUEtQwRWBR+bRGuXVd+mnMbI3sgHT5wiMJRwQBZVYgFkQjZVZR6HkIBeZJDt4HKNuAhIu1mBewPZjBQvJLj1Z+VsPLZNrhzkH1RScLFgNYwVQQ5PZU8m+VguRWAkG80eKUWw23l3aqUQvcamIMhDRtrnFZVsGEHfueXHkkkozThafoooNLRcSKQxlZkkEbSSaVJVLFJnyn7bGfZC2akN8veSQPuPKwJtROPosDR/m7aT8KidY0lnkzWM3usJwmYWSuoynIGPdH3GkjHrXNcGTxujd/I8FNtO4WEBl5Q3FFchOU0oxzdwDwCPi1EJzlEbWwEPoo7X4SuVoOpJOiTCogONn8Jdsg7lHje090pVJfYIYkfwQmg5vsVAW+gSdCY0EZC2Ojjhbc9lYAS75QigRz0Jz0J0l8LFkoLe7KixRUQVgKbVLCu0hhwrhU15aURSgllicq/PKzTVNrUBHTEoduce6JTVMLFQar2q7VWsy1FVqLM//9k=","putin-mask":"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABcQERQRDhcUEhQaGBcbIjklIh8fIkYyNSk5UkhXVVFIUE5bZoNvW2F8Yk5QcptzfIeLkpSSWG2grJ+OqoOPko3/2wBDARgaGiIeIkMlJUONXlBejY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY3/wAARCABwAFgDASIAAhEBAxEB/8QAGgAAAgMBAQAAAAAAAAAAAAAAAwQAAgUBBv/EAC0QAAICAQMDAgYBBQEAAAAAAAECABEDEiExBEFRYXEFEyIyQoGRUqGxweHw/8QAGQEBAQEBAQEAAAAAAAAAAAAAAAECBAMF/8QAGxEBAQEBAQEBAQAAAAAAAAAAAAERAgMhEjH/2gAMAwEAAhEDEQA/ANi4p1PU6EpeSahuoyjFhJJAJ4uZLZNeQt92+1TDUHGTQO5MLjJeorhx5MpsKfeauHBoUXzMvRVQSNzCBdtp0rXrIOIEKwOQFd6hiN5BjLDeVMJ/NokjnwZj/FenVGHUJsMjUV8Gb2bpW02ouKtgXIGx9Qv0kfuenn3+ax3zsecAkhMuJsGQ43Ugg+ZJ9OfZrivytrrS2bOydgah8fTqgGNQKA3PmUQfOylyKF3GA1Ez5Fd8FTSq0BUurxYNvOh6PJmNemG9XpOXvBB/1+xJr34Ne00gwqWBgBk8An2FzvzDXiNMH1bwHUi1sCyO0gf/AMZxnuwe8amMn4tgV8AypZKAH3B/7JHM+O0KGvrUpZHmSdnl65zjm9ONug4W0Y7AuzDbtAYRsqeDDlgu52E4q6pE38SwF+kXydVpGwA8RXL8QyLenv6SYutVUvbVQ95cDjx6G/8AMxk6/I25of7jS9SSNjKv9P6Sb3M4Ae8RbqytfVUA3xIg7UPeDGtRG/MqN+Ijh+IOxF8e0eDK4sVZhA8pLYyf6TJKsacg+hkmpXnYB0mtsAdxv29R5hMy2ktZ0rfNTvJ34mXozXZl+1C7XsAIrnfKrhWxBr7nmbhVfEEyLvt/eWDHIdCRX6PaO9F9eM2DYNGXfpy3ke8Z6TDoY+Ce8lIzesJGfQosARUOiMAyM7HwNpsZ+l1ZHI4JuVTANiRZHntLC6TULiYFAyqdirDgzQ6LIS5B4PEIuNCKIseKhlxItEDSYAetJw41cCzemSE6hRkx1VnUK95JFgZNGzwBB/NbVtOs1LfmDBveCChieRIdNd4O995R3IFLuZGsXV1Zyqg7ckdo7hAK7HeZWPM3SlgykhjZNRheuAAogCVk5lWiTufQRZSrbq2063xDGq6mNntUW+YWynKi6Ufc+8EOhq9ZDl+nvfaAVyRxLgg8wuDA60q6vmSDx7GjuDJJpIDl3HtK/aoE6Ws1B5HVQSTvKy7qHc7zodFN6tzE2bI5+il9TOfKflsjGFPOoZb5imbHT2oNHxIMef8AHKK9ZNfUYwVcK/e5cMHw4kK0259Y0NKrRqqmauXOAToBvxI79Q3NCoD2kDdTtOqwYTOXPlTZlJ9QY1gyrk95FOIdzJKX3MkiUm2XsJUAE2dzDDGo/GdquAB+5VCrvRlWY8V/EPXneQgeICRbL2ucD575P8R2h4nRpH4yhQPmHN/xDISfujACVvIUU95BTQCOIMoV3G0YCAcGW0+0ASZgRpaSXKA8iSTB/9k="});
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
 }else if(['huang-mask','xi-mask','putin-mask','kim-mask'].includes(d)){
 // Anatomically distinct continuous masks with landmark-projected facial details.
 const huang=d==='huang-mask',xi=d==='xi-mask',putin=d==='putin-mask',kim=d==='kim-mask';
 const cfg=huang?{
  rows:[[-.66,.025,.41],[-.57,.24,.53],[-.45,.34,.57],[-.30,.41,.60],[-.10,.46,.62],[.10,.48,.61],[.29,.45,.58],[.46,.43,.55],[.61,.37,.51],[.73,.24,.43],[.80,.02,.32]],
  skin:'#c69c83',warm:'#b77b65',shadow:'#8c6555',hair:'#a8a9a7',light:'#e1e0dc',brow:'#57524d',lip:'#a37267',eyeX:.205,eyeY:.235,eyeW:.112,eyeH:.030,nose:.083,bridge:.10,tip:.125,cheek:.065,mouthW:.195,mouthY:-.205,jaw:.039
 }:xi?{
  rows:[[-.65,.03,.37],[-.55,.27,.52],[-.40,.42,.57],[-.20,.51,.61],[.04,.52,.62],[.23,.48,.60],[.43,.46,.55],[.61,.40,.51],[.74,.27,.41],[.80,.02,.30]],
  skin:'#d0a486',warm:'#bc8a70',shadow:'#946a56',hair:'#262322',light:'#55514d',brow:'#3d3029',lip:'#a97468',eyeX:.212,eyeY:.23,eyeW:.118,eyeH:.025,nose:.10,bridge:.075,tip:.10,cheek:.07,mouthW:.195,mouthY:-.23,jaw:.09
 }:putin?{
  rows:[[-.67,.02,.40],[-.56,.22,.54],[-.41,.33,.62],[-.23,.39,.63],[-.01,.45,.61],[.19,.44,.57],[.39,.43,.55],[.57,.42,.50],[.72,.32,.42],[.82,.02,.29]],
  skin:'#d8b4a0',warm:'#c49585',shadow:'#a17f72',hair:'#b6a68d',light:'#ddd0b9',brow:'#a18573',lip:'#ad8178',eyeX:.183,eyeY:.235,eyeW:.103,eyeH:.025,nose:.076,bridge:.12,tip:.115,cheek:.05,mouthW:.16,mouthY:-.24,jaw:.072
 }:{
  rows:[[-.72,.03,.39],[-.64,.30,.49],[-.50,.45,.57],[-.31,.55,.64],[-.08,.56,.63],[.14,.53,.60],[.32,.48,.57],[.53,.43,.54],[.69,.35,.47],[.79,.02,.33]],
  skin:'#d6ac95',warm:'#c58e79',shadow:'#a57b68',hair:'#252223',light:'#4d4845',brow:'#43342f',lip:'#ad746d',eyeX:.206,eyeY:.23,eyeW:.105,eyeH:.022,nose:.093,bridge:.045,tip:.073,cheek:.10,mouthW:.178,mouthY:-.20,jaw:.112
 };
 const skin=mat(cfg.skin,0),shadow=mat(cfg.shadow,0),lip=mat(cfg.lip,0),hair=mat(cfg.hair,0),strand=mat(cfg.light,0),brow=mat(cfg.brow,0),crease=mat('#75554c',0),sclera=mat('#e4dbd1',0),iris=mat(putin?'#71898c':'#403026',0),pupil=mat('#262222',0),frame=mat('#222326',.3);
 const {rows,eyeX,eyeY,eyeW,eyeH,mouthW,mouthY}=cfg;
 const sample=y=>{let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;const a=rows[i],b=rows[i+1],t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0])));return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];};
 const g=(x,y,cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
 const depth=(x,y)=>{const [w,z]=sample(y),a=Math.sqrt(Math.max(0,1-(x/Math.max(.02,w))**2)),X=Math.abs(x);
  return .18+(z-.18)*a+cfg.cheek*g(X,y,.31,.02,.15,.17)-.055*g(X,y,eyeX,eyeY,.12,.08)+.035*g(X,y,eyeX,eyeY+.095,.16,.065)+cfg.bridge*g(x,y,0,.095,.082,.23)+cfg.tip*g(x,y,0,-.055,.105,.085)+.027*g(X,y,cfg.nose,-.07,.045,.06)+.045*g(x,y,0,mouthY,.22,.11)+cfg.jaw*g(x,y,0,-.46,.25,.15);
 };
 const pos=[],indices=[],colors=[],uv=[],N=112,M=112,base=new T.Color(cfg.skin),warm=new T.Color(cfg.warm),cool=new T.Color(cfg.shadow);
 for(let j=0;j<=M;j++){const y=rows[0][0]+(rows.at(-1)[0]-rows[0][0])*j/M,[w]=sample(y);
  for(let k=0;k<=N;k++){const x=w*Math.sin(-Math.PI/2+Math.PI*k/N);pos.push(x,y,depth(x,y));uv.push((x/Math.max(.001,w)+1)*.5,j/M);
   const c=base.clone().lerp(warm,.35*g(Math.abs(x),y,.29,.02,.18,.19)+.17*g(x,y,0,-.06,.14,.10)).lerp(cool,.20*g(Math.abs(x),y,eyeX,eyeY-.02,.14,.085));colors.push(c.r,c.g,c.b);
   if(j&&k){const i=j*(N+1)+k;indices.push(i-N-2,i-N-1,i,i-N-2,i,i-1);}
  }
 }
 const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(pos,3));geom.setAttribute('color',new T.Float32BufferAttribute(colors,3));geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geom.setIndex(indices);geom.computeVertexNormals();
 const faceMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.78,side:T.DoubleSide});mats.push(faceMat);mesh(geom,[0,0,0],[1,1,1],faceMat);
 const reference=PORTRAIT_REFERENCE[d],referenceReady=!!reference&&typeof Image!=='undefined';
 // Reference-derived texture is applied to the sculpt itself, not the SHOP UI.
 // Keep a procedural fallback for headless server tests and failed image decode.
 const facialParts=[];
 // Side skull behind the front surface gives the wearable mask real thickness.
 ball([0,.04,.05],[kim?.49:xi?.46:.40,.64,.24],skin);
 const facialStart=root.children.length;
 const line=(points,r,m,offset=.014)=>tube(points.map(([x,y])=>[x,y,depth(x,y)+offset]),r,m);
 for(const side of [-1,1]){
  const x=side*eyeX,z=depth(x,eyeY),inner=x-side*eyeW,outer=x+side*eyeW;
  ball([side*(kim?.53:xi?.49:.445),.045,.235],[.079,.145,.089],skin);
  ball([x,eyeY,z+.018],[eyeW,eyeH,.027],sclera);
  ball([x,eyeY,z+.041],[.033,.031,.016],iris);
  ball([x,eyeY,z+.055],[.016,.018,.008],pupil);
  ball([x-.008,eyeY+.010,z+.062],[.006,.006,.004],white);
  line([[inner,eyeY],[x-side*.05,eyeY+eyeH*.75],[x+side*.05,eyeY+eyeH*.84],[outer,eyeY+(huang?.008:-.009)]],.010,crease,.033);
  line([[inner,eyeY],[x,eyeY-eyeH*.85],[outer,eyeY]],.006,shadow,.026);
  line([[inner,eyeY+.044],[x,eyeY+.057],[outer,eyeY+.030]],huang?.006:.007,shadow,.016);
  line([[x-side*.13,eyeY+.094],[x-side*.045,eyeY+.112],[x+side*.046,eyeY+.104],[x+side*.13,eyeY+.075]],huang?.011:putin?.009:.018,brow,.019);
  line([[side*.105,-.014],[side*.16,-.085],[side*.24,mouthY+.025],[side*.26,mouthY-.09]],huang?.008:.006,shadow,.012);
  line([[x-side*.084,eyeY-.065],[x,eyeY-.083],[x+side*.12,eyeY-.05]],.005,shadow,.013);
  const nx=side*cfg.nose,ny=-.085;
  ball([nx,ny,depth(nx,ny)+.013],[.034,.022,.020],skin);
  ball([nx,ny-.013,depth(nx,ny-.013)+.025],[.022,.010,.008],crease);
  if(huang||putin)for(let k=0;k<3;k++)line([[outer,eyeY-.027*k],[outer+side*.04,eyeY-.015-.026*k],[outer+side*.075,eyeY-.04-.029*k]],.0035,shadow,.012);
 }
 const mouth=Array.from({length:19},(_,i)=>{const t=i/9-1;return [mouthW*t,mouthY+(huang?.014:xi?.024:putin?-.006:.012)*t*t];});
 line(mouth,.010,crease,.029);
 line(mouth.map(([x,y])=>[x,y+.015*(1-(x/mouthW)**2)+.007*Math.exp(-(((Math.abs(x)-mouthW*.28)/.04)**2))]),huang?.013:.016,lip,.031);
 line(mouth.map(([x,y])=>[x,y-.024*(1-(x/mouthW)**2)]),huang?.019:.021,lip,.030);
 if(huang){line([[-.105,mouthY-.004],[0,mouthY-.010],[.105,mouthY-.004]],.004,sclera,.045);}
 if(huang||putin)for(let k=0;k<3;k++){const y=.42+k*.055;line([[-.26,y],[-.13,y+.012],[.08,y+.007],[.25,y-.008]],.004,shadow,.012);}
 if(kim)line([[-.26,-.49],[-.12,-.535],[.12,-.535],[.26,-.49]],.007,shadow,.012);
 facialParts.push(...root.children.slice(facialStart));
 if(huang){
  // Broad side part, silver swept hair, close cropped temples.
  const cap=ball([-.035,.715,.20],[.455,.235,.295],hair);cap.rotation.z=-.11;
  for(const side of [-1,1]){
   ball([side*.40,.51,.215],[.09,.21,.17],hair);
   for(let k=0;k<14;k++){const t=k/13;tube([[side*(.42-.045*t),.40+.10*t,.33],[side*(.36-.04*t),.62+.12*t,.42],[side*(.20-.06*t),.80+.07*t,.35]],.009,k%3===0?strand:hair);}
  }
  for(let k=0;k<26;k++){const t=k/25,x=-.40+.76*t;tube([[x,.62+.07*t,.44],[x-.075,.80+.08*Math.sin(t*Math.PI),.53],[x-.11,.88-.035*t,.33]],.012,k%4===0?strand:hair);}
 }else if(putin){
  ball([0,.70,.055],[.37,.15,.21],hair);
  for(const side of [-1,1]){ball([side*.38,.48,.14],[.062,.22,.12],hair);for(let k=0;k<9;k++)tube([[side*(.38-k*.012),.42+.025*k,.25],[side*(.34-k*.012),.68,.28],[side*.12,.77,.19]],.006,k%3?hair:strand);}
 }else if(kim){
  // Flat swept-back pompadour, closely shaved sides, no glasses.
  const top=box([0,.785,.13],[.84,.25,.47],hair);top.rotation.x=-.06;
  ball([0,.86,.15],[.43,.125,.27],hair);
  for(const side of [-1,1])ball([side*.40,.67,.14],[.065,.13,.19],hair);
  for(let k=0;k<27;k++){const x=-.40+.8*k/26;tube([[x,.70,.37],[x,.83,.39],[x*.97,.90,.12],[x*.94,.84,-.12]],.011,k%5===0?strand:hair);}
 }else{
  const cap=ball([xi?-.035:0,kim?.77:.71,.17],[kim?.48:.465,kim?.25:.21,.30],hair);cap.rotation.z=xi?-.08:0;
  for(const side of [-1,1]){ball([side*.405,kim?.60:.48,.14],[.08,kim?.12:.22,.15],hair);}
  for(let k=0;k<25;k++){const x=-.41+.82*k/24;const y=kim?.68:.59;tube([[x,y,.44],[x-(xi?.08:.02),y+.20,.48],[x-(xi?.12:.03),y+.24,.23]],.012,k%5===0?strand:hair);}
 }
 if(huang&&!referenceReady){
  const fw=huang?.150:.158,fh=huang?.074:.085,cy=eyeY+.005;
  for(const side of [-1,1]){
   const cx=side*eyeX,shape=new T.Shape();
   shape.moveTo(-fw+.025,-fh);shape.lineTo(fw-.025,-fh);shape.quadraticCurveTo(fw,-fh,fw,-fh+.025);shape.lineTo(fw,fh-.02);shape.quadraticCurveTo(fw,fh,fw-.025,fh);shape.lineTo(-fw+.025,fh);shape.quadraticCurveTo(-fw,fh,-fw,fh-.02);shape.lineTo(-fw,-fh+.025);shape.quadraticCurveTo(-fw,-fh,-fw+.025,-fh);
   const z=depth(cx,cy)+.12,pts=shape.getPoints(24).map(v=>[cx+v.x,cy+v.y,z-Math.abs(v.x)*.11]);pts.push(pts[0]);tube(pts,huang?.012:.018,frame);
   tube([[cx+side*fw,cy+.02,z-.01],[side*.45,cy+.024,.46],[side*.46,cy,.23]],.014,frame);
  }
  const z=depth(eyeX,cy)+.12;tube([[-.055,cy+.028,z],[0,cy+.043,z+.008],[.055,cy+.028,z]],.011,frame);
 }
 tube([[-.43,.06,.23],[-.48,.06,-.04],[0,.06,-.34],[.48,.06,-.04],[.43,.06,.23]],.024,frame);
 if(referenceReady){
  const tex=new T.Texture();tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;tex.minFilter=T.LinearFilter;
  const img=new Image();
  // Do not retain textures or promises in userData (SkeletonUtils clones it).
  root.portraitReady=new Promise(resolve=>{
   img.onload=()=>{if(!root.portraitDisposed){tex.image=img;tex.needsUpdate=true;faceMat.map=tex;faceMat.vertexColors=false;faceMat.color.set('#ffffff');faceMat.needsUpdate=true;
     facialParts.forEach(part=>part.visible=false); }resolve();};
   img.onerror=()=>resolve();img.src='data:image/jpeg;base64,'+reference;
  });
  root.portraitTexture=tex;
 }
 root.userData.portraitSculpt=huang?'huang-r114':d+'-r114';
}else if(d==='musk-mask'){
// Separate landmark-based portraits. Features are projected onto each face,
 // rather than sharing a generic depth plane where eyelids/lips disappear.
 const huang=d==='huang-mask';
 const skin=mat(huang?'#c7a08a':'#e4b9a7',0),shadow=mat(huang?'#97705d':'#b18778',0),
  lip=mat(huang?'#996c64':'#aa7774',0),crease=mat(huang?'#77564d':'#80564e',0),
  hair=mat(huang?'#9a9b99':'#513b30',0),strand=mat(huang?'#d9d9d5':'#84634c',0),
  brow=mat(huang?'#54504a':'#594238',0),pupil=mat('#292826',0),
  iris=mat(huang?'#49372b':'#69858c',0),frame=mat('#1d2024',.16);
 // [vertical landmark, half-width, front depth], deliberately different
 // skull profiles: narrow angular Huang versus broad forehead and square Musk.
 const rows=huang?[
  [-.64,.025,.43],[-.55,.19,.55],[-.43,.29,.59],[-.28,.39,.61],[-.10,.45,.63],
  [.08,.48,.62],[.27,.45,.58],[.44,.42,.54],[.59,.38,.49],[.73,.25,.40],[.80,.015,.30]
 ]:[
  [-.64,.025,.48],[-.55,.28,.60],[-.43,.43,.65],[-.25,.47,.65],[-.05,.49,.63],
  [.14,.50,.61],[.32,.49,.59],[.50,.49,.55],[.66,.43,.48],[.77,.28,.40],[.83,.015,.30]
 ];
 const sample=y=>{let j=0;while(j<rows.length-2&&y>rows[j+1][0])j++;const a=rows[j],b=rows[j+1],t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0]))),smooth=t*t*(3-2*t);return [a[1]+(b[1]-a[1])*smooth,a[2]+(b[2]-a[2])*smooth];};
 const g=(x,y,cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
 const eyeY=huang?.245:.275,eyeX=huang?.207:.188;
 const depth=(x,y)=>{const [w,z]=sample(y);const a=Math.sqrt(Math.max(0,1-(x/Math.max(.02,w))**2));const X=Math.abs(x);
  return .22+(z-.22)*a
   +(huang?.085:.045)*g(X,y,.30,.025,.13,.16)
   -(huang?.05:.075)*g(X,y,eyeX,eyeY,.13,.083)
   +(huang?.038:.080)*g(X,y,eyeX,eyeY+.10,.17,.062)
   +(huang?.115:.085)*g(x,y,0,.095,.072,.23)
   +(huang?.100:.092)*g(x,y,0,-.065,.105,.085)
   +(huang?.045:.070)*g(x,y,0,-.22,.20,.11)
   +(huang?.040:.105)*g(x,y,0,-.46,.22,.12)
   -(huang?0:.017)*g(x,y,0,-.48,.027,.043);
 };
 const vertices=[],indices=[],colors=[],N=112,M=112,base=new T.Color(huang?'#c7a08a':'#e4b9a7'),warm=new T.Color(huang?'#af7f68':'#c58e81'),cool=new T.Color(huang?'#967663':'#bd9b93');
 for(let j=0;j<=M;j++){const y=rows[0][0]+(rows.at(-1)[0]-rows[0][0])*j/M;const [w]=sample(y);
  for(let k=0;k<=N;k++){const x=w*Math.sin(-Math.PI/2+Math.PI*k/N),z=depth(x,y);
   vertices.push(x,y,z);const tone=base.clone().lerp(warm,.38*g(Math.abs(x),y,.31,.0,.17,.2)+.18*g(x,y,0,-.065,.13,.10)).lerp(cool,.30*g(Math.abs(x),y,eyeX,eyeY,.13,.11));colors.push(tone.r,tone.g,tone.b);
   if(j&&k){const i=j*(N+1)+k;indices.push(i-N-2,i-N-1,i,i-N-2,i,i-1);}
  }
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
 const faceMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.84,metalness:0,side:T.DoubleSide});mats.push(faceMat);mesh(geo,[0,0,0],[1,1,1],faceMat);
 const onFace=(points,offset=.012)=>points.map(([x,y])=>[x,y,depth(x,y)+offset]);
 const line=(points,r,m,offset=.012)=>tube(onFace(points,offset),r,m);
 const oval=(cx,cy,w,h,count=36)=>Array.from({length:count+1},(_,i)=>[cx+w*Math.cos(i/count*Math.PI*2),cy+h*Math.sin(i/count*Math.PI*2)]);
 for(const side of [-1,1]){
  const x=side*eyeX,z=depth(x,eyeY),ew=huang?.122:.108,eh=huang?.025:.035;
  ball([side*(huang?.45:.49),.035,.27],[.075,.15,.085],skin);
  ball([x,eyeY,z+.021],[ew,eh,.027],white);
  ball([x,eyeY,z+.049],[huang?.030:.035,huang?.029:.034,.012],iris);
  ball([x,eyeY,z+.060],[.016,.018,.007],pupil);
  ball([x-.008,eyeY+.009,z+.066],[.005,.005,.004],white);
  line([[x-ew,eyeY],[x-ew*.45,eyeY+eh],[x+ew*.45,eyeY+eh],[x+ew,eyeY+side*.006]],.011,crease,.043);
  line([[x-ew,eyeY],[x,eyeY-eh],[x+ew,eyeY+side*.006]],.007,shadow,.031);
  const by=eyeY+(huang?.090:.094);
  line([[x-ew,by-.012],[x-ew*.35,by+.015],[x+ew*.25,by+.013],[x+ew,by-.018]],huang?.013:.021,brow,.025);
  for(let k=0;k<12;k++){const xx=x-ew+.018*k;line([[xx,by-.008],[xx+.012*side,by+.014]],.003,brow,.035);}
  if(huang){
   line([[side*.10,.01],[side*.19,-.08],[side*.26,-.19],[side*.29,-.29]],.008,shadow,.018);
   line([[side*.115,eyeY-.065],[side*.23,eyeY-.085],[side*.32,eyeY-.055]],.006,shadow,.014);
   for(let k=0;k<3;k++)line([[side*.32,eyeY-.03-k*.025],[side*.37,eyeY-.04-k*.03],[side*.40,eyeY-.07-k*.027]],.004,shadow,.013);
  }else{
   line([[side*.11,eyeY-.06],[side*.20,eyeY-.073],[side*.28,eyeY-.06]],.006,shadow,.014);
   line([[side*.11,-.09],[side*.18,-.14],[side*.23,-.24]],.006,shadow,.014);
  }
  const nx=side*(huang?.067:.073),ny=-.087;
  ball([nx,ny,depth(nx,ny)+.018],[.033,.018,.018],skin);
  ball([nx,ny-.012,depth(nx,ny-.012)+.031],[.023,.009,.009],crease);
 }
 const my=huang?-.205:-.224,mw=huang?.218:.172;
 const smile=side=>my+(huang?.043:.023)*side*side+(huang?0:.012*side);
 const mouth=Array.from({length:17},(_,i)=>{const t=i/8-1;return [mw*t,smile(t)];});
 line(mouth,.010,crease,.037);
 line(mouth.map(([x,y])=>[x,y+.018*(1-(x/mw)**2)]),huang?.013:.018,lip,.035);
 line(mouth.map(([x,y])=>[x,y-.023*(1-(x/mw)**2)]),huang?.018:.022,lip,.034);
 if(huang){
  line(mouth.slice(2,-2).map(([x,y])=>[x,y+.002]),.011,white,.047);
  for(let k=1;k<4;k++){const y=.39+k*.052;line([[-.25,y],[-.11,y+.016],[.11,y+.016],[.25,y]],.004,shadow,.012);}
 }else{
  line([[-.10,-.372],[0,-.387],[.10,-.372]],.005,shadow,.012);
  line([[0,-.455],[.012,-.49],[0,-.515]],.004,shadow,.012);
 }
 // Hair: Huang's silver swept-back short hair and dark rectangular glasses;
 // Musk's recessed temples, broad bare forehead, short asymmetric side part.
 if(huang){
  const cap=ball([0,.66,.30],[.41,.17,.28],hair);cap.rotation.z=-.055;
  for(const side of [-1,1]){
   ball([side*.39,.48,.26],[.088,.19,.16],hair);
   for(let k=0;k<19;k++){const t=k/18;tube([[side*(.40-.08*t),.43+.12*t,.37],[side*(.28-.10*t),.68+.07*t,.52],[side*.055,.78-.015*t,.41]],.010,k%3===0?strand:hair);}
   const cx=side*.207,cy=eyeY+.012,fw=.163,fh=.086;
   const shape=new T.Shape();shape.moveTo(-fw+.02,-fh);shape.lineTo(fw-.02,-fh);shape.quadraticCurveTo(fw,-fh,fw,-fh+.025);shape.lineTo(fw,fh-.015);shape.quadraticCurveTo(fw,fh,fw-.02,fh);shape.lineTo(-fw+.02,fh);shape.quadraticCurveTo(-fw,fh,-fw,fh-.02);shape.lineTo(-fw,-fh+.02);shape.quadraticCurveTo(-fw,-fh,-fw+.02,-fh);
   const pts=shape.getPoints(24).map(v=>[cx+v.x,cy+v.y,.755-Math.abs(v.x)*.08]);pts.push(pts[0]);tube(pts,.017,frame);
   tube([[side*.37,cy,.74],[side*.46,cy+.025,.53],[side*.48,cy,.27]],.018,frame);
  }
  tube([[-.045,eyeY+.035,.75],[0,eyeY+.051,.77],[.045,eyeY+.035,.75]],.014,frame);
 }else{
  const cap=ball([-.015,.73,.27],[.43,.15,.29],hair);cap.rotation.z=-.12;
  for(const side of [-1,1])ball([side*.435,.53,.23],[.07,.17,.15],hair);
  for(let k=0;k<30;k++){const t=k/29,x=-.40+t*.79;const y=.61+.075*Math.exp(-((x/.30)**2))+.04*t;
   tube([[x,y,.44],[x-.07,.79+.025*Math.sin(t*Math.PI),.55],[x-.13,.77,.38]],.012,k%5===0?strand:hair);
  }
 }
 const strap=mat('#39333a',0);tube([[-.43,.10,.24],[-.54,.10,-.05],[0,.10,-.40],[.54,.10,-.05],[.43,.10,.24]],.030,strap);
 root.userData.portraitSculpt=huang?'huang-r112':'musk-r112';
}else if(d==='trump-mask'){
 // Continuous sculpted facial surface. Individual silhouettes and landmark
 // proportions replace the shared oval face and separate spherical cheeks.
 const trump=d==='trump-mask',huang=d==='huang-mask';
 const skin=mat(trump?'#dfa078':huang?'#c9a28b':'#dfb5a5',0);
 const hair=mat(trump?'#ddbd76':huang?'#b6b4b0':'#634b3f',0);
 const shading=mat(trump?'#b77c60':huang?'#a27a64':'#b58d7e',0);
 const lip=mat(trump?'#bd7f70':huang?'#946c62':'#ac7d72',0);
 const iris=mat(trump?'#7c9ba7':huang?'#35291f':'#68867f',0);
 const rows=trump?[
 [-.60,.02,.53],[-.52,.26,.63],[-.36,.46,.67],[-.15,.54,.66],[.04,.55,.62],[.24,.49,.58],[.46,.48,.53],[.65,.38,.45],[.76,.02,.41]
 ]:huang?[
 [-.59,.02,.48],[-.49,.19,.58],[-.30,.34,.63],[-.10,.45,.64],[.13,.48,.61],[.32,.45,.56],[.51,.44,.51],[.67,.31,.45],[.74,.02,.40]
 ]:[
 [-.61,.02,.53],[-.51,.29,.63],[-.33,.49,.65],[-.12,.47,.64],[.09,.50,.62],[.30,.47,.57],[.52,.44,.49],[.69,.30,.43],[.76,.02,.40]
 ];
 // Interpolate the independent facial landmark profiles for a smooth mask.
 const sample=(t)=>{const i=Math.min(rows.length-2,Math.floor(t)),f=t-i,a=rows[Math.max(0,i-1)],b=rows[i],c=rows[i+1],d=rows[Math.min(rows.length-1,i+2)];return b.map((v,k)=>.5*((2*v)+(-a[k]+c[k])*f+(2*a[k]-5*v+4*c[k]-d[k])*f*f+(-a[k]+3*v-3*c[k]+d[k])*f*f*f));};
 const positions=[],indices=[],colors=[],steps=112,vertical=(rows.length-1)*10;
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
 const eyeY=huang?.25:trump?.25:.29,eyeZ=huang?.625:trump?.63:.635,eyeW=huang?.115:trump?.115:.122,eyeH=huang?.029:trump?.032:.047;
 for(const side of [-1,1]){
  const x=side*(huang?.205:trump?.205:.185);
  ball([side*(trump?.52:huang?.46:.49),.10,.29],[.08,.15,.10],skin);
  ball([x,eyeY,eyeZ],[eyeW,eyeH,.026],white);
  ball([x,eyeY,eyeZ+.028],[.037,.036,.015],iris);
  ball([x,eyeY,eyeZ+.042],[.018,.019,.009],dark);
  ball([x-.009,eyeY+.009,eyeZ+.053],[.006,.006,.004],white);
  tube([[x-eyeW,eyeY,eyeZ],[x,eyeY+eyeH,eyeZ+.024],[x+eyeW,eyeY,eyeZ]],.014,shading);
  const brow=ball([x,eyeY+.105,eyeZ-.006],[eyeW+.02,trump?.022:huang?.014:.028,.021],hair);
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
 const mouthY=trump?-.23:huang?-.17:-.19,mouthW=trump?.115:huang?.205:.215;
 tube([[-mouthW,mouthY,.64],[0,mouthY+(trump?-.022:.015),.765],[mouthW,mouthY,.64]],.023,lip);
 tube([[-mouthW*.93,mouthY-.008,.65],[0,mouthY+(trump?-.027:.01),.785],[mouthW*.93,mouthY-.008,.65]],.009,dark);
 // Distinct age and expression details: Trump pursed lips and heavy jowls,
 // Huang smiling cheek folds and angular temples, Musk fuller lower lip.
 const wrinkle=mat(trump?'#bb876a':huang?'#ac8570':'#bc9287',0);
 if(trump||huang){
  for(let k=0;k<(trump?3:2);k++){const yy=.44+k*.046;tube([[-.27,yy,.51],[-.12,yy+.015,.57],[.12,yy+.015,.57],[.27,yy,.51]],.0045,wrinkle);}
  for(const side of [-1,1])tube([[side*.22,-.12,.65],[side*.28,-.25,.60],[side*.25,-.36,.58]],.008,wrinkle);
 }
 if(!trump&&!huang){ball([0,mouthY-.042,.70],[.11,.024,.034],lip);for(const side of [-1,1])tube([[side*.17,mouthY,.65],[side*.23,mouthY+.016,.61]],.006,wrinkle);}
 if(huang){
  // Distinct smiling upper teeth, cheek creases and angular jaw.
  tube([[-.12,mouthY+.012,.704],[0,mouthY+.023,.785],[.12,mouthY+.012,.704]],.012,white);
  for(const side of [-1,1])tube([[side*.14,-.07,.70],[side*.20,-.12,.69],[side*.25,-.22,.63]],.009,wrinkle);
 }else if(trump){
  ball([0,mouthY-.038,.745],[.083,.025,.032],lip);
  for(const side of [-1,1])tube([[side*.28,-.14,.63],[side*.34,-.27,.60],[side*.31,-.39,.58]],.009,wrinkle);
 }else{
  // Musk: heavier brow, pronounced chin, slightly asymmetric smile.
  ball([0,-.44,.64],[.16,.066,.044],skin);
  tube([[-.20,mouthY+.006,.66],[-.06,mouthY-.006,.77],[.11,mouthY+.013,.76],[.21,mouthY+.034,.67]],.007,dark);
 }
 if(trump){
  const sweep=ball([-.06,.68,.39],[.55,.21,.27],hair);sweep.rotation.z=.25;
  const highlight=mat('#f2d898',0),lowlight=mat('#bc9858',0);for(let i=0;i<25;i++)tube([[-.46,.49+i*.013,.45],[-.14,.77+i*.004,.65],[.40,.63+i*.004,.53]],.014,i%5===0?lowlight:i%3===0?highlight:hair);
  for(const side of [-1,1])ball([side*.44,.43,.27],[.10,.20,.19],hair);
 }else if(huang){
  ball([0,.66,.34],[.45,.16,.23],hair);
  for(const side of [-1,1]){
   const silver=mat('#dedbd5',0);for(let i=0;i<15;i++)tube([[side*.43,.33+i*.018,.29],[side*.33,.54+i*.012,.43],[side*.10,.73,.42]],.011,i%3===0?silver:hair);
   const frame=new T.Shape();frame.moveTo(-.15,-.075);frame.quadraticCurveTo(-.16,.09,-.10,.09);frame.lineTo(.10,.09);frame.quadraticCurveTo(.16,.09,.15,-.075);frame.quadraticCurveTo(0,-.115,-.15,-.075);
   const pts=frame.getPoints(18).map(v=>[side*.205+v.x,eyeY+v.y,.715]);pts.push(pts[0]);tube(pts,.018,dark);
   box([side*.40,eyeY,.46],[.028,.027,.42],dark);
  }
  box([0,eyeY+.025,.715],[.11,.022,.027],dark);
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
export function disposeHeadgear(root){root.portraitDisposed=true;root.portraitTexture?.dispose();const geo=new Set(),mat=new Set(root.userData.materials||[]);root.traverse(o=>{if(o.geometry)geo.add(o.geometry);if(o.material)mat.add(o.material);});root.removeFromParent();geo.forEach(g=>g.dispose());mat.forEach(m=>m.dispose());}
export function attachHeadgear(T,model,item){let head=null,top=null;model.traverse(o=>{if(o.isBone&&/Head$/i.test(o.name))head=o;if(o.isBone&&/HeadTop/i.test(o.name))top=o;});if(!head)return null;model.updateMatrixWorld(true);const scale=head.getWorldScale(new T.Vector3()),height=top?head.getWorldPosition(new T.Vector3()).distanceTo(top.getWorldPosition(new T.Vector3())):.28,root=createHeadgear(T,item);head.add(root);const portraitMask=['trump-mask','huang-mask','musk-mask','xi-mask','putin-mask','kim-mask'].includes(item.design),safe=v=>Math.max(.00001,Math.abs(v));root.position.set(0,height*(portraitMask?.35:.48)/safe(scale.y),height*(portraitMask?.25:.12)/safe(scale.z));root.scale.set(height/safe(scale.x),height/safe(scale.y),height/safe(scale.z));root.userData.anchor=head.name;return root;}

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
