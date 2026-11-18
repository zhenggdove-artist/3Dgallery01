// The real-money checkout is intentionally unavailable. This module only
// opens ECPay's public TEST gateway for authenticated GMs, after Worker auth.
const STAGE_GATEWAY='https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';
export async function beginWingStageCheckout(network,ui){
 // iOS browsers usually require a window to open directly on the click gesture.
 const popup=window.open('about:blank','GGTEMPLE_ECPAY_STAGE');
 try{
  const status=await network.request('/api/wing-pay/status');
  if(!status.checkoutEnabled||status.checkoutMode!=='stage-only')throw Error('綠界測試收款目前未開通；不會產生任何實際扣款。');
  const order=await network.request('/api/wing-pay/checkout',{method:'POST',body:{}});
  if(order.gateway!==STAGE_GATEWAY||order.stage!==true||order.amount!==30||order.draws!==5||!order.fields?.CheckMacValue)
   throw Error('金流測試訂單資料不符合預期。');
  const form=document.createElement('form');form.method='POST';form.action=STAGE_GATEWAY;form.target=popup?'GGTEMPLE_ECPAY_STAGE':'_self';form.style.display='none';
  for(const [name,value] of Object.entries(order.fields)){
   const input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(value);form.append(input);
  }
  document.body.append(form);form.submit();
  queueMicrotask(()=>form.remove());
  ui.toast('綠界測試訂單已建立，不會實際扣款。');
 }catch(error){
  try{popup?.close();}catch{}
  ui.toast(error.message||'無法建立金流測試訂單。');
 }
}
