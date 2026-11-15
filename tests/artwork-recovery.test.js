import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverArtworks } from '../src/shared/artwork-recovery.js';

const createWorld = () => ({
  revision: 5,
  artworks: {
    held: { holder: 'player-1', throwEvent: null, availableAt: 0 },
    thrown: { holder: null, throwEvent: { id: 'flight-1', time: 1000 }, availableAt: 200000 },
    missing: { holder: null, throwEvent: null, availableAt: 50000 },
    idle: { holder: null, throwEvent: null, availableAt: 0 }
  },
  artworkLayout: {
    held: { position: [9, 4, -2], rotation: [0, 0.2, 0], scale: [2, 1, 1], revision: 3 }
  },
  structures: [{ id: 'keep' }],
  plants: [{ id: 'also-keep' }]
});

test('non-GM cannot recover any artwork or alter persistent data', () => {
  const world = createWorld(), before = structuredClone(world);
  assert.deepEqual(recoverArtworks(world, false), { error: 'GM only' });
  assert.deepEqual(world, before);
});

test('GM recovers held, flying, unavailable artworks without overwriting layouts or other world state', () => {
  const world = createWorld(), { artworkLayout, structures, plants } = structuredClone(world);
  assert.deepEqual(recoverArtworks(world, true), { ok: true, recovered: 3, notice: '已復原 3 件藝術作品' });
  assert.equal(world.revision, 6);
  assert.ok(Object.values(world.artworks).every(a => a.holder === null && a.throwEvent === null && a.availableAt === 0));
  assert.deepEqual(world.artworkLayout, artworkLayout);
  assert.deepEqual(world.structures, structures);
  assert.deepEqual(world.plants, plants);
});

test('recovery is idempotent and ignores malformed legacy artwork records', () => {
  const world = { revision: 8, artworks: { a: null, b: {}, c: { availableAt: 0, holder: null, throwEvent: null } } };
  assert.deepEqual(recoverArtworks(world, true), { ok: true, recovered: 0, notice: '所有藝術作品已位於預設展示位置' });
  assert.equal(world.revision, 8);
  assert.equal(recoverArtworks(world, true).recovered, 0);
});
