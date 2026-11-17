import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const audio=readFileSync(new URL('../src/game-audio.js',import.meta.url),'utf8');

test('mobile startup uses a persistent cache key instead of rotating 15-second URLs',()=>{
 assert.doesNotMatch(html,/Math\.floor\(Date\.now\(\)\s*\/\s*15000\)/);
 assert.match(html,/temple-release=/);
 const release=html.match(/const release = '([^']+)'/)?.[1];
 assert.match(release||'',/^20\d{6}-[a-z0-9-]+$/);
 assert.ok(html.includes('window.templeStartupDiagnostics = {release: "'+release+'"'),
  'startup diagnostics must report the same deployed module release');
});

test('failed module imports report the underlying exception rather than a generic 0% timeout',()=>{
 assert.match(html,/import\("\.\/src\/main\.js"\)\.catch\(error/);
 assert.match(html,/window\.templeDisplayStartupError/);
 assert.doesNotMatch(html,/Game module did not initialise; refresh this page/);
 assert.match(html,/120000/);
});

test('missing soundtrack must not abort first page load',()=>{
 assert.match(audio,/sound\/GGTEMPLE%E9%9F%B3%E6%A8%82\.mp3/);
 assert.match(audio,/method:'HEAD'/);
 assert.match(audio,/if\(!response\.ok\|\|this\.uploadedMusicUrl\)return false/);
 assert.match(audio,/sound\/backgroundmusic\.MP3/);
 assert.match(audio,/setUploadedMusic/);
});
