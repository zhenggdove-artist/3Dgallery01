# GGTEMPLE：社群帳號登入設定（Google／Apple／Facebook）

前端和伺服器的登入流程已接通；**未提供第三方 OAuth Client ID／Secret 前，真實帳號登入不可啟用**。不要把金鑰放入 `index.html`、`temple-config.js` 或 GitHub 公開檔案。

## 架構

- 遊戲前端：GitHub Pages `https://zhenggdove-artist.github.io`。
- OAuth Callback 及持久化資料：Cloudflare Worker Durable Object
  `https://temple-arena.zhenggdove-artist.workers.dev/api/oauth/callback`
  （若未來變更 Worker 正式域名，必須同步更改第三方平台的 Redirect URI）。
- 使用者先點 Google／Apple／Facebook。伺服器產生 state、nonce 及 Google PKCE，完成身份驗證後發單次登入票據，再由玩家在初次登入時設定角色名與顏色。以後同帳號自動讀取原有角色。
- 身份鍵使用「平台＋平台使用者 ID＋伺服器私密 pepper」衍生。第三方 OAuth token **不得**成為角色資料庫的 key，也不能由瀏覽器自行傳遞 user id。
- 進度存於現有 Durable Object `world_state.profiles`，包括 LV、金幣、武器、背包、翅膀、融合記錄。
- 既有 GM `Ely` + `TEMPLE_ADMIN_KEY` Memory Code 登入保留於「舊式 Memory Code／GM 登入」，未授權帳號絕不獲得 GM。
- 舊式 4 碼進度**不會未經確認自動合併**到任何 OAuth 身份，避免存檔遭冒領。

## Cloudflare Worker 需設置的機密

使用 Cloudflare Workers → temple-arena → Settings → Variables and Secrets（或現有部署機密管理流程），將以下設為 **Secret**：

| Provider | Variables |
| --- | --- |
| 共用 | `TEMPLE_OAUTH_PEPPER`（長度至少 32 字元、固定不變的隨機值） |
| Google | `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` |
| Apple | `APPLE_SERVICES_ID`、`APPLE_TEAM_ID`、`APPLE_KEY_ID`、`APPLE_PRIVATE_KEY`（ES256 私鑰，完整 PEM 格式） |
| Facebook | `FACEBOOK_APP_ID`、`FACEBOOK_APP_SECRET` |

Google Cloud Console 建立 OAuth Web application；Authorized redirect URI 填 Worker callback，JavaScript origins 按開發者設定填 GitHub Pages origin 或必要正式網站 origin。Google 的 Client ID 不等於 API Key。

Apple Developer 建立 Sign in with Apple 的 Services ID、完成域名及 Return URL 驗證；Return URL 指向相同 Worker callback。Apple 開發者帳號可能有年費。Apple 使用 `response_mode=form_post`。

Meta for Developers 建立 Facebook Login（Web）應用程式，Valid OAuth Redirect URI 指向相同 Worker callback，且按 Meta 平台規定完成正式環境權限與資料處理設定。開發模式通常只允許測試角色使用。

OAuth 測試登入需使用 HTTPS 並確認 Worker 上 `TEMPLE_ALLOWED_ORIGINS` 含前端 origin（預設允許 GitHub Pages）。

## 安全與上線限制

- 原始第三方 token 只在 Worker 記憶體中進行 ID 驗證，不存進遊戲檔案或 Local Storage。
- Callback 驗證簽章（Google/Apple）及應用程式歸屬（Facebook）；一次性 state、nonce、ticket 都有期限。
- 目前使用 `window.open()` 回傳單次憑證；部分 iOS／瀏覽器隱私模式禁止彈窗時需允許彈出視窗。
- 付款仍處於停用階段；GM 扭蛋只是免費測試，不應連結任何真實付款承諾。
- 抽獎伺服器採 100 權重：[White 45, Green 30, Blue 18, Purple Epic 5, Gold 2]，所有抽獎獨立、有放回；重複抽到已有翅膀是預期行為。

## GM 繪製翅膀

`S → GM 控制中心 → 畫翅膀／上架翅膀`，繪製輪廓、筆刷、鏡像、縮放及命名。上架後 Durable Object 保存 normalized vector 筆畫和能力，並立即入 GM 背包。自製翅膀上限 24 款，控制權由伺服器依已登入 GM 驗證；一般玩家看不到 Wing Shop。
