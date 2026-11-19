import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CITY_LOTS,CITY_MAX_HP,cityRoofHeight,cityRoofHeightAtHp,cityGroundHeight,cityBlocked} from '../src/shared/city-layout.js';
import {validateState} from '../src/shared/temple-rules.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const lot=CITY_LOTS.find(h=>h.floors>=3);
const intact={};
const ruined={[lot.id]:{hp:0,maxHp:CITY_MAX_HP}};

test('undamaged and each partial-collapse roof remain solid and standable',()=>{
 for(const hp of [CITY_MAX_HP,CITY_MAX_HP*.9,CITY_MAX_HP*.5,CITY_MAX_HP*.2]){
  const roof=cityRoofHeightAtHp(lot,hp),damage={[lot.id]:{hp,maxHp:CITY_MAX_HP}};
  assert.equal(cityGroundHeight(lot.x,lot.z,roof,damage),roof);
  assert.equal(cityBlocked(lot.x,lot.z,roof,damage),false);
  assert.equal(cityBlocked(lot.x,lot.z,roof-1,damage),true);
  assert.equal(cityGroundHeight(lot.x,lot.z,0,damage),0,'no teleporting to roofs from ground');
 }
 assert.equal(cityRoofHeightAtHp(lot,CITY_MAX_HP),lot.height+.13);
});

test('fully destroyed houses retain a lower collision body and walkable roof',()=>{
 const height=cityRoofHeight(lot,3),oldHeight=cityRoofHeight(lot,0);
 assert.ok(height>1&&height<oldHeight);
 assert.equal(cityGroundHeight(lot.x,lot.z,height,ruined),height);
 assert.equal(cityBlocked(lot.x,lot.z,height,ruined),false);
 assert.equal(cityBlocked(lot.x,lot.z,height-1,ruined),true);
 assert.equal(cityGroundHeight(lot.x,lot.z,0,ruined),0);
 assert.equal(cityGroundHeight(lot.x,lot.z,oldHeight,ruined),height);
});

test('server permits walking on roofs but rejects entering the solid wall',()=>{
 const y=cityRoofHeight(lot,0),prev={position:[lot.x+lot.width*1.3,y,lot.z],rotation:0,animation:'idle'};
 const next={position:[lot.x,y,lot.z],rotation:0,animation:'walk'};
 const onTop=validateState(prev,next,3000,'fighter',null,null,3000,{cityDamage:intact,stats:{speed:1}});
 assert.equal(onTop.error,undefined,onTop.error);
 const below=validateState({...prev,position:[prev.position[0],0,prev.position[2]]},
  {...next,position:[lot.x,0,lot.z]},3000,'fighter',null,null,3000,{cityDamage:ruined,stats:{speed:1}});
 assert.equal(below.error,'Building collision');
});

test('client physics uses shared roof-height geometry including late destruction',()=>{
 const arena=source('src/arena-view.js'),player=source('src/player-controller.js');
 const city=source('src/outer-city.js');
 assert.match(arena,/cityGroundHeight\(x,z,y,this\.world\?\.cityDamage/);
 assert.match(arena,/cityBlocked\(x,z,y,this\.world\?\.cityDamage/);
 assert.match(player,/Recheck support every tick/);
 assert.match(city,/cityCollapsePosition\(lot,/);
 const layout=source('src/shared/city-layout.js');
 assert.match(layout,/cityRoofHeightAtHp\(lot,/);
});

test('explicit Google chooser keeps legacy GM/profile join working without auto-login or auth-session migration',()=>{
 const auth=source('src/firebase-login.js'),main=source('src/main.js');
 const ui=source('src/ui.js'),html=source('index.html'),css=source('fidelity-ui.css');
 assert.match(auth,/prompt:'select_account'/);
 assert.match(auth,/await auth\.authStateReady\(\)/);
 assert.doesNotMatch(auth,/setPersistence\(auth/);
 assert.doesNotMatch(auth,/if\(auth\.currentUser\)await module\.signOut\(auth\)/);
 assert.doesNotMatch(main,/existingGoogleToken\(/);
 assert.match(main,/if\(account\.existing&&account\.profile\)/);
 assert.match(main,/name:account\.profile\.name,color:account\.profile\.color/);
 assert.match(main,/firebaseIdToken,backendUrl:network\.base/);
 assert.match(main,/\}else ui\.selectFirebaseAccount\(firebaseIdToken\)/);
 assert.match(html,/id="entry-form" hidden/);
 assert.match(html,/Choose Google Account/);
 assert.doesNotMatch(html.slice(html.indexOf('<main id="entry"'),html.indexOf('<section id="hud"')),/多人線上互動藝術空間/);
 assert.match(html,/僅使用 Google 登入驗證所需的基本帳號資訊/);
 assert.match(css,/#entry #entry-form\[hidden\]\{display:none!important\}/);
 assert.match(ui,/if\(this\.googleLoginBusy\)return/);
 assert.doesNotMatch(ui,/button\.disabled=true; \/\/ Avoid duplicate Google popups/);
});
