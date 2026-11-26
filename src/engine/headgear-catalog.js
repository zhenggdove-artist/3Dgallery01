// Original playful headgear; one persistent head slot, effects are server-owned.
const designs=[
 ['dinosaur','Dinosaur Hood','#75b866','attack',.12],['poop','Royal Poop','#865334','defense',.12],['angel','Angel Wings','#fff0c6','jump',.22],['hockey','Hockey Mask','#e9ded0','hp',3],['hero','Masked Rider','#5ca67b','speed',.16],
 ['cactus','Cactus Pot','#69995e','hp',2],['teapot','Teapot Crown','#83b6ce','defense',.1],['cat','Cat Hood','#e4be9e','speed',.12],['shark','Shark Bite','#77a6bd','attack',.14],['squid','Squid Cap','#c582aa','jump',.18],
 ['crown','Mimic Crown','#e9c56a','attack',.1],['pumpkin','Pumpkin King','#e49b4d','hp',4],['mushroom','Moon Mushroom','#cb82b4','defense',.14],['jelly','Jellyfish Veil','#a0ddeb','jump',.25],['ghost','Boo Hood','#e5e8ed','speed',.18],
 ['frog','Frog Hood','#a5c875','jump',.3],['bunny','Rabbit Ears','#ead3dc','jump',.28],['bear','Bear Hood','#b18a6b','hp',5],['fox','Fox Mask','#e4b077','attack',.09],['crab','Crab Crown','#c87963','defense',.18],
 ['snail','Snail Shell','#baa47d','defense',.2],['ufo','UFO Abduction','#98c8bd','jump',.24],['saturn','Saturn Halo','#bda0dc','speed',.14],['toaster','Toast Machine','#b3babe','hp',2],['tv','Static Television','#87a4b3','attack',.08],
 ['dice','Loaded Dice','#e4dfcc','attack',.16],['book','Forbidden Book','#8d6fa4','hp',3],['ramen','Ramen Bowl','#c86f60','hp',4],['flower','Sunflower Face','#efc854','defense',.08],['windmill','Windmill Cap','#b0d6cf','speed',.2],
 ['clock','Clockwork Head','#b6a07b','speed',.1],['lantern','Ghost Lantern','#f0b260','hp',2],['bat','Bat Wings','#8c75b2','jump',.2],['bee','Bee Bonnet','#dfbb64','speed',.22],['antler','Forest Antlers','#b19375','hp',3],
 ['ram','Ram Horns','#e0d1b9','attack',.18],['unicorn','Unicorn Horn','#d1bce6','jump',.16],['dragon','Dragon Helm','#a45a78','attack',.2],['astronaut','Space Helmet','#d5e4e9','defense',.16],['diver','Diving Bell','#c09f6a','defense',.22],
 ['plague','Plague Doctor','#7e8494','defense',.15],['wizard','Wizard Hat','#8977b8','attack',.13],['knight','Knight Helm','#a6bac7','defense',.25],['jester','Jester Crown','#d486ab','speed',.15],['pirate','Pirate Hat','#715b6c','attack',.15],
 ['samurai','Stag Kabuto','#b86b69','hp',6],['lotus','Lotus Bloom','#e7adcb','jump',.14],['banana','Banana Peel','#e6cf77','speed',.24],['sushi','Salmon Sushi','#efb1a0','hp',3],['cloud','Rain Cloud','#c9deef','jump',.26]
];
const procs={dinosaur:'bleed',poop:'poison',hero:'stun',shark:'bleed',crown:'expose',pumpkin:'burn',mushroom:'poison',jelly:'slow',ghost:'fear',squid:'weak',fox:'burn',tv:'stun',book:'fear',lantern:'burn',bee:'poison',antler:'root',dragon:'burn',plague:'poison',wizard:'slow',lotus:'weak'};
const label={attack:'attack',speed:'movement speed',jump:'jump height',defense:'damage reduction',hp:'max HP'};
export const HEADGEAR=designs.map(([design,name,color,key,value],i)=>({id:'hat-'+design,name,design,color,slot:'head',family:'headgear',tier:1+Math.floor(i/10),price:18+i*4,bonuses:{[key]:value},proc:procs[design]||null,description:`${key==='hp'?'+':'+ '+Math.round(value*100)+'% '}${key==='hp'?value+' ':''}${label[key]}${procs[design]?' · Hits apply '+procs[design]+'.':''}`}));

 // Distinct animal / food sculptures. Every bonus uses the live server stat
 // vocabulary (hp, defense, attack, speed and jump).
const creatureHeads=[
 ['elephant','Elephant Trunk Hood','#8aabb9',3,{hp:2.2,defense:.12},'root'],
 ['rooster','Rooster Sunrise Crest','#e9a554',2,{attack:.10,speed:.08},'burn'],
 ['anteater','Anteater Snout','#c5a47f',3,{attack:.12,defense:.06},'weak'],
 ['guinea-pig','Guinea Pig Bonnet','#d6ab8e',1,{hp:1.2,speed:.11},null],
 ['penguin','Penguin Hood','#364e63',2,{defense:.13,jump:.13},'slow'],
 ['polar-bear','Polar Bear Hood','#e7f1ef',4,{hp:2.8,defense:.15},'slow'],
 ['jellyfish','Jellyfish Bell','#92c9e9',3,{jump:.22,speed:.06},'slow'],
 ['crab-claw','Crab Claw Crown','#d88469',3,{defense:.20,attack:.06},'root'],
 ['lion','Lion Mane','#d7a15b',4,{attack:.17,hp:1.2},'fear'],
 ['banana-bunch','Banana Bunch','#f4d967',2,{speed:.20,jump:.15},null],
 ['eggplant','Eggplant Crown','#8d6abb',3,{defense:.10,jump:.08},'poison']
];
const describe=bonuses=>Object.entries(bonuses).map(([k,v])=>
 k==='hp'?'+ '+Math.round(v*10)+' max HP':
 '+ '+Math.round(v*100)+'% '+({attack:'attack',speed:'movement speed',jump:'jump height',defense:'damage reduction'}[k]||k)).join(' · ');
HEADGEAR.push(...creatureHeads.map(([design,name,color,tier,bonuses,proc])=>({
 id:'hat-'+design,name,design,color,slot:'head',family:'headgear',tier,
 price:[0,320,720,1350,2300,3600][tier],bonuses,proc,
 description:describe(bonuses)+(proc?' · Charged hits apply '+proc+'.':'')
})));

export const headgearById=id=>HEADGEAR.find(h=>h.id===id);

const r106Heads=[
 ['hydra-dragon','Three-Headed Fire Dragon','#a5483e',5,9200,{attack:.17,jump:.12},'burn'],
 ['ram-skull','Ram Skull Mask','#ded6bd',4,4300,{defense:.18,hp:1.4},'fear'],
 ['trump-mask','Trump Mask','#e6ad83',3,1850,{hp:1.8,attack:.08},null],
 ['huang-mask','Jensen Huang Mask','#d2a486',3,1850,{defense:.10,speed:.12},null],
 ['musk-mask','Elon Musk Mask','#e2bdab',3,1850,{jump:.18,attack:.09},null],
 ['xi-mask','Xi Jinping Mask','#cfa58a',3,1850,{hp:1.8,defense:.08},null],
 ['putin-mask','Vladimir Putin Mask','#ddbaa6',3,1850,{attack:.10,defense:.08},null],
 ['kim-mask','Kim Jong-un Mask','#dbaf96',3,1850,{hp:2.0,attack:.07},null]
];
HEADGEAR.push(...r106Heads.map(([design,name,color,tier,templePrice,bonuses,proc])=>({
 id:'hat-'+design,name,design,color,slot:'head',family:'headgear',tier,price:templePrice,templePrice,bonuses,proc,r106Wearable:!['xi-mask','putin-mask','kim-mask'].includes(design),r113Wearable:['xi-mask','putin-mask','kim-mask'].includes(design),
 description:describe(bonuses)+(proc?' · Charged hits apply '+proc+'.':'')
})));
