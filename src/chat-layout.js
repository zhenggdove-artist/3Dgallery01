export function bindChatLayout(){
  const panel=document.getElementById('chat-hud'),handle=document.getElementById('chat-resize'),toggle=document.getElementById('chat-toggle');
  let drag=null,expanded=false;
  const resize=height=>{const h=Math.max(60,Math.min(innerHeight*.5,height));panel.style.setProperty('--chat-height',h+'px');};
  toggle.onclick=()=>{expanded=!expanded;resize(expanded?Math.min(240,innerHeight*.45):68);toggle.textContent=expanded?'−':'＋';toggle.setAttribute('aria-expanded',String(expanded));};
  handle.onpointerdown=e=>{if(e.target.closest('button'))return;e.preventDefault();drag={id:e.pointerId,y:e.clientY,height:panel.getBoundingClientRect().height};handle.setPointerCapture(e.pointerId);};
  handle.onpointermove=e=>{if(drag?.id===e.pointerId)resize(drag.height+drag.y-e.clientY);};
  handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=e=>{if(drag?.id===e.pointerId)drag=null;};
  addEventListener('resize',()=>resize(panel.getBoundingClientRect().height));
}
