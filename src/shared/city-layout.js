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
 return lots.slice(0,Math.max(0,Math.min(CITY_BUILDING_COUNT,limit)));
}
export const CITY_LOTS=cityLots();
export const CITY_MAX_HP=240;
export function cityStage(hp,maxHp=CITY_MAX_HP){
 return hp<=0?3:hp<=maxHp/3?2:hp<=maxHp*2/3?1:0;
}
export function cityLocal(lot,x,z){
 const dx=x-lot.x,dz=z-lot.z,c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
 return [dx*c-dz*s,dx*s+dz*c];
}
export function cityBlocked(x,z,y=0,damage={},radius=.22){
 for(const lot of CITY_LOTS){
  // Cheap broad phase before rotated OBB test.
  const dx=x-lot.x,dz=z-lot.z;
  if(dx*dx+dz*dz>(lot.width+lot.depth+radius*3)**2)continue;
  const stage=cityStage(damage[lot.id]?.hp??CITY_MAX_HP);
  if(stage===3)continue;
  const [lx,lz]=cityLocal(lot,x,z);
  if(Math.abs(lx)<lot.width/2+radius&&Math.abs(lz)<lot.depth/2+radius &&
   y>=-1&&y<(stage===2?Math.min(2.2,lot.height*.33):lot.height))return true;
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
  const h=stage===2?Math.min(2.2,lot.height*.33):lot.height;
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
