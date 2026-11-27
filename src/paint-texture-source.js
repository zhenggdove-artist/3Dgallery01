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
 if(!stable||!T.MathUtils.isPowerOfTwo(canvas.width)||!T.MathUtils.isPowerOfTwo(canvas.height))return new T.CanvasTexture(canvas);
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
// Render the original atlas in narrow horizontal bands with one guard row
// above and below. This preserves cross-tile antialiasing and draw order,
// without retaining a huge live Canvas2D surface on iPad.
export function paintAtlasBands(T,columns,rows,tile,count,draw,bandRows=4){
 const width=columns*tile,height=rows*tile,pixels=new Uint8Array(width*height*4);
 const canvas=document.createElement('canvas');canvas.width=width;
 try{
  for(let first=0;first<rows;first+=bandRows){
   const end=Math.min(rows,first+bandRows),from=Math.max(0,first-1),to=Math.min(rows,end+1);
   canvas.height=(to-from)*tile;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Sign atlas band unavailable');
   for(let i=from*columns;i<Math.min(count,to*columns);i++)draw(ctx,i,i%columns*tile,(Math.floor(i/columns)-from)*tile);
   const band=ctx.getImageData(0,(first-from)*tile,width,(end-first)*tile);
   // Every populated sign has an opaque background. Do not upload an
   // empty backing store as if it contained valid artwork.
   for(let i=first*columns;i<Math.min(count,end*columns);i++){
    const x=i%columns*tile+Math.floor(tile/2),y=(Math.floor(i/columns)-first)*tile+Math.floor(tile/2);
    if(band.data[(y*width+x)*4+3]!==255)throw Error('Sign atlas band lost its pixels');
   }
   copyFlippedRows(band.data,width,band.height,pixels,width,0,height-end*tile);
  }
  const texture=rgbaTexture(T,pixels,width,height);
  texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
  return texture;
 }finally{canvas.width=canvas.height=0;}
}
export function fillPaintTile(pixels,stride,x,y,tile,hex){
 const color=parseInt(hex.slice(1),16);
 for(let row=y;row<y+tile;row++)for(let col=x;col<x+tile;col++){
  const at=(row*stride+col)*4;pixels[at]=color>>16;pixels[at+1]=color>>8&255;pixels[at+2]=color&255;pixels[at+3]=255;
 }
}
