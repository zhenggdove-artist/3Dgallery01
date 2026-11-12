import {PLATFORMS,SAFE_ZONE} from './shared/arena.js';
const ns='http://www.w3.org/2000/svg';
function dot(x,z,r,fill){const el=document.createElementNS(ns,'circle');for(const[k,v]of Object.entries({cx:x,cy:z,r,fill}))el.setAttribute(k,v);return el;}
export class Minimap{
 constructor(){this.layer=document.getElementById('map-dynamic');this.nodes=new Map();this.next=0;const base=document.getElementById('map-static');base.append(dot(0,0,SAFE_ZONE.radius,'#b5c7ad'));for(const p of PLATFORMS)base.append(dot(p.artPosition[0],p.artPosition[2],2,'#a57092'));}
 update(time,roots,self,monster){if(time<this.next)return;this.next=time+.1;const points=[...roots].filter(([,r])=>r.visible).map(([id,r])=>({id,p:r.position.toArray(),color:id===self?'#fff':'#47a6bc',r:id===self?2.6:1.8}));if(monster?.active)points.push({id:'monster',p:monster.position,color:'#cf304c',r:2.4});const live=new Set();for(const p of points){live.add(p.id);let o=this.nodes.get(p.id);if(!o){o=dot(0,0,p.r,p.color);o.setAttribute('stroke','#5c4354');o.setAttribute('stroke-width','.5');this.nodes.set(p.id,o);this.layer.append(o);}o.setAttribute('cx',p.p[0]);o.setAttribute('cy',p.p[2]);}for(const[id,o]of this.nodes)if(!live.has(id)){o.remove();this.nodes.delete(id);}}
}
