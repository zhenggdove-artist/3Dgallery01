// Original RELETTER insect paths and point rendering, with a bounded host population.
import * as THREE from 'three';
export function createPlantInsects(scene){
const BUG_COLORS=['#FDFD96','#FFB7B2','#B5E2FA','#DDA0DD','#FFA6C9','#88ff88'];
const bugGroup=new THREE.Group();
scene.add(bugGroup);
const bugs=[];
let bugMesh=null;

function rebuildBugMesh(){
  // Remove old mesh
  if(bugMesh){bugGroup.remove(bugMesh);bugMesh.geometry.dispose();bugMesh.material.dispose()}
  if(bugs.length===0)return;
  const pts=[],cols=[];
  for(const b of bugs){
    pts.push(0,0,0);
    cols.push(b.color.r,b.color.g,b.color.b);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  const mat=new THREE.PointsMaterial({size:0.08,vertexColors:true,transparent:true,opacity:0.85,depthWrite:false,sizeAttenuation:true});
  bugMesh=new THREE.Points(geo,mat);
  bugGroup.add(bugMesh);
}

function spawnBugsAt(cx,cz,count){
  for(let i=0;i<count;i++){
    const bc=new THREE.Color(BUG_COLORS[Math.floor(Math.random()*BUG_COLORS.length)]);
    bugs.push({
      orbitR:0.5+Math.random()*2,
      orbitSpeed:0.5+Math.random()*1.5,
      orbitPhase:Math.random()*Math.PI*2,
      yPhase:Math.random()*Math.PI*2,
      yAmp:0.3+Math.random()*1,
      yBase:0.5+Math.random()*5,
      cx:cx+(Math.random()-0.5)*1.5,
      cz:cz+(Math.random()-0.5)*1.5,
      type:Math.floor(Math.random()*4),
      color:bc
    });
  }
  rebuildBugMesh();
}

function updateBugs(t){
  if(!bugMesh)return;
  const posArr=bugMesh.geometry.getAttribute('position');
  for(let i=0;i<bugs.length;i++){
    const b=bugs[i];
    let x,y,z;
    const ang=t*b.orbitSpeed+b.orbitPhase;
    if(b.type===0){
      x=b.cx+Math.cos(ang)*b.orbitR;
      z=b.cz+Math.sin(ang)*b.orbitR;
      y=b.yBase+Math.sin(t*1.5+b.yPhase)*b.yAmp;
    }else if(b.type===1){
      x=b.cx+Math.sin(ang)*b.orbitR;
      z=b.cz+Math.sin(ang*2)*b.orbitR*0.5;
      y=b.yBase+Math.cos(t*1.2+b.yPhase)*b.yAmp;
    }else if(b.type===2){
      const sp=((t*0.3+b.orbitPhase)%6)/6;
      x=b.cx+Math.cos(ang)*b.orbitR*(1-sp*0.3);
      z=b.cz+Math.sin(ang)*b.orbitR*(1-sp*0.3);
      y=b.yBase+sp*b.yAmp*2;
    }else{
      x=b.cx+Math.sin(ang)*b.orbitR+Math.sin(t*3.7+b.yPhase)*0.3;
      z=b.cz+Math.cos(ang*0.7)*b.orbitR;
      y=b.yBase+Math.sin(t*2.1+b.yPhase)*b.yAmp+Math.sin(t*4.3)*0.15;
    }
    posArr.setXYZ(i,x,y,z);
  }
  posArr.needsUpdate=true;
}


let signature='';return {update:updateBugs,sync(plants){const selected=plants.slice(-24),key=selected.map(p=>p.id).join('|');if(key===signature)return;signature=key;bugs.length=0;spawnBugsAt(0,0,30);for(const p of selected)spawnBugsAt(p.position[0],p.position[2],6);}};
}
