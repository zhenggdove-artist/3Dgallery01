// Locally authored vector illustration of a thick stack of US dollar bills.
// Shared image across SHOP, BAG and 1/2/3 quick-use slots; zero WebGL setup.
const CACHE=new Map();
export function comfortCashImage(item){
 if(item?.slot!=='consumable')return null;
 if(CACHE.has(item.id))return CACHE.get(item.id);
 const palette={
  20:{face:'#8adb9a',edge:'#397951',ink:'#16452c',accent:'#d1f7b2'},
  50:{face:'#f6a9ce',edge:'#a14e7b',ink:'#6a2455',accent:'#fff1ca'},
  100:{face:'#8ad0ff',edge:'#386eab',ink:'#1c4373',accent:'#e8f8ff'}
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
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 230 220" role="img" aria-label="Stack of ${den} dollar bills">
  <defs><filter id="shadow" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="1" dy="7" stdDeviation="6" flood-color="#0d2030" flood-opacity=".3"/></filter></defs>
  <g filter="url(#shadow)">${layers}</g>
  <rect x="32" y="174" width="158" height="15" rx="6" transform="rotate(-10 110 180)" fill="${p.ink}" opacity=".75"/>
  <text x="110" y="186" transform="rotate(-10 110 180)" font-size="11" font-family="Arial,sans-serif" font-weight="800" letter-spacing="1.3" text-anchor="middle" fill="#ffffff">$ ${den} · CASH</text>
 </svg>`;
 const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 CACHE.set(item.id,url);
 return url;
}
