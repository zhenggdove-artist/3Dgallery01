export const WRITE_HEIGHT=201.5;
const ease=t=>t*t*(3-2*t),clamp=t=>Math.max(0,Math.min(1,t));
export function journeyPose(j,now){
 if(!j||now>j.expires)return null;
 if(!j.drinkAt){const t=clamp((now-j.start)/3000),k=ease(t);return {position:[j.origin[0]*(1-k),j.origin[1]+(WRITE_HEIGHT-j.origin[1])*k,j.origin[2]*(1-k)],animation:'idle',phase:t<1?'ascend':'write'};}
 const elapsed=(now-j.drinkAt)/1000;
 if(elapsed<j.drinkDuration)return {position:[0,WRITE_HEIGHT,0],animation:'drink',phase:'drink'};
 const walk=(elapsed-j.drinkDuration)/.6;if(walk<1)return {position:[0,WRITE_HEIGHT,-3*ease(clamp(walk))],animation:'walk',phase:'walk'};
 const fall=clamp((elapsed-j.drinkDuration-.6)/3),k=fall*fall;return {position:[j.landing[0]*k,WRITE_HEIGHT*(1-k),-3+(j.landing[2]+3)*k],animation:fall<.4/3?'jump':'fall',phase:fall<1?'fall':'land'};
}
export function journeyAction(world,profile,actor,body,now){
 if(body.action==='write-begin'){if(profile.writeJourney&&journeyPose(profile.writeJourney,now)?.phase!=='land')return {error:'Writing already in progress'};profile.writeJourney={origin:[...actor.position],start:now,expires:now+900000};return {journey:profile.writeJourney};}
 const j=profile.writeJourney;if(!j||now>j.expires)return {error:'Start WRITE first'};
 if(body.action==='write-drink'){if(now<j.start+2900||j.drinkAt)return {error:'Wait until the platform arrives'};j.drinkAt=now;j.drinkDuration=Math.max(.2,Math.min(8,Number(body.duration)||2));const angle=(now%6283)/1000;j.landing=[Math.cos(angle)*3,0,Math.sin(angle)*3];return {journey:j};}
 if(body.action==='write-finish'){if(journeyPose(j,now)?.phase!=='land')return {error:'Wait until landing'};profile.writeJourney=null;return {ok:true};}
 if(body.action==='write-cancel'){j.drinkAt=now;j.drinkDuration=0;j.cancelled=true;j.landing=[0,0,0];return {journey:j};}
 return {error:'Unknown writing action'};
}
