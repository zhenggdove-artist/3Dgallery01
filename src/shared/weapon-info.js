import {attackStats} from './catalog.js';
import {weaponRangeClass} from '../reletter/odd-weapons.js';

// Readable descriptions follow the authoritative combat catalog, not icon art.
const families={
 water:'潮汐三叉杖：向瞄準方向發射水彈；滿集氣產生前方潮浪與範圍衝擊',
 ice:'冰晶法杖：投射霜晶；滿集氣在瞄準區域生成冰裂與碎晶',
 fire:'燼火權杖：燃燒前方目標；滿集氣在前方形成持續的火焰區域',
 lightning:'雷暴導體：遠距離電弧攻擊；滿集氣在命中區域引發強烈雷爆',
 beam:'棱鏡聚焦器：沿瞄準方向射出光束；滿集氣釋放長距離強光束',
 petal:'花冠法器：向前射出符晶與花瓣；滿集氣在目標區域長出荊棘',
 wave:'渦流海螺：向前投射潮浪；滿集氣製造向外擴展的旋流',
 saber:'近身星光劍：揮砍敵人；滿集氣發出強化劍氣',
 whip:'長鞭：中近距離連續鞭擊；滿集氣擴大攻擊範圍',
 swatter:'蒼蠅拍：快速近戰與旋風攻擊',
 pan:'平底鍋：近距離重擊與震波攻擊',
 planter:'盆栽：近身敲擊與荊棘區域效果',
 palm:'椰子樹：大範圍近戰與衝擊',
};
export function weaponClass(item){return weaponRangeClass(item);}
export function explainWeapon(item){
 if(!item)return '';
 if(item.slot!=='weapon')return item.description||'可裝備物品';
 const cls=weaponClass(item),grade={near:'近距離',mid:'中距離',far:'遠距離'}[cls],normal=attackStats(item,0),charged=attackStats(item,1);
 return [
  grade+'武器',
  item.description||families[item.family]||'特殊武器。按住攻擊鍵集氣，完整蓄力後釋放強力攻擊。',
  '基本射程 '+normal.range.toFixed(1)+'m，滿集氣射程 '+charged.range.toFixed(1)+'m',
  '基本傷害 '+Math.round(normal.damage)+'，滿集氣傷害 '+Math.round(charged.damage),
  '滿集氣影響半徑約 '+charged.radius.toFixed(1)+'m；藍色魔法陣預覽的是伺服器使用的攻擊方向與區域'
 ].join(' · ');
}
