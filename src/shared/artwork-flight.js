// One trajectory for the preview, flight and impact (seconds / world units).
export function artworkPosition(event,t){const speed=10*event.power;return event.origin.map((v,i)=>v+event.direction[i]*speed*t*(i===1?1:5)+(i===1?6*t-4.9*t*t:0));}
export function artworkLanding(event,ground=()=>0){let previous=artworkPosition(event,0);for(let t=.025;t<=12;t+=.025){const p=artworkPosition(event,t),floor=ground(p[0],p[2],previous[1]);if(p[1]<=floor&&p[1]<previous[1]){let lo=t-.025,hi=t;for(let i=0;i<10;i++){const mid=(lo+hi)/2,q=artworkPosition(event,mid);if(q[1]>ground(q[0],q[2],previous[1]))lo=mid;else hi=mid;}const position=artworkPosition(event,hi);position[1]=ground(position[0],position[2],previous[1]);return {time:hi,position};}previous=p;}return {time:12,position:artworkPosition(event,12)};}

// Local throw visuals never jump backwards when a delayed server snapshot
// replaces the optimistic flight. The server remains authoritative for damage.
export function artworkRenderFlight(state,local,now=Date.now()){
 const remote=state?.throwEvent||null;
 if(!local)return {event:remote,local:false,waiting:false};
 const predicted=local.event;
 if(!predicted||state?.holder&&state.holder!==predicted.owner||
    remote?.owner&&remote.owner!==predicted.owner||
    state?.availableAt>0&&now>=state.availableAt||
    !state?.holder&&!remote&&!(state?.availableAt>now))
  return {event:remote,local:false,waiting:false};
 if(now<predicted.time+local.landing.time*1000)
  return {event:predicted,local:true,waiting:false};
 // Hide during the server's respawn delay; never replay the late server arc.
 return {event:null,local:true,waiting:true};
}
