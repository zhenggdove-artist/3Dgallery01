// Secure hosted ECPay checkout. The browser never claims payment success.
// Production requires Cloudflare-held merchant secrets and an explicit switch.
// Use the same browsing context (no popups) to support iOS Safari/LINE.
const GATEWAYS={
 'stage-only':'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
 production:'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
};
export async function beginWingCheckout(network,ui){
 try{
  const status=await network.request('/api/wing-pay/status');
  if(!status.checkoutEnabled)throw Error('Payments are currently unavailable.');
  if(!['production','stage-only'].includes(status.checkoutMode))throw Error('Invalid checkout configuration.');
  const order=await network.request('/api/wing-pay/checkout',{method:'POST',body:{}});
  if(order.gateway!==GATEWAYS[status.checkoutMode]||order.checkoutMode!==status.checkoutMode||
     order.amount!==30||order.designCredits!==1||!order.fields?.CheckMacValue||
     !/^GW[A-Z0-9]{18}$/.test(order.orderId)||order.fields.TotalAmount!=='30')
   throw Error('The checkout could not be verified.');
  if(order.fields.MerchantTradeNo!==order.orderId)throw Error('Checkout order mismatch.');
  sessionStorage.setItem('ggtemple-wing-pending-order',order.orderId);
  const form=document.createElement('form');
  form.method='POST';form.action=order.gateway;form.target='_self';form.style.display='none';
  for(const [name,value] of Object.entries(order.fields)){
   const field=document.createElement('input');field.type='hidden';field.name=name;field.value=String(value);
   form.append(field);
  }
  document.body.append(form);
  form.submit();
  queueMicrotask(()=>form.remove());
  return order.orderId;
 }catch(error){
  ui.toast(error.message||'Secure checkout is unavailable.');
  return null;
 }
}
// Backward compatible symbol for test-only client integrations.
export const beginWingStageCheckout=beginWingCheckout;
export async function resumeWingCheckout(network,ui){
 const fromUrl=new URLSearchParams(location.search).get('wingOrder')||'';
 const id=/^GW[A-Z0-9]{18}$/.test(fromUrl)?fromUrl:sessionStorage.getItem('ggtemple-wing-pending-order')||'';
 if(!/^GW[A-Z0-9]{18}$/.test(id))return null;
 try{
  const order=await network.request('/api/wing-pay/order?id='+encodeURIComponent(id));
  if(order.status==='paid'){
   sessionStorage.removeItem('ggtemple-wing-pending-order');
   ui.toast('Payment confirmed. Your wing canvas is ready.');
   return order;
  }
  ui.toast('Payment pending. Please do not pay again.');
  return order;
 }catch(error){
  console.warn('Pending ECPay order status requires authenticated session',error);
  return null;
 }
}
