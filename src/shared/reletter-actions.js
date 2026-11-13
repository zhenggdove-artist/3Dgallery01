// Temple persistence/identity adapter. The actual fishing and cultivation state
// machines execute RELETTER's original functions, not look-alike simulations.
import {gardenAction,GARDEN_ACTIONS} from '../reletter/server/garden-rules.js';
import {fishingAction,FISH_ACTIONS,fishingView} from '../reletter/server/fishing-rules.js';
import {itemById} from './catalog.js';
import {FISHING_POND,insideArena,insideSafeZone} from './arena.js';
export const ORIGINAL_ACTIONS=new Set([...GARDEN_ACTIONS,...FISH_ACTIONS].filter(a=>!['seed-buy','wing-pickup','weapon-pickup','harvest-arrange'].includes(a)));
const initialFishing=()=>({holes:[],ponds:[],sessions:{},bags:{},revision:0});
export function originalView(world){const g=world.reletter;if(!g)return {garden:{crops:[]},fishing:initialFishing()};return {garden:g.garden,fishing:fishingView(g)};}
export function originalAction(world,profile,actor,body,now,rng){
  const g=structuredClone(world.reletter||{}),key=profile.key;
  if(['dig','seed-plant','pond-build'].includes(body.action)&&(!insideArena(body.position)||insideSafeZone(body.position)))return {error:'Choose clear ground outside the safe zone'};
  if(body.action==='seed-plant'&&(g.garden?.crops?.length||0)>=40)return {error:'Garden limit reached; harvest a crop first'};
  if(body.action==='pond-build'&&!['small','medium','large'].includes(body.size||'small'))return {error:'This aquarium is too large for Temple'};
  g.inventories=Object.fromEntries(Object.entries(world.profiles).map(([id,p])=>[id,[...p.inventory]]));g.equipment=Object.fromEntries(Object.entries(world.profiles).map(([id,p])=>[id,{...p.equipment}]));g.wallets={[key]:profile.admin?1e9:profile.wallet};
  g.garden??={crops:[],stacks:{},buffs:{},revision:0};g.garden.stacks[key]={};for(const id of profile.inventory)if(['seed','harvest'].includes(itemById(id)?.slot))g.garden.stacks[key][id]=(g.garden.stacks[key][id]||0)+1;
  g.fishing??=initialFishing();
  g.blocks=world.structures.map(b=>({position:b.position,size:b.kind==='tree'?[1.2,4,1.2]:b.kind==='house'?[5,3.8,4]:[2,2,2]}));
  const originalActor={character:key,state:{position:actor.position,visible:true,phase:2}};
  if(body.action==='pond-destroy'&&g.fishing.ponds.find(p=>p.id===body.pond)?.owner!==key&&!profile.admin)return {error:'Only the aquarium owner can remove it'};
  const result=GARDEN_ACTIONS.includes(body.action)?gardenAction(g,originalActor,body,now,rng):fishingAction(g,originalActor,body,now,rng);
  if(result?.error)return result;
  if(!profile.admin){const delta=(g.wallets[key]||0)-profile.wallet;profile.wallet=Math.max(0,Math.floor(g.wallets[key]||0));if(delta<0)world.activity.coinBurned-=delta;else world.activity.coinMinted+=delta;}
  profile.inventory=profile.inventory.filter(id=>!['seed','harvest'].includes(itemById(id)?.slot));for(const [id,count] of Object.entries(g.garden.stacks[key]))for(let i=0;i<Math.min(100,count);i++)profile.inventory.push(id);
  if(body.action==='harvest-eat'){const item=itemById(body.item);profile.hp=Math.min(profile.maxHp,profile.hp+profile.maxHp*(item.heal||.1));}
  for(const field of ['inventories','equipment','wallets','blocks'])delete g[field];world.reletter=g;
  return {...result,notice:result.notice||({dig:'FISHING HOLE CREATED','seed-plant':'SEED PLANTED','crop-water':'WATERED','crop-harvest':'HARVEST READY','harvest-eat':'HARVEST EATEN','pond-build':'AQUARIUM BUILT'}[body.action])};
}
