// Secure backend OAuth 2 authorization-code flows for GitHub Pages + Worker.
// All provider secrets stay in Worker env. No client-supplied identity is trusted.
const enc=new TextEncoder(),MAX_FLOW_AGE=10*60*1000;
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const fromB64url=text=>Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-text.length%4)%4)),c=>c.charCodeAt(0));
const jwtSegment=obj=>b64url(enc.encode(JSON.stringify(obj)));
const sha256=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)));
const safeOrigin=value=>{
 try{const u=new URL(value);return u.origin===value&&['https:','http:'].includes(u.protocol)?value:null;}
 catch{return null;}
};
export function initOAuth(sql){
 sql.exec(`CREATE TABLE IF NOT EXISTS oauth_flows(
  state TEXT PRIMARY KEY,provider TEXT NOT NULL, origin TEXT NOT NULL,
  verifier TEXT NOT NULL,nonce TEXT NOT NULL,expires INTEGER NOT NULL);`);
 sql.exec(`CREATE TABLE IF NOT EXISTS oauth_tickets(
  ticket TEXT PRIMARY KEY,profile_key TEXT NOT NULL,expires INTEGER NOT NULL);`);
}
function config(env,provider){
 if(!env.TEMPLE_OAUTH_PEPPER)return null;
 if(provider==='google'&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET)
  return {id:env.GOOGLE_CLIENT_ID,secret:env.GOOGLE_CLIENT_SECRET,auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token'};
 if(provider==='apple'&&env.APPLE_SERVICES_ID&&env.APPLE_TEAM_ID&&env.APPLE_KEY_ID&&env.APPLE_PRIVATE_KEY)
  return {id:env.APPLE_SERVICES_ID,auth:'https://appleid.apple.com/auth/authorize',token:'https://appleid.apple.com/auth/token'};
 if(provider==='facebook'&&env.FACEBOOK_APP_ID&&env.FACEBOOK_APP_SECRET)
  return {id:env.FACEBOOK_APP_ID,secret:env.FACEBOOK_APP_SECRET,auth:'https://www.facebook.com/v27.0/dialog/oauth',token:'https://graph.facebook.com/v27.0/oauth/access_token'};
 return null;
}
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function appleSecret(env){
 const h={alg:'ES256',kid:env.APPLE_KEY_ID,typ:'JWT'},now=Math.floor(Date.now()/1000);
 const body={iss:env.APPLE_TEAM_ID,iat:now,exp:now+300,aud:'https://appleid.apple.com',sub:env.APPLE_SERVICES_ID};
 const signing=jwtSegment(h)+'.'+jwtSegment(body);
 const der=Uint8Array.from(atob(String(env.APPLE_PRIVATE_KEY).replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),v=>v.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',der,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 return signing+'.'+b64url(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(signing))));
}
async function verifyIdToken(token,provider,clientId,nonce){
 if(typeof token!=='string'||token.length>12000)throw Error('Missing identity token');
 const segments=token.split('.');if(segments.length!==3)throw Error('Malformed identity token');
 const header=JSON.parse(new TextDecoder().decode(fromB64url(segments[0])));
 const payload=JSON.parse(new TextDecoder().decode(fromB64url(segments[1])));
 const now=Math.floor(Date.now()/1000);
 const issuer=provider==='apple'?'https://appleid.apple.com':'https://accounts.google.com';
 if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>180)
  throw Error('Unexpected identity token algorithm');
 if(![issuer,provider==='google'?'accounts.google.com':issuer].includes(payload.iss)||
   payload.aud!==clientId||!Number.isFinite(payload.exp)||payload.exp<=now||
   !Number.isFinite(payload.iat)||payload.iat>now+120||!payload.sub||payload.nonce!==nonce)
  throw Error('Invalid identity token claims');
 const endpoint=provider==='apple'?'https://appleid.apple.com/auth/keys':'https://www.googleapis.com/oauth2/v3/certs';
 const res=await fetch(endpoint);if(!res.ok)throw Error('Identity verification service unavailable');
 const keyData=(await res.json()).keys?.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use==='sig');
 if(!keyData)throw Error('Unknown identity signing key');
 const key=await crypto.subtle.importKey('jwk',keyData,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,fromB64url(segments[2]),enc.encode(segments[0]+'.'+segments[1]));
 if(!valid)throw Error('Invalid identity token signature');
 return String(payload.sub);
}
async function exchangeCode(provider,code,flow,env,redirect){
 const cfg=config(env,provider);
 if(!cfg)throw Error('Provider unavailable');
 const params=new URLSearchParams({
  grant_type:'authorization_code',code,client_id:cfg.id,redirect_uri:redirect
 });
 if(provider==='apple')params.set('client_secret',await appleSecret(env));
 else params.set('client_secret',cfg.secret);
 if(provider==='google')params.set('code_verifier',flow.verifier);
 const response=await fetch(cfg.token,{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:params.toString()
 });
 const body=await response.json();
 if(!response.ok)throw Error('Provider code exchange failed');
 if(provider!=='facebook')return await verifyIdToken(body.id_token,provider,cfg.id,flow.nonce);
 if(!body.access_token)throw Error('Facebook token missing');
 const info=new URL('https://graph.facebook.com/v27.0/me');
 info.searchParams.set('fields','id');info.searchParams.set('access_token',body.access_token);
 const user=await fetch(info);
 if(!user.ok)throw Error('Facebook identity lookup failed');
 const account=await user.json();
 // App-bound token verification prevents cross-application token substitution.
 const debug=new URL('https://graph.facebook.com/v27.0/debug_token');
 debug.searchParams.set('input_token',body.access_token);
 debug.searchParams.set('access_token',cfg.id+'|'+cfg.secret);
 const verified=await fetch(debug);
 if(!verified.ok)throw Error('Facebook token validation failed');
 const validation=(await verified.json()).data;
 if(!account.id||!validation?.is_valid||String(validation.app_id)!==String(cfg.id)||
  String(validation.user_id)!==String(account.id))throw Error('Facebook token was not issued for this app');
 return String(account.id);
}
export async function oauthStart(request,env,sql,allowOrigin){
 const url=new URL(request.url),provider=url.searchParams.get('provider'),origin=safeOrigin(url.searchParams.get('origin'));
 if(!origin||!allowOrigin(new Request('https://temple.invalid',{headers:{Origin:origin}}),env))
  return json({error:'Unauthorized return origin'},403);
 const cfg=config(env,provider);if(!cfg)return json({error:'OAuth provider is not configured'},503);
 const state=crypto.randomUUID(),verifier=b64url(crypto.getRandomValues(new Uint8Array(32))),nonce=crypto.randomUUID();
 sql.exec('DELETE FROM oauth_flows WHERE expires<?',Date.now());
 sql.exec('INSERT INTO oauth_flows VALUES(?,?,?,?,?,?)',state,provider,origin,verifier,nonce,Date.now()+MAX_FLOW_AGE);
 const redirect=url.origin+'/api/oauth/callback',args=new URL(cfg.auth);
 args.searchParams.set('client_id',cfg.id);args.searchParams.set('redirect_uri',redirect);
 args.searchParams.set('response_type','code');args.searchParams.set('state',state);
 if(provider==='google'){
  args.searchParams.set('scope','openid profile');args.searchParams.set('nonce',nonce);
  args.searchParams.set('code_challenge',b64url(await sha256(verifier)));
  args.searchParams.set('code_challenge_method','S256');args.searchParams.set('prompt','select_account');
 }else if(provider==='apple'){
  args.searchParams.set('scope','name email');args.searchParams.set('nonce',nonce);
  args.searchParams.set('response_mode','form_post');
 }else args.searchParams.set('scope','public_profile');
 return Response.redirect(args.toString(),302);
}
function popupResult(origin,ticket,error){
 const nonce=crypto.randomUUID().replaceAll('-','');
 const value=JSON.stringify({source:'ggtemple-oauth',ticket,error});
 const html='<!doctype html><meta charset="utf-8"><title>GGTEMPLE Login</title>'+
 '<body style="font:16px system-ui;background:#15131e;color:#fff;text-align:center;padding:3rem">'+
 '<p>登入已完成。視窗將自動關閉。</p><script nonce="'+nonce+'">'+
 'if(window.opener){window.opener.postMessage('+value+','+JSON.stringify(origin)+');window.close();}'+
 '</script></body>';
 return new Response(html,{status:200,headers:{
  'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
  'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'"
 }});
}
export async function oauthCallback(request,env,sql){
 const url=new URL(request.url);
 const form=request.method==='POST'?new URLSearchParams(await request.text()):url.searchParams;
 const state=String(form.get('state')||''),flow=sql.exec('SELECT * FROM oauth_flows WHERE state=? AND expires>?',state,Date.now()).toArray()[0];
 if(!flow)return json({error:'Login expired or already completed'},400);
 // A callback may be retried; consume the state BEFORE performing external I/O.
 sql.exec('DELETE FROM oauth_flows WHERE state=?',state);
 try{
  if(form.get('error'))throw Error('Login was declined');
  const code=String(form.get('code')||'');
  if(!code||code.length>3000)throw Error('Invalid authorization code');
  const subject=await exchangeCode(flow.provider,code,flow,env,url.origin+'/api/oauth/callback');
  const hashed=await sha256(flow.provider+':'+subject+':'+env.TEMPLE_OAUTH_PEPPER);
  const profileKey='oauth:'+flow.provider+':'+Array.from(hashed).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,40);
  const ticket=crypto.randomUUID();
  sql.exec('DELETE FROM oauth_tickets WHERE expires<?',Date.now());
  sql.exec('INSERT INTO oauth_tickets VALUES(?,?,?)',ticket,profileKey,Date.now()+MAX_FLOW_AGE);
  return popupResult(flow.origin,ticket,null);
 }catch(e){console.error('Temple OAuth callback:',String(e?.message||e));return popupResult(flow.origin,null,'Provider authentication failed');}
}
export function oauthTicket(sql,ticket,consume=false){
 if(typeof ticket!=='string'||!/^[0-9a-f-]{36}$/i.test(ticket))return null;
 const row=sql.exec('SELECT profile_key FROM oauth_tickets WHERE ticket=? AND expires>?',ticket,Date.now()).toArray()[0];
 if(consume&&row)sql.exec('DELETE FROM oauth_tickets WHERE ticket=?',ticket);
 return row||null;
}
export const oauthSettings=env=>({
 google:!!config(env,'google'),apple:!!config(env,'apple'),
 facebook:!!config(env,'facebook')
});
