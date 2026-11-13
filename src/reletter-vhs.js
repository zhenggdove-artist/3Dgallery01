import * as THREE from 'three';
// Shader copied verbatim from RELETTER index.html; only viewport host adapted.
const VHSShader={
  uniforms:{
    tDiffuse:{value:null},
    time:{value:0},
    intensity:{value:1.0},
    brightness:{value:2.0},
    resolution:{value:new THREE.Vector2(innerWidth,innerHeight)},
  },
  vertexShader:`
    varying vec2 vUv;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
  `,
  fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    uniform float brightness;
    uniform vec2 resolution;
    varying vec2 vUv;

    float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}

    void main(){
      vec2 uv=vUv;

      // === 波浪扭曲（慢） ===
      // 12.0=波浪密度（越大波紋越密）  2.5=晃動速度  0.0021=扭曲幅度（越大越歪）
      float wave=sin(uv.y*12.0+time*2.5)*0.0021*intensity;
      // === 波浪扭曲（快） ===
      // 35.0=高頻密度  4.0=速度  0.0021=振幅（細微抖動）
      wave+=sin(uv.y*35.0+time*4.0)*0.0021*intensity;
      // === 故障橫帶 ===
      // 0.95=觸發門檻（越低越頻繁出現）  0.015=橫移量（越大偏移越大）
      float band=step(0.98,sin(time*0.7+uv.y*3.0))*0.0005*intensity;
      uv.x+=wave+band;

      // === 垂直抖動（整個畫面上下微跳） ===
      // 13.0=跳動速度  0.0008=跳動幅度
      uv.y+=sin(time*13.0)*0.0008*intensity;

      // === 色差分離（RGB頻道錯位） ===
      // 0.002=偏移量（越大彩色邊緣越明顯，0=關閉）
      float shift=0.00002*intensity;
      float r=texture2D(tDiffuse,vec2(uv.x+shift,uv.y)).r;
      float g=texture2D(tDiffuse,uv).g;
      float b=texture2D(tDiffuse,vec2(uv.x-shift,uv.y)).b;
      vec3 col=vec3(r,g,b);

      // === 掃描線（水平條紋） ===
      // 1.2=線條密度  0.02=線條深度（越大越明顯，0=關閉）
      float scanline=sin(vUv.y*resolution.y*1.2)*0.012*intensity;
      col-=scanline;

      // === 靜態雜訊（雪花點） ===
      // 0.04=雜訊強度（越大雪花越多，0=關閉）
      float noise=(rand(vUv*time)-0.5)*0.04*intensity;
      col+=noise;

      // === 暗角（畫面邊緣變暗） ===
      // 1.1=暗角範圍（越大邊緣越暗）  0.10=暗角強度（0=關閉）
      float vig=1.0-dot((vUv-0.5)*1.1,(vUv-0.5)*1.1);
      col*=mix(1.0,vig,0.0*intensity);

      // === 去飽和（褪色感） ===
      // 1.0=全彩  0.85=微褪色  0.0=全黑白
      float lum=dot(col,vec3(0.299,0.587,0.114));
      col=mix(vec3(lum),col,0.7);

      // === 亮度補償 ===
      // 1.35=補回被掃描線/雜訊吃掉的亮度（1.0=不補  越大越亮）
      col*=brightness;

      gl_FragColor=vec4(col,1.0);
    }
  `
};
export function createVHS(renderer){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
 const material=new THREE.ShaderMaterial(VHSShader),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material),scene=new THREE.Scene(),camera=new THREE.Camera();scene.add(quad);
 let width=0,height=0;
 return {render(world,view,time){const size=renderer.getDrawingBufferSize(new THREE.Vector2());if(width!==size.x||height!==size.y){width=size.x;height=size.y;target.setSize(width,height);material.uniforms.resolution.value.copy(size);}const autoReset=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();renderer.setRenderTarget(target);renderer.render(world,view);renderer.setRenderTarget(null);material.uniforms.tDiffuse.value=target.texture;material.uniforms.time.value=time;renderer.render(scene,camera);renderer.info.autoReset=autoReset;}};
}
