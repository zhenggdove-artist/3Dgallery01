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
// 冰矛飛射 / Ice Lance — Three.js r187, WebGL2.
// Add fx.group, update(deltaSeconds), then fx.render(renderer,scene,camera).
// render REPLACES renderer.render; call once per scene/frame, including all ice instances.
// SRGBColorSpace + NoToneMapping; opaque full-frame output. No host composer required.
// Bloom uses four lazy render targets and keeps opaque mesh occlusion. Transparent
// environment surfaces do not occlude bloom; stacked postprocessing/alpha output not supported.
// XZ ground / +Y up. Lance flies +X into (2.6,1.5,0); shield hits are an authored demo script.
// No collision, damage, input, automatic loop, terrain editing or external texture fetch.
// Color, bloom, shiny, size and speed preserve time. reset replays the same fixed seed.
// dispose releases only effect-owned resources and lazy bloom targets; later calls are inert.
import * as THREE from "three";
import * as __vfxDependency1 from "three/addons/postprocessing/Pass.js";
var __vfxModule = (function(exports, three, three_addons_postprocessing_Pass_js) {

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

//#region src/effects/ice-magic/common.js
	const sat = (x) => Math.max(0, Math.min(1, x));
	const smooth = (a, b, x) => {
		const q = sat((x - a) / (b - a));
		return q * q * (3 - 2 * q);
	};
	const windowFade = (t, a, b, fade = .35) => smooth(a, a + .09, t) * (1 - smooth(b - fade, b, t));
	const rng = (seed = 713) => () => {
		seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
		return seed / 4294967296;
	};
	const palette = {
		ice: "#95ddf6",
		dark: "#17547f",
		white: "#f0fbff",
		cyan: "#70d6f7",
		shadow: "#184566"
	};
	function createStudy(id, duration, names, options = {}) {
		const group = new three.Group();
		group.name = id;
		let elapsed = 0, disposed = false, render = () => {}, solo = -1;
		const settings = {
			size: 1,
			speed: 1,
			shiny: 1,
			bloom: 1.1,
			color: "#47d1ff"
		}, enabled = names.map(() => true), layers = names.map((name, i) => {
			const g = new three.Group();
			g.name = name;
			g.userData.layer = i;
			group.add(g);
			return g;
		});
		const tint = new three.Color(settings.color);
		function installPalette() {
			const seen = /* @__PURE__ */ new Set();
			group.traverse((o) => {
				const m = o.material;
				if (!m?.isShaderMaterial || seen.has(m) || m.uniforms.iceTint) return;
				seen.add(m);
				m.uniforms.iceBloomGain = { value: 1 };
				m.uniforms.iceTint = { value: tint };
				m.uniforms.iceTintMix = { value: 0 };
				m.fragmentShader = `uniform vec3 iceTint;uniform float iceTintMix,iceBloomGain;vec3 recolorIce(vec3 c){float hi=max(c.r,max(c.g,c.b)),lo=min(c.r,min(c.g,c.b));float saturation=(hi-lo)/max(hi,.00001);vec3 colored=iceTint*(hi/.9216);colored=mix(colored,vec3(hi),pow(1.-saturation,5.));return mix(c,colored,iceTintMix);}
` + m.fragmentShader.replace("#include <colorspace_fragment>", "gl_FragColor.rgb=recolorIce(gl_FragColor.rgb)*iceBloomGain;\n#include <colorspace_fragment>");
				m.needsUpdate = true;
			});
		}
		function applyShiny() {
			tint.set(settings.color);
			group.traverse((o) => {
				const m = o.material;
				if (m?.uniforms?.shiny) m.uniforms.shiny.value = settings.shiny;
				if (m?.uniforms?.iceTintMix) m.uniforms.iceTintMix.value = settings.color === "#95ddf6" ? 0 : 1;
			});
		}
		function sync() {
			if (disposed) return;
			group.scale.setScalar(settings.size);
			group.visible = elapsed < duration;
			render(elapsed);
			layers.forEach((g, i) => g.visible = solo >= 0 ? solo === i : enabled[i]);
		}
		const fx = {
			id,
			group,
			layers,
			names,
			duration,
			get elapsed() {
				return elapsed;
			},
			get finished() {
				return disposed || elapsed >= duration;
			},
			get settings() {
				return { ...settings };
			},
			get phase() {
				return disposed || elapsed >= duration ? "finished" : elapsed === 0 ? "starting" : "active";
			},
			update(dt) {
				if (disposed || !Number.isFinite(dt) || dt < 0) return;
				elapsed = Math.min(duration, elapsed + dt * settings.speed);
				sync();
			},
			seek(t) {
				if (disposed || !Number.isFinite(t)) return;
				elapsed = Math.max(0, Math.min(duration, t));
				sync();
			},
			reset() {
				if (disposed) return;
				elapsed = 0;
				sync();
			},
			setOptions(o = {}) {
				if (disposed || !o || typeof o !== "object") return;
				for (const k of ["size", "speed"]) if (Number.isFinite(o[k])) settings[k] = Math.max(.25, Math.min(2, o[k]));
				if (Number.isFinite(o.bloom)) settings.bloom = Math.max(0, Math.min(3, o.bloom));
				if (Number.isFinite(o.shiny)) settings.shiny = Math.max(0, Math.min(3, o.shiny));
				if (typeof o.color === "string" && /^#[0-9a-f]{6}$/i.test(o.color)) settings.color = o.color.toLowerCase();
				applyShiny();
				sync();
			},
			setLayer(i, value) {
				if (disposed || !Number.isInteger(i) || i < 0 || i >= layers.length) return;
				enabled[i] = !!value;
				sync();
			},
			soloLayer(i = -1) {
				if (disposed) return;
				solo = Number.isInteger(i) && i >= 0 && i < layers.length ? i : -1;
				sync();
			},
			restoreLayers() {
				if (disposed) return;
				enabled.fill(true);
				solo = -1;
				sync();
			},
			install(fn) {
				render = fn;
				installPalette();
				applyShiny();
				sync();
			},
			dispose() {
				if (disposed) return;
				disposed = true;
				const geo = /* @__PURE__ */ new Set(), mat = /* @__PURE__ */ new Set(), tex = /* @__PURE__ */ new Set();
				group.traverse((o) => {
					if (o.geometry) geo.add(o.geometry);
					if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) mat.add(m);
				});
				for (const g of geo) g.dispose();
				for (const m of mat) {
					if (m.uniforms) {
						for (const u of Object.values(m.uniforms)) if (u.value?.isTexture) tex.add(u.value);
					}
					m.dispose();
				}
				for (const t of tex) t.dispose();
				group.visible = false;
				group.removeFromParent();
				group.clear();
			},
			get disposed() {
				return disposed;
			}
		};
		group.userData.iceMagic = { settings };
		fx.setOptions(options);
		return fx;
	}
	function iceMaterial(color = palette.ice) {
		return new three.ShaderMaterial({
			uniforms: {
				tint: { value: new three.Color(color) },
				fade: { value: 1 },
				time: { value: 0 },
				highlight: { value: 1 },
				groundClip: { value: 0 },
				shiny: { value: 1 }
			},
			vertexShader: `varying vec3 n,p,eye;varying float localGroundHeight;void main(){p=position;vec4 local=vec4(position,1.);vec3 norm=normal;
#ifdef USE_INSTANCING
local=instanceMatrix*local;mat3 im=mat3(instanceMatrix);norm/=vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2]));norm=im*norm;
#endif
localGroundHeight=local.y;n=normalize(normalMatrix*norm);vec4 mv=modelViewMatrix*local;eye=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
			fragmentShader: `uniform vec3 tint;uniform float fade,time,highlight,groundClip,shiny;varying vec3 n,p,eye;varying float localGroundHeight;float noise(vec3 v){return fract(sin(dot(floor(v*24.),vec3(12.9898,78.233,45.164)))*43758.5453);}void main(){if(groundClip>.5&&localGroundHeight<.018)discard;if(p.y>fade)discard;float l=dot(normalize(n),normalize((viewMatrix*vec4(-.4,.7,1.,0.)).xyz));vec3 col=mix(vec3(.025,.105,.19),tint*vec3(.4,.7,.86),step(.28,l));col=mix(col,tint,step(.84,l));col=mix(col,vec3(.88,.97,1.),step(.94,l)*step(.45,p.y)*highlight*min(shiny,1.));col+=vec3(.02,.09,.13)*pow(1.-abs(normalize(n).z),3.);float facet=step(.27,p.y+p.x*.6)-step(.62,p.y+p.x*.6);col*=.87+.13*facet;float glint=exp(-pow((p.y+p.x*.8-(.15+mod(time*.22,1.2)))*24.,2.));col=mix(col,vec3(.64,.88,.96),glint*.16*highlight);float fleck=step(.985,noise(p+vec3(0.,time*.025,0.)));col=mix(col,vec3(.77,.94,1.),fleck*.2);vec3 light=normalize((viewMatrix*vec4(-.4,.7,1.,0.)).xyz);float spec=pow(max(0.,dot(normalize(n),normalize(light+normalize(eye)))),48.);col+=vec3(.68,.88,1.)*spec*shiny*highlight*1.4;gl_FragColor=vec4(col,1.);\n#include <colorspace_fragment>}`,
			side: three.DoubleSide
		});
	}
	function crystalGeometry() {
		const positions = [], n = 6;
		for (let i = 0; i < n; i++) {
			const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, ra = .26 * (.9 + .12 * Math.sin(i * 2.1)), rb = .26 * (.9 + .12 * Math.sin((i + 1) * 2.1));
			const p = [
				Math.cos(a) * .12,
				0,
				Math.sin(a) * .12
			], q = [
				Math.cos(b) * .12,
				0,
				Math.sin(b) * .12
			];
			const r = [
				Math.cos(a) * ra,
				.42 + .045 * Math.sin(i * 1.7),
				Math.sin(a) * ra
			], s = [
				Math.cos(b) * rb,
				.42 + .045 * Math.sin((i + 1) * 1.7),
				Math.sin(b) * rb
			];
			positions.push(...p, ...q, ...r, ...r, ...q, ...s, ...r, ...s, .045, 1, .025, 0, 0, 0, ...q, ...p);
		}
		for (let j = 0; j < positions.length; j += 9) for (let k = 0; k < 3; k++) {
			const v = positions[j + 3 + k];
			positions[j + 3 + k] = positions[j + 6 + k];
			positions[j + 6 + k] = v;
		}
		const g = new three.BufferGeometry();
		g.setAttribute("position", new three.Float32BufferAttribute(positions, 3));
		g.computeVertexNormals();
		return g;
	}
	function crystal(group, geometry, material, x, y, z, sx, sy, sz, tilt = 0) {
		const o = new three.Mesh(geometry, material);
		o.position.set(x, y, z);
		o.scale.set(sx, sy, sz);
		o.rotation.z = tilt;
		group.add(o);
		return o;
	}
	function stroke(group, paths, { width = .025, color = palette.cyan, opacity = 1, flow = 0, normal = [
		0,
		1,
		0
	] } = {}) {
		const positions = [], uvs = [], progress = [], indices = [];
		const norm = new three.Vector3(...normal), v = new three.Vector3(), side = new three.Vector3();
		for (const pts of paths) {
			const base = positions.length / 3;
			for (let j = 0; j < pts.length; j++) {
				const prev = pts[Math.max(0, j - 1)], next = pts[Math.min(pts.length - 1, j + 1)];
				v.set(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]);
				side.crossVectors(v, norm).normalize().multiplyScalar(width * .5 * (pts[j][4] ?? 1));
				for (const k of [-1, 1]) {
					positions.push(pts[j][0] + side.x * k, pts[j][1] + side.y * k, pts[j][2] + side.z * k);
					uvs.push(j / (pts.length - 1), (k + 1) / 2);
					progress.push(pts[j][3] ?? j / (pts.length - 1));
				}
			}
			for (let j = 0; j < pts.length - 1; j++) {
				let a = base + j * 2;
				indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
			}
		}
		const g = new three.BufferGeometry();
		g.setAttribute("position", new three.Float32BufferAttribute(positions, 3));
		g.setAttribute("uv", new three.Float32BufferAttribute(uvs, 2));
		g.setAttribute("growth", new three.Float32BufferAttribute(progress, 1));
		g.setIndex(indices);
		const u = {
			opacity: { value: opacity },
			reveal: { value: 1 },
			time: { value: 0 },
			flow: { value: flow },
			color: { value: new three.Color(color) },
			clipRadius: { value: 100 },
			clipX: { value: 100 },
			tailFade: { value: 0 }
		};
		const m = new three.ShaderMaterial({
			uniforms: u,
			transparent: true,
			depthWrite: false,
			depthTest: true,
			side: three.DoubleSide,
			vertexShader: "attribute float growth;varying vec2 v;varying float q;varying vec3 lp;void main(){v=uv;q=growth;lp=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
			fragmentShader: `uniform float opacity,reveal,time,flow,clipRadius,clipX,tailFade;uniform vec3 color;varying vec2 v;varying float q;varying vec3 lp;void main(){if(lp.x>clipX)discard;float a=(1.-smoothstep(.35,.5,abs(v.y-.5)))*(1.-smoothstep(reveal-.035,reveal,q));float pulse=mix(1.,.25+.75*pow(.5+.5*sin(v.x*32.-time*9.),3.),flow);float angle=atan(-lp.z,lp.x);float shape=.92+.085*cos(angle*5.)+.055*sin(angle*3.+.7);float radial=length(lp.xz)/shape;float keep=1.-smoothstep(clipRadius-.16,clipRadius,radial);gl_FragColor=vec4(color,opacity*a*pulse*keep*mix(1.,1.-v.x,tailFade));\n#include <colorspace_fragment>}`
		});
		const mesh = new three.Mesh(g, m);
		group.add(mesh);
		return {
			mesh,
			u
		};
	}
	function ring(group, { radius = 1, width = .04, color = palette.cyan, normal = "ground" } = {}) {
		return stroke(group, [Array.from({ length: 97 }, (_, i) => {
			const a = i / 96 * Math.PI * 2;
			return normal === "front" ? [
				Math.cos(a) * radius,
				Math.sin(a) * radius,
				0
			] : [
				Math.cos(a) * radius,
				0,
				Math.sin(a) * radius
			];
		})], {
			width,
			color,
			normal: normal === "front" ? [
				0,
				0,
				1
			] : [
				0,
				1,
				0
			]
		});
	}
	function sprites(group, count, { kind = 0, color = palette.white, add = false } = {}) {
		const g = new three.InstancedBufferGeometry();
		g.setAttribute("position", new three.Float32BufferAttribute([
			-.5,
			-.5,
			0,
			.5,
			-.5,
			0,
			-.5,
			.5,
			0,
			.5,
			.5,
			0
		], 3));
		g.setAttribute("uv", new three.Float32BufferAttribute([
			0,
			0,
			1,
			0,
			0,
			1,
			1,
			1
		], 2));
		g.setIndex([
			0,
			1,
			2,
			2,
			1,
			3
		]);
		const c = new Float32Array(count * 3), s = new Float32Array(count * 2), a = new Float32Array(count), rot = new Float32Array(count);
		for (const [n, arr, size] of [
			[
				"center",
				c,
				3
			],
			[
				"extent",
				s,
				2
			],
			[
				"alpha",
				a,
				1
			],
			[
				"turn",
				rot,
				1
			]
		]) g.setAttribute(n, new three.InstancedBufferAttribute(arr, size).setUsage(three.DynamicDrawUsage));
		g.instanceCount = count;
		const m = new three.ShaderMaterial({
			uniforms: {
				tint: { value: new three.Color(color) },
				kind: { value: kind }
			},
			transparent: true,
			depthTest: true,
			depthWrite: false,
			blending: add ? three.AdditiveBlending : three.NormalBlending,
			vertexShader: `attribute vec3 center;attribute vec2 extent;attribute float alpha,turn;varying vec2 v;varying float life;void main(){v=uv*2.-1.;life=alpha;vec4 mv=modelViewMatrix*vec4(center,1.);float co=cos(turn),si=sin(turn);vec2 p=mat2(co,-si,si,co)*(position.xy*extent)*length(modelMatrix[0].xyz);mv.xy+=p;gl_Position=projectionMatrix*mv;}`,
			fragmentShader: `uniform vec3 tint;uniform float kind;varying vec2 v;varying float life;void main(){float r=length(v),mask=0.;if(kind<.5){float n=sin(v.x*9.+sin(v.y*7.))*sin(v.y*8.);mask=(1.-smoothstep(.2,1.,r+n*.08))*.5;}else if(kind<1.5){mask=pow(max(0.,1.-abs(v.x)-abs(v.y)),.65);}else if(kind<2.5){mask=pow(max(0.,1.-abs(v.x)),2.)*pow(max(0.,1.-abs(v.y)),.5);}else{float ray=min(abs(v.x)*.16+abs(v.y),abs(v.x)+abs(v.y)*.16);mask=pow(max(0.,1.-ray*6.),1.3);mask=max(mask,exp(-r*r*12.)*.24);}float a=mask*life;if(a<.002)discard;gl_FragColor=vec4(tint,a);\n#include <colorspace_fragment>}`
		});
		const mesh = new three.Mesh(g, m);
		mesh.frustumCulled = false;
		group.add(mesh);
		return {
			mesh,
			set(i, x, y, z, w, h, opacity, rotation = 0) {
				c[i * 3] = x;
				c[i * 3 + 1] = y;
				c[i * 3 + 2] = z;
				s[i * 2] = Math.max(0, w);
				s[i * 2 + 1] = Math.max(0, h);
				a[i] = Math.max(0, opacity);
				rot[i] = rotation;
			},
			flush() {
				for (const n of [
					"center",
					"extent",
					"alpha",
					"turn"
				]) g.attributes[n].needsUpdate = true;
			}
		};
	}
	function instanceBatch(group, geometry, material, count) {
		const mesh = new three.InstancedMesh(geometry, material, count);
		mesh.instanceMatrix.setUsage(three.DynamicDrawUsage);
		mesh.frustumCulled = false;
		group.add(mesh);
		const pose = new three.Object3D();
		return {
			mesh,
			set(i, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
				pose.position.set(x, y, z);
				pose.scale.set(Math.max(1e-5, sx), Math.max(1e-5, sy), Math.max(1e-5, sz));
				pose.rotation.set(rx, ry, rz);
				pose.updateMatrix();
				mesh.setMatrixAt(i, pose.matrix);
			},
			flush() {
				mesh.instanceMatrix.needsUpdate = true;
			}
		};
	}
	function randomData(count, seed) {
		const r = rng(seed);
		return Array.from({ length: count }, () => Array.from({ length: 8 }, r));
	}

//#endregion
//#region src/effects/ice-magic/lance-kit.js
	function bladeGeometry$1(lean = .1) {
		const p = [], uv = [], sides = 6, levels = [
			[0, .12],
			[.2, .265],
			[.44, .205],
			[1, 0]
		], points = [];
		for (const [t, w] of levels) points.push(Array.from({ length: sides }, (_, k) => {
			const a = k * Math.PI / 3;
			return [
				lean * .24 * t + Math.cos(a) * w,
				t,
				Math.sin(a) * w * .72
			];
		}));
		const tri = (a, b, c) => {
			p.push(...a, ...b, ...c);
			uv.push(a[0], a[1], b[0], b[1], c[0], c[1]);
		};
		for (let j = 0; j < levels.length - 1; j++) for (let k = 0; k < sides; k++) {
			const next = (k + 1) % sides, a = points[j][k], b = points[j][next], c = points[j + 1][k], d = points[j + 1][next];
			tri(a, c, b);
			if (j < levels.length - 2) tri(b, c, d);
		}
		for (let k = 0; k < sides; k++) tri([
			0,
			0,
			0
		], points[0][k], points[0][(k + 1) % sides]);
		const g = new three.BufferGeometry();
		g.setAttribute("position", new three.Float32BufferAttribute(p, 3));
		g.setAttribute("uv", new three.Float32BufferAttribute(uv, 2));
		g.computeVertexNormals();
		return g;
	}
	function ribbon$1(layer, path, { width = .18, color = "#4edfff", normal = [
		0,
		0,
		1
	], glow = false } = {}) {
		const pos = [], uv = [], idx = [], up = new three.Vector3(...normal), tangent = new three.Vector3(), side = new three.Vector3();
		for (let i = 0; i < path.length; i++) {
			const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], q = i / (path.length - 1), w = width * Math.pow(Math.sin(q * Math.PI), .6);
			tangent.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
			side.crossVectors(tangent, up);
			if (side.lengthSq() < 1e-7) side.set(1, 0, 0);
			side.normalize().multiplyScalar(w * .5);
			for (const sign of [-1, 1]) {
				pos.push(path[i][0] + side.x * sign, path[i][1] + side.y * sign, path[i][2] + side.z * sign);
				uv.push(q, (sign + 1) / 2);
			}
			if (i < path.length - 1) {
				const j = i * 2;
				idx.push(j, j + 1, j + 2, j + 2, j + 1, j + 3);
			}
		}
		const g = new three.BufferGeometry();
		g.setAttribute("position", new three.Float32BufferAttribute(pos, 3));
		g.setAttribute("uv", new three.Float32BufferAttribute(uv, 2));
		g.setIndex(idx);
		const u = {
			time: { value: 0 },
			opacity: { value: 1 },
			color: { value: new three.Color(color) },
			reveal: { value: 1 },
			cutX: { value: 100 }
		};
		const m = new three.ShaderMaterial({
			uniforms: u,
			transparent: true,
			depthWrite: false,
			depthTest: true,
			side: three.DoubleSide,
			blending: three.AdditiveBlending,
			vertexShader: "varying vec2 v;varying vec3 p;void main(){v=uv;p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
			fragmentShader: `uniform float time,opacity,reveal,cutX;uniform vec3 color;varying vec2 v;varying vec3 p;void main(){if(p.x>cutX)discard;float edge=abs(v.y-.5)*2.;float band=${glow ? "pow(max(0.,1.-edge),2.)*.36" : "(1.-smoothstep(.52,1.,edge))"};float pulse=.65+.35*pow(.5+.5*sin(v.x*25.-time*12.),3.);float head=1.-smoothstep(reveal-.08,reveal,v.x);vec3 col=mix(color,vec3(.84,1.,1.),pow(max(0.,1.-edge*4.),4.)*.65);gl_FragColor=vec4(col,band*pulse*head*opacity);\n#include <colorspace_fragment>}`
		});
		const mesh = new three.Mesh(g, m);
		layer.add(mesh);
		return {
			mesh,
			u
		};
	}
	function luminousRibbon$1(layer, path, options = {}) {
		const core = ribbon$1(layer, path, options), halo = ribbon$1(layer, path, {
			...options,
			width: (options.width || .18) * 3.2,
			glow: true
		});
		return {
			core,
			halo,
			set(alpha, time = 0, reveal = 1) {
				for (const r of [core, halo]) {
					r.u.opacity.value = alpha;
					r.u.time.value = time;
					r.u.reveal.value = reveal;
				}
			},
			move(x, y, z) {
				core.mesh.position.set(x, y, z);
				halo.mesh.position.set(x, y, z);
			}
		};
	}
	function fracturedBladeGeometry$1(lean = .16) {
		const p = [], pivots = [], ids = [], levels = [
			[0, .12],
			[.2, .265],
			[.44, .205],
			[1, 0]
		], cuts = [
			0,
			.18,
			.36,
			.55,
			.74,
			1
		];
		const point = (y, k) => {
			let j = 0;
			while (j < levels.length - 2 && y > levels[j + 1][0]) j++;
			const a = levels[j], b = levels[j + 1], q = (y - a[0]) / (b[0] - a[0]), w = a[1] + (b[1] - a[1]) * q, angle = k * Math.PI / 3;
			return [
				lean * .24 * y + Math.cos(angle) * w,
				y,
				Math.sin(angle) * w * .72
			];
		};
		for (let part = 0; part < cuts.length - 1; part++) {
			const lo = cuts[part], hi = cuts[part + 1], ys = [
				lo,
				...levels.map((l) => l[0]).filter((y) => y > lo && y < hi),
				hi
			], pivot = [
				lean * .24 * (lo + hi) / 2,
				(lo + hi) / 2,
				0
			];
			const tri = (a, b, c) => {
				p.push(...a, ...b, ...c);
				for (let i = 0; i < 3; i++) {
					pivots.push(...pivot);
					ids.push(part);
				}
			};
			for (let j = 0; j < ys.length - 1; j++) for (let k = 0; k < 6; k++) {
				const next = (k + 1) % 6, a = point(ys[j], k), b = point(ys[j], next), c = point(ys[j + 1], k), d = point(ys[j + 1], next);
				tri(a, c, b);
				tri(b, c, d);
			}
			for (let k = 0; k < 6; k++) {
				const next = (k + 1) % 6;
				tri([
					lean * .24 * lo,
					lo,
					0
				], point(lo, k), point(lo, next));
				if (hi < 1) tri([
					lean * .24 * hi,
					hi,
					0
				], point(hi, next), point(hi, k));
			}
		}
		const g = new three.BufferGeometry();
		g.setAttribute("position", new three.Float32BufferAttribute(p, 3));
		g.setAttribute("fragmentPivot", new three.Float32BufferAttribute(pivots, 3));
		g.setAttribute("fragmentIndex", new three.Float32BufferAttribute(ids, 1));
		g.computeVertexNormals();
		return g;
	}

//#endregion
//#region src/effects/ice-magic/art.js
	function glowStroke(group, paths, { width = .035, color = palette.cyan, normal = [
		0,
		1,
		0
	], flow = 0 } = {}) {
		const soft = stroke(group, paths, {
			width: width * 5,
			color,
			normal,
			flow
		}), core = stroke(group, paths, {
			width,
			color: palette.white,
			normal,
			flow
		});
		soft.mesh.material.blending = three.AdditiveBlending;
		core.mesh.material.blending = three.AdditiveBlending;
		return {
			core,
			soft,
			set(opacity, time = 0, reveal = 1) {
				soft.u.opacity.value = opacity * .16;
				core.u.opacity.value = opacity;
				for (const s of [soft, core]) {
					s.u.time.value = time;
					s.u.reveal.value = reveal;
				}
			}
		};
	}

//#endregion
//#region src/effects/ice-magic/ice-lance-start.js
	const LAUNCH = .8;
	const ROOT = -5.35;
	const Y = 1.5;
	const LENGTH = 3.55;
	const cuts = [
		0,
		.18,
		.36,
		.55,
		.74,
		1
	];
	const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
	const close = (t, start, end) => smooth(start, end, t);
	const widthAt = (q) => q < .2 ? .12 + (.265 - .12) * q / .2 : q < .44 ? .265 + (.205 - .265) * (q - .2) / .24 : .205 * (1 - q) / .56;
	function shaftSections(layer) {
		const source = fracturedBladeGeometry$1(.12), positions = source.attributes.position, normals = source.attributes.normal, ids = source.attributes.fragmentIndex;
		const material = iceMaterial("#95ddf6");
		material.vertexShader = "attribute vec3 sourcePosition;\n" + material.vertexShader.replace("p=position;", "p=sourcePosition;");
		const sections = [];
		for (let i = 0; i < 5; i++) {
			const mid = (cuts[i] + cuts[i + 1]) * .5, pivot = new three.Vector3(.0288 * mid, mid, 0), p = [], n = [], original = [];
			for (let j = 0; j < positions.count; j++) if (ids.getX(j) === i) {
				p.push(positions.getX(j) - pivot.x, positions.getY(j) - pivot.y, positions.getZ(j) - pivot.z);
				original.push(positions.getX(j), positions.getY(j), positions.getZ(j));
				n.push(normals.getX(j), normals.getY(j), normals.getZ(j));
			}
			const geometry = new three.BufferGeometry();
			geometry.setAttribute("position", new three.Float32BufferAttribute(p, 3));
			geometry.setAttribute("sourcePosition", new three.Float32BufferAttribute(original, 3));
			geometry.setAttribute("normal", new three.Float32BufferAttribute(n, 3));
			const mesh = new three.Mesh(geometry, material);
			mesh.scale.set(.92, LENGTH, .92);
			mesh.frustumCulled = false;
			layer.add(mesh);
			const angle = i * 2.399 + .45, offset = new three.Vector3(.24 + Math.sin(i * 1.7) * .07, Math.cos(angle) * (.7 + i * .07), Math.sin(angle) * (.76 + i * .07));
			sections.push({
				mesh,
				mid,
				offset,
				target: new three.Vector3(ROOT + LENGTH * mid, Y - pivot.x * .92, 0),
				end: new three.Quaternion().setFromEuler(new three.Euler(0, 0, -Math.PI / 2)),
				start: new three.Quaternion().setFromEuler(new three.Euler((i % 2 ? 1 : -1) * .16, .12 * Math.sin(i), -Math.PI / 2 + (i - 2) * .075))
			});
		}
		source.dispose();
		return {
			sections,
			material
		};
	}
	function createLanceStart({ layers, body, shaft, prongs, wings, crown }) {
		const { flash, gather, assembly, seams, launch } = layers;
		const pieces = shaftSections(assembly);
		const iceLight = sprites(flash, 3, {
			color: "#9be9ff",
			add: true
		});
		iceLight.mesh.material.fragmentShader = `uniform vec3 tint;varying vec2 v;varying float life;void main(){float a=atan(v.y,v.x);float d=length(v*vec2(.74,1.1));float edge=.54+.10*sin(a*5.+.8)+.045*cos(a*9.);float core=1.-smoothstep(edge*.38,edge,d);float halo=exp(-d*d*7.)*(1.-smoothstep(.7,1.,d))*.28;float opacity=max(core,halo)*life;if(opacity<.002)discard;gl_FragColor=vec4(mix(tint,vec3(.94,1.,1.),core*.72),opacity);\n#include <colorspace_fragment>\n}`;
		const sand = sprites(gather, 58, {
			kind: 1,
			color: "#a2e7fa",
			add: true
		}), rs = randomData(58, 15011);
		const joints = cuts.slice(1, -1).map((q) => {
			const w = widthAt(q), x = ROOT + LENGTH * q, y = Y - .0288 * q * .92;
			const points = Array.from({ length: 7 }, (_, i) => {
				const a = i * Math.PI / 3;
				return [
					x,
					y - Math.cos(a) * (w * .92 + .008),
					Math.sin(a) * (w * .72 * .92 + .008)
				];
			});
			return {
				q,
				glow: glowStroke(seams, [points], {
					width: .014,
					color: "#88e7ff",
					normal: [
						1,
						0,
						0
					]
				})
			};
		});
		const paths = [
			0,
			2,
			4
		].map((k) => Array.from({ length: 33 }, (_, j) => {
			const q = j / 32, a = k * Math.PI / 3, w = widthAt(q);
			return [
				ROOT + LENGTH * q,
				Y - .0288 * q * .92 - Math.cos(a) * (w * .92 + .006),
				Math.sin(a) * (w * .72 * .92 + .006),
				q
			];
		}));
		const flow = glowStroke(seams, paths, {
			width: .025,
			color: "#72dfff",
			normal: [
				0,
				0,
				1
			]
		});
		for (const part of [flow.core, flow.soft]) {
			part.u.progress = { value: 0 };
			part.mesh.material.fragmentShader = `uniform float opacity,progress;uniform vec3 color;varying vec2 v;varying float q;void main(){float across=1.-smoothstep(.26,.5,abs(v.y-.5));float pulse=exp(-pow((q-progress)*7.,2.));float alpha=across*pulse*opacity;if(alpha<.002)discard;gl_FragColor=vec4(mix(color,vec3(.9,1.,1.),across*.35),alpha);\n#include <colorspace_fragment>\n}`;
		}
		const compression = [0, 2.55].map((phase, i) => {
			const path = Array.from({ length: 41 }, (_, j) => {
				const q = j / 40, a = phase + q * 2.8;
				return [
					-1.05 + q * 2.1,
					Math.cos(a) * (.66 - i * .1),
					Math.sin(a) * (.66 - i * .1)
				];
			});
			const band = luminousRibbon$1(seams, path, {
				width: i ? .055 : .075,
				color: "#69d9fa",
				normal: [
					1,
					0,
					0
				]
			});
			band.move(-3.65, Y, 0);
			return band;
		});
		const pressureMaterial = new three.ShaderMaterial({
			uniforms: { opacity: { value: 0 } },
			transparent: true,
			depthTest: true,
			depthWrite: false,
			side: three.DoubleSide,
			blending: three.AdditiveBlending,
			vertexShader: "varying vec2 v;void main(){v=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
			fragmentShader: "uniform float opacity;varying vec2 v;void main(){float r=length(v),rim=exp(-pow((r-.72)*19.,2.));float body=exp(-r*r*5.)*.08;float a=(rim*.55+body)*opacity;if(a<.002)discard;gl_FragColor=vec4(.52,.86,1.,a);\n#include <colorspace_fragment>\n}"
		});
		const pressure = new three.Mesh(new three.PlaneGeometry(2, 2), pressureMaterial);
		pressure.rotation.y = Math.PI / 2;
		pressure.position.set(-5.13, Y, 0);
		launch.add(pressure);
		const gas = sprites(launch, 14, { color: "#77c5df" }), rg = randomData(14, 15012);
		const finalProngRot = prongs.map(({ a }) => new three.Quaternion().setFromEuler(new three.Euler(a + .2025, 0, -Math.PI / 2)));
		const initialProngRot = prongs.map(({ a }, i) => new three.Quaternion().setFromEuler(new three.Euler(a + .2025 + (i - 1) * .35, .08 * (i - 1), -Math.PI / 2 + .18)));
		const finalWingRot = wings.map((_, i) => new three.Quaternion().setFromEuler(new three.Euler(i * Math.PI * 2 / 3 + .1575, 0, 0)));
		const initialWingRot = wings.map((_, i) => new three.Quaternion().setFromEuler(new three.Euler(i * Math.PI * 2 / 3 + .1575 + .24, .1 * (i - 1), -.12)));
		return { update(t) {
			const forging = t < LAUNCH, after = Math.max(0, t - LAUNCH), launchLife = 1 - smooth(0, .2, after);
			pieces.sections.forEach(({ mesh, mid, offset, target, start, end }, i) => {
				const q = close(t, .012 + i * .009, .4 + i * .044), rest = 1 - q;
				mesh.visible = forging;
				mesh.position.copy(target).addScaledVector(offset, rest);
				mesh.quaternion.copy(start).slerp(end, q);
			});
			pieces.material.uniforms.time.value = Math.max(0, t - .35);
			if (forging) {
				body.visible = true;
				body.position.set(ROOT, Y, 0);
				body.scale.setScalar(1);
				shaft.visible = false;
				prongs.forEach(({ o, a }, i) => {
					const q = close(t, .018 + i * .009, .49 + i * .04), rest = 1 - q, angle = a + .2025;
					o.position.set(.24 + .2 * rest, Math.cos(angle) * (.22 + rest * .8) + rest * .14, Math.sin(angle) * (.22 + rest * .8));
					o.quaternion.copy(initialProngRot[i]).slerp(finalProngRot[i], q);
					o.scale.set(.68, 2.1, .68);
				});
				wings.forEach((o, i) => {
					const q = close(t, .023 + i * .01, .55 + i * .04), rest = 1 - q, a = i * Math.PI * 2 / 3 + .1575;
					o.position.set(.4 + .26 * rest, Math.cos(a) * rest * .64 + rest * .15, Math.sin(a) * rest * .64);
					o.quaternion.copy(initialWingRot[i]).slerp(finalWingRot[i], q);
					o.scale.set(1, .8, 1);
				});
				for (let i = 0; i < 6; i++) {
					const a = i * Math.PI / 3, q = close(t, .35 + i * .018, .6 + i * .018), s = .3;
					crown.set(i, -4.7 + (1 - q) * .12, Y + Math.cos(a) * (.23 + (1 - q) * .45), Math.sin(a) * (.23 + (1 - q) * .45), s, .65, s, 0, 0, -Math.PI / 2 + Math.cos(a) * .4);
				}
				crown.flush();
				crown.mesh.visible = t >= .3;
			}
			const ignition = 1 - smooth(.015, .12, t), charged = smooth(.62, .77, t) * (1 - smooth(.79, .88, t));
			iceLight.mesh.visible = t < .88;
			iceLight.set(0, -3.65, Y, 0, 1.55 + t * 2, 1.05 + t, ignition * .48);
			iceLight.set(1, -2.3, Y, 0, .38 + charged * .2, .35 + charged * .15, charged * .4);
			iceLight.set(2, -1.8, Y, 0, .24 + charged * .14, .24 + charged * .14, charged * .9);
			iceLight.flush();
			rs.forEach((r, i) => {
				let x, y, z, alpha, turn, size = .023 + r[1] * r[1] * .045;
				if (forging) {
					const born = .015 + r[0] * .18, life = .28 + r[2] * .24, q = clamp((t - born) / life, 0, 1), move = q * q, angle = r[3] * Math.PI * 2, d = (.4 + r[4] * .65) * (1 - move);
					x = -5.1 + r[5] * 2.95 + .16 * (1 - move);
					y = Y + Math.cos(angle) * d;
					z = Math.sin(angle) * d;
					alpha = t >= born ? (1 - smooth(.74, 1, q)) * .65 : 0;
					turn = angle + move * .4;
				} else {
					const q = sat(after / .2), angle = r[3] * Math.PI * 2, spread = .12 + r[4] * .18 + q * (.18 + r[5] * .28);
					x = -5.1 - after * (1.7 + r[2] * 2.2);
					y = Y + Math.cos(angle) * spread;
					z = Math.sin(angle) * spread;
					alpha = t < 1 ? launchLife * (.35 + r[6] * .35) : 0;
					turn = angle;
				}
				sand.set(i, x, y, z, size, size * (.6 + r[7] * 1.4), alpha, turn);
			});
			sand.flush();
			sand.mesh.visible = t < 1;
			for (const { q, glow } of joints) {
				const click = .4 + q * .27, arrival = smooth(click - .025, click, t) * (1 - smooth(click + .018, click + .1, t)), travel = Math.exp(-Math.pow((q - (t - .62) / .18) * 6, 2)) * smooth(.61, .64, t);
				glow.set(forging ? arrival * .85 + travel * .32 : 0, Math.max(0, t - .35));
				glow.core.mesh.visible = glow.soft.mesh.visible = t >= .35 && forging;
			}
			const through = smooth(.62, .65, t) * (1 - smooth(.79, .81, t));
			flow.set(through * .8, t);
			for (const part of [flow.core, flow.soft]) part.u.progress.value = (t - .62) / .18;
			flow.core.mesh.visible = flow.soft.mesh.visible = t >= .62 && t < .81;
			compression.forEach((band, i) => {
				const radius = 1 - smooth(.6, .8, t) * .42;
				for (const part of [band.core, band.halo]) {
					part.mesh.scale.set(1, radius, radius);
					part.mesh.visible = t >= .54 && t < .81;
				}
				band.set(smooth(.54, .63, t) * (1 - smooth(.76, .81, t)) * (i ? .35 : .45), t);
			});
			pressure.visible = t >= LAUNCH && t < 1;
			pressure.scale.setScalar(.52 + after * 3.4);
			pressure.position.x = -5.13 - after * .3;
			pressureMaterial.uniforms.opacity.value = t >= LAUNCH ? launchLife : 0;
			rg.forEach((r, i) => {
				const angle = r[0] * Math.PI * 2, d = .12 + after * (.6 + r[1]), size = (.22 + r[2] * .2) * (1 + after * 2.5);
				gas.set(i, -5.17 - after * (1.4 + r[3] * 1.9), Y + Math.cos(angle) * d, Math.sin(angle) * d, size, size * .6, t >= LAUNCH && t < 1 ? smooth(0, .025, after) * launchLife * (.1 + r[4] * .045) : 0, r[5] * Math.PI * 2);
			});
			gas.flush();
			gas.mesh.visible = t >= LAUNCH && t < 1;
		} };
	}

//#endregion
//#region src/effects/ice-magic/ice-lance-impact.js
	const impactNames = [
		"瞬發冰光",
		"短促裂光",
		"破裂冰冠",
		"飛散冰片",
		"冷氣衝擊面",
		"翻湧冰霧",
		"冰晶粉塵"
	];
	const HIT = 1.15;
	const FRAGMENT_IMPULSE = 3;
	const fade = (a, start, end) => 1 - smooth(start, end, a);
	const drag = (a, k = 2.5) => (1 - Math.exp(-a * k)) / k;
	const chipAirTravel = (a) => .3 * a + .7 * drag(a);
	const chipAirSpeed = (a) => .3 + .7 * Math.exp(-a * 2.5);
	function floorY(y, vy, a, floor = .15) {
		const g = 7.6, hit = (vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, y - floor))) / g;
		if (a <= hit) return y + vy * a - .5 * g * a * a;
		const b = a - hit, v = (g * hit - vy) * .28;
		return b < 2 * v / g ? floor + v * b - .5 * g * b * b : floor;
	}
	function iceBatch(layer, count, color, centered = false) {
		const geometry = crystalGeometry(), m = iceMaterial(color), life = new Float32Array(count).fill(1);
		geometry.setAttribute("pieceLife", new three.InstancedBufferAttribute(life, 1));
		m.vertexShader = "attribute float pieceLife;varying float partLife;\n" + m.vertexShader.replace("void main(){", "void main(){partLife=pieceLife;");
		m.fragmentShader = "varying float partLife;\n" + m.fragmentShader.replace("if(p.y>fade)discard;", "if(p.y>min(fade,partLife))discard;");
		if (centered) {
			geometry.translate(0, -.5, 0);
			m.vertexShader = m.vertexShader.replace("p=position;", "p=position+vec3(0.,.5,0.);");
		}
		const batch = instanceBatch(layer, geometry, m, count), pose = new three.Object3D(), axis = new three.Vector3(0, 1, 0), dir = new three.Vector3(), spin = new three.Quaternion();
		const positions = geometry.attributes.position;
		function orient(width, length, depth, dx, dy, dz, turn) {
			pose.scale.set(width, length, depth);
			dir.set(dx, dy, dz).normalize();
			pose.quaternion.setFromUnitVectors(axis, dir);
			spin.setFromAxisAngle(axis, turn);
			pose.quaternion.multiply(spin);
			pose.updateMatrix();
		}
		function bottom(amount) {
			const e = pose.matrix.elements, cut = amount - (centered ? .5 : 0);
			let low = Infinity;
			for (let k = 0; k < positions.count; k++) {
				const x = positions.getX(k), y = positions.getY(k), z = positions.getZ(k);
				if (y <= cut) low = Math.min(low, e[1] * x + e[5] * y + e[9] * z);
				const next = k - k % 3 + (k + 1) % 3, ny = positions.getY(next);
				if (y < cut && ny > cut || y > cut && ny < cut) {
					const f = (cut - y) / (ny - y);
					low = Math.min(low, e[1] * (x + (positions.getX(next) - x) * f) + e[5] * cut + e[9] * (z + (positions.getZ(next) - z) * f));
				}
			}
			return Number.isFinite(low) ? low : 0;
		}
		return {
			mesh: batch.mesh,
			material: m,
			bottom(width, length, depth, dx, dy, dz, turn) {
				orient(width, length, depth, dx, dy, dz, turn);
				return bottom(1);
			},
			set(i, x, y, z, width, length, depth, dx, dy, dz, turn, amount, clearance = null) {
				pose.position.set(x, y, z);
				orient(width, length, depth, dx, dy, dz, turn);
				if (clearance !== null) pose.position.y = clearance - bottom(amount);
				pose.updateMatrix();
				batch.mesh.setMatrixAt(i, pose.matrix);
				life[i] = amount;
			},
			flush() {
				batch.flush();
				geometry.attributes.pieceLife.needsUpdate = true;
			}
		};
	}
	function fogCards(layer, root, count) {
		const geometry = new three.PlaneGeometry(1, 1), cards = [];
		for (let i = 0; i < count; i++) {
			const u = {
				age: { value: 0 },
				opacity: { value: 0 },
				seed: { value: i * 1.713 },
				inverseEffect: { value: new three.Matrix4() }
			};
			const m = new three.ShaderMaterial({
				uniforms: u,
				transparent: true,
				depthTest: true,
				depthWrite: false,
				side: three.DoubleSide,
				vertexShader: `uniform mat4 inverseEffect;varying vec2 v;varying vec3 localPoint;void main(){v=uv*2.-1.;vec4 c=modelMatrix*vec4(0.,0.,0.,1.);vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);vec3 world=c.xyz+right*position.x*length(modelMatrix[0].xyz)+up*position.y*length(modelMatrix[1].xyz);localPoint=(inverseEffect*vec4(world,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
				fragmentShader: `uniform float age,opacity,seed;varying vec2 v;varying vec3 localPoint;float noise(vec2 p){return sin(p.x*3.7+sin(p.y*2.8))*cos(p.y*3.1+sin(p.x*2.4));}void main(){vec2 q=v+vec2(age*.13,-age*.08);float n=noise(q*1.8+seed);float edge=length(v)+n*.13;float mask=1.-smoothstep(.45,.98,edge);float holes=smoothstep(-.8+age*.35,-.15+age*.35,n);float alpha=mask*mix(1.,holes,smoothstep(.45,1.8,age))*opacity;alpha*=smoothstep(.015,.13,localPoint.y)*(1.-smoothstep(2.50,2.61,localPoint.x));vec3 c=mix(vec3(.22,.49,.65),vec3(.69,.88,.96),smoothstep(-.35,.35,n+v.y*.35));if(alpha<.003)discard;gl_FragColor=vec4(c,alpha);\n#include <colorspace_fragment>\n}`
			});
			const mesh = new three.Mesh(geometry, m);
			mesh.frustumCulled = false;
			mesh.onBeforeRender = () => u.inverseEffect.value.copy(root.matrixWorld).invert();
			layer.add(mesh);
			cards.push({
				mesh,
				u
			});
		}
		return cards;
	}
	function createLanceImpact(layers, root) {
		const [flashLayer, rayLayer, crownLayer, chipLayer, waveLayer, fogLayer, dustLayer] = layers;
		const flash = sprites(flashLayer, 2, {
			color: "#b9efff",
			add: true
		});
		flash.mesh.material.fragmentShader = `uniform vec3 tint;varying vec2 v;varying float life;void main(){float a=atan(v.y,v.x),r=length(v);float edge=.59+.075*sin(a*5.+.3)+.045*cos(a*9.);float core=1.-smoothstep(edge*.6,edge,r);float halo=exp(-r*r*7.)*.5*(1.-smoothstep(.72,.98,r));vec3 col=mix(tint,vec3(.95,1.,1.),core);float alpha=max(core,halo)*life;if(alpha<.002)discard;gl_FragColor=vec4(col,alpha);\n#include <colorspace_fragment>\n}`;
		const rayPos = [], rayUV = [], rayId = [], rayIdx = [];
		randomData(13, 7101).forEach((r, i) => {
			const angle = i * 2.399 + r[0] * .4, dy = Math.cos(angle), dz = Math.sin(angle), dx = -.25 - r[1] * .55;
			for (let cross = 0; cross < 2; cross++) {
				const base = rayPos.length / 3;
				for (const [q, w] of [
					[0, 0],
					[.23, .11],
					[1, 0]
				]) for (const sign of [-1, 1]) {
					const length = .8 + r[2] * 1.1, offset = w * sign;
					rayPos.push(dx * q * length + (cross ? offset : 0), dy * q * length + (cross ? 0 : -dz * offset), dz * q * length + (cross ? 0 : dy * offset));
					rayUV.push(q, w === 0 ? .5 : (sign + 1) / 2);
					rayId.push(i);
				}
				rayIdx.push(base, base + 3, base + 2, base + 2, base + 3, base + 4);
			}
		});
		const rg = new three.BufferGeometry();
		rg.setAttribute("position", new three.Float32BufferAttribute(rayPos, 3));
		rg.setAttribute("uv", new three.Float32BufferAttribute(rayUV, 2));
		rg.setAttribute("ray", new three.Float32BufferAttribute(rayId, 1));
		rg.setIndex(rayIdx);
		const ru = {
			age: { value: 0 },
			opacity: { value: 0 }
		};
		const rm = new three.ShaderMaterial({
			uniforms: ru,
			transparent: true,
			depthTest: true,
			depthWrite: false,
			side: three.DoubleSide,
			blending: three.AdditiveBlending,
			vertexShader: `uniform float age;varying vec2 v;void main(){v=uv;vec3 p=position*(1.+age*5.);p+=vec3(2.48,1.5,0.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
			fragmentShader: `uniform float opacity;varying vec2 v;void main(){float core=1.-smoothstep(.1,.5,abs(v.y-.5));gl_FragColor=vec4(mix(vec3(.25,.75,1.),vec3(.9,1.,1.),core),core*opacity);\n#include <colorspace_fragment>\n}`
		});
		const rayMesh = new three.Mesh(rg, rm);
		rayMesh.frustumCulled = false;
		rayLayer.add(rayMesh);
		const crown = iceBatch(crownLayer, 12, "#91def6"), cr = randomData(12, 7102);
		const chips = iceBatch(chipLayer, 70, "#9fdaf2", true), ch = randomData(70, 7103);
		chips.material.fragmentShader = chips.material.fragmentShader.replace("if(p.y>min(fade,partLife))discard;", "if(partLife<=0.||p.y>min(fade,partLife))discard;");
		const chipEnd = Math.max(...ch.map((r) => {
			const start = .6 + r[5] * .3;
			return start + (1.25 + r[5] * .45 - start) * .7;
		}));
		const chipMotion = ch.map((r, i) => {
			const angle = r[0] * Math.PI * 2, size = i < 10 ? .32 + r[1] * .32 : .06 + r[1] * r[1] * .22;
			const width = size * (1.3 + r[2]), length = size * (1.4 + r[3] * 1.8);
			const speed = Math.hypot(1.1 + r[7] * 3, Math.cos(angle) * (2 + r[2] * 3) + .6, Math.sin(angle) * (3 + r[3] * 3)) * FRAGMENT_IMPULSE;
			const axial = 1 - r[3] * (1 - Math.cos(22 * Math.PI / 180)), radial = Math.sqrt(Math.max(0, 1 - axial * axial));
			const vx = -speed * axial, vy = speed * radial * Math.cos(angle), vz = speed * radial * Math.sin(angle);
			const low = chips.bottom(width, length, size, -.45 - Math.abs(Math.sin(r[0] * 6)), Math.cos(r[4] * 6), Math.sin(r[5] * 6), r[6] * 6);
			const gap = 1.5 + (r[4] - .5) * .26 + low - .03, hit = (vy + Math.sqrt(vy * vy + 15.2 * gap)) / 7.6;
			return {
				angle,
				size,
				width,
				length,
				vx,
				vy,
				vz,
				gap,
				hit,
				rest: hit + 2 * (7.6 * hit - vy) * .28 / 7.6
			};
		});
		const brokenGeo = fracturedBladeGeometry$1(.12), brokenMaterial = iceMaterial("#95ddf6");
		const fragmentIndex = brokenGeo.attributes.fragmentIndex, fragmentVelocity = new Float32Array(fragmentIndex.count * 3);
		for (let i = 0; i < fragmentIndex.count; i++) {
			const f = fragmentIndex.getX(i), angle = f * 2.399, speed = Math.hypot((.35 + f * .16) * 3.55, Math.cos(angle) * 2.5 * .92, Math.sin(angle) * 2.8 * .92) * FRAGMENT_IMPULSE;
			const axial = Math.cos(10 * Math.PI / 180), radial = Math.sin(10 * Math.PI / 180);
			fragmentVelocity.set([
				-speed * radial * Math.cos(angle) / .92,
				-speed * axial / 3.55,
				speed * radial * Math.sin(angle) / .92
			], i * 3);
		}
		brokenGeo.setAttribute("fragmentVelocity", new three.BufferAttribute(fragmentVelocity, 3));
		brokenMaterial.uniforms.age = { value: 0 };
		brokenMaterial.vertexShader = "attribute vec3 fragmentPivot;attribute float fragmentIndex;attribute vec3 fragmentVelocity;uniform float age;\n" + brokenMaterial.vertexShader.replace("vec4 local=vec4(position,1.);", "float f=fragmentIndex;float move=(1.-exp(-age*3.))/3.;vec3 d=position-fragmentPivot;float c=cos(age*(f+1.2)),s=sin(age*(f+1.2));d.xz=mat2(c,s,-s,c)*d.xz;vec3 broken=fragmentPivot+d+fragmentVelocity*move;vec4 local=vec4(broken,1.);");
		brokenMaterial.vertexShader = brokenMaterial.vertexShader.replace("vec3 norm=normal;", "vec3 norm=normal;norm.xz=mat2(c,s,-s,c)*norm.xz;");
		const broken = new three.Mesh(brokenGeo, brokenMaterial);
		broken.position.set(-.95, 1.5, 0);
		broken.rotation.z = -Math.PI / 2;
		broken.scale.set(.92, 3.55, .92);
		chipLayer.add(broken);
		const wp = [], wu = [], wi = [], rows = 16, cols = 72;
		for (let j = 0; j <= rows; j++) for (let k = 0; k <= cols; k++) {
			const theta = j / rows * Math.PI * .5, a = k / cols * Math.PI * 2;
			wp.push(-Math.cos(theta) * .65, Math.sin(theta) * Math.cos(a), Math.sin(theta) * Math.sin(a));
			wu.push(k / cols, j / rows);
			if (j < rows && k < cols) {
				const b = j * 73 + k;
				wi.push(b, b + 1, b + cols + 1, b + 1, b + cols + 2, b + cols + 1);
			}
		}
		const wg = new three.BufferGeometry();
		wg.setAttribute("position", new three.Float32BufferAttribute(wp, 3));
		wg.setAttribute("uv", new three.Float32BufferAttribute(wu, 2));
		wg.setIndex(wi);
		const wU = { opacity: { value: 0 } };
		const wm = new three.ShaderMaterial({
			uniforms: wU,
			transparent: true,
			depthWrite: false,
			depthTest: true,
			side: three.DoubleSide,
			blending: three.AdditiveBlending,
			vertexShader: "varying vec2 v;varying vec3 p;void main(){v=uv;vec4 world=modelMatrix*vec4(position,1.);p=position;gl_Position=projectionMatrix*viewMatrix*world;}",
			fragmentShader: "uniform float opacity;varying vec2 v;void main(){float rim=exp(-pow((v.y-.92)*20.,2.));gl_FragColor=vec4(.46,.85,1.,opacity*(.08+rim*.7));\n#include <colorspace_fragment>\n}"
		});
		const wave = new three.Mesh(wg, wm);
		wave.position.set(2.58, 1.5, 0);
		waveLayer.add(wave);
		const fog = fogCards(fogLayer, root, 18), fr = randomData(18, 7104);
		const dust = sprites(dustLayer, 84, {
			kind: 1,
			color: "#b5eafa",
			add: true
		}), dr = randomData(84, 7105);
		return { update(t) {
			const age = t - HIT, a = Math.max(0, age), active = age >= 0;
			for (const layer of layers) for (const o of layer.children) o.visible = active;
			if (!active) return;
			const flashFade = fade(a, 0, .1);
			flash.set(0, 2.6, 1.5, 0, 2.15 + a * 4, 2.15 + a * 4, flashFade * 1.3);
			flash.set(1, 2.58, 1.5, 0, 2.65 + a * 3, 2.65 + a * 3, flashFade * .25);
			flash.flush();
			ru.age.value = a;
			ru.opacity.value = fade(a, .015, .16);
			rayMesh.visible = a < .16;
			cr.forEach((r, i) => {
				const angle = i * 2.399 + r[0] * .55, dy = Math.max(-.35, Math.cos(angle)), dz = Math.sin(angle), d = .15 + drag(a, 5) * (4 + r[1] * 2), size = (i < 4 ? 1.35 : .7) + r[2] * .35;
				const life = fade(a, .14 + r[3] * .06, .32 + r[3] * .12);
				crown.set(i, 2.25 - d * (1.2 + r[4] * .6), 1.5 + dy * d * .18, dz * d * .22, .65 + r[5] * .45, size, .4 + r[6] * .35, -1, dy * .22, dz * .22, r[7] * 6 + a * (r[0] - .5) * 3, life);
			});
			crown.flush();
			crown.mesh.visible = a < .44;
			crown.material.uniforms.time.value = t;
			ch.forEach((r, i) => {
				const { angle, size, width, length, vx, vy, vz, gap, hit, rest } = chipMotion[i];
				const fadeStart = .6 + r[5] * .3, fadeEnd = fadeStart + (1.25 + r[5] * .45 - fadeStart) * .7, life = fade(a, fadeStart, fadeEnd);
				const stop = .12, start = rest - stop, u = Math.max(0, Math.min(1, (a - start) / stop));
				const motion = a < start ? a : start + stop * (u - u * u * .5);
				const d = motion <= hit ? chipAirTravel(motion) : chipAirTravel(hit) + chipAirSpeed(hit) * .55 * drag(motion - hit, 6);
				chips.set(i, 2.1 - r[6] * .6 + vx * d, 0, Math.sin(angle) * .12 + vz * d, width, length, size, -.45 - Math.abs(Math.sin(motion * (2 + r[1] * 5) + r[0] * 6)), Math.cos(motion * 3 + r[4] * 6), Math.sin(motion * 2 + r[5] * 6), r[6] * 6 + motion * 4, life, .03 + floorY(gap, vy, a, 0));
			});
			chips.flush();
			chips.mesh.visible = a < chipEnd;
			chips.material.uniforms.time.value = t;
			const brokenFade = fade(a, .22, .57);
			broken.visible = brokenFade > 0;
			brokenMaterial.uniforms.age.value = a;
			brokenMaterial.uniforms.time.value = t;
			brokenMaterial.uniforms.fade.value = brokenFade;
			const radius = .5 + 4 * a;
			wave.scale.set(radius, radius * .75, radius);
			wU.opacity.value = fade(a, 0, .45) * .7;
			wave.visible = a < .45;
			fog.forEach(({ mesh, u }, i) => {
				const r = fr[i], angle = r[0] * 6.283, d = drag(a, 2.2) * (2.2 + r[1] * 1.7), size = (.8 + r[2] * .7) * (1 + a * .65);
				mesh.position.set(2 - d * (.35 + r[3] * .65), 1.5 + Math.cos(angle) * d * .6 + a * .12, Math.sin(angle) * d);
				mesh.scale.set(size * (1 + r[4] * .25), size, 1);
				u.age.value = a;
				u.opacity.value = smooth(.02, .14, a) * fade(a, .45 + r[5] * .3, 1.65 + r[5] * .45) * (.25 + r[6] * .18);
				mesh.visible = a >= .02 && a < 2.1;
			});
			dr.forEach((r, i) => {
				const angle = r[0] * 6.283, d = drag(a, 2.6), size = .025 + r[1] * r[1] * .06, life = fade(a, .45 + r[2] * .35, 1.4 + r[2] * .5);
				dust.set(i, 2.3 - d * (1 + r[3] * 4), floorY(1.5, Math.cos(angle) * (1 + r[4] * 4), a, .04), Math.sin(angle) * d * (2 + r[5] * 4), size, size * (.6 + r[6] * .8), life * .75, r[7] * 6 + a);
			});
			dust.flush();
			dust.mesh.visible = a < 1.9;
		} };
	}

//#endregion
//#region src/effects/ice-magic/lance-energy.js
	const headAt = (t) => -1.8 + 4.4 * Math.max(0, Math.min(1, (t - .45) / .7));
	const burstAt = (t) => t >= .45 ? Math.exp(-(t - .45) * 24) : 0;

//#endregion
//#region src/effects/ice-magic/energy-sweep.js
	const energySpin = (t) => Math.max(0, t - .45) * Math.PI * 2 / .38;
	const launchFlare = (t) => t < .45 ? 0 : Math.exp(-(t - .45) * 19);
	const energyEnvelope = (t) => t < .45 ? 0 : 1 - smooth(1.15, 1.43, t);
	function energySweep(layer, { phase = 0, start = -3.15, length = 2.8, radius = .7, span = 3.7, width = .24, color = "#55dfff" } = {}) {
		const parts = [];
		for (const halo of [false, true]) {
			const positions = [], uv = [], indices = [], count = 64;
			for (let j = 0; j <= count; j++) {
				const q = j / count, shape = Math.pow(Math.sin(q * Math.PI), .7), a = phase + span * q, r = radius * (.82 + .18 * Math.sin(q * Math.PI));
				for (const sign of [-1, 1]) {
					const angle = a + sign * width * (halo ? 2.8 : 1) * shape / (2 * r);
					positions.push(start + length * q, Math.cos(angle) * r, Math.sin(angle) * r);
					uv.push(q, (sign + 1) / 2);
				}
				if (j < count) {
					const k = j * 2;
					indices.push(k, k + 1, k + 2, k + 2, k + 1, k + 3);
				}
			}
			const geometry = new three.BufferGeometry();
			geometry.setAttribute("position", new three.Float32BufferAttribute(positions, 3));
			geometry.setAttribute("uv", new three.Float32BufferAttribute(uv, 2));
			geometry.setIndex(indices);
			const u = {
				head: { value: 0 },
				spin: { value: 0 },
				flare: { value: 0 },
				release: { value: 0 },
				opacity: { value: 0 },
				time: { value: 0 },
				color: { value: new three.Color(color) }
			};
			const material = new three.ShaderMaterial({
				uniforms: u,
				transparent: true,
				depthTest: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending,
				vertexShader: `uniform float head,spin,flare,release;varying vec2 v;void main(){v=uv;vec3 p=position;float c=cos(spin),s=sin(spin);p.yz=mat2(c,s,-s,c)*p.yz*(1.+flare*.5)*(1.+release*.16);p.x=head+p.x*(1.-release*.68);p.y+=1.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
				fragmentShader: `uniform float opacity,time;uniform vec3 color;varying vec2 v;void main(){float edge=abs(v.y-.5)*2.;float band=${halo ? "pow(max(0.,1.-edge),2.)*.24" : "1.-smoothstep(.65,1.,edge)"};float cap=smoothstep(0.,.04,v.x)*(1.-smoothstep(.96,1.,v.x));float traveling=.5+.5*cos((v.x-time/.38)*6.283185);float pulse=.64+.36*pow(traveling,4.);vec3 c=mix(color,vec3(.87,.98,1.),${halo ? "0." : "pow(max(0.,1.-edge*3.5),2.)*.65"});gl_FragColor=vec4(c,band*cap*pulse*opacity);\n#include <colorspace_fragment>\n}`
			});
			const mesh = new three.Mesh(geometry, material);
			mesh.frustumCulled = false;
			layer.add(mesh);
			parts.push(u);
		}
		return (t) => {
			const flare = launchFlare(t), release = 1 - Math.exp(-Math.max(0, t - 1.15) * 7);
			for (const u of parts) {
				u.head.value = headAt(t);
				u.spin.value = energySpin(t);
				u.flare.value = flare;
				u.release.value = release;
				u.time.value = Math.max(0, t - .45);
				u.opacity.value = energyEnvelope(t) * (.8 + flare * .65);
			}
		};
	}

//#endregion
//#region src/effects/ice-magic/ice-lance-study.js
	const names$2 = [
		"起勢冰光",
		"聚攏冰砂",
		"多面冰矛",
		"晶體內光",
		"矛尖亮芒",
		"軸向能量流",
		"脫落薄冰屑",
		"懸浮細霜",
		...impactNames,
		"鍛晶聚合",
		"晶縫鎖光",
		"發射氣浪"
	];
	function createEffect$2(options = {}) {
		const fx = createStudy("ice-lance-study", 4.35, names$2, options), L = fx.layers, geo = bladeGeometry$1(.12), mat = iceMaterial(), dark = iceMaterial("#479dcd"), chipMat = iceMaterial("#a4e2fa");
		const body = new three.Group();
		L[2].add(body);
		const shaft = crystal(body, geo, mat, 0, 0, 0, .92, 3.55, .92, -Math.PI / 2);
		const prongs = [];
		for (let i = 0; i < 3; i++) {
			const a = i * Math.PI * 2 / 3, o = crystal(body, geo, chipMat, .25, Math.cos(a) * .3, Math.sin(a) * .3, .68, 2.1, .68, -Math.PI / 2);
			prongs.push({
				o,
				a
			});
		}
		const energyUpdates = [
			energySweep(L[5], {
				phase: .2,
				start: -3.2,
				length: 2.8,
				radius: .96,
				span: 3.9,
				width: .29,
				color: "#55dfff"
			}),
			energySweep(L[5], {
				phase: 3.05,
				start: -2.65,
				length: 2.25,
				radius: .81,
				span: 2.6,
				width: .16,
				color: "#66bfff"
			}),
			energySweep(L[4], {
				phase: 1.4,
				start: -.68,
				length: .48,
				radius: .32,
				span: 4.1,
				width: .14,
				color: "#9befff"
			})
		];
		const crown = instanceBatch(L[2], geo, dark, 6);
		const wingGeo = new three.BufferGeometry(), wingP = [];
		const outline = [
			[
				-.35,
				0,
				0
			],
			[
				.8,
				.8,
				0
			],
			[
				1.9,
				.14,
				0
			],
			[
				1.15,
				0,
				0
			]
		], front = outline.map(([x, y, z]) => [
			x,
			y,
			z + .075
		]), back = outline.map(([x, y, z]) => [
			x,
			y,
			z - .075
		]);
		wingP.push(...front[0], ...front[2], ...front[1], ...front[0], ...front[3], ...front[2], ...back[0], ...back[1], ...back[2], ...back[0], ...back[2], ...back[3]);
		for (let i = 0; i < 4; i++) {
			const j = (i + 1) % 4;
			wingP.push(...front[i], ...front[j], ...back[i], ...front[j], ...back[j], ...back[i]);
		}
		wingGeo.setAttribute("position", new three.Float32BufferAttribute(wingP, 3));
		wingGeo.computeVertexNormals();
		const wings = [];
		for (let i = 0; i < 3; i++) {
			const w = new three.Mesh(wingGeo, chipMat);
			body.add(w);
			w.rotation.x = i / 3 * Math.PI * 2;
			w.position.x = .4;
			wings.push(w);
		}
		const inner = glowStroke(L[3], [-1, 1].map((sign) => [
			[
				.15,
				sign * .075,
				.12
			],
			[
				1.4,
				sign * .075,
				.12
			],
			[
				2.8,
				0,
				.08
			]
		]), {
			width: .035,
			normal: [
				0,
				0,
				1
			]
		});
		inner.core.u.color.value.set("#c6f4ff");
		const tip = sprites(L[4], 3, {
			kind: 3,
			color: "#d8f8ff",
			add: true
		});
		const tipCoreMaterial = new three.ShaderMaterial({
			uniforms: {
				tint: { value: new three.Color("#d8f8ff") },
				opacity: { value: 0 }
			},
			transparent: true,
			depthTest: true,
			depthWrite: false,
			blending: three.AdditiveBlending,
			vertexShader: "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
			fragmentShader: "uniform vec3 tint;uniform float opacity;void main(){gl_FragColor=vec4(tint,opacity);\n#include <colorspace_fragment>\n}"
		});
		const tipCore = new three.Mesh(new three.OctahedronGeometry(.09, 0), tipCoreMaterial);
		L[4].add(tipCore);
		const chips = instanceBatch(L[6], geo, chipMat, 34), rChips = randomData(34, 913);
		const frost = sprites(L[7], 32, {
			kind: 1,
			color: "#c4f3ff"
		}), rFrost = randomData(32, 914);
		const impact = createLanceImpact(L.slice(8, 15), fx.group);
		const start = createLanceStart({
			layers: {
				flash: L[0],
				gather: L[1],
				assembly: L[15],
				seams: L[16],
				launch: L[17]
			},
			body,
			shaft,
			prongs,
			wings,
			crown
		});
		tip.mesh.material.fragmentShader = `uniform vec3 tint;varying vec2 v;varying float life;
 void main(){float along=v.x*.5+.5;float width=max(.0001,.52*pow(max(0.,1.-along),.8)*smoothstep(-1.,-.65,v.x));float core=(1.-smoothstep(width*.55,width,abs(v.y)))*smoothstep(-1.,-.75,v.x);float glow=exp(-v.y*v.y*18.)*exp(-(v.x+.12)*(v.x+.12)*2.8)*.3;float a=max(core,glow)*life;if(a<.002)discard;gl_FragColor=vec4(tint,a);
 #include <colorspace_fragment>
 }`;
		tip.mesh.material.vertexShader = tip.mesh.material.vertexShader.replace("mv.xy+=p;", "vec3 flightAxis=(modelViewMatrix*vec4(1.,0.,0.,0.)).xyz;vec2 axis=flightAxis.xy/max(length(flightAxis),.0001);float len=length(axis);vec2 side=len>.0001?vec2(-axis.y,axis.x)/len:vec2(0.,1.);mv.xy+=axis*p.x+side*p.y;");
		fx.install((elapsed) => {
			const t = Math.max(0, elapsed - .35);
			const grow = smooth(.025, .44, t), head = -1.8 + 4.4 * sat((t - .45) / .7), age = t - 1.15, fade = 1 - smooth(1.15, 1.48, t), flight = windowFade(t, .02, 1.4, .2);
			body.position.set(head - 3.55 * grow, 1.5, 0);
			body.scale.setScalar(grow);
			prongs.forEach(({ o, a }, i) => {
				const assemble = smooth(.08 + i * .035, .45, t), spread = .22 + (1 - assemble) * 1.3;
				o.position.set(.24 - .7 * (1 - assemble), Math.cos(a + t * .45) * spread, Math.sin(a + t * .45) * spread);
				const shatter = Math.max(0, age) * 3.5;
				o.position.x -= shatter * (.7 + i * .35);
				o.position.y += shatter * (.5 + i * .28) - shatter * shatter * .3;
				o.position.z += Math.sin(a) * shatter * .5;
				o.rotation.set(a + t * .45 + shatter * (i + 1), shatter * .4, -Math.PI / 2 + (1 - assemble) * .45 + shatter * .6);
				o.scale.set(.68, 2.1, .68).multiplyScalar(1 - smooth(.5, 1.3, shatter));
			});
			wings.forEach((w, i) => {
				const shatter = Math.max(0, age) * 3.5, out = 1 - smooth(.65, 1.35, shatter);
				w.position.set(.4 - shatter * (.5 + i * .25), shatter * (.3 + i * .35) - shatter * shatter * .3, Math.sin(i * 2.1) * shatter * .5);
				w.rotation.set(i / 3 * Math.PI * 2 + t * .35 + shatter * (i + .4), shatter * .7, shatter * .25);
				w.scale.set(out, (.8 + .4 * (1 - smooth(.08, .45, t))) * out, out);
			});
			body.visible = grow > 0 && t < 1.55;
			shaft.visible = age < 0 && fade > 0;
			crown.mesh.visible = age < 0;
			mat.uniforms.fade.value = fade;
			dark.uniforms.fade.value = fade;
			mat.uniforms.time.value = t;
			dark.uniforms.time.value = t;
			for (let i = 0; i < 6; i++) {
				const a = i / 6 * 6.28, s = .3 * grow * fade;
				crown.set(i, head - 2.9, 1.5 + Math.cos(a) * .23, Math.sin(a) * .23, s, .65 * grow * fade, s, 0, 0, -Math.PI / 2 + Math.cos(a) * .4);
			}
			crown.flush();
			for (const r of [inner.core, inner.soft]) r.mesh.position.set(head - 3.4, 1.5, 0);
			inner.set(flight * .65, t, grow);
			energyUpdates.forEach((update) => update(t));
			const energyAge = Math.max(0, t - .45), spin = energySpin(t), burst = burstAt(t);
			smooth(1.15, 1.42, t);
			const power = 1 + burst * 1.7;
			const tipFade = t < .45 ? grow * .12 : energyEnvelope(t) * (.72 + launchFlare(t) * .8);
			tipCore.position.set(head - .045, 1.5, 0);
			tipCore.scale.setScalar(grow * (1 + burst * .7));
			tipCore.rotation.x = spin;
			tipCoreMaterial.uniforms.opacity.value = tipFade;
			const coreLength = .95 * (1 + burst * .9);
			tip.set(0, head - coreLength * .5, 1.5, 0, coreLength, .55 * power, tipFade * .95);
			for (let i = 1; i < 3; i++) {
				const a = spin + i * Math.PI, rad = (.1 + i * .035) * (1 + burst * .4), s = (i === 1 ? .5 : .3) * (1 + burst * .6);
				tip.set(i, head - .3 - s * .5, 1.5 + Math.cos(a) * rad, Math.sin(a) * rad, s, s * .5, tipFade * .65, 0);
			}
			tip.flush();
			rChips.forEach((r, i) => {
				const born = .48 + r[0] * .6, a = Math.max(0, t - born), source = -1.8 + 4.4 * (born - .45) / .7, f = windowFade(t, born, born + .9, .4), s = (.08 + r[1] * .1) * f;
				chips.set(i, source - a, 1.5 + (r[2] - .5) * a - a * a * .5, (r[3] - .5) * a * .8, s, s * .5, s, r[4] * 6 + a * 2, r[5] * 6, a);
			});
			chips.flush();
			rFrost.forEach((r, i) => {
				const q = (r[0] + energyAge / .38) % 1, angle = spin + r[2] * 6.28 + q * 2.5, rad = .72 + r[3] * .25, alpha = Math.sin(q * Math.PI) ** 2, age = Math.max(0, t - 1.15), release = 1 - Math.exp(-age * 5), size = .04 + r[6] * .035;
				frost.set(i, head - 3.05 + q * 2.65 + release * (1 - q) * 2.1, 1.5 + Math.cos(angle) * rad * (1 + launchFlare(t) * .5), Math.sin(angle) * rad * (1 + launchFlare(t) * .5), size, size * (2 + launchFlare(t)), energyEnvelope(t) * alpha * .7, angle);
			});
			frost.flush();
			impact.update(t);
			for (const index of [
				3,
				4,
				5,
				6,
				7
			]) for (const child of L[index].children) child.visible = elapsed >= .8;
			start.update(elapsed);
		});
		return fx;
	}

//#endregion
//#region src/effects/ice-magic/ice-kit.js
	function bladeGeometry(lean = .1) {
		const p = [], uv = [], sides = 6, levels = [
			[0, .12],
			[.2, .265],
			[.44, .205],
			[1, 0]
		], points = [];
		for (const [t, w] of levels) points.push(Array.from({ length: sides }, (_, k) => {
			const a = k * Math.PI / 3;
			return [
				lean * .24 * t + Math.cos(a) * w,
				t,
				Math.sin(a) * w * .72
			];
		}));
		const tri = (a, b, c) => {
			p.push(...a, ...b, ...c);
			uv.push(a[0], a[1], b[0], b[1], c[0], c[1]);
		};
		for (let j = 0; j < levels.length - 1; j++) for (let k = 0; k < sides; k++) {
			const next = (k + 1) % sides, a = points[j][k], b = points[j][next], c = points[j + 1][k], d = points[j + 1][next];
			tri(a, c, b);
			if (j < levels.length - 2) tri(b, c, d);
		}
		for (let k = 0; k < sides; k++) tri([
			0,
			0,
			0
		], points[0][k], points[0][(k + 1) % sides]);
		const g = new three.BufferGeometry();
		g.setAttribute("position", new three.Float32BufferAttribute(p, 3));
		g.setAttribute("uv", new three.Float32BufferAttribute(uv, 2));
		g.computeVertexNormals();
		return g;
	}
	function ribbon(layer, path, { width = .18, color = "#4edfff", normal = [
		0,
		0,
		1
	], glow = false } = {}) {
		const pos = [], uv = [], idx = [], up = new three.Vector3(...normal), tangent = new three.Vector3(), side = new three.Vector3();
		for (let i = 0; i < path.length; i++) {
			const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], q = i / (path.length - 1), w = width * Math.pow(Math.sin(q * Math.PI), .6);
			tangent.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
			side.crossVectors(tangent, up);
			if (side.lengthSq() < 1e-7) side.set(1, 0, 0);
			side.normalize().multiplyScalar(w * .5);
			for (const sign of [-1, 1]) {
				pos.push(path[i][0] + side.x * sign, path[i][1] + side.y * sign, path[i][2] + side.z * sign);
				uv.push(q, (sign + 1) / 2);
			}
			if (i < path.length - 1) {
				const j = i * 2;
				idx.push(j, j + 1, j + 2, j + 2, j + 1, j + 3);
			}
		}
		const g = new three.BufferGeometry();
		g.setAttribute("position", new three.Float32BufferAttribute(pos, 3));
		g.setAttribute("uv", new three.Float32BufferAttribute(uv, 2));
		g.setIndex(idx);
		const u = {
			time: { value: 0 },
			opacity: { value: 1 },
			color: { value: new three.Color(color) },
			reveal: { value: 1 },
			cutX: { value: 100 }
		};
		const m = new three.ShaderMaterial({
			uniforms: u,
			transparent: true,
			depthWrite: false,
			depthTest: true,
			side: three.DoubleSide,
			blending: three.AdditiveBlending,
			vertexShader: "varying vec2 v;varying vec3 p;void main(){v=uv;p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
			fragmentShader: `uniform float time,opacity,reveal,cutX;uniform vec3 color;varying vec2 v;varying vec3 p;void main(){if(p.x>cutX)discard;float edge=abs(v.y-.5)*2.;float band=${glow ? "pow(max(0.,1.-edge),2.)*.36" : "(1.-smoothstep(.52,1.,edge))"};float pulse=.65+.35*pow(.5+.5*sin(v.x*25.-time*12.),3.);float head=1.-smoothstep(reveal-.08,reveal,v.x);vec3 col=mix(color,vec3(.84,1.,1.),pow(max(0.,1.-edge*4.),4.)*.65);gl_FragColor=vec4(col,band*pulse*head*opacity);\n#include <colorspace_fragment>}`
		});
		const mesh = new three.Mesh(g, m);
		layer.add(mesh);
		return {
			mesh,
			u
		};
	}
	function luminousRibbon(layer, path, options = {}) {
		const core = ribbon(layer, path, options), halo = ribbon(layer, path, {
			...options,
			width: (options.width || .18) * 3.2,
			glow: true
		});
		return {
			core,
			halo,
			set(alpha, time = 0, reveal = 1) {
				for (const r of [core, halo]) {
					r.u.opacity.value = alpha;
					r.u.time.value = time;
					r.u.reveal.value = reveal;
				}
			},
			move(x, y, z) {
				core.mesh.position.set(x, y, z);
				halo.mesh.position.set(x, y, z);
			}
		};
	}
	function fracturedBladeGeometry(lean = .16) {
		const p = [], pivots = [], ids = [], levels = [
			[0, .12],
			[.2, .265],
			[.44, .205],
			[1, 0]
		], cuts = [
			0,
			.18,
			.36,
			.55,
			.74,
			1
		];
		const point = (y, k) => {
			let j = 0;
			while (j < levels.length - 2 && y > levels[j + 1][0]) j++;
			const a = levels[j], b = levels[j + 1], q = (y - a[0]) / (b[0] - a[0]), w = a[1] + (b[1] - a[1]) * q, angle = k * Math.PI / 3;
			return [
				lean * .24 * y + Math.cos(angle) * w,
				y,
				Math.sin(angle) * w * .72
			];
		};
		for (let part = 0; part < cuts.length - 1; part++) {
			const lo = cuts[part], hi = cuts[part + 1], ys = [
				lo,
				...levels.map((l) => l[0]).filter((y) => y > lo && y < hi),
				hi
			], pivot = [
				lean * .24 * (lo + hi) / 2,
				(lo + hi) / 2,
				0
			];
			const tri = (a, b, c) => {
				p.push(...a, ...b, ...c);
				for (let i = 0; i < 3; i++) {
					pivots.push(...pivot);
					ids.push(part);
				}
			};
			for (let j = 0; j < ys.length - 1; j++) for (let k = 0; k < 6; k++) {
				const next = (k + 1) % 6, a = point(ys[j], k), b = point(ys[j], next), c = point(ys[j + 1], k), d = point(ys[j + 1], next);
				tri(a, c, b);
				tri(b, c, d);
			}
			for (let k = 0; k < 6; k++) {
				const next = (k + 1) % 6;
				tri([
					lean * .24 * lo,
					lo,
					0
				], point(lo, k), point(lo, next));
				if (hi < 1) tri([
					lean * .24 * hi,
					hi,
					0
				], point(hi, next), point(hi, k));
			}
		}
		const g = new three.BufferGeometry();
		g.setAttribute("position", new three.Float32BufferAttribute(p, 3));
		g.setAttribute("fragmentPivot", new three.Float32BufferAttribute(pivots, 3));
		g.setAttribute("fragmentIndex", new three.Float32BufferAttribute(ids, 1));
		g.computeVertexNormals();
		return g;
	}

//#endregion
//#region src/effects/ice-magic/ice-shield-study.js
	const names$1 = [
		"曲面晶盾",
		"稜邊封條",
		"板間能量流",
		"晶面霜斑",
		"掠面反光帶",
		"結盾流光",
		"表面凝霜",
		"盾面寒氣",
		"周邊懸冰",
		"退場解體冰板"
	];
	const RX = 1.48;
	const RY = 1.63;
	const CY = 1.84;
	const zAt = (x, y) => .92 * (1 - (x / RX) ** 2 - ((y - CY) / RY) ** 2);
	const vertex = `attribute vec3 pivot;attribute float sector;uniform float time;varying vec3 p,n,eye;varying float part;
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
void main(){float delay=.02+sector*.003;float g=smoothstep(delay,delay+.43,time);vec3 local=position-pivot;mat3 turn=rz((1.-g)*sin(sector*2.4)*.55);vec3 pos=pivot+turn*local*(.985*g);pos+=vec3(pivot.x*.28,-.65,.4)*(1.-g);vec3 norm=turn*normal;
if(time>=3.4){float a=max(0.,time-3.4-mod(sector,5.)*.022);mat3 fall=ry(sin(sector)*a*2.3)*rz(cos(sector)*a*1.8);pos=pivot+fall*local*.985+vec3(sin(sector*2.4)*a*.65,-a*a*(2.7+.55*mod(sector,4.)),cos(sector)*a*.45);norm=fall*normal;}
p=position;part=sector;n=normalize(normalMatrix*norm);vec4 mv=modelViewMatrix*vec4(pos,1.);eye=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
	function shieldGeometry(frontOnly = false) {
		const out = [], normPivot = [], parts = [];
		const addTile = (corners, id) => {
			const center = corners.reduce((v, p) => v.map((x, i) => x + p[i] / corners.length), [
				0,
				0,
				0
			]);
			center[2] = zAt(center[0], center[1]);
			const tri = (a, b, c) => {
				out.push(...a, ...b, ...c);
				for (let j = 0; j < 3; j++) {
					normPivot.push(...center);
					parts.push(id);
				}
			};
			const back = corners.map((p) => [
				p[0],
				p[1],
				p[2] - .18
			]), bc = [
				center[0],
				center[1],
				center[2] - .18
			];
			for (let k = 0; k < corners.length; k++) {
				const next = (k + 1) % corners.length;
				tri(center, corners[k], corners[next]);
				if (!frontOnly) {
					tri(bc, back[next], back[k]);
					tri(corners[next], corners[k], back[k]);
					tri(corners[next], back[k], back[next]);
				}
			}
		};
		let id = 0;
		const r = .42;
		for (let q = -3; q <= 3; q++) for (let row = -3; row <= 3; row++) {
			const cx = 1.5 * r * q, cy = Math.sqrt(3) * r * (row + q / 2);
			if ((cx / RX) ** 2 + (cy / RY) ** 2 > 1.2) continue;
			let poly = Array.from({ length: 6 }, (_, j) => {
				const a = j / 6 * Math.PI * 2;
				return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
			});
			for (let side = 0; side < 24 && poly.length; side++) {
				const a = side / 24 * Math.PI * 2, nx = Math.cos(a) / RX, ny = Math.sin(a) / RY, limit = Math.cos(Math.PI / 24), next = [];
				for (let i = 0; i < poly.length; i++) {
					const p = poly[i], b = poly[(i + 1) % poly.length], dp = p[0] * nx + p[1] * ny - limit, db = b[0] * nx + b[1] * ny - limit;
					if (dp <= 0) next.push(p);
					if (dp < 0 !== db < 0) {
						const t = dp / (dp - db);
						next.push([p[0] + (b[0] - p[0]) * t, p[1] + (b[1] - p[1]) * t]);
					}
				}
				poly = next;
			}
			if (poly.length < 3) continue;
			addTile(poly.map(([x, y]) => [
				x,
				CY + y,
				zAt(x, CY + y)
			]), id++);
		}
		const g = new three.BufferGeometry();
		g.setAttribute("position", new three.Float32BufferAttribute(out, 3));
		g.setAttribute("pivot", new three.Float32BufferAttribute(normPivot, 3));
		g.setAttribute("sector", new three.Float32BufferAttribute(parts, 1));
		g.computeVertexNormals();
		return g;
	}
	const surfacePreamble = `uniform float time,opacity,shiny;varying vec3 p,n,eye;varying float part;float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}vec2 uv(){return vec2(p.x/1.48,(p.y-1.84)/1.63);}float line(float d,float w){return 1.-smoothstep(w,w*2.,abs(d));}`;
	function createEffect$1(options = {}) {
		const fx = createStudy("ice-shield-study", 4.8, names$1, options), L = fx.layers, fullGeo = shieldGeometry(), frontGeo = shieldGeometry(true), all = [];
		function surface(layer, body, add = false, full = false) {
			const u = {
				time: { value: 0 },
				opacity: { value: 1 },
				shiny: { value: 1 }
			};
			const m = new three.ShaderMaterial({
				uniforms: u,
				vertexShader: vertex,
				fragmentShader: surfacePreamble + body,
				transparent: !full,
				depthWrite: full,
				depthTest: true,
				side: three.DoubleSide,
				blending: add ? three.AdditiveBlending : three.NormalBlending,
				polygonOffset: !full,
				polygonOffsetFactor: -1,
				polygonOffsetUnits: -1
			});
			const mesh = new three.Mesh(full ? fullGeo : frontGeo, m);
			mesh.frustumCulled = false;
			layer.add(mesh);
			const obj = {
				mesh,
				u
			};
			all.push(obj);
			return obj;
		}
		const solid = surface(L[0], `void main(){if(time<.02+part*.003)discard;float l=dot(normalize(n),normalize((viewMatrix*vec4(-.4,.8,1.,0.)).xyz));vec3 col=mix(vec3(.012,.055,.13),vec3(.035,.19,.32),step(.2,l));col=mix(col,vec3(.09,.36,.53),step(.65,l));col=mix(col,vec3(.65,.9,1.),step(.985,l));float r=length(uv());col*=.72+.28*(1.-r);col+=vec3(.0,.08,.1)*pow(1.-abs(normalize(n).z),2.);col*=.97+.03*fract(part*.618);vec3 light=normalize((viewMatrix*vec4(-.4,.8,1.,0.)).xyz);float spec=pow(max(0.,dot(normalize(n),normalize(light+normalize(eye)))),48.);col+=vec3(.68,.88,1.)*spec*shiny*1.4;gl_FragColor=vec4(col,1.);\n#include <colorspace_fragment>}`, false, true);
		const gem = new three.Mesh(new three.OctahedronGeometry(.37, 0), iceMaterial("#78d2f1"));
		L[0].add(gem);
		const broken = surface(L[9], solid.mesh.material.fragmentShader.slice(surfacePreamble.length), false, true);
		surface(L[1], `void main(){vec2 q=uv();float r=length(q),ang=atan(q.y,q.x),a=line(r-.98,.018);float diamond=line(abs(fract(ang/6.283185*24.+.5)-.5)*.24+abs(r-.88)-.05,.006);a=max(a,diamond);gl_FragColor=vec4(vec3(.65,.95,1.),a*opacity);\n#include <colorspace_fragment>}`, true);
		surface(L[2], `void main(){vec2 q=uv();float r=length(q),a=atan(q.y,q.x);float seam=line(r-.81,.007)+line(sin(a*6.)*r,.006)*smoothstep(.72,.85,r);float pulse=.4+.6*pow(.5+.5*sin(r*17.-time*6.+a*2.),2.);gl_FragColor=vec4(vec3(.12,.71,.95),min(1.,seam)*pulse*opacity);\n#include <colorspace_fragment>}`, true);
		surface(L[3], `void main(){float m=sin(p.x*9.+sin(p.y*5.))*sin(p.y*7.-p.x*4.);float frost=smoothstep(.45,.9,m)*.22;gl_FragColor=vec4(vec3(.42,.71,.84),frost*opacity);\n#include <colorspace_fragment>}`);
		surface(L[4], `void main(){float a=line(p.y-p.x*.45-(.2+mod(time*.9,3.9)),.09);gl_FragColor=vec4(vec3(.75,.96,1.),a*.42*opacity);\n#include <colorspace_fragment>}`, true);
		const cast = [];
		for (let i = 0; i < 3; i++) {
			const off = i * 2.094;
			cast.push(luminousRibbon(L[5], Array.from({ length: 65 }, (_, j) => {
				const a = off + j / 64 * 1.65;
				return [
					Math.cos(a) * 1.75,
					CY + Math.sin(a) * 1.86,
					.25 + Math.sin(a * 2) * .25
				];
			}), {
				width: .13,
				color: "#61dbfa",
				normal: [
					0,
					0,
					1
				]
			}));
		}
		surface(L[6], `void main(){vec2 q=uv();float r=length(q);float stria=pow(max(0.,sin(atan(q.y,q.x)*18.+r*12.)),25.);float patches=smoothstep(.45,.9,r)*stria;gl_FragColor=vec4(vec3(.69,.91,1.),patches*opacity*.45);\n#include <colorspace_fragment>}`);
		const mist = sprites(L[7], 36, {
			kind: 0,
			color: "#87d8ef"
		}), rMist = randomData(36, 721);
		const mistEmitters = rMist.map((r, i) => {
			const radius = .74 * Math.sqrt((i + .5) / rMist.length), angle = i * 2.399963229728653 + (r[0] - .5) * .28;
			const x = Math.cos(angle) * RX * radius, y = CY + Math.sin(angle) * RY * radius;
			const nx = 1.84 * x / (RX * RX), ny = 1.84 * (y - CY) / (RY * RY), length = Math.hypot(nx, ny, 1);
			return {
				x,
				y,
				z: zAt(x, y),
				nx: nx / length,
				ny: ny / length,
				nz: 1 / length,
				start: .34 + r[6] * .6,
				life: 1.2 + r[7] * .45
			};
		});
		const blade = bladeGeometry(.04), crown = instanceBatch(L[8], blade, iceMaterial("#9bdef5"), 20), rCrown = randomData(20, 722);
		fx.install((t) => {
			const active = 1 - smooth(4.2, 4.65, t), built = smooth(.5, .7, t);
			for (const o of all) {
				o.u.time.value = t;
				o.u.opacity.value = built * active;
			}
			gem.position.set(0, CY, .98);
			gem.scale.set(.9 * smooth(.14, .6, t), 1.2 * smooth(.14, .6, t), .7 * smooth(.14, .6, t));
			const gemFall = Math.max(0, t - 3.4);
			gem.position.y -= gemFall * gemFall * 3.9;
			gem.position.z += gemFall * .38;
			gem.rotation.set(gemFall * .8, gemFall * 1.2, gemFall * .35);
			gem.visible = gem.position.y > -.5;
			solid.mesh.visible = t < 3.4;
			broken.mesh.visible = t >= 3.4;
			cast.forEach((r, i) => r.set(windowFade(t, .03, .9, .4) * .72, t + i * .4, smooth(.03, .42, t)));
			rMist.forEach((r, i) => {
				const e = mistEmitters[i], cycle = Math.max(0, Math.floor((t - e.start) / e.life)), birth = e.start + cycle * e.life;
				const age = Math.max(0, t - birth), progress = age / e.life, travel = .045 + age * (.2 + r[2] * .05);
				const x = e.x + e.nx * travel + Math.sin(age * 2 + r[0] * 6.283185) * age * .035;
				const y = e.y + e.ny * travel + age * age * .07;
				const opacity = t >= birth && birth < 3.4 ? smooth(0, .16, age) * (1 - smooth(.48, 1, progress)) * windowFade(t, .34, 4.7, .65) : 0;
				mist.set(i, x, y, e.z + e.nz * travel, (.4 + r[4] * .23) * (1 + progress * .6), (.45 + r[5] * .22) * (1 + progress * .75), opacity * (1.3 + r[1] * .3), r[3] * 6.283185 + age * (r[0] - .5) * .45);
			});
			mist.flush();
			rCrown.forEach((r, i) => {
				const branch = Math.floor(i / 5), part = i % 5, a = [
					Math.PI / 2,
					.37,
					Math.PI - .29,
					-Math.PI / 2
				][branch], sign = part % 2 ? 1 : -1, side = part === 0 ? 0 : sign * (part < 3 ? .18 : .29), g = smooth(.08 + branch * .025, .58, t), fall = Math.max(0, t - 3.4 - branch * .025), spread = 1 + (1 - smooth(.1, .6, t)) * .35, rr = part < 3 ? 1.04 : 1.13, x = Math.cos(a) * RX * rr * spread - Math.sin(a) * side, y = CY + Math.sin(a) * RY * rr * spread + Math.cos(a) * side;
				const h = (part === 0 ? .65 : part < 3 ? .33 : .23) * g, angle = a + (part === 0 ? 0 : sign * .48);
				crown.set(i, x + Math.cos(a) * fall * .6, y - fall * fall * (3 + branch * .25), .02 + .03 * Math.sin(a) + fall * .25, (.85 - part * .09) * g, h, .62 * g, fall * .7, fall * Math.sin(a), angle - Math.PI / 2 + fall * Math.cos(a));
			});
			crown.flush();
		});
		return fx;
	}

//#endregion
//#region src/effects/ice-magic/frost-field.js
	const frostPixels = Uint8Array.from(atob("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AAAo/wAAKP8AACj/AAAo/wAAKP8AABP/AAAT/wAAE/8AABP/AAAT/wAAE/8AAAX/AAAF/wAABf8AAAX/AAAF/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAABP8AAAT/AAAE/wAABP8AAAT/AAAE/wAAEP8AABD/AAAQ/wAAEP8AABD/AAAl/wAAJf8AACX/AAAl/wAAJf8AACX/AABA/wAAQP8AAED/AABA/wAAQP8AAED/AABf/wAAX/8AAF//AABf/wAAX/8AAID/AACA/wAAgP8AAID/AACA/wAAgP8AAKL/AACi/wAAov8AAKL/AACi/wAAov8AAMH/AADB/wAAwf8AAMH/AADB/wAA3P8AANz/AADc/wAA3P8AANz/AADc/wAA7/8AAO//AADv/wAA7/8AAO//AADv/wAA/P8AAPz/AAD8/wAA/P8AAPz/AAD8/wAA//8AAP//AAD//wAA//8AAP//AAD5/wAA+f8AAPn/AACN/wAAjf8AAI3/AABr/wAAa/8AAGv/AABr/wAAa/8AAEv/AABL/wAAS/8AAEv/AABL/wAAS/8AAC7/AAAu/wAALv8AAC7/AAAu/wAALv8AABf/AAAX/wAAF/8AABf/AAAX/wAAF/8AAAj/AAAI/wAACP8AAAj/AAAI/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAv8AAAL/AAAC/wAAAv8AAAL/AAAC/wAADf8AAA3/AAAN/wAADf8AAA3/AAAg/wAAIP8AACD/AAAg/wAAIP8AACD/AAA5/wAAOf8AADn/AAA5/wAAOf8AADn/AABY/wAAWP8AAFj/AABY/wAAWP8AAHn/AAB5/wAAef8AAHn/AAB5/wAAef8AAJv/AACb/wAAm/8AAJv/AACb/wAAm/8AALr/AAC6/wAAuv8AALr/AAC6/wAA1v8AANb/AADW/wAA1v8AANb/AADW/wAA7P8AAOz/AADs/wAA7P8AAOz/AADs/wAA+v8AAPr/AAD6/wAA+v8AAPr/AAD6/wAA//8AAP//AAD//gAA//4AAP/9AAD7/QAA+/0AAPv8AAD7/AAA+/wAAPv7AADv+wAA7/sAAO/7AADv+gAA7/oAAO/6AADb+gAA2/oAANv6AADb+QAA2/kAAMD5AADA+QAAwPkAAMD5AADA+QAAwPkAAKH5AACh+QAAofkAAKH5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AAB5/wAAm/8AAJv/AACb/wAAm/8AAJv/AACb/wAAuv8AALr/AAC6/wAAuv8AALr/AADW/wAA1v8AANb/AADW/wAA1v8AANb/AADs/wAA7P8AAOz/AADs/wAA7P8AAOz/AAD6/gAA+v0AAPr9AAD6/AAA+vwAAPr8AAD/+wAA//sAAP/6AAD/+gAA//kAAPv5AAD7+QAA+/gAAPv4AAD7+AAA+/cAAO/3AADv9wAA7/cAAO/2AADv9gAA7/YAANv2AADb9gAA2/YAANv1AADb9QAAwPUAAMD1AADA9QAAwPUAAMD1AADA9QAAofUAAKH1AACh9QAAofUAAKH1AACh9QAAf/UAAH/1AAB/9gAAf/YAAH/2AABe9gAAXvYAAF72AABe9wAAXvcAAF73AAA+9wAAPvgAAD74AAA++AAAPvkAAD75AAAk+QAAJPoAACT6AAAk+wAAJPsAABD8AAAQ/AAAEPwAABD9AAAQ/QAAEP4AAAT/AAAE/wAABP8AAAT/AAAE/wAABP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAb/AAAG/wAABv8AAAb/AAAG/wAAFP8AABT/AAAU/wAAFP8AABT/AAAU/wAAKf8AACn/AAAp/wAAKf8AACn/AAAp/wAARf8AAEX/AABF/wAARf8AAEX/AABl/wAAZf8AAGX/AABl/wAAZf8AAGX/AACH/wAAh/8AAIf/AACH/wAAh/8AAIf/AACo/wAAqP8AAKj/AACo/wAAqP8AAMb/AADG/wAAxv8AAMb/AADG/wAAxv8AAOD/AADg/wAA4P8AAOD/AADg/wAA4P8AAPL/AADy/wAA8v8AAPL/AADy/wAA/f8AAP3/AAD9/wAA/f8AAP3/AAD9/wAA//8AAP//AAD//wAA//8AAP//AAD//wAA9/8AAPf/AAD3/wAA9/8AAPf/AAD3/wAA5/8AAOf/AADn/wAA5/8AAOf/AADQ/wAA0P8AAND/AACN/wAAjf8AAI3/AABr/wAAa/8AAGv/AABr/wAAa/8AAEv/AABL/wAAS/8AAEv/AABL/wAAS/8AAC7/AAAu/wAALv8AAC7/AAAu/wAALv8AABf/AAAX/wAAF/8AABf/AAAX/wAAF/8AAAj/AAAI/wAACP8AAAj/AAAI/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAv8AAAL/AAAC/wAAAv8AAAL/AAAC/wAADf8AAA3/AAAN/wAADf8AAA3/AAAg/wAAIP8AACD/AAAg/wAAIP8AACD/AAA5/wAAOf8AADn/AAA5/wAAOf8AADn/AABY/wAAWP8AAFj/AABY/wAAWP8AAHn/AAB5/wAAef8AAHn/AAB5/wAAef8AAJv/AACb/wAAm/8AAJv/AACb/wAAm/8AALr/AAC6/wAAuv8AALr/AAC6/wAA1v8AANb/AADW/wAA1v8AANb/AADW/wAA7P8AAOz/AADs/gAA7P4AAOz9AADs/QAA+vwAAPr8AAD6+wAA+vsAAPr6AAD6+gAA//kAAP/5AAD/+AAA//gAAP/4AAD79wAA+/cAAPv2AAD79gAA+/YAAPv2AADv9QAA7/UAAO/1AADv9AAA7/QAAO/0AADb9AAA2/QAANv0AADb8wAA2/MAAMDzAADA8wAAwPMAAMDzAADA8wAAwPMAAKHzAACh8wAAofMAAKHzAACh8wAAofMAAH/zAAB/8wAAf/QAAH/0AAB/9AAAXvQAAF70AABe9AAAXvUAAF71AABe9QAAPvYAAD72AAA+9gAAPvYAAD73AAA+9wAAJPgAACT4AAAk+AAAJPkAACT5AAAQ+gAAEPoAABD7AAAQ+wAAEPwAABD8AAAE/QAABP0AAAT+AAAE/gAABP8AAAT/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAG/wAABv8AAAb/AAAG/wAABv8AABT/AAAU/wAAFP8AABT/AAAU/wAAFP8AACn/AAAp/wAAKf8AACn/AAAp/wAAKf8AAEX/AABF/wAARf8AAEX/AABF/wAAZf8AAGX/AABl/wAAZf8AAGX/AABl/wAAh/8AAIf/AACH/wAAh/8AAIf/AACH/wAAqP8AAKj/AACo/wAAqP8AAKj/AADG/wAAxv8AAMb/AADG/wAAxv8AAMb/AADg/wAA4P8AAOD/AADg/wAA4P8AAOD/AADy/wAA8v8AAPL/AADy/wAA8v8AAP3/AAD9/wAA/f8AAP3/AAD9/wAA/f8AAP//AAD//wAA//8AAP//AAD//wAA//8AAPf/AAD3/wAA9/8AAPf/AAD3/wAA9/8AAOf/AADn/wAA5/8AAOf/AADn/wAA0P8AAND/AADQ/wAAjf8AAI3/AACN/wAAa/8AAGv/AABr/wAAa/8AAGv/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AAD//wAA//8AAP//AAD//wAA9/8AAPf/AAD3/wAA9/8AAPf/AAD3/wAA6P8AAOj/AADo/wAA6P8AAOj/AADo/wAA0f8AANH/AADR/wAA0f8AANH/AADR/wAAtP8AALT/AAC0/wAAtP8AALT/AACU/wAAlP8AAJT/AABL/wAAS/8AAEv/AAAv/wAAL/8AAC//AAAv/wAAL/8AABj/AAAY/wAAGP8AABj/AAAY/wAAGP8AAAj/AAAI/wAACP8AAAj/AAAI/wAACP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAL/AAAC/wAAAv8AAAL/AAAC/wAADf8AAA3/AAAN/wAADf8AAA3/AAAN/wAAH/8AAB//AAAf/wAAH/8AAB//AAAf/wAAOf8AADn/AAA5/wAAOf8AADn/AABX/wAAV/8AAFf/AABX/wAAV/8AAFf/AAB4/wAAeP8AAHj/AAB4/wAAeP8AAHj/AACa/wAAmv8AAJr/AACa/wAAmv8AALr/AAC6/wAAuv8AALr/AAC6/wAAuv8AANb/AADW/wAA1v8AANb/AADW/wAA1v8AAOv/AADr/wAA6/8AAOv/AADr/wAA+f8AAPn/AAD5/wAA+f8AAPn/AAD5/wAA//8AAP//AAD//wAA//8AAP//AAD//wAA+/8AAPv/AAD7/wAA+/8AAPv/AAD7/wAA7/8AAO//AADv/wAA7/8AAO//AADb/wAA2/8AANv/AADb/wAA2/8AANv/AADB/wAAwf8AAMH/AADB/wAAwf8AAMH/AACh/wAAof8AAKH/AACh/wAAof8AAID/AACA/wAAgP8AAID/AACA/wAAgP8AAF7/AABe/wAAXv8AAF7/AABe/wAAXv8AAD//AAA//wAAP/8AAD//AAA//wAAJP8AACT/AAAk/wAAJP8AACT/AAAk/wAAEP8AABD/AAAQ/wAAEP8AABD/AAAQ/wAABP8AAAT/AAAE/wAABP8AAAT/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAF/wAABf8AAAX/AAAF/wAABf8AAAX/AAAT/wAAE/8AABP/AAAT/wAAE/8AABP/AAAp/wAAKf8AACn/AAAp/wAAKf8AAEX/AABF/wAARf8AAEX/AABF/wAARf8AAGT/AABk/wAAZP8AAGT/AABk/wAAZP8AAIb/AACG/wAAhv8AAIb/AACG/wAAp/8AAKf/AACn/wAAp/8AAKf/AACn/wAAxv8AAMb/AADG/wAAxv8AAMb/AADG/wAA3/8AAN//AADf/wAA3/8AAN//AADy/wAA8v8AAPL/AADy/wAA8v8AAPL/AAD9/wAA/f8AAP3/AAD9/wAA/f8AAP3/AAD//wAA//8AAP//AAD//wAA//8AAPf/AAD3/wAA9/8AAPf/AAD3/wAA9/8AAOj/AADo/wAA6P8AAOj/AADo/wAA6P8AANH/AADR/wAA0f8AANH/AADR/wAA0f8AALT/AAC0/wAAtP8AALT/AAC0/wAAlP8AAJT/AACU/w=="), (c) => c.charCodeAt(0));

//#endregion
//#region src/effects/ice-magic/ground-freeze-study.js
	const names = [
		"凍結薄膜",
		"分枝霜脈",
		"前沿結晶齒",
		"冰脊",
		"直立冰簇",
		"晶間冰橋",
		"地表薄冰",
		"霜面反光",
		"破土冰霧",
		"翻湧冰氣",
		"滾動冰砂",
		"爆裂冰塵",
		"碎冰震波"
	];
	const arms = [
		[-2.83, 2.1],
		[-2.02, 2.65],
		[-1.23, 2.4],
		[-.35, 2.1],
		[.47, 2.7],
		[1.61, 2.3],
		[2.47, 2.8]
	].map(([angle, length]) => ({
		angle,
		length
	}));
	function warp(x, z) {
		const a = Math.atan2(z, x), r = Math.hypot(x, z), bend = .12 * r * Math.sin(r * 2 + a * .9);
		return [x + Math.sin(a) * bend, z - Math.cos(a) * bend];
	}
	const segments = [];
	for (let i = 0; i < arms.length; i++) {
		const { angle: a, length: l } = arms[i], co = Math.cos(a), si = Math.sin(a);
		for (let j = 0; j < 4; j++) {
			const d0 = j / 4 * l, d1 = (j + 1) / 4 * l, [x, z] = warp(co * d0, si * d0), [bx, bz] = warp(co * d1, si * d1);
			segments.push([
				x,
				z,
				bx,
				bz,
				.28 - j * .035
			]);
		}
		for (const d of [
			.7 + i % 3 * .08,
			1.35 + .13 * Math.sin(i),
			2 + .1 * Math.cos(i)
		]) for (const sign of [-1, 1]) {
			const len = .35 + .18 * (.5 + .5 * Math.sin(i * 3 + sign + d)), [x, z] = warp(co * d, si * d), [bx, bz] = warp(co * d + Math.cos(a + sign * (.8 + i * .06)) * len, si * d + Math.sin(a + sign * (.8 + i * .06)) * len);
			segments.push([
				x,
				z,
				bx,
				bz,
				.12
			]);
		}
	}
	function coverage(x, z) {
		let d = 99, vein = 99;
		for (const [ax, az, bx, bz, width] of segments) {
			const vx = bx - ax, vz = bz - az, q = sat(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)), dist = Math.hypot(x - ax - vx * q, z - az - vz * q), taper = Math.max(.025, 1 - smooth(.8, 1, q)), jag = 1 + .14 * Math.sin(x * 19 + z * 7) + .08 * Math.sin(x * 7 - z * 23);
			d = Math.min(d, dist / (width * taper * jag));
			vein = Math.min(vein, dist / (.02 * taper));
		}
		const a = Math.atan2(z, x), rad = Math.hypot(x, z), pool = 1.25 + .2 * Math.sin(a * 2 + .4) + .12 * Math.sin(a * 3 - 1);
		return [Math.max((1 - smooth(pool - .08, pool, rad)) * .94, 1 - smooth(.72, 1, d)), 1 - smooth(.5, 1, vein)];
	}
	function frostTexture() {
		const tex = new three.DataTexture(frostPixels, 256, 256, three.RGBAFormat);
		tex.minFilter = three.LinearFilter;
		tex.magFilter = three.LinearFilter;
		tex.generateMipmaps = false;
		tex.needsUpdate = true;
		return tex;
	}
	function createEffect(options = {}) {
		const fx = createStudy("ground-freeze-study", 5.2, names, options), L = fx.layers, texture = frostTexture(), geo = bladeGeometry(.16), mat = iceMaterial("#a0e4fa"), deep = iceMaterial("#5bb8dd");
		deep.uniforms.highlight.value = .25;
		const planeGeo = new three.PlaneGeometry(6.4, 6.4);
		planeGeo.rotateX(-Math.PI / 2);
		function film(layer, mode) {
			const u = {
				field: { value: texture },
				front: { value: 0 },
				retreat: { value: 1.1 },
				time: { value: 0 },
				opacity: { value: 1 }
			};
			const m = new three.ShaderMaterial({
				uniforms: u,
				transparent: true,
				depthWrite: false,
				depthTest: true,
				side: three.DoubleSide,
				vertexShader: "varying vec2 uv2;varying vec2 pos;void main(){pos=position.xz;uv2=position.xz/6.4+.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
				fragmentShader: `uniform sampler2D field;uniform float front,retreat,time,opacity;varying vec2 uv2,pos;void main(){vec4 f=texture2D(field,uv2);float frozen=f.r*(1.-smoothstep(front-.03,front,f.a));float remain=1.-smoothstep(retreat-.045,retreat,f.a);float lead=exp(-pow((f.a-front+.01)*80.,2.))*f.r;vec3 col=mix(vec3(.045,.3,.42),vec3(.32,.68,.8),f.b*.6);col+=vec3(.2,.6,.7)*lead;float alpha=frozen*remain*.82;${mode === 1 ? "col=vec3(.12,.38,.5);alpha=frozen*(1.-remain)*.28;" : mode === 2 ? "col=vec3(.7,.95,1.);float band=exp(-pow((pos.x*.6+pos.y-(mod(time*.8,4.)-2.))*6.,2.));alpha=frozen*remain*band*.32;" : ""}gl_FragColor=vec4(col,alpha*opacity);\n#include <colorspace_fragment>}`
			});
			const mesh = new three.Mesh(planeGeo, m);
			mesh.position.y = .018 + mode * .006;
			layer.add(mesh);
			return {
				mesh,
				u
			};
		}
		const base = film(L[0], 0), reflection = film(L[7], 2);
		const haloU = {
			field: { value: texture },
			front: { value: 0 },
			time: { value: 0 },
			opacity: { value: 1 }
		};
		const haloM = new three.ShaderMaterial({
			uniforms: haloU,
			transparent: true,
			depthWrite: false,
			depthTest: true,
			side: three.DoubleSide,
			blending: three.AdditiveBlending,
			vertexShader: "varying vec2 v;void main(){v=position.xz/6.4+.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
			fragmentShader: `uniform sampler2D field;uniform float front,time,opacity;varying vec2 v;void main(){float mask=0.;for(int k=0;k<5;k++){float a=float(k)*1.256;vec4 f=texture2D(field,v+vec2(cos(a),sin(a))*.012);mask+=f.r*exp(-pow((f.a-front+.018)*25.,2.))*.2;}gl_FragColor=vec4(.12,.64,.9,mask*opacity*.6);\n#include <colorspace_fragment>}`
		});
		const frontGlow = new three.Mesh(planeGeo, haloM);
		frontGlow.position.y = .02;
		L[0].add(frontGlow);
		const trunk = glowStroke(L[1], arms.map(({ angle: a, length: l }) => Array.from({ length: 17 }, (_, j) => {
			const d = j / 16 * l, [x, z] = warp(Math.cos(a) * d, Math.sin(a) * d);
			return [
				x,
				.034,
				z,
				Math.hypot(x, z) / 3.2
			];
		})), {
			width: .045,
			color: "#63c9ec",
			flow: .3
		});
		trunk.core.u.color.value.set("#8bddee");
		const twigs = stroke(L[1], segments.filter((s, i) => i % 7 !== 0).map(([x, z, bx, bz]) => [[
			x,
			.033,
			z,
			Math.hypot(x, z) / 3.2
		], [
			bx,
			.033,
			bz,
			Math.hypot(bx, bz) / 3.2
		]]), {
			width: .016,
			color: "#6eb8d7"
		});
		function root(x, z) {
			[x, z] = warp(x, z);
			return {
				x,
				z,
				d: Math.hypot(x, z) / 3.2,
				coverage: coverage(x, z)[0]
			};
		}
		const toothData = [];
		arms.forEach(({ angle: a }, k) => {
			for (let j = 0; j < 6; j++) for (const sign of [-1, 1]) {
				const d = .45 + j * .31;
				toothData.push({
					...root(Math.cos(a) * d - Math.sin(a) * sign * .075, Math.sin(a) * d + Math.cos(a) * sign * .075),
					a: a + sign * .5,
					h: .14 + j % 3 * .08
				});
			}
		});
		const teeth = instanceBatch(L[2], geo, deep, toothData.length);
		const ridgeData = arms.flatMap(({ angle: a }, i) => [
			.32,
			.88,
			1.48
		].map((d, j) => {
			const dir = new three.Vector3(Math.cos(a), .4 + j * .08, Math.sin(a)).normalize(), e = new three.Euler().setFromQuaternion(new three.Quaternion().setFromUnitVectors(new three.Vector3(0, 1, 0), dir));
			return {
				...root(Math.cos(a) * d, Math.sin(a) * d),
				e,
				h: .86 + j * .16,
				w: .65 + j * .04
			};
		}));
		const ridges = instanceBatch(L[3], geo, deep, ridgeData.length);
		const clusterData = arms.flatMap(({ angle: a }, i) => Array.from({ length: 4 }, (_, j) => {
			const d = j === 0 ? 2.25 : 1.8 + (j - 1) * .16, side = j % 2 ? .07 : -.07;
			return {
				...root(Math.cos(a) * d - Math.sin(a) * side, Math.sin(a) * d + Math.cos(a) * side),
				a,
				h: j === 0 ? 1.45 + .4 * Math.sin(i * 2.1) : .55 + j * .2,
				w: j === 0 ? 1.7 : 1.1,
				tilt: .25 + j * .16
			};
		}));
		for (let i = 0; i < 6; i++) {
			const a = i / 6 * 6.28;
			clusterData.push({
				...root(Math.cos(a) * .32, Math.sin(a) * .32),
				a,
				h: 1.3 + .3 * Math.sin(i * 1.8),
				w: 1.35,
				tilt: .45
			});
		}
		clusterData.push({
			...root(0, 0),
			a: 0,
			h: 2.65,
			w: 2.6,
			tilt: 0
		});
		const crystals = instanceBatch(L[4], geo, mat, clusterData.length);
		const shatterMat = iceMaterial("#a0e4fa");
		shatterMat.uniforms.burstAge = { value: 0 };
		shatterMat.uniforms.groundClip.value = 1;
		shatterMat.vertexShader = `attribute vec3 fragmentPivot;attribute float fragmentIndex;uniform float burstAge;
 mat3 spinX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}mat3 spinY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
 ` + shatterMat.vertexShader;
		shatterMat.vertexShader = shatterMat.vertexShader.replace("localGroundHeight=local.y;", `vec3 pivot=(instanceMatrix*vec4(fragmentPivot,1.)).xyz;vec3 root=instanceMatrix[3].xyz;float seed=fract(sin(fragmentIndex*12.71+root.x*4.73+root.z*8.21)*43758.5453);float age=max(0.,burstAge);mat3 rotation=spinY(age*(seed-.5)*7.)*spinX(age*(.4+seed)*4.);float keep=1.-smoothstep(.95,1.6,age);vec2 direction=normalize(pivot.xz+vec2(cos(seed*6.28),sin(seed*6.28))*.5);vec3 velocity=vec3(direction.x*(2.+seed*2.5),2.6+seed*3.1,direction.y*(2.+seed*2.5));local.xyz=pivot+rotation*(local.xyz-pivot)*keep+velocity*age-vec3(0.,age*age*4.,0.);norm=rotation*norm;localGroundHeight=local.y;`);
		const fractureBodies = clusterData.filter((r) => r.coverage > .6);
		const fragments = instanceBatch(L[4], fracturedBladeGeometry(.16), shatterMat, fractureBodies.length);
		fractureBodies.forEach((r, i) => fragments.set(i, r.x, .025, r.z, r.w, r.h, r.w, Math.cos(r.a) * r.tilt, r.a, Math.sin(r.a) * r.tilt));
		fragments.flush();
		const bridgeData = arms.map(({ angle: a }, i) => {
			const b = arms[(i + 1) % 7].angle, x = Math.cos(a) * .6, z = Math.sin(a) * .6, target = new three.Vector3(Math.cos(b) * .6 - x, .1, Math.sin(b) * .6 - z), len = target.length(), e = new three.Euler().setFromQuaternion(new three.Quaternion().setFromUnitVectors(new three.Vector3(0, 1, 0), target.normalize()));
			return {
				...root(x, z),
				e,
				len
			};
		});
		const bridges = instanceBatch(L[5], geo, deep, bridgeData.length);
		const plates = instanceBatch(L[6], geo, iceMaterial("#a7dff1"), 28), rPlate = randomData(28, 735).map((r) => {
			const a = r[0] * Math.PI * 2, d = .3 + r[1] * 1.4;
			return {
				p: root(Math.cos(a) * d, Math.sin(a) * d),
				r
			};
		});
		const glints = sprites(L[7], 21, {
			kind: 3,
			color: "#d8faff",
			add: true
		});
		const frontMist = sprites(L[8], 64, {
			kind: 0,
			color: "#b7eafa"
		}), rFront = randomData(64, 731);
		const lowMist = sprites(L[9], 72, {
			kind: 0,
			color: "#7ac5e7"
		}), rLow = randomData(72, 732);
		const grit = instanceBatch(L[10], geo, iceMaterial("#9cdcf5"), 42), rGrit = randomData(42, 734);
		const endDust = sprites(L[11], 80, {
			kind: 0,
			color: "#c1e9f4"
		}), rEnd = randomData(80, 740);
		const endFlash = sprites(L[12], 3, {
			kind: 3,
			color: "#c2f3ff",
			add: true
		}), endWave = ring(L[12], {
			radius: 1,
			width: .075,
			color: "#a3e4f8"
		});
		endWave.mesh.position.y = .12;
		const frontAt = (t) => .035 + .88 * smooth(.015, .82, t);
		const ventData = [clusterData.at(-1), ...clusterData.filter((r, i) => i < 28 && i % 4 === 0)].filter((r) => r.coverage > .6);
		const birth = (r) => .11 + r.d * .65 + .035 * Math.sin(r.x * 5 + r.z * 3);
		const eruption = (t, r) => 1 - Math.pow(1 - sat((t - birth(r)) / .15), 3);
		const growth = (t, r) => eruption(t, r) * (r.coverage > .6 ? 1 : 0);
		const rootY = (t, r, h, w) => r.coverage > .6 ? .025 - (h + w * .65 + .2) * (1 - eruption(t, r)) : -10;
		for (const m of [
			mat,
			deep,
			plates.mesh.material,
			grit.mesh.material
		]) m.uniforms.groundClip.value = 1;
		fx.install((t) => {
			const front = frontAt(t), retreat = 1.02, fade = 1 - smooth(3.6, 3.95, t);
			for (const f of [base, reflection]) {
				f.u.front.value = front;
				f.u.retreat.value = retreat;
				f.u.time.value = t;
				f.u.opacity.value = fade;
			}
			haloU.front.value = front;
			haloU.time.value = t;
			haloU.opacity.value = windowFade(t, .01, 2.75, .6);
			reflection.mesh.visible = t > .5;
			trunk.set(fade * .8, t, front);
			for (const r of [trunk.core, trunk.soft]) r.u.clipRadius.value = retreat * 3.2;
			twigs.u.reveal.value = front;
			twigs.u.clipRadius.value = retreat * 3.2;
			twigs.u.opacity.value = fade * .6;
			for (const b of [
				teeth,
				ridges,
				crystals,
				bridges,
				plates
			]) b.mesh.visible = t < 3.6;
			fragments.mesh.visible = t >= 3.6;
			shatterMat.uniforms.burstAge.value = Math.max(0, t - 3.6);
			shatterMat.uniforms.time.value = t;
			toothData.forEach((r, i) => {
				const s = .32;
				teeth.set(i, r.x, rootY(t, r, r.h, s), r.z, s, r.h, s, Math.cos(r.a) * .45, r.a, Math.sin(r.a) * .45);
			});
			teeth.flush();
			ridgeData.forEach((r, i) => {
				const s = r.w;
				ridges.set(i, r.x, rootY(t, r, r.h, s), r.z, s, r.h, s, r.e.x, r.e.y, r.e.z);
			});
			ridges.flush();
			clusterData.forEach((r, i) => {
				const s = r.w;
				crystals.set(i, r.x, rootY(t, r, r.h, s), r.z, s, r.h, s, Math.cos(r.a) * r.tilt, r.a, Math.sin(r.a) * r.tilt);
			});
			crystals.flush();
			bridgeData.forEach((r, i) => {
				const s = .33;
				bridges.set(i, r.x, rootY(t, r, r.len, s) + .05, r.z, s, r.len, s, r.e.x, r.e.y, r.e.z);
			});
			bridges.flush();
			rPlate.forEach(({ r, p }, i) => {
				const g = growth(t, p);
				plates.set(i, p.x, .04, p.z, .5 * g, .1 * g, (.6 + r[2] * .9) * g, Math.PI / 2, r[3] * 6, r[4] * 6);
			});
			plates.flush();
			for (let i = 0; i < 21; i++) {
				const r = clusterData[i * 2 % clusterData.length], g = growth(t, r), age = t - (.25 + i * .025);
				const y = rootY(t, r, r.h, r.w) + r.h * .65;
				glints.set(i, r.x, Math.max(.02, y), r.z, .7, .7, y > .02 ? windowFade(age, 0, 1.3, .65) * g * .75 : 0);
			}
			glints.flush();
			rFront.forEach((r, i) => {
				const c = ventData[Math.floor(i / 8) % ventData.length], born = birth(c) - .015, age = Math.max(0, t - born), angle = r[0] * Math.PI * 2, travel = age * (1.15 + r[1] * 1.1), rise = .1 + .35 * age;
				frontMist.set(i, c.x + Math.cos(angle) * travel, rise, c.z + Math.sin(angle) * travel, .95 + Math.min(age, 1.1) * (1.1 + r[2]), .48 + Math.min(age, 1.1) * (.52 + r[3] * .25), windowFade(t, born, born + 1.2, .55) * (.62 + r[4] * .16), r[5] * 6 + age * .12);
			});
			frontMist.flush();
			rLow.forEach((r, i) => {
				const c = ventData[Math.floor(i / 9) % ventData.length], born = birth(c) + r[0] * .14, life = 1.65 + r[7] * .55, age = (Math.max(0, t - born) + r[6] * life) % life, a = r[1] * 6.283, travel = .1 + age * (.25 + r[2] * .32), cycle = smooth(0, .2, age) * (1 - smooth(life - .55, life, age)), active = smooth(born, born + .13, t) * (1 - smooth(3.65, 4.65, t));
				lowMist.set(i, c.x + Math.cos(a) * travel + Math.sin(age * .8 + r[3] * 6) * .12, .15 + age * (.2 + r[4] * .18), c.z + Math.sin(a) * travel, .8 + age * (.6 + r[5] * .7), .55 + age * (.45 + r[6] * .35), cycle * active * (.42 + r[0] * .17), r[3] * 6 + age * .16);
			});
			lowMist.flush();
			rGrit.forEach((r, i) => {
				const a = arms[Math.floor(i / 6)].angle, born = .08 + r[0] * .6, age = Math.max(0, t - born), d = .12 + age * (.7 + r[1]), s = (.04 + r[2] * .07) * windowFade(t, born, born + 1.7, .65);
				grit.set(i, Math.cos(a) * d, .04 + Math.abs(Math.sin(age * 7 + r[3] * 6)) * .055, Math.sin(a) * d, s, s * .75, s, age * 3, r[4] * 6, age * 2);
			});
			grit.flush();
			const burst = t - 3.6, age = Math.max(0, burst), flash = burst >= 0 ? 1 - smooth(0, .2, age) : 0;
			for (let i = 0; i < 3; i++) endFlash.set(i, 0, .55 + i * .25, 0, 2.2 + i * .65, 1.8 + i * .5, flash * (i === 0 ? .9 : .35), i * .7);
			endFlash.flush();
			endWave.mesh.scale.setScalar(.15 + age * 5);
			endWave.u.opacity.value = burst >= 0 ? (1 - smooth(.06, .6, age)) * .7 : 0;
			rEnd.forEach((r, i) => {
				const a = r[0] * 6.283, d = .3 + age * (1.4 + r[1] * 2.4), f = burst >= 0 ? smooth(0, .05, age) * (1 - smooth(.6 + r[2] * .2, 1.5, age)) : 0;
				endDust.set(i, Math.cos(a) * d, .2 + age * (.25 + r[3] * .5), Math.sin(a) * d, .7 + age * (.7 + r[4]), .4 + age * (.35 + r[5] * .4), f * (.45 + r[6] * .2), r[7] * 6 + age * .2);
			});
			endDust.flush();
		});
		return fx;
	}

//#endregion
//#region src/effects/ice-magic/refinement.js
	function refineCrystalPoint(x, y, z) {
		const axisX = .0384 * y;
		const radialX = x - axisX;
		const radialZ = z / .72;
		const angle = Math.atan2(radialZ, radialX);
		const facetScale = Math.hypot(radialX, radialZ) < 1e-6 ? 1 : .94 + .09 * Math.sin(3 * angle + .5) + .045 * Math.sin(5 * angle + 1.4);
		return [
			axisX + radialX * facetScale + .018 * y,
			y,
			z * facetScale
		];
	}
	function refineGeometry(source) {
		const geometry = source.clone();
		for (const name of ["position", "fragmentPivot"]) {
			const attribute = geometry.getAttribute(name);
			if (!attribute) continue;
			for (let i = 0; i < attribute.count; i++) attribute.setXYZ(i, ...refineCrystalPoint(attribute.getX(i), attribute.getY(i), attribute.getZ(i)));
			attribute.needsUpdate = true;
		}
		geometry.computeVertexNormals();
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();
		return geometry;
	}
	const noiseFunctions = `
float iceHash(vec3 q) { return fract(sin(dot(q, vec3(127.1,311.7,74.7))) * 43758.5453); }
float iceNoise(vec3 q) {
  vec3 i=floor(q), f=fract(q); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(iceHash(i),iceHash(i+vec3(1,0,0)),f.x),
    mix(iceHash(i+vec3(0,1,0)),iceHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(iceHash(i+vec3(0,0,1)),iceHash(i+vec3(1,0,1)),f.x),
    mix(iceHash(i+vec3(0,1,1)),iceHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
`;
	const iceShading = `
vec3 normalDirection=normalize(n);
vec3 viewDirection=normalize(eye);
if(dot(normalDirection,viewDirection)<0.) normalDirection=-normalDirection;
vec3 lightDirection=normalize((viewMatrix*vec4(-.4,.7,1.,0.)).xyz);
float lightAmount=max(0.,dot(normalDirection,lightDirection));
float facing=clamp(dot(normalDirection,viewDirection),0.,1.);
float rim=pow(1.-facing,2.4);
float cloud=iceNoise(p*vec3(36.,7.,36.)+crystalSeed*17.);
float fine=iceNoise(p*vec3(86.,16.,86.)+crystalSeed*31.);
float veins=smoothstep(.47,.72,cloud)*.62;
float rime=(1.-smoothstep(.08,.55,p.y))*(.35+.65*fine);
float tipFrost=smoothstep(.48,.94,p.y)*(.6+.4*cloud);
float fissure=1.-smoothstep(.012,.045,abs(cloud-.51));
vec3 body=mix(iceBodyColor,iceShadowColor,facing*.62);
body*=.62+.52*lightAmount;
float frostAmount=clamp(veins*.5+rime*.65+tipFrost*.85+fissure*.23,0.,.94);
vec3 frost=iceFrostColor*(.79+.21*lightAmount);
vec3 col=mix(body,frost,frostAmount);
col=mix(col,iceFrostColor,rim*.55);
float specular=pow(max(0.,dot(normalDirection,normalize(lightDirection+viewDirection))),80.);
vec3 glint=iceFrostColor*specular*shiny*highlight*1.2;
glint/=1.+glint*.22;
col+=glint;
`;
	function refineMist(object, effect, card = false) {
		const material = object.material;
		if (!material.vertexShader.includes("v=uv*2.-1.;") || !(card ? material.vertexShader.includes("gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);") : material.vertexShader.includes("gl_Position=projectionMatrix*mv;"))) throw new Error("The source mist vertex shader changed; refusing an unchecked patch.");
		const count = object.geometry.instanceCount;
		if (!card) object.geometry.setAttribute("mistSeed", new three.InstancedBufferAttribute(Float32Array.from({ length: count }, (_, i) => i * .61803398875 % 1), 1));
		Object.assign(material.uniforms, {
			mistTime: { value: 0 },
			sceneDepth: { value: null },
			depthReady: { value: 0 },
			viewResolution: { value: new three.Vector2(1, 1) },
			cameraPlanes: { value: new three.Vector2(.1, 80) }
		});
		if (!card) material.vertexShader = "attribute float mistSeed;varying float puffSeed,mistViewDepth;\n" + material.vertexShader.replace("v=uv*2.-1.;", "v=uv*2.-1.;puffSeed=mistSeed;").replace("gl_Position=projectionMatrix*mv;", "mistViewDepth=-mv.z;gl_Position=projectionMatrix*mv;");
		else material.vertexShader = "varying float puffSeed,mistViewDepth,life;uniform float opacity,seed;\n" + material.vertexShader.replace("v=uv*2.-1.;", "v=uv*2.-1.;puffSeed=fract(seed);life=opacity;").replace("gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);", "vec4 mistView=viewMatrix*vec4(world,1.);mistViewDepth=-mistView.z;gl_Position=projectionMatrix*mistView;");
		material.fragmentShader = `
    uniform float mistTime,depthReady;
    uniform sampler2D sceneDepth;
    uniform vec2 viewResolution,cameraPlanes;
    varying vec2 v;
    varying float life,puffSeed,mistViewDepth;
    #include <packing>
    float puffHash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
    float puffNoise(vec2 q){
      vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);
      return mix(mix(puffHash(i),puffHash(i+vec2(1,0)),f.x),
        mix(puffHash(i+vec2(0,1)),puffHash(i+vec2(1,1)),f.x),f.y);
    }
    void main(){
      float radius=length(v);
      // Zero before the quad boundary: no visible rectangular clipping.
      float edge=1.-smoothstep(.60,.98,radius);
      if(edge<=.001||life<=.001) discard;
      vec2 q=v*2.6+vec2(puffSeed*23.,-mistTime*.19);
      q+=vec2(sin(q.y*1.6+mistTime*.23),cos(q.x*1.4-mistTime*.17))*.28;
      float cloud=puffNoise(q)*.58+puffNoise(q*2.07+13.)*.28+puffNoise(q*4.13+27.)*.14;
      float erosion=smoothstep(.25,.68,cloud+(1.-radius)*.20);
      float density=edge*erosion*(.28+.72*cloud);
      float intersection=1.;
      if(depthReady>.5){
        float sceneZ=texture2D(sceneDepth,gl_FragCoord.xy/viewResolution).x;
        float distanceToSurface=-perspectiveDepthToViewZ(sceneZ,cameraPlanes.x,cameraPlanes.y)-mistViewDepth;
        intersection=smoothstep(0.,.38,distanceToSurface);
      }
      float alpha=density*life*intersection*.50;
      if(alpha<.002) discard;
      vec3 colour=mix(${effect.id === "ice-shield-study" ? "vec3(.10,.17,.21),vec3(.55,.67,.72)" : "vec3(.28,.35,.40),vec3(.77,.84,.87)"},cloud*.72+max(v.y,0.)*.12);
      gl_FragColor=vec4(colour,alpha);
      #include <colorspace_fragment>
    }`;
		if (card) material.fragmentShader = "varying vec3 localPoint;\n" + material.fragmentShader.replace("if(alpha<.002) discard;", "alpha*=smoothstep(.015,.13,localPoint.y)*(1.-smoothstep(2.50,2.61,localPoint.x));if(alpha<.002) discard;");
		const beforeRender = object.onBeforeRender;
		object.onBeforeRender = function(...args) {
			beforeRender.apply(this, args);
			material.uniforms.mistTime.value = effect.elapsed;
		};
		material.needsUpdate = true;
	}
	function refineIceEffect(effect, { geometry = false, material = true, stableRoots = false } = {}) {
		const geometryCache = /* @__PURE__ */ new Map();
		const materials = /* @__PURE__ */ new Set();
		try {
			effect.group.traverse((object) => {
				const ice = object.material;
				if (material && ice?.uniforms?.kind?.value === 0 && ice.blending === three.NormalBlending) refineMist(object, effect);
				if (material && ice?.uniforms?.inverseEffect && ice.uniforms.seed && ice.uniforms.age) refineMist(object, effect, true);
				const shieldPlate = !!object.geometry?.attributes.sector && ice?.transparent === false;
				if (shieldPlate && material) ice.uniforms.highlight = { value: 1 };
				if (!ice?.uniforms?.groundClip && !shieldPlate || !ice.uniforms.shiny || !object.geometry) return;
				if (geometry) {
					const source = object.geometry;
					if (!geometryCache.has(source)) geometryCache.set(source, refineGeometry(source));
					object.geometry = geometryCache.get(source);
				}
				if (material) {
					ice.uniforms.crystalSeedFromRoot = { value: stableRoots && object.parent.userData.layer !== 10 ? 1 : 0 };
					if (shieldPlate) ice.userData.refinedShieldPlate = true;
					materials.add(ice);
				}
			});
			for (const ice of materials) {
				const start = ice.fragmentShader.indexOf("float l=dot(");
				const end = ice.fragmentShader.indexOf("gl_FragColor=vec4(col,1.);", start);
				if (start < 0 || end < start) throw new Error("The source ice shader changed; refusing an unchecked material patch.");
				const paletteOutput = "gl_FragColor.rgb=recolorIce(gl_FragColor.rgb)*iceBloomGain;";
				if (!ice.fragmentShader.includes(paletteOutput)) throw new Error("The source palette output changed; refusing an unchecked material patch.");
				if (!/p=(position|sourcePosition)/.test(ice.vertexShader) || !ice.fragmentShader.includes("void main(){")) throw new Error("The source crystal shader changed; refusing unchecked seed injection.");
				ice.vertexShader = "varying float crystalSeed;uniform float crystalSeedFromRoot;\n" + ice.vertexShader.replace("void main(){", `void main(){
        crystalSeed=0.;
        #ifdef USE_INSTANCING
        crystalSeed=fract(sin(dot(instanceMatrix[3].xz,vec2(12.9898,78.233)))*43758.5453)*crystalSeedFromRoot;
        #endif
        `);
				ice.vertexShader = ice.vertexShader.replace("norm/=vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2]));", "norm/=max(vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2])),vec3(1e-8));");
				ice.uniforms.iceBodyColor = { value: new three.Color("#a9d9e5") };
				ice.uniforms.iceShadowColor = { value: new three.Color("#3e737a") };
				ice.uniforms.iceFrostColor = { value: new three.Color("#f2feff") };
				ice.fragmentShader = ice.fragmentShader.slice(0, start) + (ice.userData.refinedShieldPlate ? iceShading.replace(/\bp\b/g, "icePoint").replace("vec3 normalDirection=", "vec3 icePoint=vec3(p.x/2.96,(p.y-.21)/3.26,p.z);\nvec3 normalDirection=") : iceShading) + ice.fragmentShader.slice(end);
				ice.fragmentShader = ice.fragmentShader.replace(paletteOutput, "gl_FragColor.rgb*=iceBloomGain;");
				if (ice.userData.refinedShieldPlate) ice.fragmentShader = "uniform float highlight;\n" + ice.fragmentShader;
				ice.fragmentShader = "varying float crystalSeed;uniform vec3 iceBodyColor,iceShadowColor,iceFrostColor;\n" + ice.fragmentShader;
				ice.fragmentShader = ice.fragmentShader.replace("void main(){", noiseFunctions + "\nvoid main(){");
				ice.needsUpdate = true;
			}
		} catch (error) {
			effect.dispose();
			for (const source of geometryCache.keys()) source.dispose();
			throw error;
		}
		for (const source of geometryCache.keys()) source.dispose();
		if (material) {
			const setOptions = effect.setOptions;
			const syncBodyPalette = () => {
				const colour = new three.Color(effect.settings.color);
				const defaultColour = new three.Color("#d4e8ed");
				colour.setRGB(colour.r / defaultColour.r, colour.g / defaultColour.g, colour.b / defaultColour.b);
				for (const ice of materials) {
					ice.uniforms.iceBodyColor.value.set("#a9d9e5").multiply(colour);
					ice.uniforms.iceShadowColor.value.set("#3e737a").multiply(colour);
				}
			};
			effect.setOptions = (options) => {
				setOptions(options);
				if (!effect.disposed) syncBodyPalette();
			};
			syncBodyPalette();
		}
		return effect;
	}

//#endregion
//#region src/effects/ice-magic/bloom.js
	function createIceBloom(renderer) {
		const target = () => new three.WebGLRenderTarget(1, 1, {
			type: three.HalfFloatType,
			depthBuffer: true
		});
		const base = target(), mask = target(), blurX = target(), blurY = target();
		base.samples = 4;
		mask.samples = 4;
		mask.depthTexture = new three.DepthTexture(1, 1, three.UnsignedIntType);
		blurX.depthBuffer = false;
		blurY.depthBuffer = false;
		const black = new three.MeshBasicMaterial({
			color: 0,
			side: three.DoubleSide
		}), hidden = new three.MeshBasicMaterial({
			transparent: true,
			opacity: 0,
			depthWrite: false,
			colorWrite: false
		}), blackBackground = new three.Color(0);
		const vertex = "varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}";
		const blur = new three.ShaderMaterial({
			depthTest: false,
			depthWrite: false,
			uniforms: {
				source: { value: null },
				stepSize: { value: new three.Vector2() },
				extract: { value: 1 },
				threshold: { value: new three.Vector2(.015, .12) }
			},
			vertexShader: vertex,
			fragmentShader: `varying vec2 v;uniform sampler2D source;uniform vec2 stepSize;uniform float extract;uniform vec2 threshold;vec3 sampleLight(vec2 uv){vec3 c=texture2D(source,uv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));return c*mix(1.,smoothstep(threshold.x,threshold.y,l),extract);}void main(){vec3 c=sampleLight(v)*.227027;for(int i=1;i<=4;i++){float w=i==1?.194595:i==2?.121622:i==3?.054054:.016216;c+=(sampleLight(v+stepSize*float(i))+sampleLight(v-stepSize*float(i)))*w;}gl_FragColor=vec4(c,1.);}`
		});
		const mix = new three.ShaderMaterial({
			depthTest: false,
			depthWrite: false,
			uniforms: {
				base: { value: base.texture },
				glow: { value: blurY.texture },
				strength: { value: .77 }
			},
			vertexShader: vertex,
			fragmentShader: `varying vec2 v;uniform sampler2D base,glow;uniform float strength;void main(){gl_FragColor=vec4(texture2D(base,v).rgb+texture2D(glow,v).rgb*strength,1.);
#include <colorspace_fragment>
}`
		});
		const quad = new three_addons_postprocessing_Pass_js.FullScreenQuad(blur), size = new three.Vector2(), viewport = new three.Vector4(), scissor = new three.Vector4();
		const savedGains = /* @__PURE__ */ new Map(), depthUniforms = /* @__PURE__ */ new Set(), depthRecords = [];
		const records = [];
		let width = 0, height = 0, disposed = false;
		function render(scene, camera, { thresholdStart = .015, thresholdEnd = .12, strength = .77, surfaceGain = 1 } = {}) {
			blur.uniforms.threshold.value.set(thresholdStart, thresholdEnd);
			mix.uniforms.strength.value = strength;
			if (disposed) return;
			if (renderer.getRenderTarget() !== null) throw new Error("Ice bloom renders to the full canvas; render-target composition is not supported.");
			renderer.getDrawingBufferSize(size);
			if (width !== size.x || height !== size.y) {
				width = size.x;
				height = size.y;
				base.setSize(width, height);
				mask.setSize(width, height);
				blurX.setSize(Math.ceil(width / 2), Math.ceil(height / 2));
				blurY.setSize(Math.ceil(width / 2), Math.ceil(height / 2));
			}
			const previousTarget = renderer.getRenderTarget(), previousAuto = renderer.autoClear, previousColor = renderer.autoClearColor, previousDepth = renderer.autoClearDepth, previousStencil = renderer.autoClearStencil, previousTest = renderer.getScissorTest(), background = scene.background;
			renderer.getViewport(viewport);
			renderer.getScissor(scissor);
			let count = 0, depthCount = 0;
			try {
				renderer.setScissorTest(false);
				renderer.autoClear = true;
				renderer.autoClearColor = true;
				renderer.autoClearDepth = true;
				renderer.autoClearStencil = true;
				scene.background = blackBackground;
				scene.traverse((o) => {
					if (!o.material) return;
					const rec = records[count] ?? (records[count] = {});
					count++;
					rec.o = o;
					rec.material = o.material;
					rec.visible = o.visible;
					rec.uniform = null;
					rec.gain = 1;
					let root = o;
					while (root && !root.userData.iceMagic) root = root.parent;
					const m = o.material;
					if (m.uniforms?.sceneDepth && !depthUniforms.has(m.uniforms)) {
						depthUniforms.add(m.uniforms);
						const d = depthRecords[depthCount] ?? (depthRecords[depthCount] = {});
						depthCount++;
						d.u = m.uniforms;
						d.texture = d.u.sceneDepth.value;
						d.ready = d.u.depthReady.value;
						d.width = d.u.viewResolution.value.x;
						d.height = d.u.viewResolution.value.y;
						d.near = d.u.cameraPlanes.value.x;
						d.far = d.u.cameraPlanes.value.y;
						m.uniforms.sceneDepth.value = mask.depthTexture;
						m.uniforms.viewResolution.value.set(width, height);
						m.uniforms.cameraPlanes.value.set(camera.near, camera.far);
						m.uniforms.depthReady.value = 1;
					}
					if (root && m.uniforms?.iceBloomGain) {
						if (m.transparent && m.blending !== three.AdditiveBlending) o.visible = false;
						else {
							const uniform = m.uniforms.iceBloomGain;
							if (!savedGains.has(uniform)) savedGains.set(uniform, uniform.value);
							uniform.value = root.userData.iceMagic.settings.bloom / 1.1 * (m.uniforms.iceBodyColor ? surfaceGain : 1);
						}
					} else if (o.isMesh && Array.isArray(m)) {
						const maskMaterials = rec.maskMaterials ?? (rec.maskMaterials = []);
						maskMaterials.length = m.length;
						for (let i = 0; i < m.length; i++) maskMaterials[i] = m[i].transparent || !m[i].visible ? hidden : black;
						o.material = maskMaterials;
					} else if (o.isMesh && !m.transparent && m.visible) o.material = black;
					else o.visible = false;
				});
				renderer.setRenderTarget(mask);
				renderer.render(scene, camera);
				restore();
				renderer.setRenderTarget(base);
				renderer.render(scene, camera);
				quad.material = blur;
				blur.uniforms.source.value = mask.texture;
				blur.uniforms.extract.value = 1;
				blur.uniforms.stepSize.value.set(3.2 / width, 0);
				renderer.setRenderTarget(blurX);
				quad.render(renderer);
				blur.uniforms.source.value = blurX.texture;
				blur.uniforms.extract.value = 0;
				blur.uniforms.stepSize.value.set(0, 3.2 / height);
				renderer.setRenderTarget(blurY);
				quad.render(renderer);
				quad.material = mix;
				renderer.setRenderTarget(previousTarget);
				renderer.setViewport(viewport);
				renderer.setScissor(scissor);
				renderer.setScissorTest(previousTest);
				quad.render(renderer);
			} finally {
				for (let i = 0; i < depthCount; i++) {
					const d = depthRecords[i];
					d.u.sceneDepth.value = d.texture;
					d.u.depthReady.value = d.ready;
					d.u.viewResolution.value.set(d.width, d.height);
					d.u.cameraPlanes.value.set(d.near, d.far);
					d.u = null;
					d.texture = null;
				}
				depthUniforms.clear();
				restore();
				renderer.setRenderTarget(previousTarget);
				renderer.setViewport(viewport);
				renderer.setScissor(scissor);
				renderer.setScissorTest(previousTest);
				renderer.autoClear = previousAuto;
				renderer.autoClearColor = previousColor;
				renderer.autoClearDepth = previousDepth;
				renderer.autoClearStencil = previousStencil;
			}
			function restore() {
				scene.background = background;
				for (let i = 0; i < count; i++) {
					const r = records[i];
					r.o.material = r.material;
					r.o.visible = r.visible;
				}
				count = 0;
				for (const [uniform, value] of savedGains) uniform.value = value;
				savedGains.clear();
			}
		}
		function dispose() {
			if (disposed) return;
			disposed = true;
			records.length = 0;
			depthRecords.length = 0;
			depthUniforms.clear();
			for (const t of [
				base,
				mask,
				blurX,
				blurY
			]) t.dispose();
			black.dispose();
			hidden.dispose();
			blur.dispose();
			mix.dispose();
			quad.dispose();
		}
		return {
			render,
			dispose
		};
	}
	function attachIceRenderer(fx) {
		const pipelines = /* @__PURE__ */ new Map(), dispose = fx.dispose;
		fx.lifecycle = {
			start: 0,
			end: fx.duration
		};
		let count = 0;
		fx.group.traverse((o) => {
			if (o.isInstancedMesh) count += o.count;
			else if (o.geometry?.isInstancedBufferGeometry) count += o.geometry.instanceCount;
		});
		fx.particleCount = count;
		fx.render = (renderer, scene, camera) => {
			if (fx.disposed) return;
			let pipeline = pipelines.get(renderer);
			if (!pipeline) {
				pipeline = createIceBloom(renderer);
				pipelines.set(renderer, pipeline);
			}
			const roots = [];
			scene.traverseVisible((o) => {
				if (o.userData.iceMagic) roots.push(o);
			});
			const groundOnly = roots.length > 0 && roots.every((o) => o.name === "ground-freeze-study");
			pipeline.render(scene, camera, groundOnly ? {
				thresholdStart: .88,
				thresholdEnd: 1.1,
				strength: .03
			} : { surfaceGain: .04 });
		};
		fx.dispose = () => {
			if (fx.disposed) return;
			for (const p of pipelines.values()) p.dispose();
			pipelines.clear();
			dispose();
		};
		return fx;
	}

//#endregion
//#region src/effects/ice-magic/runtime.js
	function createIceMagic(id, options = {}) {
		const factory = {
			"ice-lance-study": createEffect$2,
			"ice-shield-study": createEffect$1,
			"ground-freeze-study": createEffect
		}[id];
		if (!factory) throw new Error("Unknown ice effect: " + id);
		const fx = refineIceEffect(factory({
			color: "#d4e8ed",
			bloom: 1.1,
			...options
		}), {
			geometry: id === "ground-freeze-study",
			stableRoots: id === "ground-freeze-study"
		});
		if (id === "ice-shield-study") fx.group.position.y = .6;
		return attachIceRenderer(fx);
	}

//#endregion
exports.createIceMagic = createIceMagic;
return exports;
})({}, THREE, __vfxDependency1);
const createIceMagic = __vfxModule.createIceMagic;

export const defaultOptions={"size":1,"speed":1,"bloom":1.1,"shiny":1,"color":"#d4e8ed"};
export default function createVFX(options={}){return createIceMagic("ice-lance-study",{...defaultOptions,...options});}
