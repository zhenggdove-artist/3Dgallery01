// Compressed reconstruction from the user's five photographs and Culture Bureau's 2023
// soldier-hall inventory/plan. Dimensions and elevator travel are game interpretations.
export const SOLDIER={x:2040,z:145,lower:17.5,upper:22,width:36,depth:10};
export const inLift=(x,z)=>Math.abs(x-2040)<1.05&&Math.abs(z-145)<1.05;
export function liftState(ms){const t=((ms/1000)%30+30)%30;const y=t<7?22:t<15?22-(t-7)*4.5/8:t<22?17.5:17.5+(t-22)*4.5/8;return {y,moving:t>=7&&t<15||t>=22,upper:t<7,lower:t>=15&&t<22};}
export function soldierGround(x,z){
 if(x>=2022&&x<=2024&&z>=151&&z<=166.5)return 17.5+Math.max(0,Math.min(30,Math.ceil((166.5-z)*2)))*.15;
 if(x>=2020&&x<=2062&&z>=130&&z<=171)return 17.5;
 if(x>=2004&&x<2020&&z>=134&&z<=140)return 16+(x-2004)*1.5/16;
 return null;
}
export function soldierFloor(x,z,feet,time){if(inLift(x,z)){const y=liftState(time).y;return feet>=y-.3?y:17.5;}return -Infinity;}
// Render and collision use the very same parts. Open doors are true gaps.
export const SOLDIER_PARTS=[];
function box(mat,x,y,z,w,h,d,solid=true){SOLDIER_PARTS.push({mat,x,y,z,w,h,d,solid});}
for(const [x,w] of [[2030.4,16.8],[2049.6,16.8]]){box('floor',x,21.82,145,w,.36,10);box('concrete',x,25.45,145,w,.3,10.6);}
for(const z of [141.9,148.1]){box('floor',2040,21.82,z,2.4,.36,3.8);box('concrete',2040,25.45,z,2.4,.3,4.4);}
for(const x of [2030,2050])box('stone',x,19.7,150,16,4.4,.45);
box('stone',2040,19.7,140,36,4.4,.45);
for(const x of [2022,2058])box('stone',x,19.7,145,.35,4.4,10);
box('stone',2040,21.85,138.7,36,.3,2.3);box('stone',2040,23,137.4,36,2,.35);
// Narrow central shaft, green rooftop headhouse, doorways on both landings.
for(const x of [2038.72,2041.28])box('concrete',x,21.5,145,.22,8,2.7);
box('green',2040,26.1,143.65,2.8,1.6,.18);box('green',2040,26.9,145,2.8,.18,2.9);
for(const x of [2038.65,2041.35])box('green',x,26.1,145,.16,1.6,2.8);
// Concrete end walls; continuous black steel/window bays around the rectangular volume.
for(const x of [2022,2058])box('concrete',x,23.7,145,.3,3.4,10);
for(const z of [140,150])for(let i=0;i<12;i++){
 const x=2023.5+i*3;
 box('steel',x-1.42,23.7,z,.09,3.4,.12);
 box('steel',x,24.55,z,2.9,.075,.12);box('steel',x,22.12,z,2.9,.09,.12);
 box('glass',x,24.94,z,2.77,.65,.035);
 // Four open glazed door bays connect the interior to its courtyard.
 if(![0,5,6,11].includes(i))box('glass',x,23.34,z,2.77,2.33,.035);
}
for(let x=2023.6;x<2058;x+=3){box('glass',x,23.5,143,1.8,2.8,.035);box('steel',x-.9,23.5,143,.06,3,.06);box('steel',x+.9,23.5,143,.06,3,.06);box('steel',x,24.96,143,1.8,.06,.06);}
// Concrete room dividers leave a continuous 1.8m corridor along the north glazing.
for(const x of [2028,2034,2046,2052]){box('concrete',x,23.6,147,.16,3.2,6);box('steel',x,23.65,142.9,.1,3.3,.1);}
for(let x=2023;x<2058;x+=3){box('steel',x,25.05,145,.1,.2,10,false);box('steel',x,23.65,143,.1,3.3,.1);}
box('steel',2040,24.9,141.4,35,.05,.42,false);
for(let x=2023;x<2058;x+=.6)box('steel',x,24.88,141.4,.035,.04,.5,false);
// Room furniture and warm pendants, without costly dynamic point lights.
for(const x of [2025,2031,2049,2055]){box('table',x,22.75,146,2.1,.09,1.2);for(const a of [-.9,.9])for(const b of [-.45,.45])box('steel',x+a,22.36,146+b,.06,.72,.06);
 for(const dz of [-1.05,1.05]){box(dz<0?'red':'steel',x,22.45,146+dz,.65,.1,.6);box(dz<0?'red':'steel',x,22.78,146+dz*1.22,.65,.65,.07);for(const dx of [-.25,.25])box('steel',x+dx,22.2,146+dz,.04,.4,.5);}
}
for(let x=2024;x<2058;x+=3){box('steel',x,24.65,141.4,.018,.7,.018,false);box('lamp',x,24.28,141.4,.12,.17,.12,false);}
// Stone retaining court, long drain and sea-facing outlook. Upper entrance is reached by stairs.
box('stone',2040,17.35,159,40,.3,18);box('stone',2040,20,134,40,5,.7);
box('stone',2020,19.7,156,.5,4.4,25);box('stone',2060,19.7,151,.5,4.4,35);
for(let i=0;i<30;i++){const z=166-i*.5,y=17.5+(i+1)*.15;box('stone',2023,y-.075,z,2,.15,.52,false);}
box('stone',2023,21.9,150.7,2,.2,1.5);
box('steel',2040,17.54,150.8,35,.04,.22,false);
for(let x=2021;x<2060;x+=1.1){box('steel',x,18.05,168,.035,1.1,.035);}
box('steel',2040,18.6,168,39,.045,.045);box('steel',2040,17.65,168,39,.04,.04);
export const SOLDIER_COLLIDERS=SOLDIER_PARTS.filter(p=>p.solid).map(p=>({x:p.x,z:p.z,w:p.w,d:p.d,minY:p.y-p.h/2,h:p.y+p.h/2}));

export function soldierHeadlandHeight(x,z){if(x<2018||z<130)return null;const r=Math.hypot((x-2035)/60,(z-145)/65);if(r>=1)return null;const t=Math.max(0,Math.min(1,(r-.55)/.45));return 17.5*(1-t*t*(3-2*t));}
