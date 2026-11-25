// ECPay AioCheckOut/V5: wing design purchases and optional additional support. Production is fail-closed until a verified merchant's server-only
// secrets and explicit switch exist in Cloudflare Worker. Never client-fulfil.
export const WING_PRICE_TWD=30;
export const MAX_WING_QUANTITY=100,MAX_WING_AMOUNT=20000;
export function normalizeWingOrder(body={}){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid order');
 const quantity=body.quantity===undefined?1:body.quantity;
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>MAX_WING_QUANTITY)throw Error('Choose 1–100 canvases.');
 const min=quantity*WING_PRICE_TWD,amount=body.amount===undefined?min:body.amount;
 if(!Number.isSafeInteger(amount)||amount<min||amount>MAX_WING_AMOUNT)throw Error('Enter a whole TWD amount between NT$'+min+' and NT$'+MAX_WING_AMOUNT+'.');
 return {amount,designCredits:quantity};
}
export const WING_DRAWS_PER_ORDER=0; // Deprecated; the random lottery is removed.
export const STAGE_GATEWAY='https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';
export const PRODUCTION_GATEWAY='https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';
const STAGE_MERCHANT='3002607';
const STAGE_KEY='pwFHCqoQZGmho4w6';
const STAGE_IV='EkRm7iFT261dpevs';
const encoder=new TextEncoder();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const stageKeys=()=>({id:STAGE_MERCHANT,key:STAGE_KEY,iv:STAGE_IV});
const validSecrets=env=>/^\d{7,10}$/.test(env?.ECPAY_MERCHANT_ID||'')&&
 env.ECPAY_MERCHANT_ID!==STAGE_MERCHANT&&env.ECPAY_HASH_KEY!==STAGE_KEY&&env.ECPAY_HASH_IV!==STAGE_IV&&
 typeof env?.ECPAY_HASH_KEY==='string'&&env.ECPAY_HASH_KEY.length>=8&&
 typeof env?.ECPAY_HASH_IV==='string'&&env.ECPAY_HASH_IV.length>=8;
export function paymentMode(env={},isGm=false){
 if(env.ECPAY_PRODUCTION_ENABLED==='true'&&validSecrets(env))return 'production';
 if(env.ECPAY_WING_STAGE_ENABLED==='true'&&isGm)return 'stage-only';
 return 'disabled';
}
export function wingPaymentStatus(env={},isGm=false){
 const checkoutMode=paymentMode(env,isGm);
 return {provider:'ECPay',currency:'TWD',amount:WING_PRICE_TWD,
  product:'one-personal-wing-design',designCredits:1,flexibleAmount:true,maxQuantity:MAX_WING_QUANTITY,maxAmount:MAX_WING_AMOUNT,
  checkoutEnabled:checkoutMode!=='disabled',checkoutMode,
  notice:checkoutMode==='production'?'Production ECPay hosted checkout is enabled. Each NT$30 canvas grants one original design; extra support is optional.':
  checkoutMode==='stage-only'?'GM staging environment only; no real charge.':
  'ECPay production credentials and merchant approval are not configured; checkout is unavailable.'};
}
// ECPay official SHA256 .NET URL encoding and case-insensitive ASCII sort.
export async function ecpayCheckMac(fields,key,iv){
 const raw='HashKey='+key+'&'+Object.keys(fields).filter(name=>name!=='CheckMacValue')
  .sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase(),'en'))
  .map(name=>name+'='+String(fields[name])).join('&')+'&HashIV='+iv;
 const encoded=encodeURIComponent(raw).replace(/%20/g,'+').replace(/~/g,'%7e')
  .replace(/%2D/gi,'-').replace(/%5F/gi,'_').replace(/%2E/gi,'.')
  .replace(/%21/gi,'!').replace(/%2A/gi,'*').replace(/%28/gi,'(')
  .replace(/%29/gi,')').toLowerCase();
 const hash=await crypto.subtle.digest('SHA-256',encoder.encode(encoded));
 return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase();
}
function constantTimeEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let difference=0;
 for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
 return difference===0;
}
export async function verifyStageNotification(fields){
 if(!fields||fields.MerchantID!==STAGE_MERCHANT||!fields.CheckMacValue)return false;
 const expected=await ecpayCheckMac(fields,STAGE_KEY,STAGE_IV);
 return constantTimeEqual(expected,fields.CheckMacValue.toUpperCase());
}
export function newWingTradeNo(){
 const random=new Uint8Array(5);crypto.getRandomValues(random);
 return 'GW'+Date.now().toString(36).slice(-8).toUpperCase()+
  [...random].map(byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase();
}
export function taipeiTradeDate(now=Date.now()){
 return new Date(now+8*3_600_000).toISOString().slice(0,19).replace('T',' ').replace(/-/g,'/');
}
async function signedCheckoutFields(tradeNo,returnUrl,clientBackUrl,credentials,stage=false,order=normalizeWingOrder()){
 if(!/^GW[A-Z0-9]{18}$/.test(tradeNo))throw Error('Invalid ECPay order number');
 const fields={MerchantID:credentials.id,MerchantTradeNo:tradeNo,
  MerchantTradeDate:taipeiTradeDate(),PaymentType:'aio',TotalAmount:String(order.amount),
  TradeDesc:stage?'GGTEMPLE Wing Design Test':'GGTEMPLE Original Wing Design',
  ItemName:'GGTEMPLE Personal Wing Design x '+order.designCredits+(order.amount>order.designCredits*WING_PRICE_TWD?' + Additional Support':''),
  ReturnURL:returnUrl,ClientBackURL:clientBackUrl,ChoosePayment:'Credit',EncryptType:'1'};
 fields.CheckMacValue=await ecpayCheckMac(fields,credentials.key,credentials.iv);
 return fields;
}
export async function stageCheckoutFields(tradeNo,returnUrl,clientBackUrl){
 return signedCheckoutFields(tradeNo,returnUrl,clientBackUrl,stageKeys(),true);
}
export function initializeWingOrders(sql){
 // Keep the former draw-order table for audit history, but never create draw
 // credits from new payments. This new ledger has a distinct immutable SKU.
 sql.exec("CREATE TABLE IF NOT EXISTS wing_design_orders (merchant_trade_no TEXT PRIMARY KEY, profile_key TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount=30), product TEXT NOT NULL CHECK(product='personal-wing-design'), mode TEXT NOT NULL CHECK(mode IN ('stage-only','production')), status TEXT NOT NULL DEFAULT 'pending', provider_trade_no TEXT, created_at INTEGER NOT NULL, paid_at INTEGER)");
 // Keep legacy order IDs and constrained NT$30 unit price; migrate existing orders in place.
 const columns=sql.exec('PRAGMA table_info(wing_design_orders)').toArray();
 if(!columns.some(c=>c.name==='total_amount'))sql.exec('ALTER TABLE wing_design_orders ADD COLUMN total_amount INTEGER NOT NULL DEFAULT 30');
 if(!columns.some(c=>c.name==='design_credits'))sql.exec('ALTER TABLE wing_design_orders ADD COLUMN design_credits INTEGER NOT NULL DEFAULT 1');
 sql.exec('CREATE INDEX IF NOT EXISTS idx_wing_design_profile ON wing_design_orders(profile_key,created_at)');
}
export async function wingCheckoutApi(room,request,session){
 const world=room.world(),profile=world.profiles[session.profile_key];
 if(!profile||typeof session.profile_key!=='string'||!session.profile_key.startsWith('firebase:'))
  return json({error:'Sign in with a verified Google account.'},403);
 const mode=paymentMode(room.env,!!profile.admin);
 if(mode==='disabled')return json({error:'Payments are not available.'},503);
 let order;
 try{const raw=await request.text();order=normalizeWingOrder(raw?JSON.parse(raw):{});}catch(error){return json({error:error.message||'Invalid order'},400);}
 const recent=room.sql.exec('SELECT COUNT(*) AS n FROM wing_design_orders WHERE profile_key=? AND created_at>?',session.profile_key,Date.now()-60_000).toArray()[0];
 if(recent?.n>=5)return json({error:'Too many orders. Retry after one minute.'},429);
 const tradeNo=newWingTradeNo(),now=Date.now(),base=new URL(request.url).origin;
 if(!/^https:\/\//.test(base)&&!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(base))
  return json({error:'HTTPS callback required.'},503);
 const gameUrl=String(room.env.TEMPLE_GAME_URL||'https://zhenggdove-artist.github.io/3Dgallery01/');
 if(!/^https:\/\//.test(gameUrl))return json({error:'Invalid HTTPS game return URL.'},503);
 const back=new URL(gameUrl);back.searchParams.set('wingOrder',tradeNo);
 const credentials=mode==='production'?{id:room.env.ECPAY_MERCHANT_ID,key:room.env.ECPAY_HASH_KEY,iv:room.env.ECPAY_HASH_IV}:stageKeys();
 const fields=await signedCheckoutFields(tradeNo,base+'/api/wing-pay/notify',back.toString(),credentials,mode!=='production',order);
 room.sql.exec("INSERT INTO wing_design_orders(merchant_trade_no,profile_key,amount,product,mode,status,created_at,total_amount,design_credits) VALUES(?,?,?,?,?,?,?,?,?)",
  tradeNo,session.profile_key,WING_PRICE_TWD,'personal-wing-design',mode,'pending',now,order.amount,order.designCredits);
 return json({gateway:mode==='production'?PRODUCTION_GATEWAY:STAGE_GATEWAY,stage:mode!=='production',
  checkoutMode:mode,fields,orderId:tradeNo,amount:order.amount,designCredits:order.designCredits});
}
export function wingOrderStatus(room,request,session){
 const orderId=new URL(request.url).searchParams.get('id')||'';
 if(!/^GW[A-Z0-9]{18}$/.test(orderId))return json({error:'Invalid order ID'},400);
 const row=room.sql.exec('SELECT merchant_trade_no,status,total_amount,design_credits,mode,created_at,paid_at FROM wing_design_orders WHERE merchant_trade_no=? AND profile_key=?',orderId,session.profile_key).toArray()[0];
 if(!row)return json({error:'Order not found'},404);
 return json({orderId:row.merchant_trade_no,status:row.status,amount:row.total_amount,
  mode:row.mode,designCredits:row.status==='paid'?row.design_credits:0,paidAt:row.paid_at||null});
}
export async function wingNotifyApi(room,request){
 if(request.method!=='POST')return new Response('0|METHOD',{status:405});
 const body=await request.text();
 if(body.length>15000)return new Response('0|TOO_LARGE',{status:413});
 const fields={};
 for(const [key,value] of new URLSearchParams(body)){
  if(Object.hasOwn(fields,key))return new Response('0|DUPLICATE',{status:400});
  fields[key]=value;
 }
 const tradeNo=fields.MerchantTradeNo||'';
 if(!/^GW[A-Z0-9]{18}$/.test(tradeNo))return new Response('0|INVALID_ORDER',{status:400});
 const row=room.sql.exec('SELECT * FROM wing_design_orders WHERE merchant_trade_no=?',tradeNo).toArray()[0];
 if(!row||row.product!=='personal-wing-design'||row.amount!==WING_PRICE_TWD||!Number.isSafeInteger(row.design_credits)||row.design_credits<1||row.design_credits>MAX_WING_QUANTITY||!Number.isSafeInteger(row.total_amount)||row.total_amount<row.design_credits*WING_PRICE_TWD||row.total_amount>MAX_WING_AMOUNT)
  return new Response('0|ORDER_MISMATCH',{status:400});
 const mode=paymentMode(room.env,row.mode==='stage-only');
 if(mode!==row.mode)return new Response('0|DISABLED',{status:503});
 const credentials=row.mode==='production'?{id:room.env.ECPAY_MERCHANT_ID,key:room.env.ECPAY_HASH_KEY,iv:room.env.ECPAY_HASH_IV}:stageKeys();
 if(fields.MerchantID!==credentials.id||!fields.CheckMacValue)return new Response('0|INVALID_MERCHANT',{status:403});
 const expected=await ecpayCheckMac(fields,credentials.key,credentials.iv);
 if(!constantTimeEqual(expected,fields.CheckMacValue.toUpperCase()))
  return new Response('0|INVALID_MAC',{status:403});
 if(String(fields.TradeAmt)!==String(row.total_amount))return new Response('0|AMOUNT_MISMATCH',{status:400});
 // Simulations can never produce a paid entitlement.
 if(fields.RtnCode!=='1'||fields.SimulatePaid==='1')return new Response('1|OK');
 if(!/^\d{6,20}$/.test(fields.TradeNo||''))return new Response('0|INVALID_TRADE',{status:400});
 if(row.status==='paid')return new Response('1|OK');
 room.ctx.storage.transactionSync(()=>{
  const current=room.sql.exec('SELECT status FROM wing_design_orders WHERE merchant_trade_no=?',tradeNo).toArray()[0];
  if(current?.status==='paid')return;
  const world=room.world(),profile=world.profiles[row.profile_key];
  if(!profile||!row.profile_key.startsWith('firebase:'))throw Error('Missing authenticated profile');
  profile.wingDesignCredits=Math.max(0,Number(profile.wingDesignCredits)||0)+row.design_credits;
  profile.lastWingCanvasGrant={id:tradeNo,time:Date.now(),quantity:row.design_credits,source:'payment'};
  profile.updatedAt=Date.now();
  world.revision=(world.revision||0)+1;
  room.save(world);
  room.sql.exec('UPDATE wing_design_orders SET status=?,provider_trade_no=?,paid_at=? WHERE merchant_trade_no=?',
   'paid',fields.TradeNo,Date.now(),tradeNo);
 });
 room.broadcastWorld(room.world());
 return new Response('1|OK',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
}
