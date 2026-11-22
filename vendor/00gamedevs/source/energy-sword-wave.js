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
// 扇形劍氣 / Energy Sword Wave — Three.js 0.187.0 / WebGL2.
// Add fx.group and call update(deltaSeconds). Reset replays from the same placement.
// Launch point: group origin. XZ ground, +Y up, +Z forward; one 1.55-second cast at speed 1.
// quantity: 1–5 (default 5); spread: 1 for a 60-degree fan. No external assets or render hook.
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

//#endregion
//#region src/effects/energy-sword-wave-runtime.js
/**
	* ============================================================================
	* EnergySwordWaveVFX — High-Performance Stylized Toon 3D Energy Slash for Three.js
	* ----------------------------------------------------------------------------
	* Features:
	*   - 100% Procedural GLSL Shaders (Zero external texture fetches)
	*   - Multi-layered Crescent Arc: HDR Core + Volumetric Glow Aura + Dark Ink Veil + Upper Crest Ribbon
	*   - Ground Slicing System: Dynamic Scorched Trench + Blinding Friction Seam + Contact Flare
	*   - Launch Origin Recoil: Stylized Dark Ink Arc + Cel Smoke Billows + Origin Burst
	*   - Deterministic Analytical InstancedMesh Particle Pools (Zero per-frame GC allocations):
	*       * Tumbling Angular Rock Debris with Ground Bounce
	*       * Hot Amber Friction Sparks
	*       * Luminous Energy Speed Needles
	*       * Crisp Black-Ink Anime Speed Lines
	*       * 4-Point Anime Star Sparkles (✦)
	*   - Deterministic Timeline Scrubbing (`setProgress(0..1)`) & Clean `dispose()`
	*
	* Quick Usage:
	*   const vfx = new EnergySwordWaveVFX(scene, { theme: 'azure', scale: 1.0 });
	*   vfx.trigger(new THREE.Vector3(0, 0, 0), 0); // origin, yawRadians
	*   // Inside your animation loop:
	*   vfx.update(deltaSeconds);
	* ============================================================================
	*/
	var EnergySwordWaveVFX = class EnergySwordWaveVFX {
		static THEMES = {
			azure: {
				name: "蒼藍劍氣",
				core: 15138815,
				mid: 38399,
				deep: 13260,
				ink: 527386,
				spark: 16755251,
				light: 3718648
			},
			crimson: {
				name: "緋紅獄炎",
				core: 16773337,
				mid: 16722517,
				deep: 9371677,
				ink: 1705484,
				spark: 16768341,
				light: 16007006
			},
			void: {
				name: "紫電幽冥",
				core: 16377599,
				mid: 11032055,
				deep: 4988309,
				ink: 1116191,
				spark: 3718648,
				light: 12616956
			},
			solar: {
				name: "聖光金焰",
				core: 16777215,
				mid: 16498468,
				deep: 11817737,
				ink: 1839621,
				spark: 16773544,
				light: 16638023
			}
		};
		static GLSL_NOISE = `
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                         -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m;
      m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    float fbm(vec2 p) {
      float f = 0.0;
      f += 0.55 * snoise(p);
      f += 0.30 * snoise(p * 2.13 + vec2(13.7, 7.1));
      f += 0.15 * snoise(p * 4.31 + vec2(3.2, 19.4));
      return f;
    }
  `;
		constructor(scene, options = {}) {
			this.scene = scene;
			this.options = Object.assign({
				theme: "azure",
				scale: 1,
				intensity: 1.25,
				duration: 1.55,
				travelDistance: 17.5,
				startZ: 0,
				yLayerOffset: 0,
				enableLights: true,
				showInkLines: true,
				showDebris: true,
				showTrench: true
			}, options);
			this.root = new three.Group();
			this.root.scale.setScalar(this.options.scale);
			this.scene.add(this.root);
			this.bladeGroup = new three.Group();
			this.root.add(this.bladeGroup);
			this._mat4 = new three.Matrix4();
			this._pos = new three.Vector3();
			this._scale = new three.Vector3();
			this._quat = new three.Quaternion();
			this._euler = new three.Euler();
			this.active = false;
			this.progress = 0;
			this.elapsedTime = 0;
			this._disposables = {
				geometries: [],
				materials: []
			};
			const palette = EnergySwordWaveVFX.THEMES[this.options.theme] || EnergySwordWaveVFX.THEMES.azure;
			this._colors = {
				core: new three.Color(palette.core),
				mid: new three.Color(palette.mid),
				deep: new three.Color(palette.deep),
				ink: new three.Color(palette.ink),
				spark: new three.Color(palette.spark),
				light: new three.Color(palette.light)
			};
			this._buildLighting();
			this._buildCrescentLayers();
			this._buildGroundTrenchAndSeam();
			this._buildHeadContactVFX();
			this._buildLaunchOrigin();
			this._buildParticlePools();
			for (const mesh of [
				this.rocksMesh,
				this.sparksMesh,
				this.needlesMesh,
				this.inkLinesMesh,
				this.starsMesh,
				this.smokeMesh
			]) mesh.frustumCulled = false;
			this.setProgress(.48);
		}
		_trackGeo(g) {
			this._disposables.geometries.push(g);
			return g;
		}
		_trackMat(m) {
			this._disposables.materials.push(m);
			return m;
		}
		_seededRandom(seed) {
			let s = seed % 2147483647;
			if (s <= 0) s += 2147483646;
			return () => {
				s = s * 16807 % 2147483647;
				return (s - 1) / 2147483646;
			};
		}
		_buildLighting() {
			if (!this.options.enableLights) {
				this.bladeLight = null;
				this.originLight = null;
				return;
			}
			this.bladeLight = new three.PointLight(this._colors.light, 4.5, 22, 1.5);
			this.bladeLight.position.set(0, 2.2, 2);
			this.bladeGroup.add(this.bladeLight);
			this.originLight = new three.PointLight(this._colors.light, 3, 14, 1.8);
			this.originLight.position.set(0, 1.1, this.options.startZ);
			this.root.add(this.originLight);
		}
		/**
		* Builds a volumetric double-sided curved anime crescent blade geometry.
		* u in [0, 1]: ground contact (0) -> upper swept crest (1)
		* v in [0, 1]: razor-sharp leading edge (0) -> trailing plasma wake (1)
		*/
		_createCrescentGeometry(uSegs, vSegs, trailScale = 1, radiusScale = 1, flareWidth = .28) {
			const positions = [];
			const uvs = [];
			const indices = [];
			const sides = [-1, 1];
			const vertsPerSide = (uSegs + 1) * (vSegs + 1);
			for (let s = 0; s < sides.length; s++) {
				const side = sides[s];
				for (let iu = 0; iu <= uSegs; iu++) {
					const u = iu / uSegs;
					const theta = three.MathUtils.lerp(-.12, 1.88, u);
					const yBase = (Math.sin(theta) - Math.sin(-.12)) * 5.25 * radiusScale;
					const zBase = Math.cos(theta - .16) * 3.25 * radiusScale;
					const wakeProfile = .42 + .58 * Math.sin(Math.pow(u, .78) * Math.PI * .92 + .16);
					const trailLen = 8.4 * trailScale * wakeProfile;
					for (let iv = 0; iv <= vSegs; iv++) {
						const v = iv / vSegs;
						const z = zBase - v * trailLen;
						const yLift = Math.sin(v * Math.PI * .7) * (.28 - u * .55) * radiusScale;
						const y = Math.max(-.08, yBase + yLift);
						const arcEnvelope = Math.sin(u * Math.PI * .95 + .05);
						const x = side * Math.pow(v, .75) * flareWidth * (.35 + .65 * arcEnvelope);
						positions.push(x, y, z);
						uvs.push(u, v);
					}
				}
				const baseOffset = s * vertsPerSide;
				for (let iu = 0; iu < uSegs; iu++) for (let iv = 0; iv < vSegs; iv++) {
					const a = baseOffset + iu * (vSegs + 1) + iv;
					const b = a + 1;
					const c = a + (vSegs + 1);
					const d = c + 1;
					if (side > 0) indices.push(a, b, d, a, d, c);
					else indices.push(a, d, b, a, c, d);
				}
			}
			const geo = new three.BufferGeometry();
			geo.setAttribute("position", new three.Float32BufferAttribute(positions, 3));
			geo.setAttribute("uv", new three.Float32BufferAttribute(uvs, 2));
			geo.setIndex(indices);
			geo.computeVertexNormals();
			return this._trackGeo(geo);
		}
		_buildCrescentLayers() {
			const coreGeo = this._createCrescentGeometry(44, 24, 1, 1, .24);
			this.bladeMaterial = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uFade: { value: 1 },
					uIntensity: { value: this.options.intensity },
					uColorCore: { value: this._colors.core },
					uColorMid: { value: this._colors.mid },
					uColorDeep: { value: this._colors.deep }
				},
				vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uFade;
        uniform float uIntensity;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        uniform vec3 uColorDeep;
        varying vec2 vUv;
        ${EnergySwordWaveVFX.GLSL_NOISE}

        void main() {
          float u = vUv.x; // 0 = ground tip, 1 = upper swept tip
          float v = vUv.y; // 0 = leading edge, 1 = trailing wake

          // High-speed horizontally stretched wind streaks flowing backward
          float streak1 = snoise(vec2(u * 14.0, v * 2.6 - uTime * 8.5));
          float streak2 = snoise(vec2(u * 28.0 + 4.1, v * 4.5 - uTime * 13.0));
          float wisps = fbm(vec2(u * 7.0, v * 2.2 - uTime * 6.0));

          // Leading edge thickness tapers smoothly toward upper tip
          float edgeThickness = mix(0.11, 0.045, pow(u, 1.2));
          float edgeDist = v + streak1 * 0.014;
          float hotCore = smoothstep(edgeThickness, 0.0, edgeDist);
          float crispRim = smoothstep(edgeThickness * 0.48, 0.0, edgeDist);

          // Ground friction boost near u = 0
          float groundHotspot = smoothstep(0.22, 0.0, u) * smoothstep(0.45, 0.0, v);

          // Trailing energy body with stylized wind-ripped dissolve
          float tailFade = smoothstep(1.0, 0.08, v + wisps * 0.34);
          float streakBands = smoothstep(-0.25, 0.72, streak1 * 0.65 + streak2 * 0.35);
          float bodyEnergy = tailFade * (0.38 + 0.75 * streakBands);

          // Feather fade at extreme top tip (u -> 1) and soft plasma melt at ground contact (u -> 0)
          float topFeather = smoothstep(1.0, 0.78, u + v * 0.16);
          float bottomEdge = smoothstep(0.0, 0.055, u + streak1 * 0.012);

          // Color composition: Deep Blue -> Electric Cyan -> Blinding White Core
          vec3 col = mix(uColorDeep, uColorMid, clamp(bodyEnergy * 1.15 + hotCore * 0.6, 0.0, 1.0));
          col = mix(col, uColorCore * 1.65, clamp(hotCore * 0.92 + crispRim * 0.65 + groundHotspot * 0.75, 0.0, 1.0));

          // Extra glowing streak highlights inside wake
          float fineHighlight = smoothstep(0.55, 0.88, streak2) * smoothstep(0.85, 0.05, v) * 0.55;
          col += uColorCore * fineHighlight;

          float alpha = clamp((hotCore * 1.15 + bodyEnergy * 0.78 + groundHotspot * 0.65) * topFeather * bottomEdge, 0.0, 1.0);
          alpha *= uFade;
          if (alpha < 0.015) discard;

          gl_FragColor = vec4(col * uIntensity, alpha);
        }
      `,
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending
			}));
			this.bladeMesh = new three.Mesh(coreGeo, this.bladeMaterial);
			this.bladeGroup.add(this.bladeMesh);
			const auraGeo = this._createCrescentGeometry(32, 16, 1.12, 1.045, .58);
			this.auraMaterial = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uFade: { value: 1 },
					uIntensity: { value: this.options.intensity },
					uColorCore: { value: this._colors.core },
					uColorMid: { value: this._colors.mid }
				},
				vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uFade;
        uniform float uIntensity;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        varying vec2 vUv;
        ${EnergySwordWaveVFX.GLSL_NOISE}

        void main() {
          float u = vUv.x;
          float v = vUv.y;
          float n = snoise(vec2(u * 6.0, v * 2.0 - uTime * 5.0));
          float edgeGlow = exp(-v * 4.2) * (0.65 + 0.35 * smoothstep(0.85, 0.0, u));
          float softBody = smoothstep(0.95, 0.0, v + n * 0.25) * 0.22;
          float tipMask = smoothstep(1.0, 0.72, u);
          float bottomMask = smoothstep(0.0, 0.07, u + n * 0.015);
          vec3 col = mix(uColorMid, uColorCore, exp(-v * 9.0) * 0.7);
          float alpha = (edgeGlow * 0.42 + softBody) * tipMask * bottomMask * uFade;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col * uIntensity, alpha);
        }
      `,
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending
			}));
			this.auraMesh = new three.Mesh(auraGeo, this.auraMaterial);
			this.bladeGroup.add(this.auraMesh);
			const inkGeo = this._createCrescentGeometry(36, 16, .88, .96, .32);
			this.inkVeilMaterial = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uFade: { value: 1 },
					uColorInk: { value: this._colors.ink }
				},
				vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uFade;
        uniform vec3 uColorInk;
        varying vec2 vUv;
        ${EnergySwordWaveVFX.GLSL_NOISE}

        void main() {
          float u = vUv.x;
          float v = vUv.y;

          // Only appears behind the blinding leading edge
          float bandMask = smoothstep(0.11, 0.22, v) * smoothstep(0.86, 0.32, v);
          float arcMask = smoothstep(0.05, 0.20, u) * smoothstep(0.90, 0.65, u);

          // Sharp anime ink flame / tear silhouettes via cel-stepped FBM
          float n1 = snoise(vec2(u * 10.0, v * 3.8 - uTime * 7.2));
          float n2 = snoise(vec2(u * 21.0 + 3.0, v * 6.5 - uTime * 10.5));
          float shape = n1 * 0.65 + n2 * 0.35;

          float inkBlob = smoothstep(0.32, 0.42, shape) * bandMask * arcMask;
          float alpha = inkBlob * 0.68 * uFade;
          if (alpha < 0.02) discard;

          gl_FragColor = vec4(uColorInk, alpha);
        }
      `,
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.NormalBlending
			}));
			this.inkVeilMesh = new three.Mesh(inkGeo, this.inkVeilMaterial);
			this.inkVeilMesh.renderOrder = -1;
			this.bladeGroup.add(this.inkVeilMesh);
			const ribbonGeo = this._trackGeo(new three.PlaneGeometry(1, 1, 28, 6));
			const rPos = ribbonGeo.attributes.position;
			for (let i = 0; i < rPos.count; i++) {
				const t = rPos.getX(i) + .5;
				const w = rPos.getY(i);
				const z = -.35 - t * 10.5;
				const y = 6 - Math.pow(t, 1.35) * 1.45 + Math.sin(t * 4.2) * .28 + w * (1.25 - t * .7);
				const x = Math.sin(t * 3.5) * .35 + w * .22;
				rPos.setXYZ(i, x, y, z);
			}
			ribbonGeo.computeVertexNormals();
			this.ribbonMaterial = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uFade: { value: 1 },
					uIntensity: { value: this.options.intensity },
					uColorCore: { value: this._colors.core },
					uColorMid: { value: this._colors.mid }
				},
				vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uFade;
        uniform float uIntensity;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        varying vec2 vUv;
        ${EnergySwordWaveVFX.GLSL_NOISE}

        void main() {
          float t = vUv.x;
          float w = abs(vUv.y - 0.5) * 2.0;
          float n = snoise(vec2(t * 5.0 - uTime * 7.5, vUv.y * 4.5));
          float ribbon = smoothstep(1.0, 0.0, w + n * 0.38);
          float lengthMask = smoothstep(0.0, 0.12, t) * smoothstep(1.0, 0.15, t);
          vec3 col = mix(uColorMid, uColorCore, smoothstep(0.65, 0.0, w) * 0.55);
          float alpha = ribbon * lengthMask * 0.52 * uFade;
          if (alpha < 0.015) discard;
          gl_FragColor = vec4(col * uIntensity, alpha);
        }
      `,
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending
			}));
			this.ribbonMesh = new three.Mesh(ribbonGeo, this.ribbonMaterial);
			this.bladeGroup.add(this.ribbonMesh);
		}
		_buildGroundTrenchAndSeam() {
			const trenchLen = this.options.travelDistance + 10.5;
			const trenchGeo = this._trackGeo(new three.PlaneGeometry(5.5, trenchLen, 1, 1));
			trenchGeo.rotateX(-Math.PI / 2);
			trenchGeo.translate(0, 0, this.options.startZ + this.options.travelDistance * .55);
			this.trenchMaterial = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uStartZ: { value: this.options.startZ },
					uBladeTipZ: { value: 0 },
					uFade: { value: 1 },
					uColorCore: { value: this._colors.core },
					uColorMid: { value: this._colors.mid },
					uColorSpark: { value: this._colors.spark }
				},
				vertexShader: `
        varying vec3 vLocal;
        void main() {
          vLocal = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uStartZ;
        uniform float uBladeTipZ;
        uniform float uFade;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        uniform vec3 uColorSpark;
        varying vec3 vLocal;
        ${EnergySwordWaveVFX.GLSL_NOISE}

        void main() {
          float z = vLocal.z;
          float x = abs(vLocal.x);

          // Strictly clip trench so ground cracks never extend ahead of the sword wave cutting edge
          if (z > uBladeTipZ || z < uStartZ - 0.5) discard;

          float distBehind = max(0.0, uBladeTipZ - z);
          float startCap = smoothstep(uStartZ - 0.5, uStartZ + 0.7, z);
          float frontCap = smoothstep(uBladeTipZ, uBladeTipZ - 0.55, z);

          // Rugged torn ground width tapering sharply into the blade's cutting point
          float edgeNoise = snoise(vec2(z * 0.75, 1.7)) * 0.34 + snoise(vec2(z * 2.1, 4.2)) * 0.14;
          float width = (1.15 + edgeNoise) * (0.14 + 0.86 * frontCap);
          float trenchMask = smoothstep(width, width * 0.12, x) * startCap * smoothstep(uBladeTipZ, uBladeTipZ - 0.18, z);
          if (trenchMask < 0.02) discard;

          // Charred earth texture & angular rock cracks
          float crackPattern = abs(snoise(vec2(vLocal.x * 2.4, z * 1.45)));
          float cracks = smoothstep(0.14, 0.02, crackPattern);

          // Recency glow decays behind moving blade; keep center fissure subtle & ultra-thin
          float recency = exp(-distBehind * 0.12);
          float thinFissure = smoothstep(0.055, 0.0, x) * recency * frontCap;

          vec3 scorched = vec3(0.04, 0.045, 0.06);
          vec3 emberGlow = mix(uColorMid, uColorSpark, 0.35) * cracks * recency * 1.35;
          vec3 fissureGlow = mix(uColorMid, uColorCore, 0.65) * thinFissure * 0.95;

          vec3 col = scorched + emberGlow + fissureGlow;
          float alpha = clamp(trenchMask * 0.88 + thinFissure * 0.3, 0.0, 1.0) * uFade;
          gl_FragColor = vec4(col, alpha);
        }
      `,
				transparent: true,
				depthWrite: false
			}));
			this.trenchMesh = new three.Mesh(trenchGeo, this.trenchMaterial);
			this.trenchMesh.position.set(0, .02 + this.options.yLayerOffset, 0);
			this.root.add(this.trenchMesh);
			const seamGeo = this._trackGeo(new three.PlaneGeometry(.62, 13.5, 1, 1));
			seamGeo.rotateX(-Math.PI / 2);
			seamGeo.translate(0, .055 + this.options.yLayerOffset, -3.7);
			this.seamMaterial = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uFade: { value: 1 },
					uMaxTrailLen: { value: 13.5 },
					uIntensity: { value: this.options.intensity },
					uColorCore: { value: this._colors.core },
					uColorMid: { value: this._colors.mid }
				},
				vertexShader: `
        varying vec2 vUv;
        varying float vLocalZ;
        void main() {
          vUv = uv;
          vLocalZ = position.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uFade;
        uniform float uMaxTrailLen;
        uniform float uIntensity;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        varying vec2 vUv;
        varying float vLocalZ;
        ${EnergySwordWaveVFX.GLSL_NOISE}

        void main() {
          // Exact distance behind the blade's ground cutting tip (+3.05 in bladeGroup space)
          float distBehind = 3.05 - vLocalZ;
          if (distBehind < 0.0 || distBehind > uMaxTrailLen) discard;

          // tailToHead: 1.0 at blade contact tip -> 0.0 at sharp needle tail
          float tailToHead = clamp(1.0 - distBehind / uMaxTrailLen, 0.0, 1.0);
          float headToTail = 1.0 - tailToHead;

          // Concave needle profile: 1/3 thickness at front, tapering to an ultra-fine pointed tail
          float frontPinch = smoothstep(0.0, 0.035, headToTail);
          float needleProfile = pow(tailToHead, 1.85);
          float currentHalfWidth = max(0.012, needleProfile * (0.45 + 0.55 * frontPinch));

          float x = abs(vUv.x - 0.5) * 2.0;
          float flicker = snoise(vec2(distBehind * 2.2 - uTime * 16.0, 2.0)) * 0.08 * needleProfile;
          float nx = max(0.0, x - abs(flicker) * 0.2) / currentHalfWidth;

          // Razor-sharp white core + tight electric cyan halo
          float coreLine = smoothstep(0.40, 0.0, nx);
          float tightHalo = exp(-nx * 3.6) * 0.45;
          float tailTipFade = smoothstep(0.0, 0.07, tailToHead);

          // Compact bright hotspot tucked right beneath the blade's bottom edge
          float tipFlare = exp(-length(vec2(x * 2.8, headToTail * 15.0)) * 2.5) * 0.9 * frontPinch;

          vec3 col = mix(uColorMid, uColorCore * 1.55, clamp(coreLine * 0.92 + tipFlare * 0.5, 0.0, 1.0));
          float alpha = clamp((coreLine + tightHalo) * tailTipFade + tipFlare, 0.0, 1.0) * uFade;
          if (alpha < 0.015) discard;

          gl_FragColor = vec4(col * uIntensity, alpha);
        }
      `,
				transparent: true,
				depthWrite: false,
				blending: three.AdditiveBlending
			}));
			this.seamMesh = new three.Mesh(seamGeo, this.seamMaterial);
			this.bladeGroup.add(this.seamMesh);
		}
		/**
		* Builds 3-layered head ground-contact plasma VFX (Ground Bow-Wave Plow,
		* 3D Dual-Flank Energy Splash Fins, and Soft-Feathered Contact Core Flare)
		* to seamlessly mask the geometric intersection between the blade tip and floor.
		*/
		_buildHeadContactVFX() {
			const plowGeo = this._trackGeo(new three.PlaneGeometry(3.8, 4.8, 1, 1));
			plowGeo.rotateX(-Math.PI / 2);
			plowGeo.translate(0, .075 + this.options.yLayerOffset, 2.25);
			this.headPlowMat = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uFade: { value: 1 },
					uIntensity: { value: this.options.intensity },
					uColorCore: { value: this._colors.core },
					uColorMid: { value: this._colors.mid },
					uColorSpark: { value: this._colors.spark }
				},
				vertexShader: `
        varying vec3 vLocal;
        void main() {
          vLocal = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uFade;
        uniform float uIntensity;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        uniform vec3 uColorSpark;
        varying vec3 vLocal;
        ${EnergySwordWaveVFX.GLSL_NOISE}

        void main() {
          // Local coordinates relative to the blade's front ground-cutting nose (z ≈ 3.16)
          float dz = 3.18 - vLocal.z;
          float ax = abs(vLocal.x);

          // High-speed rushing energy turbulence sweeping backward from nose
          float n1 = snoise(vec2(vLocal.x * 2.8, dz * 2.2 - uTime * 15.0));
          float n2 = snoise(vec2(vLocal.x * 6.2 + 3.1, dz * 4.0 - uTime * 22.0));

          // Forward incandescent plasma cushion right around the cutting junction
          float noseDist = length(vec2(ax * 1.45, (dz - 0.12) * 0.92));
          float nosePool = exp(-noseDist * (2.65 - n1 * 0.42));
          float noseHot = exp(-noseDist * 5.2);

          // Supersonic V-shaped bow-wave wings sweeping backward along both flanks
          float wingActive = smoothstep(-0.32, 0.18, dz) * smoothstep(3.15, 0.45, dz);
          float wingCurve = 0.14 + pow(max(0.0, dz + 0.12), 0.74) * 0.64;
          float wingDist = abs(ax - wingCurve + n1 * 0.11);
          float bowWing = exp(-wingDist * 5.6) * wingActive * (0.65 + 0.45 * smoothstep(-0.3, 0.7, n2));

          // Electric crackle accents hugging the contact edge
          float crackle = smoothstep(0.58, 0.90, n2) * exp(-noseDist * 2.0) * 0.45;

          float alpha = clamp(nosePool * 0.85 + bowWing * 0.72 + crackle, 0.0, 1.0);
          // Smooth elliptical fade at plane boundaries
          float bounds = smoothstep(1.88, 1.15, ax) * smoothstep(-1.15, -0.35, dz) * smoothstep(3.25, 1.8, dz);
          alpha *= bounds * uFade;
          if (alpha < 0.015) discard;

          vec3 col = mix(uColorMid, uColorCore * 1.6, clamp(noseHot * 0.95 + bowWing * 0.45 + nosePool * 0.35, 0.0, 1.0));
          col += uColorSpark * crackle * 0.55;
          gl_FragColor = vec4(col * uIntensity, alpha);
        }
      `,
				transparent: true,
				depthWrite: false,
				blending: three.AdditiveBlending
			}));
			this.headPlowMesh = new three.Mesh(plowGeo, this.headPlowMat);
			this.headPlowMesh.renderOrder = 4;
			this.bladeGroup.add(this.headPlowMesh);
			const uSegs = 14;
			const vSegs = 16;
			const spPos = [];
			const spUvs = [];
			const spIdx = [];
			const spSides = [-1, 1];
			const vertsPerSide = 255;
			for (let s = 0; s < spSides.length; s++) {
				const side = spSides[s];
				for (let iu = 0; iu <= uSegs; iu++) {
					const u = iu / uSegs;
					for (let iv = 0; iv <= vSegs; iv++) {
						const v = iv / vSegs;
						const z = 3.38 - v * 3.15 - u * .55;
						const y = .04 + u * (.26 + Math.sin(Math.pow(v, .7) * Math.PI * .82) * 1.48);
						const xFlare = .05 + Math.pow(v, .82) * .88 + Math.pow(u, 1.15) * (.34 + v * .52);
						spPos.push(side * xFlare, y, z);
						spUvs.push(u, v);
					}
				}
				const baseOff = s * vertsPerSide;
				for (let iu = 0; iu < uSegs; iu++) for (let iv = 0; iv < vSegs; iv++) {
					const a = baseOff + iu * 17 + iv;
					const b = a + 1;
					const c = a + 17;
					const d = c + 1;
					if (side > 0) spIdx.push(a, b, d, a, d, c);
					else spIdx.push(a, d, b, a, c, d);
				}
			}
			const splashGeo = new three.BufferGeometry();
			splashGeo.setAttribute("position", new three.Float32BufferAttribute(spPos, 3));
			splashGeo.setAttribute("uv", new three.Float32BufferAttribute(spUvs, 2));
			splashGeo.setIndex(spIdx);
			splashGeo.computeVertexNormals();
			this._trackGeo(splashGeo);
			this.headSplashMat = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uFade: { value: 1 },
					uIntensity: { value: this.options.intensity },
					uColorCore: { value: this._colors.core },
					uColorMid: { value: this._colors.mid }
				},
				vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uFade;
        uniform float uIntensity;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        varying vec2 vUv;
        ${EnergySwordWaveVFX.GLSL_NOISE}

        void main() {
          float u = vUv.x;
          float v = vUv.y;

          // Rushing anime energy spray streaks tearing upward & backward
          float s1 = snoise(vec2(u * 8.5, v * 3.5 - uTime * 16.0));
          float s2 = snoise(vec2(u * 18.0 + 2.4, v * 6.5 - uTime * 23.0));
          float wisps = s1 * 0.65 + s2 * 0.35;

          float frontIn = smoothstep(0.0, 0.09, v);
          float backOut = smoothstep(1.0, 0.14, v + wisps * 0.34);
          float topOut = smoothstep(1.0, 0.12, u + wisps * 0.36);
          float baseHot = smoothstep(0.38, 0.0, u) * smoothstep(0.55, 0.0, v);

          float bands = smoothstep(-0.22, 0.68, wisps);
          float alpha = (baseHot * 0.92 + frontIn * backOut * topOut * (0.36 + 0.72 * bands)) * frontIn * topOut;
          alpha = clamp(alpha, 0.0, 1.0) * 0.85 * uFade;
          if (alpha < 0.015) discard;

          vec3 col = mix(uColorMid, uColorCore * 1.55, clamp(baseHot * 0.85 + smoothstep(0.45, 0.88, s2) * 0.45, 0.0, 1.0));
          gl_FragColor = vec4(col * uIntensity, alpha);
        }
      `,
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending
			}));
			this.headSplashMesh = new three.Mesh(splashGeo, this.headSplashMat);
			this.headSplashMesh.renderOrder = 4;
			this.bladeGroup.add(this.headSplashMesh);
			const flareGeo = this._trackGeo(new three.PlaneGeometry(3.2, 2.3));
			this.headFlareMat = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uFade: { value: 1 },
					uIntensity: { value: this.options.intensity },
					uColorCore: { value: this._colors.core },
					uColorMid: { value: this._colors.mid },
					uColorSpark: { value: this._colors.spark }
				},
				vertexShader: `
        varying vec2 vUv;
        varying float vWorldY;
        void main() {
          vUv = uv;
          vec4 center = modelViewMatrix[3];
          vec2 offset = position.xy * vec2(length(modelViewMatrix[0].xyz), length(modelViewMatrix[1].xyz));
          vWorldY = modelMatrix[3].y + dot(offset, viewMatrix[1].xy);
          center.xy += offset;
          gl_Position = projectionMatrix * center;
        }
      `,
				fragmentShader: `
        uniform float uTime;
        uniform float uFade;
        uniform float uIntensity;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        uniform vec3 uColorSpark;
        varying vec2 vUv;
        varying float vWorldY;
        ${EnergySwordWaveVFX.GLSL_NOISE}

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;

          float ang = atan(p.y, p.x);
          float boil = snoise(vec2(ang * 3.0, r * 4.2 - uTime * 12.0));
          float rayFlicker = 0.5 + 0.5 * snoise(vec2(ang * 7.5 + uTime * 4.0, 1.7));

          // Boiling plasma core directly masking the blade-to-ground corner
          float core = exp(-r * (4.5 - boil * 0.65));
          // Crisp horizontal anamorphic energy flare skimming above the floor
          float hStreak = exp(-abs(p.y) * 12.5) * exp(-abs(p.x) * 1.95) * (0.78 + 0.22 * rayFlicker);
          // Subtle diagonal anime impact star rays
          float diagRays = (exp(-abs(p.x - p.y) * 14.0) + exp(-abs(p.x + p.y) * 14.0)) * exp(-r * 2.9);
          float outerHalo = exp(-r * 2.15) * 0.44;

          // Soft world-Y ground feather avoids any flat billboard-floor intersection line
          float groundSoft = smoothstep(-0.01, 0.24, vWorldY);
          float edgeFade = smoothstep(1.0, 0.34, r);

          float alpha = clamp((core * 1.15 + hStreak * 0.85 + diagRays * 0.32 + outerHalo) * edgeFade * groundSoft, 0.0, 1.0) * uFade;
          if (alpha < 0.015) discard;

          vec3 col = mix(uColorMid, uColorCore * 1.65, clamp(core * 0.92 + hStreak * 0.62, 0.0, 1.0));
          col += uColorSpark * smoothstep(0.62, 1.0, rayFlicker) * exp(-r * 3.6) * 0.32;
          gl_FragColor = vec4(col * uIntensity, alpha);
        }
      `,
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending
			}));
			this.headFlareMesh = new three.Mesh(flareGeo, this.headFlareMat);
			this.headFlareMesh.frustumCulled = false;
			this.headFlareMesh.position.set(0, .28, 3.16);
			this.headFlareMesh.renderOrder = 5;
			this.bladeGroup.add(this.headFlareMesh);
		}
		_buildLaunchOrigin() {
			const burstGeo = this._trackGeo(new three.PlaneGeometry(3.6, 1.4));
			burstGeo.rotateX(-Math.PI / 2);
			this.originBurstMat = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uAlpha: { value: 1 },
					uIntensity: { value: this.options.intensity },
					uColorCore: { value: this._colors.core },
					uColorMid: { value: this._colors.mid }
				},
				vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform float uAlpha;
        uniform float uIntensity;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float d = length(vec2(p.x * 1.0, p.y * 1.8));
          float core = exp(-d * 4.5);
          float glow = exp(-d * 1.9) * 0.6;
          vec3 col = mix(uColorMid, uColorCore * 1.5, core);
          float a = clamp(core + glow, 0.0, 1.0) * uAlpha;
          if (a < 0.015) discard;
          gl_FragColor = vec4(col * uIntensity, a);
        }
      `,
				transparent: true,
				depthWrite: false,
				blending: three.AdditiveBlending
			}));
			this.originBurstMesh = new three.Mesh(burstGeo, this.originBurstMat);
			this.originBurstMesh.position.set(0, .07 + this.options.yLayerOffset, this.options.startZ + .8);
			this.originBurstMesh.rotation.y = Math.PI * .5;
			this.root.add(this.originBurstMesh);
		}
		_buildParticlePools() {
			const rand = this._seededRandom(202607);
			this.maxRocks = 58;
			const rockGeo = this._trackGeo(new three.IcosahedronGeometry(.18, 0));
			const rkPos = rockGeo.attributes.position;
			for (let i = 0; i < rkPos.count; i++) {
				const rx = rkPos.getX(i), ry = rkPos.getY(i), rz = rkPos.getZ(i);
				const jitter = .78 + i * 37 % 10 * .045;
				rkPos.setXYZ(i, rx * jitter * 1.15, ry * jitter * .82, rz * jitter * 1.05);
			}
			rockGeo.computeVertexNormals();
			this.rockMat = this._trackMat(new three.MeshStandardMaterial({
				color: 3882826,
				roughness: .88,
				metalness: .12,
				flatShading: true
			}));
			this.rocksMesh = new three.InstancedMesh(rockGeo, this.rockMat, this.maxRocks);
			this.rocksMesh.instanceMatrix.setUsage(three.DynamicDrawUsage);
			this.root.add(this.rocksMesh);
			this.rocksData = [];
			for (let i = 0; i < this.maxRocks; i++) {
				const side = i % 2 === 0 ? 1 : -1;
				const spawnP = rand() * .64;
				const energyFalloff = 1 - .42 * three.MathUtils.smoothstep(spawnP, .34, .64);
				this.rocksData.push({
					spawnP,
					side,
					x0: side * (.28 + rand() * .62),
					y0: .1 + rand() * .16,
					zOffset: (rand() - .5) * .75,
					vx: side * (1.2 + rand() * 2.8) * energyFalloff,
					vy: (2.9 + rand() * 4.4) * energyFalloff,
					vz: -(1 + rand() * 3.2) * energyFalloff,
					rot0: new three.Vector3(rand() * 6, rand() * 6, rand() * 6),
					rotVel: new three.Vector3((rand() - .5) * 14, (rand() - .5) * 14, (rand() - .5) * 14),
					scale: (.45 + rand() * 1.25) * (.72 + .28 * energyFalloff),
					life: .52 + rand() * .38
				});
			}
			this.maxSparks = 72;
			const sparkGeo = this._trackGeo(new three.PlaneGeometry(.075, .95));
			sparkGeo.rotateX(Math.PI / 2);
			this.sparkMat = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uColorSpark: { value: this._colors.spark },
					uIntensity: { value: this.options.intensity }
				},
				vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform vec3 uColorSpark;
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          float w = abs(vUv.x - 0.5) * 2.0;
          float l = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.3, vUv.y);
          float core = smoothstep(1.0, 0.0, w) * l;
          if (core < 0.05) discard;
          vec3 col = mix(uColorSpark, vec3(1.0, 0.98, 0.88), core * 0.7);
          gl_FragColor = vec4(col * 1.6 * uIntensity, core);
        }
      `,
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending
			}));
			this.sparksMesh = new three.InstancedMesh(sparkGeo, this.sparkMat, this.maxSparks);
			this.sparksMesh.instanceMatrix.setUsage(three.DynamicDrawUsage);
			this.root.add(this.sparksMesh);
			this.sparksData = [];
			for (let i = 0; i < this.maxSparks; i++) this.sparksData.push({
				spawnP: rand() * .7,
				x0: (rand() - .5) * .75,
				y0: .1 + rand() * .45,
				vx: (rand() - .5) * 3.8,
				vy: 1.5 + rand() * 4,
				vz: -(6.5 + rand() * 9),
				scale: .55 + rand() * 1.15,
				life: .18 + rand() * .28
			});
			this.maxNeedles = 46;
			const needleGeo = this._trackGeo(new three.PlaneGeometry(.06, 3.6));
			needleGeo.rotateX(Math.PI / 2);
			this.needleMat = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uColorCore: { value: this._colors.core },
					uColorMid: { value: this._colors.mid },
					uIntensity: { value: this.options.intensity }
				},
				vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          float w = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
          float l = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.2, vUv.y);
          float a = w * l;
          if (a < 0.03) discard;
          vec3 col = mix(uColorMid, uColorCore * 1.5, w * 0.75);
          gl_FragColor = vec4(col * uIntensity, a * 0.9);
        }
      `,
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending
			}));
			this.needlesMesh = new three.InstancedMesh(needleGeo, this.needleMat, this.maxNeedles);
			this.needlesMesh.instanceMatrix.setUsage(three.DynamicDrawUsage);
			this.root.add(this.needlesMesh);
			this.needlesData = [];
			for (let i = 0; i < this.maxNeedles; i++) this.needlesData.push({
				phase: rand(),
				x: (rand() - .5) * 2.2,
				y: .35 + rand() * 5.2,
				zLag: -(.8 + rand() * 8.5),
				speed: 4 + rand() * 7,
				lenScale: .55 + rand() * 1.45,
				roll: rand() * Math.PI
			});
			this.maxInkLines = 22;
			const inkLineGeo = this._trackGeo(new three.PlaneGeometry(.22, 5.2));
			inkLineGeo.rotateX(Math.PI / 2);
			this.inkLineMat = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uColorInk: { value: this._colors.ink },
					uColorAccent: { value: this._colors.mid }
				},
				vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
				fragmentShader: `
        uniform vec3 uColorInk;
        uniform vec3 uColorAccent;
        varying vec2 vUv;
        void main() {
          // A tapered ink stroke with a muted rim that reads on dark stages.
          float taper = mix(0.30, 1.0, smoothstep(0.0, 0.74, vUv.y));
          float crossStroke = (vUv.x * 2.0 - 1.0) / taper;
          float x = abs(crossStroke);
          float edgeSoftness = clamp(fwidth(crossStroke) * 0.55, 0.08, 0.32);
          float coverage = (1.0 - smoothstep(0.84 - edgeSoftness, 0.84 + edgeSoftness, x))
            * smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
          float rim = smoothstep(0.24, 0.64 + edgeSoftness * 0.5, x);
          float a = coverage * mix(0.91, 0.70, rim);
          if (a < 0.05) discard;
          vec3 color = mix(uColorInk, mix(vec3(0.42, 0.47, 0.55), uColorAccent, 0.24), rim);
          gl_FragColor = vec4(color, a);
        }
      `,
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide
			}));
			this.inkLinesMesh = new three.InstancedMesh(inkLineGeo, this.inkLineMat, this.maxInkLines);
			this.inkLinesMesh.renderOrder = -2;
			this.inkLinesMesh.instanceMatrix.setUsage(three.DynamicDrawUsage);
			this.root.add(this.inkLinesMesh);
			this.inkLinesData = [];
			for (let i = 0; i < this.maxInkLines; i++) this.inkLinesData.push({
				phase: rand(),
				x: (rand() - .5) * 2.6,
				y: 1.8 + rand() * 4.4,
				zLag: -(2 + rand() * 10),
				speed: 3 + rand() * 5,
				lenScale: .65 + rand() * 1.35,
				pitch: -.06 + (rand() - .5) * .14
			});
			this.maxStars = 38;
			const starGeo = this._trackGeo(new three.PlaneGeometry(.68, .68));
			this.starMat = this._trackMat(new three.ShaderMaterial({
				uniforms: {
					uColorCore: { value: this._colors.core },
					uColorMid: { value: this._colors.mid },
					uIntensity: { value: this.options.intensity }
				},
				vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          mat4 mv = modelViewMatrix * instanceMatrix;
          vec4 center = mv[3];
          center.xy += position.xy * vec2(length(mv[0].xyz), length(mv[1].xyz));
          gl_Position = projectionMatrix * center;
        }
      `,
				fragmentShader: `
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          vec2 p = abs(vUv - 0.5) * 2.0;
          float rays = 0.055 / (p.x * p.y + 0.022) * smoothstep(1.0, 0.05, max(p.x, p.y));
          float core = smoothstep(0.32, 0.0, length(p));
          float alpha = clamp(rays * 0.38 + core, 0.0, 1.0);
          if (alpha < 0.04) discard;
          vec3 col = mix(uColorMid, uColorCore * 1.6, clamp(core + rays * 0.35, 0.0, 1.0));
          gl_FragColor = vec4(col * uIntensity, alpha);
        }
      `,
				transparent: true,
				depthWrite: false,
				side: three.DoubleSide,
				blending: three.AdditiveBlending
			}));
			this.starsMesh = new three.InstancedMesh(starGeo, this.starMat, this.maxStars);
			this.starsMesh.instanceMatrix.setUsage(three.DynamicDrawUsage);
			this.root.add(this.starsMesh);
			this.starsData = [];
			for (let i = 0; i < this.maxStars; i++) this.starsData.push({
				x: (rand() - .5) * 3.4,
				y: .4 + rand() * 5.6,
				zLag: -(.3 + rand() * 11.5),
				twinkleFreq: 6 + rand() * 10,
				twinklePhase: rand() * Math.PI * 2,
				scale: .35 + rand() * 1.05
			});
			this.maxSmoke = 18;
			const smokeGeo = this._trackGeo(new three.IcosahedronGeometry(.75, 1));
			this.smokeMat = this._trackMat(new three.MeshBasicMaterial({
				color: 6583435,
				transparent: true,
				opacity: .18,
				depthWrite: false
			}));
			this.smokeMesh = new three.InstancedMesh(smokeGeo, this.smokeMat, this.maxSmoke);
			this.smokeMesh.instanceMatrix.setUsage(three.DynamicDrawUsage);
			this.root.add(this.smokeMesh);
			this.smokeData = [];
			for (let i = 0; i < this.maxSmoke; i++) {
				const ang = i / this.maxSmoke * Math.PI * 1.4 - Math.PI * .2;
				this.smokeData.push({
					x0: (rand() - .5) * 1.4,
					y0: .5 + Math.sin(ang) * 1.6 + rand() * .6,
					z0: this.options.startZ - .6 - rand() * 1.8,
					vx: (rand() - .5) * 1.8,
					vy: .5 + rand() * 1.6,
					vz: -(1.2 + rand() * 2.2),
					baseScale: .55 + rand() * 1
				});
			}
		}
		/**
		* Launches the energy sword wave from world position & yaw orientation.
		*/
		trigger(origin = null, yawRadians = 0) {
			if (origin) this.root.position.copy(origin);
			this.root.rotation.y = yawRadians;
			this.active = true;
			this.progress = 0;
			this.setProgress(0);
		}
		/**
		* Switches elemental color palette dynamically with zero material rebuilds.
		*/
		setTheme(themeKey) {
			const p = EnergySwordWaveVFX.THEMES[themeKey];
			if (!p) return;
			this.options.theme = themeKey;
			this._colors.core.setHex(p.core);
			this._colors.mid.setHex(p.mid);
			this._colors.deep.setHex(p.deep);
			this._colors.ink.setHex(p.ink);
			this._colors.spark.setHex(p.spark);
			this._colors.light.setHex(p.light);
			if (this.bladeLight) this.bladeLight.color.copy(this._colors.light);
			if (this.originLight) this.originLight.color.copy(this._colors.light);
		}
		setScale(scale) {
			this.options.scale = scale;
			this.root.scale.setScalar(scale);
		}
		setIntensity(intensity) {
			this.options.intensity = intensity;
			this.bladeMaterial.uniforms.uIntensity.value = intensity;
			this.auraMaterial.uniforms.uIntensity.value = intensity;
			this.ribbonMaterial.uniforms.uIntensity.value = intensity;
			this.seamMaterial.uniforms.uIntensity.value = intensity;
			this.headPlowMat.uniforms.uIntensity.value = intensity;
			this.headSplashMat.uniforms.uIntensity.value = intensity;
			this.headFlareMat.uniforms.uIntensity.value = intensity;
			this.originBurstMat.uniforms.uIntensity.value = intensity;
			this.sparkMat.uniforms.uIntensity.value = intensity;
			this.needleMat.uniforms.uIntensity.value = intensity;
			this.starMat.uniforms.uIntensity.value = intensity;
		}
		setLayerVisibility({ inkLines, debris, trench } = {}) {
			if (typeof inkLines === "boolean") {
				this.options.showInkLines = inkLines;
				this.inkLinesMesh.visible = inkLines;
				this.inkVeilMesh.visible = inkLines;
			}
			if (typeof debris === "boolean") {
				this.options.showDebris = debris;
				this.rocksMesh.visible = debris;
				this.sparksMesh.visible = debris;
			}
			if (typeof trench === "boolean") {
				this.options.showTrench = trench;
				this.trenchMesh.visible = trench;
			}
		}
		/**
		* Deterministically sets every shader, blade position, and instanced particle
		* to exact normalized timeline progress p in [0, 1].
		*/
		setProgress(p, camera = null) {
			this.progress = three.MathUtils.clamp(p, 0, 1);
			const tSec = this.progress * this.options.duration;
			const bladeP = Math.min(this.progress / .86, 1);
			const easedTravel = 1 - Math.pow(1 - bladeP, 1.52);
			const bladeZ = this.options.startZ + easedTravel * this.options.travelDistance;
			const enterFade = three.MathUtils.smoothstep(this.progress, 0, .05);
			const bladeFade = enterFade * (1 - three.MathUtils.smoothstep(this.progress, .64, .85));
			const scalePunch = .72 + .28 * three.MathUtils.smoothstep(this.progress, 0, .15);
			const bladeScaleZ = .85 + .15 * scalePunch;
			this.bladeGroup.position.set(0, 0, bladeZ);
			this.bladeGroup.scale.set(1, scalePunch, bladeScaleZ);
			if (this.bladeLight) this.bladeLight.intensity = 4.6 * bladeFade * this.options.intensity;
			if (this.originLight) this.originLight.intensity = 3.4 * (1 - three.MathUtils.smoothstep(this.progress, .05, .46));
			const shaderTime = tSec * 1.15;
			this.bladeMaterial.uniforms.uTime.value = shaderTime;
			this.bladeMaterial.uniforms.uFade.value = bladeFade;
			this.auraMaterial.uniforms.uTime.value = shaderTime;
			this.auraMaterial.uniforms.uFade.value = bladeFade;
			this.inkVeilMaterial.uniforms.uTime.value = shaderTime;
			this.inkVeilMaterial.uniforms.uFade.value = bladeFade;
			this.ribbonMaterial.uniforms.uTime.value = shaderTime;
			this.ribbonMaterial.uniforms.uFade.value = bladeFade;
			this.seamMaterial.uniforms.uTime.value = shaderTime;
			this.seamMaterial.uniforms.uFade.value = bladeFade;
			this.headPlowMat.uniforms.uTime.value = shaderTime;
			this.headPlowMat.uniforms.uFade.value = bladeFade;
			this.headSplashMat.uniforms.uTime.value = shaderTime;
			this.headSplashMat.uniforms.uFade.value = bladeFade;
			this.headFlareMat.uniforms.uTime.value = shaderTime;
			this.headFlareMat.uniforms.uFade.value = bladeFade;
			const headPulse = .92 + .14 * Math.sin(tSec * 36);
			this.headFlareMesh.scale.set(headPulse, headPulse, 1);
			const groundCutZ = bladeZ + 3.05 * bladeScaleZ;
			const maxTrailLen = Math.max(.45, Math.min(13.5, (groundCutZ - (this.options.startZ - .15)) / bladeScaleZ));
			this.seamMaterial.uniforms.uMaxTrailLen.value = maxTrailLen;
			const trenchFade = enterFade * (1 - three.MathUtils.smoothstep(this.progress, .72, .97));
			this.trenchMaterial.uniforms.uTime.value = shaderTime;
			this.trenchMaterial.uniforms.uBladeTipZ.value = groundCutZ;
			this.trenchMaterial.uniforms.uFade.value = trenchFade;
			const burstP = Math.min(this.progress * 2.2, 1);
			this.originBurstMat.uniforms.uAlpha.value = enterFade * (1 - three.MathUtils.smoothstep(this.progress, .08, .5));
			this.originBurstMesh.scale.setScalar(.8 + burstP * .7);
			this._updateDeterministicParticles(tSec, bladeZ, groundCutZ, bladeFade, camera);
		}
		_updateDeterministicParticles(tSec, bladeZ, groundCutZ, bladeFade, camera) {
			const dur = this.options.duration;
			const g = 22;
			if (this.rocksMesh.visible) {
				const rockEndLimit = dur * .97;
				for (let i = 0; i < this.maxRocks; i++) {
					const r = this.rocksData[i];
					const spawnT = r.spawnP * dur;
					const effectiveLife = Math.min(r.life, Math.max(.18, rockEndLimit - spawnT));
					const age = tSec - spawnT;
					if (age > 0 && age < effectiveLife) {
						const spawnBladeP = Math.min(r.spawnP / .86, 1);
						const spawnEased = 1 - Math.pow(1 - spawnBladeP, 1.52);
						const spawnZ = this.options.startZ + spawnEased * this.options.travelDistance + 2.45 + r.zOffset;
						const groundY = .09;
						const vImpact1 = Math.sqrt(r.vy * r.vy + 44 * Math.max(0, r.y0 - groundY));
						const t1 = (r.vy + vImpact1) / g;
						let x, y, z, rotTime;
						if (age <= t1) {
							x = r.x0 + r.vx * age;
							y = r.y0 + r.vy * age - .5 * g * age * age;
							z = spawnZ + r.vz * age;
							rotTime = age;
						} else {
							const dt1 = age - t1;
							const vy1 = vImpact1 * .36;
							const t2Dur = 2 * vy1 / g;
							const damp1 = .54;
							if (dt1 <= t2Dur) {
								x = r.x0 + r.vx * (t1 + dt1 * damp1);
								y = groundY + vy1 * dt1 - .5 * g * dt1 * dt1;
								z = spawnZ + r.vz * (t1 + dt1 * damp1);
								rotTime = t1 + dt1 * .52;
							} else {
								const dt2 = dt1 - t2Dur;
								const vy2 = vy1 * .34;
								const t3Dur = 2 * vy2 / g;
								const damp2 = .24;
								if (dt2 <= t3Dur) {
									x = r.x0 + r.vx * (t1 + t2Dur * damp1 + dt2 * damp2);
									y = groundY + vy2 * dt2 - .5 * g * dt2 * dt2;
									z = spawnZ + r.vz * (t1 + t2Dur * damp1 + dt2 * damp2);
									rotTime = t1 + t2Dur * .52 + dt2 * .22;
								} else {
									const dt3 = dt2 - t3Dur;
									const slide = (1 - Math.exp(-dt3 * 6)) * .05;
									const distFactor = t1 + t2Dur * damp1 + t3Dur * damp2 + slide;
									x = r.x0 + r.vx * distFactor;
									y = groundY;
									z = spawnZ + r.vz * distFactor;
									rotTime = t1 + t2Dur * .52 + t3Dur * .22 + slide * .5;
								}
							}
						}
						const lifeRatio = age / effectiveLife;
						const outroT = three.MathUtils.smoothstep(lifeRatio, .62, 1);
						const shrink = (1 - outroT) * (1 - outroT * .45);
						const finalScale = r.scale * shrink * three.MathUtils.smoothstep(lifeRatio, 0, .06);
						y = Math.max(-.08, y - outroT * .14 * r.scale);
						if (finalScale > .005) {
							this._pos.set(x, y, z);
							this._euler.set(r.rot0.x + r.rotVel.x * rotTime, r.rot0.y + r.rotVel.y * rotTime, r.rot0.z + r.rotVel.z * rotTime);
							this._quat.setFromEuler(this._euler);
							this._scale.setScalar(finalScale);
							this._mat4.compose(this._pos, this._quat, this._scale);
						} else this._mat4.makeScale(0, 0, 0);
					} else this._mat4.makeScale(0, 0, 0);
					this.rocksMesh.setMatrixAt(i, this._mat4);
				}
				this.rocksMesh.instanceMatrix.needsUpdate = true;
			}
			if (this.sparksMesh.visible) {
				const sparkEndLimit = dur * .94;
				for (let i = 0; i < this.maxSparks; i++) {
					const sp = this.sparksData[i];
					const spawnT = sp.spawnP * dur;
					const effectiveLife = Math.min(sp.life, Math.max(.1, sparkEndLimit - spawnT));
					const age = tSec - spawnT;
					if (age > 0 && age < effectiveLife) {
						const spawnBladeP = Math.min(sp.spawnP / .86, 1);
						const spawnEased = 1 - Math.pow(1 - spawnBladeP, 1.52);
						const spawnZ = this.options.startZ + spawnEased * this.options.travelDistance + 2.85;
						const x = sp.x0 + sp.vx * age;
						const y = Math.max(.06, sp.y0 + sp.vy * age - 5.5 * age * age);
						const z = spawnZ + sp.vz * age;
						const lifeFade = 1 - age / effectiveLife;
						this._pos.set(x, y, z);
						this._euler.set(.18, sp.vx * .08, 0);
						this._quat.setFromEuler(this._euler);
						this._scale.set(sp.scale * lifeFade, 1, sp.scale * (.45 + lifeFade * .95));
						this._mat4.compose(this._pos, this._quat, this._scale);
					} else this._mat4.makeScale(0, 0, 0);
					this.sparksMesh.setMatrixAt(i, this._mat4);
				}
				this.sparksMesh.instanceMatrix.needsUpdate = true;
			}
			for (let i = 0; i < this.maxNeedles; i++) {
				const nd = this.needlesData[i];
				if (bladeFade > .02) {
					const cycle = (nd.phase + tSec * nd.speed * .25) % 1;
					const z = bladeZ + 1.5 + nd.zLag - cycle * 3.8;
					const fade = Math.sin(cycle * Math.PI) * bladeFade;
					this._pos.set(nd.x, nd.y, z);
					this._euler.set(0, 0, nd.roll);
					this._quat.setFromEuler(this._euler);
					this._scale.set(fade * 1.1, 1, nd.lenScale * (.6 + fade * .6));
					this._mat4.compose(this._pos, this._quat, this._scale);
				} else this._mat4.makeScale(0, 0, 0);
				this.needlesMesh.setMatrixAt(i, this._mat4);
			}
			this.needlesMesh.instanceMatrix.needsUpdate = true;
			if (this.inkLinesMesh.visible) {
				for (let i = 0; i < this.maxInkLines; i++) {
					const il = this.inkLinesData[i];
					if (bladeFade > .02) {
						const cycle = (il.phase + tSec * il.speed * .2) % 1;
						const z = bladeZ + il.zLag - cycle * 4.5;
						const fade = Math.sin(cycle * Math.PI) * bladeFade;
						this._pos.set(il.x, il.y, z);
						this._euler.set(il.pitch, 0, 0);
						this._quat.setFromEuler(this._euler);
						this._scale.set(fade, 1, il.lenScale * (.7 + fade * .5));
						this._mat4.compose(this._pos, this._quat, this._scale);
					} else this._mat4.makeScale(0, 0, 0);
					this.inkLinesMesh.setMatrixAt(i, this._mat4);
				}
				this.inkLinesMesh.instanceMatrix.needsUpdate = true;
			}
			this._quat.identity();
			for (let i = 0; i < this.maxStars; i++) {
				const st = this.starsData[i];
				if (bladeFade > .02) {
					const twinkle = .25 + .75 * Math.pow(.5 + .5 * Math.sin(tSec * st.twinkleFreq + st.twinklePhase), 2);
					const s = st.scale * twinkle * bladeFade;
					this._pos.set(st.x, st.y, bladeZ + 1.2 + st.zLag);
					this._scale.setScalar(s);
					this._mat4.compose(this._pos, this._quat, this._scale);
				} else this._mat4.makeScale(0, 0, 0);
				this.starsMesh.setMatrixAt(i, this._mat4);
			}
			this.starsMesh.instanceMatrix.needsUpdate = true;
			const smokeEnv = three.MathUtils.smoothstep(this.progress, 0, .12) * (1 - three.MathUtils.smoothstep(this.progress, .42, .86));
			this.smokeMat.opacity = .2 * smokeEnv;
			for (let i = 0; i < this.maxSmoke; i++) {
				const sm = this.smokeData[i];
				if (smokeEnv > .01) {
					const t = tSec;
					const x = sm.x0 + sm.vx * t;
					const y = sm.y0 + sm.vy * t;
					const z = sm.z0 + sm.vz * t;
					const grow = sm.baseScale * (.45 + t * 1.15);
					this._pos.set(x, y, z);
					this._quat.identity();
					this._scale.setScalar(grow);
					this._mat4.compose(this._pos, this._quat, this._scale);
				} else this._mat4.makeScale(0, 0, 0);
				this.smokeMesh.setMatrixAt(i, this._mat4);
			}
			this.smokeMesh.instanceMatrix.needsUpdate = true;
		}
		/**
		* Advances simulation by deltaTime (seconds). Returns false when complete.
		*/
		update(dt, camera = null) {
			if (!this.active) return false;
			this.progress += dt / this.options.duration;
			if (this.progress >= 1) {
				this.progress = 1;
				this.active = false;
			}
			this.setProgress(this.progress, camera);
			return this.active;
		}
		/**
		* Releases all GPU geometries and materials cleanly.
		*/
		dispose() {
			this.root.removeFromParent();
			for (const mesh of [
				this.rocksMesh,
				this.sparksMesh,
				this.needlesMesh,
				this.inkLinesMesh,
				this.starsMesh,
				this.smokeMesh
			]) mesh.dispose();
			for (const g of this._disposables.geometries) g.dispose();
			for (const m of this._disposables.materials) m.dispose();
			this._disposables.geometries.length = 0;
			this._disposables.materials.length = 0;
		}
	};
	/**
	* ============================================================================
	* EnergySwordWaveFanVFX — Multi-Wave Fan Barrage Controller (1 to 5 Waves)
	* ----------------------------------------------------------------------------
	* Pre-allocates a pool of up to 5 EnergySwordWaveVFX instances for zero GC
	* and fires them simultaneously in a symmetrical fan spread from a shared origin.
	* ============================================================================
	*/
	var EnergySwordWaveFanVFX = class {
		constructor(scene, options = {}) {
			this.scene = scene;
			this.maxCount = 5;
			this.count = Math.round(finiteRange(options.count, 1, this.maxCount, 5));
			this.spreadAngleDeg = finiteRange(options.spreadAngleDeg, 10, 120, 60);
			this.origin = new three.Vector3(0, 0, -7.5);
			this.baseYaw = 0;
			this.options = Object.assign({
				theme: "azure",
				scale: 1,
				intensity: 1.25,
				duration: 1.55,
				travelDistance: 17.5
			}, options);
			this.waves = [];
			for (let i = 0; i < this.maxCount; i++) {
				const wave = new EnergySwordWaveVFX(scene, Object.assign({}, this.options, {
					startZ: 0,
					yLayerOffset: i * .0025,
					enableLights: i === 0
				}));
				if (i > 0) {
					wave.originBurstMesh.visible = false;
					wave.smokeMesh.visible = false;
				}
				wave.root.visible = i < this.count;
				this.waves.push(wave);
			}
			this._applyFanTransforms();
		}
		get active() {
			return this.waves[0].active;
		}
		get progress() {
			return this.waves[0].progress;
		}
		/**
		* Computes symmetrical fan angles ordered center-first so index 0 is always
		* the center-most blade (carrying the shared dynamic PointLights).
		*/
		_getFanAngleOffsets(count) {
			if (count <= 1) return [0];
			const totalRad = three.MathUtils.degToRad(this.spreadAngleDeg);
			const step = totalRad / (count - 1);
			const raw = [];
			for (let i = 0; i < count; i++) raw.push(-totalRad * .5 + i * step);
			raw.sort((a, b) => Math.abs(a) - Math.abs(b));
			return raw;
		}
		_applyFanTransforms() {
			const offsets = this._getFanAngleOffsets(this.count);
			for (let i = 0; i < this.maxCount; i++) {
				const wave = this.waves[i];
				const isVisible = i < this.count;
				wave.root.visible = isVisible;
				if (isVisible) {
					wave.root.position.copy(this.origin);
					wave.root.rotation.y = this.baseYaw + offsets[i];
				}
			}
		}
		setCount(n, camera = null) {
			const active = this.active;
			this.count = Math.round(finiteRange(n, 1, this.maxCount, this.count));
			for (let i = 0; i < this.maxCount; i++) this.waves[i].active = active && i < this.count;
			this._applyFanTransforms();
			this.setProgress(this.progress, camera);
		}
		setSpreadAngle(deg, camera = null) {
			this.spreadAngleDeg = finiteRange(deg, 10, 120, this.spreadAngleDeg);
			this._applyFanTransforms();
			this.setProgress(this.progress, camera);
		}
		trigger(origin = null, yawRadians = 0) {
			if (origin) this.origin.copy(origin);
			this.baseYaw = yawRadians;
			this._applyFanTransforms();
			const offsets = this._getFanAngleOffsets(this.count);
			for (let i = 0; i < this.count; i++) this.waves[i].trigger(this.origin, this.baseYaw + offsets[i]);
		}
		setTheme(themeKey) {
			this.options.theme = themeKey;
			for (let i = 0; i < this.maxCount; i++) this.waves[i].setTheme(themeKey);
		}
		setScale(scale) {
			this.options.scale = scale;
			for (let i = 0; i < this.maxCount; i++) this.waves[i].setScale(scale);
		}
		setIntensity(intensity) {
			this.options.intensity = intensity;
			for (let i = 0; i < this.maxCount; i++) this.waves[i].setIntensity(intensity);
		}
		setLayerVisibility(opts) {
			for (let i = 0; i < this.maxCount; i++) this.waves[i].setLayerVisibility(opts);
		}
		setProgress(p, camera = null) {
			for (let i = 0; i < this.count; i++) this.waves[i].setProgress(p, camera);
			for (let i = this.count; i < this.maxCount; i++) this.waves[i].progress = this.waves[0].progress;
		}
		update(dt, camera = null) {
			let anyActive = false;
			for (let i = 0; i < this.count; i++) if (this.waves[i].update(dt, camera)) anyActive = true;
			return anyActive;
		}
		dispose() {
			for (let i = 0; i < this.maxCount; i++) this.waves[i].dispose();
		}
	};
	const ENERGY_SWORD_WAVE = Object.freeze({
		duration: 1.55,
		defaultQuantity: 5,
		defaultSpread: 1
	});
	function normalizeEnergySwordWaveOptions(options = {}) {
		return {
			quantity: Math.round(finiteRange(options.quantity, 1, 5, ENERGY_SWORD_WAVE.defaultQuantity)),
			spread: finiteRange(options.spread, .25, 2, ENERGY_SWORD_WAVE.defaultSpread),
			theme: Object.hasOwn(EnergySwordWaveVFX.THEMES, options.theme) ? options.theme : "azure",
			size: finiteRange(options.size, .25, 2, 1),
			speed: finiteRange(options.speed, .25, 2, 1),
			detail: finiteRange(options.detail, .25, 2, 1)
		};
	}
	function createEnergySwordWaveEffect(spec, options = {}) {
		const group = new three.Group();
		group.name = spec.id;
		const duration = ENERGY_SWORD_WAVE.duration;
		const lifecycle = { ...spec.lifecycle };
		let settings = normalizeEnergySwordWaveOptions(options);
		const fan = new EnergySwordWaveFanVFX(group, {
			count: settings.quantity,
			spreadAngleDeg: 60 * settings.spread,
			theme: settings.theme,
			scale: settings.size,
			intensity: 1.25 * settings.detail,
			duration
		});
		fan.origin.set(0, 0, 0);
		fan.trigger();
		let elapsed = 0, disposed = false;
		function sample(time) {
			elapsed = time;
			group.visible = elapsed > 0 && elapsed < duration;
			if (group.visible) fan.setProgress(elapsed / duration);
		}
		sample(0);
		return {
			group,
			duration,
			lifecycle,
			get settings() {
				return settings;
			},
			get elapsed() {
				return elapsed;
			},
			get finished() {
				return disposed || elapsed >= duration;
			},
			get phase() {
				return this.finished ? "finished" : elapsed < lifecycle.start ? "starting" : elapsed >= duration - lifecycle.end ? "ending" : "active";
			},
			update(dt) {
				if (disposed || elapsed >= duration || !Number.isFinite(dt) || dt <= 0) return;
				sample(Math.min(duration, elapsed + dt * settings.speed));
			},
			reset() {
				if (!disposed) sample(0);
			},
			setOptions(partial = {}) {
				if (disposed) return;
				const previous = settings;
				settings = normalizeEnergySwordWaveOptions({
					...previous,
					...partial
				});
				if (settings.theme !== previous.theme) fan.setTheme(settings.theme);
				if (settings.size !== previous.size) fan.setScale(settings.size);
				if (settings.detail !== previous.detail) fan.setIntensity(1.25 * settings.detail);
				if (settings.spread !== previous.spread) fan.setSpreadAngle(60 * settings.spread);
				if (settings.quantity !== previous.quantity) fan.setCount(settings.quantity);
			},
			dispose() {
				if (disposed) return;
				disposed = true;
				group.visible = false;
				group.removeFromParent();
				fan.dispose();
			}
		};
	}

//#endregion
exports.ENERGY_SWORD_WAVE = ENERGY_SWORD_WAVE;
exports.EnergySwordWaveFanVFX = EnergySwordWaveFanVFX;
exports.EnergySwordWaveVFX = EnergySwordWaveVFX;
exports.createEnergySwordWaveEffect = createEnergySwordWaveEffect;
exports.normalizeEnergySwordWaveOptions = normalizeEnergySwordWaveOptions;
return exports;
})({}, THREE);
const ENERGY_SWORD_WAVE = __vfxModule.ENERGY_SWORD_WAVE;
const EnergySwordWaveFanVFX = __vfxModule.EnergySwordWaveFanVFX;
const EnergySwordWaveVFX = __vfxModule.EnergySwordWaveVFX;
const createEnergySwordWaveEffect = __vfxModule.createEnergySwordWaveEffect;
const normalizeEnergySwordWaveOptions = __vfxModule.normalizeEnergySwordWaveOptions;

export {EnergySwordWaveVFX,EnergySwordWaveFanVFX};
export const defaultOptions={"quantity":5,"spread":1,"theme":"azure","size":1,"speed":1,"detail":1};
export default function createVFX(options={}){return createEnergySwordWaveEffect({"id":"energy-sword-wave","lifecycle":{"start":0.078,"end":0.31}},{...defaultOptions,...options});}
