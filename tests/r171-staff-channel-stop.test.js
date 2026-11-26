import test from 'node:test';
import assert from 'node:assert/strict';
import {requestStaffChannelStop} from '../src/network.js';

test('release after an acknowledged start sends one authoritative stop',async()=>{
 let requests=0;
 await requestStaffChannelStop(true,Promise.resolve({channeling:true}),()=>{requests++;});
 assert.equal(requests,1);
});

test('a start still on the wire can require a second stop after the acknowledgement',async()=>{
 let acknowledge,requests=0;
 const start=new Promise(resolve=>{acknowledge=resolve;});
 const done=requestStaffChannelStop(false,start,()=>{requests++;});
 assert.equal(requests,1,'release still stops immediately');
 acknowledge({channeling:true});await done;
 assert.equal(requests,2,'an in-flight accepted start must still be cancelled');
 await requestStaffChannelStop(false,Promise.resolve({channeling:false}),()=>{requests++;});
 assert.equal(requests,3,'a refused start does not add a second request');
});
