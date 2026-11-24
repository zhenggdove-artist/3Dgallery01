// The server must never trust artwork/rarity/stat fields supplied by a
// non-GM. Validate and normalize before attaching a catalog entry to the room.
export const MAX_PAINTED_WINGS=24;
const hex=x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x);
const finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
const ALLOWED_ABILITIES=new Set(['glide','swift','aerial','guardian','sparkle']);
const ALLOWED_MATERIALS=new Set(['ink','airbrush','chalk','watercolor','metallic']);
export const DEFAULT_CUSTOM_WING_RATE_PCT=1;
export function wingDrawRatePercent(wing){
 const raw=wing?.drawRatePct;
 return raw===undefined||raw===null?DEFAULT_CUSTOM_WING_RATE_PCT:Number(raw);
}
export function validWingDrawRate(value){
 return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100&&Math.abs(Math.round(value*1000)-value*1000)<1e-7;
}
export function totalCustomWingRates(wings=[]){
 return wings.filter(wing=>wing&&wing.retired!==true)
  .reduce((total,wing)=>total+wingDrawRatePercent(wing),0);
}
export function normalizePaintedWing(raw,id){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid wing');
 const name=String(raw.name||'').trim();
 if(!name||name.length>50||/[<>\x00-\x1f]/.test(name))throw Error('Wing name must be 1–50 characters');
 const tier=Number(raw.tier);
 if(!Number.isInteger(tier)||tier<1||tier>5)throw Error('Invalid quality');
 if(!hex(raw.color))throw Error('Invalid base color');
 const abilities=raw.abilities===undefined?[raw.ability]:raw.abilities;
 if(!Array.isArray(abilities)||abilities.length>ALLOWED_ABILITIES.size||abilities.some(a=>!ALLOWED_ABILITIES.has(a)))throw Error('Invalid wing ability');
 const cleanAbilities=[...new Set(abilities)];
 for(const field of ['offsetX','offsetY'])if(!finite(Number(raw[field]??0),-1.5,1.5))throw Error('Invalid wing offset');
 const outline=raw.outline;
 if(!Array.isArray(outline)||outline.length<3||outline.length>96)throw Error('Draw a closed wing outline');
 const normalizePoint=p=>{
  if(!Array.isArray(p)||p.length!==2||!p.every(n=>finite(n,0,1)))throw Error('Invalid paint coordinate');
  return p.map(n=>Math.round(n*10000)/10000);
 };
 const strokes=raw.strokes||[];
 if(!Array.isArray(strokes)||strokes.length>90)throw Error('Maximum 90 brush strokes');
 const clean=strokes.map(stroke=>{
  if(!['brush','eraser'].includes(stroke.tool)||!ALLOWED_MATERIALS.has(stroke.material)||!hex(stroke.color)||
    !finite(Number(stroke.size),1,90)||!finite(Number(stroke.opacity),.05,1)||
    !Array.isArray(stroke.points)||stroke.points.length<1||stroke.points.length>96)throw Error('Invalid brush data');
  return {tool:stroke.tool,material:stroke.material,color:stroke.color,size:Number(stroke.size),
   opacity:Number(stroke.opacity),mirrorX:stroke.mirrorX===true,mirrorY:stroke.mirrorY===true,
   points:stroke.points.map(normalizePoint)};
 });
 for(const field of ['scaleX','scaleY'])if(!finite(Number(raw[field]),.35,2))throw Error('Invalid wing scale');
 if(!finite(Number(raw.impulse),5,18)||!finite(Number(raw.gravity),.2,1)||
  !finite(Number(raw.flapMs),180,900))throw Error('Invalid wing stats');
 const drawRatePct=raw.drawRatePct===undefined?DEFAULT_CUSTOM_WING_RATE_PCT:Number(raw.drawRatePct);
 if(!validWingDrawRate(drawRatePct))throw Error('Winning probability must be 0–100% (up to 3 decimals)');
 return {id,name,tier,slot:'wings',family:'wings',design:'painted-wing',
  premiumWing:true,gmWingExclusive:true,notForSale:true,price:0,
  color:raw.color,ability:cleanAbilities[0]||'glide',abilities:cleanAbilities,drawRatePct,retired:false,
  outline:outline.map(normalizePoint),strokes:clean,shape:String(raw.shape||'freehand').slice(0,20),
  scaleX:Number(raw.scaleX),scaleY:Number(raw.scaleY),offsetX:Number(raw.offsetX??0),offsetY:Number(raw.offsetY??0),
  impulse:Number(raw.impulse),gravity:Number(raw.gravity),flapMs:Number(raw.flapMs),
  visualComplexity:clean.length,description:'GM-painted original collectible'};
}
