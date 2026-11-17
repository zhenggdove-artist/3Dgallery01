// 00GameDevs Bubbling Venom Sigil (venom-pool).
// Uses the repository's original MIT-licensed 00GameDevs runtime, effect kind 2,
// variant 8 (the native seven-bubble venom pool school spell).
// Preserve the original vendor/00gamedevs/runtime.js licence notice.
import {createEffect} from './runtime.js';
const preset={
 id:'venom-pool',
 name:'沸泡毒陣',
 english:'Bubbling Venom Sigil',
 category:'area',
 kind:2,
 variant:8,
 color:'#acdc6f',
 duration:5,
 burst:false,
 maxParticles:512,
 seed:71028,
 quantity:{min:1,max:14,default:7,label:'毒泡數量',unit:'個',
  help:'沼澤地面的立體沸泡數量'}
};
export const defaultOptions={
 speed:1,detail:1,color:'#acdc6f',size:1,density:.5,quantity:7
};
export default function createVFX(options={}){
 return createEffect(preset,{...defaultOptions,...options});
}
