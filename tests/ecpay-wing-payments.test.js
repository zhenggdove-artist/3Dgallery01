import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ecpayCheckMac,stageCheckoutFields,newWingTradeNo,taipeiTradeDate,wingPaymentStatus,paymentMode,
 wingCheckoutApi,wingOrderStatus,wingNotifyApi,STAGE_GATEWAY,PRODUCTION_GATEWAY,WING_PRICE_TWD
} from '../cloudflare/ecpay-wing-payments.js';

const STAGE_KEY='pwFHCqoQZGmho4w6',STAGE_IV='EkRm7iFT261dpevs';
const PRODUCTION={ECPAY_PRODUCTION_ENABLED:'true',ECPAY_MERCHANT_ID:'2000132',
 ECPAY_HASH_KEY:'secretProductionKeyForTest',ECPAY_HASH_IV:'secretProductionIvForTest'};
const stage={ECPAY_WING_STAGE_ENABLED:'true'};
const profileKey='firebase:gg-temple:user';
function roomFixture(env,admin=false){
 let worldState={revision:0,profiles:{[profileKey]:{admin,wingDesignCredits:0}}};
 const orders=new Map();
 const sql={exec(q,...args){
  let rows=[];
  if(q.startsWith('CREATE ')||q.startsWith('CREATE INDEX'))return {toArray:()=>[]};
  if(q.startsWith('SELECT COUNT(*) AS n'))rows=[{n:0}];
  else if(q.startsWith('INSERT INTO wing_design_orders')){
   const [id,key,amount,product,mode,status,createdAt,totalAmount=amount,designCredits=1]=args;
   orders.set(id,{merchant_trade_no:id,profile_key:key,amount,product,mode,status,created_at:createdAt,total_amount:totalAmount,design_credits:designCredits});
  }else if(q.startsWith('SELECT merchant_trade_no,status')){
   const row=orders.get(args[0]);if(row?.profile_key===args[1])rows=[row];
  }else if(q.startsWith('SELECT * FROM wing_design_orders')){
   const row=orders.get(args[0]);if(row)rows=[row];
  }else if(q.startsWith('SELECT status FROM wing_design_orders')){
   const row=orders.get(args[0]);if(row)rows=[row];
  }else if(q.startsWith('UPDATE wing_design_orders SET')){
   const [status,providerTrade,paidAt,id]=args;
   Object.assign(orders.get(id),{status,provider_trade_no:providerTrade,paid_at:paidAt});
  }else throw Error('Unexpected SQL: '+q);
  return {toArray:()=>rows};
 }};
 const room={env:{...env,TEMPLE_GAME_URL:'https://gg.example/game/'},sql,world:()=>structuredClone(worldState),
  save:next=>{worldState=structuredClone(next);},
  ctx:{storage:{transactionSync:fn=>fn()}},broadcastWorld:()=>{}};
 return {room,session:{profile_key:profileKey},orders,
  credits:()=>worldState.profiles[profileKey].wingDesignCredits,
  revision:()=>worldState.revision};
}
async function checkout(fixture,body={}){
 const resp=await wingCheckoutApi(fixture.room,new Request('https://gg.example/api/wing-pay/checkout',
  {method:'POST',body:JSON.stringify(body)}),fixture.session);
 return {response:resp,data:await resp.json()};
}
function callback(room,fields){
 return wingNotifyApi(room,new Request('https://gg.example/api/wing-pay/notify',{method:'POST',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)}));
}

test('CheckMacValue matches official SHA256 reference vector',async()=>{
 const params={
  TradeDesc:'促銷方案',PaymentType:'aio',MerchantTradeDate:'2023/03/12 15:30:23',
  MerchantTradeNo:'ecpay20230312153023',MerchantID:'3002607',
  ReturnURL:'https://www.ecpay.com.tw/receive.php',ItemName:'Apple iphone 15',
  TotalAmount:'30000',ChoosePayment:'ALL',EncryptType:'1'
 };
 assert.equal(await ecpayCheckMac(params,STAGE_KEY,STAGE_IV),
  '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840');
});
test('default purchase is a NT$30 single creative entitlement, no randomness',async()=>{
 assert.equal(WING_PRICE_TWD,30);
 const id=newWingTradeNo();
 assert.match(id,/^GW[A-Z0-9]{18}$/);
 assert.equal(taipeiTradeDate(Date.UTC(2026,10,18,16,0)),'2026/11/19 00:00:00');
 const fields=await stageCheckoutFields(id,'https://gg.example/api/wing-pay/notify',
  'https://gg.example/game/?wingOrder='+id);
 assert.equal(fields.TotalAmount,'30');
 assert.match(fields.ItemName,/Personal Wing Design x 1/);
 assert.equal(fields.CheckMacValue,await ecpayCheckMac(fields,STAGE_KEY,STAGE_IV));
 assert.equal(STAGE_GATEWAY,'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5');
 assert.equal(PRODUCTION_GATEWAY,'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5');
 assert.equal(wingPaymentStatus().checkoutEnabled,false);
 assert.equal(wingPaymentStatus(stage,false).checkoutEnabled,false);
 assert.equal(wingPaymentStatus(stage,true).checkoutMode,'stage-only');
 assert.equal(paymentMode({...PRODUCTION,ECPAY_HASH_IV:''},false),'disabled');
 assert.equal(wingPaymentStatus(PRODUCTION,false).checkoutMode,'production');
});
test('staging callback credits a GM exactly once after real signed success; never pays on SimulatePaid',async()=>{
 const f=roomFixture(stage,true);
 const {response,data}=await checkout(f);
 assert.equal(response.status,200);
 assert.equal(data.stage,true);assert.equal(data.designCredits,1);
 assert.equal(data.gateway,STAGE_GATEWAY);
 assert.equal(f.credits(),0);
 const order=()=>wingOrderStatus(f.room,new Request('https://gg.example/api/wing-pay/order?id='+data.orderId),f.session).json();
 assert.equal((await order()).status,'pending');
 const fields={MerchantID:'3002607',MerchantTradeNo:data.orderId,RtnCode:'1',
  TradeAmt:'30',TradeNo:'2611191234567890',PaymentType:'Credit_CreditCard',PaymentDate:'2026/11/19 00:00:00'};
 fields.CheckMacValue=await ecpayCheckMac(fields,STAGE_KEY,STAGE_IV);
 assert.equal((await callback(f.room,{...fields,TradeAmt:'300'})).status,403);
 const simulation={...fields,SimulatePaid:'1'};
 simulation.CheckMacValue=await ecpayCheckMac(simulation,STAGE_KEY,STAGE_IV);
 assert.equal((await callback(f.room,simulation)).status,200);
 assert.equal(f.credits(),0);
 assert.equal(await (await callback(f.room,fields)).text(),'1|OK');
 assert.equal(f.credits(),1);assert.equal(f.revision(),1);
 assert.equal(await (await callback(f.room,fields)).text(),'1|OK');
 assert.equal(f.credits(),1);
 assert.equal((await order()).status,'paid');
 assert.equal(wingOrderStatus(f.room,new Request('https://gg.example/api/wing-pay/order?id='+data.orderId),
  {profile_key:'firebase:other'}).status,404);
});
test('production-only credentials allow verified paying Google player and reject callback tampering',async()=>{
 const f=roomFixture(PRODUCTION,false);
 const {data,response}=await checkout(f);
 assert.equal(response.status,200);
 assert.equal(data.stage,false);assert.equal(data.gateway,PRODUCTION_GATEWAY);
 assert.equal(data.fields.MerchantID,PRODUCTION.ECPAY_MERCHANT_ID);
 assert.equal(Object.keys(data).includes('key'),false);
 const fields={MerchantID:PRODUCTION.ECPAY_MERCHANT_ID,MerchantTradeNo:data.orderId,
  RtnCode:'1',TradeAmt:'30',TradeNo:'2611191234567891',PaymentType:'Credit_CreditCard'};
 fields.CheckMacValue=await ecpayCheckMac(fields,PRODUCTION.ECPAY_HASH_KEY,PRODUCTION.ECPAY_HASH_IV);
 assert.equal((await callback(f.room,{...fields,TradeAmt:'500'})).status,403);
 assert.equal(f.credits(),0);
 assert.equal(await (await callback(f.room,fields)).text(),'1|OK');
 assert.equal(f.credits(),1);
 assert.equal((await checkout(roomFixture({},false))).response.status,503);
});
test('checkout and callback fail closed unless the matching merchant environment is active',async()=>{
 const off=roomFixture({},true);
 assert.equal((await checkout(off)).response.status,503);
 const stageUser=roomFixture(stage,false);
 assert.equal((await checkout(stageUser)).response.status,503);
 const invalid=roomFixture({...PRODUCTION,ECPAY_HASH_KEY:''},false);
 assert.equal((await checkout(invalid)).response.status,503);
});
test('client uses same-tab hosted ECPay POST after checking Worker status, never self-credits',async()=>{
 const {beginWingCheckout}=await import('../src/wing-payment-client.js');
 const prior={document:globalThis.document,sessionStorage:globalThis.sessionStorage};
 const posted=[],store=new Map(),messages=[];
 const form={children:[],style:{},append(field){this.children.push(field);},remove(){},
  submit(){posted.push({method:this.method,action:this.action,target:this.target,
   fields:Object.fromEntries(this.children.map(f=>[f.name,f.value]))});}};
 const id='GW261119123456789012';
 const network={request:async(path)=>{
  if(path==='/api/wing-pay/status')return {checkoutEnabled:true,checkoutMode:'stage-only'};
  if(path==='/api/wing-pay/checkout')return {checkoutMode:'stage-only',gateway:STAGE_GATEWAY,amount:30,
   designCredits:1,orderId:id,fields:{MerchantID:'3002607',MerchantTradeNo:id,TotalAmount:'30',CheckMacValue:'SIGNED'}};
  throw Error(path);
 }};
 try{
  globalThis.sessionStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k),removeItem:k=>store.delete(k)};
  globalThis.document={createElement(tag){return tag==='form'?form:{name:'',value:'',type:''};},
   body:{append(node){assert.equal(node,form);}}};
  assert.equal(await beginWingCheckout(network,{toast:s=>messages.push(s)}),id);
  assert.equal(posted.length,1);
  assert.equal(posted[0].target,'_self');
  assert.equal(posted[0].action,STAGE_GATEWAY);
  assert.equal(posted[0].fields.TotalAmount,'30');
  assert.equal(store.get('ggtemple-wing-pending-order'),id);
  network.request=async()=>({checkoutEnabled:false});
  assert.equal(await beginWingCheckout(network,{toast:s=>messages.push(s)}),null);
  assert.equal(posted.length,1);
 }finally{globalThis.document=prior.document;globalThis.sessionStorage=prior.sessionStorage;}
});

test('quantity and additional support use signed total and award exactly the selected credits',async()=>{
 const f=roomFixture(PRODUCTION,false);
 const {data,response}=await checkout(f,{quantity:3,amount:155});
 assert.equal(response.status,200);
 assert.equal(data.amount,155);assert.equal(data.designCredits,3);
 assert.equal(data.fields.TotalAmount,'155');
 assert.equal(data.fields.CheckMacValue,await ecpayCheckMac(data.fields,PRODUCTION.ECPAY_HASH_KEY,PRODUCTION.ECPAY_HASH_IV));
 const fields={MerchantID:PRODUCTION.ECPAY_MERCHANT_ID,MerchantTradeNo:data.orderId,RtnCode:'1',TradeAmt:'90',TradeNo:'2611191234567892'};
 fields.CheckMacValue=await ecpayCheckMac(fields,PRODUCTION.ECPAY_HASH_KEY,PRODUCTION.ECPAY_HASH_IV);
 assert.equal((await callback(f.room,fields)).status,400);
 assert.equal(f.credits(),0);
 fields.TradeAmt='155';
 fields.CheckMacValue=await ecpayCheckMac(fields,PRODUCTION.ECPAY_HASH_KEY,PRODUCTION.ECPAY_HASH_IV);
 assert.equal(await (await callback(f.room,fields)).text(),'1|OK');
 assert.equal(await (await callback(f.room,fields)).text(),'1|OK');
 assert.equal(f.credits(),3);
 const order=await wingOrderStatus(f.room,new Request('https://gg.example/api/wing-pay/order?id='+data.orderId),f.session).json();
 assert.equal(order.amount,155);assert.equal(order.designCredits,3);
 assert.equal((await checkout(f,{quantity:3,amount:89})).response.status,400);
});
