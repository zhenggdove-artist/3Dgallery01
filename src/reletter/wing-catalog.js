// The only purchasable wings: five BLUE, four GOLD, five PURPLE.
// Quality controls rarity/complexity, never the visual pigment.
// Preserve previously issued IDs for the fourteen designs.
const newWings=[
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
const ids=[28,29,30,31,32,33,34,35,36,41,37,38,39,40];
export const SWALLOWTAIL_WINGS=Object.freeze(newWings.map(([name,tier,color,accent,motif],index)=>({
 id:'wings-'+ids[index],name,slot:'wings',family:'wings',
 design:'crafted-wing',motif,style:index%4,patternVariant:index,
 tier,color,accent,visualComplexity:tier===4?16:tier===5?10:4,
 price:tier===3?3000:tier===4?9000:6000,notForSale:false,shopWing:true,
 impulse:5.5+tier*1.55,gravity:Math.max(.22,.93-tier*.115),flapMs:300,
 description:'Physical/material wing · quality does not determine its hue.'
})));
export const WINGS=SWALLOWTAIL_WINGS;
