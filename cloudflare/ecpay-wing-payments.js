// ECPay / Apple Pay *infrastructure placeholder*.
// IMPORTANT: No live checkout, payment fulfilment or minting from this API.
// A future implementation MUST authenticate the buyer, create a durable
// payment order, use server-only HashKey/HashIV for CheckMacValue, verify the
// official asynchronous ReturnURL and match merchant/order/amount/status
// before granting anything. Never trust client-side success redirects.
export const ECPAY_GATEWAYS=Object.freeze({
 stage:'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
 production:'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
});
export const WING_PAYMENT_PROVIDER='ECPay';
export const WING_PAYMENT_CHANNEL='ApplePay';
export const WING_PAYMENT_CURRENTLY_ENABLED=false;

const json=(body,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
});
export function wingPaymentStatus(){
 return {
  provider:WING_PAYMENT_PROVIDER,channel:WING_PAYMENT_CHANNEL,
  currency:'TWD',checkoutEnabled:false,checkoutMode:'disabled',
  providerCheckoutMethod:'server-created AioCheckOut/V5 POST',
  webhook:'ReturnURL; signed SHA256 CheckMacValue required',
  stageReady:false,
  notice:'GM preview only. No payment is collected and wings cannot be purchased.'
 };
}
export async function wingPaymentApi(request){
 const {pathname}=new URL(request.url);
 if(request.method==='GET'&&pathname==='/api/wing-pay/status')
  return json(wingPaymentStatus());
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Allow':'GET, POST, OPTIONS'}});
 if(pathname==='/api/wing-pay/checkout'&&request.method==='POST')
  return json({error:'Checkout not enabled. No money has been charged.',
   provider:WING_PAYMENT_PROVIDER,channel:WING_PAYMENT_CHANNEL},503);
 if(pathname==='/api/wing-pay/notify'&&request.method==='POST')
  return new Response('0|NOT_ENABLED',{status:503,headers:{'Cache-Control':'no-store'}});
 return json({error:'Unknown Wing Shop payment endpoint'},404);
}
