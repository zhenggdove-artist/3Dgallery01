// The network and controller own world translation. The imported walk/run
// Hips tracks have authored forward travel as well as the gait itself.
// Remove only the non-looping drift; keep the residual sway, bounce and pose.
export function inPlaceLocomotion(clip){
 if(clip.name!=='walk'&&clip.name!=='run')return clip;
 const source=clip.tracks.find(t=>/hips\.position$/i.test(t.name));
 if(!source||source.times.length<2||source.getValueSize()!==3)return clip;
 const first=source.times[0],last=source.times.at(-1),values=source.values;
 if(!(last>first))return clip;
 const delta=[0,1,2].map(i=>values[values.length-3+i]-values[i]);
 if(Math.hypot(...delta)<.001)return clip;
 const result=clip.clone(),out=result.tracks.find(t=>t.name===source.name).values;
 for(let i=1;i<source.times.length;i++){
  const t=(source.times[i]-first)/(last-first);
  for(let j=0;j<3;j++)out[i*3+j]=values[i*3+j]-t*delta[j];
 }
 return result;
}
