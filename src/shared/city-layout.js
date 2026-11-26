import {CITY_SIGN_MOUNT_SIGNATURE,CITY_SIGN_MOUNTS} from './city-sign-mounts.js';

// Deterministic city geometry shared by the browser and authoritative Worker.
// The extension doubles the original sand district's surface area (not its
// radius) and triples building count per square unit: 72 -> 504 lots.
export const CITY_INNER_RADIUS=92;
export const CITY_PREVIOUS_OUTER_RADIUS=184;
export const CITY_OUTER_RADIUS=Math.sqrt(
  CITY_INNER_RADIUS**2+2*(CITY_PREVIOUS_OUTER_RADIUS**2-CITY_INNER_RADIUS**2)
);
export const CITY_BUILDING_COUNT=504;
export const CITY_SHOP_STYLES=Object.freeze([
 ['noodle','阿明古早味麵店','AH MING NOODLES','#c84730'],
 ['repair','老吳機車修配','WU MOTOR REPAIR','#d69a32'],
 ['laundry','藍月自助洗衣','BLUE MOON LAUNDRY','#4c9ea1'],
 ['fish','海角鮮魚市場','CAPE FISH MARKET','#328e9d'],
 ['electronics','閃電電器維修','SPARK ELECTRONICS','#a05aab'],
 ['pharmacy','仁心藥房','REN XIN PHARMACY','#439a6e'],
 ['tea','三輪珍珠奶茶','TRICYCLE TEA','#dc8f5b'],
 ['barber','阿鴻理髮廳','HONG BARBER SHOP','#d15264'],
 ['hardware','鐵拳五金百貨','IRON FIST HARDWARE','#a8a055'],
 ['tailor','桂香裁縫工作室','GUI XIANG TAILOR','#b56286'],
 ['pawn','金福當舖','GOLDEN PAWN','#b5a451'],
 ['grocery','南星雜貨店','SOUTH STAR MART','#5d9d69'],
 ['internet','夜貓子網咖','NIGHT OWL INTERNET','#556bc9'],
 ['clinic','和平牙科','PEACE DENTAL','#6599bd'],
 ['streetfood','火車頭烤肉','LOCO GRILL','#c87945'],
 ['flower','野草花店','WILD FLOWER SHOP','#668d53'],
 ['printing','黑墨影印店','BLACK INK PRINT','#777ca0'],
 ['fortune','天后求籤館','HEAVEN FORTUNE','#b04c4a'],
 ['tattoo','地下刺青','UNDERGROUND TATTOO','#875997'],
 ['rice','金穗米行','GOLDEN GRAIN RICE','#b3a568'],
 ['shoes','一步鞋行','ONE STEP SHOES','#a6795b'],
 ['shipping','長風快遞站','LONG WIND PARCEL','#4d8997'],
 ['fruit','黃昏水果攤','DUSK FRUIT','#9c994b'],
 ['motel','檳榔街旅社','BETEL STREET INN','#9a5e75']
]);
export const CITY_MATERIALS=Object.freeze([
 {name:'concrete',wall:'#9d9b96',trim:'#5c5a58',detail:'#bbb7ac'},
 {name:'timber',wall:'#866a50',trim:'#483a2e',detail:'#b28a63'},
 {name:'red-brick',wall:'#99483c',trim:'#6b352e',detail:'#bc6550'},
 {name:'charcoal',wall:'#595b5a',trim:'#292c2f',detail:'#777976'},
 {name:'ochre',wall:'#a38349',trim:'#756341',detail:'#c6aa72'},
 {name:'stone',wall:'#8a8a7e',trim:'#686960',detail:'#ada995'}
]);
export function cityRandom(seed=912744){
 let s=seed>>>0;
 return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
}
const ringCounts=[55,63,68,72,77,81,88];
const ringRadii=[102,122,143,164,186,207,229];
// Always build the full list first; limit is for deterministic test sampling,
// not device-dependent city collision. Mobile and desktop share ALL 504 lots.
export function cityLots(seed=912744,limit=CITY_BUILDING_COUNT){
 const rand=cityRandom(seed),lots=[];
 for(let band=0;band<ringCounts.length;band++){
  const count=ringCounts[band];
  for(let n=0;n<count;n++){
   const index=lots.length;
   const angle=(n+(band%2)*.47+(rand()-.5)*.23)*2*Math.PI/count;
   const radius=ringRadii[band]+(rand()-.5)*4.2;
   // Distinct cubes, deep narrow homes, broad shops and offset four-storeys.
   const silhouette=index%9;
   const width=silhouette===0?5.1+rand()*1.7:
    silhouette===1?3.5+rand()*1.9:
    silhouette===2?9+rand()*2.1:5+rand()*4.2;
   const depth=silhouette===1?10+rand()*3.4:
    silhouette===2?5.2+rand()*2.3:
    silhouette===3?width*.9:5.3+rand()*4.7;
   const floors=1+Math.floor(rand()*4);
   const height=floors*(2.55+rand()*.36)+.35;
   const style=CITY_SHOP_STYLES[(index*5+band*3)%CITY_SHOP_STYLES.length];
   const material=CITY_MATERIALS[(index+Math.floor(rand()*CITY_MATERIALS.length))%CITY_MATERIALS.length];
   const yaw=-Math.PI/2-angle+(rand()-.5)*.27;
   const decay=.12+rand()*.86;
   const offset=(rand()-.5)*width*.37;
   lots.push({index,id:'city-'+index,band,angle,
    x:Math.cos(angle)*radius,z:Math.sin(angle)*radius,yaw,
    width,depth,height,floors,offset,decay,silhouette,
    material:material.name,color:material.wall,trim:material.trim,detail:material.detail,
    style,shopName:style[1]+'・'+String(index+1).padStart(3,'0')+'號',
    enName:style[2]+' / '+String(index+1).padStart(3,'0'),
    roof:['#6d7475','#9f8e76','#b2a499','#a56854','#687676','#b6b3a6'][index%6]});
  }
 }
 // The ring counts and footprints are unchanged, but houses must not form
 // evenly spaced radial rows. Repack them into compact, uneven blocks with
 // touching side walls and generous, irregular breaks between neighbourhoods.
 // Do this in SHARED data so meshes, player collision and the Worker agree.
 repackIntoOrganicBlocks(lots,seed);
 return lots.slice(0,Math.max(0,Math.min(CITY_BUILDING_COUNT,limit)));
}
// Lay out each ring as several groups of adjoining buildings instead of an
// equidistant polar grid. Gap widths are measured in world metres, not angles:
// within a block the walls almost meet (0.04–0.28 m), while street gaps take
// up the remaining circumference. All random decisions are seeded; the
// client and authoritative server must generate IDENTICAL footprints.
function repackIntoOrganicBlocks(lots,seed){
 const rand=cityRandom((seed^0x65c91e3b)>>>0);
 let start=0;
 for(let band=0;band<ringCounts.length;band++){
  const count=ringCounts[band],ring=lots.slice(start,start+count),radius=ringRadii[band];
  const gapAfter=new Array(count).fill(null),groups=[],streetEnds=[];
  for(let first=0;first<count;){
   const roll=rand();
   const size=Math.min(count-first,roll<.12?1:roll<.31?2+Math.floor(rand()*3):roll<.70?5+Math.floor(rand()*4):9+Math.floor(rand()*6));
   const group={first,last:first+size-1};
   groups.push(group);
   for(let i=first;i<first+size;i++){
    ring[i].cluster=band+'-'+(groups.length-1);
    if(i<group.last)gapAfter[i]=.04+rand()*.24;
   }
   streetEnds.push(group.last);
   first+=size;
  }
  const circumference=2*Math.PI*radius;
  const buildings=ring.reduce((sum,lot)=>sum+lot.width,0);
  const internalGaps=gapAfter.reduce((sum,gap)=>sum+(gap??0),0);
  const streetSpace=Math.max(0,circumference-buildings-internalGaps);
  const weights=streetEnds.map((_,index)=>.32+rand()**2*2.6+(index%4===0?1.3:0));
  const totalWeight=weights.reduce((sum,value)=>sum+value,0);
  streetEnds.forEach((index,i)=>{gapAfter[index]=streetSpace*weights[i]/totalWeight;});
  let cursor=rand()*circumference;
  const angles=[];
  for(let i=0;i<count;i++){
   angles[i]=(cursor+ring[i].width/2)/radius;
   cursor+=ring[i].width+gapAfter[i];
  }
  // Share an orientation within each block to create parallel, nearly
  // continuous sidewalls; vary setbacks subtly for an accumulated-city feel.
  for(const group of groups){
   const middle=(angles[group.first]+angles[group.last])*.5;
   const yaw=-Math.PI/2-middle+(rand()-.5)*.045;
   const setback=(rand()-.5)*1.7;
   for(let i=group.first;i<=group.last;i++){
    const lot=ring[i],angle=angles[i],r=radius+setback+(rand()-.5)*.45;
    lot.angle=angle%(2*Math.PI);
    lot.x=Math.cos(angle)*r;
    lot.z=Math.sin(angle)*r;
    lot.yaw=yaw-(angle-middle)*.82+(rand()-.5)*.018;
    // Dense cores grow vertically in irregular stacked residential volumes.
    // Keep a minority of tall blocks so mobile vertex costs remain bounded.
    const peak=Math.floor((group.first+group.last)/2);
    if(group.last-group.first>=4&&i===peak&&(groups.indexOf(group)+band)%2===0){
     const floorH=lot.height/lot.floors;
     lot.floors=10+((lot.index*7+band)%5);lot.height=lot.floors*floorH;
    }else if(group.last-group.first>=5&&Math.abs(i-peak)===1&&(lot.index+band)%3===0){
     const floorH=lot.height/lot.floors;
     lot.floors=5+lot.index%4;lot.height=lot.floors*floorH;
    }
   }
  }
  start+=count;
 }
}
export const CITY_LOTS=cityLots();
// Fingerprint the actual collision layout, not just a manually bumped version.
export const CITY_LAYOUT_SIGNATURE=(()=>{
 let hash=2166136261;
 // Quantize sub-millimetre noise from browser/Worker libm differences.
 const q=n=>Math.round(n*10000);
 const data=JSON.stringify(CITY_LOTS.map(l=>[l.id,q(l.x),q(l.z),q(l.yaw),q(l.width),q(l.depth),q(l.height),l.floors]));
 for(let i=0;i<data.length;i++)hash=Math.imul(hash^data.charCodeAt(i),16777619);
 return (hash>>>0).toString(16).padStart(8,'0');
})();
// Collision and roof support are queried multiple times in every movement
// tick on both the browser and the authoritative Worker. Scanning all 504
// houses on every step creates regular main-thread stalls. Index immutable
// footprints once in deterministic world-space cells (exact same geometry).
const CITY_COLLISION_CELL=16;
const CITY_COLLISION_PADDING=3;
const CITY_COLLISION_CELLS=new Map();
const cityCellKey=(x,z)=>x+','+z;
for(const lot of CITY_LOTS){
 const reach=Math.hypot(lot.width*.5,lot.depth*.5)+CITY_COLLISION_PADDING;
 const minX=Math.floor((lot.x-reach)/CITY_COLLISION_CELL),maxX=Math.floor((lot.x+reach)/CITY_COLLISION_CELL);
 const minZ=Math.floor((lot.z-reach)/CITY_COLLISION_CELL),maxZ=Math.floor((lot.z+reach)/CITY_COLLISION_CELL);
 for(let cx=minX;cx<=maxX;cx++)for(let cz=minZ;cz<=maxZ;cz++){
  const key=cityCellKey(cx,cz),cell=CITY_COLLISION_CELLS.get(key);
  if(cell)cell.push(lot);else CITY_COLLISION_CELLS.set(key,[lot]);
 }
}
// Conservative broadphase: return only candidates; exact rotated rectangle
// checks and Worker-side authoritative collision remain unchanged. Large
// custom margins can fall back to the full list without risking missed hits.
export function cityCollisionCandidates(x,z,margin=0){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(margin)||margin>48)return CITY_LOTS;
 if(margin<=2)return CITY_COLLISION_CELLS.get(cityCellKey(
  Math.floor(x/CITY_COLLISION_CELL),Math.floor(z/CITY_COLLISION_CELL)))||[];
 // Large swinging weapons query nearby indexed cells, not all 504 homes
 // for every swept collision sample. Deduplicate blocks shared by cells.
 const found=new Set(),radius=Math.max(0,margin);
 for(let cx=Math.floor((x-radius)/CITY_COLLISION_CELL);cx<=Math.floor((x+radius)/CITY_COLLISION_CELL);cx++)
  for(let cz=Math.floor((z-radius)/CITY_COLLISION_CELL);cz<=Math.floor((z+radius)/CITY_COLLISION_CELL);cz++)
   for(const lot of CITY_COLLISION_CELLS.get(cityCellKey(cx,cz))||[])found.add(lot);
 return [...found];
}
export const CITY_MAX_HP=240;
export function cityStage(hp,maxHp=CITY_MAX_HP){
 return hp<=0?3:hp<=maxHp/3?2:hp<=maxHp*2/3?1:0;
}
// A structural collapse occurs at each authoritative 10%-HP boundary.
export function cityDamageTier(hp,maxHp=CITY_MAX_HP){
 if(!Number.isFinite(hp)||!Number.isFinite(maxHp)||maxHp<=0)return 0;
 return Math.max(0,Math.min(10,Math.floor((maxHp-hp)*10/maxHp+1e-8)));
}
export function cityCollapseProgress(tier){
 const t=Math.max(0,Math.min(1,tier/10));
 return 1-Math.pow(1-t,1.2);
}
export function cityLocal(lot,x,z){
 const dx=x-lot.x,dz=z-lot.z,c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
 return [dx*c-dz*s,dx*s+dz*c];
}
// A single deterministic support surface for both client-side physics and
// the authoritative Worker. Whole roofs stay solid throughout partial damage;
// destroyed houses remain low, solid, standable ruins instead of empty space.
export function cityRoofHeight(lot,stage=0){
 if(stage!==3)return lot.height+.13; // rendered corrugated roof: center + .06, half thickness .07
 const first=lot.height/lot.floors;
 const surviving=first*(lot.floors===1?.32:.76);
 return surviving+(lot.height+.13-surviving)*.10;
}
// Shared by browser physics, Worker collision and weapon targeting.
export function cityRoofHeightAtHp(lot,hp=CITY_MAX_HP,maxHp=CITY_MAX_HP){
 const tier=cityDamageTier(hp,maxHp);
 if(tier===0)return lot.height+.13;
 if(tier===10)return cityRoofHeight(lot,3);
 const amount=cityCollapseProgress(tier);
 return lot.height+.13+(cityRoofHeight(lot,3)-(lot.height+.13))*amount;
}
// Give each 10%-HP threshold one of four pre-existing building corners.
// The same deterministic cut applies to all walls and painted decals. It
// only moves existing vertices: zero additional meshes, particles, polygons
// or GPU materials, including across all 504 houses.
const cityCornerRotations=new WeakMap();
const NO_CITY_CORNER_CUT=Object.freeze([0,0,0]);
export function cityAngularCornerCut(lot,x,y,z,tier,isRoof=false){
 if(tier<=0)return NO_CITY_CORNER_CUT;
 // A hit can animate thousands of the existing batched vertices. Cache the
 // building's yaw once instead of calling trig functions twice per vertex.
 let rotation=cityCornerRotations.get(lot);
 if(!rotation){rotation=[Math.cos(lot.yaw),Math.sin(lot.yaw)];cityCornerRotations.set(lot,rotation);}
 const [cs,sn]=rotation,dx=x-lot.x,dz=z-lot.z;
 const lx=dx*cs-dz*sn,lz=dx*sn+dz*cs;
 const ax=Math.abs(lx)/Math.max(.1,lot.width*.5);
 const az=Math.abs(lz)/Math.max(.1,lot.depth*.5);
 // ax+az=1 marks the inner diagonal boundary of a corner notch.
 const diagonal=Math.max(0,Math.min(1,(ax+az-1.02)/.98));
 if(diagonal<=0)return NO_CITY_CORNER_CUT;
 const upper=Math.max(0,Math.min(1,(y-lot.height*.15)/Math.max(.2,lot.height*.85)));
 if(upper<=0)return NO_CITY_CORNER_CUT;
 const sx=lx>=0?1:-1,sz=lz>=0?1:-1;
 const corner=(sx<0?1:0)+(sz<0?2:0);
 const first=1+((corner-(lot.index&3)+4)&3);
 // Only this corner is affected by thresholds first, first+4, first+8;
 // previous diagonal cuts persist as the house takes more damage.
 const hits=Math.max(0,Math.min(1,tier-first+1))
  +Math.max(0,Math.min(1,tier-first-3))
  +Math.max(0,Math.min(1,tier-first-7));
 if(hits<=0)return NO_CITY_CORNER_CUT;
 const cut=diagonal*upper*Math.min(1,hits*.82);
 // Existing angled facades fold inwards rather than constructing/shooting
 // new 3D polygon objects. Roof deck remains near its solid support plane.
 const inwardX=-sx*Math.min(2.65,lot.width*.39)*cut;
 const inwardZ=-sz*Math.min(2.65,lot.depth*.39)*cut;
 const drop=-Math.min(isRoof?2.15:4.2,lot.height*(isRoof?.31:.49))*cut;
 return [cs*inwardX+sn*inwardZ,drop,-sn*inwardX+cs*inwardZ];
}
// Exactly the same vertex-space deformation is used for masonry, signs,
// original graffiti and persistent user drawings.
export function cityCollapsePosition(lot,x,y,z,tier,isRoof=false){
 const amount=cityCollapseProgress(tier);
 if(amount<=0)return [x,y,z];
 const first=lot.height/lot.floors,survivor=first*(lot.floors===1?.32:.76);
 const rise=Math.max(0,y-survivor),factor=Math.min(1,rise/Math.max(1,lot.height-survivor));
 const noise=Math.sin(lot.index*.73+x*.81+z*.59+y*1.13);
 const compression=.08+.075*(.5+.5*noise);
 const ruinedY=isRoof?cityRoofHeight(lot,3)+(y-(lot.height+.13))*.16:
  y<=survivor?y:survivor+rise*compression;
 const cut=cityAngularCornerCut(lot,x,y,z,tier,isRoof);
 // Keep the roof centre pinned to the server's physical support height.
 // Side facades deform unevenly; the whole facade no longer drops as a
 // perfectly uniform slab while a diagonal corner is being torn away.
 const [lx,lz]=cityLocal(lot,x,z);
 const edge=Math.min(1,(Math.abs(lx)/(lot.width*.5)+Math.abs(lz)/(lot.depth*.5))*.5);
 const wallAmount=isRoof?amount:amount*(.38+.62*edge);
 return [x+Math.sin(y*1.9+lot.index*.9)*factor*.35*wallAmount+cut[0],
  y+(ruinedY-y)*wallAmount+cut[1],
  z+Math.cos(y*1.5+lot.index*.7)*factor*.35*wallAmount+cut[2]];
}
// The diagonal roof corners are now genuinely lower, not invisible solid
// flat floors. Shared Worker and client physics use the same corner drop.
export function cityRoofHeightAtPoint(lot,x,z,hp=CITY_MAX_HP,maxHp=CITY_MAX_HP){
 const height=cityRoofHeightAtHp(lot,hp,maxHp);
 const cut=cityAngularCornerCut(lot,x,lot.height+.13,z,cityDamageTier(hp,maxHp),true);
 return Math.max(0.15,height+cut[1]);
}
function cityFootprint(lot,x,z,margin=0){
 const dx=x-lot.x,dz=z-lot.z;
 if(dx*dx+dz*dz>(lot.width+lot.depth+margin*3)**2)return false;
 const [lx,lz]=cityLocal(lot,x,z);
 return Math.abs(lx)<=lot.width/2+margin&&Math.abs(lz)<=lot.depth/2+margin;
}
export function cityGroundHeight(x,z,y=0,damage={}){
 let height=0;
 for(const lot of cityCollisionCandidates(x,z,.16)){
  // Keep support across the 0.20m corrugated roof overhang at its edges.
  if(!cityFootprint(lot,x,z,.16))continue;
  const top=cityRoofHeightAtPoint(lot,x,z,damage[lot.id]?.hp??CITY_MAX_HP,damage[lot.id]?.maxHp??CITY_MAX_HP);
  // A character below an eave is blocked by its wall, never sucked upward.
  // The .16m tolerance is only for numerical landing precision, not climbing.
  if(y>=top-.16)height=Math.max(height,top);
 }
 return height;
}
export function cityBlocked(x,z,y=0,damage={},radius=.22){
 for(const lot of cityCollisionCandidates(x,z,radius)){
  if(!cityFootprint(lot,x,z,radius))continue;
  const top=cityRoofHeightAtPoint(lot,x,z,damage[lot.id]?.hp??CITY_MAX_HP,damage[lot.id]?.maxHp??CITY_MAX_HP);
  // Leaving the original house uncollidable at stage 3 caused players to
  // phase through debris. Conversely a roof is walkable, not a side wall.
  if(y>=-1&&y<top-.12)return true;
 }
 return false;
}
// Slab intersection with a *solid* rotated rectangular building, including
// the top/bottom faces. The impact point chooses a damageable component.
const spanMisses=(a,b,lo,hi)=>(a<lo&&b<lo)||(a>hi&&b>hi);
function cityRayCanReachSign(lot,x,y,z,dx,dy,dz,limit){
 // Only blade/roof signs are tested by cityRaycast. Include every mount
 // option plus its .06 slab padding. Blades stay on the facade (<.44 of
 // the floor width + offset), and extend forward by at most 1.22 canopy
 // clearance + 1.512 board depth + .12 gap + .60 extension + .06 padding.
 const halfX=lot.width/2+Math.abs(lot.offset)+.25,halfZ=lot.depth/2+3.6;
 const bottom=lot.floors>5?lot.height+.2:-.1,top=lot.height+3;
 return !spanMisses(x,x+dx*limit,-halfX,halfX)&&
  !spanMisses(z,z+dz*limit,-halfZ,halfZ)&&!spanMisses(y,y+dy*limit,bottom,top);
}
export function cityRaycast(origin,direction,range,damage={}){
 if(!Array.isArray(origin)||!Array.isArray(direction)||range<=0)return null;
 let nearest=null;
 for(const lot of CITY_LOTS){
  const record=damage[lot.id],stage=cityStage(record?.hp??CITY_MAX_HP);
  if(stage===3)continue;
  const [ox,oz]=cityLocal(lot,origin[0],origin[2]);
  const c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
  const d=[direction[0]*c-direction[2]*s,direction[1],direction[0]*s+direction[2]*c];
  // Test protruding signs before the masonry volume. Detached signs cannot be hit again.
  // A short miss in open space must not invoke the entire cold sign solver.
  // Keep the original exact slab intersection, order and tie-breaks.
  if(cityRayCanReachSign(lot,ox,origin[1]-(lot.y||0),oz,...d,Math.min(range,nearest?.distance??range)))for(const sign of citySignSpecs(lot)){
   if((record?.parts?.[sign.id]??SIGN_HP)<=0)continue;
   const distance=signRayDistance(lot,sign,origin,direction,Math.min(range,nearest?.distance??range));
   if(distance!==null&&(!nearest||distance<nearest.distance))nearest={lot,distance,part:sign.id,position:origin.map((v,i)=>v+direction[i]*distance)};
  }
  const h=cityRoofHeightAtHp(lot,record?.hp??CITY_MAX_HP,record?.maxHp??CITY_MAX_HP);
  const mins=[-lot.width/2,0,-lot.depth/2],maxs=[lot.width/2,h,lot.depth/2],o=[ox,origin[1],oz];
  let near=0,far=Math.min(range,nearest?.distance??range),hitAxis=2;
  for(let axis=0;axis<3;axis++){
   if(Math.abs(d[axis])<1e-8){if(o[axis]<mins[axis]||o[axis]>maxs[axis]){near=Infinity;break;}continue;}
   const t0=(mins[axis]-o[axis])/d[axis],t1=(maxs[axis]-o[axis])/d[axis];
   const inT=Math.min(t0,t1),outT=Math.max(t0,t1);
   if(inT>near){near=inT;hitAxis=axis;}far=Math.min(far,outT);
   if(far<near)break;
  }
  if(near>far||!Number.isFinite(near)||near>range||near<0)continue;
  const px=ox+d[0]*near,py=origin[1]+d[1]*near,pz=oz+d[2]*near;
  const level=Math.min(lot.floors-1,Math.max(0,Math.floor(py/(lot.height/lot.floors))));
  const windowIndex=Math.min(2,Math.max(0,Math.round(px/(lot.width/4)+1)));
  const part=hitAxis===1&&py>h*.66?'sheets-roof':
   hitAxis===0&&Math.abs(px)>lot.width*.45?'pillars-'+(px<0?0:1):
   hitAxis===2&&pz>=0&&py>1&&py<h*.85?'windows-'+level+'-'+windowIndex:
   'masonry';
  if(!nearest||near<nearest.distance)nearest={lot,distance:near,part,position:origin.map((v,i)=>v+direction[i]*near)};
 }
 return nearest;
}


// Building facade geometry is shared by paint picking, authenticated paint
// placement and Three.js decals. Values are stable across rebuild/reset.
export const CITY_PAINT_WALLS=Object.freeze(['front','back','left','right']);
export function cityFacadeFloor(lot,floor){
 const level=Math.max(0,Math.min(lot.floors-1,Math.floor(floor)));
 const floorH=lot.height/lot.floors;
 const taper=level&&lot.silhouette%3===0?.79:1;
 const shift=level?lot.offset*(level%2?1:-.4):0;
 const setback=level&&lot.silhouette%4===0?(level%2?.8:-.4):0;
 const depthScale=level&&lot.silhouette%5===0?.86:1;
 return {level,floorH,shift,setback,w:lot.width*taper,d:lot.depth*depthScale,
  bottom:level*floorH,top:(level+1)*floorH};
}
export function cityWallPoint(lot,wall,u,v,outset=0){
 if(!CITY_PAINT_WALLS.includes(wall)||!Number.isFinite(u)||!Number.isFinite(v)||u<0||u>1||v<0||v>1)return null;
 const y=Math.min(lot.height-1e-6,Math.max(0,lot.height*(1-v)));
 const floor=cityFacadeFloor(lot,Math.floor(y/(lot.height/lot.floors)));
 let x=0,z=0,nx=0,nz=0;
 if(wall==='front'){x=floor.shift+(u-.5)*floor.w;z=floor.setback+floor.d/2; nz=1;}
 else if(wall==='back'){x=floor.shift+(.5-u)*floor.w;z=floor.setback-floor.d/2;nz=-1;}
 else if(wall==='right'){x=floor.shift+floor.w/2;z=floor.setback+(.5-u)*floor.d;nx=1;}
 else {x=floor.shift-floor.w/2;z=floor.setback+(u-.5)*floor.d;nx=-1;}
 const c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
 return [lot.x+c*(x+nx*outset)+s*(z+nz*outset),y,
  lot.z-s*(x+nx*outset)+c*(z+nz*outset)];
}
// Returns ONLY a visible wall face (never roof or an invisible interior plane).
// Destroyed facades are not editable until GM repairs the house, but existing
// paintings remain on the collapsing mesh, and remain after repair.
export function cityPaintHit(origin,direction,range=17,damage={},roofRange=range){
 if(!Array.isArray(origin)||!Array.isArray(direction)||range<=0)return null;
 let best=null,limit=Math.max(range,roofRange);
 for(const lot of CITY_LOTS){
  if(cityStage(damage[lot.id]?.hp??CITY_MAX_HP)===3)continue;
  const dx=origin[0]-lot.x,dz=origin[2]-lot.z;
  const bound=Math.max(range,roofRange)+Math.max(lot.width,lot.depth)*1.5;
  if(dx*dx+dz*dz>bound*bound)continue;
  const [ox,oz]=cityLocal(lot,origin[0],origin[2]);
  const c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
  const vx=direction[0]*c-direction[2]*s,vz=direction[0]*s+direction[2]*c,vy=direction[1];
  // Reject lots whose entire conservative facade/sign envelope misses the ray.
  // Long upward paint rays must not traverse every floor of every nearby lot.
  const hx=lot.width/2+Math.abs(lot.offset)+.5,hz=lot.depth/2+3.6;
  if(spanMisses(ox,ox+vx*limit,-hx,hx)||spanMisses(oz,oz+vz*limit,-hz,hz)||spanMisses(origin[1],origin[1]+vy*limit,-.1,lot.height+5))continue;
  const signHit=signPaintHit(lot,origin,direction,limit,damage,limit);if(signHit){best=signHit;limit=signHit.distance;}
  for(let floor=0;floor<lot.floors;floor++){
   const g=cityFacadeFloor(lot,floor);
   for(const wall of CITY_PAINT_WALLS){
    const alongX=wall==='left'||wall==='right';
    const distance=alongX?(wall==='right'?g.shift+g.w/2:g.shift-g.w/2):
      (wall==='front'?g.setback+g.d/2:g.setback-g.d/2);
    const axisOrigin=alongX?ox:oz,axisDirection=alongX?vx:vz;
    if(Math.abs(axisDirection)<1e-7)continue;
    const t=(distance-axisOrigin)/axisDirection;
    if(t<.15||t>=limit)continue;
    // Only the front-facing side of the wall is writable, not its interior.
    if((wall==='front'&&vz>=0)||(wall==='back'&&vz<=0)||
       (wall==='right'&&vx>=0)||(wall==='left'&&vx<=0))continue;
    const px=ox+vx*t,pz=oz+vz*t,py=origin[1]+vy*t;
    if(py<g.bottom||py>g.top)continue;
    if(alongX?Math.abs(pz-g.setback)>g.d/2:Math.abs(px-g.shift)>g.w/2)continue;
    const u=wall==='front'?(px-g.shift)/g.w+.5:
      wall==='back'?.5-(px-g.shift)/g.w:
      wall==='right'?.5-(pz-g.setback)/g.d:(pz-g.setback)/g.d+.5;
    const v=1-py/lot.height;
    if(u<0||u>1||v<0||v>1)continue;
    best={lotId:lot.id,lotIndex:lot.index,wall,u,v,
      position:cityWallPoint(lot,wall,u,v),distance:t};
    limit=t;
   }
  }
 }
 return best&&(best.distance<=range||isRooftopPaintWall(best.wall))?best:null;
}

export const SIGN_HP=42;
// The mounted panel is completely outside the real facade. Only the
// two mounting brackets bridge the gap to the wall.
function signFloor(s,y){
 return Number.isFinite(s.silhouette)?cityFacadeFloor(s,Math.floor(y/(s.height/s.floors))):{shift:0,setback:0,w:s.width,d:s.depth};
}
function signFront(s,y,height){
 const bottom=y-height/2,top=y+height/2,floors=s.floors||1;
 let front=s.depth/2+.38;
 for(let i=0;i<floors;i++)if((i+1)*s.height/floors>=bottom&&i*s.height/floors<=top){
  const floor=signFloor(s,(i+.5)*s.height/floors);front=Math.max(front,floor.setback+floor.d/2+.38);
 }
 // The old facade's rain canopy crosses the full frontage at y=2.58.
 // A sign spanning its height must sit beyond the canopy's outer lip.
 const city=Number.isFinite(s.silhouette);
 const awningY=city?2.58:Math.min(2.6,s.height-.2);
 if((city||s.metal)&&bottom<awningY+.20&&top>awningY-.20)front=Math.max(front,s.depth/2+(city?1.22:.94));
 return front;
}
function bladeMount(s,sign){
 return [-.32,.32].map(dy=>{
  const y=sign.y+sign.height*dy,f=signFloor(s,y),wall=f.setback+f.d/2-.025;
  const rear=sign.z-sign.depth/2+.055;
  return {x:sign.x,y,z:(wall+rear)/2,width:.12,height:.105,depth:Math.max(.08,rear-wall)};
 });
}
export function houseSignSpecs(s){
 const w=s.width,d=s.depth,h=s.height,out=[],floors=s.floors||1;
 // Both existing city lots and GM-built houses use this same restriction.
 const blade=floors<=5?(s.bladeCount??1):0,roof=s.roofCount??1;
 const bs=s.bladeSize??1,rs=s.roofSize??1;
 for(let i=0;i<blade;i++){
  const side=i%2?1:-1,level=Math.floor(i/2),height=Math.min(h/(level?2.5:1.27),2.6*bs),depth=Math.min(d*.55,1.05*bs);
  const y=Math.min(h-height/2-.04,Math.max(height/2+.08,h*.70-level*(height+.18)));
  const floor=signFloor(s,y),x=floor.shift+side*floor.w*.36;
  const z=signFront(s,y,height)+depth/2+.12;
  const sign={id:'sign-blade-'+i,x,y,z,width:.17,height,depth,color:s.bladeColor||s.signColor||'#c84730',blade:true};
  sign.supports=bladeMount(s,sign);out.push(sign);
 }
 for(let i=0;i<roof;i++){
  const width=Math.min(w/(roof+.12),3.6*rs),height=1.45*rs;
  const sign={id:'sign-roof-'+i,x:(i-(roof-1)/2)*w/(roof+1),y:h+height/2+.32,z:d*.30,width,height,depth:.18,color:s.roofSignColor||s.signColor||'#4c9ea1',blade:false};
  sign.supports=[-1,1].map(side=>({x:sign.x+side*width*.34,y:h+.20,z:sign.z,width:.11,height:.36,depth:.14}));out.push(sign);
 }
 if(!Number.isFinite(s.silhouette)&&Number.isInteger(s.signs)){
  const count=s.signs;
  for(let i=0;i<count;i++){const width=Math.min(w/(count+1),2.5),y=Math.min(h-.35,2.35),q={id:'sign-flat-'+i,x:(i-(count-1)/2)*w/(count+1),y,z:signFront(s,y,.46)+.245,width,height:.46,depth:.25,color:s.flatColor||'#964b42',blade:false};q.supports=flatSupports(s,q);out.unshift(q);}
  const result=[];
  for(const base of out){
   const prefix=base.blade?'blade':base.id.startsWith('sign-roof-')?'roof':'flat';
   const q=[base,...mountOptions(s,base)].find(candidate=>!result.some(old=>signAssembliesOverlap(originLot,candidate,originLot,old)));
   if(q)result.push(decorateSign(q,s[prefix+'Style']||'wild',s[prefix+'Font']||'hei',s[prefix+'Saturation']??1,Number(base.id.split('-').at(-1))+(prefix==='roof'?17:prefix==='flat'?9:0)));
  }
  return result;
 }
 return out;
}
const cachedCityFlatSigns=new WeakMap();
function baseCityShopSignSpec(lot){
 if(cachedCityFlatSigns.has(lot))return cachedCityFlatSigns.get(lot);
 const height=.78,y=2.96,width=lot.width*.90;
 const original={id:'sign',x:0,y,z:signFront(lot,y,height)+.12,width,height,depth:.10,color:lot.style[3],blade:false};
 let result=null;
 outer:for(const scale of [1,.86,.72,.58,.46])for(const dz of [0,.25,.50,.75])for(const dx of [0,-.10,.10,-.20,.20,-.3,.3]){
  const q={...original,x:dx*lot.width,z:original.z+dz,width:original.width*scale};
  if(Math.abs(q.x)+q.width/2>lot.width/2-.04||!citySignClear(lot,q))continue;
  const floor=signFloor(lot,y),wall=floor.setback+floor.d/2-.025,rear=q.z-q.depth/2+.025;
  q.supports=[-1,1].map(side=>({x:q.x+side*q.width*.31,y:q.y,z:(wall+rear)/2,width:.10,height:.10,depth:Math.max(.08,rear-wall)}));
  result=q;break outer;
 }
 cachedCityFlatSigns.set(lot,result);return result;
}
// Conservative intersection test using the real floor envelopes, in the
// neighboring building's rotated coordinate system. No extra collider meshes.
export function citySignClear(lot,sign){
 const p=signWorldPosition(lot,sign),bottom=sign.y-sign.height/2,top=sign.y+sign.height/2;
 for(const other of cityCollisionCandidates(p[0],p[2],Math.hypot(sign.width,sign.depth)/2+2)){
  if(other.id===lot.id)continue;
  const [x,z]=cityLocal(other,p[0],p[2]),a=lot.yaw-other.yaw,c=Math.abs(Math.cos(a)),sn=Math.abs(Math.sin(a));
  const hx=(sign.width*c+sign.depth*sn)/2+.06,hz=(sign.width*sn+sign.depth*c)/2+.06;
  for(let i=0;i<other.floors;i++){
   const floor=cityFacadeFloor(other,i);
   if(top<=floor.bottom||bottom>=floor.top)continue;
   if(Math.abs(x-floor.shift)<floor.w/2+hx&&Math.abs(z-floor.setback)<floor.d/2+hz)return false;
  }
 }
 return true;
}
const cachedCitySigns=new WeakMap();
function baseCitySignSpecs(lot){
 if(cachedCitySigns.has(lot))return cachedCitySigns.get(lot);
 const source=houseSignSpecs({...lot,bladeCount:1+(lot.index%3===0?1:0),roofCount:1,bladeSize:.8+(lot.index%5)*.16,roofSize:.85+(lot.index%4)*.18,bladeColor:lot.style[3],roofSignColor:CITY_SHOP_STYLES[(lot.index+5)%CITY_SHOP_STYLES.length][3]});
 const result=[];
 for(const sign of source){
  if(!sign.blade){
   let found=null;
   roofSearch:for(const scale of [1,.85,.7,.55])for(const dz of [0,-.18,-.36,.12])for(const dx of [0,-.18,.18,-.32,.32]){
    const q={...sign,x:sign.x+dx*lot.width,z:sign.z+dz*lot.depth,width:sign.width*scale};
    if(Math.abs(q.x)+q.width/2>lot.width/2-.08||Math.abs(q.z)+q.depth/2>lot.depth/2-.08||!citySignClear(lot,q))continue;
    q.supports=[-1,1].map(side=>({x:q.x+side*q.width*.34,y:lot.height+.20,z:q.z,width:.11,height:.36,depth:.14}));
    found=q;break roofSearch;
   }
   if(found)result.push(found);continue;
  }
  const floor=signFloor(lot,sign.y);
  // Search along the actual floor frontage and a short additional bracket
  // extension. Omit a panel if no unobstructed mount is available.
  let found=null;
  for(const extension of [0,.30,.60]){for(const dx of [0,-.12,.12,-.24,.24]){
   const x=sign.x+dx*floor.w;if(Math.abs(x-floor.shift)>floor.w*.44)continue;
   const candidate={...sign,x,z:sign.z+extension};
   if(citySignClear(lot,candidate)){candidate.supports=bladeMount(lot,candidate);found=candidate;break;}
  }if(found)break;}
  if(found)result.push(found);
 }
 cachedCitySigns.set(lot,result);return result;
}
export function structureSignSpecs(structure){
 if(structure.kind!=='house')return [];
 if(structure.gmHouse)return houseSignSpecs({...structure.house,bladeCount:structure.house.bladeCount??0,roofCount:structure.house.roofCount??0});
 const v=structure.variant||0;return houseSignSpecs({width:4.7+(v%2)*.65,depth:3.8+(v%3)*.3,height:3.4+(v%2)*.45,bladeCount:1,roofCount:1,bladeColor:CITY_SHOP_STYLES[v][3],roofSignColor:CITY_SHOP_STYLES[v+5][3],bladeSize:.85,roofSize:.85});
}
export function signWorldPosition(lot,sign){
 const c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);return [lot.x+c*sign.x+s*sign.z,(lot.y||0)+sign.y,lot.z-s*sign.x+c*sign.z];
}
export function signRayDistance(lot,sign,origin,direction,range){
 const [x,z]=cityLocal(lot,origin[0],origin[2]),c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
 const o=[x-sign.x,origin[1]-(lot.y||0)-sign.y,z-sign.z],v=[direction[0]*c-direction[2]*s,direction[1],direction[0]*s+direction[2]*c],half=[sign.width/2+.06,sign.height/2+.06,sign.depth/2+.06];
 let near=0,far=range;
 for(let i=0;i<3;i++){if(Math.abs(v[i])<1e-8){if(Math.abs(o[i])>half[i])return null;continue;}const a=(-half[i]-o[i])/v[i],b=(half[i]-o[i])/v[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return null;}
 return near;
}

export function signPanelsOverlap(aLot,a,bLot,b,margin=.10){
 const pa=signWorldPosition(aLot,a),pb=signWorldPosition(bLot,b);
 if(Math.abs(pa[1]-pb[1])>=(a.height+b.height)/2+margin)return false;
 const dx=pb[0]-pa[0],dz=pb[2]-pa[2],aYaw=aLot.yaw||0,bYaw=bLot.yaw||0;
 const axes=[aYaw,bYaw,aYaw+Math.PI/2,bYaw+Math.PI/2];
 for(const theta of axes){
  const projected=Math.abs(dx*Math.cos(theta)-dz*Math.sin(theta));
  const extent=(p,yaw)=>(p.width*Math.abs(Math.cos(theta-yaw))+p.depth*Math.abs(Math.sin(theta-yaw)))/2;
  if(projected>=extent(a,aYaw)+extent(b,bYaw)+margin)return false;
 }
 return true;
}
const originLot={x:0,y:0,z:0,yaw:0};
function signParts(s){return [s,...(s.supports||[])];}
function signAssembliesOverlap(aLot,a,bLot,b){
 // Brackets may touch their own wall, never another panel or bracket.
 return signParts(a).some(p=>signParts(b).some(q=>signPanelsOverlap(aLot,p,bLot,q,.065)));
}
function flatSupports(s,q){
 const floor=signFloor(s,q.y),wall=floor.setback+floor.d/2-.025,rear=q.z-q.depth/2+.025;
 return [-1,1].map(side=>({x:q.x+side*q.width*.31,y:q.y,z:(wall+rear)/2,width:.10,height:.10,depth:Math.max(.08,rear-wall)}));
}
function* mountOptions(s,sign){
 if(sign.blade){
  for(const scale of [1,.85,.7,.55,.42])for(const delta of [0,.24,-.24,.48,-.48,.9,-.9,1.5,-1.5])for(const dx of [0,-.12,.12,-.24,.24]){
   const height=sign.height*scale,y=Math.min(s.height-height/2-.05,Math.max(height/2+.08,sign.y+delta));
   if(y-height/2<0)continue;
   const floor=signFloor(s,y),x=floor.shift+(sign.x>=0?1:-1)*floor.w*.36+dx*floor.w;
   if(Math.abs(x-floor.shift)>floor.w*.44)continue;
   const q={...sign,x,y,height,z:signFront(s,y,height)+sign.depth/2+.12};
   q.supports=bladeMount(s,q);yield q;
  }
 }else if(sign.id.startsWith('sign-roof-')){
  for(const scale of [1,.85,.7,.55])for(const dz of [0,-.18,-.36,.12])for(const dx of [0,-.18,.18,-.32,.32]){
   const q={...sign,x:sign.x+dx*s.width,z:sign.z+dz*s.depth,width:sign.width*scale};
   if(Math.abs(q.x)+q.width/2>s.width/2-.04||Math.abs(q.z)+q.depth/2>s.depth/2-.04)continue;
   q.supports=[-1,1].map(side=>({x:q.x+side*q.width*.34,y:s.height+.20,z:q.z,width:.11,height:.36,depth:.14}));yield q;
  }
 }else{
  for(const scale of [1,.86,.72,.58,.46])for(const delta of [0,-.48,.48,-.95,.95,-1.4])for(const dx of [0,-.12,.12,-.24,.24]){
   const height=sign.height,y=Math.max(height/2+.05,Math.min(s.height+.25,sign.y+delta));
   const q={...sign,x:sign.x+dx*s.width,y,width:sign.width*scale,z:signFront(s,y,height)+sign.depth/2+.12};
   if(Math.abs(q.x)+q.width/2>s.width/2-.03)continue;
   q.supports=flatSupports(s,q);yield q;
  }
 }
}
function decorateSign(sign,style,font,saturation,seed){
 return {...sign,style,font,saturation,seed};
}
const globalCitySigns=new Map(),globalCityFlats=new Map();
const CITY_MOUNT_IDS=['sign','sign-roof-0','sign-blade-0','sign-blade-1'];
let citySignsReady=false;
function ensureCitySignLayout(){
 if(citySignsReady)return;
 const grid=new Map(),size=12;
 const cells=(lot,sign)=>{const p=signWorldPosition(lot,sign),r=Math.hypot(sign.width,sign.depth)/2+3,keys=[];for(let x=Math.floor((p[0]-r)/size);x<=Math.floor((p[0]+r)/size);x++)for(let z=Math.floor((p[2]-r)/size);z<=Math.floor((p[2]+r)/size);z++)keys.push(x+','+z);return keys;};
 const add=(lot,sign)=>{const e={lot,sign};for(const key of cells(lot,sign)){const cell=grid.get(key)||[];cell.push(e);grid.set(key,cell);}};
 const clear=(lot,sign,base=false)=>{
  // The base constructors have already checked these exact immutable
  // volumes. Alternative mounts still need the original facade test.
  if(!base&&!citySignClear(lot,sign))return false;
  const nearby=new Set();
  for(const key of cells(lot,sign))for(const entry of grid.get(key)||[]){
   if(nearby.has(entry))continue;
   nearby.add(entry);
   if(signAssembliesOverlap(lot,sign,entry.lot,entry.sign))return false;
  }
  return true;
 };
 const choose=(lot,s)=>{
  if(!s)return null;
  if(clear(lot,s,true)){add(lot,s);return s;}
  // Preserve the first-match order without building every unused mount on
  // the Worker path to an otherwise unrelated attack's first collision test.
  for(const candidate of mountOptions(lot,s))if(clear(lot,candidate)){add(lot,candidate);return candidate;}
  return null;
 };
 // Preserve main storefronts and rooftop boards first. Blades use remaining space.
 for(const lot of CITY_LOTS){const s=choose(lot,baseCityShopSignSpec(lot));globalCityFlats.set(lot.id,s);}
 for(const lot of CITY_LOTS){const list=[],base=baseCitySignSpecs(lot).find(s=>!s.blade),s=choose(lot,base);if(s)list.push(s);globalCitySigns.set(lot.id,list);}
 for(const lot of CITY_LOTS){const list=globalCitySigns.get(lot.id);for(const base of baseCitySignSpecs(lot).filter(s=>s.blade)){const s=choose(lot,base);if(s)list.push(s);}}
 citySignsReady=true;
}
function* cityMountCandidates(lot,base){
 if(base){yield base;yield* mountOptions(lot,base);}
}
function cityMountBases(lot){
 const panels=baseCitySignSpecs(lot);
 return [baseCityShopSignSpec(lot),...CITY_MOUNT_IDS.slice(1).map(id=>panels.find(s=>s.id===id))];
}
function ensureCityLotSigns(lot){
 if(citySignsReady||globalCitySigns.has(lot.id))return;
 const canonical=CITY_LOTS[lot.index],mounts=CITY_SIGN_MOUNTS[lot.index];
 if(CITY_LAYOUT_SIGNATURE!==CITY_SIGN_MOUNT_SIGNATURE||canonical?.id!==lot.id||!mounts){ensureCitySignLayout();return;}
 // The recipe stores only candidate indexes. Build the selected panels and
 // brackets using the original runtime geometry and the canonical lot, with
 // no coordinates rounded, serialized, or introduced by the cache.
 const bases=cityMountBases(canonical),panels=[];
 for(let i=0;i<mounts.length;i++){
  const index=mounts[i];
  if(index===-1){panels.push(null);continue;}
  let n=0,selected=null;
  for(const sign of cityMountCandidates(canonical,bases[i]))if(n++===index){selected=sign;break;}
  if(!selected){ensureCitySignLayout();return;}
  panels.push(selected);
 }
 globalCityFlats.set(lot.id,panels[0]);globalCitySigns.set(lot.id,panels.slice(1).filter(Boolean));
}
// Build tooling and tests regenerate the recipe with the exact fallback
// solver, preserving its placement order and all clearance/overlap checks.
export function deriveCitySignMounts(){
 ensureCitySignLayout();
 return CITY_LOTS.map(lot=>{
  const chosen=[globalCityFlats.get(lot.id),...globalCitySigns.get(lot.id)];
  return cityMountBases(lot).map((base,i)=>{
   const wanted=chosen.find(s=>s?.id===CITY_MOUNT_IDS[i]);
   if(!wanted)return -1;
   const encoded=JSON.stringify(wanted);let n=0;
   for(const candidate of cityMountCandidates(lot,base)){
    if(JSON.stringify(candidate)===encoded)return n;
    n++;
   }
   throw Error('Unmatched static sign mount: '+lot.id+' '+wanted.id);
  });
 });
}
export function cityShopSignSpec(lot){ensureCityLotSigns(lot);return globalCityFlats.get(lot.id)||null;}
export function citySignSpecs(lot){ensureCityLotSigns(lot);return globalCitySigns.get(lot.id)||[];}
export function citySignLayoutAudit(){
 ensureCitySignLayout();
 const all=CITY_LOTS.flatMap(lot=>[cityShopSignSpec(lot),...citySignSpecs(lot)].filter(Boolean).map(sign=>({lot,sign})));
 let overlaps=0;for(let i=0;i<all.length;i++)for(let j=0;j<i;j++)if(signAssembliesOverlap(all[i].lot,all[i].sign,all[j].lot,all[j].sign))overlaps++;
 return {total:all.length,overlaps,flats:all.filter(v=>v.sign.id==='sign').length,roofs:all.filter(v=>v.sign.id.startsWith('sign-roof-')).length,blades:all.filter(v=>v.sign.blade).length,highBlades:all.filter(v=>v.sign.blade&&v.lot.floors>5).length};
}
export const SIGN_STYLES=Object.freeze(['wild','cute','handwritten','icon','portrait']);
export const SIGN_FONTS=Object.freeze(['hei','ming','kai','rounded']);
export function citySignArtOptions(lot,variant){
 const seed=lot.index*13+variant*7,style=SIGN_STYLES[seed%5],font=SIGN_FONTS[(lot.index+variant)%4];
 return {seed,style,font,saturation:seed%7===0?.5:1};
}

export function signPaintWall(wall){return typeof wall==='string'&&(/^sign(?:-(?:blade|roof|flat)-[0-9]+)?:[+-]$/.test(wall)||/^sign-roof-[0-9]+:[LR]$/.test(wall));}
export function structurePaintLot(s){return {id:s.id,x:s.position[0],y:s.position[1],z:s.position[2],yaw:s.rotation||0,structure:s};}
function paintSigns(lot){return lot.structure?structureSignSpecs(lot.structure):[cityShopSignSpec(lot),...citySignSpecs(lot)].filter(Boolean);}
function paintDescriptor(lot,wall,sign,signs){
 const [id,face]=wall.split(':');if(!sign||sign.id!==id)return null;
 if(id==='sign'&&face==='-')return null;
 const roof=id.startsWith('sign-roof-');
 const v=roof?(lot.structure?(lot.structure.gmHouse?gmRooftopVisual(lot.structure.house,sign,signPortraitSeed(lot.structure.id),signs):sign):cityRooftopVisual(lot,sign)):sign;
 const side=face==='+'||face==='R'?1:-1,wing=face==='L'||face==='R';
 if(wing&&(!roof||!(v.wing>.12)))return null;
 const axis=wing||v.blade?'x':'z';
 const width=wing?v.wing+v.depth:v.blade?v.depth:v.width;
 // The side artwork spans from the front board face to the rear edge.
 const center=wing?v.z-v.wing/2:axis==='x'?v.z:v.x;
 const plane=axis==='x'?v.x+side*v.width/2:v.z+side*v.depth/2;
 return {sign,visual:v,side,axis,wing,width,height:v.height,center,plane};
}
export function signPaintDescriptor(lot,wall){
 if(!signPaintWall(wall)||!lot)return null;
 const signs=paintSigns(lot),id=wall.split(':')[0];return paintDescriptor(lot,wall,signs.find(s=>s.id===id),signs);
}
function descriptorPoint(lot,d,u,v,outset){
 const {visual:s,side,axis,center,plane,width,height}=d;
 const along=axis==='x'?center-side*(u-.5)*width:center+side*(u-.5)*width;
 return signWorldPosition(lot,{x:axis==='x'?plane+side*outset:along,y:s.y+(.5-v)*height,z:axis==='x'?along:plane+side*outset});
}
export function signPaintPoint(lot,wall,u,v,outset=.038){
 const d=signPaintDescriptor(lot,wall);if(!d||!Number.isFinite(u)||!Number.isFinite(v)||u<0||u>1||v<0||v>1)return null;
 return descriptorPoint(lot,d,u,v,outset);
}
function descriptorAvailable(lot,d,damage){
 if(lot.structure)return lot.structure.hp>0&&(lot.structure.signDamage?.[d.sign.id]??SIGN_HP)>0;
 const state=damage[lot.id];return cityDamageTier(state?.hp??CITY_MAX_HP,state?.maxHp??CITY_MAX_HP)<3&&(state?.parts?.[d.sign.id]??SIGN_HP)>0;
}
export function signPaintAvailable(lot,wall,damage={}){
 const d=signPaintDescriptor(lot,wall);return !!d&&descriptorAvailable(lot,d,damage);
}
export function signPaintHit(lot,origin,direction,range,damage={},roofRange=range){
 const signs=paintSigns(lot);
 const [ox,oz]=cityLocal(lot,origin[0],origin[2]),c=Math.cos(lot.yaw),s=Math.sin(lot.yaw),dx=direction[0]*c-direction[2]*s,dz=direction[0]*s+direction[2]*c;
 let best=null;
 for(const sign of signs){
  const roof=sign.id.startsWith('sign-roof-');
  for(const face of roof?['+','-','L','R']:['+','-']){
   const wall=sign.id+':'+face,d=paintDescriptor(lot,wall,sign,signs);if(!d||!descriptorAvailable(lot,d,damage))continue;
   const alongX=d.axis==='x',axis=alongX?dx:dz;if(axis*d.side>=-1e-7)continue;
   const t=(d.plane+d.side*.038-(alongX?ox:oz))/axis;
   if(t<.15||t>(roof?roofRange:range)||t>=(best?.distance??Infinity))continue;
   const x=ox+dx*t,z=oz+dz*t,y=origin[1]+direction[1]*t-(lot.y||0),u=.5+d.side*(alongX?d.center-z:x-d.center)/d.width,v=.5-(y-d.visual.y)/d.height;
   if(u<0||u>1||v<0||v>1)continue;
   best={lotId:lot.id,lotIndex:lot.index,wall,u,v,position:descriptorPoint(lot,d,u,v,.038),distance:t};
  }
 }
 return best;
}
export function structureSignPaintHit(structures,origin,direction,range=18,roofRange=range){
 let best=null;for(const structure of structures||[]){if(structure.kind!=='house'||structure.hp<=0)continue;const hit=signPaintHit(structurePaintLot(structure),origin,direction,Math.min(range,best?.distance??range),{},Math.min(roofRange,best?.distance??roofRange));if(hit)best=hit;}return best;
}

export function rooftopSignMode(seed){return (seed>>>0)%5;}
export function signPortraitSeed(id){
 let hash=0;for(const ch of String(id??''))hash=(Math.imul(hash,31)+ch.charCodeAt(0))|0;
 return hash>>>0;
}
/** Shared visual and paint geometry; combat sign specifications stay unchanged. */
export function rooftopBillboardVisual(lot,s,seed=0,clear=()=>true){
 const mode=rooftopSignMode(seed),half=Math.max(s.width/2,lot.width/2-Math.abs(s.x)-.20);
 const width=Math.min(half*2,Math.max(s.width,lot.width*.88));
 const bottom=s.y-s.height/2,roof=lot.height;
 const height=Math.max(s.height,Math.min(3.65,Math.max(s.height*1.75,width*.43)));
 const available=Math.max(0,s.z+lot.depth/2-.24);
 const wing=mode===1||mode===4?Math.min(1.65,lot.depth*.28,available):mode===3?Math.min(.85,lot.depth*.16,available):0;
 for(const scale of [1,.75,.5,0]){
  const w=s.width+(width-s.width)*scale,h=s.height+(height-s.height)*scale,k=wing*scale;
  const v={...s,width:w,height:h,y:bottom+h/2,wing:k,mode,bottom,roof};
  if(clear({...v,z:s.z-k/2,depth:s.depth+k}))return v;
 }
 return {...s,wing:0,mode,bottom,roof};
}

const visualCityRoofs=new WeakMap();
export function cityRooftopVisual(lot,sign){
 let v=visualCityRoofs.get(sign);
 if(!v){v=rooftopBillboardVisual(lot,sign,lot.index,q=>citySignClear(lot,q));visualCityRoofs.set(sign,v);}
 return v;
}
export function gmRooftopVisual(spec,sign,seed=0,signs=houseSignSpecs({...spec,bladeCount:spec.bladeCount??0,roofCount:spec.roofCount??0})){
 return rooftopBillboardVisual(spec,sign,(sign.seed+seed)|0,q=>!signs.some(other=>other.id!==sign.id&&other.id.startsWith('sign-roof-')&&Math.abs(other.x-q.x)<(other.width+q.width)/2+.10&&Math.abs(other.z-q.z)<(other.depth+q.depth)/2+.10));
}
export const ROOF_PAINT_RAY_RANGE=65;
export function isRooftopPaintWall(wall){return typeof wall==='string'&&/^sign-roof-\d+:[+\-LR]$/.test(wall);}
export function paintPointInReach(position,location,wall){
 if(!location||!position)return false;
 const dx=location[0]-position[0],dy=location[1]-(position[1]+1.4),dz=location[2]-position[2];
 return isRooftopPaintWall(wall)?Math.hypot(dx,dz)<=19&&Math.hypot(dx,dy,dz)<=ROOF_PAINT_RAY_RANGE:Math.hypot(dx,dy,dz)<=19;
}
const HIGH_RISE_COMPANIES=Object.freeze([
 ['光磊科技','LUMEN SYSTEMS','#23476b'],['長曜銀行','CHANG YAO BANK','#236852'],['晶川半導體','CRYSTAL RIVER SEMICONDUCTOR','#325e9d'],['東衡商業銀行','EAST BALANCE BANK','#286f67'],['聯星電子','UNITED STAR ELECTRONICS','#3d5893'],['華遠銀行','HUA YUAN BANK','#9a303a'],['新域資訊','NOVA DOMAIN TECHNOLOGY','#394b76'],['海岳國際銀行','OCEAN PEAK BANK','#294d67'],['天穹光電','SKYVAULT OPTRONICS','#3e668b'],['永辰銀行','YONG CHEN BANK','#27685e'],['微島科技','MICRO ISLAND TECHNOLOGY','#424c78'],['中原信託銀行','CENTRAL TRUST BANK','#9c4142']
]);
export function highRiseCompanySign(floors,seed){
 if(floors<=5)return null;
 const [title,subtitle,color]=HIGH_RISE_COMPANIES[(seed>>>0)%HIGH_RISE_COMPANIES.length];
 return {title,subtitle,color,style:'wild',font:'hei',shopKind:(seed>>>0)%2?'bank':'technology'};
}
