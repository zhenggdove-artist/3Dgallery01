// Browser-level regression for the real GGTEMPLE account button, popup
// orchestration and explicit existing/new profile joins. Google Identity is
// mocked only inside this isolated local test; production credentials are
// never accessed or printed.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const FRONT='http://127.0.0.1:8000';
const BASE='http://127.0.0.1:8787';
const cors={
 'Access-Control-Allow-Origin':FRONT,
 'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
 'Access-Control-Allow-Headers':'Authorization, Content-Type'
};
const appModule=`
 export const getApps=()=>[];
 export const getApp=()=>({});
 export const initializeApp=()=>({});
`;
const authModule=`
 const auth={currentUser:null,authStateReady:async()=>{}};
 export const getAuth=()=>auth;
 export class GoogleAuthProvider{
   setCustomParameters(params){window.__ciGooglePrompt=params.prompt;}
 }
 export async function signInWithPopup(instance){
   window.__ciPopupCalls=(window.__ciPopupCalls||0)+1;
   const user={
     providerData:[{providerId:'google.com'}],
     getIdToken:async()=> 'ci-firebase-token'
   };
   instance.currentUser=user;
   return {user};
 }
 export async function signOut(){throw Error('Unexpected forced signOut during sign-in');}
`;

const browser=await chromium.launch({channel:'chrome',headless:true,
 args:['--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--enable-webgl']});
try{
 for(const existing of [true,false]){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  page.setDefaultTimeout(40000);
  const errors=[],joins=[],profiles=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(url=>localStorage.setItem('temple-backend-url',url),BASE);
  await page.route('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js',async route=>
   route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},
    contentType:'text/javascript',body:appModule}));
  await page.route('https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js',async route=>
   route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},
    contentType:'text/javascript',body:authModule}));
  await page.route('**/api/firebase/config',async route=>{
   const preflight=route.request().method()==='OPTIONS';
   await route.fulfill({status:preflight?204:200,headers:cors,
    contentType:preflight?'text/plain':'application/json',
    body:preflight?'':JSON.stringify({enabled:true,projectId:'test-firebase',
     authDomain:'test-firebase.firebaseapp.com',apiKey:'ci-public-key',
     appId:'ci-firebase-app'})});
  });
  await page.route('**/api/firebase/profile',async route=>{
   if(route.request().method()==='OPTIONS'){
    await route.fulfill({status:204,headers:cors,body:''});return;
   }
   profiles.push(route.request().headers()['authorization']);
   await route.fulfill({status:200,headers:cors,contentType:'application/json',
    body:JSON.stringify({existing,profile:existing?{name:'ExistingGMProfile',color:'#b58bb5'}:null})});
  });
  page.on('request',req=>{
   if(req.url().endsWith('/api/join')&&req.method()==='POST')
    joins.push({headers:req.headers(),body:JSON.parse(req.postData())});
  });
  await page.goto(FRONT,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('ready'),null,{timeout:70000});
  await page.locator('[data-google-login]').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('[data-google-login]')?.disabled,null,{timeout:20000});
  assert.equal(await page.locator('#entry').isVisible(),true,'no automatic entry before choosing Google account');
  assert.equal(joins.length,0,'cached Firebase state must not silently send /api/join');
  await page.locator('[data-google-login]').click();
  await page.waitForFunction(()=>window.__ciPopupCalls===1,{},{timeout:10000});
  assert.equal(await page.evaluate(()=>window.__ciGooglePrompt),'select_account');
  if(existing){
   await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).mode==='play',
    null,{timeout:30000});
   assert.equal(joins.length,1,'existing GM/player must join after explicit Google selection');
   assert.equal(joins[0].body.name,'ExistingGMProfile');
   assert.equal(joins[0].body.color,'#b58bb5');
   await page.evaluate(()=>{
    const ui=templeTest.ui;
    ui.setSelf({...ui.self,profile:{...ui.self.profile,admin:true}});
    ui.setPlayers([{key:'test-recipient',name:'Gift recipient',profile:{level:7},role:'fighter'}]);
    window.__gmUiActions=[];
    ui.addEventListener('server-action',e=>window.__gmUiActions.push(e.detail));
   });
   await page.locator('#gm-menu').click();
   const controls=page.locator('.gm-player-controls');
   await controls.waitFor({state:'visible'});
   assert.equal(await page.locator('#panel-content').evaluate(el=>el.scrollTop),0);
   for(const action of ['self-level','player-level','player-canvas']){
    const button=controls.locator('[data-gm-action="'+action+'"]');
    assert.ok(await button.isVisible(),action+' must be visible inside S');
    const rect=await button.boundingBox();
    assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=844,action+' must fit the mobile viewport');
   }
   await page.screenshot({path:'output-gm-player-controls.png'});
   await page.evaluate(()=>templeTest.ui.closePanel());
  }else{
   await page.locator('#entry-form').waitFor({state:'visible'});
   assert.equal(await page.locator('#guest-form').isVisible(),false,
    'Guest sign-in must disappear after verifying a new Google identity');
   assert.equal(await page.locator('#guest-enter').isEnabled(),false,
    'A stale guest form cannot downgrade a verified Google login');
   assert.equal(joins.length,0,'new profile must wait for explicit name and submit');
   await page.locator('#player-name').fill('NewGoogleCharacter');
   await page.locator('#entry-form').evaluate(form=>form.requestSubmit());
   await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).mode==='play',
    null,{timeout:30000});
   assert.equal(joins.length,1);
   assert.equal(joins[0].body.name,'NewGoogleCharacter');
  }
  assert.equal(profiles.length,1,'Google token must be verified by profile endpoint exactly once');
  assert.equal(profiles[0],'Bearer ci-firebase-token');
  assert.equal(joins[0].headers.authorization,'Bearer ci-firebase-token');
  assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
  console.log(existing?'Existing Google account selected, profile restored, game joined':
    'New Google account selected, new character created, game joined');
  await page.close();
 }
} finally {await browser.close();}
