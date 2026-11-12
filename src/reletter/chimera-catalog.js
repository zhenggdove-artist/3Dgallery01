// Original fictional designs; shared by presentation, encounter migration and hit volumes.
export const CHIMERAS=[
 ['gall-bull','瘤冠牛人','bull',1.35,18,2,0],['rib-minotaur','肋骨牛魔','bull',2.2,5,6,1],
 ['eye-aurochs','百目荒牛','bull',1.7,12,4,2],['root-ox','根鬚牛祭司','bull',2.8,7,8,3],
 ['coil-host','盤蛇宿主','snake',1.35,12,3,0],['hydra-host','五首蛇人','snake',1.9,8,5,1],
 ['spine-serpent','脊環蛇魔','snake',2.6,4,7,2],['crowned-naga','冠冕巨蛇','snake',3.8,10,9,3],
 ['hound-host','獵犬縫合者','hound',1.35,16,2,0],['cerberus-host','三首犬人','hound',2,9,3,1],
 ['quill-hound','棘背獵魔','hound',1.7,7,12,2],['jaw-colossus','巨顎犬王','hound',3.5,8,6,3],
 ['burl-host','樹瘤寄生者','tree',1.8,20,5,0],['fungal-stag','菌冠鹿木魔','tree',2.3,14,8,1],
 ['hollow-warden','空洞樹衛','tree',3,6,12,2],['root-cathedral','根鬚巨神','tree',4.5,12,16,3],
 ['moth-reliquary','蛾翼囚籠魔','demon',2,8,4,0],['centipede-saint','蜈足異僧','demon',2.2,16,10,1],
 ['bell-devourer','鐘腹吞噬者','demon',3.2,5,8,2],['ocular-sovereign','千眼翼王','demon',4,24,12,3]
].map(([id,name,family,scale,nodules,spines,variant],index)=>({id:'chimera-'+id,name,family,scale,nodules,spines,variant,index,base:'uncle',height:1.575*scale,radius:.32*scale}));
export const chimeraById=id=>CHIMERAS.find(c=>c.id===id);
