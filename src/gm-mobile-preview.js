// GM-only local viewport. Keep one live world, renderer and input session.
let active=false,view=null,mediaRules=[],unitRules=[],chrome=null,style=null;
export const gmMobilePreviewActive=()=>active;
export const viewWidth=()=>active?view.width:globalThis.innerWidth;
export const viewHeight=()=>active?view.height:globalThis.innerHeight;
export const viewVisualViewport=(host=window)=>active&&host===window?view:host.visualViewport;
// The simulated viewport's layout coordinates remain local to the body.
// Only browser-client coordinates include the centered frame's translation.
export const viewClientLeft=()=>active?view.clientLeft:0;
export const viewClientTop=()=>active?view.clientTop:0;
export function previewLocalRect(rect,left=viewClientLeft(),top=viewClientTop()){
 if(!rect||(!left&&!top))return rect;
 return {left:rect.left-left,right:rect.right-left,top:rect.top-top,bottom:rect.bottom-top,
  width:rect.width,height:rect.height};
}

// Exact portrait 9:16 (width:height), with an exit control below.
export function gmPreviewDimensions(width,height){
 const step=Math.max(1,Math.min(50,Math.floor(width/9),Math.floor((height-48)/16)));
 const w=9*step,h=16*step;
 // Center the frame and its reserved 48px exit strip together.
 return {width:w,height:h,offsetLeft:0,offsetTop:0,clientLeft:Math.max(0,(width-w)/2),clientTop:Math.max(0,(height-h-48)/2)};
}
const viewportFeature=/\(\s*(?:(?:min-|max-)?(?:width|height)|(?:any-)?pointer|orientation)\s*:/i;
export function gmPreviewMediaMatches(query,width,height,nativeMatch=q=>matchMedia(q).matches){
 return query.split(',').some(branch=>branch.trim().split(/\s+and\s+/i).every(part=>{
  const p=part.trim(),size=p.match(/^\(\s*(min-|max-)?(width|height)\s*:\s*([\d.]+)px\s*\)$/i);
  if(size){const actual=size[2].toLowerCase()==='width'?width:height,threshold=Number(size[3]);return size[1]?.toLowerCase()==='min-'?actual>=threshold:size[1]?.toLowerCase()==='max-'?actual<=threshold:actual===threshold;}
  const pointer=p.match(/^\(\s*(?:any-)?pointer\s*:\s*(coarse|fine|none)\s*\)$/i);
  if(pointer)return pointer[1].toLowerCase()==='coarse';
  const orientation=p.match(/^\(\s*orientation\s*:\s*(landscape|portrait)\s*\)$/i);
  if(orientation)return orientation[1].toLowerCase()===(width>height?'landscape':'portrait');
  return nativeMatch(p);
 }));
}
const viewportUnit=/(-?(?:\d+(?:\.\d*)?|\.\d+))((?:[dls]?v[wh])|vmin|vmax)\b/gi;
export function gmPreviewUnits(value,width,height){
 return value.replace(viewportUnit,(_,number,unit)=>{
  const u=unit.toLowerCase(),axis=u==='vmin'?Math.min(width,height):u==='vmax'?Math.max(width,height):u.endsWith('w')?width:height;
  return (Number(number)*axis/100)+'px';
 });
}
function collectRules(){
 const seen=new Set();
 function walk(rules){
  for(const rule of rules){
   if(rule.media&&viewportFeature.test(rule.media.mediaText))mediaRules.push({media:rule.media,original:rule.media.mediaText});
   if(rule.style){for(const name of Array.from(rule.style)){
    const original=rule.style.getPropertyValue(name);
    if(gmPreviewUnits(original,100,100)!==original)unitRules.push({decl:rule.style,name,original,priority:rule.style.getPropertyPriority(name)});
   }}
   if(rule.cssRules)walk(rule.cssRules);
   if(rule.styleSheet)sheet(rule.styleSheet);
  }
 }
 function sheet(s){if(seen.has(s))return;seen.add(s);let rules;try{rules=s.cssRules;}catch{return;}if(rules)walk(rules);}
 for(const s of document.styleSheets)sheet(s);
}
function resizePreview(){
 if(!active)return;
 if(window.innerWidth<9||window.innerHeight<64){setGmMobilePreview(false);return;}
 const next=gmPreviewDimensions(window.innerWidth,window.innerHeight);
 if(view&&view.width===next.width&&view.height===next.height&&view.clientLeft===next.clientLeft&&view.clientTop===next.clientTop)return;
 view=next;
 const {width,height,clientLeft,clientTop}=view;
 // Use existing mobile CSS, in its original cascade order, rather than copy HUD styles.
 for(const entry of mediaRules)entry.media.mediaText=gmPreviewMediaMatches(entry.original,width,height)?'all':'not all';
 for(const {decl,name,original,priority} of unitRules)decl.setProperty(name,gmPreviewUnits(original,width,height),priority);
 style.textContent='html.gm-mobile-preview-root{background:#101010!important}html.gm-mobile-preview-root body{position:relative!important;margin:0!important;left:'+clientLeft+'px!important;top:'+clientTop+'px!important;width:'+width+'px!important;height:'+height+'px!important;transform:translate(0,0)!important;clip-path:inset(0)!important;overflow:hidden!important}#gm-mobile-preview-exit{position:fixed!important;left:'+(clientLeft+width/2)+'px!important;top:'+(clientTop+height+8)+'px!important;transform:translateX(-50%)!important;white-space:nowrap!important;z-index:2147483647!important;padding:6px 12px!important;min-height:32px!important;color:#111!important;background:#ece9e1!important;border:1px solid #777!important;font:13px/1.3 system-ui!important;cursor:pointer!important;touch-action:manipulation!important}';
 chrome.textContent='9:16 · '+width+' × '+height+' · 結束手機預覽';
}
function restore(){
 window.removeEventListener('resize',resizePreview,true);
 for(const {media,original} of mediaRules)media.mediaText=original;
 for(const {decl,name,original,priority} of unitRules)decl.setProperty(name,original,priority);
 mediaRules=[];unitRules=[];view=null;active=false;
 document.documentElement.classList.remove('gm-mobile-preview-root');
 chrome?.remove();style?.remove();chrome=null;style=null;
}
export function setGmMobilePreview(enabled){
 if(!!enabled===active)return;
 if(!enabled){restore();window.dispatchEvent(new Event('resize'));return;}
 if(window.innerWidth<9||window.innerHeight<64)throw Error('Viewport too small for mobile preview');
 try{
  collectRules();
  style=document.createElement('style');document.head.append(style);
  chrome=document.createElement('button');chrome.id='gm-mobile-preview-exit';chrome.type='button';
  chrome.addEventListener('click',()=>setGmMobilePreview(false));
  // Outside the clipped body: exit remains reachable even when a panel is open.
  document.documentElement.append(chrome);
  active=true;resizePreview();document.documentElement.classList.add('gm-mobile-preview-root');
  window.addEventListener('resize',resizePreview,true);
 }catch(error){restore();throw error;}
 window.dispatchEvent(new Event('resize'));
}
