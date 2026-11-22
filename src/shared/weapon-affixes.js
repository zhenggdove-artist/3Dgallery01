// Temple weapon enchantments are independent of the legacy RELETTER affix
// IDs. Each physical inventory UID rolls its own persistent 3–15% property.
// A successful fusion retains the full ordered naming history, but inherits
// only 30% of each material property's value to keep damage bounded.
export const WEAPON_AFFIXES=Object.freeze([
 {id:'brutal',name:'Brutal',stat:'crit',label:'Critical Chance'},
 {id:'stalwart',name:'Stalwart',stat:'defense',label:'Damage Reduction'},
 {id:'mighty',name:'Mighty',stat:'attack',label:'Attack Power'},
 {id:'ferocious',name:'Ferocious',stat:'damage',label:'Weapon Damage'},
 {id:'surging',name:'Surging',stat:'charge',label:'Ultimate Damage'},
 {id:'swift',name:'Swift',stat:'haste',label:'Attack Speed'},
 {id:'vital',name:'Vital',stat:'hp',label:'Maximum HP'},
 {id:'fleet',name:'Fleet',stat:'speed',label:'Movement Speed'},
 {id:'aerial',name:'Aerial',stat:'jump',label:'Jump Height'}
]);
const table=new Map(WEAPON_AFFIXES.map(x=>[x.id,x]));
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
export function weaponAffixById(id){return table.get(id)||null;}
export function normalizedWeaponAffixes(record){
 const list=Array.isArray(record)?record:record?.weaponAffixes;
 if(!Array.isArray(list))return [];
 return list.slice(0,64).flatMap(x=>{
  if(!table.has(x?.id))return [];
  const n=Number(x?.percent);
  if(!Number.isFinite(n)||n<=0)return [];
  return [{id:x.id,percent:+clamp(n,.01,15).toFixed(2)}];
 });
}
export function rollWeaponAffixes(item,rng=Math.random){
 if(item?.slot!=='weapon')return [];
 const draw=()=>clamp(Number(rng())||0,0,.999999);
 const id=WEAPON_AFFIXES[Math.floor(draw()*WEAPON_AFFIXES.length)].id;
 return [{id,percent:3+Math.floor(draw()*13)}];
}
export function mergeWeaponAffixes(main,material){
 const mine=normalizedWeaponAffixes(main),extra=normalizedWeaponAffixes(material)
  .map(v=>({id:v.id,percent:+(v.percent*.3).toFixed(2)}))
  .filter(v=>v.percent>0);
 // Twenty successful upgrades are possible. Even many pre-fused ingredients
 // cannot expand the ledger indefinitely or overload bag text and save data.
 return [...mine,...extra].slice(0,64);
}
export function weaponAffixTotals(record){
 const totals={crit:0,defense:0,attack:0,damage:0,charge:0,haste:0,hp:0,speed:0,jump:0};
 for(const {id,percent} of normalizedWeaponAffixes(record)){
  const stat=table.get(id)?.stat;if(stat)totals[stat]+=percent;
 }
 const caps={crit:45,defense:40,attack:45,damage:45,charge:45,haste:35,hp:45,speed:35,jump:40};
 for(const [k,v] of Object.entries(caps))totals[k]=Math.min(v,+totals[k].toFixed(2));
 return totals;
}
export function weaponAffixLabel(entry){
 const descriptor=weaponAffixById(entry?.id);
 return descriptor?descriptor.name+': '+descriptor.label+' +'+Number(entry.percent).toFixed(2).replace(/\.?0+$/,'')+'%':'';
}
export function weaponAffixPrefix(record){
 return normalizedWeaponAffixes(record).map(a=>table.get(a.id).name).join(' ');
}
