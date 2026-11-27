const MARKER='@temple-receipt-parts',CHARS=128*1024;
export function initializeLargeReceipts(sql){
 sql.exec('CREATE TABLE IF NOT EXISTS request_receipt_parts (session_id TEXT NOT NULL,request_id TEXT NOT NULL,part INTEGER NOT NULL,response TEXT NOT NULL,PRIMARY KEY(session_id,request_id,part),FOREIGN KEY(session_id,request_id) REFERENCES request_receipts(session_id,request_id) ON DELETE CASCADE)');
}
export function readActionReceipt(sql,sessionId,requestId,response){
 if(response!==MARKER)return response;
 const parts=sql.exec('SELECT response FROM request_receipt_parts WHERE session_id=? AND request_id=? ORDER BY part',sessionId,requestId).toArray();
 if(!parts.length)throw Error('Missing action receipt parts');return parts.map(p=>p.response).join('');
}
export function writeActionReceipt(sql,sessionId,requestId,response,now){
 const split=response.length>CHARS*3;
 sql.exec('INSERT INTO request_receipts VALUES(?,?,?,?)',sessionId,requestId,split?MARKER:response,now);
 if(split)for(let i=0,part=0;i<response.length;part++){
  let end=Math.min(i+CHARS,response.length);
  const c=response.charCodeAt(end-1);if(end<response.length&&c>=0xd800&&c<=0xdbff)end--;
  sql.exec('INSERT INTO request_receipt_parts VALUES(?,?,?,?)',sessionId,requestId,part,response.slice(i,end));i=end;
 }
}
