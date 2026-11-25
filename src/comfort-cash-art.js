// Locally authored vector illustration of a thick stack of US dollar bills.
// Shared image across SHOP, BAG and 1/2/3 quick-use slots; zero WebGL setup.
const CACHE=new Map();
export function comfortCashImage(item){
 if(item?.slot!=='consumable')return null;
 if(CACHE.has(item.id))return CACHE.get(item.id);
 const palette={
  20:{face:'#8adb9a',edge:'#397951',ink:'#16452c',accent:'#d1f7b2'},
  50:{face:'#8ad0ff',edge:'#386eab',ink:'#1c4373',accent:'#e8f8ff'},
  100:{face:'#ff9d99',edge:'#aa4545',ink:'#752424',accent:'#ffe8ca'}
 };
 const den=Math.max(20,Math.min(100,Number(item.denomination)||20));
 const p=palette[den]||palette[20];
 // Every banknote is a full outlined, shaded portrait-scale dollar bill.
 // Four visible bottom layers make the icon read as a STACK, not one flat card.
 const layers=Array.from({length:5},(_,i)=>{
  const y=26-i*6,x=17+i*2;
  return `<g transform="translate(${x} ${y}) rotate(-10 100 100)">
   <rect x="5" y="61" width="176" height="94" rx="6" fill="${p.edge}" stroke="#193b35" stroke-width="2"/>
   <rect x="9" y="65" width="168" height="86" rx="4" fill="${p.face}" stroke="#f5ffdf" stroke-width="2"/>
   <rect x="16" y="72" width="154" height="72" rx="3" fill="none" stroke="${p.ink}" stroke-width="2"/>
   <path d="M23 83 H163 M23 134 H163" stroke="${p.ink}" stroke-width="1" opacity=".65"/>
   <rect x="82" y="72" width="48" height="72" fill="${p.accent}" fill-opacity=".35"/>
   <ellipse cx="106" cy="108" rx="24" ry="30" fill="${p.edge}" fill-opacity=".20" stroke="${p.ink}" stroke-width="1.6"/>
   <text x="106" y="119" font-size="37" font-family="Georgia,serif" font-weight="700" text-anchor="middle" fill="${p.ink}">$​</text>
   <text x="22" y="93" font-size="15" font-family="Georgia,serif" font-weight="700" fill="${p.ink}">${den}</text>
   <text x="145" y="137" font-size="15" font-family="Georgia,serif" font-weight="700" fill="${p.ink}">${den}</text>
   <text x="105" y="83" font-size="6.3" font-family="sans-serif" letter-spacing="1.1" text-anchor="middle" fill="${p.ink}">UNITED STATES OF AMERICA</text>
   <text x="105" y="139" font-size="6.5" font-family="sans-serif" letter-spacing=".8" text-anchor="middle" fill="${p.ink}">FEDERAL RESERVE NOTE</text>
  </g>`;
 }).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="230" height="220" viewBox="0 0 230 220" role="img" aria-label="Stack of ${den} dollar bills">
  <defs><filter id="shadow" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="1" dy="7" stdDeviation="6" flood-color="#0d2030" flood-opacity=".3"/></filter></defs>
  <g filter="url(#shadow)">${layers}</g>
  <rect x="32" y="174" width="158" height="15" rx="6" transform="rotate(-10 110 180)" fill="${p.ink}" opacity=".75"/>
  <text x="110" y="186" transform="rotate(-10 110 180)" font-size="11" font-family="Arial,sans-serif" font-weight="800" letter-spacing="1.3" text-anchor="middle" fill="#ffffff">$ ${den} · CASH</text>
 </svg>`;
 const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 CACHE.set(item.id,url);
 return url;
}

// World loot is real layered geometry, not the legacy RELETTER staff sprite.
// One atlas per denomination; geometry/material are instanced for each pile.
const DROP_PALETTES={
 20:{paper:'#b8e2a7',light:'#eaf4cb',ink:'#235039',dark:'#173b29',edge:'#7eaa70',seal:'#397f48',effect:'HP +30%'},
 50:{paper:'#a4d8fa',light:'#e6f5ff',ink:'#245484',dark:'#17375e',edge:'#659cc6',seal:'#287ac2',effect:'MP +50%'},
 100:{paper:'#f5a9a3',light:'#fff0d4',ink:'#8c3532',dark:'#632625',edge:'#c77d70',seal:'#b34c40',effect:'HP +100%'}
};
const dropAtlases=new Map();
export function drawCashDropAtlas(ctx,den){
 const p=DROP_PALETTES[den];if(!p)throw Error('Unknown restorative denomination');
 const w=1024,h=448;
 const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,p.light);grad.addColorStop(.46,p.paper);grad.addColorStop(1,p.edge);ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=p.ink;ctx.strokeStyle=p.ink;ctx.lineWidth=8;ctx.strokeRect(17,17,w-34,h-34);
 ctx.lineWidth=2;for(let i=0;i<4;i++)ctx.strokeRect(28+i*5,28+i*5,w-56-i*10,h-56-i*10);
 // Interwoven engraved border, fine security lines, corner rosettes.
 for(let i=0;i<9;i++){ctx.beginPath();for(let x=47;x<=977;x+=3){const y=61+i*2.7+6*Math.sin(x*.073+i*.69);x===47?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();ctx.beginPath();for(let x=47;x<=977;x+=3){const y=387+i*2.7+6*Math.sin(x*.073+i*.69);x===47?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}
 ctx.lineWidth=1.3;ctx.globalAlpha=.35;for(let y=104;y<371;y+=7){ctx.beginPath();for(let x=55;x<969;x+=8){const yy=y+3*Math.sin(x*.035+y*.021);x===55?ctx.moveTo(x,yy):ctx.lineTo(x,yy);}ctx.stroke();}ctx.globalAlpha=1;
 const rosette=(x,y,r)=>{ctx.save();ctx.translate(x,y);for(let k=0;k<20;k++){ctx.rotate(Math.PI/10);ctx.beginPath();ctx.ellipse(0,0,r,r*.38,0,0,Math.PI*2);ctx.stroke();}ctx.restore();};
 ctx.lineWidth=1.8;for(const x of [102,922])for(const y of [112,334])rosette(x,y,45);
 ctx.textAlign='center';ctx.fillStyle=p.dark;ctx.font='bold 39px Georgia,serif';ctx.fillText('UNITED STATES OF AMERICA',512,111);
 ctx.font='bold 17px Georgia,serif';ctx.fillText('COMFORT FOR THE SOUL · TEMPLE RESERVE',512,136);
 // Original engraved fictional portrait, not a scanned banknote.
 ctx.save();ctx.translate(510,238);ctx.beginPath();ctx.ellipse(0,0,110,100,0,0,Math.PI*2);ctx.fillStyle=p.light;ctx.fill();ctx.strokeStyle=p.dark;ctx.lineWidth=4;ctx.stroke();
 ctx.save();ctx.clip();ctx.strokeStyle=p.ink;ctx.lineWidth=1;for(let y=-100;y<100;y+=4){ctx.beginPath();ctx.moveTo(-120,y);ctx.lineTo(120,y+12);ctx.stroke();}
 ctx.fillStyle=p.dark;ctx.beginPath();ctx.moveTo(-93,103);ctx.quadraticCurveTo(-85,54,-29,47);ctx.lineTo(-24,25);ctx.quadraticCurveTo(-55,8,-52,-29);ctx.quadraticCurveTo(-53,-76,-4,-80);ctx.quadraticCurveTo(45,-77,48,-29);ctx.lineTo(58,-9);ctx.lineTo(45,-3);ctx.quadraticCurveTo(47,22,23,30);ctx.lineTo(27,49);ctx.quadraticCurveTo(81,55,97,103);ctx.closePath();ctx.fill();
 ctx.fillStyle=p.paper;ctx.beginPath();ctx.moveTo(-28,-43);ctx.quadraticCurveTo(-13,-57,17,-47);ctx.lineTo(34,-25);ctx.lineTo(43,-8);ctx.lineTo(31,-4);ctx.lineTo(28,15);ctx.quadraticCurveTo(9,32,-14,14);ctx.quadraticCurveTo(-28,0,-28,-43);ctx.fill();ctx.fillStyle=p.dark;ctx.fillRect(12,-28,15,3);ctx.fillRect(16,9,13,2);
 ctx.strokeStyle=p.light;ctx.lineWidth=2;for(let k=0;k<10;k++){ctx.beginPath();ctx.moveTo(-80+k*11,99);ctx.lineTo(-35+k*7,57);ctx.stroke();}ctx.restore();ctx.restore();
 ctx.strokeStyle=p.seal;ctx.lineWidth=2;rosette(272,225,58);ctx.fillStyle=p.seal;ctx.font='bold 38px Georgia,serif';ctx.fillText('$',272,239);
 ctx.fillStyle=p.dark;ctx.font='bold 72px Georgia,serif';ctx.fillText(String(den),112,145);ctx.fillText(String(den),912,367);
 ctx.font='bold 23px monospace';ctx.textAlign='left';ctx.fillText('GT 048592 '+den,75,295);ctx.textAlign='center';ctx.font='bold 30px Georgia,serif';ctx.fillText(den+' DOLLARS',512,371);
 ctx.font='bold 29px monospace';ctx.fillText(p.effect,801,226);ctx.font='17px Georgia,serif';ctx.fillText('GGTEMPLE',801,255);
 // Atlas lower strip: layered cut paper and a separate cream security band.
 ctx.fillStyle=p.edge;ctx.fillRect(0,448,1024,64);for(let y=450;y<512;y+=4){ctx.fillStyle=y%8===2?p.light:p.paper;ctx.fillRect(0,y,768,1.5);}
 ctx.fillStyle='#f2e6bf';ctx.fillRect(768,448,256,64);ctx.fillStyle=p.seal;ctx.fillRect(778,450,12,60);ctx.fillRect(1002,450,12,60);ctx.font='bold 21px Georgia,serif';ctx.textAlign='center';ctx.fillText('TEMPLE $'+den,896,486);
}
export function createCashDropGeometry(T){
 const pos=[],norm=[],uv=[];
 // Box face UV groups are ordered +X,-X,+Y,-Y,+Z,-Z. The atlas is
 // authored in canvas top-down coordinates; WebGL V is bottom-up.
 function part(x,y,z,w,h,d,angle=0,band=false){
  const box=new T.BoxGeometry(w,h,d),source=box.toNonIndexed();box.dispose();const p=source.attributes.position,n=source.attributes.normal,u=source.attributes.uv;
  const c=Math.cos(angle),s=Math.sin(angle);
  for(let i=0;i<p.count;i++){const face=Math.floor(i/6),a=p.getX(i),b=p.getZ(i),nx=n.getX(i),nz=n.getZ(i);
   pos.push(x+c*a+s*b,y+p.getY(i),z-s*a+c*b);norm.push(c*nx+s*nz,n.getY(i),-s*nx+c*nz);
   const top=face===2||face===3,region=band?[.755,.88,.99,.995]:top?[.003,.005,.997,.87]:[.003,.884,.745,.995];
   uv.push(region[0]+u.getX(i)*(region[2]-region[0]),1-region[3]+u.getY(i)*(region[3]-region[1]));
  }source.dispose();
 }
 for(let i=0;i<12;i++){const y=-.115+i*.021;part(Math.sin(i*2.1)*.022,y,Math.cos(i*1.7)*.018,1.34,.021,.59,Math.sin(i*1.3)*.018);}
 // Wrap a raised physical paper strap around the stack at its right third.
 part(.31,.139,0,.27,.012,.613,0,true);part(.31,-.137,0,.27,.012,.613,0,true);
 for(const z of [-.307,.307])part(.31,0,z,.27,.28,.012,0,true);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeBoundingBox();geo.computeBoundingSphere();return geo;
}
export function cashDropMaterial(T,item){
 const den=item?.denomination,p=DROP_PALETTES[den];if(!p)throw Error('Invalid cash drop');
 let tex=dropAtlases.get(den);if(!tex){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;drawCashDropAtlas(canvas.getContext('2d'),den);tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;dropAtlases.set(den,tex);}
 return new T.MeshStandardMaterial({map:tex,color:'#ffffff',roughness:.72,metalness:0,emissive:p.paper,emissiveIntensity:.16});
}
