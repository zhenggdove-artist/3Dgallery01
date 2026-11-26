// Fourteen materially distinct wing artworks. Quality determines detail,
// never the pigment. The canvas represents the avatar's LEFT wing.
const cache=new Map();
const P=Math.PI*2;
export function craftedWingCanvas(item){
 const key=item.id+':'+item.motif;
 if(cache.has(key))return cache.get(key);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=640;
 const c=canvas.getContext('2d'),motif=item.motif||'wood';
 let state=0x9e3779b9;
 for(let i=0;i<key.length;i++)state=(Math.imul(state^key.charCodeAt(i),1664525)+1013904223)>>>0;
 const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const fill=(color)=>{c.fillStyle=color;c.fill();};
 const line=(x,y,xx,yy,color='#394151',w=2)=>{c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=w;c.stroke();};
 const path=(pts,col,stroke='#1c2736',w=2)=>{
  c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  if(col)fill(col);if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}
 };
 const ellipse=(x,y,rx,ry,col,rot=0,border=null,w=2)=>{
  c.beginPath();c.ellipse(x,y,Math.max(.2,rx),Math.max(.2,ry),rot,0,P);fill(col);
  if(border){c.strokeStyle=border;c.lineWidth=w;c.stroke();}
 };
 const curve=(a,b,d,e,f,g,color,w=3)=>{
  c.beginPath();c.moveTo(a,b);c.bezierCurveTo(d,e,f,g,f,g);
  c.strokeStyle=color;c.lineWidth=w;c.stroke();
 };
 const feather=(x,y,tipX,tipY,width,color,trim)=>{
  const dx=tipX-x,dy=tipY-y,dir=Math.atan2(dy,dx)+Math.PI/2,nx=Math.cos(dir)*width,ny=Math.sin(dir)*width;
  c.beginPath();c.moveTo(x,y);
  c.bezierCurveTo(x+dx*.27+nx,y+dy*.27+ny,tipX+nx*.75,tipY+ny*.75,tipX,tipY);
  c.bezierCurveTo(tipX-nx*.75,tipY-ny*.75,x+dx*.26-nx,y+dy*.26-ny,x,y);
  c.closePath();fill(color);c.strokeStyle=trim;c.lineWidth=2;c.stroke();
  line(x,y,tipX,tipY,trim,1.4);
  for(let j=1;j<7;j++){
   const t=j/8,px=x+dx*t,py=y+dy*t;
   line(px,py,px+nx*(1-t)*.72,py+ny*(1-t)*.72,trim,.65);
   line(px,py,px-nx*(1-t)*.72,py-ny*(1-t)*.72,trim,.65);
  }
 };
 const eye=(x,y,r,iris='#50cfb7',base='#edbd91')=>{
  ellipse(x,y,r*1.3,r*.82,'#201d29',-.12);
  ellipse(x,y,r*1.12,r*.7,base,-.12);
  ellipse(x,y,r*.63,r*.67,iris,-.12,'#2a3b49',2);
  ellipse(x+r*.13,y,r*.27,r*.49,'#080c15');
  ellipse(x-r*.13,y-r*.22,r*.11,r*.14,'#ffffff');
 };
 const wingMembrane=(a='#143d52',b='#29b2ae')=>{
  const g=c.createLinearGradient(90,450,690,45);g.addColorStop(0,a);g.addColorStop(.56,b);g.addColorStop(1,a);
  c.beginPath();c.moveTo(68,366);
  c.bezierCurveTo(112,188,315,15,595,49);
  c.bezierCurveTo(729,24,711,220,660,285);
  c.bezierCurveTo(711,373,629,399,610,450);
  c.bezierCurveTo(614,540,551,564,521,478);
  c.bezierCurveTo(347,571,147,488,68,366);c.closePath();
  fill(g);c.strokeStyle=a;c.lineWidth=10;c.stroke();
 };
 c.lineCap='round';c.lineJoin='round';
 if(motif==='wood'){
  // Uneven bare timber, rope ties and exposed nails.
  for(let i=0;i<8;i++){
   const x=140+i*60,y=420-i*45+rand()*20;
   c.save();c.translate(95,390);c.rotate(-.39+rand()*.28);
   const w=350+i*19,h=22+rand()*16;
   path([[0,i*13],[w,i*13-25],[w+8,i*13+h],[5,i*13+h+5]],i%3?'#9e7250':'#bd9e72','#483e31',4);
   for(let j=0;j<8;j++)line(15+j*34,i*13+rand()*h,55+j*34,i*13+rand()*h,'#72583f',1);
   ellipse(18,i*13+10,4,4,'#313a42');ellipse(w-9,i*13+4,4,4,'#313a42');c.restore();
  }
  for(let i=0;i<6;i++)line(105,392-i*3,430+i*24,195+i*25,'#e1bd79',4);
 }else if(motif==='balloon'){
  // Three balloons on EACH side of the avatar; this texture is mirrored.
  for(let i=0;i<3;i++){
   const cx=334+i*138,cy=178+(i%2)*71,ry=85-i*4,rx=55+i*3;
   c.beginPath();c.moveTo(75,378);c.quadraticCurveTo(cx-38,350,cx,cy+ry);
   c.strokeStyle='#8b7b7b';c.lineWidth=3;c.stroke();
   const gradient=c.createRadialGradient(cx-rx*.35,cy-ry*.4,4,cx,cy,ry);
   const colors=[['#fffbc0','#fa6a6c'],['#e7f7ff','#4ab1df'],['#fff5ed','#eac54b']][i];
   gradient.addColorStop(0,colors[0]);gradient.addColorStop(1,colors[1]);
   ellipse(cx,cy,rx,ry,gradient,-.2,'#fffaf0',3);
   ellipse(cx-20,cy-31,10,22,'#ffffff88',-.4);
   path([[cx-7,cy+ry],[cx+7,cy+ry],[cx,cy+ry+13]],'#d5a1a1');
  }
  ellipse(96,392,16,13,'#e8b89d');line(86,391,117,404,'#f6e3b5',7);
 }else if(motif==='rag'){
  for(let j=0;j<7;j++){
   const x=150+j*74,y=224+(j%3)*72;
   const col=['#815b6a','#c39b7b','#4f8085','#d0be9d','#a05d55','#7a8980','#b8a4a0'][j];
   path([[77,370],[x-48,y-81],[x+101,y-123],[x+121,y-32],[x+78,y+59],[x+23,y+45]],col,'#645b57',3);
   for(let k=0;k<17;k++)line(x-33+k*6,y+35,x-33+k*6+rand()*10,y+50+rand()*22,col,1.1);
   for(let k=0;k<12;k++)ellipse(x+k*7,y-k*9,1.9,1.7,'#dfd5bd');
  }
  for(let i=0;i<9;i++)line(87,365,249+i*34,120+i*32,'#ddd2b5',1.1);
 }else if(motif==='tin'){
  for(let j=0;j<9;j++){
   const x=130+j*63,y=86+(j%4)*77;
   const col=['#657784','#a5abb0','#8f735f','#6e9295','#b3b4a5'][j%5];
   path([[70,372],[x,y+45],[x+55,y],[x+116,y+21],[x+97,y+100],[x+40,y+137]],col,'#3a4148',5);
   for(let k=0;k<5;k++)ellipse(x+19+(k%3)*24,y+36+Math.floor(k/3)*27,4,4,'#3a4449',0,'#ebd7b9',1.3);
   for(let k=0;k<8;k++)line(x+rand()*70,y+rand()*90,x+rand()*90,y+rand()*90,'#e1dfd370',1);
  }
 }else if(motif==='tape'){
  const tapes=['#ebead6bb','#8ad7ee99','#e8b2d999','#f4d48fba','#ddd9f0aa'];
  for(let i=0;i<14;i++){
   const x=120+i*37,y=82+(i%5)*72;
   c.save();c.translate(x,y);c.rotate(-.65+(i%5)*.22);
   c.fillStyle=tapes[i%5];c.fillRect(-40,-10,270+rand()*100,20+rand()*18);
   c.strokeStyle='#c7c1ae';c.lineWidth=1;c.strokeRect(-40,-10,270,20);
   for(let k=0;k<13;k++)line(k*17,-7,k*17+9,12,'#ffffff66',1);
   c.restore();
  }
  for(let k=0;k<4;k++)path([[90,340+k*20],[600,60+k*38],[619,81+k*38],[106,367+k*21]],'#e7dfbd8c','#adaca3',2);
 }else if(motif==='chicken'){
  for(let row=0;row<5;row++)for(let i=0;i<10;i++){
   const x=110+i*49,y=388-row*42;
   feather(85+row*13,385+row*9,x+32,y-120-row*33,13+row*3,
    ['#f4e9d4','#b7a38b','#eee5d9','#a18b75'][i%4],'#786b61');
  }
  for(let i=0;i<18;i++)ellipse(180+i*21,260+Math.sin(i*1.9)*35,2.5,3.5,'#fffdf3');
 }else if(motif==='plastic'){
  wingMembrane('#539cae','#dcfbff');
  for(let i=0;i<9;i++){
   const x=130+i*66,y=70+(i%3)*50;
   path([[86,368],[x,y],[x+rand()*70+80,y+30],[x+108,y+135],[290+i*29,493]],
    ['#bffaff66','#ffd6f277','#8ce3ff77','#ffffff88'][i%4],'#ffffffa0',1.4);
  }
  for(let i=0;i<26;i++)line(105+rand()*480,105+rand()*370,190+rand()*480,85+rand()*370,'#ffffff88',1);
 }else if(motif==='fur'){
  wingMembrane('#6e5346','#c7aa8d');
  for(let row=0;row<14;row++)for(let j=0;j<20;j++){
   const x=130+j*27+(row%2)*8,y=74+row*30;
   if(Math.hypot((x-330)/340,(y-300)/270)>1)continue;
   feather(80+rand()*130,365+rand()*30,x+rand()*30,y-55-rand()*30,5+rand()*7,
    ['#d8c5ae','#745b4d','#b18a6f','#f0dfce'][j%4],'#6a5147');
  }
  for(let i=0;i<120;i++){const x=128+rand()*510,y=88+rand()*410;
   line(x,y,x+2+rand()*8,y-7-rand()*12,i%2?'#eee0cb':'#6c524a',.8);}
 }else if(motif==='koinobori'){
  for(let i=0;i<3;i++){
   const x=95,y=260+i*47,tip=575+i*42;
   path([[x,y],[tip,y-124+i*12],[tip+43,y-77+i*12],[tip,y-36+i*12],[x,y+45]],
    ['#f0eee4','#e24e42','#315b93'][i],'#d8d2ba',4);
   for(let j=0;j<13;j++)for(let k=0;k<3;k++){
    const sx=220+j*22,sy=y-65+k*20+i*4;
    c.beginPath();c.arc(sx,sy,13,0,Math.PI);c.strokeStyle=i===2?'#f4d396':'#ffffffb0';c.lineWidth=2;c.stroke();
   }
   ellipse(154,y-23,18,18,'#f6d8a0',0,'#202839',3);ellipse(158,y-24,6,7,'#18202b');
   for(let k=0;k<3;k++)line(tip+43,y-77,tip+117-k*16,y-102+k*30,'#e9d4b6',5);
  }
 }else if(motif==='peacock'){
  // Highest detail: radial fans, hundreds of feather filaments and layered ocelli.
  for(let i=0;i<15;i++){
   const a=-1.45+i*.115,tipX=405+Math.cos(a)*290,tipY=320+Math.sin(a)*275;
   feather(84,379,tipX,tipY,18,'#0b7069','#c7bd73');
   ellipse(tipX,tipY,22,32,'#ccaf6a',a,'#12544b',3);
   ellipse(tipX,tipY,16,25,'#153b8d',a);
   ellipse(tipX,tipY,10,15,'#21cdb8',a);
   ellipse(tipX,tipY,5,9,'#0b182f',a);
  }
  for(let i=0;i<28;i++){
   const y=80+(i%7)*75,x=212+Math.floor(i/7)*95;
   feather(70,371,x+Math.sin(i)*33,y,15,'#0b8f81','#e4c176');
  }
  for(let i=0;i<210;i++)ellipse(130+rand()*550,70+rand()*420,1+rand()*2,2,'#d5f4c5aa');
 }else if(motif==='swan'){
  wingMembrane('#d1d9e7','#ffffff');
  for(let row=0;row<7;row++)for(let j=0;j<15;j++){
   const x=142+j*31+(row%2)*14,y=140+row*44;
   feather(75+row*14,390,x+26,y-73,14+row*1.6,
    row%3===0?'#fdfdfb':'#d9e3f0','#839cb2');
  }
  for(let i=0;i<90;i++){
   const x=110+rand()*540,y=70+rand()*430;
   ellipse(x,y,1+rand()*3,1+rand()*4,'#fffef9aa');
  }
  line(65,369,465,120,'#fffefa',13);
  for(let i=0;i<26;i++)ellipse(180+i*14,280+Math.sin(i*1.3)*22,4,6,'#dbeafe');
 }else if(motif==='cyberpunk'){
  wingMembrane('#101124','#4a216e');
  for(let i=0;i<21;i++){
   const x=105+(i%7)*84,y=70+Math.floor(i/7)*124;
   path([[88,372],[x,y+38],[x+76,y],[x+92,y+62],[x+41,y+91]],
    ['#171a30','#3b275f','#162c48','#2a144a'][i%4],i%3===0?'#03f6f6':'#f34dff',3);
   for(let k=0;k<5;k++)line(x+8+k*13,y+24,x+20+k*13,y+47,i%2?'#00f6c6':'#fc5dff',1.4);
   ellipse(x+24,y+39,4,4,'#d2fffa');
  }
  for(let i=0;i<10;i++){
   line(86,368-i*3,680,75+i*47,i%2?'#fc4cfe':'#02f7eb',i%3===0?4:1.6);
   for(let j=0;j<9;j++){const x=120+j*59,y=366-i*3+(75+i*47-(366-i*3))*(x-86)/594;
    ellipse(x,y,2.5,2.5,i%2?'#8afaff':'#ffc3fa');}
  }
  for(let k=0;k<135;k++)ellipse(145+rand()*510,85+rand()*420,1.1,1.1,k%2?'#42ffff':'#ff74fd');
 }else if(motif==='steampunk'){
  wingMembrane('#4b3026','#a06e3e');
  for(let i=0;i<11;i++){
   const x=140+i*49,y=100+(i%4)*75,r=15+i%3*9;
   c.save();c.translate(x,y);c.rotate(i*.27);
   for(let j=0;j<14;j++){c.rotate(P/14);c.fillStyle='#ac8d55';c.fillRect(r-5,-3,13,6);}
   ellipse(0,0,r,r,'#ad884e',0,'#34282a',4);
   ellipse(0,0,r*.57,r*.57,'#3b2e2d',0,'#e8c57a',3);
   ellipse(0,0,r*.19,r*.19,'#ffe1a0');c.restore();
  }
  for(let i=0;i<12;i++){
   const x=90+i*47,y=340-i*20;
   path([[90,371],[x,y-77],[x+91,y-51],[x+70,y+43]],i%2?'#895b3f':'#4f3c36','#d6ae60',5);
   for(let j=0;j<4;j++)ellipse(x+12+j*14,y-33,3,3,'#e8c47c');
  }
  for(let j=0;j<8;j++){const y=110+j*52;line(70,360,640,y,'#f2ba65',2);
   for(let i=0;i<7;i++)ellipse(140+i*75,333+(y-360)*((140+i*75-70)/570),3,3,'#ffe1ae');}
  ellipse(454,289,67,67,'#bb9e65',0,'#322a23',6);
  ellipse(454,289,48,48,'#ecdeba',0,'#6c5438',4);
  for(let h=0;h<12;h++){const a=h*P/12;line(454+Math.cos(a)*40,289+Math.sin(a)*40,454+Math.cos(a)*46,289+Math.sin(a)*46,'#4f392c',2);}
  line(454,289,454,253,'#2e2b28',3);line(454,289,477,304,'#2e2b28',2);
 }else if(motif==='monster'){
  wingMembrane('#351329','#8d2847');
  for(let i=0;i<18;i++){
   const y=100+(i%6)*73,x=155+Math.floor(i/6)*175;
   c.beginPath();c.moveTo(78,368);c.quadraticCurveTo(260+i*11,275+i*9,x,y);
   c.strokeStyle=i%2?'#e9566a':'#36101b';c.lineWidth=4+i%4;c.stroke();
  }
  for(let j=0;j<23;j++){
   const x=164+(j%6)*89,y=99+Math.floor(j/6)*106+(j%2)*17;
   eye(x,y,13+j%4*6,['#e2b63a','#7ffaab','#5acaff','#ff5b77'][j%4],'#efe1c0');
   for(let k=0;k<4;k++)line(x-40+k*8,y+17,x-36+k*8,y+26,'#f1b08d',1.5);
  }
  for(let j=0;j<10;j++){
   const x=172+j*47;
   path([[x,477],[x+15,531+rand()*55],[x+26,480]],'#e0c1a2','#702c38',2);
  }
  for(let k=0;k<100;k++)ellipse(110+rand()*565,67+rand()*460,1.5+rand()*3,1.7,'#f5b0b36b');
 }else wingMembrane(item.color||'#5498a3',item.accent||'#b4dec4');
 // Shared mechanical cuff that anchors the art to the character's back.
 if(!['balloon','tape'].includes(motif)){
  path([[60,351],[111,339],[128,399],[70,414]],motif==='steampunk'?'#6b462d':'#424455','#e6d7bc',4);
  for(let i=0;i<3;i++)ellipse(84+i*13,375,3.8,3.8,'#efce80',0,'#4b3c33',1);
 }
 cache.set(key,canvas);return canvas;
}
