// Shared control layout: fixed labels on the left, numeric inputs on the
// right at all screen widths. All fields remain keyboard and touch accessible.
const axisLabels={position:'位置',rotation:'旋轉（度）',scale:'縮放'};
export const appearanceRows=[
 ['depth','厚度',0,2],['brightness','亮度',0,3],
 ['contrast','對比',0,3],['saturation','飽和度',0,3],
 ['blackPoint','黑點',0,.95]
];
export function editorPanelMarkup(appearance,platformRadius,originalArtwork,title='',author='',playerMode=false){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
 return `<header class="gm-floating-head">
   <span class="gm-floating-grab" data-gm-panel-drag role="button" tabindex="-1" aria-label="拖曳移動 GM 藝術品配置視窗">${playerMode?'MY ARTWORK':'GM · 配置'}</span>
   <button type="button" data-gm-panel-toggle aria-expanded="true" aria-label="展開或收合編輯視窗">收合</button>
   <button type="button" data-action="save" class="gm-floating-quick-save" aria-label="儲存目前作品配置">儲存</button>
   <button type="button" data-action="cancel" class="gm-floating-close" aria-label="取消並關閉藝術品配置">×</button>
  </header>
  <div class="gm-floating-body">
  <p data-art-name></p>
  <p class="art-editor-help">Shift+T 縮放／Shift+R 旋轉／Shift+G 移動；Esc 取消</p>
  <div class="art-editor-toolbar"><button data-action="scale">尺寸</button><button data-action="rotate">旋轉</button><button data-action="translate">位置</button><button data-action="move">長按移動</button><button data-action="label-resize">編輯名稱底色框</button><button data-action="label-center">名稱條回到水平置中</button></div>
  <p class="art-editor-help">點擊「編輯名稱底色框」，即可用八個控制點變形；手機長按名稱條約 0.6 秒後拖曳，可自由調整上下左右的位置。名稱條偏移不會移動作品本身。</p>
  <div class="art-editor-fields">${`<label class="art-editor-field"><span class="art-field-name">作品名稱</span><span class="art-editor-values"><input type="text" data-art-title maxlength="120" value="${String(title).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}" aria-label="作品名稱"></span></label>`}<label class="art-editor-field"><span class="art-field-name">作者姓名</span><span class="art-editor-values"><input type="text" data-art-author maxlength="100" value="${esc(author)}" aria-label="作者姓名"></span></label>${playerMode?'':axes+radius}
   <h4>表面屬性</h4>${numbers}
   <label class="art-editor-field"><span class="art-field-name">色彩</span><span class="art-editor-values"><input data-appearance="tint" type="color" value="${appearance.tint}"></span></label>
   ${`<label class="art-editor-field"><span class="art-field-name">作品名稱底色</span><span class="art-editor-values"><input type="color" data-appearance="labelBackground" value="${appearance.labelBackground||'#000000'}" aria-label="作品名稱底色"></span></label>`}
   <label class="art-editor-field"><span class="art-field-name">作品名稱文字顏色</span><span class="art-editor-values"><input type="color" data-appearance="labelColor" value="${appearance.labelColor||'#ffffff'}" aria-label="作品名稱文字顏色"></span></label>
   <label class="art-editor-field"><span class="art-field-name">字體大小（px）</span><span class="art-editor-values"><input type="range" min="18" max="120" step="1" data-appearance="labelFontSize" value="${appearance.labelFontSize||44}" aria-label="作品名稱字體大小"><output data-label-font-output>${appearance.labelFontSize||44}px</output></span></label>
   <label class="art-editor-field"><span class="art-field-name">名稱底色寬度</span><span class="art-editor-values"><input type="number" min=".5" max="12" step=".05" data-appearance="labelWidth" value="${appearance.labelWidth||3.5}"></span></label>
   <label class="art-editor-field"><span class="art-field-name">名稱底色高度</span><span class="art-editor-values"><input type="number" min=".18" max="4" step=".02" data-appearance="labelHeight" value="${appearance.labelHeight||.492}"></span></label>
   <label class="art-editor-field"><span class="art-field-name">名稱漸顯距離（公尺）</span>
    <span class="art-editor-values"><input type="range" min="3" max="80" step="1" data-appearance="labelRevealDistance" value="${appearance.labelRevealDistance??12}" aria-label="距離作品多少公尺開始漸顯名稱"><output data-label-distance-output>${appearance.labelRevealDistance??12} m</output></span></label>
   <label class="art-editor-field"><span class="art-field-name">名稱近距離淡出（公尺）</span>
    <span class="art-editor-values"><input type="range" min="0" max="20" step=".25" data-appearance="labelNearFadeDistance" value="${appearance.labelNearFadeDistance??3}" aria-label="靠近名稱條多少公尺開始淡出"><output data-label-near-output>${appearance.labelNearFadeDistance??3} m</output></span></label>
   <label class="art-editor-field"><span class="art-field-name">貼近時最低不透明度</span>
    <span class="art-editor-values"><input type="range" min="0" max="1" step=".05" data-appearance="labelNearMinOpacity" value="${appearance.labelNearMinOpacity??0}" aria-label="貼近名稱時最低不透明度"><output data-label-opacity-output>${Math.round((appearance.labelNearMinOpacity??0)*100)}%</output></span></label>
   <p class="art-editor-help">遠距離依原設定漸顯；接近名稱條時文字與底色一同淡出。淡出距離 0 m 表示停用；最低不透明度 0% 表示完全透明。GM 編輯時保持可見，關閉編輯後生效。</p>
  </div>
  <p data-status>已選取 · 尚無修改</p>
  <div class="art-editor-actions"><button data-action="follow">跟隨 GM</button>
   <button data-action="save">儲存預設值</button><button data-action="apply-own-labels">將這組名稱樣式套用到我上傳的全部作品</button><button data-action="cancel">取消／關閉</button>
   <button data-action="export">匯出配置</button><button data-gm-panel-reset type="button">視窗位置／尺寸重設</button></div>
  </div><button type="button" class="gm-floating-resize" data-gm-panel-resize aria-label="拖曳以調整 GM 編輯視窗寬度與高度">↘</button>`;
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
    <label class="art-editor-field"><span class="art-field-name">文字顏色</span><span class="art-editor-values"><input type="color" name="labelColor" value="${appearance.labelColor||'#ffffff'}"></span></label>
    <label class="art-editor-field"><span class="art-field-name">字體大小</span><span class="art-editor-values"><input type="range" name="labelFontSize" min="18" max="120" step="1" value="${appearance.labelFontSize||44}"></span></label>
    <label class="art-editor-field"><span class="art-field-name">底色框寬度</span><span class="art-editor-values"><input type="number" name="labelWidth" min=".5" max="12" step=".05" value="${appearance.labelWidth||3.5}"></span></label>
    <label class="art-editor-field"><span class="art-field-name">底色框高度</span><span class="art-editor-values"><input type="number" name="labelHeight" min=".18" max="4" step=".02" value="${appearance.labelHeight||.492}"></span></label>
   </div>
   <button class="panel-button" type="submit">儲存作品外觀</button><button class="panel-button" type="button" data-apply-my-label-style>套用名稱樣式到我上傳的所有作品</button><p class="art-editor-help">調色立即在 3D 場景預覽。關閉視窗時，未儲存的顏色會還原。</p>
  </form>`;
}
