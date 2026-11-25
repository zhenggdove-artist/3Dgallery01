// Reconcile BAG's authored markup without detaching a live image. Attribute
// writes are conditional so an unchanged img.src never restarts decoding.
export function patchBagNode(current,next){
 if(current.isEqualNode(next))return current;
 if(current.nodeType!==next.nodeType||current.nodeName!==next.nodeName||
    current.namespaceURI!==next.namespaceURI||
    (current.nodeName==='IMG'&&(current.getAttribute('src')!==next.getAttribute('src')||
      current.getAttribute('data-preview')!==next.getAttribute('data-preview')))){
  current.replaceWith(next);return next;
 }
 if(current.nodeType!==1){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return current;}
 if(current.nodeName==='CANVAS')return current;
 for(const attr of [...current.attributes])
  if(attr.name!=='data-preview-recovery'&&!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
 for(const attr of [...next.attributes])
  if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
 if(current.nodeName==='IMG')return current;
 const before=[...current.childNodes],after=[...next.childNodes];
 for(let i=0;i<after.length;i++){
  if(before[i])patchBagNode(before[i],after[i]);
  else current.append(after[i]);
 }
 for(let i=after.length;i<before.length;i++)before[i].remove();
 return current;
}

// Stable representative instance UID distinguishes stacked items and copies of
// different qualities. An equip-only update does not move a single grid node.
export function reconcileBagGrid(grid,next){
 const buckets=new Map();
 const key=node=>node.getAttribute('data-bag-key')??(node.hasAttribute('data-wing-canvas')?'canvas-credit':'empty');
 for(const node of [...grid.children]){
  const k=key(node);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(node);
 }
 let cursor=grid.firstElementChild;
 for(const fresh of [...next.children]){
  const previous=buckets.get(key(fresh))?.shift();
  const wasCursor=previous&&previous===cursor;
  const live=previous?patchBagNode(previous,fresh):fresh;
  if(!wasCursor)grid.insertBefore(live,cursor);
  cursor=live.nextElementSibling;
 }
 for(const bucket of buckets.values())for(const node of bucket)node.remove();
}
