import {attackStats} from './catalog.js';
import {weaponRangeClass} from '../reletter/odd-weapons.js';
import {pvpShotDamage,SNIPER_RANGE} from './combat-balance.js';
import {weaponQuality,forwardCastRadius,GOLDFISH_SWIM_RADIUS} from './weapon-abilities.js';
import {scaleUltimateFootprint} from './charge-area.js';
import {GOLDFISH_SCHOOL_RADIUS} from './goldfish-school.js';

// Descriptions are based on game mechanics. They are deliberately independent
// of old text in imported equipment catalogs, which may describe retired moves.
const familySkills={
 water:'普通：向準心發射水系彈體。大絕：沿前方釋放潮水衝擊。',
 ice:'普通：發射冰晶。大絕：冰霜區域與碎晶衝擊。',
 fire:'普通：前方火焰攻擊。大絕：持續火焰區域，命中附帶燃燒。',
 lightning:'普通：電弧攻擊。大絕：電流衝擊，持續施法可追蹤鎖定方向。',
 beam:'普通：光束法器攻擊。大絕：持續聚焦敵人，連續命中提高傷害。',
 petal:'普通：射出花瓣與法術彈。大絕：花瓣荊棘區域；持續施法每秒恢復 1 HP，滿血仍顯示 +1。',
 wave:'普通：潮浪衝擊。大絕：追蹤敵人的漩渦，沿途持續造成傷害。',
 saber:'普通：近身連續揮砍。大絕：沿準心方向推進的劍氣裂隙。',
 whip:'普通：連續鞭打。大絕：前方範圍攻擊並牽引敵人。',
 swatter:'普通：快速蒼蠅拍近戰。大絕：前方大範圍旋風。',
 pan:'普通：近距離重擊。大絕：範圍爆炸並擊飛接觸的角色。',
 planter:'普通：盆栽近身敲擊。大絕：生成荊棘與植物範圍攻擊。',
 palm:'普通：椰子樹揮擊。大絕：向前產生大型衝擊。',
};
const specials={
 accordion:'紅色手風琴：普通攻擊在身旁旋繞大型彩色音符。大絕只生成高密度音符龍捲風，以三倍旋轉速度沿前方行進；路徑內每個接觸目標每秒受傷一次。',
 giraffe:'柔軟長頸鹿迴旋棒：普通攻擊揮甩近戰。大絕拋出會擺動的迴旋棒，向外及返回時碰撞造成傷害。',
 goldfish:'金魚水砲：普通攻擊發射水砲。大絕召喚立體金魚魚群沿前方游動，接觸時造成傷害。',
 clam:'大花蛤：普通攻擊開闔貝殼揮擊。大絕向前釋放旋轉貝殼攻擊。',
 'white-cat':'貓貓衝鋒槍：第一人稱準心連射彩色子彈；集氣可使用連續彩虹彈幕。',
 'black-cat':'黑貓狙擊槍：只有開啟狙擊鏡才能射擊；大絕釋放高傷害遠距離狙擊光彈。',
 'calico-cat':'花貓散彈槍：向前散射多顆可碰撞彈丸；大絕提高散射範圍與威力。',
 fan:'暴走電風扇：普通攻擊揮擊推風；大絕生成多股會移動的旋風並減速敵人。',
 telephone:'尖叫電話聽筒：普通攻擊揮舞彈簧電話線；大絕放出環狀音波，附帶削弱效果。',
 jellybrella:'水母雨傘：普通攻擊以雨傘敲擊；大絕生成大型旋轉水母光霧並緩速。',
};
const bonusNames={hp:'最大生命值',attack:'攻擊加成',speed:'移動速度',jump:'跳躍高度',defense:'減少受到傷害',fusion:'融合成功機率'};
const num=(value,decimal=1)=>Number(value).toFixed(decimal).replace(/\.0+$/,'');
function actualBonuses(item,record){
 return {...(item.bonuses||{}),...(record?.templeStats?.bonuses||{})};
}
function describeBonuses(item,record){
 const bonus=actualBonuses(item,record);
 return Object.entries(bonus).map(([key,value])=>{
  const v=Number(value);
  if(!Number.isFinite(v)||v===0)return null;
  if(key==='hp')return bonusNames.hp+' +'+num(v*10,2)+' HP';
  return (bonusNames[key]||key)+' +'+num(v*100,2)+'%';
 }).filter(Boolean);
}
export function weaponClass(item){return weaponRangeClass(item);}

export function explainWeapon(item,fusion=null){
 if(!item)return '';
 if(item.slot!=='weapon')return explainEquipment(item,fusion);
 const effective={...item,...(fusion?.templeStats||{})};
 // The primary weapon never inherits a material weapon's attack reach.
 effective.range=item.range;effective.radius=item.radius;
 effective.chargeRange=item.chargeRange;
 const quality=weaponQuality(effective,fusion);
 const normal=attackStats(effective,0),charged=attackStats(effective,1);
 charged.range=+(charged.range*quality.range).toFixed(2);
 charged.radius=forwardCastRadius(effective,quality,charged.radius,false);
 if(item.id==='black-cat')charged.range=SNIPER_RANGE;
 if(item.id==='jellybrella')charged.radius=Math.max(10,charged.radius*2);
 if(item.id==='goldfish')charged.radius=GOLDFISH_SWIM_RADIUS*quality.visual;
 scaleUltimateFootprint(charged,effective,quality);
 if(item.id==='goldfish')charged.radius=GOLDFISH_SCHOOL_RADIUS*quality.visual;
 if(item.id==='giraffe')charged.range=+(item.chargedRange*quality.range).toFixed(2);
 const cls=({near:'近距離',mid:'中距離',far:'遠距離'})[weaponClass(item)]||'特殊';
 const description=specials[item.id]||familySkills[item.family]||item.description||'按住攻擊鍵集氣，大絕使用不同的傷害與範圍。';
 const extent=item.id==='accordion'
  ?'大絕移動碰撞範圍：長 '+num(charged.range)+'m、寬 '+num(charged.radius*2)+'m，每目標每秒最多受傷一次'
  :'大絕預示範圍：射程 '+num(charged.range)+'m、半徑約 '+num(charged.radius)+'m';
 const damage='PvP 基礎單次命中約 '+num(pvpShotDamage(item,normal,quality),2)+
  '；大絕約 '+num(pvpShotDamage(item,charged,quality),2)+'（實際傷害受命中次數、暴擊與減傷影響）';
 return [cls+'武器',description,
  '普通有效距離約 '+num(normal.range)+'m',extent,
  damage,'集氣 '+num((item.chargeMs||1500)/1000,2)+' 秒；攻擊間隔 '+num(item.cooldown/1000,3)+' 秒'].join(' · ');
}
export function explainEquipment(item,record=null){
 if(!item)return '';
 if(item.slot==='weapon')return explainWeapon(item,record);
 const bonuses=describeBonuses(item,record);
 const fusionInfo=Number(record?.layer)>0?'；已成功融合 '+Math.floor(record.layer)+' 次（每次繼承素材有效能力的 30%）':'';
 if(item.slot==='head'){
  const description=bonuses.length?bonuses.join('、'):'裝備於頭飾欄';
  return '頭飾：'+description+fusionInfo;
 }
 if(item.slot==='outfit')return '服裝：'+(bonuses.length?bonuses.join('、'):'服裝外觀')+fusionInfo;
 if(item.slot==='armor'){
  const defense=Number(record?.templeStats?.defense??item.defense)||0;
  return '護甲：直接傷害減免 '+num(Math.min(.65,defense/100)*100)+'%（單件護甲上限 65%）'+fusionInfo;
 }
 if(item.slot==='shield'){
  const capacity=Number(record?.templeStats?.capacity??item.capacity)||0;
  return '護盾：最大可吸收 '+num(capacity*10,2)+' 傷害；未受到攻擊 '+num(item.recharge||0)+' 秒後恢復'+fusionInfo;
 }
 if(item.slot==='wings'){
  const impulse=Number(record?.templeStats?.impulse??item.impulse)||0;
  const gravity=Number(item.gravity);
  const flap=Number(item.flapMs);
  return '翅膀：跳躍推進力 '+num(impulse,2)+(Number.isFinite(gravity)?'、重力倍率 '+num(gravity,2):'')+
   (Number.isFinite(flap)?'、拍翼間隔 '+num(flap/1000,2)+' 秒':'')+fusionInfo;
 }
 return [item.description||item.family||item.slot,...bonuses].filter(Boolean).join(' · ')+fusionInfo;
}
