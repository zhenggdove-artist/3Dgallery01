import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {basename} from 'node:path';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
const tracked=()=>git('ls-files','-z').split('\0').filter(Boolean);
const oldNames=tracked().filter(p=>/reletter/i.test(p));
const remove=new Set(['scripts/sync-reletter.mjs','src/reletter/SOURCE.json']);
// Keep owned historical provenance in the existing Git history. No external
// source checkout is required for building or running the current engine.
for(const p of remove){if(existsSync(p))git('rm','--',p);}
if(!existsSync('src/reletter')||existsSync('src/engine'))throw Error('Unexpected engine directory state');
git('mv','src/reletter','src/engine');
const fileNames=new Map();
for(const old of oldNames){
 if(remove.has(old)||old.startsWith('src/reletter/'))continue;
 const next=old.replace(/reletter/gi,'engine');
 if(existsSync(next))throw Error('Rename collision '+next);
 git('mv',old,next);fileNames.set(basename(old),basename(next));
}
const symbols=new Map([
 ['buildReletterEnvironment','buildEngineEnvironment'],
 ['reletterPlatformMaterial','enginePlatformMaterial'],
 ['ReletterPresentation','EnginePresentation'],
 ['reletterAttackStats','engineAttackStats'],
 ['RELETTER_ITEMS','ENGINE_ITEMS'],
 ['reletter-wordmark','temple-wordmark']
]);
const ext=/\.(?:[cm]?js|tsx?|jsx|html?|css|jsonc?|md|txt|ya?ml|toml|svg|xml|py|ps1|sh|gltf|webmanifest)$/i;
const thirdParty=p=>p.startsWith('vendor/')||/(?:^|\/)(?:LICENSE|COPYING|NOTICE|CREDITS)(?:\.|$)/i.test(p)||/\/(?:credits\.html|sources\.json)$/i.test(p);
const self='scripts/independent-engine-migration.mjs';
const workflow='.github/workflows/engine-independence.yml';
const changed=[],remaining=[];
for(const p of tracked()){
 if(!ext.test(p)||thirdParty(p)||p===self||p===workflow)continue;
 const b=readFileSync(p);if(b.includes(0))continue;
 const before=b.toString('utf8');let after=before;
 // Only exact file paths, known local symbols and a jointly renamed CSS
 // selector. The wire/storage property 'reletter' remains unchanged.
 after=after.replace(/reletter(?=\/|\\\/)/g,'engine');
 for(const [from,to] of fileNames)after=after.replaceAll(from,to);
 for(const [from,to] of symbols)after=after.replaceAll(from,to);
 // A filename can occur in a regex with an escaped dot.
 for(const [from,to] of fileNames)after=after.replaceAll(from.replaceAll('.','\\.'),to.replaceAll('.','\\.'));
 // Owner's historical implementation comments are phrased as earlier
 // engine implementation, not as an external dependency. Preserve credits.
 after=after.split('\n').map(line=>{
  if(/^\s*(?:\/\/|\/\*|\*)/.test(line)&&!/\b(?:copyright|license|licence|attribution|credits?)\b/i.test(line))return line.replace(/\bRELETTER\b/g,'earlier engine');
  if(p.startsWith('tests/'))return line.replace(/(\btest\(['"][^'"]*)\bRELETTER\b/g,'$1baseline engine').replace(/output\/reletter-/g,'output/engine-');
  return line;
 }).join('\n');
 if(p==='tests/nov24-asset-wearable-cleanup-r105.test.js')after=after.replaceAll("'src','reletter','world-visuals.js'","'src','engine','world-visuals.js'");
 if(p==='scripts/check-release-bump.mjs')after=after.replaceAll('reletter-theme','engine-theme');
 if(p==='src/engine/plants.js'){
  if(!after.includes('const seed=hash(text);'))throw Error('Unexpected plant seed code');
  after=after.replace('const seed=hash(text);','const seed=opts.fixedGeometrySeed??hash(text);');
 }
 if(p==='src/engine-presentation.js'){
  let h=2166136261;const old='TEMPLE RELETTER';
  for(let i=0;i<old.length;i++){h^=old.charCodeAt(i);h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);}
  if((h>>>0)!==2666664333||!after.includes("makePlant('TEMPLE RELETTER',{clipBelow:false})"))throw Error('Unexpected central tree seed');
  after=after.replace("makePlant('TEMPLE RELETTER',{clipBelow:false})","makePlant('GGTEMPLE',{clipBelow:false,fixedGeometrySeed:2666664333})");
  after=after.replace("'RELETTER message tree'","'Temple message tree'");
 }
 if(p==='src/arena-view.js')after=after.replace('Original RELETTER coin mesh missing','Temple coin mesh missing');
 if(p==='index.html'){
  if(!after.includes('20261126-v084-r168'))throw Error('Unexpected release baseline');
  after=after.replaceAll('20261126-v084-r168','20261126-v085-r169').replaceAll('V084','V085').replaceAll('v084','v085');
 }
 if(after!==before){writeFileSync(p,after);changed.push(p);}
 for(const [i,line] of after.split('\n').entries())if(/reletter/i.test(line)){
  const names=[...new Set(line.match(/[\w-]*reletter[\w-]*/gi)||[])];
  remaining.push({file:p,line:i+1,tokens:names});
 }
}
const remainingPaths=tracked().filter(p=>/reletter/i.test(p));
if(remainingPaths.length)throw Error('Old module paths remain: '+remainingPaths.join(', '));
writeFileSync('/tmp/engine-independence-report.json',JSON.stringify({renamed:oldNames,changed,remaining,notes:['Legacy persisted/world-wire field names are intentionally preserved.','Third-party licensing and credits are not edited.','History and other refs are not rewritten.']},null,2));
for(const entry of remaining)console.log('Compatibility review: '+entry.file+':'+entry.line+' '+entry.tokens.join(', '));
console.log('Renamed/deleted paths: '+oldNames.length+'; edited text files: '+changed.length+'; residual reference lines for manual compatibility review: '+remaining.length);
if(remaining.some(x=>x.tokens.some(t=>/sync-reletter/i.test(t))))throw Error('A current file still references the retired sync script');
