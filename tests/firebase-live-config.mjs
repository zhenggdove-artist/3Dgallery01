// Live, unauthenticated production auth readiness probe. Never log credentials.
const BASE='https://temple-arena.zhenggdove-artist.workers.dev';
const ORIGIN='https://zhenggdove-artist.github.io';
const withOrigin={Origin:ORIGIN};
function requireStatus(response,expected,label){
 if(response.status!==expected)throw Error(label+': HTTP '+response.status);
 const allowed=response.headers.get('access-control-allow-origin');
 if(allowed!==ORIGIN)throw Error(label+': invalid CORS origin '+String(allowed));
}
const configResp=await fetch(BASE+'/api/firebase/config',{
 headers:withOrigin,signal:AbortSignal.timeout(15000),cache:'no-store'
});
requireStatus(configResp,200,'Firebase config');
const config=await configResp.json();
console.log('Firebase enabled:',config.enabled===true);
console.log('Google authDomain configured:',!!config.authDomain);
if(config.enabled!==true||!config.projectId||!config.authDomain||!config.apiKey||!config.appId)
 throw Error('Production Firebase Google auth is disabled or incomplete');
const options=await fetch(BASE+'/api/firebase/profile',{
 method:'OPTIONS',
 headers:{...withOrigin,'Access-Control-Request-Method':'POST',
  'Access-Control-Request-Headers':'authorization,content-type'},
 signal:AbortSignal.timeout(15000)
});
requireStatus(options,204,'Firebase profile preflight');
const allowedHeaders=(options.headers.get('access-control-allow-headers')||'').toLowerCase();
if(!allowedHeaders.includes('authorization'))throw Error('Firebase CORS lacks Authorization header');
const noToken=await fetch(BASE+'/api/firebase/profile',{
 method:'POST',headers:{...withOrigin,'Content-Type':'application/json'},
 body:'{}',signal:AbortSignal.timeout(15000)
});
requireStatus(noToken,401,'Firebase profile authentication guard');
console.log('Firebase readiness, CORS preflight and authenticated profile endpoint: OK');
