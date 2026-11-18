// Firebase ID-token verification for Cloudflare Workers without an Admin SDK.
// Token claims alone are NEVER trusted: verify RS256 against Google's signing
// keys, then check exact Firebase project, issuance, provider and expiration.
// https://firebase.google.com/docs/auth/admin/verify-id-tokens
const CERT_URL='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const decoder=new TextDecoder();
let publicKeyCache={keys:[],expiresAt:0};
function base64url(text){
 if(typeof text!=='string'||text.length>15_000)throw Error('Invalid Firebase token');
 return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')+
  '='.repeat((4-text.length%4)%4)),c=>c.charCodeAt(0));
}
function decodePart(part){
 try{return JSON.parse(decoder.decode(base64url(part)));}
 catch{throw Error('Invalid Firebase JWT payload');}
}
async function googleKeys(){
 if(Date.now()<publicKeyCache.expiresAt&&publicKeyCache.keys.length)return publicKeyCache.keys;
 const response=await fetch(CERT_URL);
 if(!response.ok)throw Error('Firebase public signing keys unavailable');
 const body=await response.json();
 if(!Array.isArray(body.keys)||!body.keys.length)throw Error('Firebase public signing keys missing');
 const cacheHeader=response.headers.get('Cache-Control')||'';
 const maxAge=Number(/(?:^|,)\s*max-age=(\d+)/i.exec(cacheHeader)?.[1]||300);
 publicKeyCache={keys:body.keys,expiresAt:Date.now()+Math.max(30,Math.min(maxAge,3600))*1000};
 return publicKeyCache.keys;
}
export function firebaseWebConfig(env){
 const projectId=String(env.FIREBASE_PROJECT_ID||'').trim(),
  apiKey=String(env.FIREBASE_WEB_API_KEY||'').trim(),
  appId=String(env.FIREBASE_WEB_APP_ID||'').trim();
 const enabled=/^[a-z0-9-]{5,80}$/.test(projectId)&&apiKey.length>10&&appId.length>10;
 return enabled?{enabled:true,projectId,apiKey,appId,
   authDomain:String(env.FIREBASE_AUTH_DOMAIN||projectId+'.firebaseapp.com')}:{enabled:false};
}
export async function verifyFirebaseIdToken(value,env){
 const projectId=String(env.FIREBASE_PROJECT_ID||'').trim();
 if(!/^[a-z0-9-]{5,80}$/.test(projectId))throw Error('Firebase project is not configured');
 if(typeof value!=='string'||value.length>16_000)throw Error('Missing Firebase ID token');
 const parts=value.split('.');
 if(parts.length!==3||parts.some(x=>!x))throw Error('Invalid Firebase JWT');
 const header=decodePart(parts[0]),claims=decodePart(parts[1]),now=Math.floor(Date.now()/1000);
 if(header?.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>160)
  throw Error('Firebase signing algorithm is invalid');
 if(claims?.aud!==projectId||claims.iss!=='https://securetoken.google.com/'+projectId||
  typeof claims.sub!=='string'||claims.sub.length<1||claims.sub.length>128||
  !Number.isInteger(claims.exp)||claims.exp<=now||
  !Number.isInteger(claims.iat)||claims.iat>now+60||claims.iat<now-86400*4||
  !Number.isInteger(claims.auth_time)||claims.auth_time>now+60||
  claims.firebase?.sign_in_provider!=='google.com')
  throw Error('Firebase ID token has invalid project or Google provider claims');
 const keys=await googleKeys(),jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256'));
 if(!jwk)throw Error('Firebase signing key not recognized');
 const key=await crypto.subtle.importKey('jwk',jwk,
  {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const signed=new TextEncoder().encode(parts[0]+'.'+parts[1]);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,base64url(parts[2]),signed))
  throw Error('Firebase ID token signature invalid');
 return {uid:claims.sub,email:typeof claims.email==='string'?claims.email.toLowerCase():'',
  emailVerified:claims.email_verified===true,projectId};
}
export function firebaseProfileKey(account){
 return 'firebase:'+account.projectId+':'+account.uid;
}
export function isFirebaseGm(account,env){
 const uid=String(env.FIREBASE_GM_UID||'').trim();
 return !!uid&&account.uid===uid;
}
