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
// 雷焰龍捲 / Lightning Fire Tornado — Three.js r187 / WebGL2.
// Add fx.group at the ground center (XZ, +Y up); call update(deltaSeconds).
// One 15-second cast at speed 1. seek(seconds) scrubs; reset() replays.
// Normal renderer; no external assets or collisions. The named class retains its original looping and palette controls.
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

//#region src/effects/option-values.js
/** @param {unknown} value @param {number} min @param {number} max @param {number} fallback */
	function finiteRange(value, min, max, fallback) {
		return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
	}
	/** @param {unknown} value @param {string} fallback */
	function hexColor(value, fallback) {
		return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
	}

//#endregion
//#region src/effects/lightning-fire-tornado-runtime.js
/**
	* LightningFireTornadoVFX - AAA Anime-Style 3D Game VFX for Three.js (r128+)
	* User-supplied stylized fire and lightning tornado:
	* - Sculpted painterly volcanic-crimson/fire core funnel with blazing white-gold core slash
	* - Colossal sweeping upper hurricane canopy rings + wide mid-air orbiting wind-flame rings
	* - Blazing concentric ground vortex slash rings + molten scorch cracks
	* - Vivid cobalt-blue lightning coils, canopy crescent arcs, forked micro-branches & jewel needle stars
	* - Dense glittering pinpoint spark dust, velocity embers, tumbling 3D rim-lit debris & atmospheric mist
	* Zero IcosahedronGeometry, two-pass BackSide/FrontSide sorting, seamless periodic noise,
	* deterministic timeline scrubbing, and GPU-driven animation.
	*/
	var LightningFireTornadoVFX = class LightningFireTornadoVFX {
		static get PALETTES() {
			return {
				inferno: {
					fireA: "#d91644",
					fireB: "#ff8e1c",
					bolt: "#1a6bff",
					mix: 0
				},
				abyssal: {
					fireA: "#7c12d9",
					fireB: "#ff38b8",
					bolt: "#00e5ff",
					mix: 1
				},
				celestial: {
					fireA: "#0b5cff",
					fireB: "#26f7ff",
					bolt: "#ffbe2e",
					mix: 1
				},
				toxic: {
					fireA: "#0a9e48",
					fireB: "#9eff2e",
					bolt: "#c83dff",
					mix: 1
				},
				solar: {
					fireA: "#ff5500",
					fireB: "#ffe247",
					bolt: "#ff2b8a",
					mix: 1
				},
				frost: {
					fireA: "#1d4ed8",
					fireB: "#bae6fd",
					bolt: "#a78bfa",
					mix: 1
				}
			};
		}
		constructor(options = {}) {
			this.duration = options.duration || 15;
			this.scale = options.scale || 1;
			this.thickness = options.thickness || 1;
			this.density = options.density !== void 0 ? options.density : 1;
			this.lightningFreq = options.lightningFreq || 1;
			this.intensityScale = options.intensityScale || 1;
			this.palette = options.palette || "inferno";
			this.loop = options.loop !== void 0 ? options.loop : true;
			this.onComplete = typeof options.onComplete === "function" ? options.onComplete : null;
			this.quality = options.quality || "high";
			this.time = options.initialTime !== void 0 ? options.initialTime : this.duration * .16;
			this._completed = false;
			this.group = new three.Group();
			this._disposables = [];
			this._materials = [];
			this._tmpSpine = {
				x: 0,
				z: 0
			};
			const initPal = LightningFireTornadoVFX.PALETTES[this.palette] || LightningFireTornadoVFX.PALETTES.inferno;
			this.uniforms = {
				uTime: { value: this.time },
				uProgress: { value: this.time / this.duration },
				uIntensity: { value: 1 },
				uGrow: { value: 1 },
				uDissolve: { value: 0 },
				uBoltFreq: { value: this.lightningFreq },
				uFireColorA: { value: new three.Color(options.colors && options.colors.fireA ? options.colors.fireA : initPal.fireA) },
				uFireColorB: { value: new three.Color(options.colors && options.colors.fireB ? options.colors.fireB : initPal.fireB) },
				uBoltColor: { value: new three.Color(options.colors && options.colors.bolt ? options.colors.bolt : initPal.bolt) },
				uColorMix: { value: options.colors ? 1 : initPal.mix }
			};
			this._initLayers();
			this._injectColorRemap();
			this._applyTransform();
			this.setQuality(this.quality);
			this.setProgress(this.time / this.duration);
		}
		_injectColorRemap() {
			const header = `
      uniform vec3 uFireColorA;
      uniform vec3 uFireColorB;
      uniform vec3 uBoltColor;
      uniform float uColorMix;
      vec3 _applyVfxPalette(vec3 c) {
        if (uColorMix < 0.001) return c;
        float maxC = max(c.r, max(c.g, c.b));
        float minC = min(c.r, min(c.g, c.b));
        float sat = (maxC > 0.001) ? (maxC - minC) / maxC : 0.0;
        float isBolt = smoothstep(-0.06, 0.18, c.b - c.r);
        float warmMid = smoothstep(0.16, 0.92, c.g / max(c.r, 0.001));
        vec3 fireRemap = mix(uFireColorA, uFireColorB, warmMid);
        vec3 boltRemap = mix(uBoltColor, mix(uBoltColor, vec3(1.0), 0.55), smoothstep(0.32, 0.95, c.g / max(c.b, 0.001)));
        vec3 targetTint = mix(fireRemap, boltRemap, isBolt);
        vec3 remapped = mix(vec3(1.0), targetTint, clamp(sat * 1.15, 0.0, 1.0)) * maxC;
        return mix(c, remapped, uColorMix);
      }
    `;
			this._materials.forEach((mat) => {
				if (!mat || !mat.fragmentShader || mat._colorRemapPatched) return;
				mat.uniforms.uFireColorA = this.uniforms.uFireColorA;
				mat.uniforms.uFireColorB = this.uniforms.uFireColorB;
				mat.uniforms.uBoltColor = this.uniforms.uBoltColor;
				mat.uniforms.uColorMix = this.uniforms.uColorMix;
				mat.fragmentShader = header + "\n" + mat.fragmentShader.replace(/gl_FragColor\s*=\s*vec4\(([^;]+)\);/g, "{ vec4 _fc = vec4($1); gl_FragColor = vec4(_applyVfxPalette(_fc.rgb), _fc.a); }");
				mat._colorRemapPatched = true;
				mat.needsUpdate = true;
			});
		}
		_applyTransform() {
			this.group.scale.set(this.scale * this.thickness, this.scale, this.scale * this.thickness);
		}
		_applyInstanceCounts() {
			const ratio = (this.quality === "low" ? .45 : this.quality === "medium" ? .72 : 1) * Math.max(.125, Math.min(1, this.density));
			if (this._moteMesh) this._moteMesh.count = Math.max(60, Math.round(this._totalMotes * ratio));
			if (this._streakMesh) this._streakMesh.count = Math.max(50, Math.round(this._totalStreaks * ratio));
			if (this._debrisMesh) this._debrisMesh.count = Math.max(8, Math.round(this._totalDebris * ratio));
			if (this._ambientBoltMesh) this._ambientBoltMesh.count = Math.max(10, Math.round(this._totalAmbientBolts * ratio));
			if (this._flashNodeMesh) this._flashNodeMesh.count = Math.max(6, Math.round(this._totalFlashNodes * ratio));
		}
		setQuality(level) {
			this.quality = level === "low" ? "low" : level === "medium" ? "medium" : "high";
			this._applyInstanceCounts();
		}
		applyPalette(name) {
			const pal = LightningFireTornadoVFX.PALETTES[name];
			if (!pal) return;
			this.palette = name;
			this.uniforms.uFireColorA.value.set(pal.fireA);
			this.uniforms.uFireColorB.value.set(pal.fireB);
			this.uniforms.uBoltColor.value.set(pal.bolt);
			this.uniforms.uColorMix.value = pal.mix;
		}
		setColors({ fireA, fireB, bolt }) {
			this.palette = "custom";
			if (fireA) this.uniforms.uFireColorA.value.set(fireA);
			if (fireB) this.uniforms.uFireColorB.value.set(fireB);
			if (bolt) this.uniforms.uBoltColor.value.set(bolt);
			this.uniforms.uColorMix.value = 1;
		}
		setParams(params = {}) {
			if (params.scale !== void 0) this.scale = Math.max(.2, params.scale);
			if (params.thickness !== void 0) this.thickness = Math.max(.3, params.thickness);
			if (params.scale !== void 0 || params.thickness !== void 0) this._applyTransform();
			if (params.density !== void 0) {
				this.density = Math.max(.125, Math.min(1, params.density));
				this._applyInstanceCounts();
			}
			if (params.lightningFreq !== void 0) {
				this.lightningFreq = Math.max(.2, params.lightningFreq);
				this.uniforms.uBoltFreq.value = this.lightningFreq;
			}
			if (params.duration !== void 0) {
				const p = this.uniforms.uProgress.value;
				this.duration = Math.max(1.5, params.duration);
				this.setProgress(p);
			}
			if (params.intensityScale !== void 0) {
				this.intensityScale = Math.max(.2, params.intensityScale);
				this.setProgress(this.uniforms.uProgress.value);
			}
		}
		_rand(seed) {
			const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
			return x - Math.floor(x);
		}
		_getSpine(v, out) {
			const target = out || this._tmpSpine;
			target.x = Math.sin(v * Math.PI * 1.28 + .15) * .34 * v - .12 * Math.sin(v * Math.PI);
			target.z = Math.cos(v * Math.PI * 1.1 - .25) * .16 * v;
			return target;
		}
		_getRadius(v) {
			const base = .42;
			const stem = Math.pow(v, 1.75) * 1.38;
			const midWaist = Math.sin(Math.pow(v, 1.15) * Math.PI) * .24;
			const topFlare = Math.pow(Math.max(0, (v - .42) / .58), 1.4) * .68;
			return Math.max(.36, base + stem + midWaist + topFlare);
		}
		_createFunnelGeometry(radialSegs, heightSegs, radiusScale, height, yStart, twistOffset) {
			const positions = [];
			const normals = [];
			const uvs = [];
			const indices = [];
			const spine = {
				x: 0,
				z: 0
			};
			for (let iy = 0; iy <= heightSegs; iy++) {
				const v = iy / heightSegs;
				const y = yStart + v * height;
				const r = this._getRadius(v) * radiusScale;
				this._getSpine(v, spine);
				const drdy = (this._getRadius(Math.min(1, v + .02)) * radiusScale - r) / (height * .02 + 1e-4);
				for (let ix = 0; ix <= radialSegs; ix++) {
					const u = ix / radialSegs;
					const theta = u * Math.PI * 2 + twistOffset;
					const cosT = Math.cos(theta);
					const sinT = Math.sin(theta);
					positions.push(spine.x + cosT * r, y, spine.z + sinT * r);
					const nx = cosT, ny = -drdy, nz = sinT;
					const invLen = 1 / Math.hypot(nx, ny, nz);
					normals.push(nx * invLen, ny * invLen, nz * invLen);
					uvs.push(u, v);
				}
			}
			const stride = radialSegs + 1;
			for (let iy = 0; iy < heightSegs; iy++) for (let ix = 0; ix < radialSegs; ix++) {
				const a = iy * stride + ix;
				const b = a + 1;
				const c = (iy + 1) * stride + ix;
				const d = c + 1;
				indices.push(a, c, b);
				indices.push(b, c, d);
			}
			const geom = new three.BufferGeometry();
			geom.setAttribute("position", new three.Float32BufferAttribute(positions, 3));
			geom.setAttribute("normal", new three.Float32BufferAttribute(normals, 3));
			geom.setAttribute("uv", new three.Float32BufferAttribute(uvs, 2));
			geom.setIndex(indices);
			this._disposables.push(geom);
			return geom;
		}
		_createCloudTorusGeometry(configs) {
			const positions = [];
			const normals = [];
			const uvs = [];
			const ringIds = [];
			const indices = [];
			let vertOffset = 0;
			configs.forEach((cfg, idx) => {
				const radSegs = cfg.radSegs || 56;
				const tubeSegs = cfg.tubeSegs || 16;
				const tiltX = cfg.tiltX || 0;
				const tiltZ = cfg.tiltZ || 0;
				const cosTX = Math.cos(tiltX), sinTX = Math.sin(tiltX);
				const cosTZ = Math.cos(tiltZ), sinTZ = Math.sin(tiltZ);
				const idVal = idx / Math.max(1, configs.length);
				const ecc = cfg.ecc || 1.1;
				for (let it = 0; it <= tubeSegs; it++) {
					const v = it / tubeSegs;
					const phi = v * Math.PI * 2;
					const cosP = Math.cos(phi), sinP = Math.sin(phi);
					for (let ia = 0; ia <= radSegs; ia++) {
						const u = ia / radSegs;
						const th = u * Math.PI * 2;
						const cosT = Math.cos(th), sinT = Math.sin(th);
						const rx = (cfg.majorR + cosP * cfg.tubeR) * ecc;
						const rz = cfg.majorR + cosP * cfg.tubeR;
						let lx = cosT * rx;
						let ly = sinP * cfg.tubeY + Math.sin(th * 2 + idx) * (cfg.waveY || .08);
						let lz = sinT * rz;
						let nx = cosT * cosP;
						let ny = sinP * (cfg.tubeR / Math.max(.1, cfg.tubeY));
						let nz = sinT * cosP;
						const nLen = Math.hypot(nx, ny, nz) || 1;
						nx /= nLen;
						ny /= nLen;
						nz /= nLen;
						const y1 = ly * cosTX - lz * sinTX;
						const z1 = ly * sinTX + lz * cosTX;
						const x2 = lx * cosTZ - y1 * sinTZ;
						const y2 = lx * sinTZ + y1 * cosTZ;
						const ny1 = ny * cosTX - nz * sinTX;
						const nz1 = ny * sinTX + nz * cosTX;
						const nx2 = nx * cosTZ - ny1 * sinTZ;
						const ny2 = nx * sinTZ + ny1 * cosTZ;
						positions.push(x2, y2 + cfg.y, z1);
						normals.push(nx2, ny2, nz1);
						uvs.push(u, v);
						ringIds.push(idVal);
					}
				}
				const stride = radSegs + 1;
				for (let it = 0; it < tubeSegs; it++) for (let ia = 0; ia < radSegs; ia++) {
					const a = vertOffset + it * stride + ia;
					const b = a + 1;
					const c = a + stride;
					const d = c + 1;
					indices.push(a, b, c, b, d, c);
				}
				vertOffset += (tubeSegs + 1) * stride;
			});
			const geom = new three.BufferGeometry();
			geom.setAttribute("position", new three.Float32BufferAttribute(positions, 3));
			geom.setAttribute("normal", new three.Float32BufferAttribute(normals, 3));
			geom.setAttribute("uv", new three.Float32BufferAttribute(uvs, 2));
			geom.setAttribute("aRingId", new three.Float32BufferAttribute(ringIds, 1));
			geom.setIndex(indices);
			this._disposables.push(geom);
			return geom;
		}
		_createMergedHelicalRibbons(configs) {
			const positions = [];
			const normals = [];
			const uvs = [];
			const ribbonIds = [];
			const indices = [];
			const spine = {
				x: 0,
				z: 0
			};
			let vertOffset = 0;
			configs.forEach((cfg, idx) => {
				const segs = cfg.segs || 36;
				for (let i = 0; i <= segs; i++) {
					const t = i / segs;
					const v = cfg.vStart + (cfg.vEnd - cfg.vStart) * t;
					const clampedV = Math.min(1, Math.max(0, v));
					const y = .08 + v * 4.45;
					this._getSpine(clampedV, spine);
					const baseR = this._getRadius(clampedV);
					const flareOut = cfg.flareOut ? Math.pow(t, cfg.flarePow || 1.4) * cfg.flareOut : 0;
					const r = baseR * cfg.radiusMult + (cfg.radiusOffset || 0) + flareOut;
					const theta = cfg.angleStart + t * cfg.turns * Math.PI * 2;
					const cosT = Math.cos(theta);
					const sinT = Math.sin(theta);
					const taper = Math.sin(t * Math.PI) * Math.pow(1 - t * .45, .5);
					const halfW = cfg.width * taper;
					const tilt = cfg.tilt !== void 0 ? cfg.tilt : .4;
					const cx = spine.x + cosT * r;
					const cy = y;
					const cz = spine.z + sinT * r;
					const ox = cosT * halfW * tilt;
					const oy = halfW * (1 - tilt * .45);
					const oz = sinT * halfW * tilt;
					positions.push(cx - ox, cy - oy, cz - oz);
					positions.push(cx + ox, cy + oy, cz + oz);
					normals.push(cosT, .15, sinT);
					normals.push(cosT, .15, sinT);
					uvs.push(t, 0);
					uvs.push(t, 1);
					const idVal = idx / Math.max(1, configs.length);
					ribbonIds.push(idVal, idVal);
				}
				for (let i = 0; i < segs; i++) {
					const a = vertOffset + i * 2;
					const b = a + 1;
					const c = a + 2;
					const d = a + 3;
					indices.push(a, c, b);
					indices.push(b, c, d);
				}
				vertOffset += (segs + 1) * 2;
			});
			const geom = new three.BufferGeometry();
			geom.setAttribute("position", new three.Float32BufferAttribute(positions, 3));
			geom.setAttribute("normal", new three.Float32BufferAttribute(normals, 3));
			geom.setAttribute("uv", new three.Float32BufferAttribute(uvs, 2));
			geom.setAttribute("aRibbonId", new three.Float32BufferAttribute(ribbonIds, 1));
			geom.setIndex(indices);
			this._disposables.push(geom);
			return geom;
		}
		_createLightningBoltSet(bolts) {
			const positions = [];
			const uvs = [];
			const jitterDirs = [];
			const boltSeeds = [];
			const indices = [];
			const spine = {
				x: 0,
				z: 0
			};
			let vertOffset = 0;
			bolts.forEach((b, bIdx) => {
				const segs = b.segs || 24;
				const seed = b.seed !== void 0 ? b.seed : bIdx * 13.7 + 1.3;
				for (let i = 0; i <= segs; i++) {
					const t = i / segs;
					const v = b.vStart + (b.vEnd - b.vStart) * t;
					const clampedV = Math.min(1, Math.max(0, v));
					const y = .08 + v * 4.55;
					this._getSpine(clampedV, spine);
					const baseR = b.fixedR !== void 0 ? b.fixedR : this._getRadius(clampedV) * b.radiusMult + (b.radiusOffset || 0);
					const theta = b.angleStart + t * b.turns * Math.PI * 2;
					const cosT = Math.cos(theta);
					const sinT = Math.sin(theta);
					const cx = spine.x + cosT * baseR;
					const cy = y;
					const cz = spine.z + sinT * baseR;
					const env = Math.sin(t * Math.PI);
					const halfW = b.crescent ? b.width * Math.pow(env, 1.3) : b.width * (.22 + .78 * env);
					const perpX = cosT * halfW * .42;
					const perpY = halfW;
					const perpZ = sinT * halfW * .42;
					positions.push(cx - perpX, cy - perpY, cz - perpZ);
					positions.push(cx + perpX, cy + perpY, cz + perpZ);
					uvs.push(t, 0);
					uvs.push(t, 1);
					const jAmp = b.jitter * env;
					jitterDirs.push(cosT * jAmp, jAmp * .65, sinT * jAmp);
					jitterDirs.push(cosT * jAmp, jAmp * .65, sinT * jAmp);
					boltSeeds.push(seed, seed);
				}
				for (let i = 0; i < segs; i++) {
					const a = vertOffset + i * 2;
					const c = a + 2;
					indices.push(a, c, a + 1);
					indices.push(a + 1, c, c + 1);
				}
				vertOffset += (segs + 1) * 2;
			});
			const geom = new three.BufferGeometry();
			geom.setAttribute("position", new three.Float32BufferAttribute(positions, 3));
			geom.setAttribute("uv", new three.Float32BufferAttribute(uvs, 2));
			geom.setAttribute("aJitter", new three.Float32BufferAttribute(jitterDirs, 3));
			geom.setAttribute("aSeed", new three.Float32BufferAttribute(boltSeeds, 1));
			geom.setIndex(indices);
			this._disposables.push(geom);
			return geom;
		}
		_noiseGLSL() {
			return `
      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.52;
        for (int i = 0; i < 3; i++) {
          v += amp * vnoise(p);
          p = p * 2.07 + vec2(13.4, 7.1);
          amp *= 0.5;
        }
        return v;
      }
      float fbm2(vec2 p) {
        return vnoise(p) * 0.67 + vnoise(p * 2.07 + vec2(13.4, 7.1)) * 0.33;
      }
      float vnoisePeriodic(vec2 p, float periodX) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float ix0 = mod(i.x, periodX);
        float ix1 = mod(i.x + 1.0, periodX);
        float a = hash21(vec2(ix0, i.y));
        float b = hash21(vec2(ix1, i.y));
        float c = hash21(vec2(ix0, i.y + 1.0));
        float d = hash21(vec2(ix1, i.y + 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float fbmPeriodic(vec2 p, float periodX) {
        float v = 0.0;
        float amp = 0.52;
        float per = periodX;
        for (int i = 0; i < 3; i++) {
          v += amp * vnoisePeriodic(p, per);
          p = vec2(p.x * 2.0, p.y * 2.07 + 7.1);
          per *= 2.0;
          amp *= 0.5;
        }
        return v;
      }
    `;
		}
		_vortexVertexGLSL() {
			return `
      uniform float uTime;
      uniform float uGrow;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      varying float vHeight;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float h = clamp(pos.y / 4.6, 0.0, 1.0);
        vHeight = h;

        // Sculpted helical muscle ridge displacement along funnel surface
        float ripple = sin(uv.x * 12.56637 - uv.y * 16.0 + uTime * 4.2) * 0.085
                     + sin(uv.x * 18.84956 - uv.y * 24.0 + uTime * 5.6) * 0.038;
        pos.xz += normalize(normal.xz + vec2(1e-4)) * ripple * smoothstep(0.05, 0.35, h);

        pos.x += sin(uTime * 2.5 + h * 4.0) * 0.07 * h;
        pos.z += cos(uTime * 2.1 + h * 3.6) * 0.06 * h;

        float growScale = smoothstep(0.0, 1.0, uGrow);
        pos.y *= mix(0.08, 1.0, growScale);
        float radScale = mix(0.30, 1.0, smoothstep(0.0, 0.85, uGrow));
        pos.x *= radScale;
        pos.z *= radScale;

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;
		}
		_initLayers() {
			const noiseFn = this._noiseGLSL();
			const vortexVert = this._vortexVertexGLSL();
			const mainGeom = this._createFunnelGeometry(48, 36, 1, 4.45, .04, 0);
			const mainFrag = `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uDissolve;
      uniform float uIsBack;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      varying float vHeight;
      ${noiseFn}
      void main() {
        // True Domain-Warped fluid cyclone turbulence (deep wine-black shadow troughs vs rich crimson streams!)
        float coarseWarp = fbmPeriodic(vec2(vUv.x * 2.0 - vUv.y * 3.0 + uTime * 1.4, vUv.y * 2.8 - uTime * 1.6), 2.0);
        float spiralU = vUv.x * 3.0 - vUv.y * 4.8 + uTime * 2.2 + (coarseWarp - 0.5) * 1.6;
        float fluid1 = fbmPeriodic(vec2(spiralU, vUv.y * 3.6 - uTime * 1.9 + coarseWarp * 0.8), 3.0);
        float fluid2 = fbmPeriodic(vec2(spiralU * 2.0 + fluid1 * 1.4, vUv.y * 5.6 - uTime * 2.8), 6.0);
        // Sculptural swirling fluid troughs (deep dark wine valleys create 3D cyclone mass!)
        float swirlBands = sin((vUv.x * 2.0 - vUv.y * 4.2 + uTime * 1.6) * 6.28318 + fluid1 * 3.4) * 0.5 + 0.5;
        float fluidDensity = mix(swirlBands, fluid1 * 0.65 + fluid2 * 0.35, 0.52);

        // Luminous, fluid white-gold diagonal core plasma stream carving through deep wine-black cyclone
        float heroPhase = vUv.x * 1.0 - vUv.y * 1.68 + uTime * 1.32;
        float heroWave = sin(heroPhase * 6.28318 + coarseWarp * 2.1 + (fluid1 - 0.5) * 1.1) * 0.5 + 0.5;
        float plasmaStream = smoothstep(0.30, 0.78, pow(max(0.0, heroWave), 2.4) * (0.72 + 0.48 * fluid1));

        float energy = clamp(plasmaStream * 1.28 + pow(max(0.0, fluidDensity), 1.55) * 0.62, 0.0, 1.38);

        // Solid muscular volumetric funnel body at peak + rapid broken-mist dissipation at t=0.91
        float ndv = abs(dot(normalize(vNormalW), normalize(vViewDir)));
        float edgeFeather = smoothstep(0.0, mix(0.32, 0.82, uDissolve), ndv);
        float topFade = smoothstep(0.96, 0.58 + coarseWarp * 0.12, vUv.y);
        float botEdge = smoothstep(0.0, 0.08, vUv.y);

        float tearNoise = fbmPeriodic(vec2(vUv.x * 6.0 - vUv.y * 8.0 + uTime * 2.2, vUv.y * 8.0), 6.0);
        float dissolveMask = 1.0 - smoothstep(0.0, 0.26, uDissolve * (1.48 + (1.0 - vUv.y) * 0.58) - (tearNoise * 0.82 + plasmaStream * 0.18));
        float alpha = edgeFeather * topFade * botEdge * mix(0.98, dissolveMask, smoothstep(0.02, 0.15, uDissolve));
        if (alpha < 0.01) discard;

        // Deep velvety wine-black shadows -> rich crimson-magenta -> fiery scarlet -> luminous white-gold stream
        vec3 cDeepWine   = vec3(0.038, 0.001, 0.014);
        vec3 cCrimson    = vec3(0.74, 0.03, 0.20);
        vec3 cFireScar   = vec3(1.00, 0.24, 0.10);
        vec3 cBlazeGold  = vec3(1.00, 0.76, 0.24);
        vec3 cWhiteHot   = vec3(1.00, 0.99, 0.92);

        float whiteCool = 1.0 - smoothstep(0.08, 0.42, uDissolve);
        vec3 col = mix(cDeepWine, cCrimson, smoothstep(0.24, 0.56, energy));
        col = mix(col, cFireScar,  smoothstep(0.56, 0.78, energy));
        col = mix(col, cBlazeGold, smoothstep(0.76, 0.94, energy));
        col = mix(col, cWhiteHot,  smoothstep(0.92, 1.12, energy) * whiteCool);

        float rim = pow(1.0 - ndv, 2.0);
        col += vec3(0.96, 0.12, 0.28) * rim * 0.22;
        float arcStep = floor(uTime * 14.0);
        float arcPulse = step(0.60, fract(sin(arcStep * 43.17 + vUv.y * 8.0) * 43758.5453)) * (1.0 - uDissolve);
        col += vec3(0.14, 0.48, 1.00) * rim * arcPulse * 0.34;

        // Early molten crimson ember cooling during dissipation (zero grey-white lingering band!)
        col *= mix(vec3(1.0), vec3(1.18, 0.22, 0.12), smoothstep(0.05, 0.45, uDissolve));

        if (uIsBack > 0.5) {
          col *= vec3(0.40, 0.06, 0.12);
          alpha *= 0.86;
        }
        gl_FragColor = vec4(col * uIntensity, alpha * uIntensity);
      }
    `;
			const mainBackMat = new three.ShaderMaterial({
				uniforms: {
					...this.uniforms,
					uIsBack: { value: 1 }
				},
				transparent: true,
				depthWrite: false,
				side: three.BackSide,
				blending: three.NormalBlending,
				vertexShader: vortexVert,
				fragmentShader: mainFrag
			});
			const mainFrontMat = new three.ShaderMaterial({
				uniforms: {
					...this.uniforms,
					uIsBack: { value: 0 }
				},
				transparent: true,
				depthWrite: false,
				side: three.FrontSide,
				blending: three.NormalBlending,
				vertexShader: vortexVert,
				fragmentShader: mainFrag
			});
			const mainBackMesh = new three.Mesh(mainGeom, mainBackMat);
			mainBackMesh.renderOrder = 16;
			const mainFrontMesh = new three.Mesh(mainGeom, mainFrontMat);
			mainFrontMesh.renderOrder = 18;
			this.group.add(mainBackMesh, mainFrontMesh);
			this._materials.push(mainBackMat, mainFrontMat);
			const slashCoreGeom = this._createFunnelGeometry(40, 28, 1.035, 4.38, .08, .35);
			const slashCoreMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.FrontSide,
				blending: three.AdditiveBlending,
				vertexShader: vortexVert,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vHeight;
        ${noiseFn}
        void main() {
          float warp = fbmPeriodic(vec2(vUv.x * 4.0 - vUv.y * 6.0 + uTime * 2.5, vUv.y * 5.0 - uTime * 2.0), 4.0);
          float band = sin((vUv.x * 1.0 - vUv.y * 1.95 + uTime * 1.45) * 6.28318 + warp * 2.6) * 0.5 + 0.5;
          float teeth = fbmPeriodic(vec2(vUv.x * 8.0 - vUv.y * 10.0 + uTime * 4.0, vUv.y * 12.0), 8.0);
          float sharp = pow(band, 6.2) * (0.65 + 0.65 * teeth);
          float ends = smoothstep(0.0, 0.10, vUv.y) * smoothstep(0.88, 0.66, vUv.y);
          float cut = 0.24 + uDissolve * 0.72;
          float a = smoothstep(cut, cut + 0.34, sharp * ends) * 0.68 * uIntensity;
          if (a < 0.01) discard;
          float whiteCool = 1.0 - smoothstep(0.08, 0.42, uDissolve);
          vec3 col = mix(vec3(1.0, 0.24, 0.12), vec3(1.0, 0.98, 0.88), smoothstep(0.42, 0.80, sharp) * whiteCool);
          col *= mix(vec3(1.0), vec3(1.15, 0.22, 0.10), smoothstep(0.05, 0.45, uDissolve));
          gl_FragColor = vec4(col * a * 1.15, a);
        }
      `
			});
			const slashCoreMesh = new three.Mesh(slashCoreGeom, slashCoreMat);
			slashCoreMesh.renderOrder = 22;
			this.group.add(slashCoreMesh);
			this._materials.push(slashCoreMat);
			const canopyGeom = this._createCloudTorusGeometry([
				{
					majorR: 1.95,
					tubeR: .78,
					tubeY: .48,
					y: 3.45,
					tiltX: .05,
					tiltZ: .14,
					ecc: 1.1,
					waveY: .09,
					radSegs: 40,
					tubeSegs: 12
				},
				{
					majorR: 2.55,
					tubeR: .95,
					tubeY: .56,
					y: 3.95,
					tiltX: -.04,
					tiltZ: .17,
					ecc: 1.14,
					waveY: .11,
					radSegs: 44,
					tubeSegs: 12
				},
				{
					majorR: 3.1,
					tubeR: 1.05,
					tubeY: .52,
					y: 4.38,
					tiltX: .04,
					tiltZ: .15,
					ecc: 1.16,
					waveY: .12,
					radSegs: 48,
					tubeSegs: 12
				}
			]);
			const canopyMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.FrontSide,
				blending: three.NormalBlending,
				vertexShader: `
        attribute float aRingId;
        uniform float uTime;
        uniform float uGrow;
        varying vec2 vUv;
        varying float vId;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vId = aRingId;
          vec3 pos = position;
          float speed = 1.35 + aRingId * 0.85;
          float ang = uTime * speed + aRingId * 6.28318;
          float c = cos(ang), s = sin(ang);
          pos.xz = vec2(pos.x * c - pos.z * s, pos.x * s + pos.z * c);

          // Gentle organic billowing displacement along cloud normal
          float billow = sin(uv.x * 12.56637 - uTime * 2.8 + uv.y * 6.28318) * 0.12;
          pos += normal * billow;

          float g = smoothstep(0.0, 1.0, uGrow);
          pos.y *= mix(0.10, 1.0, g);
          float rs = mix(0.24, 1.0, smoothstep(0.08, 0.92, uGrow));
          pos.xz *= rs;

          vec3 rotN = vec3(normal.x * c - normal.z * s, normal.y, normal.x * s + normal.z * c);
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * rotN);
          vViewDir = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vId;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        ${noiseFn}
        void main() {
          // Bidirectional Fresnel soft-cloud dissolve: grazing silhouettes ALWAYS fade to 0.0 (ZERO sharp edges!)
          float ndv = abs(dot(normalize(vNormalW), normalize(vViewDir)));
          float fresnelSoft = pow(max(0.0, smoothstep(0.04, 0.72, ndv)), 1.65);

          // Domain-warped spiral hurricane cloud arms with rich dark negative-space breaks (no donut outline!)
          float uWrap = vUv.x * 4.0 - uTime * (1.4 + vId * 0.6) + vId * 8.0;
          float w = fbmPeriodic(vec2(uWrap, vUv.y * 3.0 + vId * 4.0), 4.0);
          float cloud = fbmPeriodic(vec2(uWrap * 2.0 + w * 1.6, vUv.y * 5.0 - uTime * 1.2), 8.0);
          float armBreak = sin((vUv.x * 2.0 + vId * 4.2 - uTime * 0.85) * 6.28318 + w * 3.2) * 0.5 + 0.5;
          float spiralArms = pow(armBreak, 1.32) * smoothstep(0.18, 0.74, cloud);
          float density = fresnelSoft * (0.20 + 0.92 * spiralArms) * (0.44 + 0.78 * cloud);

          // Broken-cloud organic erosion during dissipation
          float dissBreak = smoothstep(0.0, 0.34, cloud - uDissolve * 0.84);
          float cut = 0.10 + uDissolve * 0.66;
          float alpha = smoothstep(cut, cut + 0.36, density) * dissBreak * (1.0 - smoothstep(0.52, 0.95, uDissolve));
          if (alpha < 0.01) discard;

          vec3 cWine    = vec3(0.14, 0.005, 0.045);
          vec3 cCrimson = vec3(0.86, 0.04, 0.23);
          vec3 cGlow    = vec3(1.00, 0.26, 0.24);
          vec3 cSoftHi  = vec3(1.00, 0.76, 0.74);

          vec3 col = mix(cWine, cCrimson, smoothstep(0.14, 0.44, density));
          col = mix(col, cGlow,   smoothstep(0.46, 0.74, density));
          col = mix(col, cSoftHi, smoothstep(0.76, 0.96, density));
          col *= mix(vec3(1.0), vec3(1.08, 0.20, 0.12), smoothstep(0.18, 0.85, uDissolve));

          gl_FragColor = vec4(col * 0.98 * uIntensity, alpha * 0.78 * uIntensity);
        }
      `
			});
			const canopyMesh = new three.Mesh(canopyGeom, canopyMat);
			canopyMesh.renderOrder = 26;
			this.group.add(canopyMesh);
			this._materials.push(canopyMat);
			const midOrbitGeom = this._createFunnelGeometry(40, 24, 1.48, 4.35, .12, .5);
			const midOrbitMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.FrontSide,
				blending: three.NormalBlending,
				vertexShader: vortexVert,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        varying float vHeight;
        ${noiseFn}
        void main() {
          // Pure volumetric outer airflow sheath hugging the core (ZERO floating Saturn rings!)
          float ndv = abs(dot(normalize(vNormalW), normalize(vViewDir)));
          float fresnelSoft = pow(smoothstep(0.05, 0.75, ndv), 1.6);
          float w = fbmPeriodic(vec2(vUv.x * 3.0 - vUv.y * 4.0 + uTime * 1.6, vUv.y * 3.5 - uTime * 1.4), 3.0);
          float mist = fbmPeriodic(vec2(vUv.x * 6.0 - vUv.y * 6.5 + uTime * 2.4 + w * 1.2, vUv.y * 4.5 - uTime * 2.0), 6.0);
          float bands = sin((vUv.x * 2.0 - vUv.y * 3.5 + uTime * 1.3) * 6.28318 + w * 3.0) * 0.5 + 0.5;
          float ends = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
          float density = fresnelSoft * ends * (0.30 + 0.70 * bands) * (0.35 + 0.85 * mist);

          float dissBreak = smoothstep(0.0, 0.34, mist - uDissolve * 0.88);
          float cut = 0.08 + uDissolve * 0.74;
          float a = smoothstep(cut, cut + 0.38, density) * dissBreak * (1.0 - smoothstep(0.48, 0.92, uDissolve));
          if (a < 0.01) discard;

          vec3 col = mix(vec3(0.24, 0.01, 0.08), vec3(0.88, 0.08, 0.26), smoothstep(0.14, 0.54, density));
          col = mix(col, vec3(1.00, 0.66, 0.68), smoothstep(0.60, 0.92, density));
          gl_FragColor = vec4(col * uIntensity, a * 0.34 * uIntensity);
        }
      `
			});
			const midOrbitMesh = new three.Mesh(midOrbitGeom, midOrbitMat);
			midOrbitMesh.renderOrder = 22;
			this.group.add(midOrbitMesh);
			this._materials.push(midOrbitMat);
			const groundRingsGeom = new three.PlaneGeometry(8.6, 8.6);
			groundRingsGeom.rotateX(-Math.PI / 2);
			this._disposables.push(groundRingsGeom);
			const groundRingsMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending,
				vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uProgress;
        uniform float uIntensity;
        uniform float uGrow;
        uniform float uDissolve;
        varying vec2 vUv;
        ${noiseFn}
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 0.98) discard;
          float ang = atan(p.y, p.x);
          float normAng = (ang / 6.2831853) + 0.5;

          // Pre-ignition inward pull -> high-speed spiraling peak rings
          float isIgnite = 1.0 - smoothstep(0.08, 0.16, uProgress);
          float dir = mix(1.0, -1.6, isIgnite);
          float n = fbmPeriodic(vec2(normAng * 6.0 - uTime * 1.4, r * 6.0 - uTime * 1.8 * dir), 6.0);

          // Domain-warped turbulent wind-plasma ground vortex (organic swirling airflow, not rigid coils!)
          float turb = fbmPeriodic(vec2(normAng * 4.0 + n * 1.2 - uTime * 1.1, r * 4.5 - uTime * 1.5 * dir), 4.0);
          float rNL = pow(max(0.0001, r), 0.74) + (turb - 0.5) * 0.095;
          float spiralPrimary = sin(rNL * 30.0 - ang * 2.0 - uTime * 7.2 * dir + n * 3.2) * 0.5 + 0.5;
          float spiralSub     = sin(rNL * 46.0 - ang * 1.0 - uTime * 8.8 * dir + turb * 3.8) * 0.5 + 0.5;
          float arcBreak = smoothstep(0.14, 0.58, sin(ang * 2.0 + r * 5.0 - uTime * 3.6 + turb * 3.6) * 0.5 + 0.5);
          // Silky, feathery glowing ground wind-plasma spirals (soft Gaussian edges!)
          float ringMain = smoothstep(0.42, 0.92, spiralPrimary) * (0.38 + 0.62 * arcBreak);
          float ringThin = smoothstep(0.58, 0.96, spiralSub) * 0.48 * arcBreak;
          float ringMask = clamp(ringMain + ringThin, 0.0, 1.0);

          float radialEnv = smoothstep(0.12, 0.24, r) * smoothstep(0.97, 0.62, r);
          float growRad = smoothstep(0.0, 0.45, uGrow);
          float fade = (1.0 - smoothstep(0.15, 0.95, uDissolve)) * growRad * uIntensity;
          float energy = ringMask * radialEnv * fade;
          if (energy < 0.03) discard;

          // Razor-sharp white-gold inner core rings -> blazing scarlet-crimson outer rings with dark gaps
          vec3 outerCrim  = vec3(1.00, 0.10, 0.22);
          vec3 midOrange  = vec3(1.00, 0.42, 0.10);
          vec3 innerWhite = vec3(1.00, 0.98, 0.86);

          vec3 col = mix(innerWhite, midOrange, smoothstep(0.24, 0.64, r));
          col = mix(col, outerCrim, smoothstep(0.58, 0.90, r));
          col = mix(col, innerWhite, smoothstep(0.80, 0.95, spiralPrimary) * (1.0 - r * 0.35));
          // Electric cyan pre-ignition glint
          col = mix(col, vec3(0.32, 0.72, 1.0), isIgnite * 0.25);

          gl_FragColor = vec4(col * energy * 1.35, clamp(energy, 0.0, 1.0));
        }
      `
			});
			const groundRingsMesh = new three.Mesh(groundRingsGeom, groundRingsMat);
			groundRingsMesh.position.y = .028;
			groundRingsMesh.renderOrder = 24;
			this.group.add(groundRingsMesh);
			this._materials.push(groundRingsMat);
			const capGeom = new three.RingGeometry(.18, 1.52, 48, 8);
			capGeom.rotateX(-Math.PI / 2);
			const capPos = capGeom.attributes.position;
			for (let i = 0; i < capPos.count; i++) {
				const r = Math.hypot(capPos.getX(i), capPos.getZ(i));
				const t = Math.min(1, Math.max(0, (r - .18) / 1.34));
				capPos.setY(i, 3.65 + Math.pow(t, .9) * .45);
			}
			capGeom.computeVertexNormals();
			this._disposables.push(capGeom);
			const capMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.NormalBlending,
				vertexShader: `
        uniform float uTime;
        uniform float uGrow;
        varying vec2 vLocalXZ;
        void main() {
          vec3 pos = position;
          vLocalXZ = pos.xz;
          float ang = uTime * 2.5;
          float c = cos(ang), s = sin(ang);
          pos.xz = vec2(pos.x * c - pos.z * s, pos.x * s + pos.z * c);
          pos.x += sin(uTime * 2.5 + 3.6) * 0.07 - 0.08;
          pos.z += cos(uTime * 2.1 + 3.2) * 0.06 - 0.10;
          pos.y *= mix(0.08, 1.0, smoothstep(0.0, 1.0, uGrow));
          float rs = mix(0.28, 1.0, smoothstep(0.0, 0.85, uGrow));
          pos.xz *= rs;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vLocalXZ;
        ${noiseFn}
        void main() {
          float r = length(vLocalXZ);
          float normAng = (atan(vLocalXZ.y, vLocalXZ.x) / 6.2831853) + 0.5;
          float swirl = sin(atan(vLocalXZ.y, vLocalXZ.x) * 3.0 + r * 4.5 - uTime * 3.4) * 0.5 + 0.5;
          float n = fbmPeriodic(vec2(normAng * 6.0 + r * 2.0, r * 2.6 - uTime * 1.8), 6.0);
          float ring = smoothstep(0.18, 0.45, r) * smoothstep(1.52, 1.05, r);
          float v = (swirl * 0.62 + n * 0.38) * ring;
          float cut = 0.28 + uDissolve * 0.88;
          float a = smoothstep(cut, cut + 0.08, v);
          if (a < 0.02) discard;
          vec3 col = mix(vec3(0.22, 0.01, 0.06), vec3(0.88, 0.06, 0.24), smoothstep(0.24, 0.65, v));
          col = mix(col, vec3(1.0, 0.52, 0.58), smoothstep(0.78, 0.94, v) * (1.0 - uDissolve * 0.85));
          col *= mix(vec3(1.0), vec3(1.10, 0.22, 0.14), smoothstep(0.10, 0.65, uDissolve));
          gl_FragColor = vec4(col * 0.68 * uIntensity, a * 0.82 * uIntensity);
        }
      `
			});
			const capMesh = new three.Mesh(capGeom, capMat);
			capMesh.renderOrder = 14;
			this.group.add(capMesh);
			this._materials.push(capMat);
			const shardGeom = this._createMergedHelicalRibbons([
				{
					vStart: .05,
					vEnd: .58,
					angleStart: .2,
					turns: .42,
					radiusMult: 1.05,
					flareOut: .88,
					flarePow: 1.5,
					width: .3,
					tilt: .68,
					segs: 28
				},
				{
					vStart: .12,
					vEnd: .68,
					angleStart: 1.5,
					turns: .45,
					radiusMult: 1.06,
					flareOut: .95,
					flarePow: 1.5,
					width: .28,
					tilt: .7,
					segs: 28
				},
				{
					vStart: .04,
					vEnd: .52,
					angleStart: 2.8,
					turns: .4,
					radiusMult: 1.08,
					flareOut: .82,
					flarePow: 1.6,
					width: .32,
					tilt: .66,
					segs: 28
				},
				{
					vStart: .18,
					vEnd: .74,
					angleStart: 4.1,
					turns: .42,
					radiusMult: 1.05,
					flareOut: .92,
					flarePow: 1.5,
					width: .26,
					tilt: .7,
					segs: 28
				},
				{
					vStart: .42,
					vEnd: .86,
					angleStart: 2.2,
					turns: .34,
					radiusMult: 1.04,
					flareOut: .76,
					flarePow: 1.7,
					width: .3,
					tilt: .74,
					segs: 28
				},
				{
					vStart: .48,
					vEnd: .9,
					angleStart: 5.2,
					turns: .32,
					radiusMult: 1.04,
					flareOut: .82,
					flarePow: 1.7,
					width: .28,
					tilt: .75,
					segs: 28
				},
				{
					vStart: .02,
					vEnd: .34,
					angleStart: .7,
					turns: .36,
					radiusMult: 1.08,
					flareOut: .65,
					flarePow: 1.4,
					width: .26,
					tilt: .62,
					segs: 22
				},
				{
					vStart: .03,
					vEnd: .38,
					angleStart: 2.3,
					turns: .38,
					radiusMult: 1.08,
					flareOut: .72,
					flarePow: 1.4,
					width: .24,
					tilt: .64,
					segs: 22
				},
				{
					vStart: .02,
					vEnd: .32,
					angleStart: 3.9,
					turns: .35,
					radiusMult: 1.08,
					flareOut: .62,
					flarePow: 1.5,
					width: .28,
					tilt: .6,
					segs: 22
				},
				{
					vStart: .04,
					vEnd: .42,
					angleStart: 5.5,
					turns: .4,
					radiusMult: 1.08,
					flareOut: .7,
					flarePow: 1.4,
					width: .25,
					tilt: .65,
					segs: 22
				}
			]);
			const shardMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.NormalBlending,
				vertexShader: `
        attribute float aRibbonId;
        uniform float uTime;
        uniform float uGrow;
        varying vec2 vUv;
        varying float vId;
        varying float vH;
        void main() {
          vUv = uv;
          vId = aRibbonId;
          vec3 pos = position;
          float ang = uTime * 2.15 + aRibbonId * 6.28318;
          float c = cos(ang), s = sin(ang);
          pos = vec3(pos.x * c - pos.z * s, pos.y, pos.x * s + pos.z * c);

          float h = clamp(pos.y / 4.6, 0.0, 1.0);
          vH = h;
          pos.x += sin(uTime * 2.5 + h * 4.0) * 0.07 * h;
          pos.z += cos(uTime * 2.1 + h * 3.6) * 0.06 * h;
          pos.y *= mix(0.08, 1.0, smoothstep(0.0, 1.0, uGrow));
          float rs = mix(0.30, 1.0, smoothstep(0.0, 0.85, uGrow));
          pos.x *= rs; pos.z *= rs;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vId;
        varying float vH;
        ${noiseFn}
        void main() {
          // Soft, feathery, billowing flame-vapor wisps swirling off the wind column (ZERO sharp blades!)
          float n = fbm(vec2(vUv.x * 2.8 - uTime * 2.6 + vId * 9.0, vUv.y * 2.4));
          float softY = pow(sin(vUv.y * 3.14159265), 2.4);
          float softX = pow(sin(vUv.x * 3.14159265), 1.8);
          float shape = softY * softX * (0.45 + 0.85 * n);

          float cut = 0.10 + uDissolve * (0.68 + (1.0 - vH) * 0.45);
          float a = smoothstep(cut, cut + 0.34, shape);
          if (a < 0.01) discard;

          vec3 col = mix(vec3(0.90, 0.06, 0.22), vec3(1.0, 0.52, 0.16), smoothstep(0.18, 0.54, shape));
          col = mix(col, vec3(1.0, 0.96, 0.84), smoothstep(0.56, 0.88, shape));
          col *= mix(vec3(1.0), vec3(1.12, 0.24, 0.12), smoothstep(0.15, 0.85, uDissolve));
          gl_FragColor = vec4(col * 1.05 * uIntensity, a * 0.62 * uIntensity);
        }
      `
			});
			const shardMesh = new three.Mesh(shardGeom, shardMat);
			shardMesh.renderOrder = 28;
			this.group.add(shardMesh);
			this._materials.push(shardMat);
			const darkWindGeom = this._createMergedHelicalRibbons([
				{
					vStart: .02,
					vEnd: .52,
					angleStart: .35,
					turns: .55,
					radiusMult: 1.5,
					flareOut: 1.95,
					flarePow: .85,
					width: .64,
					tilt: .7,
					segs: 36
				},
				{
					vStart: .04,
					vEnd: .46,
					angleStart: 3.15,
					turns: .48,
					radiusMult: 1.44,
					flareOut: 1.75,
					flarePow: .9,
					width: .54,
					tilt: .68,
					segs: 36
				},
				{
					vStart: .28,
					vEnd: .76,
					angleStart: 1.9,
					turns: .58,
					radiusMult: 1.32,
					flareOut: 1.15,
					flarePow: 1.05,
					width: .32,
					tilt: .56,
					segs: 32
				},
				{
					vStart: .34,
					vEnd: .8,
					angleStart: 4.95,
					turns: .54,
					radiusMult: 1.28,
					flareOut: 1.05,
					flarePow: 1.1,
					width: .28,
					tilt: .54,
					segs: 32
				}
			]);
			const darkWindMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.NormalBlending,
				vertexShader: `
        attribute float aRibbonId;
        uniform float uTime;
        uniform float uGrow;
        varying vec2 vUv;
        varying float vId;
        void main() {
          vUv = uv;
          vId = aRibbonId;
          vec3 pos = position;
          float ang = uTime * 1.05 + aRibbonId * 6.28318;
          float c = cos(ang), s = sin(ang);
          pos = vec3(pos.x * c - pos.z * s, pos.y, pos.x * s + pos.z * c);
          pos.y *= mix(0.12, 1.0, smoothstep(0.0, 1.0, uGrow));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vId;
        ${noiseFn}
        void main() {
          // Silky billowing dark-crimson storm-smoke clouds (ZERO sharp paper cutouts!)
          vec2 p = vec2(vUv.x * 3.2 - uTime * 1.45 + vId * 11.0, vUv.y * 2.2);
          float smoke = fbm(p) * 0.65 + fbm(p * 2.1 + vec2(3.2, -1.7)) * 0.35;
          float softEnv = pow(sin(vUv.y * 3.14159265), 2.2) * pow(sin(vUv.x * 3.14159265), 1.6);
          float density = softEnv * (0.40 + 0.85 * smoke);
          float cut = 0.12 + uDissolve * 0.55;
          float alpha = smoothstep(cut, cut + 0.36, density);
          if (alpha < 0.01) discard;

          vec3 col = mix(vec3(0.16, 0.04, 0.09), vec3(0.44, 0.16, 0.24), smoothstep(0.18, 0.68, density));
          gl_FragColor = vec4(col, alpha * 0.42 * uIntensity);
        }
      `
			});
			const darkWindMesh = new three.Mesh(darkWindGeom, darkWindMat);
			darkWindMesh.renderOrder = 30;
			this.group.add(darkWindMesh);
			this._materials.push(darkWindMat);
			const stemBolts = [];
			for (let i = 0; i < 6; i++) stemBolts.push({
				vStart: .05 + i % 3 * .08,
				vEnd: .58 + i % 3 * .11,
				angleStart: i / 6 * Math.PI * 2,
				turns: .85 + i % 2 * .35,
				radiusMult: 1.09 + i % 2 * .06,
				radiusOffset: .06,
				width: .068 + i % 2 * .018,
				jitter: .18,
				segs: 28,
				seed: i * 19.3 + 4.1
			});
			const stemBoltGeom = this._createLightningBoltSet(stemBolts);
			const stemBoltMat = new three.ShaderMaterial({
				uniforms: {
					...this.uniforms,
					uRotSpeed: { value: 1.85 }
				},
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.NormalBlending,
				vertexShader: `
        attribute vec3 aJitter;
        attribute float aSeed;
        uniform float uTime;
        uniform float uGrow;
        uniform float uRotSpeed;
        varying vec2 vUv;
        varying float vSeed;
        varying float vStep;
        void main() {
          vUv = uv;
          vSeed = aSeed;
          vStep = uTime * 3.4;
          // Multi-harmonic fluid electric discharge (energetic crackle without harsh wire spikes!)
          float wave1 = sin(uv.x * 16.0 - uTime * 8.2 + aSeed) * 0.55
                      + (abs(sin(uv.x * 31.0 + uTime * 6.5 + aSeed * 1.7)) - 0.5) * 0.55;
          float wave2 = cos(uv.x * 14.0 - uTime * 7.0 + aSeed * 2.1) * 0.55
                      + (abs(cos(uv.x * 27.0 - uTime * 5.8)) - 0.5) * 0.50;
          vec3 pos = position + vec3(aJitter.x * wave1, aJitter.y * wave2, aJitter.z * wave1);

          float ang = uTime * uRotSpeed + vStep * 0.04;
          float c = cos(ang), s = sin(ang);
          pos = vec3(pos.x * c - pos.z * s, pos.y, pos.x * s + pos.z * c);

          float h = clamp(pos.y / 4.6, 0.0, 1.0);
          pos.x += sin(uTime * 2.5 + h * 4.0) * 0.07 * h;
          pos.z += cos(uTime * 2.1 + h * 3.6) * 0.06 * h;
          pos.y *= mix(0.08, 1.0, smoothstep(0.0, 1.0, uGrow));
          float rs = mix(0.30, 1.0, smoothstep(0.0, 0.85, uGrow));
          pos.x *= rs; pos.z *= rs;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vSeed;
        varying float vStep;
        void main() {
          float segMask = smoothstep(0.12, 0.62, sin(vUv.x * 8.0 + vSeed - vStep * 2.2) * 0.5 + 0.5);
          float earlyOff = 1.0 - smoothstep(0.08, 0.42, uDissolve);
          float tip = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.80, vUv.x);
          float crossDist = abs(vUv.y * 2.0 - 1.0);
          float body = exp(-crossDist * crossDist * 3.4);
          float core = exp(-crossDist * crossDist * 26.0) * 0.92;
          float alpha = body * tip * segMask * earlyOff * 0.86 * uIntensity;
          if (alpha < 0.02) discard;

          vec3 cobaltBlue = vec3(0.06, 0.36, 1.00);
          vec3 electricCyan = vec3(0.32, 0.74, 1.00);
          vec3 whiteCore = vec3(0.94, 0.99, 1.00);
          vec3 col = mix(cobaltBlue, electricCyan, smoothstep(0.32, 0.76, body));
          col = mix(col, whiteCore, core);
          gl_FragColor = vec4(col * 1.18, clamp(alpha * 0.96, 0.0, 1.0));
        }
      `
			});
			const stemBoltMesh = new three.Mesh(stemBoltGeom, stemBoltMat);
			stemBoltMesh.renderOrder = 42;
			this.group.add(stemBoltMesh);
			this._materials.push(stemBoltMat);
			const canopyBolts = [];
			for (let i = 0; i < 6; i++) canopyBolts.push({
				vStart: .76 + i % 3 * .08,
				vEnd: .98 + i % 2 * .08,
				angleStart: i / 6 * Math.PI * 2 + .45,
				turns: .28 + i % 2 * .1,
				fixedR: 2.05 + i % 3 * .55,
				width: .064 + i % 2 * .018,
				jitter: .17,
				crescent: true,
				segs: 32,
				seed: i * 27.1 + 101.7
			});
			const canopyBoltGeom = this._createLightningBoltSet(canopyBolts);
			const canopyBoltMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending,
				vertexShader: `
        attribute vec3 aJitter;
        attribute float aSeed;
        uniform float uTime;
        uniform float uGrow;
        varying vec2 vUv;
        varying float vPulse;
        void main() {
          vUv = uv;
          float tipDamp = smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x);
          float j = (sin(uv.x * 14.0 - uTime * 7.4 + aSeed) * 0.52
                  + (abs(sin(uv.x * 29.0 + uTime * 6.2 + aSeed * 1.3)) - 0.5) * 0.54) * tipDamp;
          vec3 pos = position + aJitter * j;
          pos.y += sin(uv.x * 6.28318 + uTime * 6.0 + aSeed) * 0.08;

          float ang = -uTime * 1.25 + aSeed * 0.1;
          float c = cos(ang), s = sin(ang);
          pos = vec3(pos.x * c - pos.z * s, pos.y, pos.x * s + pos.z * c);

          pos.y *= mix(0.10, 1.0, smoothstep(0.0, 1.0, uGrow));
          float rs = mix(0.25, 1.0, smoothstep(0.05, 0.90, uGrow));
          pos.x *= rs; pos.z *= rs;

          vPulse = fract(uv.x - uTime * 1.7 + aSeed * 0.37);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vPulse;
        void main() {
          float packet = smoothstep(0.0, 0.16, vPulse) * smoothstep(0.90, 0.35, vPulse);
          float earlySnap = 1.0 - smoothstep(0.18, 0.52, uDissolve);
          float dissolveTrim = smoothstep(uDissolve * 0.95, uDissolve * 0.95 + 0.12, vUv.x) * earlySnap;
          float crossDist = abs(vUv.y * 2.0 - 1.0);
          float halo = exp(-crossDist * crossDist * 3.4);
          float core = exp(-crossDist * crossDist * 26.0) * 0.92;
          float alpha = halo * packet * dissolveTrim * 0.82 * uIntensity;
          if (alpha < 0.02) discard;

          vec3 deepArc = vec3(0.04, 0.30, 1.00);
          vec3 skyArc  = vec3(0.40, 0.80, 1.00);
          vec3 hotTip  = vec3(0.96, 0.99, 1.00);
          vec3 col = mix(deepArc, skyArc, smoothstep(0.25, 0.72, halo));
          col = mix(col, hotTip, core * smoothstep(0.2, 0.7, packet));
          gl_FragColor = vec4(col * alpha * 1.18, clamp(alpha, 0.0, 1.0));
        }
      `
			});
			const canopyBoltMesh = new three.Mesh(canopyBoltGeom, canopyBoltMat);
			canopyBoltMesh.renderOrder = 44;
			this.group.add(canopyBoltMesh);
			this._materials.push(canopyBoltMat);
			const forkBolts = [];
			for (let i = 0; i < 12; i++) {
				const vBase = .14 + i / 12 * .8;
				forkBolts.push({
					vStart: vBase,
					vEnd: Math.min(1.05, vBase + .12 + i % 3 * .04),
					angleStart: i / 12 * Math.PI * 2 + .3,
					turns: (i % 2 === 0 ? 1 : -1) * (.09 + i % 3 * .04),
					radiusMult: 1.15 + i % 2 * .12,
					radiusOffset: .18 + i % 3 * .12,
					width: .052 + i % 2 * .015,
					jitter: .15,
					crescent: true,
					segs: 10,
					seed: i * 41.9 + 307.1
				});
			}
			const forkGeom = this._createLightningBoltSet(forkBolts);
			const forkMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.NormalBlending,
				vertexShader: `
        attribute vec3 aJitter;
        attribute float aSeed;
        uniform float uTime;
        uniform float uGrow;
        uniform float uBoltFreq;
        varying vec2 vUv;
        varying float vSeed;
        varying float vStep;
        void main() {
          vUv = uv;
          vSeed = aSeed;
          vStep = floor(uTime * 14.0 * uBoltFreq);
          float j1 = sin(uv.x * 12.0 - uTime * 7.6 + aSeed) * 0.55
                   + (abs(sin(uv.x * 26.0 + uTime * 6.0)) - 0.5) * 0.55;
          float j2 = cos(uv.x * 13.0 - uTime * 6.4 + aSeed * 1.4) * 0.60;
          vec3 pos = position + vec3(aJitter.x * j1, aJitter.y * j2, aJitter.z * j1);
          pos.xz *= (1.0 + uv.x * 0.20);

          float ang = uTime * 1.45 + vStep * 0.12;
          float c = cos(ang), s = sin(ang);
          pos = vec3(pos.x * c - pos.z * s, pos.y, pos.x * s + pos.z * c);

          float h = clamp(pos.y / 4.6, 0.0, 1.0);
          pos.x += sin(uTime * 2.5 + h * 4.0) * 0.07 * h;
          pos.z += cos(uTime * 2.1 + h * 3.6) * 0.06 * h;
          pos.y *= mix(0.08, 1.0, smoothstep(0.0, 1.0, uGrow));
          float rs = mix(0.30, 1.0, smoothstep(0.0, 0.85, uGrow));
          pos.x *= rs; pos.z *= rs;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vSeed;
        varying float vStep;
        float hash11(float p) {
          p = fract(p * 0.1031);
          p *= p + 33.33;
          p *= p + p;
          return fract(p);
        }
        void main() {
          float burst = step(0.40, hash11(vSeed * 2.3 + vStep * 0.87));
          float earlyOff = 1.0 - smoothstep(0.05, 0.48, uDissolve);
          float crossDist = abs(vUv.y * 2.0 - 1.0);
          float body = exp(-crossDist * crossDist * 3.6);
          float core = exp(-crossDist * crossDist * 26.0) * 0.90;
          float tip = smoothstep(0.0, 0.20, vUv.x) * smoothstep(1.0, 0.72, vUv.x);
          float alpha = body * tip * burst * earlyOff * 0.72 * uIntensity;
          if (alpha < 0.02) discard;
          vec3 col = mix(vec3(0.14, 0.46, 1.00), vec3(0.95, 0.99, 1.00), core);
          gl_FragColor = vec4(col * 1.28, clamp(alpha, 0.0, 1.0));
        }
      `
			});
			const forkMesh = new three.Mesh(forkGeom, forkMat);
			forkMesh.renderOrder = 46;
			this.group.add(forkMesh);
			this._materials.push(forkMat);
			const starCount = 42;
			const totalMotes = 422;
			const moteGeom = new three.PlaneGeometry(1, 1);
			const aMoteP1 = new Float32Array(totalMotes * 4);
			const aMoteP2 = new Float32Array(totalMotes * 4);
			for (let i = 0; i < totalMotes; i++) if (i < starCount) {
				aMoteP1[i * 4 + 0] = this._rand(i * 17.9) * Math.PI * 2;
				aMoteP1[i * 4 + 1] = this._rand(i * 7.3) * Math.PI * 2;
				aMoteP1[i * 4 + 2] = (this._rand(i * 5.7) > .5 ? 1 : -1) * (.9 + this._rand(i * 9.1) * 1.4);
				aMoteP1[i * 4 + 3] = .06 + this._rand(i * 3.1) * .96;
				aMoteP2[i * 4 + 0] = 1.18 + this._rand(i * 11.3) * .55;
				aMoteP2[i * 4 + 1] = 3.5 + this._rand(i * 23.1) * 4.5;
				aMoteP2[i * 4 + 2] = .11 + this._rand(i * 13.7) * .13;
				aMoteP2[i * 4 + 3] = 1;
			} else {
				const j = i - starCount;
				const lowBias = Math.pow(this._rand(j * 3.7 + 1.1), 1.9);
				aMoteP1[i * 4 + 0] = this._rand(j * 6.3 + 2.7);
				aMoteP1[i * 4 + 1] = this._rand(j * 11.1 + .5) * Math.PI * 2;
				aMoteP1[i * 4 + 2] = 1.4 + this._rand(j * 14.9) * 2.2;
				aMoteP1[i * 4 + 3] = .14 + this._rand(j * 17.3) * .24;
				aMoteP2[i * 4 + 0] = .55 + this._rand(j * 21.7) * 3.15;
				aMoteP2[i * 4 + 1] = .5 + lowBias * 4.1;
				aMoteP2[i * 4 + 2] = .048 + this._rand(j * 27.1) * .088;
				aMoteP2[i * 4 + 3] = -(6 + this._rand(j * 31.3) * 9);
			}
			moteGeom.setAttribute("aMoteP1", new three.InstancedBufferAttribute(aMoteP1, 4));
			moteGeom.setAttribute("aMoteP2", new three.InstancedBufferAttribute(aMoteP2, 4));
			this._disposables.push(moteGeom);
			const moteMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending,
				vertexShader: `
        attribute vec4 aMoteP1;
        attribute vec4 aMoteP2;
        uniform float uTime;
        uniform float uGrow;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vIsOrb;
        varying float vAlpha;
        float funnelR(float v) {
          float stem = pow(max(0.0, v), 1.75) * 1.38;
          float waist = sin(pow(max(0.0, v), 1.15) * 3.14159) * 0.24;
          float flare = pow(max(0.0, (v - 0.42) / 0.58), 1.40) * 0.68;
          return max(0.36, 0.42 + stem + waist + flare);
        }
        void main() {
          vUv = uv;
          float growH = 0.08 + 0.92 * min(1.0, uGrow);
          float radScale = 0.30 + 0.70 * min(1.0, uGrow / 0.85);
          float vis = uIntensity * (1.0 - uDissolve * 0.92);
          float isOrb = step(0.5, aMoteP2.w);
          vIsOrb = isOrb;

          vec3 center;
          float sz;
          if (isOrb > 0.5) {
            float twinkle = max(0.0, sin(uTime * aMoteP2.y + aMoteP1.x));
            float pop = pow(twinkle, 2.4) * vis;
            float v = aMoteP1.w;
            float sx = sin(v * 3.14159 * 1.28 + 0.15) * 0.34 * v - 0.12 * sin(v * 3.14159);
            float szp = cos(v * 3.14159 * 1.10 - 0.25) * 0.16 * v;
            float r = funnelR(v) * aMoteP2.x * radScale;
            float ang = aMoteP1.y + uTime * aMoteP1.z;
            center = vec3(sx + cos(ang) * r, (0.14 + v * 4.65) * growH, szp + sin(ang) * r);
            sz = pop < 0.04 ? 0.0 : aMoteP2.z * (0.45 + 0.85 * pop);
            vAlpha = pop;
          } else {
            float life = fract(aMoteP1.x + uTime * aMoteP1.w);
            float tw = 0.45 + 0.55 * sin(uTime * (-aMoteP2.w) + aMoteP1.y * 5.0);
            float env = sin(life * 3.14159) * vis * tw;
            float r = (aMoteP2.x + life * 0.65) * radScale;
            float ang = aMoteP1.y + uTime * aMoteP1.z;
            center = vec3(cos(ang) * r, (0.06 + life * aMoteP2.y) * growH, sin(ang) * r);
            sz = env < 0.04 ? 0.0 : aMoteP2.z * (0.5 + 0.8 * env);
            vAlpha = env;
          }

          vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
          mvCenter.xy += position.xy * sz;
          gl_Position = projectionMatrix * mvCenter;
        }
      `,
				fragmentShader: `
        varying vec2 vUv;
        varying float vIsOrb;
        varying float vAlpha;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r2 = dot(p, p);
          if (r2 > 1.0) discard;
          if (vIsOrb > 0.5) {
            float halo = exp(-r2 * 6.5);
            float core = exp(-r2 * 24.0);
            float a = halo * vAlpha;
            if (a < 0.02) discard;
            vec3 col = mix(vec3(0.14, 0.44, 1.00), vec3(0.72, 0.88, 1.00), smoothstep(0.15, 0.75, halo));
            col = mix(col, vec3(1.0), core);
            gl_FragColor = vec4(col * 1.35 * a, a);
          } else {
            float dotGlow = exp(-r2 * 5.5);
            if (dotGlow < 0.04) discard;
            vec3 col = mix(vec3(1.0, 0.18, 0.28), vec3(1.0, 0.98, 0.86), smoothstep(0.28, 0.86, dotGlow));
            gl_FragColor = vec4(col * 1.90 * dotGlow * vAlpha, dotGlow * vAlpha);
          }
        }
      `
			});
			this._moteMesh = new three.InstancedMesh(moteGeom, moteMat, totalMotes);
			this._moteMesh.renderOrder = 53;
			this._moteMesh.frustumCulled = false;
			this._totalMotes = totalMotes;
			this.group.add(this._moteMesh);
			this._materials.push(moteMat);
			const emberCount = 90, canopySparkCount = 120;
			const totalStreaks = 285;
			const streakGeom = new three.PlaneGeometry(.036, .36);
			const aStrP1 = new Float32Array(totalStreaks * 4);
			const aStrP2 = new Float32Array(totalStreaks * 4);
			for (let i = 0; i < totalStreaks; i++) if (i < emberCount) {
				aStrP1[i * 4 + 0] = this._rand(i * 4.3 + 2.1);
				aStrP1[i * 4 + 1] = this._rand(i * 8.9 + 1.4) * Math.PI * 2;
				aStrP1[i * 4 + 2] = 2.3 + this._rand(i * 12.1) * 2.5;
				aStrP1[i * 4 + 3] = .28 + this._rand(i * 15.7) * .34;
				aStrP2[i * 4 + 0] = 1.15 + this._rand(i * 19.3) * .85;
				aStrP2[i * 4 + 1] = 4.85;
				aStrP2[i * 4 + 2] = .55 + this._rand(i * 21.7) * .95;
				aStrP2[i * 4 + 3] = 0;
			} else if (i < 210) {
				const j = i - emberCount;
				aStrP1[i * 4 + 0] = this._rand(j * 29.1) * Math.PI * 2;
				aStrP1[i * 4 + 1] = this._rand(j * 7.1 + 1.3) * Math.PI * 2;
				aStrP1[i * 4 + 2] = 1.85 + this._rand(j * 11.7) * 2.4;
				aStrP1[i * 4 + 3] = .22;
				aStrP2[i * 4 + 0] = 1.65 + this._rand(j * 15.3) * 2.25;
				aStrP2[i * 4 + 1] = 3.35 + this._rand(j * 19.9) * 1.75;
				aStrP2[i * 4 + 2] = .45 + this._rand(j * 23.7) * .95;
				aStrP2[i * 4 + 3] = 1;
			} else {
				const j = i - emberCount - canopySparkCount;
				aStrP1[i * 4 + 0] = this._rand(j * 3.9 + 5.1);
				aStrP1[i * 4 + 1] = this._rand(j * 8.3 + 2.7) * Math.PI * 2;
				aStrP1[i * 4 + 2] = 3.6 + this._rand(j * 25.7) * 2.8;
				aStrP1[i * 4 + 3] = .62 + this._rand(j * 12.7) * .72;
				aStrP2[i * 4 + 0] = 1.65 + this._rand(j * 16.3) * 1.45;
				aStrP2[i * 4 + 1] = .85 + this._rand(j * 21.1) * 1.15;
				aStrP2[i * 4 + 2] = .45 + this._rand(j * 29.9) * .72;
				aStrP2[i * 4 + 3] = 2;
			}
			streakGeom.setAttribute("aStrP1", new three.InstancedBufferAttribute(aStrP1, 4));
			streakGeom.setAttribute("aStrP2", new three.InstancedBufferAttribute(aStrP2, 4));
			this._disposables.push(streakGeom);
			const streakMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending,
				vertexShader: `
        attribute vec4 aStrP1;
        attribute vec4 aStrP2;
        uniform float uTime;
        uniform float uGrow;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vMode;
        varying float vAlpha;
        float funnelR(float v) {
          float stem = pow(max(0.0, v), 1.75) * 1.38;
          float waist = sin(pow(max(0.0, v), 1.15) * 3.14159) * 0.24;
          float flare = pow(max(0.0, (v - 0.42) / 0.58), 1.40) * 0.68;
          return max(0.36, 0.42 + stem + waist + flare);
        }
        void main() {
          vUv = uv;
          float mode = aStrP2.w;
          vMode = mode;
          float growH = 0.08 + 0.92 * min(1.0, uGrow);
          float radScale = 0.30 + 0.70 * min(1.0, uGrow / 0.85);
          float vis = uIntensity * (1.0 - uDissolve * 0.92);

          vec3 center;
          vec3 dir;
          float scX = 0.0, scY = 0.0;

          if (mode < 0.5) {
            float life = fract(aStrP1.x + uTime * aStrP1.w);
            float env = sin(life * 3.14159) * vis;
            float sx = sin(life * 3.14159 * 1.28 + 0.15) * 0.34 * life - 0.12 * sin(life * 3.14159);
            float szp = cos(life * 3.14159 * 1.10 - 0.25) * 0.16 * life;
            float r = (funnelR(life) * aStrP2.x + life * 0.75) * radScale;
            float ang = aStrP1.y + uTime * aStrP1.z;
            float ca = cos(ang), sa = sin(ang);
            center = vec3(sx + ca * r, (0.10 + life * aStrP2.y) * growH, szp + sa * r);
            dir = normalize(vec3(-sa * r * aStrP1.z * 0.45, 2.2, ca * r * aStrP1.z * 0.45));
            scX = aStrP2.z * env;
            scY = scX * (0.9 + 0.6 * life);
            vAlpha = env;
          } else if (mode < 1.5) {
            float pulse = 0.35 + 0.65 * max(0.0, sin(uTime * 5.2 + aStrP1.x));
            float env = vis * pulse;
            float ang = aStrP1.y + uTime * aStrP1.z;
            float r = aStrP2.x * radScale;
            float ca = cos(ang), sa = sin(ang);
            float lx = ca * r * 1.18;
            float lz = sa * r;
            center = vec3(lx, (aStrP2.y + lx * aStrP1.w) * growH, lz);
            dir = normalize(vec3(-sa * 1.18, -sa * aStrP1.w, ca));
            scX = aStrP2.z * env;
            scY = scX * 1.35;
            vAlpha = env;
          } else {
            float life = fract(aStrP1.x + uTime * aStrP1.w);
            float env = sin(life * 3.14159) * vis * min(1.0, uGrow * 1.5);
            float r = (0.48 + pow(max(0.0, 1.0 - life), 1.55) * aStrP2.x) * radScale;
            float y = 0.04 + pow(max(0.0, life), 1.35) * aStrP2.y * growH;
            float ang = aStrP1.y + life * aStrP1.z + uTime * 2.2;
            float ca = cos(ang), sa = sin(ang);
            center = vec3(ca * r, y, sa * r);
            dir = normalize(vec3(-sa * r * aStrP1.z - ca * 0.65, aStrP2.y * 1.6, ca * r * aStrP1.z - sa * 0.65));
            scX = aStrP2.z * env;
            scY = scX * (0.85 + 0.65 * (1.0 - life));
            vAlpha = env;
          }

          // Camera-aligned velocity ribbon basis on GPU (zero CPU quaternions!)
          vec3 wpCenter = (modelMatrix * vec4(center, 1.0)).xyz;
          vec3 worldDir = normalize(mat3(modelMatrix) * dir);
          vec3 viewDir = normalize(cameraPosition - wpCenter);
          vec3 side = normalize(cross(viewDir, worldDir) + vec3(1e-4, 0.0, 0.0));
          vec3 worldPos = wpCenter + side * (position.x * scX) + worldDir * (position.y * scY);
          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
        }
      `,
				fragmentShader: `
        varying vec2 vUv;
        varying float vMode;
        varying float vAlpha;
        void main() {
          float dx = abs(vUv.x * 2.0 - 1.0);
          float dy = abs(vUv.y * 2.0 - 1.0);
          float s = smoothstep(1.0, 0.08, dx) * smoothstep(1.0, 0.0, dy);
          if (s < 0.04) discard;
          vec3 cLow = vMode < 0.5 ? vec3(1.0, 0.22, 0.06) : (vMode < 1.5 ? vec3(1.0, 0.14, 0.34) : vec3(1.0, 0.16, 0.28));
          vec3 cHi  = vec3(1.0, 0.96, 0.84);
          vec3 col = mix(cLow, cHi, smoothstep(0.28, 0.92, vUv.y));
          gl_FragColor = vec4(col * 1.58 * s * vAlpha, s * vAlpha);
        }
      `
			});
			this._streakMesh = new three.InstancedMesh(streakGeom, streakMat, totalStreaks);
			this._streakMesh.renderOrder = 52;
			this._streakMesh.frustumCulled = false;
			this._totalStreaks = totalStreaks;
			this.group.add(this._streakMesh);
			this._materials.push(streakMat);
			const debrisCount = 34;
			const rockGeom = new three.PlaneGeometry(1.1, 1.1);
			const aCloudP1 = /* @__PURE__ */ new Float32Array(136);
			const aCloudP2 = /* @__PURE__ */ new Float32Array(136);
			for (let i = 0; i < debrisCount; i++) {
				aCloudP1[i * 4 + 0] = this._rand(i * 5.3 + 1.7);
				aCloudP1[i * 4 + 1] = this._rand(i * 9.7 + 4.2) * Math.PI * 2;
				aCloudP1[i * 4 + 2] = 1.75 + this._rand(i * 13.1) * 1.9;
				aCloudP1[i * 4 + 3] = .19 + this._rand(i * 17.3) * .22;
				aCloudP2[i * 4 + 0] = 1.15 + this._rand(i * 21.1) * .45;
				aCloudP2[i * 4 + 1] = .95 + this._rand(i * 29.3) * .9;
				aCloudP2[i * 4 + 2] = this._rand(i * 19.7 + 3.1) * 40;
				aCloudP2[i * 4 + 3] = this._rand(i * 27.3 + 5.7) * Math.PI * 2;
			}
			rockGeom.setAttribute("aCloudP1", new three.InstancedBufferAttribute(aCloudP1, 4));
			rockGeom.setAttribute("aCloudP2", new three.InstancedBufferAttribute(aCloudP2, 4));
			this._disposables.push(rockGeom);
			const debrisMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.NormalBlending,
				vertexShader: `
        attribute vec4 aCloudP1;
        attribute vec4 aCloudP2;
        uniform float uTime;
        uniform float uGrow;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vSeed;
        float funnelR(float v) {
          float stem = pow(max(0.0, v), 1.75) * 1.38;
          float waist = sin(pow(max(0.0, v), 1.15) * 3.14159) * 0.24;
          float flare = pow(max(0.0, (v - 0.42) / 0.58), 1.40) * 0.68;
          return max(0.36, 0.42 + stem + waist + flare);
        }
        void main() {
          vUv = uv;
          vSeed = aCloudP2.z;
          float life = fract(aCloudP1.x + uTime * aCloudP1.w);
          float growH = 0.08 + 0.92 * min(1.0, uGrow);
          float radScale = 0.30 + 0.70 * min(1.0, uGrow / 0.85);
          float env = sin(life * 3.14159) * (1.0 - uDissolve * 0.75) * min(1.0, uGrow * 1.4);
          float sc = env < 0.03 ? 0.0 : aCloudP2.y * min(1.0, env * 1.6);

          float sx = sin(life * 3.14159 * 1.28 + 0.15) * 0.34 * life - 0.12 * sin(life * 3.14159);
          float szp = cos(life * 3.14159 * 1.10 - 0.25) * 0.16 * life;
          float r = (funnelR(life) * aCloudP2.x + life * life * 1.15) * radScale;
          float ang = aCloudP1.y + uTime * aCloudP1.z;
          vec3 center = vec3(sx + cos(ang) * r, (0.08 + pow(max(0.0, life), 0.85) * 4.10) * growH, szp + sin(ang) * r);

          float rot = aCloudP2.w + uTime * 0.55;
          float c = cos(rot), s = sin(rot);
          vec2 rotPos = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
          vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
          mvCenter.xy += rotPos * vec2(sc * 1.15, sc * 0.85);
          gl_Position = projectionMatrix * mvCenter;
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vSeed;
        ${noiseFn}
        void main() {
          vec2 p = (vUv * 2.0 - 1.0) * vec2(1.0, 1.12);
          float r2 = dot(p, p);
          if (r2 > 1.0) discard;
          float boxFade = smoothstep(1.0, 0.62, abs(vUv.x * 2.0 - 1.0))
                        * smoothstep(1.0, 0.62, abs(vUv.y * 2.0 - 1.0));
          vec2 seedOff = vec2(vSeed, vSeed * 0.63);
          float w = fbm2(vUv * 2.6 + seedOff + vec2(uTime * 0.5, -uTime * 0.4));
          float n = fbm2(vUv * 4.2 + seedOff * 1.4 + vec2(w * 1.3, -uTime * 0.8));
          float radial = pow(exp(-r2 * 2.9), 1.5) * boxFade;
          float cloudMask = radial * smoothstep(0.16, 0.78, n);
          float a = cloudMask * 0.40 * (1.0 - smoothstep(0.55, 1.0, uDissolve));
          if (a < 0.01) discard;
          vec3 smokeCol = mix(vec3(0.12, 0.01, 0.04), vec3(0.64, 0.07, 0.19), smoothstep(0.14, 0.72, cloudMask) * uIntensity);
          gl_FragColor = vec4(smokeCol, a);
        }
      `
			});
			this._debrisMesh = new three.InstancedMesh(rockGeom, debrisMat, debrisCount);
			this._debrisMesh.renderOrder = 36;
			this._debrisMesh.frustumCulled = false;
			this._totalDebris = debrisCount;
			this.group.add(this._debrisMesh);
			this._materials.push(debrisMat);
			const crackGeom = new three.PlaneGeometry(5.6, 5.6);
			crackGeom.rotateX(-Math.PI / 2);
			this._disposables.push(crackGeom);
			const crackMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				blending: three.NormalBlending,
				vertexShader: groundRingsMat.vertexShader,
				fragmentShader: `
        uniform float uGrow;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        ${noiseFn}
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          if (dot(p, p) > 0.90) discard;
          float r = length(p);
          float normAng = (atan(p.y, p.x) / 6.2831853) + 0.5;
          float n1 = vnoisePeriodic(vec2(normAng * 12.0, r * 4.5), 12.0);
          float n2 = vnoisePeriodic(vec2(normAng * 24.0 + n1 * 1.4, r * 9.0), 24.0);
          float sharpCrack = smoothstep(0.86, 0.96, 1.0 - abs(n2 * 2.0 - 1.0));
          float radMask = smoothstep(0.14, 0.30, r) * smoothstep(0.92, 0.36, r);
          float appear = smoothstep(0.10, 0.65, uGrow);
          float coolFade = 1.0 - smoothstep(0.55, 1.0, uDissolve);
          float a = sharpCrack * radMask * appear * coolFade * 0.85;
          if (a < 0.04) discard;
          vec3 col = mix(vec3(1.0, 0.42, 0.06), vec3(0.55, 0.04, 0.06), smoothstep(0.25, 0.85, r) * 0.65 + uDissolve * 0.7);
          gl_FragColor = vec4(col * (0.95 + 0.25 * uIntensity), a);
        }
      `
			});
			const crackMesh = new three.Mesh(crackGeom, crackMat);
			crackMesh.position.y = .011;
			crackMesh.renderOrder = 5;
			this.group.add(crackMesh);
			this._materials.push(crackMat);
			const groundGlowGeom = new three.PlaneGeometry(8.2, 8.2);
			groundGlowGeom.rotateX(-Math.PI / 2);
			this._disposables.push(groundGlowGeom);
			const groundGlowMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				blending: three.AdditiveBlending,
				vertexShader: groundRingsMat.vertexShader,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uGrow;
        varying vec2 vUv;
        ${noiseFn}
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          if (dot(p, p) > 0.96) discard;
          float d = length(p);
          float normAng = (atan(p.y, p.x) / 6.2831853) + 0.5;
          float swirl = fbmPeriodic(vec2(normAng * 4.0 + d * 2.5 - uTime * 1.4, d * 3.0), 4.0);
          // Controlled deep crimson-orange floor pool (eliminates center white washout blob!)
          float core = exp(-d * d * 8.5);
          float wide = exp(-d * d * 2.0) * (0.76 + 0.24 * swirl);
          float growFade = smoothstep(0.0, 0.30, uGrow);
          float glow = (core * 0.22 + wide * 0.44) * growFade * uIntensity;
          if (glow < 0.01) discard;
          vec3 col = mix(vec3(0.88, 0.05, 0.16), vec3(1.00, 0.36, 0.08), clamp(core * 1.2, 0.0, 1.0));
          col = mix(col, vec3(1.00, 0.78, 0.40), smoothstep(0.78, 1.0, core));
          gl_FragColor = vec4(col * glow, clamp(glow, 0.0, 1.0));
        }
      `
			});
			const groundGlowMesh = new three.Mesh(groundGlowGeom, groundGlowMat);
			groundGlowMesh.position.y = .018;
			groundGlowMesh.renderOrder = 6;
			this.group.add(groundGlowMesh);
			this._materials.push(groundGlowMat);
			const auraGeom = new three.PlaneGeometry(11.5, 9.6);
			this._disposables.push(auraGeom);
			const auraMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending,
				vertexShader: `
        uniform float uGrow;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          float g = smoothstep(0.0, 1.0, uGrow);
          vec4 mvCenter = modelViewMatrix * vec4(0.0, mix(0.7, 2.75, g), 0.0, 1.0);
          mvCenter.xy += position.xy * vec2(mix(0.42, 1.0, g), mix(0.35, 1.0, g));
          gl_Position = projectionMatrix * mvCenter;
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        ${noiseFn}
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float crownSpread = mix(1.38, 0.78, smoothstep(-0.65, 0.45, p.y));
          vec2 q = vec2(p.x * crownSpread, (p.y - 0.06) * 0.95);
          float halo = exp(-dot(q, q) * 2.45);
          float softMist = 0.88 + 0.12 * fbm2(vUv * 3.5 + vec2(uTime * 0.35, -uTime * 0.55));
          float a = halo * softMist * 0.48 * (1.0 - uDissolve * 0.88) * uIntensity;
          if (a < 0.004) discard;
          vec3 outerCrimson = vec3(0.68, 0.05, 0.12);
          vec3 innerFire    = vec3(1.00, 0.38, 0.06);
          vec3 col = mix(outerCrimson, innerFire, smoothstep(0.18, 0.85, halo));
          gl_FragColor = vec4(col * a, a);
        }
      `
			});
			const auraMesh = new three.Mesh(auraGeom, auraMat);
			auraMesh.renderOrder = 4;
			auraMesh.frustumCulled = false;
			this.group.add(auraMesh);
			this._materials.push(auraMat);
			const conduitGeom = this._createMergedHelicalRibbons([
				{
					vStart: .02,
					vEnd: .94,
					angleStart: .4,
					turns: 1.25,
					radiusMult: 1.06,
					flareOut: .45,
					flarePow: 1.8,
					width: .56,
					tilt: .45,
					segs: 44
				},
				{
					vStart: .02,
					vEnd: .96,
					angleStart: 2.5,
					turns: 1.3,
					radiusMult: 1.08,
					flareOut: .52,
					flarePow: 1.9,
					width: .52,
					tilt: .48,
					segs: 44
				},
				{
					vStart: .02,
					vEnd: .92,
					angleStart: 4.6,
					turns: 1.2,
					radiusMult: 1.05,
					flareOut: .4,
					flarePow: 1.8,
					width: .54,
					tilt: .44,
					segs: 44
				}
			]);
			const conduitMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending,
				vertexShader: shardMat.vertexShader,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vId;
        varying float vH;
        ${noiseFn}
        void main() {
          // Traveling bright surge packets shooting upward from floor rings to canopy
          float pulse = fract(vUv.x * 1.6 - uTime * 1.45 + vId * 3.1);
          float packet = smoothstep(0.0, 0.22, pulse) * smoothstep(0.85, 0.30, pulse);
          float cloudN = fbm2(vec2(vUv.x * 5.0 - uTime * 2.2 + vId * 7.0, vUv.y * 3.0));
          float crossW = pow(sin(vUv.y * 3.14159265), 2.4);
          float core = smoothstep(0.45, 0.95, crossW);
          float ends = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.72, vUv.x);
          float earlyFade = 1.0 - smoothstep(0.15, 0.85, uDissolve);
          float a = crossW * (0.45 + 0.75 * cloudN) * packet * ends * earlyFade * 0.36 * uIntensity;
          if (a < 0.02) discard;
          vec3 col = mix(vec3(1.0, 0.16, 0.24), vec3(1.0, 0.72, 0.22), smoothstep(0.2, 0.7, crossW));
          col = mix(col, vec3(1.0, 0.98, 0.88), core * (1.0 - smoothstep(0.15, 0.55, uDissolve)));
          gl_FragColor = vec4(col * a * 1.25, a);
        }
      `
			});
			const conduitMesh = new three.Mesh(conduitGeom, conduitMat);
			conduitMesh.renderOrder = 32;
			this.group.add(conduitMesh);
			this._materials.push(conduitMat);
			const groundArcs = [];
			for (let i = 0; i < 6; i++) groundArcs.push({
				vStart: .005,
				vEnd: .035,
				angleStart: i / 6 * Math.PI * 2 + .2,
				turns: .24 + i % 2 * .08,
				fixedR: 2.05 + i % 3 * .72,
				width: .058,
				jitter: .15,
				crescent: true,
				segs: 18,
				seed: i * 37.3 + 512.7
			});
			const groundArcGeom = this._createLightningBoltSet(groundArcs);
			const groundArcMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.NormalBlending,
				vertexShader: `
        attribute vec3 aJitter;
        attribute float aSeed;
        uniform float uTime;
        uniform float uGrow;
        varying vec2 vUv;
        varying float vSeed;
        varying float vStep;
        void main() {
          vUv = uv;
          vSeed = aSeed;
          vStep = floor(uTime * 10.0);
          float j = sin(uv.x * 13.0 - uTime * 6.8 + aSeed) * 0.55
                  + (abs(sin(uv.x * 27.0 + uTime * 5.2)) - 0.5) * 0.55;
          vec3 pos = position + vec3(aJitter.x * j, abs(aJitter.y * j) * 0.4, aJitter.z * j);
          pos.y = max(0.035, pos.y);
          float ang = uTime * 1.15 + vStep * 0.08;
          float c = cos(ang), s = sin(ang);
          pos.xz = vec2(pos.x * c - pos.z * s, pos.x * s + pos.z * c);
          float rs = mix(0.28, 1.0, smoothstep(0.05, 0.85, uGrow));
          pos.xz *= rs;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        varying float vSeed;
        varying float vStep;
        float hash11(float p) {
          p = fract(p * 0.1031);
          p *= p + 33.33;
          p *= p + p;
          return fract(p);
        }
        void main() {
          float burst = step(0.32, hash11(vSeed * 1.9 + vStep * 0.71));
          float earlyOff = 1.0 - smoothstep(0.12, 0.50, uDissolve);
          float crossDist = abs(vUv.y * 2.0 - 1.0);
          float body = exp(-crossDist * crossDist * 3.4);
          float core = exp(-crossDist * crossDist * 26.0) * 0.90;
          float tip = smoothstep(0.0, 0.10, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
          float a = body * tip * burst * earlyOff * uIntensity;
          if (a < 0.06) discard;
          vec3 col = mix(vec3(0.08, 0.42, 1.00), vec3(0.95, 0.99, 1.00), core);
          gl_FragColor = vec4(col * 1.28, clamp(a, 0.0, 1.0));
        }
      `
			});
			const groundArcMesh = new three.Mesh(groundArcGeom, groundArcMat);
			groundArcMesh.renderOrder = 40;
			this.group.add(groundArcMesh);
			this._materials.push(groundArcMat);
			const collarRadSegs = 44, collarRingSegs = 10;
			const cPos = [], cUvs = [], cIdx = [];
			for (let ir = 0; ir <= collarRingSegs; ir++) {
				const v = ir / collarRingSegs;
				const r = .44 + Math.pow(1 - v, 2.6) * .92;
				const y = .04 + Math.pow(v, 1.25) * 1.55;
				for (let ia = 0; ia <= collarRadSegs; ia++) {
					const u = ia / collarRadSegs;
					const th = u * Math.PI * 2;
					cPos.push(Math.cos(th) * r, y, Math.sin(th) * r);
					cUvs.push(u, v);
				}
			}
			const cStride = 45;
			for (let ir = 0; ir < collarRingSegs; ir++) for (let ia = 0; ia < collarRadSegs; ia++) {
				const a = ir * cStride + ia;
				const b = a + 1;
				const c = (ir + 1) * cStride + ia;
				const d = c + 1;
				cIdx.push(a, c, b, b, c, d);
			}
			const baseCollarGeom = new three.BufferGeometry();
			baseCollarGeom.setAttribute("position", new three.Float32BufferAttribute(cPos, 3));
			baseCollarGeom.setAttribute("uv", new three.Float32BufferAttribute(cUvs, 2));
			baseCollarGeom.setIndex(cIdx);
			this._disposables.push(baseCollarGeom);
			const baseCollarMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending,
				vertexShader: `
        uniform float uTime;
        uniform float uGrow;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 pos = position;
          // Fast swirling updraft rotation matching core tornado direction
          float ang = uTime * 2.8;
          float c = cos(ang), s = sin(ang);
          pos.xz = vec2(pos.x * c - pos.z * s, pos.x * s + pos.z * c);
          float g = smoothstep(0.0, 0.78, uGrow);
          pos.xz *= mix(0.30, 1.0, g);
          pos.y *= mix(0.15, 1.0, g);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        ${noiseFn}
        void main() {
          // Tightly wound, razor-sharp helical cyclone suction ribbons (identical art language to core!)
          float spiral = vUv.x * 3.0 - vUv.y * 3.6 + uTime * 2.2;
          float n = fbmPeriodic(vec2(vUv.x * 6.0 - vUv.y * 7.2 + uTime * 4.4, vUv.y * 8.0 - uTime * 3.8), 6.0);
          float streakWave = sin(spiral * 6.28318 + n * 3.2) * 0.5 + 0.5;
          float thinRibbon = pow(streakWave, 4.5) * (0.58 + 0.62 * n);
          float env = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
          float shape = thinRibbon * env;

          float cut = 0.08 + uDissolve * 0.72;
          float a = smoothstep(cut, cut + 0.36, shape) * 0.58;
          if (a < 0.02) discard;

          float whiteCool = 1.0 - smoothstep(0.10, 0.45, uDissolve);
          // Exact cohesive palette: Deep Wine -> Crimson-Magenta -> Fiery Scarlet -> White-Gold leading thread
          vec3 cWine   = vec3(0.22, 0.01, 0.06);
          vec3 cMag    = vec3(0.92, 0.05, 0.24);
          vec3 cScar   = vec3(1.00, 0.28, 0.12);
          vec3 cWhite  = vec3(1.00, 0.98, 0.88);
          vec3 col = mix(cWine, cMag, smoothstep(0.24, 0.48, shape));
          col = mix(col, cScar,  smoothstep(0.50, 0.72, shape));
          col = mix(col, cWhite, smoothstep(0.74, 0.92, shape) * whiteCool);
          col *= mix(vec3(1.0), vec3(1.15, 0.22, 0.12), smoothstep(0.05, 0.45, uDissolve));
          gl_FragColor = vec4(col * 1.08 * uIntensity, a * 0.88 * uIntensity);
        }
      `
			});
			const baseCollarMesh = new three.Mesh(baseCollarGeom, baseCollarMat);
			baseCollarMesh.renderOrder = 20;
			this.group.add(baseCollarMesh);
			this._materials.push(baseCollarMat);
			const plumeRadSegs = 40, plumeTubeSegs = 6;
			const pPos = [], pUvs = [], pIdx = [];
			for (let it = 0; it <= plumeTubeSegs; it++) {
				const v = it / plumeTubeSegs;
				const r = 1.25 + v * 2.15;
				const y = .04 + Math.pow(1 - v, 1.6) * .62;
				for (let ia = 0; ia <= plumeRadSegs; ia++) {
					const u = ia / plumeRadSegs;
					const th = u * Math.PI * 2;
					pPos.push(Math.cos(th) * r, y, Math.sin(th) * r);
					pUvs.push(u, v);
				}
			}
			const pStride = 41;
			for (let it = 0; it < plumeTubeSegs; it++) for (let ia = 0; ia < plumeRadSegs; ia++) {
				const a = it * pStride + ia;
				const b = a + 1;
				const c = (it + 1) * pStride + ia;
				const d = c + 1;
				pIdx.push(a, c, b, b, c, d);
			}
			const plumeGeom = new three.BufferGeometry();
			plumeGeom.setAttribute("position", new three.Float32BufferAttribute(pPos, 3));
			plumeGeom.setAttribute("uv", new three.Float32BufferAttribute(pUvs, 2));
			plumeGeom.setIndex(pIdx);
			this._disposables.push(plumeGeom);
			const plumeMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.NormalBlending,
				vertexShader: `
        uniform float uTime;
        uniform float uGrow;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float ang = uTime * 1.75;
          float c = cos(ang), s = sin(ang);
          pos.xz = vec2(pos.x * c - pos.z * s, pos.x * s + pos.z * c);
          float g = smoothstep(0.05, 0.85, uGrow);
          pos.xz *= mix(0.35, 1.0, g);
          pos.y *= mix(0.20, 1.0, g);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uDissolve;
        varying vec2 vUv;
        ${noiseFn}
        void main() {
          float n = fbmPeriodic(vec2(vUv.x * 5.0 + vUv.y * 4.5 - uTime * 2.4, vUv.y * 4.0 + uTime * 1.8), 5.0);
          float arcs = sin((vUv.x * 3.0 + vUv.y * 2.8 - uTime * 1.4) * 6.28318 + n * 3.2) * 0.5 + 0.5;
          float radial = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.25, vUv.y);
          float shear = pow(arcs, 2.0) * radial * (0.55 + 0.65 * n);
          float cut = 0.08 + uDissolve * 0.55;
          float a = smoothstep(cut, cut + 0.34, shear);
          if (a < 0.02) discard;

          vec3 darkWine = vec3(0.18, 0.015, 0.06);
          vec3 crimEdge = vec3(0.88, 0.08, 0.24);
          vec3 col = mix(darkWine, crimEdge, smoothstep(0.34, 0.72, shear) * uIntensity);
          gl_FragColor = vec4(col, a * 0.52 * (1.0 - uDissolve * 0.65));
        }
      `
			});
			const plumeMesh = new three.Mesh(plumeGeom, plumeMat);
			plumeMesh.renderOrder = 21;
			this.group.add(plumeMesh);
			this._materials.push(plumeMat);
			const ambientBoltCount = 44;
			const boltSegs = 14;
			const bPos = [];
			const bUv = [];
			const bIdx = [];
			for (let i = 0; i <= boltSegs; i++) {
				const t = i / boltSegs;
				bPos.push(t, -1, 0, t, 1, 0);
				bUv.push(t, 0, t, 1);
			}
			for (let i = 0; i < boltSegs; i++) {
				const a = i * 2;
				bIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
			}
			const ambientBoltGeom = new three.BufferGeometry();
			ambientBoltGeom.setAttribute("position", new three.Float32BufferAttribute(bPos, 3));
			ambientBoltGeom.setAttribute("uv", new three.Float32BufferAttribute(bUv, 2));
			ambientBoltGeom.setIndex(bIdx);
			const aBoltP1 = /* @__PURE__ */ new Float32Array(176);
			const aBoltP2 = /* @__PURE__ */ new Float32Array(176);
			for (let i = 0; i < ambientBoltCount; i++) {
				const s = i * 23.71 + 7.13;
				const o = i * 4;
				aBoltP1[o] = s;
				aBoltP1[o + 1] = 6.5 + this._rand(s + 1) * 8.5;
				aBoltP1[o + 2] = i % 3;
				aBoltP1[o + 3] = i % 5 === 0 ? 2 : i % 2 === 0 ? 0 : 1;
				aBoltP2[o] = this._rand(s + 2);
				aBoltP2[o + 1] = .72 + this._rand(s + 3) * .75;
				aBoltP2[o + 2] = .032 + this._rand(s + 4) * .028;
				aBoltP2[o + 3] = this._rand(s + 5);
			}
			ambientBoltGeom.setAttribute("aBoltP1", new three.InstancedBufferAttribute(aBoltP1, 4));
			ambientBoltGeom.setAttribute("aBoltP2", new three.InstancedBufferAttribute(aBoltP2, 4));
			const ambientBoltMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending,
				vertexShader: `
        attribute vec4 aBoltP1;
        attribute vec4 aBoltP2;
        uniform float uTime;
        uniform float uGrow;
        uniform float uDissolve;
        uniform float uBoltFreq;
        varying vec2 vUv;
        varying float vFlash;
        varying float vHue;

        float h11(float p) {
          p = fract(p * 0.1031);
          p *= p + 33.33;
          p *= p + p;
          return fract(p);
        }

        float funnelRad(float v) {
          float vc = clamp(v, 0.0, 1.0);
          float stem = pow(max(vc, 0.0001), 1.75) * 1.38;
          float midW = sin(pow(max(vc, 0.0001), 1.15) * 3.1415926) * 0.24;
          float flare = pow(max(0.0001, max(0.0, (vc - 0.42) / 0.58)), 1.40) * 0.68;
          return max(0.36, 0.42 + stem + midW + flare);
        }

        vec3 evalBoltPoint(float t, float cell, vec4 p1, vec4 p2) {
          float seed = p1.x;
          float band = p1.z;
          float style = p1.w;
          float hBias = p2.x;
          float lenS = p2.y;

          float r1 = h11(cell * 19.7 + seed * 3.1);
          float r2 = h11(cell * 37.3 + seed * 7.7);
          float r3 = h11(cell * 53.9 + seed * 11.3);
          float r4 = h11(cell * 71.1 + seed * 15.7);

          float az0 = r1 * 6.2831853 + uTime * (0.45 + band * 0.18);
          float vCenter = mix(0.08, 0.94, fract(hBias + r2 * 0.85));
          float vSpan = (style > 1.5) ? (0.06 + r3 * 0.10) : ((0.20 + r3 * 0.28) * lenS);
          float vStart = clamp(vCenter - vSpan * 0.5, 0.01, 0.92);
          float vEnd = clamp(vStart + vSpan, 0.08, 1.06);

          float v = mix(vStart, vEnd, t);
          float y = 0.06 + v * 4.65;

          float turnSpan = (style > 1.5)
            ? ((r4 > 0.5 ? 1.0 : -1.0) * (0.55 + r3 * 0.65))
            : ((r4 > 0.5 ? 1.0 : -1.0) * (0.14 + r3 * 0.34));
          float az = az0 + t * turnSpan;

          float baseMult = (band < 0.5) ? 1.24 : ((band < 1.5) ? 1.58 : 2.02);
          float rad = funnelRad(v) * (baseMult + r4 * 0.34) + (band > 1.5 ? 0.22 : 0.08);
          // Slight outward bow at mid-arc so peripheral bolts arch gracefully around the wind
          rad += sin(t * 3.1415926) * (0.14 + r2 * 0.22);

          float sx = sin(clamp(v, 0.0, 1.0) * 3.1415926 * 1.28 + 0.15) * 0.34 * clamp(v, 0.0, 1.0)
                   - 0.12 * sin(clamp(v, 0.0, 1.0) * 3.1415926);
          float sz = cos(clamp(v, 0.0, 1.0) * 3.1415926 * 1.10 - 0.25) * 0.16 * clamp(v, 0.0, 1.0);

          vec3 pos = vec3(sx + cos(az) * rad, y, sz + sin(az) * rad);

          // Piecewise-linear jagged electric zig-zag kinks (authentic branching bolt silhouette!)
          float segF = t * 6.0;
          float segI = floor(segF);
          float segFrac = fract(segF);
          float env = sin(t * 3.1415926);

          float k0x = h11(cell * 13.1 + seed * 2.3 + segI * 17.7) - 0.5;
          float k1x = h11(cell * 13.1 + seed * 2.3 + (segI + 1.0) * 17.7) - 0.5;
          float k0y = h11(cell * 29.3 + seed * 5.9 + segI * 23.1) - 0.5;
          float k1y = h11(cell * 29.3 + seed * 5.9 + (segI + 1.0) * 23.1) - 0.5;
          float k0z = h11(cell * 43.7 + seed * 8.3 + segI * 31.3) - 0.5;
          float k1z = h11(cell * 43.7 + seed * 8.3 + (segI + 1.0) * 31.3) - 0.5;

          vec3 kink = vec3(mix(k0x, k1x, segFrac), mix(k0y, k1y, segFrac) * 0.72, mix(k0z, k1z, segFrac));
          // High-frequency micro-crackle
          float micro = (h11(cell * 7.3 + floor(t * 14.0) * 41.1 + seed) - 0.5) * 0.16;
          pos += (kink * 0.62 + vec3(cos(az), 0.35, sin(az)) * micro) * env;

          float hNorm = clamp(pos.y / 4.65, 0.0, 1.0);
          pos.y *= mix(0.08, 1.0, smoothstep(0.0, 1.0, uGrow));
          float rs = mix(0.28, 1.0, smoothstep(0.0, 0.85, uGrow));
          pos.x *= rs; pos.z *= rs;
          pos.x += sin(uTime * 2.4 + hNorm * 3.8) * 0.06 * hNorm;
          pos.z += cos(uTime * 2.0 + hNorm * 3.4) * 0.05 * hNorm;
          return pos;
        }

        void main() {
          vUv = uv;
          vHue = aBoltP2.w;

          float seed = aBoltP1.x;
          float freq = aBoltP1.y;
          float phase = uTime * freq * uBoltFreq + seed * 1.93;
          float cell = floor(phase);
          float lt = fract(phase);

          // Staggered double-flicker electric strobe (~65% active bursts -> constant crackling!)
          float fireMask = step(0.35, h11(cell * 17.3 + seed * 5.7));
          float f1 = smoothstep(0.0, 0.04, lt) * (1.0 - smoothstep(0.11, 0.36, lt));
          float f2 = smoothstep(0.32, 0.36, lt) * (1.0 - smoothstep(0.44, 0.72, lt)) * 0.88;
          float flash = fireMask * max(f1, f2) * (1.0 - smoothstep(0.05, 0.48, uDissolve));
          vFlash = flash;

          if (flash < 0.015) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          float t = position.x;
          float sideSign = position.y;
          vec3 pCurr = evalBoltPoint(t, cell, aBoltP1, aBoltP2);
          vec3 pNext = evalBoltPoint(min(1.0, t + 0.05), cell, aBoltP1, aBoltP2);
          vec3 pPrev = evalBoltPoint(max(0.0, t - 0.05), cell, aBoltP1, aBoltP2);
          vec3 tangent = normalize(pNext - pPrev + vec3(0.0001, 0.0001, 0.0));

          vec4 worldCenter = modelMatrix * vec4(pCurr, 1.0);
          vec3 viewDir = normalize(cameraPosition - worldCenter.xyz);
          vec3 right = normalize(cross(tangent, viewDir) + vec3(0.0001, 0.0, 0.0001));

          float tipTaper = smoothstep(0.0, 0.16, t) * smoothstep(1.0, 0.84, t);
          float halfW = aBoltP2.z * (0.28 + 0.72 * tipTaper) * (0.85 + 0.35 * flash);
          vec3 finalPos = pCurr + right * (sideSign * halfW);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uIntensity;
        varying vec2 vUv;
        varying float vFlash;
        varying float vHue;
        void main() {
          if (vFlash < 0.015) discard;
          float tip = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
          float crossDist = abs(vUv.y * 2.0 - 1.0);
          float halo = exp(-crossDist * crossDist * 3.8);
          float core = exp(-crossDist * crossDist * 28.0);
          float alpha = halo * tip * vFlash * uIntensity * 0.92;
          if (alpha < 0.02) discard;

          vec3 cobalt = vec3(0.08, 0.38, 1.00);
          vec3 violetBlue = vec3(0.32, 0.34, 1.00);
          vec3 electricCyan = vec3(0.38, 0.84, 1.00);
          vec3 whiteHot = vec3(0.97, 0.99, 1.00);

          vec3 outerCol = mix(cobalt, violetBlue, vHue * 0.65);
          vec3 col = mix(outerCol, electricCyan, smoothstep(0.28, 0.72, halo));
          col = mix(col, whiteHot, core * 0.94);
          gl_FragColor = vec4(col * alpha * 1.28, clamp(alpha, 0.0, 1.0));
        }
      `
			});
			this._ambientBoltMesh = new three.InstancedMesh(ambientBoltGeom, ambientBoltMat, ambientBoltCount);
			this._ambientBoltMesh.instanceMatrix.setUsage(three.StaticDrawUsage);
			this._ambientBoltMesh.frustumCulled = false;
			this._ambientBoltMesh.renderOrder = 47;
			this._totalAmbientBolts = ambientBoltCount;
			const _idMatBolt = new three.Matrix4();
			for (let i = 0; i < ambientBoltCount; i++) this._ambientBoltMesh.setMatrixAt(i, _idMatBolt);
			this._ambientBoltMesh.instanceMatrix.needsUpdate = true;
			this.group.add(this._ambientBoltMesh);
			this._disposables.push(ambientBoltGeom);
			this._materials.push(ambientBoltMat);
			const flashNodeCount = 26;
			const flashNodeGeom = new three.PlaneGeometry(1, 1);
			const aFlashP1 = /* @__PURE__ */ new Float32Array(104);
			for (let i = 0; i < flashNodeCount; i++) {
				const s = i * 31.17 + 19.4;
				const o = i * 4;
				aFlashP1[o] = s;
				aFlashP1[o + 1] = 7.5 + this._rand(s + 1) * 8.5;
				aFlashP1[o + 2] = 1.28 + this._rand(s + 2) * .95;
				aFlashP1[o + 3] = .24 + this._rand(s + 3) * .3;
			}
			flashNodeGeom.setAttribute("aFlashP1", new three.InstancedBufferAttribute(aFlashP1, 4));
			const flashNodeMat = new three.ShaderMaterial({
				uniforms: { ...this.uniforms },
				transparent: true,
				depthWrite: false,
				blending: three.AdditiveBlending,
				vertexShader: `
        attribute vec4 aFlashP1;
        uniform float uTime;
        uniform float uGrow;
        uniform float uDissolve;
        uniform float uBoltFreq;
        varying vec2 vUv;
        varying float vFlash;
        varying float vSeed;

        float h11(float p) {
          p = fract(p * 0.1031);
          p *= p + 33.33;
          p *= p + p;
          return fract(p);
        }

        float funnelRad(float v) {
          float vc = clamp(v, 0.0, 1.0);
          float stem = pow(max(vc, 0.0001), 1.75) * 1.38;
          float midW = sin(pow(max(vc, 0.0001), 1.15) * 3.1415926) * 0.24;
          float flare = pow(max(0.0001, max(0.0, (vc - 0.42) / 0.58)), 1.40) * 0.68;
          return max(0.36, 0.42 + stem + midW + flare);
        }

        void main() {
          vUv = uv;
          float seed = aFlashP1.x;
          float freq = aFlashP1.y;
          float phase = uTime * freq * uBoltFreq + seed * 2.13;
          float cell = floor(phase);
          float lt = fract(phase);
          vSeed = seed + cell * 0.37;

          float isLit = step(0.45, h11(cell * 23.1 + seed * 4.3));
          float burst = smoothstep(0.0, 0.05, lt) * (1.0 - smoothstep(0.10, 0.42, lt));
          float flash = isLit * burst * (1.0 - smoothstep(0.05, 0.45, uDissolve));
          vFlash = flash;

          if (flash < 0.02) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          float az = h11(cell * 41.3 + seed * 9.7) * 6.2831853 + uTime * 0.5;
          float v = 0.05 + h11(cell * 17.9 + seed * 6.1) * 0.92;
          float rad = funnelRad(v) * aFlashP1.z + 0.12;
          float y = (0.12 + v * 4.55) * mix(0.10, 1.0, smoothstep(0.0, 1.0, uGrow));
          float rs = mix(0.30, 1.0, smoothstep(0.0, 0.85, uGrow));

          vec3 center = vec3(cos(az) * rad * rs, y, sin(az) * rad * rs);
          float sz = aFlashP1.w * (0.65 + 0.55 * flash);
          vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
          mvCenter.xy += position.xy * sz;
          gl_Position = projectionMatrix * mvCenter;
        }
      `,
				fragmentShader: `
        uniform float uIntensity;
        varying vec2 vUv;
        varying float vFlash;
        varying float vSeed;
        void main() {
          if (vFlash < 0.02) discard;
          vec2 p = vUv * 2.0 - 1.0;
          float d2 = dot(p, p);
          if (d2 > 1.0) discard;
          float d = sqrt(d2);
          float core = exp(-d * d * 18.0);
          float glow = exp(-d * d * 4.2) * 0.55;
          // Crisp 4-point electric ionization cross-spark
          float ang = atan(p.y, p.x) + vSeed;
          float rays = pow(max(0.0, abs(cos(ang * 2.0))), 10.0) * exp(-d * 3.8) * 0.65;
          float alpha = (core + glow + rays) * vFlash * uIntensity * 0.82;
          if (alpha < 0.02) discard;

          vec3 col = mix(vec3(0.12, 0.52, 1.00), vec3(0.48, 0.88, 1.00), clamp(glow * 1.4, 0.0, 1.0));
          col = mix(col, vec3(0.97, 0.99, 1.00), clamp(core + rays * 0.6, 0.0, 1.0));
          gl_FragColor = vec4(col * alpha * 1.15, clamp(alpha, 0.0, 1.0));
        }
      `
			});
			this._flashNodeMesh = new three.InstancedMesh(flashNodeGeom, flashNodeMat, flashNodeCount);
			this._flashNodeMesh.instanceMatrix.setUsage(three.StaticDrawUsage);
			this._flashNodeMesh.frustumCulled = false;
			this._flashNodeMesh.renderOrder = 48;
			this._totalFlashNodes = flashNodeCount;
			for (let i = 0; i < flashNodeCount; i++) this._flashNodeMesh.setMatrixAt(i, _idMatBolt);
			this._flashNodeMesh.instanceMatrix.needsUpdate = true;
			this.group.add(this._flashNodeMesh);
			this._disposables.push(flashNodeGeom);
			this._materials.push(flashNodeMat);
		}
		setProgress(p) {
			const clamped = this.loop ? (p % 1 + 1) % 1 : Math.max(0, Math.min(1, p));
			this.time = clamped * this.duration;
			let grow = 1;
			let intensity = 1;
			let dissolve = 0;
			if (clamped < .06) {
				const k = clamped / .06;
				grow = Math.pow(k, 1.45);
				intensity = Math.min(1, .25 + k * .95);
				dissolve = (1 - k) * .22;
			} else if (clamped > .94) {
				const k = (clamped - .94) / .06;
				grow = 1 + k * .05;
				dissolve = Math.pow(k, .78);
				intensity = Math.max(0, 1 - Math.pow(k, 1.45));
			}
			this.group.visible = intensity > .002;
			this.uniforms.uTime.value = this.time;
			this.uniforms.uProgress.value = clamped;
			this.uniforms.uGrow.value = grow;
			this.uniforms.uIntensity.value = intensity * this.intensityScale;
			this.uniforms.uDissolve.value = dissolve;
		}
		update(dt) {
			if (!this.loop && this._completed) return;
			const next = (this.time + dt) / this.duration;
			if (!this.loop && next >= 1) {
				this._completed = true;
				this.setProgress(1);
				if (this.onComplete) this.onComplete();
				return;
			}
			this.setProgress(next);
		}
		reset() {
			this._completed = false;
			this.setProgress(0);
		}
		getPhaseLabel() {
			const p = this.uniforms.uProgress.value;
			if (p < .06) return "點燃";
			if (p > .94) return "消散";
			return "巔峰";
		}
		dispose() {
			if (this._disposed) return;
			this._disposed = true;
			this.group.removeFromParent();
			this.group.traverse((object) => {
				if (object.isInstancedMesh) object.dispose();
			});
			this.group.clear();
			this._disposables.forEach((g) => g.dispose());
			this._materials.forEach((m) => m.dispose());
		}
	};
	const LIGHTNING_FIRE_TORNADO = Object.freeze({
		duration: 15,
		fade: .9,
		maxParticles: 811
	});
	const defaultColor = "#d91644";
	function normalizeLightningFireTornadoOptions(options = {}) {
		return {
			color: hexColor(options.color, defaultColor),
			size: finiteRange(options.size, .25, 2, 1),
			density: finiteRange(options.density, .125, 1, 1),
			detail: finiteRange(options.detail, .25, 2, 1),
			speed: finiteRange(options.speed, .25, 2, 1)
		};
	}
	function createLightningFireTornadoEffect(spec, options = {}) {
		const { duration, fade } = LIGHTNING_FIRE_TORNADO;
		const lifecycle = {
			start: fade,
			end: fade
		};
		let settings = Object.freeze(normalizeLightningFireTornadoOptions(options));
		const tornado = new LightningFireTornadoVFX({
			duration,
			loop: false,
			initialTime: 0,
			scale: settings.size,
			density: settings.density,
			intensityScale: settings.detail
		});
		const { group } = tornado;
		group.name = spec.id;
		let elapsed = 0, disposed = false;
		function applyColor() {
			tornado.applyPalette("inferno");
			if (settings.color.toLowerCase() !== defaultColor) tornado.setColors({ fireA: settings.color });
		}
		applyColor();
		function seek(seconds) {
			if (disposed || !Number.isFinite(seconds)) return;
			elapsed = three.MathUtils.clamp(seconds, 0, duration);
			tornado.setProgress(elapsed / duration);
			group.visible = elapsed < duration;
		}
		return {
			group,
			lifecycle,
			duration,
			seek,
			get settings() {
				return settings;
			},
			get elapsed() {
				return elapsed;
			},
			get phase() {
				return disposed || elapsed >= duration ? "finished" : elapsed < fade ? "starting" : elapsed >= duration - fade ? "ending" : "active";
			},
			get finished() {
				return disposed || elapsed >= duration;
			},
			get particleCount() {
				return tornado._moteMesh.count + tornado._streakMesh.count + tornado._debrisMesh.count + tornado._ambientBoltMesh.count + tornado._flashNodeMesh.count;
			},
			update(dt) {
				if (Number.isFinite(dt) && dt > 0 && elapsed < duration) seek(elapsed + dt * settings.speed);
			},
			reset() {
				seek(0);
			},
			setOptions(partial = {}) {
				if (disposed) return;
				const next = normalizeLightningFireTornadoOptions({
					...settings,
					...partial
				});
				const recolor = next.color !== settings.color;
				settings = Object.freeze(next);
				tornado.setParams({
					scale: settings.size,
					density: settings.density,
					intensityScale: settings.detail
				});
				if (recolor) applyColor();
				seek(elapsed);
			},
			dispose() {
				if (!disposed) {
					disposed = true;
					group.visible = false;
					tornado.dispose();
				}
			}
		};
	}

//#endregion
exports.LIGHTNING_FIRE_TORNADO = LIGHTNING_FIRE_TORNADO;
exports.LightningFireTornadoVFX = LightningFireTornadoVFX;
exports.createLightningFireTornadoEffect = createLightningFireTornadoEffect;
exports.normalizeLightningFireTornadoOptions = normalizeLightningFireTornadoOptions;
return exports;
})({}, THREE);
const LIGHTNING_FIRE_TORNADO = __vfxModule.LIGHTNING_FIRE_TORNADO;
const LightningFireTornadoVFX = __vfxModule.LightningFireTornadoVFX;
const createLightningFireTornadoEffect = __vfxModule.createLightningFireTornadoEffect;
const normalizeLightningFireTornadoOptions = __vfxModule.normalizeLightningFireTornadoOptions;

export {LightningFireTornadoVFX};
export const defaultOptions={"color":"#d91644","size":1,"density":1,"detail":1,"speed":1};
export default function createVFX(options={}){return createLightningFireTornadoEffect({"id":"lightning-fire-tornado"},{...defaultOptions,...options});}
