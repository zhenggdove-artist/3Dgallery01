import {createServer} from 'node:http';
import {createReadStream,statSync} from 'node:fs';
import {extname,join,normalize,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const port=Number(process.env.PORT)||8000;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};

createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url||'/',`http://${request.headers.host||'localhost'}`).pathname);
  const relative=normalize(pathname).replace(/^([/\\])+/, '');
  let file=resolve(join(root,relative||'index.html'));
  if(!file.startsWith(root)){response.writeHead(403).end('Forbidden');return;}
  try{if(statSync(file).isDirectory())file=join(file,'index.html');const stats=statSync(file);response.writeHead(200,{'Content-Type':types[extname(file).toLowerCase()]||'application/octet-stream','Content-Length':stats.size,'Cache-Control':'no-store','Cross-Origin-Resource-Policy':'cross-origin'});createReadStream(file).pipe(response);}
  catch{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Temple static server: http://127.0.0.1:${port}`));
