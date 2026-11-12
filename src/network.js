export class TempleNetwork extends EventTarget{
  constructor(config=window.TEMPLE_CONFIG){
    super();this.config=config;this.base=String(config.backendUrl||'').replace(/\/$/,'');this.token='';this.socket=null;this.joinData=null;this.reconnectTimer=0;this.reconnectAttempt=0;this.closedByUser=false;this.lastStateAt=0;
  }
  setBackend(url){this.base=String(url||'').trim().replace(/\/$/,'');localStorage.setItem('temple-backend-url',this.base);}
  ensureConfigured(){if(!/^https?:\/\//.test(this.base)||this.base.includes('REPLACE_WITH_ACCOUNT'))throw new Error('Temple backend URL has not been deployed yet');}
  async join({name,color='#bde8dc',memoryCode='',saveCode=''}){
    this.ensureConfigured();const data=await this.request('/api/join',{method:'POST',body:{name,color,memoryCode,saveCode},auth:false});this.token=data.token;this.joinData=data;this.closedByUser=false;sessionStorage.setItem('temple-session-token',this.token);await this.connect();return data;
  }
  async connect(){
    if(!this.token)throw new Error('Join Temple first');if(this.socket){this.socket.onclose=null;this.socket.close();}
    const url=new URL(this.base);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/api/socket';url.searchParams.set('token',this.token);
    await new Promise((resolve,reject)=>{const socket=new WebSocket(url);this.socket=socket;const timer=setTimeout(()=>{socket.close();reject(new Error('Realtime connection timed out'));},10_000);socket.onopen=()=>{clearTimeout(timer);this.reconnectAttempt=0;this.dispatch('connection',{connected:true});resolve();};socket.onerror=()=>{clearTimeout(timer);reject(new Error('Realtime connection failed'));};socket.onmessage=event=>{if(event.data==='pong')return;try{const message=JSON.parse(event.data);this.dispatch(message.type,message.data);}catch(error){console.warn('Temple socket message',error);}};socket.onclose=event=>{clearTimeout(timer);this.dispatch('connection',{connected:false,code:event.code});if(!this.closedByUser)this.scheduleReconnect();};});
  }
  scheduleReconnect(){clearTimeout(this.reconnectTimer);const delay=Math.min(12_000,600*2**this.reconnectAttempt++);this.reconnectTimer=setTimeout(()=>this.connect().catch(()=>this.scheduleReconnect()),delay);}
  sendState(state){const now=performance.now();if(now-this.lastStateAt<90||this.socket?.readyState!==WebSocket.OPEN)return;this.lastStateAt=now;this.socket.send(JSON.stringify({type:'state',data:state}));}
  async action(action,data={}){return this.request('/api/action',{method:'POST',body:{action,requestId:crypto.randomUUID(),...data}});}
  async chat(text){return this.request('/api/chat',{method:'POST',body:{text}});}
  async chatHistory(){return this.request('/api/chat');}
  async createSaveCode(){return this.request('/api/save-code',{method:'POST',body:{}});}
  async changeRole(role){return this.request('/api/role',{method:'POST',body:{role}});}
  async world(){return this.request('/api/world');}
  async request(path,{method='GET',body,auth=true}={}){
    const headers={'Content-Type':'application/json'};if(auth&&this.token)headers.Authorization=`Bearer ${this.token}`;
    let response;try{response=await fetch(this.base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});}catch{throw new Error('Cannot reach the Temple server');}
    let data={};try{data=await response.json();}catch{}if(!response.ok)throw new Error(data.error||`Temple server ${response.status}`);return data;
  }
  dispatch(type,data){this.dispatchEvent(new CustomEvent(type,{detail:data}));}
  close(){
    this.closedByUser=true;clearTimeout(this.reconnectTimer);if(this.socket?.readyState<2)this.socket.close(1000,'Leaving Temple');this.socket=null;
    if(!this.token||!this.base)return;const url=`${this.base}/api/disconnect?token=${encodeURIComponent(this.token)}`;
    if(navigator.sendBeacon){navigator.sendBeacon(url,new Blob(['{}'],{type:'text/plain;charset=UTF-8'}));return;}
    fetch(url,{method:'POST',body:'{}',keepalive:true}).catch(()=>{});
  }
}
