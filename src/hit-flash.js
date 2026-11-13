// Shared materials must be captured only once, before any mesh is tinted.
export function updateHitFlash(root, now) {
  const d=root.userData;
  for(const [material,color] of d.hitColors||[])material.color.copy(color);
  d.hitColors=new Map();
  if(now>=(d.hitFlashUntil||0))return;
  root.traverse(object=>{
    for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){
      if(!material.color||d.hitColors.has(material)||object===d.ring||object===d.label||object.parent===d.healthBar)continue;
      d.hitColors.set(material,material.color.clone());
      material.color.set('#ff182d');
    }
  });
}
