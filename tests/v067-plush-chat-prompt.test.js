
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import * as T from 'three';import {animatePlushBear} from '../src/engine/outfit-model.js';
import {createInitialWorld,ensureProfile,applyAction,worldView} from '../src/shared/temple-rules.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('artwork prompt offsets are GM-only and separately persisted',()=>{
 const now=1000000,w=createInitialWorld(now),gm={key:'gm',name:'GM',color:'#ffffff',admin:true,role:'fighter',position:[75,0,0]},p={key:'p',name:'P',color:'#ffffff',role:'fighter',position:[75,0,0]};
 ensureProfile(w,gm.key,gm.name,gm.color,now,true);ensureProfile(w,p.key,p.name,p.color,now,false);
 const action={action:'gm-artwork-prompt-position',device:'mobile',x:.12,gap:.08};
 assert.equal(applyAction(w,p,action,{now}).error,'GM only');assert.ok(!applyAction(w,gm,action,{now}).error);
 assert.ok(!applyAction(w,gm,{...action,device:'desktop',x:-.1},{now}).error);
 assert.ok(applyAction(w,gm,{...action,gap:-1},{now}).error);
 assert.deepEqual(worldView(w,p.key,now).artworkPromptPositions,{mobile:{x:.12,gap:.08},desktop:{x:-.1,gap:.08}});
});
test('tail moves during walking and settles at rest without allocation per frame',()=>{
 const root=new T.Group(),tail=new T.Group(),record={plushMotion:{tail,pos:new T.Vector3(),last:null,energy:0,angle:0}};
 animatePlushBear(record,0,root,.05);for(let i=1;i<20;i++){root.position.x+=.1;animatePlushBear(record,i*.05,root,.05);}
 assert.ok(record.plushMotion.energy>.9);assert.ok(Math.abs(tail.rotation.y)>.01);
 for(let i=20;i<80;i++)animatePlushBear(record,i*.05,root,.05);
 assert.ok(Math.abs(tail.rotation.y)<.001);
});
test('login clears HUD and only the authorized archive exposes retained history',()=>{
 const main=read('src/main.js'),ui=read('src/ui.js'),worker=read('cloudflare/worker.js');
 assert.ok(!main.includes('network.chatHistory()'));assert.ok(ui.includes('this.clearChat();this.gmChatMessages=[]'));
 assert.ok(worker.includes("if(path==='/api/chat'&&request.method==='GET')return withCors(request,json([])"));
 const archive=worker.slice(worker.indexOf('  gmChatArchive(session,url){'),worker.indexOf('  gmPresence(session){'));
 assert.ok(archive.includes("admin!==true")&&archive.includes("403")&&archive.includes('LIMIT 101'));
 assert.ok(!worker.includes("DELETE FROM chat_messages WHERE time<?"));
 assert.ok(ui.includes('data-gm-action="gm-chat-older"'));
});
