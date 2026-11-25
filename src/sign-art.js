// Deterministic graphic signage; no image downloads or per-frame canvas work.
const palettes=['#f4d565','#f1ead0','#f2a465','#cce9dc','#f2c9cb','#d4e3f4'];
function pictogram(ctx,kind){
 ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#19272b';ctx.fillStyle='#19272b';
 const line=(pts)=>{ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
 const ring=(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();};
 switch(kind%8){
  case 0:ctx.beginPath();ctx.arc(0,0,15,0,Math.PI);ctx.stroke();line([[-17,0],[17,0]]);line([[-8,-8],[-4,-18]]);line([[2,-8],[6,-18]]);break;
  case 1:line([[-14,0],[14,0]]);line([[0,-14],[0,14]]);ring(0,0,19);break;
  case 2:line([[-12,-8],[12,-8],[8,16],[-8,16],[-12,-8]]);line([[1,-8],[7,-19]]);line([[-15,-10],[15,-10]]);break;
  case 3:ctx.beginPath();ctx.moveTo(3,-19);ctx.lineTo(-12,3);ctx.lineTo(-2,3);ctx.lineTo(-6,19);ctx.lineTo(13,-5);ctx.lineTo(3,-5);ctx.closePath();ctx.fill();break;
  case 4:ctx.beginPath();ctx.ellipse(-3,0,14,8,0,0,Math.PI*2);ctx.stroke();line([[10,0],[19,-9],[19,9],[10,0]]);ctx.fillRect(-11,-2,3,3);break;
  case 5:ring(-9,8,6);ring(9,8,6);line([[-5,3],[13,-16]]);line([[5,3],[-13,-16]]);break;
  case 6:line([[-13,13],[8,-8],[4,-15],[13,-18],[18,-10],[11,-3],[-9,17],[-13,13]]);break;
  case 7:for(let i=0;i<5;i++){const t=i*Math.PI*2/5;ring(Math.cos(t)*10,Math.sin(t)*10,6);}ring(0,0,3);break;
 }
}
export function drawSignArtwork(ctx,x,y,w,h,{color='#965044',title='商店',subtitle='',vertical=false,seed=0}={}){
 const W=vertical?96:192,H=vertical?192:96,accent=palettes[Math.abs(seed)%palettes.length],mode=Math.abs(seed)%3;
 ctx.save();ctx.translate(x,y);ctx.scale(w/W,h/H);
 ctx.fillStyle=color;ctx.fillRect(0,0,W,H);
 ctx.fillStyle=mode===0?'#17292b':mode===1?'#24364e':'#392d31';
 ctx.fillRect(4,4,W-8,H-8);
 ctx.fillStyle=color;
 if(vertical){ctx.fillRect(6,6,84,H-12);ctx.fillStyle=accent;ctx.fillRect(7,7,82,43);ctx.fillRect(7,H-14,82,7);}
 else{ctx.fillRect(6,6,W-12,H-12);ctx.fillStyle=accent;ctx.fillRect(7,7,51,H-14);ctx.fillRect(62,H-15,W-69,8);}
 ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.strokeRect(4,4,W-8,H-8);
 ctx.save();ctx.translate(vertical?48:32,vertical?29:47);pictogram(ctx,Math.abs(seed)%8);ctx.restore();
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff6df';ctx.strokeStyle='#152327';ctx.lineWidth=1.1;
 const text=(value,tx,ty,max)=>{ctx.strokeText(value,tx,ty,max);ctx.fillText(value,tx,ty,max);};
 if(vertical){const glyphs=Array.from(title.split('・')[0]).slice(0,7);const step=Math.min(25,121/Math.max(1,glyphs.length));ctx.font='bold '+Math.max(14,Math.min(22,step*.93))+'px sans-serif';glyphs.forEach((ch,i)=>text(ch,48,59+(i+.5)*step,75));}
 else{ctx.font='bold 20px sans-serif';text(title,123,36,118);ctx.fillStyle=accent;ctx.font='bold 10px sans-serif';text(subtitle||'SHOP',123,62,117);}
 ctx.restore();
}
