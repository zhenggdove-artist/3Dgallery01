import * as THREE from 'three';
import {mediaMarkup} from './media-ui.js';

// Pointer/touch access to authored message plants and the central message tree.
// The scene's plant meshes retain their full persistent entry in userData.
export function bindPlantHover({canvas,camera,arena,controller,ui}){
 const label=document.createElement('aside');
 label.id='plant-hover';label.hidden=true;document.body.append(label);
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
 let active=null,timer=null,last=0,down=null;
 const stopTimer=()=>{clearTimeout(timer);timer=null;};
 const hide=()=>{if(timer)return;timer=setTimeout(()=>{label.hidden=true;active=null;timer=null;},400);};
 const tree=()=>arena.scene.getObjectByName('Temple message tree');
 function pick(e){
  const c=controller();if(!c||ui.panelName)return null;
  const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
  pointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);
  ray.setFromCamera(pointer,camera);
  const plants=[...arena.adventure.plants.values()].filter(p=>p.position.distanceTo(c.root.position)<5.5);
  const hits=ray.intersectObjects(plants,true);
  let node=hits[0]?.object;
  while(node&&!node.userData.entry)node=node.parent;
  if(node?.userData.entry)return {entry:node.userData.entry,central:false};
  const central=tree();
  if(central&&Math.hypot(c.root.position.x,c.root.position.z)<11&&ray.intersectObject(central,true).length)
   return {entry:null,central:true};
  // earlier engine-style tap targeting: on mobile, a small plant can be too thin
  // for an exact ray hit. Select its nearest screen-space silhouette.
  if(e.pointerType==='touch'&&Math.hypot(c.root.position.x,c.root.position.z)<11){
   let best=null,score=68**2;
   for(const o of plants){const point=o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.65,0)).project(camera);
    if(point.z<0||point.z>1)continue;
    const px=rect.left+(point.x+1)*rect.width/2,py=rect.top+(1-point.y)*rect.height/2;
    const d=(e.clientX-px)**2+(e.clientY-py)**2;if(d<score){score=d;best=o.userData.entry;}}
   if(best)return {entry:best,central:false};
  }
  return null;
 }
 function show(e,hit){
  if(!hit)return hide();
  stopTimer();
  const key=hit.central?'central':hit.entry.id;
  if(key!==active){
   active=key;label.replaceChildren();
   const title=document.createElement('strong'),content=document.createElement('p');
   if(hit.central){
    const entries=ui.world?.plants||[];
    title.textContent='留言之樹 · '+entries.length+' 則記錄';
    content.textContent=entries.length?entries.slice(-3).reverse().map(x=>x.author+'：'+x.text).join(' / ').slice(0,250):'目前尚無留言。點擊閱讀或寫下第一則。';
   }else{
    title.textContent=hit.entry.author||'Anonymous';content.textContent=hit.entry.text||'媒體留言';
   }
   label.append(title,content);
   if(hit.entry?.media)label.insertAdjacentHTML('beforeend',mediaMarkup(hit.entry.media,window.TEMPLE_CONFIG.backendUrl));
   if(hit.entry?.createdAt){const stamp=document.createElement('time');stamp.dateTime=new Date(hit.entry.createdAt).toISOString();stamp.textContent=new Date(hit.entry.createdAt).toLocaleString('zh-TW');label.append(stamp);}
  }
  label.hidden=false;
  label.style.left=Math.max(8,Math.min(innerWidth-label.offsetWidth-8,e.clientX+16))+'px';
  label.style.top=Math.max(8,Math.min(innerHeight-label.offsetHeight-8,e.clientY+20))+'px';
 }
 canvas.addEventListener('pointermove',e=>{if(e.buttons)return;if(performance.now()-last<45)return;last=performance.now();show(e,pick(e));});
 canvas.addEventListener('pointerdown',e=>{down={id:e.pointerId,x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{
  const moved=!down||down.id!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>12;down=null;
  const hit=pick(e);if(hit)show(e,hit);
  if(moved||!hit)return;
  if(hit.central)ui.showPlantList();
  else ui.showPlant(hit.entry);
 });
 canvas.addEventListener('pointercancel',()=>{down=null;hide();});
 canvas.addEventListener('pointerleave',hide);
 label.onpointerenter=stopTimer;label.onpointerleave=hide;
 return {label,update(){
  if(!active)return;
  const c=controller();if(!c||ui.panelName)return hide();
  if(active==='central'){if(Math.hypot(c.root.position.x,c.root.position.z)>=9)hide();return;}
  const entry=arena.adventure.plants.get(active);if(!entry||entry.position.distanceTo(c.root.position)>=5)hide();
 }};
}
