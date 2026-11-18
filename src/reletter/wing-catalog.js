const names=['Sparrow Dawn','Dew Moth','Fern Sprite','Little Bat','Swan Mist','Monarch Silk','Willow Wisp','Gargoyle Veil','Heron Aurora','Luna Moth','Orchid Fairy','Wyvern Dusk','Phoenix Ember','Glasswing Halo','Rose Seraph','Crimson Drake','Celestial Crane','Starlit Morpho','Worldtree Spirit','Abyssal Sovereign'];
const originals=names.map((name,i)=>{const tier=Math.min(6,1+Math.floor(i*6/20));return {id:'wings-'+(i+1),name,slot:'wings',family:'wings',style:i%4,tier,color:['#eee9e3','#94d1aa','#8dbcec','#ee91a6','#f0d292','#c5a0ed'][tier-1],price:0,notForSale:true,impulse:5.5+tier*1.55,gravity:Math.max(.22,.93-tier*.115),flapMs:300,description:`Air jump · lift ${tier}/6 · preserve the original wing mechanics. Premium-only; never drops.`};});

// Twenty-one bonus wings. Epic (purple QUALITY) is a five-specimen butterfly
// collection inspired by field specimens, not a demand for purple pigmentation.
const newWings=[
 ['Ivory Ribbontail',1,'#f0eee9','#cabcc5'],
 ['Snowdrop Swallowtail',1,'#e9f3f0','#d2c9ac'],
 ['Pearl Paperkite',1,'#f5e9df','#a6c6d4'],
 ['Moonlit Lacewing',1,'#dfe7f3','#a4a1c9'],
 ['Emerald Garden Kite',2,'#80d3a0','#e5ffab'],
 ['Jade Fern Swallowtail',2,'#65cfa9','#b5f3dc'],
 ['Verdant Silk Dancer',2,'#91d57f','#d6f2b7'],
 ['Mint Glass Morpho',2,'#6bdfc4','#ade5ed'],
 ['Azure Atlas',3,'#7cbdff','#f1e0fa'],
 ['Sapphire Glasswing',3,'#5db7e9','#d9e9ff'],
 ['Cobalt Comet Tail',3,'#6d8be8','#a8f1f0'],
 ['Cerulean Peacock',3,'#7acbd9','#d1c6ff'],
 ['Atlas Owl Eyes',4,'#a99781','#e6a631'],
 ['Amber Emperor Ocelli',4,'#d68529','#8b5132'],
 ['Crimson Night Swallowtail',4,'#17161c','#ee3024'],
 ['Emerald Comet Uraniid',4,'#171f22','#45d4a4'],
 ['Chestnut Tiger Admiral',4,'#513124','#c18a65'],
 ['Aureate Sun Monarch',5,'#f2ca71','#fff4bf'],
 ['Solaris Gilded Kite',5,'#ffc271','#c8f7ed'],
 ['Golden Halo Seraph',5,'#ebd486','#f6aaca'],
 ['Dawnfire Amber Emperor',5,'#f7aa69','#ffeea4']
];
export const SWALLOWTAIL_WINGS=Object.freeze(newWings.map(([name,tier,color,accent],index)=>({
 id:'wings-'+(index===16?41:index>16?index+20:index+21),name,slot:'wings',family:'wings',
 design:'swallowtail',premiumWing:true,gmWingExclusive:true,
 style:index%4,patternVariant:index,specimen:tier===4?['owl','amber','crimson','emerald','chestnut'][index-12]:null,tier,
 color,accent,visualComplexity:[0,1,2,3,8,4][tier],
 price:0,notForSale:true,
 impulse:5.5+tier*1.55,gravity:Math.max(.22,.93-tier*.115),flapMs:300,
 description:tier===4?'Epic specimen wings · complex naturalistic butterfly venation, ocelli and flutter dust.':'Premium Papilio · butterfly venation and scalloped tail · GM-only preview.'
})));
export const WINGS=Object.freeze([...originals,...SWALLOWTAIL_WINGS]);
