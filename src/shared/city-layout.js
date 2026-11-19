// Deterministic city geometry shared by the browser and authoritative Worker.
// The extension doubles the original sand district's surface area (not its
// radius) and triples building count per square unit: 72 -> 432 lots.
export const CITY_INNER_RADIUS=92;
export const CITY_PREVIOUS_OUTER_RADIUS=184;
export const CITY_OUTER_RADIUS=Math.sqrt(
  CITY_INNER_RADIUS**2+2*(CITY_PREVIOUS_OUTER_RADIUS**2-CITY_INNER_RADIUS**2)
);
export const CITY_BUILDING_COUNT=432;
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
const ringCounts=[48,54,58,62,66,70,74];
const ringRadii=[102,122,143,164,186,207,229];
// Always build the full list first; limit is for deterministic test sampling,
// not device-dependent city collision. Mobile and desktop share ALL 432 lots.
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
   const size=Math.min(count-first,roll<.13?1:2+Math.floor(rand()*5));
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
  const weights=streetEnds.map((_,index)=>.45+rand()*1.5+(index%4===0?.85:0));
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
    lot.yaw=yaw+(rand()-.5)*.018;
   }
  }
  start+=count;
 }
}
export const CITY_LOTS=cityLots();
export const CITY_MAX_HP=240;
export function cityStage(hp,maxHp=CITY_MAX_HP){
 return hp<=0?3:hp<=maxHp/3?2:hp<=maxHp*2/3?1:0;
}
// A structural collapse occurs at each authoritative 10%-HP boundary.
export function cityDamageTier(hp,maxHp=CITY_MAX_HP){
 if(!Number.isFinite(hp)||!Number.isFinite(maxHp)||maxHp<=0)return 0;
 return Math.max(0,Math.min(10,Math.floor((maxHp-hp)*10/maxHp+1e-8)));
}
// Ten deterministic, irregular structural sections per house. Identical
// local-space fracture positions are used by the building skin and falling
// architectural pieces; no random geometry is generated on the hit frame.
const fractureProfiles=new WeakMap();
export function cityFractureProfiles(lot){
 let profiles=fractureProfiles.get(lot);
 if(profiles)return profiles;
 const rand=cityRandom((lot.index*73856093+82713)>>>0),walls=['front','right','back','left'];
 profiles=Array.from({length:10},(_,i)=>{
  const wall=walls[(i*3+lot.index)%4],width=lot.width*(.23+rand()*.21);
  const height=lot.height*(.13+rand()*.16);
  const localY=Math.min(lot.height-height*.58,Math.max(height*.65,
   lot.height*(.26+rand()*.63)));
  const localX=(rand()-.5)*(lot.width-width*.74);
  const localZ=(rand()-.5)*(lot.depth-width*.5);
  return {tier:i+1,wall,width,height,depth:.22+rand()*.48,
   localX,localY,localZ,seed:rand()*1000,
   tilt:(rand()-.5)*.42};
 });
 fractureProfiles.set(lot,profiles);
 return profiles;
}
export function cityFractureProfile(lot,tier){
 return cityFractureProfiles(lot)[Math.max(0,Math.min(9,Math.floor(tier)-1))];
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
 const [lx,lz]=cityLocal(lot,x,z);
 let localizedDrop=0,sideShear=0;
 // Irregular impact cells tear free independently. Unlike a uniform floor
 // squeeze this produces scattered gouges, diagonal shears and jagged edges
 // before the final low solid ruin. Rooftop center stays aligned with the
 // authoritative collider (the original exact center support contract).
 const profiles=cityFractureProfiles(lot);
 for(let i=0;i<profiles.length&&i<tier;i++){
  const p=profiles[i],progress=Math.min(1,Math.max(0,tier-i));
  const dx=(lx-p.localX)/(p.width*.85);
  const dy=(y-p.localY)/(p.height*1.2);
  const dz=(lz-p.localZ)/(p.width*.95);
  const proximity=Math.max(0,1-Math.sqrt(dx*dx+dy*dy+dz*dz)*.64);
  const fracture=progress*proximity*proximity;
  localizedDrop+=fracture*(.17+.07*Math.sin(p.seed))*p.height;
  sideShear+=fracture*p.tilt*.44;
 }
 const transient=Math.sin(Math.PI*amount);
 const roofRim=isRoof?Math.min(1,Math.hypot(lx/Math.max(1,lot.width),lz/Math.max(1,lot.depth))*2):1;
 const sheer=sideShear*transient*factor;
 return [x+Math.sin(y*1.9+lot.index*.9)*factor*.35*amount+sheer,
  y+(ruinedY-y)*amount-Math.min(lot.height*.18,localizedDrop)*transient*roofRim,
  z+Math.cos(y*1.5+lot.index*.7)*factor*.35*amount-sheer*.7];
}
function cityFootprint(lot,x,z,margin=0){
 const dx=x-lot.x,dz=z-lot.z;
 if(dx*dx+dz*dz>(lot.width+lot.depth+margin*3)**2)return false;
 const [lx,lz]=cityLocal(lot,x,z);
 return Math.abs(lx)<=lot.width/2+margin&&Math.abs(lz)<=lot.depth/2+margin;
}
export function cityGroundHeight(x,z,y=0,damage={}){
 let height=0;
 for(const lot of CITY_LOTS){
  // Keep support across the 0.20m corrugated roof overhang at its edges.
  if(!cityFootprint(lot,x,z,.16))continue;
  const top=cityRoofHeightAtHp(lot,damage[lot.id]?.hp??CITY_MAX_HP,damage[lot.id]?.maxHp??CITY_MAX_HP);
  // A character below an eave is blocked by its wall, never sucked upward.
  // The .16m tolerance is only for numerical landing precision, not climbing.
  if(y>=top-.16)height=Math.max(height,top);
 }
 return height;
}
export function cityBlocked(x,z,y=0,damage={},radius=.22){
 for(const lot of CITY_LOTS){
  if(!cityFootprint(lot,x,z,radius))continue;
  const top=cityRoofHeightAtHp(lot,damage[lot.id]?.hp??CITY_MAX_HP,damage[lot.id]?.maxHp??CITY_MAX_HP);
  // Leaving the original house uncollidable at stage 3 caused players to
  // phase through debris. Conversely a roof is walkable, not a side wall.
  if(y>=-1&&y<top-.12)return true;
 }
 return false;
}
// Slab intersection with a *solid* rotated rectangular building, including
// the top/bottom faces. The impact point chooses a damageable component.
export function cityRaycast(origin,direction,range,damage={}){
 if(!Array.isArray(origin)||!Array.isArray(direction)||range<=0)return null;
 let nearest=null;
 for(const lot of CITY_LOTS){
  const record=damage[lot.id],stage=cityStage(record?.hp??CITY_MAX_HP);
  if(stage===3)continue;
  const [ox,oz]=cityLocal(lot,origin[0],origin[2]);
  const c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
  const d=[direction[0]*c-direction[2]*s,direction[1],direction[0]*s+direction[2]*c];
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
  nearest={lot,distance:near,part,position:origin.map((v,i)=>v+direction[i]*near)};
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
export function cityPaintHit(origin,direction,range=17,damage={}){
 if(!Array.isArray(origin)||!Array.isArray(direction)||range<=0)return null;
 let best=null,limit=range;
 for(const lot of CITY_LOTS){
  if(cityStage(damage[lot.id]?.hp??CITY_MAX_HP)===3)continue;
  const dx=origin[0]-lot.x,dz=origin[2]-lot.z;
  const bound=range+Math.max(lot.width,lot.depth)*1.5;
  if(dx*dx+dz*dz>bound*bound)continue;
  const [ox,oz]=cityLocal(lot,origin[0],origin[2]);
  const c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
  const vx=direction[0]*c-direction[2]*s,vz=direction[0]*s+direction[2]*c,vy=direction[1];
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
 return best;
}
