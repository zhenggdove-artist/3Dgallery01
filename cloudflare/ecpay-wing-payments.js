// ECPay AioCheckOut/V5: SANDBOX-ONLY wing draw integration.
// Public sandbox keys below are ECPay's documented TEST keys, never production secrets.
export const WING_PRICE_TWD=30;
export const WING_DRAWS_PER_ORDER=5;
export const STAGE_GATEWAY='https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';
const STAGE_MERCHANT='3002607';
const STAGE_KEY='pwFHCqoQZGmho4w6';
const STAGE_IV='EkRm7iFT261dpevs';
const encoder=new TextEncoder();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export function wingPaymentStatus(env={},isGm=false){
 const stageAvailable=env.ECPAY_WING_STAGE_ENABLED==='true'&&isGm;
 return {provider:'ECPay',currency:'TWD',amount:WING_PRICE_TWD,draws:WING_DRAWS_PER_ORDER,
  checkoutEnabled:stageAvailable,checkoutMode:stageAvailable?'stage-only':'disabled',
  notice:'Test environment only. No real money is collected. Production checkout is unavailable.'};
}
// SHA256 ECPay CheckMacValue: sort, add HashKey/HashIV, form URL encode,
// replace .NET-compatible punctuation, lowercase before hashing.
export async function ecpayCheckMac(fields,key,iv){
 const raw='HashKey='+key+'&'+Object.keys(fields).filter(name=>name!=='CheckMacValue').sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase(),'en')).map(name=>name+'='+String(fields[name])).join('&')+'&HashIV='+iv;
 const encoded=encodeURIComponent(raw).replace(/%20/g,'+').replace(/~/g,'%7e').replace(/%2D/gi,'-').replace(/%5F/gi,'_').replace(/%2E/gi,'.').replace(/%21/gi,'!').replace(/%2A/gi,'*').replace(/%28/gi,'(').replace(/%29/gi,')').toLowerCase();
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
 return 'GW'+Date.now().toString(36).slice(-8).toUpperCase()+[...random].map(byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase();
}
export function taipeiTradeDate(now=Date.now()){
 return new Date(now+8*3_600_000).toISOString().slice(0,19).replace('T',' ').replace(/-/g,'/');
}
export async function stageCheckoutFields(tradeNo,returnUrl,clientBackUrl){
 if(!/^GW[A-Z0-9]{18}$/.test(tradeNo))throw Error('Invalid ECPay order number');
 const fields={MerchantID:STAGE_MERCHANT,MerchantTradeNo:tradeNo,
  MerchantTradeDate:taipeiTradeDate(),PaymentType:'aio',TotalAmount:String(WING_PRICE_TWD),
  TradeDesc:'GGTEMPLE Wing Draw Test',ItemName:'GGTEMPLE 5 Wing Draws',
  ReturnURL:returnUrl,ClientBackURL:clientBackUrl,ChoosePayment:'Credit',EncryptType:'1'};
 fields.CheckMacValue=await ecpayCheckMac(fields,STAGE_KEY,STAGE_IV);
 return fields;
}
export function initializeWingOrders(sql){
 sql.exec("CREATE TABLE IF NOT EXISTS wing_payment_orders (merchant_trade_no TEXT PRIMARY KEY, profile_key TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount=30),draws INTEGER NOT NULL CHECK(draws=5),status TEXT NOT NULL DEFAULT 'pending',provider_trade_no TEXT,created_at INTEGER NOT NULL,paid_at INTEGER)");
 sql.exec('CREATE INDEX IF NOT EXISTS idx_wing_payment_profile ON wing_payment_orders(profile_key,created_at)');
}
export async function wingCheckoutApi(room,request,session){
 if(room.env.ECPAY_WING_STAGE_ENABLED!=='true')return json({error:'Payment test mode is disabled.'},503);
 const profile=room.world().profiles[session.profile_key];
 if(!profile?.admin||!session.profile_key.startsWith('firebase:'))return json({error:'GM Google account required for sandbox testing.'},403);
 const recent=room.sql.exec('SELECT COUNT(*) AS n FROM wing_payment_orders WHERE profile_key=? AND created_at>?',session.profile_key,Date.now()-60_000).toArray()[0];
 if(recent?.n>=5)return json({error:'Too many test orders. Retry later.'},429);
 const tradeNo=newWingTradeNo(),now=Date.now();
 const base=new URL(request.url).origin;
 if(!/^https:\/\//.test(base)&&!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(base))return json({error:'HTTPS callback required.'},503);
 const returnUrl=base+'/api/wing-pay/notify';
 const gameUrl=String(room.env.TEMPLE_GAME_URL||'https://zhenggdove-artist.github.io/3Dgallery01/');
 if(!/^https:\/\//.test(gameUrl))return json({error:'Invalid game return URL.'},503);
 const fields=await stageCheckoutFields(tradeNo,returnUrl,gameUrl);
 room.sql.exec("INSERT INTO wing_payment_orders(merchant_trade_no,profile_key,amount,draws,status,created_at) VALUES(?,?,?,?,?,?)",tradeNo,session.profile_key,WING_PRICE_TWD,WING_DRAWS_PER_ORDER,'pending',now);
 return json({stage:true,gateway:STAGE_GATEWAY,fields,orderId:tradeNo,amount:WING_PRICE_TWD,draws:WING_DRAWS_PER_ORDER});
}
export function wingOrderStatus(room,request,session){
 const orderId=new URL(request.url).searchParams.get('id')||'';
 if(!/^GW[A-Z0-9]{18}$/.test(orderId))return json({error:'Invalid order ID'},400);
 const row=room.sql.exec('SELECT merchant_trade_no,status,amount,draws,created_at,paid_at FROM wing_payment_orders WHERE merchant_trade_no=? AND profile_key=?',orderId,session.profile_key).toArray()[0];
 if(!row)return json({error:'Order not found'},404);
 return json({orderId:row.merchant_trade_no,status:row.status,amount:row.amount,draws:row.draws,paidAt:row.paid_at||null});
}
export async function wingNotifyApi(room,request){
 if(room.env.ECPAY_WING_STAGE_ENABLED!=='true')return new Response('0|DISABLED',{status:503});
 if(request.method!=='POST')return new Response('0|METHOD',{status:405});
 const body=await request.text();
 if(body.length>15000)return new Response('0|TOO_LARGE',{status:413});
 const params=new URLSearchParams(body),fields={};
 for(const [key,value] of params){
  if(Object.hasOwn(fields,key))return new Response('0|DUPLICATE',{status:400});
  fields[key]=value;
 }
 if(!await verifyStageNotification(fields))return new Response('0|INVALID_MAC',{status:403});
 if(!/^GW[A-Z0-9]{18}$/.test(fields.MerchantTradeNo||''))return new Response('0|INVALID_ORDER',{status:400});
 const row=room.sql.exec('SELECT * FROM wing_payment_orders WHERE merchant_trade_no=?',fields.MerchantTradeNo).toArray()[0];
 if(!row||String(fields.TradeAmt)!==String(row.amount)||row.draws!==WING_DRAWS_PER_ORDER)
  return new Response('0|ORDER_MISMATCH',{status:400});
 if(fields.RtnCode!=='1')return new Response('1|OK');
 if(!fields.TradeNo||!/^\d{6,20}$/.test(fields.TradeNo))return new Response('0|INVALID_TRADE',{status:400});
 if(row.status==='paid')return new Response('1|OK');
 // Sandbox transaction credits GM only; an order can be fulfilled only once.
 room.ctx.storage.transactionSync(()=>{
  const current=room.sql.exec('SELECT status FROM wing_payment_orders WHERE merchant_trade_no=?',fields.MerchantTradeNo).toArray()[0];
  if(current?.status==='paid')return;
  const world=room.world(),profile=world.profiles[row.profile_key];
  if(!profile?.admin||!row.profile_key.startsWith('firebase:'))throw Error('Invalid GM sandbox profile');
  profile.wingPaidDraws=Math.max(0,Number(profile.wingPaidDraws)||0)+row.draws;
  profile.updatedAt=Date.now();
  room.save(world);
  room.sql.exec('UPDATE wing_payment_orders SET status=?,provider_trade_no=?,paid_at=? WHERE merchant_trade_no=?','paid',fields.TradeNo,Date.now(),fields.MerchantTradeNo);
 });
 room.broadcastWorld(room.world());
 return new Response('1|OK',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
}
