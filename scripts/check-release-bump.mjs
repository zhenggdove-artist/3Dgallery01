// Require fresh linked CSS and first-party ES module URLs whenever gameplay
// code changes, otherwise old browser assets may talk to a new Worker.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
let parent;
try{parent=execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim();}
catch{console.log('Release guard: parent commit unavailable; use checkout fetch-depth: 2 in CI');process.exit(0);}
const changed=execFileSync('git',['diff','--name-only',parent,'HEAD'],{encoding:'utf8'})
 .split(/\r?\n/).filter(Boolean);
const gameplay=changed.some(p=>
 /^src\/.*\.js$/.test(p)||/^cloudflare\/.*\.(?:js|mjs)$/.test(p)||
 /^(?:styles|fidelity-ui|gun|wall-paint|wing-atelier|sketch-hud|reletter-theme)\.css$/.test(p));
if(!gameplay){console.log('Release guard: no gameplay, Worker or linked CSS changes');process.exit(0);}
const old=execFileSync('git',['show',parent+':index.html'],{encoding:'utf8'});
const current=readFileSync('index.html','utf8');
const release=s=>s.match(/const release = '([^']+)'/)?.[1]||'';
const before=release(old),after=release(current);
if(!before||!after||before===after){
 console.error('Gameplay code changed without changing the index.html first-party module release token. This creates stale-client/new-server mismatch.');
 process.exitCode=1;
}else{
 if(current.includes(before)){console.error('Old release token remains in index.html, potentially mixing CSS/startup revisions');process.exitCode=1;}
 else console.log('Release guard passed: '+before+' -> '+after);
}
