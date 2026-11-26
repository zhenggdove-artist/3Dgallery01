// Deterministic signs: one original-illustration sheet, composed into the existing atlas once.
let portraitLoad=null;
const CATEGORY_WORDS={
 noodle:/麵店|麵館|NOODLE/i,repair:/機車|MOTOR REPAIR/i,laundry:/洗衣|LAUNDRY/i,
 fish:/鮮魚|魚市場|FISH MARKET/i,electronics:/電器|ELECTRONIC/i,pharmacy:/藥房|PHARMACY/i,
 tea:/奶茶|茶飲|TRICYCLE TEA/i,barber:/理髮|BARBER/i,hardware:/五金|HARDWARE/i,
 tailor:/裁縫|TAILOR/i,pawn:/當舖|PAWN/i,grocery:/雜貨|MART/i,internet:/網咖|INTERNET/i,
 clinic:/牙科|DENTAL/i,streetfood:/烤肉|GRILL/i,flower:/花店|FLOWER/i,printing:/影印|PRINT/i,
 fortune:/求籤|FORTUNE/i,tattoo:/刺青|TATTOO/i,rice:/米行|GRAIN RICE/i,shoes:/鞋行|SHOES/i,
 shipping:/快遞|PARCEL/i,fruit:/水果|FRUIT/i,motel:/旅社|INN/i
};
export function signShopKind(title='',subtitle='',explicit=''){
 if(Object.hasOwn(CATEGORY_WORDS,explicit))return explicit;
 const name=title+' '+subtitle;
 return Object.keys(CATEGORY_WORDS).find(key=>CATEGORY_WORDS[key].test(name))||'generic';
}
const FOOD_KINDS=new Set(['noodle','fish','tea','streetfood','rice','fruit','grocery']);
export function signPortraitSource(kind){return FOOD_KINDS.has(kind)?'food-head':'occupation';}
// Crop to faces, above any cooking vessels, hands holding food or utensils.
// Coordinates are relative to the original 256x320 cells.
const HEAD_CROPS=[
 [0,.012,.59,.53],[0,.025,.60,.49],[0,.008,.78,.49],
 [.105,.006,.68,.49],[.02,.002,.66,.45],[.23,.016,.53,.47],
 [0,.005,.82,.53],[.018,.01,.56,.44],[.13,.002,.58,.39],[0,.004,.84,.57]
];
let portraitHeads=[],mutedHeads=[];
// Preserve actual colour in the face, removing only backdrop connected to
// the crop boundary. For black/white ink art, white paper is converted into
// transparent ink coverage rather than an opaque rectangle.
export function cleanSignHeadPixels(d,W,H,i){
 if(i===5||i===7){
  for(let k=0;k<d.length;k+=4){const lum=.2126*d[k]+.7152*d[k+1]+.0722*d[k+2];d[k+3]=Math.round(d[k+3]*Math.max(0,Math.min(1,(244-lum)/220)));d[k]=d[k+1]=d[k+2]=24;}
  return;
 }
 const yellow=i===0||i===1||i===4,red=i===8;
 const isBackdrop=k=>{const a=k*4,r=d[a],v=d[a+1],b=d[a+2];
  const paper=r>216&&v>205&&b>185&&r-b<65&&Math.abs(r-v)<35;
  const orange=i===3&&r>230&&v>95&&v<205&&b<85&&r-b>155;
  return yellow?r>195&&v>135&&v>r*.56&&b<115&&r-b>100:
   red?r>130&&v<75&&b<80&&r>v*2.6&&r>b*2.6:paper||orange;
 };
 const seen=new Uint8Array(W*H),q=new Int32Array(W*H);let front=0,end=0;
 const visit=k=>{if(!seen[k]&&isBackdrop(k)){seen[k]=1;q[end++]=k;}};
 for(let x=0;x<W;x++){visit(x);visit((H-1)*W+x);}
 for(let y=0;y<H;y++){visit(y*W);visit(y*W+W-1);}
 while(front<end){const k=q[front++],x=k%W,y=Math.floor(k/W);
  d[k*4+3]=0;if(x>0)visit(k-1);if(x<W-1)visit(k+1);if(y>0)visit(k-W);if(y<H-1)visit(k+W);
 }
 // Remove isolated tiny slivers (steam, unrelated utensils, print marks)
 // outside the main head, without discarding separately outlined hair.
 seen.fill(0);
 for(let k=0;k<W*H;k++){
  if(seen[k]||!d[k*4+3])continue;
  front=0;end=1;q[0]=k;seen[k]=1;
  const add=n=>{if(!seen[n]&&d[n*4+3]){seen[n]=1;q[end++]=n;}};
  while(front<end){const n=q[front++],x=n%W,y=Math.floor(n/W);
   if(x>0)add(n-1);if(x<W-1)add(n+1);if(y>0)add(n-W);if(y<H-1)add(n+W);
  }
  if(end<W*H*.006)for(let j=0;j<end;j++)d[q[j]*4+3]=0;
 }
}
function headCanvases(image){
 const sw=image.naturalWidth/5,sh=image.naturalHeight/2;
 for(let i=0;i<10;i++){
  const [x,y,w,h]=HEAD_CROPS[i],c=document.createElement('canvas');
  c.width=Math.round(sw*w);c.height=Math.round(sh*h);
  const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(image,(i%5+x)*sw,(Math.floor(i/5)+y)*sh,c.width,c.height,0,0,c.width,c.height);
  const p=g.getImageData(0,0,c.width,c.height),d=p.data,W=c.width,H=c.height;
  cleanSignHeadPixels(d,W,H,i);
  // Blend the cropped lower edge into the sign itself rather than leaving a
  // rectangular patch. This is done once per source image, never per sign.
  for(let y=Math.floor(H*.87);y<H;y++)for(let x=0;x<W;x++){
   const a=(y*W+x)*4+3;d[a]*=Math.max(0,(H-1-y)/(H*.13));
  }
  g.putImageData(p,0,0);portraitHeads.push(c);
  const m=document.createElement('canvas');m.width=W;m.height=H;
  const mg=m.getContext('2d');
  for(let k=0;k<d.length;k+=4){const lum=.2126*d[k]+.7152*d[k+1]+.0722*d[k+2];d[k]=(d[k]+lum)*.5;d[k+1]=(d[k+1]+lum)*.5;d[k+2]=(d[k+2]+lum)*.5;}
  mg.putImageData(p,0,0);mutedHeads.push(m);
 }
}
function drawFoodHead(ctx,seed,x,y,w,h,saturation){
 const sheet=saturation<=.5?mutedHeads:portraitHeads,head=sheet[portraitVariant(seed)];
 if(!head)return false;
 const s=Math.min(w/head.width,h/head.height),dw=head.width*s,dh=head.height*s;
 ctx.drawImage(head,x+(w-dw)/2,y+(h-dh)/2,dw,dh);return true;
}
// Shop-specific pictograms, using the same coordinate space as the original
// sign icons. All graphics are transparent and inherit the actual sign background.
function shopGraphic(ctx,kind){
 const ink='#253039',cream='#fff5db',gold='#e9ae4f',blue='#72b7d1',red='#cb6557',green='#79a96b';
 const path=(points,fill=null,stroke=ink,width=2.4)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}};
 const ellipse=(x,y,rx,ry,fill,stroke=ink)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
 const rect=(x,y,w,h,fill,stroke=ink)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);}};
 const line=(...p)=>path(p,null);
 ctx.lineCap='round';ctx.lineJoin='round';
 switch(kind){
 case 'noodle':ellipse(0,2,17,7,cream);path([[-17,2],[-12,14],[12,14],[17,2]],red);for(let i=-9;i<=9;i+=6)line([i,-1],[i-2,-8],[i+2,-13]);line([5,0],[17,-19]);line([9,1],[21,-17]);break;
 case 'repair':ellipse(-12,10,7,7,ink);ellipse(13,10,7,7,ink);ellipse(-12,10,3,3,cream,null);ellipse(13,10,3,3,cream,null);path([[-12,9],[-7,-2],[3,-2],[13,10],[0,10],[-7,-2]],red);line([7,-5],[12,-15],[18,-15]);line([-9,-5],[-2,-5]);break;
 case 'laundry':rect(-16,-19,32,38,cream);ellipse(0,4,11,11,blue);ellipse(0,4,7,7,'#b7e5ec');line([-5,6],[0,2],[6,7]);ellipse(-10,-13,2,2,red);line([-3,-13],[10,-13]);break;
 case 'fish':ellipse(-3,0,14,9,blue);path([[9,0],[19,-11],[19,11]],blue);ellipse(-11,-2,2,2,ink,null);line([0,-8],[-2,-15],[7,-8]);break;
 case 'electronics':rect(-14,-15,28,30,green);rect(-7,-8,14,16,ink);for(let i=-10;i<=10;i+=5){line([i,-15],[i,-20]);line([i,15],[i,20]);}path([[0,-6],[-5,1],[1,1],[-2,8],[6,-2],[0,-2]],gold,null);break;
 case 'pharmacy':rect(-12,-9,24,26,cream);rect(-8,-17,16,8,blue);rect(-9,-1,18,12,green,null);rect(-2,0,4,10,cream,null);rect(-6,3,12,4,cream,null);break;
 case 'tea':path([[-13,-9],[13,-9],[10,17],[-10,17]],gold);rect(-15,-13,30,4,cream);line([3,-13],[8,-21]);for(const [x,y] of [[-5,9],[3,12],[7,5],[-1,3]])ellipse(x,y,2.4,2.4,ink,null);break;
 case 'barber':ellipse(-9,11,6,6,cream);ellipse(9,11,6,6,cream);line([-5,5],[12,-18]);line([5,5],[-12,-18]);ellipse(0,1,2,2,gold);break;
 case 'hardware':path([[-16,-11],[-8,-17],[-1,-10],[-8,-3]],blue);path([[-9,-5],[-4,-10],[16,11],[11,16]],gold);path([[3,-14],[9,-18],[16,-14],[10,-9],[17,-2],[13,2],[2,-9]],cream);break;
 case 'tailor':path([[-15,-10],[-7,-17],[0,-13],[7,-17],[15,-10],[10,-2],[7,-4],[7,17],[-7,17],[-7,-4],[-10,-2]],red);line([0,-11],[0,14]);for(let y=-5;y<12;y+=6)ellipse(3,y,1.2,1.2,cream,null);break;
 case 'pawn':ellipse(-7,0,11,14,gold);ellipse(7,4,10,12,'#f7d476');line([7,-4],[7,12]);line([3,0],[11,0]);line([3,8],[11,8]);break;
 case 'grocery':path([[-18,-2],[18,-2],[13,15],[-13,15]],gold);line([-11,-2],[-4,-15],[4,-15],[11,-2]);for(let x=-9;x<=9;x+=6)line([x,2],[x*.8,12]);break;
 case 'internet':rect(-18,-15,36,24,blue);rect(-14,-11,28,16,ink,null);line([-12,0],[-5,-5],[0,1],[8,-5],[12,-2]);line([0,10],[0,16]);line([-10,17],[10,17]);break;
 case 'clinic':path([[-13,-14],[-4,-17],[0,-13],[5,-17],[14,-13],[15,-4],[9,8],[6,17],[1,5],[-2,5],[-7,17],[-12,7],[-16,-4]],cream);line([6,-8],[10,-8]);line([8,-10],[8,-6]);break;
 case 'streetfood':line([-15,17],[17,-17]);for(let i=0;i<4;i++){const x=-12+i*8,y=10-i*8;path([[x-7,y-1],[x-1,y-7],[x+6,y],[x,y+6]],i%2?gold:red);}break;
 case 'flower':line([0,17],[0,-5]);path([[0,10],[-13,3],[-9,12],[0,14]],green);path([[0,5],[12,-1],[9,8],[0,10]],green);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipse(Math.cos(a)*9,-7+Math.sin(a)*9,5,6,red);}ellipse(0,-7,4,4,gold);break;
 case 'printing':rect(-15,-8,30,21,blue);rect(-10,-19,20,13,cream);rect(-10,5,20,14,cream);for(let y=8;y<17;y+=4)line([-6,y],[6,y]);ellipse(10,-3,2,2,green);break;
 case 'fortune':path([[-11,-4],[11,-4],[8,17],[-8,17]],red);for(let i=0;i<5;i++)line([-7+i*3.5,-5],[-11+i*5,-19]);ellipse(0,6,4,4,gold);break;
 case 'tattoo':path([[-13,-15],[-6,-19],[8,-3],[2,3]],ink);path([[0,-4],[8,-7],[15,0],[5,9]],blue);line([5,8],[16,19]);path([[-15,8],[-9,1],[-3,8],[-9,16]],red);break;
 case 'rice':path([[-10,-15],[10,-15],[7,-7],[16,13],[10,18],[-10,18],[-16,13],[-7,-7]],cream);for(let y=-1;y<=13;y+=5)ellipse(0,y,2,3,gold);line([-6,-8],[6,-8]);break;
 case 'shoes':path([[-14,-13],[-4,-12],[1,1],[12,4],[18,9],[17,15],[-17,15],[-17,5]],red);line([-3,-2],[4,-4]);line([0,3],[8,1]);line([-16,11],[16,11]);break;
 case 'shipping':path([[-17,-9],[0,-18],[17,-9],[17,10],[0,19],[-17,10]],gold);line([-17,-9],[0,0],[17,-9]);line([0,0],[0,19]);line([-8,-14],[8,-5]);break;
 case 'fruit':ellipse(-8,5,9,11,red);ellipse(8,5,9,11,gold);line([-8,-6],[-8,-14]);path([[-8,-12],[1,-17],[2,-10]],green);line([8,-6],[11,-14]);break;
 case 'motel':rect(-17,2,34,13,blue);rect(-17,-8,4,25,cream);rect(-12,-4,10,6,cream);path([[-2,-2],[11,-2],[17,3],[17,9],[-2,9]],cream);line([17,8],[17,17]);break;
 default:rect(-14,-3,28,19,cream);path([[-18,-3],[-13,-15],[13,-15],[18,-3]],red);for(let i=-9;i<12;i+=6)line([i,-13],[i,-4]);rect(-3,5,8,11,blue);break;
 }
}
// Each non-food business gets a profession-specific illustrated character,
// not a food vendor with an unrelated name. The sign icon also identifies
// the business independently of the character's age or facial features.
const OCCUPATIONS={
 noodle:['cap','#b96b54','apron'],fish:['cap','#456f7d','apron'],tea:['long','#a57958','apron'],streetfood:['short','#a64c48','apron'],rice:['elder','#8a8462','apron'],fruit:['bun','#78965a','apron'],grocery:['short','#6c9a84','apron'],
 repair:['cap','#476e88','work'],laundry:['bun','#8b6795','casual'],electronics:['glasses','#496977','work'],
 pharmacy:['glasses','#e9e5d5','coat'],barber:['slick','#c77877','apron'],hardware:['helmet','#a4883e','work'],
 tailor:['bun','#a66a86','apron'],pawn:['glasses','#7f6754','suit'],internet:['headset','#465181','casual'],
 clinic:['short','#e7e6d9','coat'],flower:['long','#83a16d','apron'],printing:['cap','#576c83','work'],
 fortune:['elder','#a64c48','robe'],tattoo:['slick','#52465a','casual'],shoes:['short','#97704f','apron'],
 shipping:['cap','#4b8492','work'],motel:['bun','#986b85','suit'],generic:['short','#6f7882','casual']
};
function occupationPortrait(ctx,kind,seed,x,y,w,h,mono,saturation){
 const [hair,uniform,role]=OCCUPATIONS[kind]||OCCUPATIONS.generic;
 const variant=portraitVariant(seed),old=hair==='elder'||variant===5||variant===7,young=variant===2||variant===4||variant===9;
 const skin=['#eab17d','#c98b63','#f3c9a2','#d5a278'][variant%4],ink='#303039';
 const tone=c=>{if(mono)return c===ink?'#242424':c===skin?'#e6e6e2':'#777777';if(saturation>.5)return c;
  const n=c.match(/[0-9a-f]{2}/gi)?.map(v=>parseInt(v,16));if(!n)return c;const l=.2126*n[0]+.7152*n[1]+.0722*n[2];return 'rgb('+n.map(v=>Math.round((v+l)*.5)).join(',')+')';};
 const fit=Math.min(w/66,h/80);ctx.save();ctx.translate(x+w/2,y+h/2);ctx.scale((variant%3===1?-1:1)*fit,fit);
 const ellipse=(cx,cy,rx,ry,fill,stroke=null,width=1.6)=>{ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=tone(fill);ctx.fill();}if(stroke){ctx.strokeStyle=tone(stroke);ctx.lineWidth=width;ctx.stroke();}};
 const poly=(p,fill,stroke=ink,width=1.6)=>{ctx.beginPath();p.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();ctx.fillStyle=tone(fill);ctx.fill();if(stroke){ctx.strokeStyle=tone(stroke);ctx.lineWidth=width;ctx.stroke();}};
 const line=(p,col=ink,width=1.5)=>{ctx.beginPath();p.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.strokeStyle=tone(col);ctx.lineWidth=width;ctx.stroke();};
 const hairColor=old?'#a3a29e':variant===3?'#614135':'#33313a';
 const rx=young?18:variant%2?14:18,fy=young?-9:-12,ry=young?17:variant===8?22:20;
 if(hair==='bun')ellipse(1,-34,10,9,hairColor,ink);if(hair==='long')ellipse(0,-5,24,27,hairColor,ink);
 // Shoulders and clothing, with collars, seams and profession-specific uniforms.
 poly([[-7,5],[7,5],[10,11],[23,17],[30,36],[-30,36],[-23,17],[-10,11]],uniform);
 poly([[-6,3],[6,3],[8,15],[0,20],[-8,15]],skin);
 if(role==='coat'||role==='suit'||role==='work'){
  poly([[-9,11],[-17,16],[-8,29],[-2,18]],role==='coat'?'#f8f6ec':uniform);
  poly([[9,11],[17,16],[8,29],[2,18]],role==='coat'?'#f8f6ec':uniform);
  if(role==='suit')poly([[-3,18],[3,18],[5,29],[0,35],[-5,29]],'#b45e54');
 }else if(role==='apron'){poly([[-14,15],[-9,13],[-6,22],[6,22],[9,13],[14,15],[19,36],[-19,36]],'#e6d6b4');line([[-9,31],[9,31]],ink);}
 else if(role==='robe'){line([[-13,12],[11,35]],'#e1bd65',3);line([[13,12],[-2,27]],'#e1bd65',3);}
 if(role==='coat'||role==='work'){poly([[13,25],[22,25],[22,31],[13,31]],uniform,ink,1);line([[15,26],[20,26]],'#e4ba69');}
 // The face has a distinct silhouette, layered shading, ears, features and hair.
 ellipse(-rx,fy+2,4.3,6,skin,ink);ellipse(rx,fy+2,4.3,6,skin,ink);
 ellipse(0,fy,rx,ry,skin,ink,variant===1?2.2:1.4);
 if(!mono&&(variant===0||variant===8)&&typeof ctx.createRadialGradient==='function'){
  const g=ctx.createRadialGradient(-rx*.33,fy-ry*.42,2,0,fy,ry*1.15);
  g.addColorStop(0,tone('#ffe5c4'));g.addColorStop(.68,tone(skin));g.addColorStop(1,tone('#ae7056'));
  ctx.beginPath();ctx.ellipse(0,fy,rx-.8,ry-.8,0,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
 }
 ellipse(-rx*.48,fy+5,rx*.38,4,'#e9a09a');ellipse(rx*.48,fy+5,rx*.38,4,'#e9a09a');
 if(hair==='slick'){poly([[-rx-1,fy-2],[-rx-2,fy-12],[-8,fy-ry-2],[5,fy-ry-5],[rx+2,fy-15],[rx,fy-5],[4,fy-13],[-4,fy-9]],hairColor);}
 else if(hair==='elder'){ellipse(-rx+2,fy-9,5,9,hairColor);ellipse(rx-2,fy-9,5,9,hairColor);line([[-7,fy-17],[-2,fy-19],[4,fy-18]],hairColor,2);}
 else{poly([[-rx-1,fy-5],[-rx,fy-15],[-9,fy-ry-1],[5,fy-ry-2],[rx,fy-14],[rx+1,fy-4],[6,fy-12],[-3,fy-8],[-8,fy-13]],hairColor);}
 for(const side of [-1,1]){
  const ex=side*rx*.40;
  line([[ex-4,fy-4],[ex,fy-6],[ex+4,fy-4]],ink,1.8);
  if(variant===1||variant===6)line([[ex-3,fy],[ex,fy-2],[ex+3,fy]],ink,2);
  else{ellipse(ex,fy,3.4,young?4:2.6,'#faf3e5');ellipse(ex+side*.5,fy,1.9,2.3,ink);ellipse(ex+1,fy-1,0.7,0.7,'#ffffff');}
  if(old){line([[ex-4,fy+4],[ex,fy+5],[ex+3,fy+4]],'#936d60',.8);}
 }
 line([[1,fy-1],[3,fy+5],[0,fy+6]],'#9c6856',1.2);
 ctx.beginPath();ctx.moveTo(-6,fy+9);ctx.quadraticCurveTo(0,fy+17,6,fy+9);ctx.quadraticCurveTo(0,fy+11,-6,fy+9);ctx.fillStyle=tone('#723e39');ctx.fill();
 if(old){line([[-5,fy-11],[4,fy-11]],'#936d60',.9);line([[-4,fy+15],[4,fy+15]],'#936d60',.9);}
 if(hair==='glasses'){for(const a of [-7,7]){ctx.strokeStyle=tone(ink);ctx.lineWidth=1.8;ctx.strokeRect(a-5,fy-5,10,9);}line([[-2,fy-1],[2,fy-1]]);}
 if(hair==='headset'){ctx.beginPath();ctx.arc(0,fy-5,rx+5,Math.PI,2*Math.PI);ctx.strokeStyle=tone('#526171');ctx.lineWidth=3;ctx.stroke();ellipse(-rx-3,fy,3,7,'#526171',ink);ellipse(rx+3,fy,3,7,'#526171',ink);line([[rx+3,fy+5],[rx,fy+11],[7,fy+11]],ink,2);}
 if(hair==='cap'||hair==='helmet'){const c=hair==='helmet'?'#e4b24c':uniform;ellipse(0,fy-ry+4,rx+3,9,c,ink);poly([[-rx-3,fy-ry+5],[rx+3,fy-ry+5],[rx+7,fy-ry+10],[-rx-3,fy-ry+10]],c);if(hair==='helmet')line([[0,fy-ry-4],[0,fy-ry+4]],'#f4dc9a',2);}
 if(kind==='tattoo'){line([[-24,25],[-20,29],[-25,33]],'#d2c4be',2);}
 ctx.restore();
}

export function portraitVariant(seed){
 // All automatic portrait seeds are 4 modulo 5; do not use seed % 10.
 const n=Math.abs(seed|0);
 return (Math.floor(n/5)+(n%5)*3)%10;
}
export function signPortraitSeed(id){
 let hash=0;for(const ch of String(id??''))hash=(Math.imul(hash,31)+ch.charCodeAt(0))|0;
 return hash>>>0;
}
export function loadSignPortraits(){
 if(portraitLoad)return portraitLoad;
 if(typeof Image==='undefined'||typeof document==='undefined')return Promise.resolve(false);
 portraitLoad=new Promise(resolve=>{
  const image=new Image();
  image.onload=()=>{
   try{headCanvases(image);}catch(error){console.warn('Sign head extraction unavailable',error);}
   resolve(portraitHeads.length===10);
  };
  image.onerror=()=>{console.warn('Sign portrait sheet unavailable; using occupation illustration fallback');resolve(false);};
  image.src=new URL('../art/sign-portraits.webp',import.meta.url).href;
 });
 return portraitLoad;
}
const palettes=['#f4d565','#f1ead0','#f2a465','#cce9dc','#f2c9cb','#d4e3f4'];
const FONTS={
 hei:'"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif',
 ming:'"Noto Serif TC","PMingLiU","Songti TC","MingLiU",serif',
 kai:'"DFKai-SB","BiauKai","KaiTi","Kaiti TC",cursive',
 rounded:'"GenSenRounded TW","Yuanti TC","Microsoft JhengHei",sans-serif'
};
function saturated(hex,saturation){
 const c=hex.match(/[0-9a-f]{2}/gi)?.map(v=>parseInt(v,16)/255)||[.6,.3,.2],max=Math.max(...c),min=Math.min(...c),d=max-min,l=(max+min)/2;
 let h=d===0?0:max===c[0]?((c[1]-c[2])/d+6)%6:max===c[1]?(c[2]-c[0])/d+2:(c[0]-c[1])/d+4;
 return 'hsl('+Math.round(h*60)+' '+Math.round(saturation*100)+'% '+Math.round(Math.max(.26,Math.min(.68,l))*100)+'%)';
}
export function drawSignArtwork(ctx,x,y,w,h,{color='#965044',title='商店',subtitle='',vertical=false,aspect=2,seed=0,style='wild',font='hei',saturation=1,shopKind=''}={}){
 seed=Math.abs(seed|0);const W=vertical?96:Math.max(144,Math.min(960,96*aspect)),H=vertical?192:96;
 const accent=palettes[seed%palettes.length],base=saturated(color,saturation),family=FONTS[font]||FONTS.hei,kind=signShopKind(title,subtitle,shopKind);
 const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
 const circle=(x,y,r,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
 ctx.save();ctx.translate(x,y);ctx.scale(w/W,h/H);box(0,0,W,H,base);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 const text=(value,tx,ty,max,size,ink,weight='700',stroke=null)=>{ctx.font=weight+' '+size+'px '+family;ctx.fillStyle=ink;if(stroke){ctx.lineWidth=style==='wild'?3:1;ctx.strokeStyle=stroke;ctx.strokeText(value,tx,ty,max);}ctx.fillText(value,tx,ty,max);};
 const label=(area,ink,stroke=null,weight='700')=>{
  if(vertical){const glyphs=Array.from(title.split('・')[0]).slice(0,7),step=Math.min(29,area.h/Math.max(1,glyphs.length));glyphs.forEach((ch,i)=>text(ch,area.x+area.w/2,area.y+(i+.5)*step,area.w,Math.min(step*.94,area.w*.9),ink,weight,stroke));}
  else{text(title,area.x+area.w/2,area.y+area.h*.39,area.w,Math.min(area.h*.66,area.w*.32),ink,weight,stroke);if(subtitle)text(subtitle,area.x+area.w/2,area.y+area.h*.82,area.w,Math.min(13,area.h*.23),ink,'500');}
 };
 const graphic=(cx,cy,scale)=>{ctx.save();ctx.translate(cx,cy);ctx.scale(scale,scale);shopGraphic(ctx,kind);ctx.restore();};
 if(style==='icon'){
  const r=Math.min(W,H)*.40;circle(W/2,H/2,r,accent);graphic(W/2,H/2,r/23);ctx.restore();return;
 }
 if(style==='portrait'){
  const variant=portraitVariant(seed),mono=variant===5||variant===7;
  const ink='#fff4d7',outline='#252633';
  // No coloured panel, circular backdrop or rectangular image crop:
  // the illustration is transparent and sits directly on the same fill as the lettering.
  const band=vertical?Math.min(104,H*.53):Math.min(W*.41,H*.94),left=variant%3!==1;
  const img=vertical?{x:4,y:3,w:W-8,h:band-3}:{x:left?3:W-band+1,y:3,w:band-4,h:H-6};
  const area=vertical?{x:6,y:band+2,w:W-12,h:H-band-8}:{x:left?band+3:6,y:5,w:W-band-9,h:H-10};
  const faceW=img.w*.88,faceH=img.h*.88,faceX=img.x+(img.w-faceW)*.5,faceY=img.y;
  if(signPortraitSource(kind)!=='food-head'||!drawFoodHead(ctx,seed,faceX,faceY,faceW,faceH,saturation)){
   occupationPortrait(ctx,kind,seed,faceX,faceY,faceW,faceH,mono,saturation);
  }
  // A small transparent trade illustration replaces the original hot-pot prop.
  const iconScale=Math.min(img.w,img.h)/75;
  ctx.save();ctx.translate(img.x+img.w*.76,img.y+img.h*.79);ctx.scale(iconScale,iconScale);shopGraphic(ctx,kind);ctx.restore();
  ctx.strokeStyle=accent;ctx.lineWidth=1.5;ctx.strokeRect(2,2,W-4,H-4);
  label(area,ink,outline,mono?'700':'900');ctx.restore();return;
 }
 if(style==='cute'){
  box(5,5,W-10,H-10,'#fff1d5');for(let i=0;i<5;i++)circle((i*31+seed*11)%W,(i*37+seed*7)%H,7+(i%3)*3,accent);
  const cx=vertical?W/2:W*.15,cy=vertical?35:H/2;circle(cx,cy,Math.min(W,H)*.24,base);graphic(cx,cy,.85);
  label(vertical?{x:9,y:65,w:W-18,h:120}:{x:W*.30,y:10,w:W*.66,h:H-20},'#3a3037',null,'600');ctx.restore();return;
 }
 if(style==='handwritten'){
  box(5,5,W-10,H-10,'#eee2bb');ctx.strokeStyle=base;ctx.lineWidth=3;ctx.strokeRect(9,9,W-18,H-18);
  ctx.save();ctx.translate(W/2,H/2);ctx.transform(1,0,-.06,1,0,0);ctx.translate(-W/2,-H/2);
  label(vertical?{x:10,y:12,w:W-20,h:H-48}:{x:12,y:10,w:W-65,h:H-20},'#602c26',null,'700');ctx.restore();
  box(vertical?W-29:W-43,H-38,23,23,base);graphic(vertical?W-17:W-31,H-26,.40);ctx.restore();return;
 }
 // Wild type: high-contrast diagonal bands, outlined oversized Chinese lettering.
 ctx.fillStyle='#141820';ctx.beginPath();ctx.moveTo(0,H*.72);ctx.lineTo(W,0);ctx.lineTo(W,H*.26);ctx.lineTo(0,H);ctx.closePath();ctx.fill();
 const cx=vertical?W/2:W*.12,cy=vertical?25:H/2;circle(cx,cy,Math.min(W,H)*.19,accent);graphic(cx,cy,.72);
 label(vertical?{x:6,y:48,w:W-12,h:H-54}:{x:W*.24,y:3,w:W*.73,h:H-6},'#fff5d0','#17191d','900');ctx.restore();
}

 // Rooftop typography is drawn once into the existing atlas, not into
 // extra canvases, textures, meshes or dynamic lights per city sign.
export function rooftopSignMode(seed){return (seed>>>0)%5;}
export function drawRooftopSignArtwork(ctx,x,y,w,h,{color='#4c9ea1',title='商店',subtitle='',aspect=2,seed=0,style='wild',font='hei',saturation=1}={}){
 const W=Math.max(144,Math.min(960,96*aspect)),H=96,mode=rooftopSignMode(seed),base=saturated(color,saturation),family=FONTS[font]||FONTS.hei;
 const lightbox=mode===1||mode===4,neon=mode===3,ink=lightbox?'#181b21':neon?'#ffd6eb':'#fff4cf';
 const rect=(a,b,c,d,fill)=>{ctx.fillStyle=fill;ctx.fillRect(a,b,c,d);};
 ctx.save();ctx.translate(x,y);ctx.scale(w/W,h/H);
 rect(0,0,W,H,'#303438');rect(3,3,W-6,90,base);
 if(!lightbox)rect(3,3,W-6,90,'rgba(12,20,24,.53)');
 // Corrugated metal, folded edge rails and bolted lower steel frame are
 // painted into the original board envelope; collision and paint UV stay fixed.
 for(let i=4;i<W-3;i+=Math.max(5,W/36)){rect(i,4,1,70,'rgba(0,0,0,.17)');rect(i+1,4,1,70,'rgba(255,255,255,.10)');}
 rect(3,75,W-6,18,lightbox?'#34343b':'#20282d');
 ctx.strokeStyle='#697176';ctx.lineWidth=1.5;
 ctx.beginPath();ctx.moveTo(4,76);ctx.lineTo(W-4,76);ctx.moveTo(4,91);ctx.lineTo(W-4,91);
 for(let i=4;i<W-4;i+=W/6){const end=Math.min(W-4,i+W/6);ctx.moveTo(i,76);ctx.lineTo(end,91);ctx.moveTo(i,91);ctx.lineTo(i,76);}
 ctx.stroke();
 if(neon){ctx.strokeStyle='#f783bc';ctx.lineWidth=2;ctx.strokeRect(5,5,W-10,68);}
 else if(lightbox){rect(4,67,W-8,7,'#983e38');}
 const main=String(title||'商店'),glyphCount=Math.max(1,Array.from(main).length);
 const max=W-16,size=Math.min(subtitle?56:65,max/glyphCount*1.04);
 ctx.font=(style==='handwritten'?'700':'900')+' '+size+'px '+family;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 ctx.strokeStyle=lightbox?'rgba(255,255,255,.28)':'#172027';ctx.lineWidth=2.8;ctx.strokeText(main,W/2,subtitle?31:39,max);
 ctx.fillStyle=ink;ctx.fillText(main,W/2,subtitle?31:39,max);
 if(subtitle){ctx.font='700 12px '+family;ctx.fillStyle=lightbox?'#20232a':ink;ctx.fillText(String(subtitle),W/2,61,max);}
 ctx.restore();
}

// Shared clock: one scalar write per existing scene update. A vertex shader
// evaluates the phase per sign; no CPU sign loop or texture re-upload.
const rooftopClock={value:0};
export function updateRooftopSignClock(time){rooftopClock.value=time;}
export function installRooftopSignLighting(material,{batched=false,seed=0}={}){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>key+'-roof-light-v098-'+(batched?'batch':'single');
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.uniforms.uRoofClock=rooftopClock;
  if(!batched)shader.uniforms.uRoofMode={value:rooftopSignMode(seed)+1};
  if(!batched)shader.uniforms.uRoofPhase={value:(seed>>>0)%97*.73};
  shader.vertexShader='uniform float uRoofClock;\n'+(batched?'attribute vec3 roofSignLight;\n':'uniform float uRoofMode;\nuniform float uRoofPhase;\n')+'varying vec3 vRoofLight;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec3 roofInput=${batched?'roofSignLight':'vec3(uRoofMode,uRoofPhase,uv.x)'};
   float rt=uRoofClock+roofInput.y;
   float pulse=.83+.17*sin(rt*2.1);
   float broken=step(.27,fract(rt*.43))*step(.22,fract(rt*3.7));
   float mode=roofInput.x;
   float glow=mode<1.5?1.:(mode<2.5?pulse:(mode<3.5?broken:(mode<4.5?pulse:.05)));
   vRoofLight=vec3(mode,glow,roofInput.z);`);
  shader.fragmentShader='varying vec3 vRoofLight;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   if(vRoofLight.x>.5){
    float lamp=vRoofLight.y;
    if(vRoofLight.x>2.5&&vRoofLight.x<3.5&&vRoofLight.z<.48)lamp=1.;
    float lit=smoothstep(.12,.65,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)));
    diffuseColor.rgb*=mix(.46,1.22,clamp(lamp,0.,1.))*lit+1.-lit;
   }`);
  if(!batched)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   float roofLamp=vRoofLight.y;
   if(vRoofLight.x>2.5&&vRoofLight.x<3.5&&vRoofLight.z<.48)roofLamp=1.;
   totalEmissiveRadiance+=diffuseColor.rgb*roofLamp*.48;`);
 };
 material.needsUpdate=true;
}
