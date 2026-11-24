import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWingOrder,wingPaymentStatus} from '../cloudflare/ecpay-wing-payments.js';
test('legacy, quantity and extra support orders retain correct credits',()=>{
 assert.deepEqual(normalizeWingOrder(),{amount:30,designCredits:1});
 assert.deepEqual(normalizeWingOrder({quantity:3}),{amount:90,designCredits:3});
 assert.deepEqual(normalizeWingOrder({quantity:1,amount:75}),{amount:75,designCredits:1});
 assert.deepEqual(normalizeWingOrder({quantity:3,amount:150}),{amount:150,designCredits:3});
 assert.equal(wingPaymentStatus().flexibleAmount,true);
});
test('invalid amounts and quantities cannot create an order',()=>{
 for(const body of [{quantity:0},{quantity:101},{quantity:1.5},{quantity:'2'},{quantity:3,amount:30},{amount:29},{amount:30.5},{amount:20001},{amount:'30'},null,[]])assert.throws(()=>normalizeWingOrder(body));
});