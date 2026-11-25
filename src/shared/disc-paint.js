import {PLATFORMS} from './arena.js';
export function discPaintTarget(world,key){
 if(typeof key!=='string'||world.removedPlatformIds?.includes(key))return null;
 if(key.startsWith('floating:')){const d=world.floatingPlatforms?.find(p=>p.id===key.slice(9));return d?{position:d.position,radius:d.radius*2}:null;}
 const m=/^(display|stair):(platform-\d{2})(?::(\d+))?$/.exec(key);if(!m||world.removedArtworkIds?.includes(m[2]))return null;
 const d=PLATFORMS.find(p=>p.id===m[2]);if(!d)return null;
 const override=world.platformOverrides?.[key],top=Math.max(0,d.size[1]),r=world.artworkLayout?.[d.id]?.platformRadius??Math.min(14,Math.max(4.8,d.size[0]/2)),display=world.platformOverrides?.['display:'+d.id];
 const pos=[display?.position?.[0]??d.position[0],display?.position?.[1]??top,display?.position?.[2]??d.position[2]];
 if(m[1]==='display'&&m[3]===undefined)return {position:override?.position||pos,radius:override?.radius??r,uncertain:!override&&!world.artworkLayout?.[d.id]?.platformRadius};
 const steps=top<=.25?0:Math.max(1,Math.round(Math.max(5,Math.ceil(top/1.7))/3)),i=Number(m[3]);if(m[1]!=='stair'||!Number.isInteger(i)||i<0||i>=steps)return null;
 const t=(i+1)/(steps+1),dist=r+1.2+(1-t)*4,turn=Math.atan2(pos[2],pos[0])+(1-t)*Math.PI*1.6;
 return {position:override?.position||[pos[0]+Math.cos(turn)*dist,Math.max(.15,top*t),pos[2]+Math.sin(turn)*dist],radius:override?.radius??5.4,uncertain:!override};
}
export function validateDiscPaint(world,actor,stroke){
 const d=discPaintTarget(world,stroke?.lotId);if(!d||stroke.wall!=='top')return {error:'Invalid disc'};
 if(!['brush','eraser'].includes(stroke.tool)||!/^#[0-9a-f]{6}$/i.test(stroke.color)||!Number.isFinite(stroke.size)||stroke.size<.04||stroke.size>.95)return {error:'Invalid brush'};
 if(!Array.isArray(stroke.points)||!stroke.points.length||stroke.points.length>130)return {error:'Invalid stroke length'};
 const points=[];for(const p of stroke.points){if(!Array.isArray(p)||p.length!==2||!p.every(n=>Number.isFinite(n)&&n>=0&&n<=1)||Math.hypot(p[0]-.5,p[1]-.5)>.501)return {error:'Invalid disc coordinates'};
 const radius=d.radius,location=[d.position[0]+(p[0]-.5)*2*radius,d.position[1],d.position[2]+(p[1]-.5)*2*radius];if(!Array.isArray(actor.position)||Math.hypot(location[0]-actor.position[0],location[1]-actor.position[1]-1.4,location[2]-actor.position[2])>(d.uncertain?34:19))return {error:'Paint within reach of your character'};
 points.push(p.map(n=>+n.toFixed(4)));}
 return {points};
}
