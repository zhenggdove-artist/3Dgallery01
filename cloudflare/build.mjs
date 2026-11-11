import {mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const destination=resolve('dist-cloudflare');
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
await writeFile(resolve(destination,'index.html'),`<!doctype html><meta charset="utf-8"><title>Temple API</title><style>html{color-scheme:dark;font:16px system-ui;background:#090b0a;color:#d8c99a}main{max-width:42rem;margin:10vh auto;padding:2rem;border:1px solid #665c3d}</style><main><h1>Temple Arena API</h1><p>The game client is published through GitHub Pages. This isolated Worker hosts only Temple multiplayer state.</p><p><a href="/health">Health check</a></p></main>`);
console.log('Temple Worker assets prepared. Gallery artwork and RELETTER data are intentionally excluded.');
