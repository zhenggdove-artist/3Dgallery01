import test from 'node:test';
import assert from 'node:assert/strict';
import {getArtMedia} from '../cloudflare/art-media.js';
const bytes=new Uint8Array(600000).map((_,i)=>i%251);
const sql={exec(query,...args){if(query.startsWith('SELECT type'))return {toArray:()=>[{type:'video/webm',size:bytes.length}]};const [,from,to]=args;return [...Array(2)].flatMap((_,part)=>part>=from&&part<=to?[{part,data:bytes.slice(part*524288,(part+1)*524288)}]:[]);}};
test('artwork videos support byte ranges across chunks and suffix seeking',async()=>{
 for(const [range,start,end] of [['bytes=524280-524300',524280,524300],['bytes=-16',599984,599999],['bytes=599990-',599990,599999]]){
  const response=getArtMedia(sql,'id',new Request('https://test/media',{headers:{Range:range}}));
  assert.equal(response.status,206);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes.slice(start,end+1));
 }
 assert.equal(getArtMedia(sql,'id',new Request('https://test/media',{headers:{Range:'bytes=700000-'}})).status,416);
 assert.deepEqual(new Uint8Array(await getArtMedia(sql,'id').arrayBuffer()),bytes);
});
