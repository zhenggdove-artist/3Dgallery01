// Persistent uploads go only to Temple's isolated database, never RELETTER.
export async function uploadMedia(network,file){
 if(!file)return null;let blob=file;
 if(file.type.startsWith('image/')){const bitmap=await createImageBitmap(file),scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height)),c=document.createElement('canvas');c.width=Math.round(bitmap.width*scale);c.height=Math.round(bitmap.height*scale);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();blob=await new Promise(resolve=>c.toBlob(resolve,'image/webp',.8));}
 if(blob.size>1_500_000)throw Error('圖片／音訊／影片最大 1.5 MB，請先縮短或壓縮');
 const response=await fetch(network.base+'/api/media',{method:'POST',headers:{Authorization:'Bearer '+network.token,'Content-Type':blob.type},body:blob});const data=await response.json();if(!response.ok)throw Error(data.error);return data;
}
export function attachDrawing(container){
 const canvas=container.querySelector('[data-drawing]');if(!canvas)return;const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);let down=false;
 const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];};
 canvas.onpointerdown=e=>{down=true;canvas.dataset.used='true';canvas.setPointerCapture(e.pointerId);c.beginPath();c.moveTo(...point(e));};canvas.onpointermove=e=>{if(!down)return;c.strokeStyle=container.querySelector('[data-ink]').value;c.lineWidth=5;c.lineCap='round';c.lineTo(...point(e));c.stroke();};canvas.onpointerup=canvas.onpointercancel=()=>down=false;
 container.querySelector('[data-clear-drawing]').onclick=()=>{c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);delete canvas.dataset.used;};
}
export const drawingForm=`<details><summary>DRAW</summary><input data-ink type="color" value="#8c4189"><canvas data-drawing width="600" height="300" style="width:100%;background:white;touch-action:none;border:1px solid #baa0ca"></canvas><button type="button" data-clear-drawing>CLEAR</button></details><label>IMAGE / AUDIO / VIDEO · ≤1.5 MB<input type="file" name="media" accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/ogg,audio/webm,video/webm,video/mp4"></label>`;
export function mediaMarkup(media,base){if(!media?.id||!media.type)return '';const url=base+'/api/media/'+encodeURIComponent(media.id);return media.type.startsWith('image/')?`<img src="${url}" alt="Plant attachment" style="max-width:100%">`:media.type.startsWith('audio/')?`<audio controls preload="none" src="${url}"></audio>`:`<video controls preload="metadata" src="${url}" style="max-width:100%"></video>`;}
