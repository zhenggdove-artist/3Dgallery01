// Extracted verbatim from RELETTER index.html; only module boundary added.
import * as THREE from 'three';
let groundClip=null;
const PASTEL_PINK = ['#FFA6C9','#FFB7B2','#E8A0BF','#FFC8DD','#FFAFCC','#DB7093','#F08080'];
const PASTEL_PURPLE = ['#E6A8D7','#DDA0DD','#CDB4DB','#D7C0D0','#C08497'];
const PASTEL_BLUE = ['#B2D8D8','#B5E2FA','#A2D2FF','#BDE0FE'];
const PASTEL_SOFT = ['#F5D6D6','#FDFD96','#EAEAEA','#D3D3D3'];
const ALL_PASTEL = [...PASTEL_PINK,...PASTEL_PURPLE,...PASTEL_BLUE,...PASTEL_SOFT];

// ===== Seeded Random =====
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)}return h>>>0}
function srand(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/0x100000000}}

// ===== L-System Core =====
const PLANT_RULES=[
  {axiom:'X',rules:{X:'F-[[X]+X]+F[+FX]-X',F:'FF'},angle:25,iters:5,step:0.22,width:0.055},
  {axiom:'F',rules:{F:'FF+[+F-F-F]-[-F+F+F]'},angle:22,iters:3,step:0.32,width:0.07},
  {axiom:'F',rules:{F:'F[+&F][-&F][&F]'},angle:25,iters:5,step:0.35,width:0.09},
  {axiom:'F',rules:{F:'F[+F]F[-F]F'},angle:25.7,iters:4,step:0.18,width:0.045},
  {axiom:'F',rules:{F:'FF-[-F+F]+[+F-F]'},angle:22,iters:4,step:0.28,width:0.065},
  {axiom:'X',rules:{X:'F[+X][-X]FX',F:'FF'},angle:28,iters:4,step:0.26,width:0.05},
  {axiom:'F',rules:{F:'F[+F[-F]]F[-F[+F]]'},angle:20,iters:4,step:0.24,width:0.06},
  {axiom:'F',rules:{F:'F[++F][-FF]F[+F][-F]'},angle:18,iters:3,step:0.35,width:0.08},
];

function lsysGen(axiom,rules,iters){
  let s=axiom;
  for(let i=0;i<iters;i++){
    let n='';for(const ch of s)n+=rules[ch]||ch;
    s=n;if(s.length>12000)break;
  }
  return s;
}

function interpretLS(str,cfg,rng){
  const segs=[],leaves=[],flowers=[];
  let pos=new THREE.Vector3(0,0,0);
  // Randomize initial growth direction per plant — not always straight up
  let hd=new THREE.Vector3((rng()-0.5)*0.4,1,(rng()-0.5)*0.4).normalize();
  let lt=new THREE.Vector3();
  if(Math.abs(hd.y)<0.9)lt.crossVectors(hd,new THREE.Vector3(0,1,0)).normalize();
  else lt.crossVectors(hd,new THREE.Vector3(1,0,0)).normalize();
  let up=new THREE.Vector3().crossVectors(lt,hd).normalize();
  let w=cfg.width,d=0,st=cfg.step;
  const stack=[];
  const rad=Math.PI/180;
  const MAX=600;

  for(const ch of str){
    if(segs.length>=MAX)break;
    const av=1+(rng()-0.5)*0.6;
    const a=cfg.angle*rad*av;
    switch(ch){
      case 'F':case 'G':{
        const s0=pos.clone();
        const tmpH=hd.clone();
        // 3D twist every segment
        tmpH.applyAxisAngle(lt,(rng()-0.5)*20*rad);
        tmpH.applyAxisAngle(up,(rng()-0.5)*20*rad);
        const curStep=st*(0.7+rng()*0.6);
        pos=pos.clone().addScaledVector(tmpH,curStep);
        segs.push({start:s0,end:pos.clone(),width:w,depth:d});
        break;
      }
      case '+':case '-':{
        // Yaw + forced random pitch to break planarity
        const sign=ch==='+'?1:-1;
        hd.applyAxisAngle(up,a*sign);lt.applyAxisAngle(up,a*sign);
        const pitchA=(rng()-0.5)*a*0.9;
        hd.applyAxisAngle(lt,pitchA);up.applyAxisAngle(lt,pitchA);
        break;
      }
      case '&':hd.applyAxisAngle(lt,a);up.applyAxisAngle(lt,a);break;
      case '^':hd.applyAxisAngle(lt,-a);up.applyAxisAngle(lt,-a);break;
      case '[':{
        stack.push({pos:pos.clone(),hd:hd.clone(),lt:lt.clone(),up:up.clone(),w,d,st});
        d++;w*=0.55;st*=0.78;
        // MASSIVE 3D randomization at every branch point
        const rollA=(rng()-0.5)*Math.PI; // ±90° roll
        lt.applyAxisAngle(hd,rollA);up.applyAxisAngle(hd,rollA);
        const pitchA=(rng()-0.5)*50*rad; // ±25° pitch
        hd.applyAxisAngle(lt,pitchA);up.applyAxisAngle(lt,pitchA);
        const yawA=(rng()-0.5)*40*rad; // ±20° yaw
        hd.applyAxisAngle(up,yawA);lt.applyAxisAngle(up,yawA);
        break;
      }
      case ']':{
        if(d>0&&rng()>0.2)leaves.push({p:pos.clone(),dir:hd.clone(),left:lt.clone()});
        if(d>1&&rng()>0.5)flowers.push({p:pos.clone(),dir:hd.clone()});
        const sv=stack.pop();
        if(!sv)break;
        pos=sv.pos;hd=sv.hd;lt=sv.lt;up=sv.up;w=sv.w;d=sv.d;st=sv.st;
        break;
      }
    }
  }
  if(segs.length>0)flowers.push({p:segs[segs.length-1].end.clone(),dir:hd.clone()});
  return{segs,leaves,flowers};
}

// ===== Root Generation =====
function genRoots(rng,baseW){
  const segs=[];
  const nR=3+Math.floor(rng()*4);
  for(let r=0;r<nR;r++){
    const ang=(r/nR)*Math.PI*2+rng()*0.5;
    const rLen=0.8+rng()*1.2;
    const nS=5+Math.floor(rng()*4);
    let pos=new THREE.Vector3(0,0,0);
    let dir=new THREE.Vector3(Math.cos(ang)*0.5,-0.85,Math.sin(ang)*0.5).normalize();
    let w=baseW*0.75;
    for(let i=0;i<nS;i++){
      const s=pos.clone();
      pos=pos.clone().addScaledVector(dir,rLen/nS);
      segs.push({start:s,end:pos.clone(),width:w,depth:0});
      w*=0.76;
      dir.x+=(rng()-0.5)*0.2;dir.y-=0.02;dir.z+=(rng()-0.5)*0.2;
      dir.normalize();
    }
    if(rng()>0.5){
      const splitI=Math.floor(segs.length*0.3+rng()*segs.length*0.3);
      const sp=segs[Math.min(splitI,segs.length-1)];
      let sP=sp.end.clone();
      let sD=new THREE.Vector3((rng()-0.5)*0.6,-0.5,(rng()-0.5)*0.6).normalize();
      let sW=sp.width*0.45;
      for(let i=0;i<3;i++){
        const ss=sP.clone();
        sP=sP.clone().addScaledVector(sD,rLen/nS*0.5);
        segs.push({start:ss,end:sP.clone(),width:sW,depth:1});
        sW*=0.7;
      }
    }
  }
  return segs;
}

// ===== Geometry Builder =====
function buildPlantGeo(allSegs,leaves,flowers,stemCol,leafCol,flowerCol,rng,caps=[],bigPetals=[]){
  const pos=[],nrm=[],col=[],idx=[];
  const RN=7; // more vertices for rounder, volumetric tubes

  function tube(start,end,w,cr,cg,cb){
    const dir=new THREE.Vector3().subVectors(end,start);
    if(dir.lengthSq()<0.0001)return;
    dir.normalize();
    const p1=new THREE.Vector3();
    if(Math.abs(dir.y)<0.9)p1.crossVectors(dir,new THREE.Vector3(0,1,0)).normalize();
    else p1.crossVectors(dir,new THREE.Vector3(1,0,0)).normalize();
    const p2=new THREE.Vector3().crossVectors(dir,p1);
    const bi=pos.length/3;
    const ew=w*0.8;
    for(let ring=0;ring<2;ring++){
      const c=ring===0?start:end;
      const r=ring===0?w:ew;
      for(let i=0;i<RN;i++){
        const a=(i/RN)*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);
        pos.push(c.x+(ca*p1.x+sa*p2.x)*r,c.y+(ca*p1.y+sa*p2.y)*r,c.z+(ca*p1.z+sa*p2.z)*r);
        nrm.push(ca*p1.x+sa*p2.x,ca*p1.y+sa*p2.y,ca*p1.z+sa*p2.z);
        col.push(cr,cg,cb);
      }
    }
    for(let i=0;i<RN;i++){
      const a0=bi+i,a1=bi+(i+1)%RN,b0=bi+RN+i,b1=bi+RN+(i+1)%RN;
      idx.push(a0,b0,a1,a1,b0,b1);
    }
  }

  // Stems — per-segment color shift for organic variety
  // ← 植物莖幹亮度：vary 範圍越高越亮（原 0.75~1.25，現 1.05~1.75）
  const sc=new THREE.Color(stemCol);
  for(const s of allSegs){
    const vary=1.05+rng()*0.3;
    const hShift=(rng()-0.5)*0.08;
    const c2=sc.clone().offsetHSL(hShift,0,(rng()-0.5)*0.15);
    tube(s.start,s.end,s.width,c2.r*vary,c2.g*vary,c2.b*vary);
  }

  // Leaves — 5 shape types, each randomly oriented in 3D
  // ← 植物葉片亮度：offsetHSL 第三個參數加 0.15 提亮（越大越亮）
  const lc=new THREE.Color(leafCol);
  for(const lf of leaves){
    const lv=lc.clone().offsetHSL((rng()-0.5)*0.15,0,(rng()-0.5)*0.12+0.01);
    const sz=0.15+rng()*0.35;
    const p=lf.p;
    // Fully random orientation — NOT aligned to branch
    const rAxis=new THREE.Vector3(rng()-0.5,rng()-0.5,rng()-0.5).normalize();
    const rAng=rng()*Math.PI*2;
    const fwd=lf.dir.clone().applyAxisAngle(rAxis,rAng).multiplyScalar(sz);
    const side=lf.left.clone().applyAxisAngle(rAxis,rAng).multiplyScalar(sz);
    const n=new THREE.Vector3().crossVectors(fwd,side).normalize();
    const lt=Math.floor(rng()*5);
    if(lt===0){ // Multi-segment curved frond
      let cp=p.clone();const segs=4+Math.floor(rng()*3),cv=(rng()-0.5)*0.6;
      for(let i=0;i<segs;i++){
        const t=i/segs,t2=(i+1)/segs;
        const w1=Math.sin(t*Math.PI)*sz*0.4,w2=Math.sin(t2*Math.PI)*sz*0.4;
        const bi=pos.length/3;
        const cp2=cp.clone().addScaledVector(fwd,1/segs).addScaledVector(side,cv/segs*Math.sin(t*Math.PI));
        pos.push(cp.x+side.x*w1/sz,cp.y+side.y*w1/sz,cp.z+side.z*w1/sz);
        pos.push(cp.x-side.x*w1/sz,cp.y-side.y*w1/sz,cp.z-side.z*w1/sz);
        pos.push(cp2.x+side.x*w2/sz,cp2.y+side.y*w2/sz,cp2.z+side.z*w2/sz);
        pos.push(cp2.x-side.x*w2/sz,cp2.y-side.y*w2/sz,cp2.z-side.z*w2/sz);
        for(let j=0;j<4;j++){nrm.push(n.x,n.y,n.z);col.push(lv.r,lv.g,lv.b)}
        idx.push(bi,bi+2,bi+1,bi+1,bi+2,bi+3);cp.copy(cp2);
      }
    }else if(lt===1){ // Star spikes
      const nSp=3+Math.floor(rng()*4),bi=pos.length/3;
      pos.push(p.x,p.y,p.z);nrm.push(n.x,n.y,n.z);col.push(lv.r,lv.g,lv.b);
      for(let i=0;i<nSp;i++){
        const a=(i/nSp)*Math.PI*2+rng()*0.5,sL=sz*(0.5+rng()*0.5);
        const dx=Math.cos(a)*fwd.x/sz+Math.sin(a)*side.x/sz;
        const dy=Math.cos(a)*fwd.y/sz+Math.sin(a)*side.y/sz;
        const dz=Math.cos(a)*fwd.z/sz+Math.sin(a)*side.z/sz;
        pos.push(p.x+dx*sL,p.y+dy*sL,p.z+dz*sL);
        nrm.push(n.x,n.y,n.z);col.push(lv.r*0.9,lv.g*0.9,lv.b*0.9);
        if(i<nSp-1)idx.push(bi,bi+1+i,bi+2+i);
        else idx.push(bi,bi+1+i,bi+1);
      }
    }else if(lt===2){ // Round pad fan
      const nSg=6+Math.floor(rng()*4),bi=pos.length/3;
      pos.push(p.x,p.y,p.z);nrm.push(n.x,n.y,n.z);col.push(lv.r,lv.g,lv.b);
      for(let i=0;i<=nSg;i++){
        const a=(i/nSg)*Math.PI*2;
        pos.push(p.x+Math.cos(a)*fwd.x*0.5+Math.sin(a)*side.x*0.5,
                 p.y+Math.cos(a)*fwd.y*0.5+Math.sin(a)*side.y*0.5,
                 p.z+Math.cos(a)*fwd.z*0.5+Math.sin(a)*side.z*0.5);
        nrm.push(n.x,n.y,n.z);col.push(lv.r,lv.g,lv.b);
        if(i>0)idx.push(bi,bi+i,bi+i+1);
      }
    }else if(lt===3){ // Curling tendril
      let cp=p.clone();const tS=5+Math.floor(rng()*3),cR=sz*0.3;
      for(let i=0;i<tS;i++){
        const t=i/tS,a=t*Math.PI*3,r=cR*(1-t*0.5);
        const nx2=new THREE.Vector3(Math.cos(a)*fwd.x/sz+fwd.x*t/sz,
          Math.cos(a)*fwd.y/sz+fwd.y*t/sz+Math.sin(a)*r,
          Math.cos(a)*fwd.z/sz+fwd.z*t/sz).multiplyScalar(sz/tS);
        const nxt=cp.clone().add(nx2);
        const bi=pos.length/3,w2=0.03+0.02*(1-t);
        pos.push(cp.x+n.x*w2,cp.y+n.y*w2,cp.z+n.z*w2);
        pos.push(cp.x-n.x*w2,cp.y-n.y*w2,cp.z-n.z*w2);
        pos.push(nxt.x+n.x*w2,nxt.y+n.y*w2,nxt.z+n.z*w2);
        pos.push(nxt.x-n.x*w2,nxt.y-n.y*w2,nxt.z-n.z*w2);
        for(let j=0;j<4;j++){nrm.push(n.x,n.y,n.z);col.push(lv.r,lv.g,lv.b)}
        idx.push(bi,bi+2,bi+1,bi+1,bi+2,bi+3);cp.copy(nxt);
      }
    }else{ // Wide multi-row tropical
      const rows=3+Math.floor(rng()*3);
      for(let r=0;r<rows;r++){
        const t=r/rows,t2=(r+1)/rows;
        const w1=Math.sin(t*Math.PI)*sz*0.6,w2=Math.sin(t2*Math.PI)*sz*0.6;
        const bi=pos.length/3;
        const c1=p.clone().addScaledVector(fwd,t/rows);
        const c2=p.clone().addScaledVector(fwd,(t+1/rows)/rows);
        pos.push(c1.x-side.x*w1/sz,c1.y-side.y*w1/sz,c1.z-side.z*w1/sz);
        pos.push(c1.x,c1.y+rng()*0.03,c1.z);
        pos.push(c1.x+side.x*w1/sz,c1.y+side.y*w1/sz,c1.z+side.z*w1/sz);
        pos.push(c2.x-side.x*w2/sz,c2.y-side.y*w2/sz,c2.z-side.z*w2/sz);
        pos.push(c2.x,c2.y+rng()*0.03,c2.z);
        pos.push(c2.x+side.x*w2/sz,c2.y+side.y*w2/sz,c2.z+side.z*w2/sz);
        for(let j=0;j<6;j++){nrm.push(n.x,n.y,n.z);col.push(lv.r,lv.g,lv.b)}
        idx.push(bi,bi+3,bi+1,bi+1,bi+3,bi+4,bi+1,bi+4,bi+2,bi+2,bi+4,bi+5);
      }
    }
  }

  // Flowers — 3D shapes (sphere burst, rosette, dandelion)
  // ← 植物花朵亮度：offsetHSL 第三個參數加 0.15 提亮
  const fc=new THREE.Color(flowerCol);
  for(const fl of flowers){
    const fv=fc.clone().offsetHSL((rng()-0.5)*0.2,0,(rng()-0.5)*0.1+0.01);
    const fSz=0.12+rng()*0.25;
    const c=fl.p;
    const nP=5+Math.floor(rng()*6);
    const ft=Math.floor(rng()*3);
    if(ft===0){ // Spherical petal burst
      for(let i=0;i<nP;i++){
        const phi=Math.acos(2*rng()-1),theta=rng()*Math.PI*2;
        const dx=Math.sin(phi)*Math.cos(theta),dy=Math.cos(phi)*0.5+0.5,dz=Math.sin(phi)*Math.sin(theta);
        const bi=pos.length/3;
        const tx=c.x+dx*fSz,ty=c.y+dy*fSz,tz=c.z+dz*fSz;
        const pw=fSz*0.25,px=-dz,pz=dx;
        pos.push(c.x,c.y,c.z);pos.push(tx+px*pw,ty,tz+pz*pw);pos.push(tx-px*pw,ty,tz-pz*pw);
        for(let j=0;j<3;j++){nrm.push(dx,dy,dz);col.push(fv.r,fv.g,fv.b)}
        idx.push(bi,bi+1,bi+2);
      }
    }else if(ft===1){ // Layered rosette
      for(let lay=0;lay<3;lay++){
        const lr=fSz*(0.3+lay*0.25),ly=lay*0.04,ln=4+lay*2;
        for(let i=0;i<ln;i++){
          const a1=(i/ln)*Math.PI*2+lay*0.3,a2=((i+1)/ln)*Math.PI*2+lay*0.3;
          const bi=pos.length/3;
          pos.push(c.x,c.y+ly+0.02,c.z);
          pos.push(c.x+Math.cos(a1)*lr,c.y+ly,c.z+Math.sin(a1)*lr);
          pos.push(c.x+Math.cos(a2)*lr,c.y+ly,c.z+Math.sin(a2)*lr);
          for(let j=0;j<3;j++){nrm.push(0,1,0);col.push(fv.r*(1-lay*0.08),fv.g*(1-lay*0.08),fv.b*(1-lay*0.08))}
          idx.push(bi,bi+1,bi+2);
        }
      }
    }else{ // Dandelion puff spikes
      for(let i=0;i<nP*2;i++){
        const phi=Math.acos(2*rng()-1),theta=rng()*Math.PI*2;
        const dx=Math.sin(phi)*Math.cos(theta),dy=Math.cos(phi),dz=Math.sin(phi)*Math.sin(theta);
        const bi=pos.length/3;
        const sl=fSz*(0.5+rng()*0.5);
        const tx=c.x+dx*sl,ty=c.y+dy*sl,tz=c.z+dz*sl;
        pos.push(c.x,c.y,c.z);pos.push(tx+0.01,ty,tz);pos.push(tx,ty+0.01,tz+0.01);
        for(let j=0;j<3;j++){nrm.push(dx,dy,dz);col.push(fv.r*1.3,fv.g*1.3,fv.b*1.3)}
        idx.push(bi,bi+1,bi+2);
      }
    }
  }

  // Mushroom caps — hemisphere dome
  for(const cap of caps){
    const cc=new THREE.Color(flowerCol);
    const ct=cap.center,cr=cap.radius,ch=cap.height;
    const cRings=8,cSegs=14;
    const capBase=pos.length/3;
    for(let ring=0;ring<=cRings;ring++){
      const t=ring/cRings;
      const ringR=Math.sin(t*Math.PI*0.52)*cr;
      const ringY=ct.y+Math.cos(t*Math.PI*0.52)*ch;
      for(let s=0;s<cSegs;s++){
        const a=(s/cSegs)*Math.PI*2;
        pos.push(ct.x+Math.cos(a)*ringR,ringY,ct.z+Math.sin(a)*ringR);
        const nx=Math.cos(a)*Math.sin(t*Math.PI*0.52),ny=Math.cos(t*Math.PI*0.52),nz=Math.sin(a)*Math.sin(t*Math.PI*0.52);
        nrm.push(nx,ny,nz);
        const cv=cc.clone().offsetHSL((rng()-0.5)*0.06,0,t*0.15-(rng()-0.5)*0.05);
        col.push(cv.r,cv.g,cv.b);
      }
    }
    for(let ring=0;ring<cRings;ring++){
      for(let s=0;s<cSegs;s++){
        const a=capBase+ring*cSegs+s,b=capBase+ring*cSegs+(s+1)%cSegs;
        const c2=capBase+(ring+1)*cSegs+s,d=capBase+(ring+1)*cSegs+(s+1)%cSegs;
        idx.push(a,c2,b,b,c2,d);
      }
    }
    // Underside gills — ring of triangles under cap
    const gillC=cc.clone().offsetHSL(0.05,0,-0.15);
    const gillY=ct.y-ch*0.1;
    const gillBi=pos.length/3;
    pos.push(ct.x,gillY,ct.z);nrm.push(0,-1,0);col.push(gillC.r,gillC.g,gillC.b);
    for(let s=0;s<=cSegs;s++){
      const a=(s/cSegs)*Math.PI*2;
      pos.push(ct.x+Math.cos(a)*cr*0.95,gillY,ct.z+Math.sin(a)*cr*0.95);
      nrm.push(0,-1,0);col.push(gillC.r*0.85,gillC.g*0.85,gillC.b*0.85);
      if(s>0)idx.push(gillBi,gillBi+s,gillBi+s+1);
    }
  }

  // Big flower petals — large curved petals radiating from center
  for(const bp of bigPetals){
    const pc=new THREE.Color(flowerCol);
    const ct=bp.center,sz=bp.size,nP=bp.nPetals;
    for(let i=0;i<nP;i++){
      const a=(i/nP)*Math.PI*2+rng()*0.3;
      const pv=pc.clone().offsetHSL((rng()-0.5)*0.12,0,(rng()-0.5)*0.1);
      // Each petal = 3 quads forming a curved petal
      for(let seg=0;seg<3;seg++){
        const t1=seg/3,t2=(seg+1)/3;
        const r1=sz*0.15+t1*sz*0.85,r2=sz*0.15+t2*sz*0.85;
        const w1=Math.sin(t1*Math.PI)*sz*0.35,w2=Math.sin(t2*Math.PI)*sz*0.35;
        const y1=ct.y+Math.sin(t1*Math.PI*0.6)*sz*0.3,y2=ct.y+Math.sin(t2*Math.PI*0.6)*sz*0.3;
        const bi=pos.length/3;
        const aL=a-0.15,aR=a+0.15;
        pos.push(ct.x+Math.cos(aL)*r1,y1,ct.z+Math.sin(aL)*r1);
        pos.push(ct.x+Math.cos(aR)*r1,y1,ct.z+Math.sin(aR)*r1);
        pos.push(ct.x+Math.cos(aL)*r2,y2,ct.z+Math.sin(aL)*r2);
        pos.push(ct.x+Math.cos(aR)*r2,y2,ct.z+Math.sin(aR)*r2);
        for(let j=0;j<4;j++){nrm.push(0,1,0);col.push(pv.r*(1-seg*0.08),pv.g*(1-seg*0.08),pv.b*(1-seg*0.08))}
        idx.push(bi,bi+2,bi+1,bi+1,bi+2,bi+3);
      }
    }
    // Center pistil sphere
    const pistC=pc.clone().offsetHSL(0.1,0,0.1);
    const pistBi=pos.length/3;
    const pistR=sz*0.12;
    pos.push(ct.x,ct.y+pistR,ct.z);nrm.push(0,1,0);col.push(pistC.r,pistC.g,pistC.b);
    for(let i=0;i<8;i++){
      const a=(i/8)*Math.PI*2;
      pos.push(ct.x+Math.cos(a)*pistR,ct.y+0.01,ct.z+Math.sin(a)*pistR);
      nrm.push(0,1,0);col.push(pistC.r*0.9,pistC.g*0.9,pistC.b*0.9);
      if(i>0)idx.push(pistBi,pistBi+i,pistBi+i+1);
    }
    idx.push(pistBi,pistBi+8,pistBi+1);
  }

  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  geo.setIndex(idx);

  // Sort triangles by Y for growth animation (bottom->top)
  const posArr=geo.getAttribute('position').array;
  const idxArr=Array.from(geo.getIndex().array);
  const tc=idxArr.length/3;
  const tris=[];
  for(let i=0;i<tc;i++){
    const a=idxArr[i*3],b=idxArr[i*3+1],c=idxArr[i*3+2];
    tris.push({a,b,c,y:(posArr[a*3+1]+posArr[b*3+1]+posArr[c*3+1])/3});
  }
  tris.sort((a,b)=>a.y-b.y);
  const sorted=[];
  for(const t of tris)sorted.push(t.a,t.b,t.c);
  geo.setIndex(sorted);

  return geo;
}

// ===== Generate Plant — 8 distinct types =====
function makePlant(text){
  const opts=(arguments.length>1&&arguments[1])?arguments[1]:{};
  const clipBelow=opts.clipBelow!==undefined?opts.clipBelow:true;
  const seed=hash(text);
  const rng=srand(seed);
  let plantType=seed%8;
  // 0-1:tree, 2:fern, 3:mushroom, 4:big flower, 5:vine, 6:coral, 7:cactus

  let segs=[],leaves=[],flowers=[],caps=[],bigPetals=[];
  const stemCol=ALL_PASTEL[Math.floor(rng()*ALL_PASTEL.length)];
  const leafCol=ALL_PASTEL[Math.floor(rng()*ALL_PASTEL.length)];
  const flowerCol=ALL_PASTEL[Math.floor(rng()*ALL_PASTEL.length)];
  let plantH=3; // estimated height for stacking

  if(plantType<=2){ // Tree or Fern (L-System)
    const ri=Math.floor(rng()*PLANT_RULES.length);
    const type=PLANT_RULES[ri];
    const iterVar=Math.max(2,type.iters+Math.floor(rng()*3)-1);
    const modType={
      ...type,
      angle:type.angle*(0.4+rng()*1.2),
      step:type.step*(0.3+rng()*1.4),
      width:type.width*(0.8+rng()*2.0),
      iters:iterVar
    };
    const lStr=lsysGen(modType.axiom,modType.rules,modType.iters);
    const r=interpretLS(lStr,modType,rng);
    segs=[...genRoots(rng,modType.width),...r.segs];leaves=r.leaves;flowers=r.flowers;
    plantH=modType.step*modType.iters*3;
  }else if(plantType===3){ // MUSHROOM — short stalk + dome cap
    const stalkH=0.3+rng()*2.0,stalkW=0.06+rng()*0.25,stalkN=2+Math.floor(rng()*6);
    let cx=0,cy=0,cz=0;
    for(let i=0;i<stalkN;i++){
      const t=i/stalkN;
      const nx=cx+(rng()-0.5)*0.08,ny=cy+stalkH/stalkN,nz=cz+(rng()-0.5)*0.08;
      segs.push({start:new THREE.Vector3(cx,cy,cz),end:new THREE.Vector3(nx,ny,nz),width:stalkW*(1-t*0.15),depth:0});
      cx=nx;cy=ny;cz=nz;
    }
    caps.push({center:new THREE.Vector3(cx,cy,cz),radius:0.15+rng()*0.8,height:0.08+rng()*0.35});
    // Sometimes add extra smaller caps on stalk
    if(rng()>0.5&&segs.length>2){const si=Math.floor(rng()*segs.length);const sp=segs[si].end;caps.push({center:sp.clone().add(new THREE.Vector3(0,0.05,0)),radius:0.1+rng()*0.3,height:0.06+rng()*0.15})}
    segs=[...genRoots(rng,stalkW*0.4),...segs];
    plantH=stalkH+0.3;
  }else if(plantType===4){ // BIG FLOWER — tall stem + huge petals
    const stemH=0.8+rng()*4,stemW=0.03+rng()*0.08,stemN=5+Math.floor(rng()*10);
    let cx=0,cy=0,cz=0;const cv=(rng()-0.5)*0.3;
    for(let i=0;i<stemN;i++){
      const t=i/stemN;
      const nx=cx+Math.sin(t*Math.PI)*cv*0.2,ny=cy+stemH/stemN,nz=cz+Math.cos(t*Math.PI*0.7)*cv*0.2;
      segs.push({start:new THREE.Vector3(cx,cy,cz),end:new THREE.Vector3(nx,ny,nz),width:stemW*(1-t*0.3),depth:0});
      cx=nx;cy=ny;cz=nz;
      if(rng()>0.7)leaves.push({p:new THREE.Vector3(cx,cy,cz),dir:new THREE.Vector3(rng()-0.5,0.5,rng()-0.5).normalize(),left:new THREE.Vector3(rng()-0.5,0,rng()-0.5).normalize()});
    }
    bigPetals.push({center:new THREE.Vector3(cx,cy,cz),size:0.2+rng()*1.2,nPetals:3+Math.floor(rng()*10)});
    segs=[...genRoots(rng,stemW*0.5),...segs];
    plantH=stemH;
  }else if(plantType===5){ // VINE — thin winding
    const type=PLANT_RULES[Math.floor(rng()*PLANT_RULES.length)];
    const iterVar=Math.max(2,type.iters+Math.floor(rng()*2)-1);
    const modType={...type,angle:type.angle*(0.5+rng()*1.0),step:type.step*(0.3+rng()*0.6),width:type.width*(0.3+rng()*0.5),iters:iterVar};
    const lStr=lsysGen(modType.axiom,modType.rules,modType.iters);
    const r=interpretLS(lStr,modType,rng);
    segs=r.segs;leaves=r.leaves;flowers=r.flowers;
    plantH=modType.step*modType.iters*2;
  }else if(plantType===6){ // CORAL — dense branching, no leaves, vivid
    const type=PLANT_RULES[Math.floor(rng()*PLANT_RULES.length)];
    const iterVar=Math.max(2,type.iters+Math.floor(rng()*2));
    const modType={...type,angle:type.angle*(0.6+rng()*1.2),step:type.step*(0.3+rng()*0.8),width:type.width*(1.0+rng()*2.5),iters:iterVar};
    const lStr=lsysGen(modType.axiom,modType.rules,modType.iters);
    const r=interpretLS(lStr,modType,rng);
    segs=r.segs;flowers=r.flowers; // no leaves for coral
    plantH=modType.step*modType.iters*2;
  }else{ // CACTUS — thick segments with spikes
    const bodyH=0.5+rng()*2.5,bodyW=0.1+rng()*0.35,bodyN=3+Math.floor(rng()*6);
    let cx=0,cy=0,cz=0;
    for(let i=0;i<bodyN;i++){
      const t=i/bodyN;
      const nx=cx+(rng()-0.5)*0.05,ny=cy+bodyH/bodyN,nz=cz+(rng()-0.5)*0.05;
      segs.push({start:new THREE.Vector3(cx,cy,cz),end:new THREE.Vector3(nx,ny,nz),width:bodyW*(1-t*0.1),depth:0});
      cx=nx;cy=ny;cz=nz;
    }
    // Arms
    const nArms=1+Math.floor(rng()*3);
    for(let a=0;a<nArms;a++){
      const aIdx=Math.floor((0.3+rng()*0.4)*segs.length);
      const ap=segs[Math.min(aIdx,segs.length-1)].end.clone();
      const aDir=new THREE.Vector3((rng()-0.5)*2,0.5+rng()*0.5,(rng()-0.5)*2).normalize();
      let ax=ap.x,ay=ap.y,az=ap.z;
      for(let i=0;i<3;i++){
        const nx=ax+aDir.x*0.3,ny=ay+aDir.y*0.3,nz=az+aDir.z*0.3;
        segs.push({start:new THREE.Vector3(ax,ay,az),end:new THREE.Vector3(nx,ny,nz),width:bodyW*0.6*(1-i*0.2),depth:1});
        ax=nx;ay=ny;az=nz;
      }
    }
    // Flowers on top
    flowers.push({p:new THREE.Vector3(cx,cy,cz),dir:new THREE.Vector3(0,1,0)});
    segs=[...genRoots(rng,bodyW*0.3),...segs];
    plantH=bodyH;
  }

  const geo=buildPlantGeo(segs,leaves,flowers,stemCol,leafCol,flowerCol,rng,caps,bigPetals);
  const emissiveCol=new THREE.Color(ALL_PASTEL[Math.floor(rng()*ALL_PASTEL.length)]);
  const mat=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:0.6,metalness:0.05,
    // ← 植物自發光強度：越大越亮（原 0.15，現 0.35）
    emissive:emissiveCol,emissiveIntensity:0.35,
    side:THREE.DoubleSide,
    envMapIntensity:0
  });
  if(clipBelow&&groundClip){
    mat.clippingPlanes=[groundClip];
  }
  const mesh=new THREE.Mesh(geo,mat);
  mesh.userData.entryText=text;
  mesh.userData.totalIdx=geo.getIndex().count;
  mesh.userData.plantH=plantH;
  const grp=new THREE.Group();
  grp.rotation.set((rng()-0.5)*0.3,rng()*Math.PI*2,(rng()-0.5)*0.2);
  const sc=0.6+rng()*0.8;
  grp.scale.set(sc,sc,sc);
  grp.add(mesh);
  return grp;
}



export {makePlant};
