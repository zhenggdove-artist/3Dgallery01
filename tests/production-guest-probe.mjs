// Read-only production compatibility probe. Sends malformed data, never
// creates a profile, logs no credentials and never assumes a cached client.
const base='https://temple-arena.zhenggdove-artist.workers.dev';
const headers={Origin:'https://zhenggdove-artist.github.io','Content-Type':'application/json'};
for(const [path,init] of [
 ['/health',{method:'GET'}],
 ['/api/join',{method:'POST',headers,body:JSON.stringify({mode:'guest',name:'',color:'#43b59a'})}]
]){
 const response=await fetch(base+path,{...init,signal:AbortSignal.timeout(15000),cache:'no-store'});
 const value=await response.json().catch(()=>({error:'Non-JSON response'}));
 console.log(path+' status='+response.status+
  ' apiVersion='+(value.apiVersion??'-')+
  ' guestLogin='+(value.features?.guestLogin??'-')+
  ' error='+String(value.error||'').slice(0,140));
 if(path==='/api/join'){
  if(response.status===401&&/Firebase|Google/i.test(String(value.error)))
   console.log('GUEST_BACKEND_MISMATCH: production is still running Google-only join handler');
  else if(response.status===400&&/name|名稱|角色/i.test(String(value.error)))
   console.log('GUEST_BACKEND_OK: production recognized guest mode and rejected empty name');
  else console.log('GUEST_BACKEND_UNEXPECTED_RESPONSE');
 }
}
