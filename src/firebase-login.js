// Firebase Authentication, Google-only. No Firebase Admin credentials in the browser.
// The public project configuration is returned by the existing Cloudflare Worker.
// Lazy CDN loading keeps the game/WebGL bootstrap independent of external Auth.
const CDN='https://www.gstatic.com/firebasejs/13.3.0/';
let pending=null,auth=null,authModule=null;
const completeConfig=cfg=>!!(cfg?.apiKey&&cfg?.appId&&cfg?.projectId&&cfg?.authDomain);

export function firebaseConfigured(config){return completeConfig(config);}
export async function prepareFirebase(config){
 if(!completeConfig(config))throw Error('Firebase 專案尚未設定完成');
 if(pending)return pending;
 pending=(async()=>{
  const [{initializeApp,getApps,getApp},module]=await Promise.all([
   import(CDN+'firebase-app.js'),import(CDN+'firebase-auth.js')
  ]);
  const app=getApps().length?getApp():initializeApp({
   apiKey:config.apiKey,authDomain:config.authDomain,
   projectId:config.projectId,appId:config.appId
  });
  auth=module.getAuth(app);
  authModule=module;
  await auth.authStateReady();
  return auth;
 })().catch(error=>{pending=null;throw error;});
 return pending;
}
export async function existingGoogleToken(){
 if(!pending)return null;
 await pending;
 const user=auth?.currentUser;
 // Automatic reuse only for verified Google identities (not Firebase anonymous,
 // email/password or a different provider).
 if(!user||!user.providerData.some(p=>p.providerId==='google.com'))return null;
 return user.getIdToken();
}
export async function signInWithGoogle(){
 // prepareFirebase must finish before a click is offered so popup open keeps
 // the caller's direct user-gesture authorization on mobile Safari.
 if(!auth||!authModule)throw Error('Firebase 登入模組尚未準備完成');
 const provider=new authModule.GoogleAuthProvider();
 provider.setCustomParameters({prompt:'select_account'});
 const result=await authModule.signInWithPopup(auth,provider);
 if(!result.user.providerData.some(p=>p.providerId==='google.com'))
  throw Error('只能使用 Google 帳號登入');
 return result.user.getIdToken();
}
export async function signOutGoogle(){
 if(auth&&authModule)await authModule.signOut(auth);
}
