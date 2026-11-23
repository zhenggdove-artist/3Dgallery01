// Shared control layout: fixed labels on the left, numeric inputs on the
// right at all screen widths. All fields remain keyboard and touch accessible.
const axisLabels={position:'位置',rotation:'旋轉（度）',scale:'縮放'};
export const appearanceRows=[
 ['depth','厚度',0,2],['brightness','亮度',0,3],
 ['contrast','對比',0,3],['saturation','飽和度',0,3],
 ['blackPoint','黑點',0,.95]
];
export function editorPanelMarkup(appearance,platformRadius,originalArtwork,title=''){
 const axes=['position','rotation','scale'].map(prop=>
  `<label class="art-editor-field"><span class="art-field-name">${axisLabels[prop]} XYZ</span><span class="art-editor-values art-xyz">
   ${[0,1,2].map(i=>`<input type="number" step="${prop==='rotation'?'1':'.05'}" data-axis="${prop}-${i}" aria-label="${axisLabels[prop]} ${'XYZ'[i]}">`).join('')}
  </span></label>`
 ).join('');
 const numbers=appearanceRows.map(([key,label,min,max])=>
  `<label class="art-editor-field"><span class="art-field-name">${label}</span>
    <span class="art-editor-values"><input data-appearance="${key}" type="number" min="${min}" max="${max}" step=".01" value="${appearance[key]}"></span>
   </label>`).join('');
 const radius=originalArtwork?`<label class="art-editor-field"><span class="art-field-name">展示圓盤半徑</span>
   <span class="art-editor-values"><input data-platform-radius type="number" min="1.5" max="14" step=".1" value="${Number(platformRadius||3).toFixed(2)}"></span></label>`:'';
 return `<h3>GM · 藝術品配置</h3><p data-art-name></p>
  <p class="art-editor-help">Shift+T 縮放／Shift+R 旋轉／Shift+G 移動；Esc 取消</p>
  <div class="art-editor-toolbar"><button data-action="scale">尺寸</button><button data-action="rotate">旋轉</button><button data-action="translate">位置</button></div>
  <div class="art-editor-fields">${`<label class="art-editor-field"><span class="art-field-name">作品名稱</span><span class="art-editor-values"><input type="text" data-art-title maxlength="120" value="${String(title).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}" aria-label="作品名稱"></span></label>`}${axes}${radius}
   <h4>表面屬性</h4>${numbers}
   <label class="art-editor-field"><span class="art-field-name">色彩</span><span class="art-editor-values"><input data-appearance="tint" type="color" value="${appearance.tint}"></span></label>
   ${`<label class="art-editor-field"><span class="art-field-name">作品名稱底色</span><span class="art-editor-values"><input type="color" data-appearance="labelBackground" value="${appearance.labelBackground||'#000000'}" aria-label="作品名稱底色"></span></label>`}
  </div>
  <p data-status>已選取 · 尚無修改</p>
  <div class="art-editor-actions"><button data-action="follow">跟隨 GM</button>
   <button data-action="save">儲存預設值</button><button data-action="cancel">取消／關閉</button>
   <button data-action="export">匯出配置</button></div>`;
}

export function playerArtworkAppearanceMarkup(record,layout,escape){
 const appearance={depth:0,brightness:1,contrast:1,saturation:1,blackPoint:0,tint:'#ffffff',labelBackground:'#000000',...layout?.appearance};
 const fields=appearanceRows.map(([key,label,min,max])=>
  `<label class="art-editor-field"><span class="art-field-name">${label}</span>
   <span class="art-editor-values"><input type="number" name="${key}" min="${min}" max="${max}" step=".01" value="${appearance[key]}" required></span>
  </label>`).join('');
 return `<form class="item art-bomb-appearance" data-form="art-bomb-appearance">
   <h3>${escape(record.title)} · 作品調色</h3>
   <input type="hidden" name="id" value="${escape(record.id)}">
   <input type="hidden" name="revision" value="${layout?.revision||1}">
   <div class="art-editor-fields">${fields}
    <label class="art-editor-field"><span class="art-field-name">色調</span><span class="art-editor-values"><input type="color" name="tint" value="${appearance.tint}"></span></label>
    <label class="art-editor-field"><span class="art-field-name">作品名稱底色</span><span class="art-editor-values"><input type="color" name="labelBackground" value="${appearance.labelBackground}" aria-label="作品名稱底色"></span></label>
   </div>
   <button class="panel-button" type="submit">儲存作品外觀</button>
  </form>`;
}
