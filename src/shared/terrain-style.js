// Visual-only environment settings; existing saved palette and length are preserved.
export const TERRAIN_DEFAULTS=Object.freeze({meadowColor:'#295218',grassColor:'#4a8a38',floorColor:'#2e6658',grassLength:1,grassDensity:1,grassWidth:1,windSpeed:1,windStrength:1,grassPushRadius:2.4,grassPushStrength:1,flowerDensity:.8,flowerSize:1,soilExposure:.4,fogDistance:180,flowerYellow:'#f1cb40',flowerPurple:'#9464ce',flowerBlue:'#649fea'});
export const TERRAIN_COLOR_KEYS=Object.freeze(['meadowColor','grassColor','floorColor','flowerYellow','flowerPurple','flowerBlue']);
export const GRASS_LENGTH_MIN=.1,GRASS_LENGTH_MAX=3;
export const TERRAIN_SLIDERS=Object.freeze([
 ['grassDensity','草密度',0,1],['grassWidth','草葉寬度',.5,1.5],
 ['windSpeed','風速',0,2],['windStrength','風幅',0,2],
 ['grassPushRadius','撥草半徑',.5,4],['grassPushStrength','撥草力度',0,1.5],
 ['flowerDensity','小花密度',0,1],['flowerSize','小花大小',.5,1.5],['soilExposure','土地裸露',0,1],['fogDistance','迷霧距離',60,400]
]);
const validColor=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function terrainStyle(environment){
 const saved=environment?.terrain||{},style={...TERRAIN_DEFAULTS};
 for(const key of TERRAIN_COLOR_KEYS)if(validColor(saved[key]))style[key]=saved[key].toLowerCase();
 if(typeof saved.grassLength==='number'&&Number.isFinite(saved.grassLength))style.grassLength=Math.max(GRASS_LENGTH_MIN,Math.min(GRASS_LENGTH_MAX,saved.grassLength));
 for(const [key,,min,max] of TERRAIN_SLIDERS)if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))style[key]=Math.max(min,Math.min(max,Math.round(saved[key]*100)/100));
 return style;
}
export function setTerrainStyle(world,isGM,draft){
 if(!isGM)return {error:'GM only'};
 if(!draft||typeof draft!=='object'||Array.isArray(draft))return {error:'Invalid terrain settings'};
 const style=terrainStyle(world.environment);
 for(const key of TERRAIN_COLOR_KEYS){if(!Object.hasOwn(draft,key))continue;if(!validColor(draft[key]))return {error:'Invalid '+key};style[key]=draft[key].toLowerCase();}
 if(Object.hasOwn(draft,'grassLength')){const n=draft.grassLength;if(typeof n!=='number'||!Number.isFinite(n)||n<GRASS_LENGTH_MIN||n>GRASS_LENGTH_MAX)return {error:'Grass length must be 10–300%'};style.grassLength=Math.round(n*100)/100;}
 for(const [key,,min,max] of TERRAIN_SLIDERS){if(!Object.hasOwn(draft,key))continue;const n=draft[key];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)return {error:'Invalid '+key};style[key]=Math.round(n*100)/100;}
 world.environment={...world.environment,terrain:style};
 world.revision=(world.revision||0)+1;
 return {notice:'Terrain saved for all players',environment:JSON.parse(JSON.stringify(world.environment))};
}
// The existing custom grass shader outputs RGB directly, without Three.js
// color-space conversion. RGB deltas of zero reproduce its original palette.
export function terrainColorDelta(color,original){
 const rgb=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
 const a=rgb(color),b=rgb(original);return a.map((v,i)=>v-b[i]);
}
