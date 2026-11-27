// iPadOS can report a desktop Mac user agent. Keep the existing desktop
// texture route elsewhere; on Apple touch devices retain actual RGBA bytes
// rather than depending on a live Canvas2D backing store for future uploads.
export function useStablePaintPixels(nav=globalThis.navigator){
 return !!nav&&(/iPad|iPhone|iPod/i.test(nav.userAgent||'')||(/Mac/i.test(nav.platform||'')&&nav.maxTouchPoints>1));
}
export function rgbaTexture(T,pixels,width,height){
 const texture=new T.DataTexture(pixels,width,height,T.RGBAFormat,T.UnsignedByteType);
 texture.colorSpace=T.SRGBColorSpace;texture.flipY=false;texture.needsUpdate=true;
 return texture;
}
export function copyFlippedRows(source,width,height,destination,destWidth=width,x=0,y=0){
 const stride=width*4;
 for(let row=0;row<height;row++)destination.set(source.subarray(row*stride,(row+1)*stride),((y+height-1-row)*destWidth+x)*4);
}
// Immutable outfit pixels keep identical dimensions, alpha, wrapping,
// sRGB sampling, linear filtering and mipmaps; no canvas is needed after
// the snapshot. Fall back to the original source if readback fails.
export function staticPaintTexture(T,canvas,stable=useStablePaintPixels()){
 if(!stable)return new T.CanvasTexture(canvas);
 try{
  const {width,height}=canvas,ctx=canvas.getContext('2d');
  const source=ctx.getImageData(0,0,width,height).data,pixels=new Uint8Array(source.length);
  if(!source.some((v,i)=>i%4===3&&v!==0))return new T.CanvasTexture(canvas);
  copyFlippedRows(source,width,height,pixels);
  const texture=rgbaTexture(T,pixels,width,height);
  texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
  canvas.width=canvas.height=0;
  return texture;
 }catch{return new T.CanvasTexture(canvas);}
}
export function fillPaintTile(pixels,stride,x,y,tile,hex){
 const color=parseInt(hex.slice(1),16);
 for(let row=y;row<y+tile;row++)for(let col=x;col<x+tile;col++){
  const at=(row*stride+col)*4;pixels[at]=color>>16;pixels[at+1]=color>>8&255;pixels[at+2]=color&255;pixels[at+3]=255;
 }
}
