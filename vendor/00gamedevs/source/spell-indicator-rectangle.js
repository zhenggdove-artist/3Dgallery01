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
// 紅色長方形預警 / Red Rectangle Spell Indicator
// Three.js 0.187.0 / WebGL2 / SRGBColorSpace / NoToneMapping
// 固定範圍的地面預警；只提供外觀，不觸發傷害、碰撞或技能。
// A fixed ground warning; this module never triggers damage, collisions or abilities.
// 原點為矩形中心，XZ 平面、+Y 朝上；length 沿 X、width 沿 Z，皆為完整長度（0.25–20）。
// Origin: rectangle center; XZ plane, +Y up. length along X and width along Z are full dimensions (0.25–20).
// fillMode: forward 從 -X 填向 +X；center-out 橫跨全長，從 Z=0 向兩側填滿。
// fillMode: forward fills -X to +X; center-out spans the full length and fills from Z=0 toward both Z edges.
// 長寬與填色模式可即時修改，保留進度與中心，不會重播；size、angleDeg、speed、density 不生效。
// Live length/width/fillMode edits retain progress and center; size/angleDeg/speed/density are inert.
// 請掛在未縮放節點，以 group.position/quaternion 對齊平地或整片斜面；不自動貼合起伏地形。
// Use an unscaled parent and position/orient group for a flat or tilted plane. No terrain fitting.
// group 內有沿法線 0.01 單位的貼地偏移；父節點縮放會改變實際範圍。
// A 0.01-unit local-normal offset avoids coplanar overlap; parent scale changes the world footprint.
// 自動模式：progressMode:'auto'，warningDuration 為 update 累計秒數（0.1–30，預設 2）。
// Auto mode: warningDuration is elapsed update time in seconds; speed is fixed at 1.
// 手動模式：progressMode:'manual'，呼叫 setProgress(0–1)；update(dt) 只推進流光與退場。
// Manual mode: setProgress(0–1) owns fill progress; update(dt) still animates flow and the ending.
// 到達 1 時只亮邊一次：0.06 秒短亮加 0.09 秒淡出；stop() 取消並以 0.12 秒淡出，不閃亮。
// Completion flashes the edge for 0.06s then fades for 0.09s. stop() cancels with a 0.12s fade.
// 結束中／結束後的進度更新不會重播。reset() 清進度並保留位置、方向及設定。
// Progress updates cannot restart an ending/finished cast. reset() preserves transform and settings.
// 修改 warningDuration 或 progressMode 會重播；半徑、角度、顏色與流光強度可即時調整。
// Changing warningDuration or progressMode restarts; size, angle, color and detail update live.
// finished 只代表畫面已消失，不能當作傷害開始時間；遊戲應持有自己的攻擊時鐘。
// finished means fully invisible, not the attack trigger. Keep gameplay timing in the host game.
// 在既有遊戲迴圈呼叫 update(deltaSeconds)，直到 finished 再 dispose()；dispose 可重複呼叫。
// Call update(deltaSeconds) from the existing loop until finished, then dispose(); disposal is idempotent.
// detail 只控制流光；density 為不影響外觀的相容值。無粒子、貼圖、後製、展示排程或額外動畫迴圈。
// detail controls flow only; density is an unused compatibility value. No particles, textures, postprocessing or demo loop.

import * as THREE from "three";
var __vfxModule = (function(exports) {

Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region src/effects/spell-indicator-runtime.js
	function normalizeSpellIndicatorOptions(spec, options = {}) {
		const finite = (value, fallback, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
		return {
			color: /^#[0-9a-f]{6}$/i.test(options.color) ? options.color : spec.color,
			size: spec.indicatorShape === "rectangle" ? 1 : finite(options.size, 3, .25, 20),
			...spec.indicatorShape === "rectangle" ? {
				length: finite(options.length, 6, .25, 20),
				width: finite(options.width, 3, .25, 20),
				fillMode: options.fillMode === "center-out" ? "center-out" : "forward"
			} : {},
			detail: finite(options.detail, 1, .25, 2),
			angleDeg: spec.indicatorShape !== "sector" ? 360 : finite(options.angleDeg, 90, 5, 360),
			warningDuration: finite(options.warningDuration, 2, .1, 30),
			progressMode: options.progressMode === "manual" ? "manual" : "auto",
			speed: 1,
			density: .5
		};
	}
	function createSpellIndicatorEffect(THREE, spec, options = {}) {
		const group = new THREE.Group();
		group.name = spec.id;
		let settings = normalizeSpellIndicatorOptions(spec, options);
		let time = 0, progress = 0, endAge = 0, ending = null, disposed = false, finished = false;
		const uniforms = {
			uRectangleSize: { value: new THREE.Vector2(6, 3) },
			uCenterOut: { value: 0 },
			uTime: { value: 0 },
			uProgress: { value: 0 },
			uHalfAngle: { value: Math.PI },
			uDetail: { value: 1 },
			uOpacity: { value: 1 },
			uFlash: { value: 0 },
			uColor: { value: new THREE.Color() },
			uEdgeColor: { value: new THREE.Color() }
		};
		const geometry = new THREE.PlaneGeometry(2.04, 2.04);
		geometry.rotateX(-Math.PI / 2);
		const material = new THREE.ShaderMaterial({
			uniforms,
			defines: spec.indicatorShape === "rectangle" ? { RECTANGLE_INDICATOR: 1 } : {},
			transparent: true,
			depthTest: true,
			depthWrite: false,
			side: THREE.DoubleSide,
			forceSinglePass: true,
			blending: THREE.NormalBlending,
			toneMapped: false,
			vertexShader: `varying vec2 vPoint;
      void main(){vPoint=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
			fragmentShader: `
      uniform float uTime,uProgress,uHalfAngle,uDetail,uOpacity,uFlash;
      uniform vec3 uColor,uEdgeColor;
      uniform vec2 uRectangleSize;
      uniform float uCenterOut;
      varying vec2 vPoint;
      const float PI=3.14159265359;
      float rayDistance(vec2 p,vec2 direction){return length(p-direction*clamp(dot(p,direction),0.0,1.0));}
      void main(){
        vec2 p=vPoint;
        #ifdef RECTANGLE_INDICATOR
        // Use one shared stroke unit for both axes. Small footprints retain
        // a readable interior; stretching either axis never stretches a border.
        float strokeUnit=min(3.0,min(uRectangleSize.x,uRectangleSize.y));
        p *= uRectangleSize / (2.0*strokeUnit);
        vec2 halfSize=uRectangleSize / (2.0*strokeUnit);
        float aa=max(length(fwidth(p))*.65,.00015);
        float boundary=min(halfSize.x-abs(p.x),halfSize.y-abs(p.y));
        float fillDistance=uCenterOut>.5 ? uProgress*halfSize.y-abs(p.y)
          : uProgress*halfSize.x*2.0-(p.x+halfSize.x);
        float filled=smoothstep(-aa,aa,fillDistance)*step(.000001,uProgress);
        if(uProgress>=.99999)filled=1.0;
        float front=(1.0-smoothstep(.006,.020+aa,abs(fillDistance)))*step(.000001,uProgress)*(1.0-step(.99999,uProgress));
        float wave=pow(.5+.5*sin((uCenterOut>.5?abs(p.y):p.x)*28.0-uTime*2.6),8.0);
        #else
        float radius=length(p);
        // Derivatives are evaluated for the whole quad before any discard.
        float aa=max(length(fwidth(p))*.65,.00015);
        float angle=atan(p.y,abs(p.x)+abs(p.y)<.000001?.000001:p.x);
        float boundary=1.0-radius;
        if(uHalfAngle<PI-.00001){
          vec2 ray=vec2(cos(uHalfAngle),sin(uHalfAngle));
          float side=min(rayDistance(p,ray),rayDistance(p,vec2(ray.x,-ray.y)));
          boundary=min(boundary,abs(angle)<=uHalfAngle?side:-side);
        }
        float filled=(1.0-smoothstep(uProgress-aa,uProgress+aa,radius))*step(.000001,uProgress);
        float front=(1.0-smoothstep(.006,.020+aa,abs(radius-uProgress)))*step(.000001,uProgress)*(1.0-step(.99999,uProgress));
        // Sparse moving bands live inside the shape. They never displace a border.
        float wave=pow(.5+.5*sin(radius*28.0-angle*2.0-uTime*2.6),8.0);
        #endif
        float coverage=smoothstep(-aa,aa,boundary);
        float edge=1.0-smoothstep(.007,.014+aa,boundary);
        float halo=1.0-smoothstep(.014,.075,boundary);
        float flow=wave*(.35+.65*filled)*(.018*uDetail);
        float alpha=(.115+.19*filled+.12*halo+flow+.20*front+.54*edge)*coverage*uOpacity;
        vec3 color=uColor*(.65+.20*filled);
        color=mix(color,uEdgeColor,clamp(.30*halo+.75*edge+.44*front,0.0,1.0));
        color=mix(color,vec3(.055,.018,.023),.22*(1.0-edge)*halo);
        color=mix(color,mix(uEdgeColor,vec3(1.0),.35),uFlash*edge);
        alpha=min(1.0,alpha+uFlash*edge*.18*coverage*uOpacity);
        if(alpha<.001)discard;
        gl_FragColor=vec4(color,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.name = spec.id + "-surface";
		mesh.position.y = .01;
		group.add(mesh);
		function syncAppearance() {
			if (spec.indicatorShape === "rectangle") {
				mesh.scale.set(settings.length / 2, 1, settings.width / 2);
				uniforms.uRectangleSize.value.set(settings.length, settings.width);
				uniforms.uCenterOut.value = settings.fillMode === "center-out" ? 1 : 0;
			} else mesh.scale.set(settings.size, 1, settings.size);
			uniforms.uHalfAngle.value = settings.angleDeg * Math.PI / 360;
			uniforms.uDetail.value = settings.detail;
			uniforms.uColor.value.set(settings.color);
			const hsl = {};
			uniforms.uColor.value.getHSL(hsl);
			uniforms.uEdgeColor.value.setHSL((hsl.h + .045) % 1, hsl.s * .86, Math.min(.68, Math.max(.52, hsl.l)));
		}
		function syncTime() {
			uniforms.uTime.value = time % (Math.PI * 2 / 2.6);
			uniforms.uProgress.value = progress;
			uniforms.uFlash.value = ending === "complete" && endAge < .06 ? 1 - .35 * endAge / .06 : 0;
			uniforms.uOpacity.value = finished ? 0 : ending === "cancel" ? Math.max(0, 1 - endAge / .12) : ending === "complete" ? Math.max(0, 1 - Math.max(0, endAge - .06) / .09) : 1;
			group.visible = !disposed && !finished;
		}
		function beginEnd(reason) {
			ending = reason;
			endAge = 0;
			syncTime();
		}
		function update(dt) {
			if (disposed || finished || !Number.isFinite(dt) || dt < 0) return;
			let remaining = dt;
			if (!ending) {
				if (settings.progressMode === "auto") {
					const advance = Math.min(remaining, Math.max(0, settings.warningDuration - time));
					time += advance;
					remaining -= advance;
					progress = Math.min(1, time / settings.warningDuration);
					if (time >= settings.warningDuration - 1e-10) {
						time = settings.warningDuration;
						progress = 1;
						beginEnd("complete");
					}
				} else {
					time = Math.min(Number.MAX_SAFE_INTEGER, time + remaining);
					remaining = 0;
				}
			}
			if (ending) {
				const duration = ending === "complete" ? .15 : .12;
				const advance = Math.min(remaining, Math.max(0, duration - endAge));
				time += advance;
				endAge += advance;
				if (endAge >= duration - 1e-10) {
					endAge = duration;
					finished = true;
				}
			}
			syncTime();
		}
		function setProgress(value) {
			if (disposed || finished || ending || settings.progressMode !== "manual" || !Number.isFinite(value)) return;
			progress = Math.min(1, Math.max(0, value));
			if (progress === 1) beginEnd("complete");
			syncTime();
		}
		function reset() {
			if (disposed) return;
			time = 0;
			progress = 0;
			endAge = 0;
			ending = null;
			finished = false;
			syncTime();
		}
		function stop() {
			if (!disposed && !finished && !ending) beginEnd("cancel");
		}
		function setOptions(next = {}) {
			if (disposed) return;
			const previous = settings;
			settings = normalizeSpellIndicatorOptions(spec, {
				...settings,
				...next
			});
			syncAppearance();
			if (settings.warningDuration !== previous.warningDuration || settings.progressMode !== previous.progressMode) reset();
		}
		function dispose() {
			if (disposed) return;
			disposed = true;
			finished = true;
			group.visible = false;
			group.removeFromParent();
			geometry.dispose();
			material.dispose();
			group.clear();
		}
		syncAppearance();
		syncTime();
		return {
			group,
			update,
			setProgress,
			setOptions,
			reset,
			stop,
			dispose,
			hit() {},
			setDirection() {},
			setEndpoints() {},
			get settings() {
				return { ...settings };
			},
			get progress() {
				return progress;
			},
			get elapsed() {
				return time;
			},
			get duration() {
				return settings.warningDuration + .15;
			},
			get lifecycle() {
				return {
					start: 0,
					end: .15
				};
			},
			get particleCount() {
				return 0;
			},
			get phase() {
				return finished ? "finished" : ending ? "ending" : "active";
			},
			get finished() {
				return finished;
			}
		};
	}

//#endregion
exports.createSpellIndicatorEffect = createSpellIndicatorEffect;
exports.normalizeSpellIndicatorOptions = normalizeSpellIndicatorOptions;
return exports;
})({});
const createSpellIndicatorEffect = __vfxModule.createSpellIndicatorEffect;
const normalizeSpellIndicatorOptions = __vfxModule.normalizeSpellIndicatorOptions;


const preset = {
  "id": "spell-indicator-rectangle",
  "name": "紅色長方形預警",
  "english": "Red Rectangle Spell Indicator",
  "category": "area",
  "kind": 2,
  "variant": 19,
  "schools": [
    "arcane"
  ],
  "indicatorShape": "rectangle",
  "color": "#ff303e",
  "seed": 829660,
  "duration": 2.15,
  "burst": true,
  "maxParticles": 0,
  "defaultDensity": 0.5,
  "lifecycle": {
    "start": 0,
    "end": 0.15
  },
  "previewTime": 1,
  "thumbnailTime": 1,
  "description": "紅色長方形標出危險區，可從一端或中央向兩側填滿，提醒攻擊將到。",
  "tags": "紅色 長方形 矩形 預警 危險 攻擊 範圍 倒數 指示器 技能 長條 中央 red rectangle rectangular spell indicator telegraph warning aoe countdown danger center"
};
export const defaultOptions = {
  "color": "#ff303e",
  "length": 6,
  "width": 3,
  "fillMode": "forward",
  "detail": 1,
  "warningDuration": 2,
  "progressMode": "auto"
};
export default function createVFX(options = {}) {
  return createSpellIndicatorEffect(THREE,preset,{...defaultOptions,...options});
}
