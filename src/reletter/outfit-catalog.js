const collections=[
 ['pajamas',['Candy Stripe','Moon Stars','Cloud Nap','Teddy Dreams','Midnight Constellation'],['#cda9ba','#9badd3','#b3ced5','#ccb599','#a79abe'],'hp',1,'defense',.025],
 ['silk',['Cherry Picnic','Garden Silk','Mint Tartan','Rainbow Slumber','Koi Dreams'],['#d5a8a9','#b5c7a3','#97beb5','#c3aed3','#c2a580'],'jump',.035,'hp',1],
 ['fuzzy',['Marshmallow Feet','Alpaca Hug','Lynx Paws','Yeti Snow','Aurora Fur'],['#c5b6a7','#cdb8a0','#b7a98c','#c1d2d7','#aea2cf'],'defense',.035,'hp',1],
 ['pig',['Peach Piglet','Bubble Pig','Truffle Pig','Royal Pig','Dream Boar'],['#d3a3a7','#c4a0b8','#ad9290','#d5b1a0','#c3a0c6'],'hp',2,'attack',.025],
 ['angel',['Little Cherub','Dawn Wings','Moon Seraph','Solar Angel','Celestial Choir'],['#e0d6bc','#dcc3b1','#b8c6d8','#dfc88f','#d4c2df'],'jump',.055,'defense',.025],
 ['centaur',['Moss Visitor','Lunar Centaur','Coral Voyager','Nebula Runner','Astral Stallion'],['#a2c5ac','#a8bfd0','#d1adbb','#b1a0d0','#c7b68c'],'speed',.045,'hp',1],
 ['dinosaur',['Fern Raptor','Peach Triceratops','Lake Stegosaur','Amber Dragon','Violet Tyrant'],['#a3bd91','#d0b095','#8fb5bd','#c4ab77','#ad94bd'],'attack',.045,'defense',.02],
 ['skater',['Sidewalk Kid','Mint Kickflip','Sunset Street','Neon Halfpipe','Starlight Pro'],['#b3a698','#94b6ab','#c99599','#9c9fc7','#b9a9d3'],'speed',.035,'jump',.035],
 ['witch',['Herbal Apprentice','Rose Spell','Tidal Oracle','Golden Coven','Dream Sorcerer'],['#a9b39a','#c4a0af','#99b9c7','#c3b286','#b19dc8'],'attack',.035,'hp',1],
 ['astronaut',['Milk Rocket','Sea Explorer','Mars Walker','Golden Orbit','Void Pioneer'],['#d5d1c7','#a3bacb','#c7a49a','#c9b688','#aca6c5'],'defense',.04,'speed',.02]
];
export const OUTFITS=collections.flatMap(([design,names,colors,key,gain,second,secondary])=>names.map((name,i)=>{const tier=i+1,bonuses={[key]:+(gain*tier).toFixed(3),[second]:+(secondary*tier).toFixed(3)};if(['silk','witch','angel'].includes(design))bonuses.fusion=+(.025*tier).toFixed(3);return {id:`outfit-${design}-${tier}`,name,slot:'outfit',family:'outfit',design,pattern:i,tier,color:colors[i],price:[20,45,90,160,260][i],bonuses,description:Object.entries(bonuses).map(([k,v])=>`${k==='hp'?'+'+v:'+'+Math.round(v*100)+'%'} ${k==='hp'?'max HP':k==='defense'?'damage reduction':k==='speed'?'movement speed':k==='jump'?'jump height':k==='fusion'?'fusion chance multiplier':'attack'}`).join(' · ')};}));


// Eleven explicitly requested creature and food outfits. These are separate
// wearable body suits, not recolours of the existing animal head slot.
const creatureOutfits=[
 ['elephant','Elephant Parade Suit','#94adb7',4,{hp:2.4,defense:.14}],
 ['rooster','Rooster Parade Suit','#d98e48',2,{attack:.11,speed:.10}],
 ['anteater','Anteater Forager Suit','#bba187',3,{attack:.11,defense:.08}],
 ['guinea-pig','Guinea Pig Fleece Suit','#d5ad95',2,{hp:1.5,speed:.12}],
 ['penguin','Penguin Tuxedo Suit','#34485f',3,{defense:.12,jump:.16}],
 ['polar-bear','Polar Bear Winter Suit','#d9e5e8',5,{hp:2.6,defense:.19}],
 ['jellyfish','Jellyfish Drift Suit','#84c4d4',3,{jump:.24,speed:.09}],
 ['crab-claw','Crab Armour Suit','#ce7768',4,{defense:.20,attack:.07}],
 ['lion','Lion Pride Suit','#bc9453',5,{attack:.18,hp:1.2}],
 ['banana-bunch','Banana Peel Suit','#efcf4f',2,{speed:.20,jump:.15}],
 ['eggplant','Eggplant Garden Suit','#845eaa',3,{defense:.11,jump:.10}]
];
OUTFITS.push(...creatureOutfits.map(([creature,name,color,tier,bonuses])=>({
 id:'outfit-creature-'+creature,name,slot:'outfit',family:'outfit',
 design:'creature',creature,pattern:(creature.length%5),tier,color,
 price:[0,350,850,1550,2800,4400][tier],bonuses,
 description:Object.entries(bonuses).map(([k,v])=>
  k==='hp'?'+ '+Math.round(v*10)+' max HP':
  '+ '+Math.round(v*100)+'% '+({defense:'damage reduction',speed:'movement speed',jump:'jump height',attack:'attack'}[k]||k)).join(' · ')
})));

const r106Outfits=[
 ['leather','Leather Jacket Set','#242128',3,2200,{defense:.12,speed:.10}],
 ['formal-suit','Formal Suit','#28313e',3,2400,{hp:1.5,attack:.10}],
 ['spider','Eight-Legged Spider Suit','#302b3d',4,4900,{speed:.16,jump:.18}],
 ['caterpillar','Caterpillar Suit','#83ad45',3,2650,{hp:1.6,defense:.10}],
 ['tree-disguise','Tree Disguise','#715139',4,4600,{hp:2.2,defense:.15}],
 ['rock-disguise','Rock Disguise','#34383d',4,4800,{hp:2.4,defense:.18,speed:-.08}],
 ['doghouse-disguise','Doghouse Disguise','#a96d49',4,4100,{hp:2.0,defense:.14}]
];
OUTFITS.push(...r106Outfits.map(([creature,name,color,tier,templePrice,bonuses])=>({
 id:'outfit-'+creature,name,slot:'outfit',family:'outfit',
 design:creature==='formal-suit'?'suit':creature==='leather'?'leather':'creature',creature,pattern:0,tier,color,
 price:templePrice,templePrice,bonuses,r106Wearable:true,
 ...(['rock-disguise','tree-disguise'].includes(creature)?{disguiseHeight:3,exposedHead:true}:{}),
  description:Object.entries(bonuses).map(([k,v])=>k==='hp'?'+'+Math.round(v*10)+' max HP':(v>=0?'+':'')+Math.round(v*100)+'% '+({defense:'damage reduction',speed:'movement speed',jump:'jump height',attack:'attack'}[k]||k)).join(' · ')
})));

 // Full-body prop disguises use the actual avatar height as their scale reference.
 const disguises=[
  ['chimney-disguise','Towering Chimney Disguise','#924c38',4,4900,3,{defense:.15,hp:2.0,speed:-.06}],
  ['cardboard-disguise','Battered Cardboard Box','#a17b48',2,950,2,{speed:.08,defense:.05}],
  ['garbage-bag-disguise','Torn Black Garbage Bag','#292b2d',2,1050,1.04,{speed:.10,hp:.7}],
  ['trash-can-disguise','Rusty Metal Trash Can','#686b68',3,2650,1.08,{defense:.15,hp:1.2}],
  ['postbox-disguise','Chunghwa Post Mailboxes','#236748',3,2950,1.08,{defense:.12,hp:1.5}],
  ['wooden-horse-disguise','Giant Wooden Horse','#a97a49',4,4900,2,{hp:2.2,defense:.12}],
  ['water-tower-disguise','Giant Water Tower','#849698',4,4900,2,{hp:2.4,defense:.13,speed:-.04}],
  ['utility-pole-disguise','Towering Utility Pole','#999388',4,4900,3,{hp:1.8,defense:.09,jump:.12}],
  ['tin-pipe-disguise','Giant Flexible Tin Pipe','#aab6ba',3,2950,3,{defense:.12,hp:1.3}],
  ['luroufan-sign-disguise','Taiwan Braised Pork Rice Lightbox','#d9a537',3,2950,2,{hp:1.5,defense:.10}],
  ['luroufan-bowl-disguise','Giant Braised Pork Rice Bowl','#d9a537',3,2950,2,{hp:1.5,defense:.10}],
  ['notok-sign-disguise','NOTOK Convenience Store Sign','#d32b35',3,2950,2,{hp:1.5,defense:.10}],
  ['987-sign-disguise','987 Convenience Store Sign','#d32b35',3,2950,2,{hp:1.5,defense:.10}],
  ['bubble-tea-disguise','Giant Bubble Milk Tea','#c99b68',3,2950,2,{hp:1.5,speed:.08}],
  ['fried-chicken-disguise','Giant Taiwanese Fried Chicken Cutlet','#bd792e',3,2950,2,{hp:1.2,attack:.10}],
  ['mutton-sign-disguise','Old Home Mutton Hot Pot Sign','#f1d626',3,2950,2.5,{hp:1.5,defense:.10}],
  ['ggcola-disguise','GGcola Bottle','#a63922',3,2950,2,{hp:1.5,speed:.08}],
  ['bei7-road-disguise','Bei 7th Rd. Sign','#168b66',3,2950,3,{hp:1.5,defense:.10}],
  ['traffic-light-disguise','Traffic Light','#216253',3,2950,1.6,{hp:1.5,defense:.10}],
  ['taipower-box-disguise','Taiwan Power Utility Box','#488da9',3,2950,1.7,{hp:1.5,defense:.10}],
  ['pooh-plush-disguise','Winnie the Pooh Plush Suit','#c68c2b',3,2950,1.6,{hp:1.5,defense:.10}],
  ['goldfish-bowl-disguise','Round Goldfish Bowl','#9ed8e6',3,2950,1.08,{hp:1.5,defense:.10}],
  ['pharmacy-bag-disguise','NHI Pharmacy Medicine Bag','#e6e7e1',3,2950,2,{hp:1.5,defense:.10}],
  ['gg-noodle-disguise','GG Fried Sauce Noodles','#192586',3,2950,1.45,{}],
  ['wheelchair-disguise','Blue Wheelchair','#244e91',3,2950,1,{}],
  ['joss-burner-disguise','Joss Paper Burner','#655e58',3,2950,2,{}],
  ['naughty-snack-disguise','不乖餅乾袋','#88c62b',3,2950,2,{}],
  ['taiwan-beer-disguise','台灣啤酒','#e5e8de',3,2950,2,{}]
 ];
 OUTFITS.push(...disguises.map(([creature,name,color,tier,templePrice,disguiseHeight,bonuses])=>({
  id:'outfit-'+creature,name,color,tier,price:templePrice,templePrice,slot:'outfit',family:'outfit',
  design:'disguise',creature,disguiseHeight,pattern:0,bonuses,r113Wearable:true,
  ...(['tin-pipe-disguise','luroufan-sign-disguise','bubble-tea-disguise','fried-chicken-disguise'].includes(creature)?{shopRelease:117}:{}),
  ...(!['wooden-horse-disguise'].includes(creature)?{exposedHead:true}:{}),
  ...(creature==='mutton-sign-disguise'?{shopRelease:121}:{}),
  ...(['ggcola-disguise','bei7-road-disguise','traffic-light-disguise','taipower-box-disguise'].includes(creature)?{shopRelease:122}:{}),
  ...(creature==='pooh-plush-disguise'?{shopRelease:123}:{}),
  ...(['goldfish-bowl-disguise','pharmacy-bag-disguise'].includes(creature)?{shopRelease:124}:{}),
  ...(['gg-noodle-disguise','wheelchair-disguise','joss-burner-disguise'].includes(creature)?{shopRelease:151}:{}),
  ...(['naughty-snack-disguise','taiwan-beer-disguise'].includes(creature)?{shopRelease:154}:{}),
  ...(['luroufan-sign-disguise','luroufan-bowl-disguise','notok-sign-disguise','987-sign-disguise'].includes(creature)?{shopRelease:118}:{}),
  description:Object.entries(bonuses).map(([k,v])=>k==='hp'?'+'+Math.round(v*10)+' max HP':(v>=0?'+':'')+Math.round(v*100)+'% '+({defense:'damage reduction',speed:'movement speed'}[k]||k)).join(' · ')
 })));
