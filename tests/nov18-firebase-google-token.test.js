import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {verifyFirebaseIdToken,firebaseWebConfig,firebaseProfileKey,isFirebaseGm} from '../cloudflare/firebase-auth.js';

const crypto=globalThis.crypto||webcrypto;
const projectId='ggtemple-test-2026',now=Math.floor(Date.now()/1000);
const config={FIREBASE_PROJECT_ID:projectId,FIREBASE_WEB_API_KEY:'fake-api-key-for-unit-tests',
  FIREBASE_AUTH_DOMAIN:projectId+'.firebaseapp.com',
  FIREBASE_WEB_APP_ID:'1:123456:web:abcdef123456'};
const b64=object=>Buffer.from(JSON.stringify(object)).toString('base64url');

test('Firebase web configuration requires the exact four values and never exposes GM UID',()=>{
 assert.deepEqual(firebaseWebConfig({}),{enabled:false});
 assert.deepEqual(firebaseWebConfig({...config,FIREBASE_AUTH_DOMAIN:''}),{enabled:false});
 assert.deepEqual(firebaseWebConfig({...config,FIREBASE_GM_UID:'secret-gm'}),{
  enabled:true,projectId,authDomain:config.FIREBASE_AUTH_DOMAIN,
  apiKey:config.FIREBASE_WEB_API_KEY,appId:config.FIREBASE_WEB_APP_ID
 });
 const user={projectId,uid:'unique-google-firebase-id'};
 assert.equal(firebaseProfileKey(user),'firebase:'+projectId+':unique-google-firebase-id');
 assert.equal(isFirebaseGm(user,{FIREBASE_GM_UID:user.uid}),true);
 assert.equal(isFirebaseGm(user,{FIREBASE_GM_UID:'someone-else'}),false);
});
test('Worker verifies signed Firebase ID token, Google provider and correct project',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',
  modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'unit-firebase-key',alg:'RS256'};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{
  headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=300'}});
 const payload={
  iss:'https://securetoken.google.com/'+projectId,aud:projectId,
  sub:'firebase-uid-123',exp:now+3600,iat:now,auth_time:now-60,
  email:'example@gmail.com',email_verified:true,
  firebase:{sign_in_provider:'google.com'}
 };
 const mint=async claims=>{
  const signed=b64({alg:'RS256',kid:'unit-firebase-key'})+'.'+b64(claims);
  const sig=await crypto.subtle.sign({name:'RSASSA-PKCS1-v1_5'},pair.privateKey,
   new TextEncoder().encode(signed));
  return signed+'.'+Buffer.from(sig).toString('base64url');
 };
 try{
  const token=await mint(payload),user=await verifyFirebaseIdToken(token,config);
  assert.equal(user.uid,'firebase-uid-123');
  assert.equal(user.email,'example@gmail.com');
  await assert.rejects(()=>verifyFirebaseIdToken(token,{FIREBASE_PROJECT_ID:'wrong-firebase-project'}),/claims/);
  const nonGoogle=await mint({...payload,firebase:{sign_in_provider:'facebook.com'}});
  const expired=await mint({...payload,exp:now-1});
  await assert.rejects(()=>verifyFirebaseIdToken(nonGoogle,config),/provider claims/);
  await assert.rejects(()=>verifyFirebaseIdToken(expired,config),/claims/);
  const segments=token.split('.'),signature=segments[2];
  segments[2]=(signature[0]==='A'?'B':'A')+signature.slice(1);
  await assert.rejects(()=>verifyFirebaseIdToken(segments.join('.'),config),/signature invalid/);
 }finally{globalThis.fetch=originalFetch;}
});
