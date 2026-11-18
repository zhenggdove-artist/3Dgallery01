import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ecpayCheckMac,stageCheckoutFields,newWingTradeNo,taipeiTradeDate,wingPaymentStatus,
 wingCheckoutApi,wingOrderStatus,wingNotifyApi,STAGE_GATEWAY
} from '../cloudflare/ecpay-wing-payments.js';

const KEY='pwFHCqoQZGmho4w6',IV='EkRm7iFT261dpevs';
test('CheckMacValue matches official ECPay SHA256 vector',async()=>{
 const params={
  TradeDesc:'促銷方案',PaymentType:'aio',MerchantTradeDate:'2023/03/12 15:30:23',
  MerchantTradeNo:'ecpay20230312153023',MerchantID:'3002607',
  ReturnURL:'https://www.ecpay.com.tw/receive.php',ItemName:'Apple iphone 15',
  TotalAmount:'30000',ChoosePayment:'ALL',EncryptType:'1'
 };
 assert.equal(await ecpayCheckMac(params,KEY,IV),'6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840');
});
test('Checkout is stage-only and signed with constant server-side amount',async()=>{
 const id=newWingTradeNo();
 assert.match(id,/^GW[A-Z0-9]{18}$/);
 assert.equal(taipeiTradeDate(Date.UTC(2026,10,18,16,0,0)),'2026/11/19 00:00:00');
 const fields=await stageCheckoutFields(id,'https://gg.example/api/wing-pay/notify','https://gg.example/');
 assert.equal(fields.TotalAmount,'30');
 assert.equal(fields.ChoosePayment,'Credit');
 assert.equal(fields.CheckMacValue,await ecpayCheckMac(fields,KEY,IV));
 assert.equal(STAGE_GATEWAY,'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5');
 assert.equal(wingPaymentStatus({},true).checkoutEnabled,false);
 assert.equal(wingPaymentStatus({ECPAY_WING_STAGE_ENABLED:'true'},false).checkoutEnabled,false);
 assert.equal(wingPaymentStatus({ECPAY_WING_STAGE_ENABLED:'true'},true).checkoutMode,'stage-only');
});
function fakeRoom(enabled=true,admin=true){
 const profileKey='firebase:gg-temple:gm';
 let worldState={profiles:{[profileKey]:{admin,wingPaidDraws:0}}};
 const orders=new Map();
 const sql={
  exec(q,...args){
   let rows=[];
   if(q.startsWith('SELECT COUNT(*) AS n'))rows=[{n:0}];
   else if(q.startsWith('INSERT INTO wing_payment_orders')){
    const [id,key,amount,draws,status,now]=args;orders.set(id,{merchant_trade_no:id,profile_key:key,amount,draws,status,created_at:now});
   }else if(q.startsWith('SELECT merchant_trade_no,status')){
    const [id,key]=args;const row=orders.get(id);if(row?.profile_key===key)rows=[row];
   }else if(q.startsWith('SELECT * FROM wing_payment_orders')){
    const row=orders.get(args[0]);if(row)rows=[row];
   }else if(q.startsWith('SELECT status FROM wing_payment_orders')){
    const row=orders.get(args[0]);if(row)rows=[row];
   }else if(q.startsWith('UPDATE wing_payment_orders SET')){
    const [status,tradeNo,paidAt,id]=args;Object.assign(orders.get(id),{status,provider_trade_no:tradeNo,paid_at:paidAt});
   }else throw Error('Unexpected SQL: '+q);
   return {toArray:()=>rows};
  }
 };
 const room={env:{ECPAY_WING_STAGE_ENABLED:enabled?'true':'false'},sql,
  world:()=>structuredClone(worldState),save:next=>{worldState=structuredClone(next);},
  ctx:{storage:{transactionSync:fn=>fn()}},broadcastWorld:()=>{}};
 return {room,orders,profileKey,getCredits:()=>worldState.profiles[profileKey].wingPaidDraws};
}
test('sandbox order and payment callback are bound to signed order, amount and player; fulfil once',async()=>{
 const state=fakeRoom();
 const session={profile_key:state.profileKey};
 const request=new Request('https://gg.example/api/wing-pay/checkout',{method:'POST',body:'{}'});
 const response=await wingCheckoutApi(state.room,request,session);
 assert.equal(response.status,200);
 const order=await response.json();
 assert.equal(order.stage,true);
 assert.equal(order.amount,30);
 assert.equal(state.getCredits(),0);
 const getStatus=()=>wingOrderStatus(state.room,new Request('https://gg.example/api/wing-pay/order?id='+order.orderId),session).json();
 assert.equal((await getStatus()).status,'pending');
 const params={MerchantID:'3002607',MerchantTradeNo:order.orderId,RtnCode:'1',
  TradeAmt:'30',TradeNo:'2611191234567890',PaymentType:'Credit_CreditCard',PaymentDate:'2026/11/19 00:00:00'};
 params.CheckMacValue=await ecpayCheckMac(params,KEY,IV);
 const callback=(data)=>wingNotifyApi(state.room,new Request('https://gg.example/api/wing-pay/notify',{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)
 }));
 const invalid=await callback({...params,TradeAmt:'300'});
 assert.equal(invalid.status,403);
 assert.equal(state.getCredits(),0);
 const simulated={...params,SimulatePaid:'1'};
 simulated.CheckMacValue=await ecpayCheckMac(simulated,KEY,IV);
 assert.equal((await callback(simulated)).status,200);
 assert.equal(state.getCredits(),0);
 assert.equal(await (await callback(params)).text(),'1|OK');
 assert.equal(state.getCredits(),5);
 assert.equal((await getStatus()).status,'paid');
 assert.equal(await (await callback(params)).text(),'1|OK');
 assert.equal(state.getCredits(),5);
 const otherUser=wingOrderStatus(state.room,new Request('https://gg.example/api/wing-pay/order?id='+order.orderId),{profile_key:'firebase:gg-temple:other'});
 assert.equal(otherUser.status,404);
});
test('disabled sandbox and ordinary player cannot create orders',async()=>{
 const disabled=fakeRoom(false);
 assert.equal((await wingCheckoutApi(disabled.room,new Request('https://gg.example/api/wing-pay/checkout',{method:'POST'}),{profile_key:disabled.profileKey})).status,503);
 const player=fakeRoom(true,false);
 assert.equal((await wingCheckoutApi(player.room,new Request('https://gg.example/api/wing-pay/checkout',{method:'POST'}),{profile_key:player.profileKey})).status,403);
});

test('checkout button submits signed staging fields to ECPay only after server confirms test mode',async()=>{
 const {beginWingStageCheckout}=await import('../src/wing-payment-client.js');
 const savedWindow=globalThis.window,savedDocument=globalThis.document;
 const posted=[],requests=[],alerts=[];let popupClosed=false;
 const fakePopup={close(){popupClosed=true;}};
 const form={children:[],style:{},append(node){this.children.push(node);},
  submit(){posted.push({action:this.action,target:this.target,fields:Object.fromEntries(this.children.map(c=>[c.name,c.value]))});},
  remove(){}};
 const network={request:async(path,options)=>{
  requests.push(path);
  if(path==='/api/wing-pay/status')return {checkoutEnabled:true,checkoutMode:'stage-only'};
  if(path==='/api/wing-pay/checkout')return {
   gateway:STAGE_GATEWAY,stage:true,amount:30,draws:5,fields:{
    MerchantID:'3002607',MerchantTradeNo:'GW261119123456789012',TotalAmount:'30',
    CheckMacValue:'AUTHORIZED-BY-SERVER'
   }};
  throw Error('Unexpected endpoint');
 }};
 const ui={toast:text=>alerts.push(text)};
 try{
  globalThis.window={open:()=>fakePopup};
  globalThis.document={
   createElement(tag){
    if(tag==='form')return form;
    if(tag==='input')return {type:'',name:'',value:''};
    throw Error('Unexpected DOM element: '+tag);
   },body:{append(node){assert.equal(node,form);}}
  };
  await beginWingStageCheckout(network,ui);
  assert.deepEqual(requests,['/api/wing-pay/status','/api/wing-pay/checkout']);
  assert.equal(posted.length,1);
  assert.equal(posted[0].action,STAGE_GATEWAY);
  assert.equal(posted[0].target,'GGTEMPLE_ECPAY_STAGE');
  assert.equal(posted[0].fields.TotalAmount,'30');
  assert.equal(popupClosed,false);
  requests.length=0;posted.length=0;
  network.request=async()=>({checkoutEnabled:false});
  await beginWingStageCheckout(network,ui);
  assert.equal(posted.length,0,'disabled Worker must never post to gateway');
  assert.equal(popupClosed,true);
 }finally{
  globalThis.window=savedWindow;globalThis.document=savedDocument;
 }
});
