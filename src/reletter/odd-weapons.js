// Authored toy weapons. Statistics are authoritative; category describes the charged reach.
export const ODD_WEAPONS=[
 ['giraffe','長頸鹿迴旋棒','whip','far','#e6b95d',4,3.6,28,650,16,'boomerang',2,'握長頸甩動四肢；蓄力放出往返兩段的長頸鹿光粒迴旋鏢。'],
 ['goldfish','金魚水砲','pan','far','#ff963c',4,3.2,32,700,22,'jet',5,'握尾甩魚、眼睛變 X；蓄力噴出連續水柱。'],
 ['clam','大花蛤','pan','near','#e7a9c7',5,3,8,750,18,'shells',6,'貝殼隨揮擊開闔；滿蓄力自動發射六枚旋轉貝殼，持續按住循環釋放。'],
 ['white-cat','貓貓衝鋒槍','water','mid','#f4f2e6',2,22,28,220,18,'rainbow',7,'白貓雙手持握；第一人稱瞄準；蓄力七發七彩連射。'],
 ['black-cat','黑貓狙擊槍','beam','far','#343347',10,80,140,2000,48,'sniper',1,'黑貓重型狙擊姿態；第一人稱縮放；滿蓄力穿行極遠的強力光彈。'],
 ['calico-cat','花貓散彈槍','water','near','#e6ac76',6,9,12,850,24,'scatter',8,'花貓雙手持握；第一人稱扇形散彈；蓄力八發柔光彈。'],
 ['accordion','紅色手風琴','pan','far','#d43c57',4,3.5,30,700,24,'score',6,'揮舞散出彩色音符；蓄力釋放樂譜粒子龍捲風。'],
 ['fan','暴走電風扇','swatter','mid','#85d4bd',3,4,20,450,16,'gust',4,'扇葉旋轉，揮擊推風；蓄力四股螺旋風束並施加短暫緩速。'],
 ['telephone','尖叫電話聽筒','whip','mid','#bd7fce',4,4,24,550,20,'echo',3,'彈簧電話線隨手擺動；蓄力三道環狀聲波，短暫削弱敵人。'],
 ['jellybrella','水母雨傘','planter','near','#91d8ed',5,4,9,800,22,'jelly',5,'傘蓋與觸鬚柔軟擺動；蓄力散出五團水母光霧並緩速。']
].map(([id,name,family,rangeClass,color,damage,range,chargedRange,cooldown,chargeDamage,pattern,burst,description])=>({id,name,slot:'weapon',family,rangeClass,color,damage,range,chargedRange,chargeRange:chargedRange-range,cooldown,chargeDamage,pattern,burst,description,radius:.3,price:45+Math.round(chargeDamage*2),tier:3,exotic:true,firstPerson:id.includes('cat'),autoCharge:id==='clam',chargeMs:id==='black-cat'?1600:1000,element:['goldfish','clam','jellybrella'].includes(id)?'water':id==='fan'?'wind':id==='accordion'?'light':'earth'}));
export const oddWeapon=id=>ODD_WEAPONS.find(w=>w.id===id);
export const weaponRangeClass=w=>w.rangeClass||(w.range<12?'near':w.range<30?'mid':'far');
export function oddAttackStats(w,c){const full=c>=1;return {ultimate:full,range:full?w.chargedRange:w.range,radius:full&&w.pattern==='jet'?.65:w.radius,damage:full?w.chargeDamage:w.damage};}
export function oddVolley(w,shot){const charged=shot.charge>=1,count=charged?w.burst:(w.pattern==='scatter'?5:1),spread=w.pattern==='scatter'?(charged?.3:.22):0;return Array.from({length:count},(_,i)=>{const a=spread*(i/(count-1||1)*2-1),d=shot.direction,c=Math.cos(a),s=Math.sin(a);return {...shot,subshot:true,projectile:w.firstPerson||charged,damage:shot.damage/count,direction:[d[0]*c+d[2]*s,d[1],d[2]*c-d[0]*s],delay:(w.firstPerson?0:200)+(w.pattern==='scatter'?0:i*(w.pattern==='boomerang'?420:95))};});}
