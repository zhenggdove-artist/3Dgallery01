// Secure hosted ECPay checkout. The browser never claims payment success.
// Production requires Cloudflare-held merchant secrets and an explicit switch.
// Use the same browsing context (no popups) to support iOS Safari/LINE.
const GATEWAYS=new Set([
 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
]);
export async function beginWingCheckout(network,ui){
 try{
  const status=await network.request('/api/wing-pay/status');
  if(!status.checkoutEnabled)throw Error('綠界正式收款尚未開通，無法建立付款訂單。');
  if(!['production','stage-only'].includes(status.checkoutMode))throw Error('綠界付款設定無效');
  const order=await network.request('/api/wing-pay/checkout',{method:'POST',body:{}});
  if(!GATEWAYS.has(order.gateway)||order.checkoutMode!==status.checkoutMode||
     order.amount!==30||order.designCredits!==1||!order.fields?.CheckMacValue||
     !/^GW[A-Z0-9]{18}$/.test(order.orderId)||order.fields.TotalAmount!=='30')
   throw Error('伺服器返回的付款訂單無效');
  if(order.fields.MerchantTradeNo!==order.orderId)throw Error('付款訂單編號不一致');
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
  ui.toast(error.message||'目前無法連線到綠界付款。');
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
   ui.toast('綠界付款已由伺服器確認，禮物盒繪圖權限已入帳。');
   return order;
  }
  ui.toast('付款訂單尚未確認；請勿重複付款。');
  return order;
 }catch(error){
  console.warn('Pending ECPay order status requires authenticated session',error);
  return null;
 }
}
