import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SHOP_ITEMS,shopWeaponGroups,shopPurchaseVariant,SHOP_CATALOG_REVISION} from '../src/shared/catalog.js';
import {createFlightVehicle,animateFlightVehicle} from '../src/reletter/flight-vehicle.js';
const ids=['wings-42','wings-43','wings-44','outfit-tin-pipe-disguise','outfit-luroufan-sign-disguise','outfit-bubble-tea-disguise','outfit-fried-chicken-disguise'];
test('new coin shop wearables exist, sort before older gear and are purchasable',()=>{
 assert.ok(Number(SHOP_CATALOG_REVISION.slice(1))>=117);const first=shopWeaponGroups(SHOP_ITEMS).slice(0,11).map(g=>g.base.id);
 for(const id of ids)assert.ok(first.includes(id),id);
 for(const id of ids){const item=shopPurchaseVariant(id);assert.ok(item?.price>0,id);if(item.slot==='outfit'){assert.equal(item.disguiseHeight,id==='outfit-tin-pipe-disguise'?3:2);assert.equal(item.exposedHead,true);}}
});
test('flight vehicles are finite, lightweight 3D models with animated rotors or propellers',()=>{
 for(const id of ids.slice(0,3)){const root=createFlightVehicle(T,shopPurchaseVariant(id));const bounds=new T.Box3().setFromObject(root);assert.ok(!bounds.isEmpty());assert.ok(bounds.getSize(new T.Vector3()).length()>0);assert.equal(animateFlightVehicle(root,1,true),true);const part=root.getObjectByName('vehicle-rotor')||root.getObjectByName('vehicle-propeller');assert.ok(part);assert.ok(Math.abs(part.rotation.y)+Math.abs(part.rotation.z)>10);}
});
