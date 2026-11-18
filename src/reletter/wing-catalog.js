const names=['Sparrow Dawn','Dew Moth','Fern Sprite','Little Bat','Swan Mist','Monarch Silk','Willow Wisp','Gargoyle Veil','Heron Aurora','Luna Moth','Orchid Fairy','Wyvern Dusk','Phoenix Ember','Glasswing Halo','Rose Seraph','Crimson Drake','Celestial Crane','Starlit Morpho','Worldtree Spirit','Abyssal Sovereign'];
const originals=names.map((name,i)=>{const tier=Math.min(6,1+Math.floor(i*6/20));return {id:'wings-'+(i+1),name,slot:'wings',family:'wings',style:i%4,tier,color:['#eee9e3','#94d1aa','#8dbcec','#ee91a6','#f0d292','#c5a0ed'][tier-1],price:0,notForSale:true,impulse:5.5+tier*1.55,gravity:Math.max(.22,.93-tier*.115),flapMs:300,description:`Air jump · lift ${tier}/6 · preserve the original wing mechanics. Premium-only; never drops.`};});

// Preserve every collectible ID and existing player's ownership. The
// fourteen redesigned BLUE / PURPLE / GOLD wings use separate materials and
// independent palettes; rarity must never be interpreted as pigment.
const newWings=[
 ['Ivory Ribbontail',1,'#f0eee9','#cabcc5',null],
 ['Snowdrop Swallowtail',1,'#e9f3f0','#d2c9ac',null],
 ['Pearl Paperkite',1,'#f5e9df','#a6c6d4',null],
 ['Moonlit Lacewing',1,'#dfe7f3','#a4a1c9',null],
 ['Emerald Garden Kite',2,'#80d3a0','#e5ffab',null],
 ['Jade Fern Swallowtail',2,'#65cfa9','#b5f3dc',null],
 ['Verdant Silk Dancer',2,'#91d57f','#d6f2b7',null],
 ['Rough Wooden Plank Wings',3,'#a47a58','#e3c291','wood'],
 ['Triple Balloon Wings',3,'#ee7c7c','#68d7e8','balloon'],
 ['Tattered Rag Wings',3,'#b7857e','#d2b9a0','rag'],
 ['Patchwork Scrap Metal Wings',3,'#778f98','#b9a591','tin'],
 ['Adhesive Tape Wings',3,'#e7e0b8','#8fcae2','tape'],
 ['Peacock Ocellus Fan',4,'#087f78','#ccae5b','peacock'],
 ['Swan Feather Mantle',4,'#e8edfa','#f9f9f3','swan'],
 ['Cyberpunk Neon Wings',4,'#212b52','#04e4ec','cyberpunk'],
 ['Steampunk Brass Wings',4,'#956d43','#f1c878','steampunk'],
 ['Monster Eyes Membrane',4,'#70243e','#e1bd9c','monster'],
 ['Chicken Feather Wings',5,'#e7d3b9','#a4907c','chicken'],
 ['Plastic Sheet Wings',5,'#9beaf1','#ffd3f1','plastic'],
 ['Fluffy Fur Wings',5,'#cba98c','#796451','fur'],
 ['Koinobori Streamer Wings',5,'#de5148','#315b93','koinobori']
];
export const SWALLOWTAIL_WINGS=Object.freeze(newWings.map(([name,tier,color,accent,motif],index)=>({
 id:'wings-'+(index===16?41:index>16?index+20:index+21),name,slot:'wings',family:'wings',
 design:motif?'crafted-wing':'swallowtail',motif,
 premiumWing:true,gmWingExclusive:true,
 style:index%4,patternVariant:index,specimen:null,tier,
 color,accent,visualComplexity:motif?(tier===4?16:tier===5?10:4):tier,
 price:0,notForSale:true,
 impulse:5.5+tier*1.55,gravity:Math.max(.22,.93-tier*.115),flapMs:300,
 description:motif?`Artist-designed ${motif} wings · quality and actual pigment are independent. Tier ${tier}/5.`:
  'Premium Papilio butterfly · GM-only preview.'
})));
export const WINGS=Object.freeze([...originals,...SWALLOWTAIL_WINGS]);
