/*!
00GameDevs exported assets — original code only
This license applies only to original code delivered by the VFX, Shader and Object copy/download functions. Website UI code, branding, avatars and promotional images are not licensed by this notice. Third-party code retains its own copyright and license.

The MIT License

Copyright (c) 2026 00GameDevs (@00vchannel)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

Third-party dependency: Three.js (including its addons).
Keep the notices supplied with each dependency when distributing your game.
The notice below does not replace any additional notices in imported modules.

The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
// 烈焰繞流 / Anime Flame Flow — Three.js 0.187.0 / WebGL2.
// SRGBColorSpace / NoToneMapping / opaque full-frame canvas.
// Add fx.group; update all instances with deltaSeconds, then call fx.render(renderer,scene,camera) once.
// REQUIRED: fx.render replaces renderer.render and includes every Anime Flame Flow in this scene.
// REQUIRED render uses hardware depth in the base/emission mesh passes and authored glow; there is no separate depth prepass. Other glow families / custom postprocessing are not composed automatically.
// Three controls: color, size and speed. Translation, rotation and positive uniform scale are supported.
// Fixed local nozzle, sphere and cube layout; +Y up. setAim(targetWorld) selects the nearest positive ray hit; a miss advances up to 10 local units and disperses within 1 visual second per birth.
// setAim accepts a world-space Vector3 or finite {x,y,z}, converted through parent/group transforms and size; call after changing those transforms or size.
// Default aim is the sphere. Instanced solid fire blobs (WebGL2) widen into free fire, cool into smoke and wrap thick fire around the front/sides of a hit prop. The back may remain exposed.
// Bounded material history: at most 384 records, a 64-slot GPU birth ring written only at spawn, 2 visual seconds, no 3D density texture and no ray marching. No gas simulation.
// 7 retained VFX roles plus 2 ordinary neutral solid props. Removed slots 2,6,8,9,10,12,13 are empty. No contact flash, secondary particles or pressure waves.
// Start 0.25 visual seconds, sustain until stop(), then a 2-second tail. stop prevents new births; in-flight material may reach its original target.
// New aim affects future births. Existing material retains root-local birth state and target; aiming after stop does not move the tail or ignite a new target.
// One base pass, one emission pass and a three-scale glow composite are shared per renderer/scene. Cooled smoke emits no glow but still absorbs fire behind it; neutral props are non-emissive.
// Perspective and orthographic cameras are supported; solid fire and cold smoke write hardware depth; idle/hidden instances skip postprocessing.
// reset preserves aim, settings and transform; dispose releases owned resources. No pointer/DOM handlers, automatic loop, camera, terrain, damage or arbitrary-mesh collision solver.
// Seven visual roles retain indices 0,1,3,5,7,11,14; prop index 4. setLayer(-1) restores all; removed indices stay empty.
import * as THREE from "three";
var __vfxModule = (function(exports, three) {

Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region \0rolldown/runtime.js
	var __create = Object.create;
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __getProtoOf = Object.getPrototypeOf;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) {
					__defProp(to, key, {
						get: ((k) => from[k]).bind(null, key),
						enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
					});
				}
			}
		}
		return to;
	};
	var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
		value: mod,
		enumerable: true
	}) : target, mod));

//#endregion
three = __toESM(three, 1);

//#region src/effects/anime-flame-shield-runtime.js
	const AF_START = .25;
	const AF_END = 2;
	const AF_RATE = 24;
	const AF_CAPACITY = 384;
	const AF_GPU = 64;
	const AF_SPEED = 12;
	const AF_PIPELINES = /* @__PURE__ */ new WeakMap();
	const AF_OWNERS = /* @__PURE__ */ new WeakMap();
	const afClamp = (x, a, b) => Math.min(b, Math.max(a, x));
	const afSmooth = (a, b, x) => {
		const f = afClamp((x - a) / (b - a), 0, 1);
		return f * f * (3 - 2 * f);
	};
	const AF_COMMON = `uniform float uTime,uBloom;uniform vec3 uFire;
float sat(float x){return clamp(x,0.,1.);}float sm(float a,float b,float x){float f=sat((x-a)/(b-a));return f*f*(3.-2.*f);}
float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
	const AF_PALETTE = `
vec3 flameColor(float heat,float shade,float tone,out vec3 fireOut,out float emit){
	float fold=shade*.55+tone*.45;
	vec3 smokeColor=mix(vec3(.024,.030,.043),vec3(.13,.15,.185),shade);
	vec3 darkFire=uFire*vec3(.31,.13,.09),midFire=uFire*.78,lightFire=mix(uFire,vec3(1.,.65,.16),.70)*1.25;
	vec3 fire=mix(darkFire,midFire,sm(.43,.47,fold));
	fire=mix(fire,lightFire,sm(.72,.76,fold));
	fire=mix(fire,mix(uFire,vec3(1.,.80,.34),.86)*1.65,sm(.78,.88,tone)*sm(.72,.97,heat));
	fireOut=fire;emit=sm(.22,.70,heat);
	return mix(smokeColor,fire,sm(.13,.47,heat));
}
float toonShade(vec3 n){float l=dot(normalize(n),normalize(vec3(-.42,.82,.53)))*.5+.5;return .28+sm(.35,.40,l)*.35+sm(.70,.75,l)*.37;}
float toneAt(vec3 p){return clamp((noise3(p*2.3+vec3(0.,-uTime*.6,0.))*.7+noise3(p*4.9)*.3-.25)*1.7,0.,1.);}
`;
	const AF_RECORD = `
uniform vec3 uSource;uniform vec3 uTarget[2];
attribute vec4 aA,aDir,aSide,aPoint,aNormal,aSurf;
struct Rec{vec3 pos;float radius,heat,age;bool live,arrived;};
Rec evalRec(){
	Rec r;r.pos=vec3(0.);r.radius=0.;r.heat=1.;r.age=uTime-aA.x;r.live=false;r.arrived=false;
	if(aA.x<-50.||r.age<0.||r.age>=2.)return r;
	float age=r.age,delay=aA.y,phase=aA.z*6.2831853,after=age-delay;
	int ti=int(floor(aA.w+.5));
	vec3 dir=aDir.xyz,side=aSide.xyz,up=cross(dir,side);
	r.live=true;
	if(ti<0){
		// Empty fire never parks at the range limit: drift and erosion end together.
		if(age>=1.){r.live=false;return r;}
		float late=max(0.,age-.55),distance=age*12.-(2./(.45*.45))*late*late;
		float fan=sm(.55,1.,age),roll=aA.x*6.7-age*4.5,spread=.035+.07*distance;
		vec3 p=uSource+dir*distance;
		p+=side*(sin(roll)*spread+cos(phase)*fan*.55)+up*(cos(roll*.83)*spread*.65+sin(phase)*fan*.35);
		p+=(vec3(0.,1.,0.)-dir*dir.y)*fan*.45;
		r.radius=(.30+.085*distance)*max(.72,.94+.22*sin(aA.x*8.3-age*3.)+.12*sin(aA.x*13.+age*3.))*mix(1.,.55,fan);
		r.heat=1.-sm(.55,.95,age);
		r.pos=p;
	}else if(after<0.){
		float distance=min(10.,age*12.),roll=aA.x*6.7-age*4.5,tail=max(0.,age-.92);
		vec3 p=uSource+dir*distance;
		float spread=.035+.07*distance;
		p+=side*(sin(roll)*spread+cos(phase)*tail*.8)+up*(cos(roll*.83)*spread*.65+sin(phase)*tail*.5);
		p.y+=tail*tail*.35;
		r.radius=(.30+.085*distance)*max(.72,.94+.22*sin(aA.x*8.3-age*3.)+.12*sin(aA.x*13.+age*3.));
		r.heat=1.-sm(.48,1.25,age);
		r.pos=p;
	}else{
		r.arrived=true;
		vec3 center=uTarget[ti],normal=aNormal.xyz,surfUp=cross(normal,aSurf.xyz);
		// Distribute births around the full contact tangent plane, including top/bottom.
		// The golden-angle birth phase and different ages prevent a synchronized bead ring.
		vec3 sc=normalize(aSurf.xyz*cos(phase)+surfUp*sin(phase)),p;
		if(ti==0){
			float arc=min(1.9,after*3.7);
			vec3 s2=normal*cos(arc)+sc*sin(arc);
			p=center+s2*(1.24+.32*sm(0.,.38,after)+max(0.,after-.65)*.8);
		}else{
			p=aPoint.xyz+normal*.28;
			vec3 s2=normal,s3=sc;
			float remaining=after*3.3;
			for(int fold=0;fold<4;fold++){
				if(remaining<=1e-6)break;
				float stepLength=remaining;int axis=-1;
				for(int k=0;k<3;k++){
					if(abs(s2[k])>.5||abs(s3[k])<1e-8)continue;
					float v=s3[k],edge=((v>0.?1.48:-1.48)-(p[k]-center[k]))/v;
					if(edge>=-1e-7&&edge<stepLength){stepLength=max(0.,edge);axis=k;}
				}
				p+=s3*stepLength;remaining-=stepLength;
				if(axis<0)break;
				float sgn=sign(s3[axis]),across=abs(s3[axis]);
				s3[axis]=0.;s3=normalize(s3-s2*across);
				s2=vec3(0.);s2[axis]=sgn;
				p[axis]=center[axis]+sgn*1.48;
			}
			p+=s2*max(0.,after-.65)*.8;
		}
		float downstream=max(0.,after-.25);
		p+=dir*downstream*2.8;p.y+=after*after*.22;
		r.radius=(.32+.6*sm(0.,.65,after)+.12*after)*(.91+.15*sin(phase+after*6.));
		float coolEnd=min(1.48,2.-delay-.25);
		r.heat=1.-sm(min(.4,coolEnd*.3),coolEnd,after);
		r.pos=p;
	}
	return r;
}
`;
	function createAnimeFlameShieldEffect(preset = {}, options = {}) {
		const group = new three.Group(), root = new three.Group();
		group.name = preset.id || "anime-flame-shield";
		root.name = "flame-flow-local-space";
		group.add(root);
		const names = [
			"flame-jet",
			"nozzle-spiral",
			"reserved",
			"surface-flow",
			"collision-props",
			"contact-heat",
			"reserved",
			"surface-fire-envelope",
			"reserved",
			"reserved",
			"reserved",
			"rolling-smoke",
			"reserved",
			"reserved",
			"soot-residue"
		];
		const layers = names.map((name) => {
			const layer = new three.Group();
			layer.name = name;
			root.add(layer);
			return layer;
		});
		const layerVisibility = names.map(() => true);
		const settings = {
			color: /^#[0-9a-f]{6}$/i.test(preset.color || "") ? preset.color : "#ff761f",
			size: 1,
			speed: 1
		};
		const uniforms = {
			uTime: { value: 0 },
			uBloom: { value: 0 },
			uFire: { value: new three.Color(settings.color) }
		};
		const geometries = /* @__PURE__ */ new Set(), materials = /* @__PURE__ */ new Set(), textures = /* @__PURE__ */ new Set(), pipelines = /* @__PURE__ */ new Set();
		const source = new three.Vector3(-3.6, 1.65, 0), aim = new three.Vector3(.65, 1.65, 0), direction = new three.Vector3(1, 0, 0);
		const aimSide = new three.Vector3(0, 0, 1), aimUp = new three.Vector3(0, -1, 0);
		const scratch = new three.Vector3(), scratch2 = new three.Vector3(), scratch3 = new three.Vector3(), turn = new three.Quaternion();
		const ray = new three.Ray(source, direction), sphere = new three.Sphere(new three.Vector3(.65, 1.65, 0), 1.2), box = new three.Box3(new three.Vector3(3, .45, -4.7), new three.Vector3(5.4, 2.85, -2.3));
		let elapsed = 0, stopAt = Infinity, disposed = false, solo = -1, nextBirth = 0, nextRecord = 0, serial = 0, generation = 1, hit = null, contactArrivalCount = 0, lastContactAt = -100, birthWrites = 0;
		const ownGeometry = (g) => {
			geometries.add(g);
			return g;
		};
		function material(vertexShader, fragmentShader, extra = {}) {
			const m = new three.ShaderMaterial({
				uniforms: { ...uniforms },
				vertexShader: AF_COMMON + vertexShader,
				fragmentShader: AF_COMMON + fragmentShader,
				side: three.DoubleSide,
				forceSinglePass: true,
				toneMapped: false,
				...extra
			});
			materials.add(m);
			return m;
		}
		function mesh(layer, geometry, shader) {
			const object = new three.Mesh(geometry, shader);
			object.name = names[layer];
			object.userData.animeFlameLayer = layer;
			object.frustumCulled = false;
			layers[layer].add(object);
			return object;
		}
		const targets = [{
			id: "sphere",
			center: sphere.center,
			shape: 0
		}, {
			id: "cube",
			center: new three.Vector3(4.2, 1.65, -3.5),
			shape: 1
		}].map((t) => Object.assign(t, {
			exposure: 0,
			lastArrival: -100,
			firstArrival: -100,
			arrivedGeneration: -1,
			impact: new three.Vector3(),
			normal: new three.Vector3(-1, 0, 0),
			incoming: new three.Vector3(1, 0, 0),
			frameNormal: new three.Vector3(-1, 0, 0),
			frameSide: new three.Vector3(0, 0, 1),
			frameUp: new three.Vector3(0, 1, 0)
		}));
		const surfaceVertex = `varying vec3 vP,vN;void main(){vP=position;vN=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
		const surfaceFragment = `varying vec3 vP,vN;void main(){float l=max(0.,dot(normalize(vN),normalize(vec3(-.42,.82,.53))));vec3 c=vec3(.12,.125,.13)+vec3(.27,.275,.28)*l;if(uBloom>.5)c=vec3(0.);gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`;
		for (const target of targets) {
			target.geometry = ownGeometry(target.shape ? new three.BoxGeometry(2.4, 2.4, 2.4) : new three.SphereGeometry(1.2, 48, 32));
			target.mesh = mesh(4, target.geometry, material(surfaceVertex, surfaceFragment, { side: three.FrontSide }));
			target.mesh.position.copy(target.center);
			target.mesh.userData.flameTargetId = target.id;
			target.mesh.userData.isCollisionProp = true;
			target.uniforms = {
				tImpact: { value: new three.Vector3() },
				tHeat: { value: 0 },
				tSoot: { value: 0 }
			};
			for (const layer of [5, 14]) {
				const shader = material(`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*.006,1.);}`, `uniform vec3 tImpact;uniform float tHeat,tSoot;varying vec3 vP;void main(){float local=1.-sm(.35,1.65,length(vP-tImpact));float grain=noise3(vP*7.4);float alpha=local*${layer === 5 ? "tHeat*.28" : "tSoot*sm(.27,.61,grain)*.68"};if(alpha<.003)discard;vec3 c=${layer === 5 ? "uFire*.3" : "vec3(.018,.015,.014)"};if(uBloom>.5)c=vec3(0.);gl_FragColor=vec4(c,alpha);
#include <colorspace_fragment>
}`, {
					transparent: true,
					depthWrite: false,
					side: three.FrontSide
				});
				Object.assign(shader.uniforms, target.uniforms);
				const mark = mesh(layer, target.geometry, shader);
				mark.position.copy(target.center);
				mark.renderOrder = layer === 5 ? 1 : 2;
				target[layer === 5 ? "heatMark" : "sootMark"] = mark;
			}
		}
		function intersectAim() {
			let closest = null;
			for (let i = 0; i < targets.length; i++) {
				const point = i ? ray.intersectBox(box, scratch) : ray.intersectSphere(sphere, scratch);
				if (!point) continue;
				const distance = source.distanceTo(point);
				if (distance < 1e-5 || distance > 10 || closest && distance >= closest.distance) continue;
				scratch2.copy(point).sub(targets[i].center);
				if (i) {
					const ax = Math.abs(scratch2.x), ay = Math.abs(scratch2.y), az = Math.abs(scratch2.z), axis = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2, sign = Math.sign(scratch2.getComponent(axis));
					scratch2.set(0, 0, 0).setComponent(axis, sign);
				} else scratch2.normalize();
				closest = {
					index: i,
					target: targets[i],
					distance,
					point: point.clone(),
					normal: scratch2.clone()
				};
			}
			return closest;
		}
		function aimLocal(point) {
			scratch.copy(point).sub(source);
			if (scratch.lengthSq() < 1e-10) return;
			scratch.normalize();
			const oldTarget = hit?.index ?? -1, angle = direction.dot(scratch);
			turn.setFromUnitVectors(direction, scratch);
			aimSide.applyQuaternion(turn).addScaledVector(scratch, -aimSide.dot(scratch)).normalize();
			direction.copy(scratch);
			aimUp.crossVectors(direction, aimSide).normalize();
			aim.copy(point);
			hit = intersectAim();
			if (oldTarget !== (hit?.index ?? -1) || angle < .94) generation++;
		}
		hit = intersectAim();
		const records = Array.from({ length: AF_CAPACITY }, () => ({
			id: -1,
			birth: -100,
			generation: -1,
			targetIndex: -1,
			distance: 10,
			delay: 10 / AF_SPEED,
			seed: 0,
			arrived: false,
			direction: new three.Vector3(),
			side: new three.Vector3(),
			up: new three.Vector3(),
			point: new three.Vector3(),
			normal: new three.Vector3(),
			surfaceSide: new three.Vector3(),
			surfaceUp: new three.Vector3(),
			position: new three.Vector3(),
			velocity: new three.Vector3(),
			heat: 0,
			radius: 0,
			opacity: 0,
			kind: 0,
			age: -1
		}));
		const pendingEvents = [], eventStorage = Array.from({ length: AF_CAPACITY }, () => ({
			time: 0,
			record: null
		}));
		const freeEvents = eventStorage.slice();
		let eventsProcessed = 0;
		const eventBefore = (a, b) => a.time < b.time || a.time === b.time && a.record.id < b.record.id;
		function queueEvent(time, record) {
			const event = freeEvents.pop();
			if (!event) throw new Error("Flame event capacity exceeded");
			event.time = time;
			event.record = record;
			let i = pendingEvents.length;
			pendingEvents.push(event);
			while (i > 0) {
				const parent = i - 1 >> 1;
				if (!eventBefore(event, pendingEvents[parent])) break;
				pendingEvents[i] = pendingEvents[parent];
				i = parent;
			}
			pendingEvents[i] = event;
		}
		function popEvent() {
			const first = pendingEvents[0], last = pendingEvents.pop();
			if (pendingEvents.length) {
				let i = 0;
				while (i * 2 + 1 < pendingEvents.length) {
					let child = i * 2 + 1;
					if (child + 1 < pendingEvents.length && eventBefore(pendingEvents[child + 1], pendingEvents[child])) child++;
					if (!eventBefore(pendingEvents[child], last)) break;
					pendingEvents[i] = pendingEvents[child];
					i = child;
				}
				pendingEvents[i] = last;
			}
			return first;
		}
		const ring = {
			a: /* @__PURE__ */ new Float32Array(256),
			dir: /* @__PURE__ */ new Float32Array(256),
			side: /* @__PURE__ */ new Float32Array(256),
			point: /* @__PURE__ */ new Float32Array(256),
			normal: /* @__PURE__ */ new Float32Array(256),
			surf: /* @__PURE__ */ new Float32Array(256),
			dirty: false
		};
		function clearRing() {
			for (const key of [
				"a",
				"dir",
				"side",
				"point",
				"normal",
				"surf"
			]) ring[key].fill(0);
			for (let i = 0; i < AF_GPU; i++) ring.a[i * 4] = -100;
			ring.dirty = true;
		}
		clearRing();
		const blobGeometry = ownGeometry(new three.InstancedBufferGeometry());
		{
			const unit = new three.SphereGeometry(1, 24, 18);
			blobGeometry.index = unit.index;
			for (const [key, attribute] of Object.entries(unit.attributes)) blobGeometry.setAttribute(key, attribute);
			unit.dispose();
			for (const [key, array] of [
				["aA", ring.a],
				["aDir", ring.dir],
				["aSide", ring.side],
				["aPoint", ring.point],
				["aNormal", ring.normal],
				["aSurf", ring.surf]
			]) blobGeometry.setAttribute(key, new three.InstancedBufferAttribute(array, 4).setUsage(three.DynamicDrawUsage));
			blobGeometry.instanceCount = AF_GPU;
		}
		function emit(birth) {
			const r = records[nextRecord++ % AF_CAPACITY];
			r.id = serial++;
			r.birth = birth;
			r.generation = generation;
			r.targetIndex = hit?.index ?? -1;
			r.distance = hit?.distance ?? 10;
			r.delay = r.distance / AF_SPEED;
			r.seed = r.id * .61803398875 % 1;
			r.arrived = false;
			r.direction.copy(direction);
			r.side.copy(aimSide);
			r.up.copy(aimUp);
			if (hit) {
				r.point.copy(hit.point);
				r.normal.copy(hit.normal);
				const t = targets[hit.index];
				turn.setFromUnitVectors(t.frameNormal, hit.normal);
				t.frameSide.applyQuaternion(turn).addScaledVector(hit.normal, -t.frameSide.dot(hit.normal)).normalize();
				t.frameUp.crossVectors(hit.normal, t.frameSide).normalize();
				t.frameNormal.copy(hit.normal);
				r.surfaceSide.copy(t.frameSide);
				r.surfaceUp.copy(t.frameUp);
			}
			const o = r.id % AF_GPU * 4;
			ring.a[o] = birth;
			ring.a[o + 1] = r.delay;
			ring.a[o + 2] = r.seed;
			ring.a[o + 3] = r.targetIndex;
			for (const [key, vector, on] of [
				[
					"dir",
					r.direction,
					true
				],
				[
					"side",
					r.side,
					true
				],
				[
					"point",
					r.point,
					!!hit
				],
				[
					"normal",
					r.normal,
					!!hit
				],
				[
					"surf",
					r.surfaceSide,
					!!hit
				]
			]) {
				ring[key][o] = on ? vector.x : 0;
				ring[key][o + 1] = on ? vector.y : 0;
				ring[key][o + 2] = on ? vector.z : 0;
			}
			ring.dirty = true;
			birthWrites++;
			for (const key of [
				"aA",
				"aDir",
				"aSide",
				"aPoint",
				"aNormal",
				"aSurf"
			]) blobGeometry.attributes[key].addUpdateRange(o, 4);
			if (r.targetIndex >= 0) queueEvent(birth + r.delay, r);
		}
		function arrive(r) {
			r.arrived = true;
			const t = targets[r.targetIndex], at = r.birth + r.delay;
			t.exposure += 1 / AF_RATE;
			if (at >= t.lastArrival) {
				if (at - t.lastArrival > .35) t.firstArrival = at;
				t.lastArrival = at;
				t.impact.copy(r.point);
				t.normal.copy(r.normal);
				t.incoming.copy(r.direction);
				t.uniforms.tImpact.value.copy(r.point).sub(t.center);
			}
			if (r.generation > t.arrivedGeneration) {
				t.arrivedGeneration = r.generation;
				contactArrivalCount++;
				if (at >= lastContactAt) lastContactAt = at;
			}
		}
		function evaluateRecord(r, time) {
			const age = time - r.birth;
			r.age = age;
			if (age < 0 || age >= (r.targetIndex < 0 ? 1 : AF_END)) {
				r.opacity = 0;
				return false;
			}
			const after = age - r.delay, phase = r.seed * Math.PI * 2, p = r.position;
			if (r.targetIndex < 0) {
				const late = Math.max(0, age - .55), deceleration = 2 / .2025;
				const distance = age * AF_SPEED - deceleration * late * late, forwardSpeed = AF_SPEED - 2 * deceleration * late;
				const fan = afSmooth(.55, 1, age), fraction = afClamp((age - .55) / .45, 0, 1), fanSpeed = 6 * fraction * (1 - fraction) / .45;
				const roll = r.birth * 6.7 - age * 4.5, spread = .035 + .07 * distance, spreadSpeed = .07 * forwardSpeed;
				p.copy(source).addScaledVector(r.direction, distance);
				p.addScaledVector(r.side, Math.sin(roll) * spread + Math.cos(phase) * fan * .55).addScaledVector(r.up, Math.cos(roll * .83) * spread * .65 + Math.sin(phase) * fan * .35);
				scratch.set(0, 1, 0).addScaledVector(r.direction, -r.direction.y);
				p.addScaledVector(scratch, fan * .45);
				r.velocity.copy(r.direction).multiplyScalar(forwardSpeed);
				r.velocity.addScaledVector(r.side, -4.5 * Math.cos(roll) * spread + Math.sin(roll) * spreadSpeed + Math.cos(phase) * fanSpeed * .55);
				r.velocity.addScaledVector(r.up, 3.735 * Math.sin(roll * .83) * spread * .65 + Math.cos(roll * .83) * spreadSpeed * .65 + Math.sin(phase) * fanSpeed * .35).addScaledVector(scratch, fanSpeed * .45);
				r.radius = (.3 + .085 * distance) * Math.max(.72, .94 + .22 * Math.sin(r.birth * 8.3 - age * 3) + .12 * Math.sin(r.birth * 13 + age * 3)) * (1 - .45 * fan);
				r.heat = 1 - afSmooth(.55, .95, age);
				r.kind = r.heat < .14 ? 11 : 0;
			} else if (after < 0) {
				const distance = Math.min(10, age * AF_SPEED), roll = r.birth * 6.7 - age * 4.5, tail = Math.max(0, age - .92);
				p.copy(source).addScaledVector(r.direction, distance);
				const spread = .035 + .07 * distance;
				p.addScaledVector(r.side, Math.sin(roll) * spread + Math.cos(phase) * tail * .8).addScaledVector(r.up, Math.cos(roll * .83) * spread * .65 + Math.sin(phase) * tail * .5);
				p.y += tail * tail * .35;
				r.velocity.copy(r.direction).multiplyScalar(age < 10 / AF_SPEED ? AF_SPEED : 0);
				r.velocity.y += tail * .7;
				r.radius = (.3 + .085 * distance) * Math.max(.72, .94 + .22 * Math.sin(r.birth * 8.3 - age * 3) + .12 * Math.sin(r.birth * 13 + age * 3));
				r.heat = 1 - afSmooth(.48, 1.25, age);
				r.kind = r.heat < .14 ? 11 : 0;
			} else {
				const t = targets[r.targetIndex];
				scratch.copy(r.surfaceSide).multiplyScalar(Math.cos(phase)).addScaledVector(r.surfaceUp, Math.sin(phase)).normalize();
				if (!t.shape) {
					const arc = Math.min(1.9, after * 3.7);
					scratch2.copy(r.normal).multiplyScalar(Math.cos(arc)).addScaledVector(scratch, Math.sin(arc));
					p.copy(t.center).addScaledVector(scratch2, 1.24 + .32 * afSmooth(0, .38, after) + Math.max(0, after - .65) * .8);
					r.velocity.copy(scratch).multiplyScalar(1.6).addScaledVector(scratch2, .7);
				} else {
					p.copy(r.point).addScaledVector(r.normal, .28);
					scratch2.copy(r.normal);
					scratch3.copy(scratch);
					let remaining = after * 3.3;
					for (let fold = 0; fold < 4 && remaining > 1e-6; fold++) {
						let step = remaining, axis = -1;
						for (let k = 0; k < 3; k++) {
							if (Math.abs(scratch2.getComponent(k)) > .5 || Math.abs(scratch3.getComponent(k)) < 1e-8) continue;
							const v = scratch3.getComponent(k), edge = ((v > 0 ? 1.48 : -1.48) - (p.getComponent(k) - t.center.getComponent(k))) / v;
							if (edge >= -1e-7 && edge < step) {
								step = Math.max(0, edge);
								axis = k;
							}
						}
						p.addScaledVector(scratch3, step);
						remaining -= step;
						if (axis < 0) break;
						const sign = Math.sign(scratch3.getComponent(axis)), across = Math.abs(scratch3.getComponent(axis));
						scratch3.setComponent(axis, 0).addScaledVector(scratch2, -across).normalize();
						scratch2.set(0, 0, 0).setComponent(axis, sign);
						p.setComponent(axis, t.center.getComponent(axis) + sign * 1.48);
					}
					p.addScaledVector(scratch2, Math.max(0, after - .65) * .8);
					r.velocity.copy(scratch3).multiplyScalar(1.6).addScaledVector(scratch2, .7);
				}
				const downstream = Math.max(0, after - .25);
				p.addScaledVector(r.direction, downstream * 2.8);
				p.y += after * after * .22;
				r.velocity.addScaledVector(r.direction, 2.8);
				r.velocity.y += after * .44;
				r.radius = (.32 + .6 * afSmooth(0, .65, after) + .12 * after) * (.91 + .15 * Math.sin(phase + after * 6));
				const coolEnd = Math.min(1.48, AF_END - r.delay - .25);
				r.heat = 1 - afSmooth(Math.min(.4, coolEnd * .3), coolEnd, after);
				r.kind = r.heat < .14 ? 11 : 3;
			}
			r.opacity = (1 - (r.targetIndex < 0 ? afSmooth(.65, 1, age) : afSmooth(1.25, 2, age))) * (.48 + .52 * afSmooth(.04, .25, r.heat));
			return true;
		}
		const blobVertex = `${AF_RECORD}
uniform float uMode;
varying vec3 vWP,vN;varying float vHeat,vErode,vSeed;
vec3 gC;float gR,gStretch;vec3 gDir;
vec3 outsideProps(vec3 p){
	vec3 s=p-uTarget[0];float d=length(s);
	if(d<1.215)p=uTarget[0]+s/max(d,.00001)*1.215;
	vec3 q=p-uTarget[1],a=abs(q);
	if(max(a.x,max(a.y,a.z))<1.215){
		if(a.x>=a.y&&a.x>=a.z)q.x=(q.x<0.?-1.:1.)*1.215;
		else if(a.y>=a.z)q.y=(q.y<0.?-1.:1.)*1.215;
		else q.z=(q.z<0.?-1.:1.)*1.215;
		p=uTarget[1]+q;
	}
	return p;
}
vec3 shapeAt(vec3 u){
	vec3 wp=gC+u*gR;
	float n1=noise3(wp*2.3+vec3(0.,-uTime*.55,0.));
	float n2=noise3(wp*3.7-vec3(uTime*.3)+vec3(3.1));
	float c=sin(wp.x*3.1+uTime*1.3)*sin(wp.y*2.8-uTime*1.1)*sin(wp.z*3.2+uTime*.9);
	vec3 q=u*(1.+(n1-.5)*.55+(n2-.5)*.18+c*.14);
	q+=gDir*dot(q,gDir)*gStretch;
	return outsideProps(gC+q*gR)-gC;
}
void main(){
	Rec r=evalRec();
	bool cold=r.heat<.14;
	bool pass=r.live&&(uMode<0.|| (uMode<1.?(!cold&&!r.arrived):uMode<5.?(!cold&&r.arrived):cold));
	if(!pass){gl_Position=vec4(2.,2.,2.,1.);vWP=vec3(0.);vN=vec3(0.,1.,0.);vHeat=0.;vErode=1.;vSeed=0.;return;}
	gC=r.pos;gR=r.radius;gDir=aDir.xyz;gStretch=r.arrived?0.:(aA.w<-.5?mix(1.1,.1,sm(.55,1.,r.age)):1.1);
	vec3 u=normalize(position);
	vec3 t1=normalize(cross(u,abs(u.y)>.98?vec3(1.,0.,0.):vec3(0.,1.,0.))),t2=cross(u,t1);
	vec3 o=shapeAt(u),dx=shapeAt(normalize(u+t1*.05))-o,dy=shapeAt(normalize(u+t2*.05))-o;
	vec3 p=gC+o;
	vN=normalize(cross(dx,dy));vWP=p;vHeat=r.heat;vErode=aA.w<-.5?sm(.65,1.,r.age):sm(1.25,2.,r.age);vSeed=aA.z;
	gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
		const blobFragment = `${AF_PALETTE}
uniform vec3 uTarget[2];
varying vec3 vWP,vN;varying float vHeat,vErode,vSeed;
void main(){
	if(length(vWP-uTarget[0])<1.202)discard;
	vec3 boxDistance=abs(vWP-uTarget[1])-vec3(1.202);
	if(max(boxDistance.x,max(boxDistance.y,boxDistance.z))<0.)discard;
	float n=noise3(vWP*2.8+vec3(vSeed*9.));
	if(n<vErode*1.1)discard;
	vec3 fire;float emit;
	vec3 color=flameColor(vHeat,toonShade(vN),toneAt(vWP),fire,emit);
	if(uBloom>.5)color=fire*emit*.72;
	gl_FragColor=vec4(color,1.);
#include <colorspace_fragment>
}`;
		const blobModes = [
			[0, 0],
			[3, 3],
			[11, 11]
		];
		const blobMeshes = [];
		for (const [layer, mode] of blobModes) {
			const shader = material(blobVertex, blobFragment, { side: three.FrontSide });
			Object.assign(shader.uniforms, {
				uMode: { value: mode },
				uSource: { value: source },
				uTarget: { value: [targets[0].center, targets[1].center] }
			});
			blobMeshes.push(mesh(layer, blobGeometry, shader));
		}
		const envelopeVertex = `uniform float tShape,tActive,tOpening,tCool,uEnvMode;uniform vec3 tImpact,tIncoming,tNormal;
varying vec3 vP,vN;varying float vCover,vHeat,vShow,vOther;
void main(){
	vec3 p=position;
	vec3 n=tShape<.5?normalize(p):normal;
	float cover;
	// Continuous backing reaches around the sides to bridge the separated rolling lobes.
	// Only the downstream cap and the receding outer edge remain open.
	if(tShape<.5){float facing=dot(normalize(p),tNormal);cover=sm(.8-tOpening*1.72,1.-tOpening*1.65,facing);}
	else{float along=dot(p-tImpact,tIncoming),radial=length(p-tImpact);cover=(1.-sm(1.7,2.6,along))*(1.-sm(.45+tOpening*2.9,.8+tOpening*3.2,radial));}
	float lift=max(0.,tCool-.25);lift=lift*lift*.3;
	float rolling=sin(p.x*2.3+p.y*3.1-uTime*3.4+sin(p.z*3.))*sin(p.z*2.7-p.y*1.8+uTime*2.6);
float thickness=(.26+pow(.5+rolling*.5,2.)*.36+.08*(.5+.5*sin(p.y*5.+p.z*2.-uTime*4.)))*(.7+tOpening*.3);
	float strength=cover*tActive;
	float heat=(1.-sm(.12,.95,tCool))*(.72+.17*rolling);
	vCover=strength;vHeat=heat;vShow=uEnvMode<.5?step(.14,heat):step(heat,.1399);
	vOther=uEnvMode<0.?step(heat,.1399):0.;
	// Keep the box coating attached where coverage ends; sphere shaping stays unchanged.
	float attachment=tShape<.5?sm(.02,.5,strength):sm(.03,1.,strength);
	vec3 out_=p+n*thickness*attachment+vec3(0.,lift,0.);
	vP=out_;vN=n;
	gl_Position=projectionMatrix*modelViewMatrix*vec4(out_,1.);
}`;
		const envelopeFragment = `${AF_PALETTE}
uniform float tShape,tCool;
varying vec3 vP,vN;varying float vCover,vHeat,vShow,vOther;
void main(){
	if(max(vShow,vOther)<.5||vCover<.03)discard;
	// The live box coating is continuous. Erosion starts when its fuel cools away.
	float erosion=tShape<.5?1.:sm(.14,.60,tCool);
	if(vCover*1.35<noise3(vP*3.1)*.9*erosion)discard;
	vec3 fire;float emit;
	vec3 color=flameColor(vHeat,toonShade(vN),toneAt(vP+vec3(2.7)),fire,emit);
	if(uBloom>.5)color=fire*emit*.72;
	gl_FragColor=vec4(color,1.);
#include <colorspace_fragment>
}`;
		for (const target of targets) {
			target.envelope = {
				tShape: { value: target.shape },
				tActive: { value: 0 },
				tOpening: { value: 0 },
				tCool: { value: 0 },
				tNormal: { value: new three.Vector3(-1, 0, 0) },
				tIncoming: { value: new three.Vector3(1, 0, 0) },
				tImpact: target.uniforms.tImpact
			};
			const shell = ownGeometry(target.shape ? new three.BoxGeometry(2.4, 2.4, 2.4, 10, 10, 10) : new three.SphereGeometry(1.2, 40, 28));
			if (target.shape) {
				const positions = shell.attributes.position, normals = shell.attributes.normal;
				for (let i = 0; i < positions.count; i++) {
					scratch.fromBufferAttribute(positions, i);
					scratch.set(Math.sign(scratch.x) * (Math.abs(scratch.x) / 1.2) ** 4, Math.sign(scratch.y) * (Math.abs(scratch.y) / 1.2) ** 4, Math.sign(scratch.z) * (Math.abs(scratch.z) / 1.2) ** 4).normalize();
					normals.setXYZ(i, scratch.x, scratch.y, scratch.z);
				}
			}
			target.shells = [[7, 0], [11, 1]].map(([layer, mode]) => {
				const shader = material(envelopeVertex, envelopeFragment, { side: three.FrontSide });
				Object.assign(shader.uniforms, target.envelope, { uEnvMode: { value: mode } });
				const object = mesh(layer, shell, shader);
				object.position.copy(target.center);
				object.visible = false;
				return object;
			});
		}
		function ribbonGeometry(count, sections) {
			const geometry = ownGeometry(new three.BufferGeometry()), total = count * (sections + 1) * 2, rib = new Float32Array(total * 3), indices = [];
			for (let b = 0; b < count; b++) for (let j = 0; j <= sections; j++) {
				const offset = b * (sections + 1) * 2 + j * 2;
				for (let k = 0; k < 2; k++) rib.set([
					j / sections,
					b,
					k
				], (offset + k) * 3);
				if (j < sections) indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
			}
			geometry.setAttribute("position", new three.BufferAttribute(new Float32Array(total * 3), 3));
			geometry.setAttribute("aRib", new three.BufferAttribute(rib, 3));
			geometry.setIndex(indices);
			return geometry;
		}
		const ribbonFragment = `varying vec2 vUv;varying float vLife;void main(){float a=(1.-sm(.07,.5,abs(vUv.y-.5)))*sin(vUv.x*3.14159)*vLife;if(a<.004)discard;gl_FragColor=vec4(mix(uFire,vec3(1.,.83,.36),.7)*1.5,a);
#include <colorspace_fragment>
}`;
		function ribbon(layer, count, sections, body, extra) {
			const shader = material(`uniform float rLife;${Object.keys(extra).map((k) => "uniform vec3 " + k + ";").join("")}attribute vec3 aRib;varying vec2 vUv;varying float vLife;void main(){float f=aRib.x,b=aRib.y,k=aRib.z;vec3 c;${body}vUv=vec2(f,k);vLife=rLife;gl_Position=projectionMatrix*modelViewMatrix*vec4(c,1.);}`, ribbonFragment, {
				transparent: true,
				depthWrite: false,
				blending: three.AdditiveBlending
			});
			shader.uniforms.rLife = { value: 0 };
			Object.assign(shader.uniforms, extra);
			mesh(layer, ribbonGeometry(count, sections), shader).renderOrder = 5;
			return shader;
		}
		const nozzle = ribbon(1, 3, 24, "float angle=f*6.2831853+uTime*8.+b*2.0943951,rad=.23-f*.12;c=uSource+uDir*f*.7+uSide*cos(angle)*rad+uUpDir*sin(angle)*rad+uUpDir*(k-.5)*.035;", {
			uSource: { value: source },
			uDir: { value: direction },
			uSide: { value: aimSide },
			uUpDir: { value: aimUp }
		});
		function syncAppearance() {
			uniforms.uTime.value = elapsed;
			root.scale.setScalar(settings.size);
			group.visible = !disposed && elapsed < stopAt + AF_END;
			layers.forEach((layer, index) => {
				layer.visible = layerVisibility[index] && (solo < 0 || solo === index);
			});
			const mergeBlobs = solo < 0 && layerVisibility[0] && layerVisibility[3] && layerVisibility[11];
			for (let i = 0; i < blobMeshes.length; i++) {
				blobMeshes[i].visible = !mergeBlobs || i === 0;
				blobMeshes[i].material.uniforms.uMode.value = mergeBlobs && i === 0 ? -1 : blobModes[i][1];
			}
			const mergeEnvelope = solo < 0 && layerVisibility[7] && layerVisibility[11];
			for (const target of targets) {
				const cool = elapsed - target.lastArrival, active = cool >= 0 && cool < 1.45, e = target.envelope;
				for (let i = 0; i < target.shells.length; i++) {
					const shell = target.shells[i];
					shell.visible = active && (!mergeEnvelope || i === 0);
					shell.material.uniforms.uEnvMode.value = mergeEnvelope && i === 0 ? -1 : i;
				}
				if (active) {
					e.tActive.value = 1 - afSmooth(.12, 1.45, cool);
					e.tOpening.value = afSmooth(0, .25, elapsed - target.firstArrival);
					e.tCool.value = cool;
					e.tNormal.value.copy(target.normal);
					e.tIncoming.value.copy(target.incoming);
				}
				target.uniforms.tHeat.value = Math.min(1, target.exposure) * (1 - afSmooth(.35, 1.8, elapsed - target.lastArrival));
				target.uniforms.tSoot.value = Math.min(1, target.exposure / 2.8);
				target.heatMark.visible = target.uniforms.tHeat.value > 0;
				target.sootMark.visible = target.uniforms.tSoot.value > 0;
			}
			nozzle.uniforms.rLife.value = Math.max(0, afSmooth(0, .06, elapsed) * (Number.isFinite(stopAt) ? 1 - afSmooth(stopAt, stopAt + .1, elapsed) : 1));
			layers[1].children[0].visible = nozzle.uniforms.rLife.value > 0;
			if (ring.dirty) {
				for (const key of [
					"aA",
					"aDir",
					"aSide",
					"aPoint",
					"aNormal",
					"aSurf"
				]) blobGeometry.attributes[key].needsUpdate = true;
				ring.dirty = false;
			}
		}
		function setAim(world) {
			if (disposed) return;
			const a = Array.isArray(world) ? world : [
				world?.x,
				world?.y,
				world?.z
			];
			if (a.length < 3 || !a.slice(0, 3).every(Number.isFinite)) return;
			root.updateWorldMatrix(true, false);
			scratch3.set(a[0], a[1], a[2]);
			root.worldToLocal(scratch3);
			aimLocal(scratch3);
			syncAppearance();
		}
		function setOptions(next = {}) {
			if (disposed) return;
			for (const key of ["size", "speed"]) if (Number.isFinite(next[key])) settings[key] = afClamp(next[key], .25, 2);
			if (typeof next.color === "string" && /^#[0-9a-f]{6}$/i.test(next.color)) settings.color = next.color;
			uniforms.uFire.value.set(settings.color);
			syncAppearance();
		}
		function dispose() {
			if (disposed) return;
			disposed = true;
			group.visible = false;
			for (const p of pipelines) {
				p.owners.delete(api);
				if (!p.owners.size) {
					p.dispose();
					p.byScene.delete(p.scene);
				}
			}
			pipelines.clear();
			for (const geometry of geometries) geometry.dispose();
			for (const shader of materials) shader.dispose();
			for (const texture of textures) texture.dispose();
			group.removeFromParent();
			group.clear();
			AF_OWNERS.delete(api);
		}
		const api = {
			group,
			layers: names.slice(),
			lifecycle: {
				start: AF_START,
				end: AF_END
			},
			get settings() {
				return { ...settings };
			},
			get elapsed() {
				return elapsed;
			},
			get finished() {
				return disposed || elapsed >= stopAt + AF_END;
			},
			get phase() {
				return api.finished ? "finished" : Number.isFinite(stopAt) ? "ending" : elapsed < AF_START ? "starting" : "active";
			},
			get particleCount() {
				return 0;
			},
			setAim,
			setOptions,
			dispose,
			update(dt) {
				if (disposed || !Number.isFinite(dt) || dt < 0 || api.finished) return;
				const ending = stopAt + AF_END, next = elapsed + dt * settings.speed, time = Number.isFinite(ending) && next >= ending - 1e-8 ? ending : Math.min(ending, next);
				if (!Number.isFinite(time) || !Number.isSafeInteger(Math.ceil(time * AF_RATE))) return;
				if (time > elapsed) {
					const first = Math.max(nextBirth, Math.ceil((time - AF_END) * AF_RATE)), last = Math.ceil(Math.min(time, stopAt) * AF_RATE) - 1;
					for (let ordinal = first; ordinal <= last; ordinal++) {
						const at = ordinal / AF_RATE;
						if (at < 0 || at >= stopAt) continue;
						emit(at);
					}
					nextBirth = Math.max(nextBirth, last + 1);
					while (pendingEvents.length && pendingEvents[0].time <= time) {
						const event = popEvent();
						const r = event.record;
						freeEvents.push(event);
						if (time - r.birth >= AF_END) continue;
						eventsProcessed++;
						arrive(r);
					}
				}
				elapsed = time;
				Math.floor(time * AF_RATE + 1e-8);
				syncAppearance();
			},
			stop() {
				if (disposed || Number.isFinite(stopAt)) return;
				stopAt = elapsed;
				syncAppearance();
			},
			hit() {
				api.stop();
			},
			reset() {
				if (disposed) return;
				elapsed = 0;
				stopAt = Infinity;
				nextBirth = 0;
				nextRecord = 0;
				serial = 0;
				generation++;
				lastContactAt = -100;
				contactArrivalCount = 0;
				birthWrites = 0;
				eventsProcessed = 0;
				pendingEvents.length = 0;
				freeEvents.length = 0;
				freeEvents.push(...eventStorage);
				for (const r of records) {
					r.birth = -100;
					r.id = -1;
					r.opacity = 0;
					r.arrived = false;
				}
				for (const t of targets) {
					t.exposure = 0;
					t.lastArrival = t.firstArrival = -100;
					t.arrivedGeneration = -1;
					t.impact.set(0, 0, 0);
					t.normal.set(-1, 0, 0);
					t.incoming.set(1, 0, 0);
					t.frameNormal.set(-1, 0, 0);
					t.frameSide.set(0, 0, 1);
					t.frameUp.set(0, 1, 0);
					t.uniforms.tImpact.value.set(0, 0, 0);
				}
				clearRing();
				for (const key of [
					"aA",
					"aDir",
					"aSide",
					"aPoint",
					"aNormal",
					"aSurf"
				]) {
					const attribute = blobGeometry.attributes[key];
					attribute.clearUpdateRanges();
					attribute.addUpdateRange(0, attribute.array.length);
				}
				syncAppearance();
			},
			setLayer(index = -1) {
				if (!Number.isInteger(index) || index < -1 || index >= layers.length) throw new RangeError("Invalid layer index");
				solo = index;
				syncAppearance();
			},
			setLayerVisible(index, visible) {
				if (!Number.isInteger(index) || index < 0 || index >= layers.length) throw new RangeError("Invalid layer index");
				layerVisibility[index] = !!visible;
				syncAppearance();
			},
			render(renderer, scene, camera) {
				if (disposed) return;
				const effects = [];
				scene.traverseVisible((object) => {
					const effect = object.userData.animeFlameShield;
					if (!effect || effect.finished) return;
					effects.push(effect);
				});
				if (!effects.length) {
					renderer.render(scene, camera);
					return;
				}
				let byScene = AF_PIPELINES.get(renderer);
				if (!byScene) {
					byScene = /* @__PURE__ */ new WeakMap();
					AF_PIPELINES.set(renderer, byScene);
				}
				let pipeline = byScene.get(scene);
				if (!pipeline) {
					pipeline = afCreateGlow(renderer, scene, byScene);
					byScene.set(scene, pipeline);
				}
				for (const effect of effects) {
					pipeline.owners.add(effect);
					AF_OWNERS.get(effect)?.add(pipeline);
				}
				pipeline.render(scene, camera);
			}
		};
		group.userData.animeFlameShield = api;
		group.userData.layerTypes = names.filter((name, index) => name !== "reserved" && index !== 4);
		group.userData.propLayers = ["sphere", "cube"];
		group.userData.flameAimTargets = targets.map((t) => t.mesh);
		group.userData.flameAimRoot = root;
		group.userData.bounds = {
			min: [
				-4.5,
				-.8,
				-7
			],
			max: [
				8,
				7,
				4
			],
			focus: [
				1,
				2.1,
				-1.5
			],
			cardFocus: [
				-.1,
				2.05,
				0
			]
		};
		Object.defineProperty(group.userData, "flameFlowDebug", { get() {
			const born = [], smoke = [];
			for (const r of records) if (r.birth >= 0 && elapsed - r.birth < AF_END && elapsed >= r.birth) {
				if (!evaluateRecord(r, elapsed)) continue;
				const value = {
					id: r.id,
					birth: r.birth,
					generation: r.generation,
					targetId: r.targetIndex >= 0 ? targets[r.targetIndex].id : null,
					position: r.position.toArray(),
					velocity: r.velocity.toArray(),
					heat: r.heat,
					arrived: r.arrived
				};
				born.push(value);
				if (r.heat < .14) smoke.push({
					...value,
					branch: r.id % 24
				});
			}
			root.updateWorldMatrix(true, false);
			return {
				hitTarget: hit?.target.id ?? null,
				hitPoint: hit?.point.toArray() ?? null,
				worldHitPoint: hit ? root.localToWorld(hit.point.clone()).toArray() : null,
				source: source.toArray(),
				aim: aim.toArray(),
				direction: direction.toArray(),
				distance: hit?.distance ?? 10,
				generation,
				contactArrivalCount,
				lastContactAt,
				worldSource: root.localToWorld(source.clone()).toArray(),
				worldAim: root.localToWorld(aim.clone()).toArray(),
				targetExposures: Object.fromEntries(targets.map((t) => [t.id, t.exposure])),
				activeContacts: targets.filter((t) => elapsed - t.lastArrival < .35).map((t) => t.id),
				birthRecords: born,
				smoke: {
					live: smoke.length,
					capacity: AF_CAPACITY,
					samples: smoke
				},
				volume: {
					renderer: "instanced-solid-blobs",
					gpuRing: AF_GPU,
					capacity: AF_CAPACITY,
					birthWrites,
					pendingEvents: pendingEvents.length,
					eventsProcessed,
					liveRecords: born.length
				}
			};
		} });
		AF_OWNERS.set(api, pipelines);
		root.traverse((object) => {
			if (object !== root) {
				object.updateMatrix();
				object.matrixAutoUpdate = false;
			}
		});
		setOptions(options);
		return api;
	}
	function afCreateGlow(renderer, scene, byScene) {
		let width = 0, height = 0, dead = false;
		const resources = [], owners = /* @__PURE__ */ new Set();
		function target(depth = false, samples = 0) {
			const t = new three.WebGLRenderTarget(1, 1, {
				type: three.HalfFloatType,
				depthBuffer: depth,
				stencilBuffer: false,
				samples,
				resolveDepthBuffer: false,
				resolveStencilBuffer: false
			});
			t.texture.colorSpace = three.LinearSRGBColorSpace;
			resources.push(t);
			return t;
		}
		const base = target(true, Math.min(4, renderer.capabilities.maxSamples || 0)), emission = target(true), blurs = [
			2,
			4,
			8
		].map(() => [target(), target()]);
		const screenScene = new three.Scene(), screenCamera = new three.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new three.Mesh(new three.PlaneGeometry(2, 2));
		quad.frustumCulled = false;
		screenScene.add(quad);
		resources.push(quad.geometry);
		const vertex = "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";
		function screenMaterial(fragment, uniforms) {
			const m = new three.ShaderMaterial({
				vertexShader: vertex,
				fragmentShader: fragment,
				uniforms,
				depthTest: false,
				depthWrite: false,
				toneMapped: false
			});
			resources.push(m);
			return m;
		}
		const blur = screenMaterial(`varying vec2 vUv;uniform sampler2D source;uniform vec2 direction;void main(){vec3 c=texture2D(source,vUv).rgb*.227027;c+=(texture2D(source,vUv+direction*1.384615).rgb+texture2D(source,vUv-direction*1.384615).rgb)*.316216;c+=(texture2D(source,vUv+direction*3.230769).rgb+texture2D(source,vUv-direction*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}`, {
			source: { value: null },
			direction: { value: new three.Vector2() }
		});
		const combine = screenMaterial(`varying vec2 vUv;uniform sampler2D baseImage,tightGlow,mediumGlow,wideGlow;void main(){vec3 c=texture2D(baseImage,vUv).rgb+texture2D(tightGlow,vUv).rgb*.58+texture2D(mediumGlow,vUv).rgb*.25+texture2D(wideGlow,vUv).rgb*.085;gl_FragColor=vec4(max(c,vec3(0.)),1.);
#include <colorspace_fragment>
}`, {
			baseImage: { value: base.texture },
			tightGlow: { value: blurs[0][1].texture },
			mediumGlow: { value: blurs[1][1].texture },
			wideGlow: { value: blurs[2][1].texture }
		});
		const black = new three.MeshBasicMaterial({
			color: 0,
			side: three.DoubleSide
		});
		resources.push(black);
		const size = new three.Vector2(), viewport = new three.Vector4(), scissor = new three.Vector4(), clear = new three.Color(), swaps = [], hidden = [], bloomUniforms = /* @__PURE__ */ new Set();
		function collectEmission(object, owned = false) {
			if (!object.visible) return;
			owned = owned || !!object.userData.animeFlameShield;
			if (owned) {
				const material = object.material;
				if (Array.isArray(material)) {
					for (const m of material) if (m.uniforms?.uBloom) bloomUniforms.add(m.uniforms.uBloom);
				} else if (material?.uniforms?.uBloom) bloomUniforms.add(material.uniforms.uBloom);
			} else if (object.isMesh) {
				const material = object.material;
				if (Array.isArray(material) ? material.some((m) => m.transparent) : material.transparent) {
					hidden.push(object);
					object.visible = false;
				} else {
					swaps.push(object, material);
					object.material = black;
				}
			} else if (object.isLine || object.isPoints || object.isSprite) {
				hidden.push(object);
				object.visible = false;
			}
			for (const child of object.children) collectEmission(child, owned);
		}
		function resize(w, h) {
			if (w === width && h === height) return;
			width = w;
			height = h;
			base.setSize(w, h);
			emission.setSize(w, h);
			blurs.forEach((pair, i) => {
				for (const t of pair) t.setSize(Math.max(1, Math.ceil(w / 2 ** (i + 1))), Math.max(1, Math.ceil(h / 2 ** (i + 1))));
			});
		}
		function pass(shader, buffer) {
			quad.material = shader;
			renderer.setRenderTarget(buffer);
			renderer.render(screenScene, screenCamera);
		}
		function render(currentScene, camera) {
			if (dead) return;
			const output = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
			renderer.getDrawingBufferSize(size);
			resize(output?.width ?? size.x, output?.height ?? size.y);
			renderer.getViewport(viewport);
			renderer.getScissor(scissor);
			renderer.getClearColor(clear);
			const alpha = renderer.getClearAlpha(), scissorTest = renderer.getScissorTest(), auto = renderer.autoClear, xr = renderer.xr.enabled, tone = renderer.toneMapping, colorSpace = renderer.outputColorSpace, background = currentScene.background, shadowAuto = renderer.shadowMap.autoUpdate;
			swaps.length = 0;
			hidden.length = 0;
			bloomUniforms.clear();
			function restoreScene() {
				for (let i = 0; i < swaps.length; i += 2) swaps[i].material = swaps[i + 1];
				for (const o of hidden) o.visible = true;
				for (const u of bloomUniforms) u.value = 0;
				swaps.length = 0;
				hidden.length = 0;
				bloomUniforms.clear();
				currentScene.background = background;
			}
			try {
				renderer.xr.enabled = false;
				renderer.autoClear = true;
				renderer.setScissorTest(false);
				renderer.toneMapping = three.NoToneMapping;
				renderer.outputColorSpace = three.SRGBColorSpace;
				renderer.shadowMap.autoUpdate = false;
				renderer.setRenderTarget(base);
				renderer.render(currentScene, camera);
				collectEmission(currentScene);
				for (const u of bloomUniforms) u.value = 1;
				currentScene.background = null;
				renderer.setClearColor(0, 1);
				renderer.setRenderTarget(emission);
				renderer.render(currentScene, camera);
				restoreScene();
				let previous = emission;
				for (const [horizontal, vertical] of blurs) {
					blur.uniforms.source.value = previous.texture;
					blur.uniforms.direction.value.set(1.6 / horizontal.width, 0);
					pass(blur, horizontal);
					blur.uniforms.source.value = horizontal.texture;
					blur.uniforms.direction.value.set(0, 1.6 / vertical.height);
					pass(blur, vertical);
					previous = vertical;
				}
				renderer.setRenderTarget(output, face, mip);
				renderer.setViewport(viewport);
				renderer.setScissor(scissor);
				renderer.setScissorTest(scissorTest);
				quad.material = combine;
				renderer.render(screenScene, screenCamera);
			} finally {
				restoreScene();
				renderer.shadowMap.autoUpdate = shadowAuto;
				renderer.setClearColor(clear, alpha);
				renderer.autoClear = auto;
				renderer.xr.enabled = xr;
				renderer.toneMapping = tone;
				renderer.outputColorSpace = colorSpace;
				renderer.setRenderTarget(output, face, mip);
				renderer.setViewport(viewport);
				renderer.setScissor(scissor);
				renderer.setScissorTest(scissorTest);
			}
		}
		return {
			renderer,
			scene,
			byScene,
			owners,
			render,
			dispose() {
				if (dead) return;
				dead = true;
				for (const resource of resources) resource.dispose();
				owners.clear();
			}
		};
	}

//#endregion
exports.createAnimeFlameShieldEffect = createAnimeFlameShieldEffect;
return exports;
})({}, THREE);
const createAnimeFlameShieldEffect = __vfxModule.createAnimeFlameShieldEffect;

const preset={"id":"anime-flame-shield","name":"烈焰繞流","english":"Anime Flame Flow","category":"beam","color":"#ff761f","description":"火焰撞上圓球或方塊，沿表面翻捲，最後散成濃煙。","tags":"火焰 圓球 方塊 瞄準 動漫 卡通 繞流 火柱 煙霧 Anime Flame Flow sphere cube aim fire smoke toon","schools":["fire"],"kind":7,"variant":0,"seed":261109,"duration":6.25,"burst":false,"maxParticles":0,"defaultDensity":1,"previewTime":2,"thumbnailTime":2,"previewActiveDuration":4,"lifecycle":{"start":0.25,"end":2},"renderStyle":"toon"};
export const defaultOptions={"color":"#ff761f","size":1,"speed":1};
export default function createVFX(options={}){return createAnimeFlameShieldEffect(preset,{...defaultOptions,...options});}
