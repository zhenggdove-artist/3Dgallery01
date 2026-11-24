import {PLATFORMS,SAFE_ZONE} from './shared/arena.js';

const SVG_NS='http://www.w3.org/2000/svg';
const VIEW_SPAN=132; // Follow the local player: the former 500m overview made every icon subpixel.
const PLAYER_COLORS=['#1785dc','#ffb332','#30a66d','#ec5799','#8056e9','#14a6aa','#bf4b38'];
const svgElement=tag=>document.createElementNS(SVG_NS,tag);

function circle(x,z,r,color){
 const element=svgElement('circle');
 for(const [key,value] of Object.entries({cx:x,cy:z,r,fill:color}))element.setAttribute(key,value);
 return element;
}
function mapPosition(value){
 if(Array.isArray(value))return value.length>=3&&Number.isFinite(value[0])&&Number.isFinite(value[2])?
  {x:value[0],z:value[2]}:null;
 return value&&Number.isFinite(value.x)&&Number.isFinite(value.z)?{x:value.x,z:value.z}:null;
}
function triangle(color,stroke){
 const element=svgElement('path');
 element.setAttribute('d','M 0 9 L -6.5 -6 L 6.5 -6 Z');
 element.setAttribute('fill',color);
 element.setAttribute('stroke',stroke);
 element.setAttribute('stroke-width','2');
 element.setAttribute('stroke-linejoin','round');
 return element;
}

export class Minimap{
 constructor(){
  this.svg=document.getElementById('minimap');
  this.layer=document.getElementById('map-dynamic');
  this.nodes=new Map();
  this.playerColors=new Map();
  this.nextColor=0;
  this.next=0;
  const base=document.getElementById('map-static');
  base.append(circle(0,0,SAFE_ZONE.radius,'#b5c7ad'));
  for(const platform of PLATFORMS)
   base.append(circle(platform.artPosition[0],platform.artPosition[2],2.8,'#a57092'));
 }
 update(time,roots,selfKey,monster,monsters=[],collector=null){
  if(time<this.next)return;
  this.next=time+.1;
  const me=roots.get(selfKey),origin=mapPosition(me?.position);
  if(origin){
   // Center on the avatar so other players, enemies and nearby artwork remain visible.
   this.svg.setAttribute('viewBox',
    (origin.x-VIEW_SPAN/2)+' '+(origin.z-VIEW_SPAN/2)+' '+VIEW_SPAN+' '+VIEW_SPAN);
  }
  for(const id of this.playerColors.keys())if(!roots.has(id))this.playerColors.delete(id);
  const points=[];
  for(const [id,root] of roots){
   if(id===selfKey||!root?.visible)continue;
   const p=mapPosition(root.position);if(!p)continue;
   if(!this.playerColors.has(id))
    this.playerColors.set(id,PLAYER_COLORS[this.nextColor++%PLAYER_COLORS.length]);
   points.push({id:'player:'+id,x:p.x,z:p.z,type:'player',color:this.playerColors.get(id)});
  }
  const boss=monster?.active?mapPosition(monster.position):null;
  if(boss)points.push({id:'boss',x:boss.x,z:boss.z,type:'monster'});
  for(let index=0;index<(monsters?.length||0);index++){
   const mob=monsters[index],p=mob?.active?mapPosition(mob.position):null;
   if(p)points.push({id:'monster:'+(mob.id??index),x:p.x,z:p.z,type:'monster'});
  }
  const collectorPosition=collector?.active?mapPosition(collector.position):null;
  if(collectorPosition)
   points.push({id:'collector',x:collectorPosition.x,z:collectorPosition.z,type:'collector'});
  if(origin)points.push({id:'self',x:origin.x,z:origin.z,
   type:'self',rotation:Number.isFinite(me.rotation?.y)?me.rotation.y:0});
  const live=new Set();
  for(const p of points){
   live.add(p.id);
   let node=this.nodes.get(p.id);
   if(!node){
    if(p.type==='self')node=triangle('#fffdf2','#21343f');
    else if(p.type==='collector')node=triangle('#ac39e8','#fff');
    else {
     node=circle(0,0,p.type==='monster'?3.6:5.5,
      p.type==='monster'?'#ed3048':p.color);
     node.setAttribute('stroke',p.type==='monster'?'#761023':'#fff');
     node.setAttribute('stroke-width',p.type==='monster'?'1.2':'2');
    }
    node.setAttribute('data-map-kind',p.type);
    this.nodes.set(p.id,node);this.layer.append(node);
   }
   if(p.type==='self'||p.type==='collector')
    node.setAttribute('transform','translate('+p.x+' '+p.z+') rotate('+
     (p.type==='self'?-p.rotation*180/Math.PI:0)+')');
   else{
    node.setAttribute('cx',p.x);node.setAttribute('cy',p.z);
    if(p.type==='player')node.setAttribute('fill',p.color);
   }
  }
  for(const [id,node] of this.nodes)if(!live.has(id)){
   node.remove();this.nodes.delete(id);
  }
  // The avatar must never be hidden beneath a monster or an overlapping player.
  const selfMarker=this.nodes.get('self');
  if(selfMarker&&this.layer.lastElementChild!==selfMarker)this.layer.append(selfMarker);
 }
}
