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
function portrait(ctx,seed){
 const skin=['#eeb67e','#cc8861','#f7d2ad'][seed%3];
 ctx.fillStyle='#252633';ctx.beginPath();ctx.ellipse(0,13,18,19,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(0,-3,13,18,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#29272b';ctx.beginPath();ctx.ellipse(-2,-15,15,8,-.18,0,Math.PI*2);ctx.fill();
 for(const x of [-5,5]){ctx.beginPath();ctx.arc(x,-4,1.6,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle='#963c38';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,2,5,.2,Math.PI-.2);ctx.stroke();
 if(seed%2){ctx.strokeStyle='#293b43';ctx.lineWidth=2;ctx.strokeRect(-11,-8,9,7);ctx.strokeRect(2,-8,9,7);ctx.beginPath();ctx.moveTo(-2,-5);ctx.lineTo(2,-5);ctx.stroke();}
}
export function drawSignArtwork(ctx,x,y,w,h,{color='#965044',title='商店',subtitle='',vertical=false,aspect=2,seed=0,style='wild',font='hei',saturation=1}={}){
 seed=Math.abs(seed|0);const W=vertical?96:Math.max(144,Math.min(960,96*aspect)),H=vertical?192:96;
 const accent=palettes[seed%palettes.length],base=saturated(color,saturation),family=FONTS[font]||FONTS.hei;
 const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
 const circle=(x,y,r,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
 ctx.save();ctx.translate(x,y);ctx.scale(w/W,h/H);box(0,0,W,H,base);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 const text=(value,tx,ty,max,size,ink,weight='700',stroke=null)=>{ctx.font=weight+' '+size+'px '+family;ctx.fillStyle=ink;if(stroke){ctx.lineWidth=style==='wild'?3:1;ctx.strokeStyle=stroke;ctx.strokeText(value,tx,ty,max);}ctx.fillText(value,tx,ty,max);};
 const label=(area,ink,stroke=null,weight='700')=>{
  if(vertical){const glyphs=Array.from(title.split('・')[0]).slice(0,7),step=Math.min(29,area.h/Math.max(1,glyphs.length));glyphs.forEach((ch,i)=>text(ch,area.x+area.w/2,area.y+(i+.5)*step,area.w,Math.min(step*.94,area.w*.9),ink,weight,stroke));}
  else{text(title,area.x+area.w/2,area.y+area.h*.39,area.w,Math.min(area.h*.66,area.w*.32),ink,weight,stroke);if(subtitle)text(subtitle,area.x+area.w/2,area.y+area.h*.82,area.w,Math.min(13,area.h*.23),ink,'500');}
 };
 const graphic=(cx,cy,scale,face=false)=>{ctx.save();ctx.translate(cx,cy);ctx.scale(scale,scale);if(face)portrait(ctx,seed);else pictogram(ctx,seed);ctx.restore();};
 if(style==='icon'){
  const r=Math.min(W,H)*.40;circle(W/2,H/2,r,accent);graphic(W/2,H/2,r/23);ctx.restore();return;
 }
 if(style==='portrait'){
  const cx=vertical?W/2:W*.20,cy=vertical?49:H/2,r=Math.min(W,H)*.42;circle(cx,cy,r,'#f5dfb7');graphic(cx,cy,r/22,true);
  label(vertical?{x:8,y:94,w:W-16,h:91}:{x:W*.40,y:5,w:W*.57,h:H-10},'#fff4d7','#252633');ctx.restore();return;
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
