# GGTEMPLE — Firebase Google 登入（唯一登入方式）

## 使用者登入流程

首頁只顯示「使用 Google 帳號登入」。使用者選擇 Google 帳號並授權後，首次進入需設定角色名稱與衣服顏色；此後同一 Firebase Google 身份自動恢復伺服器儲存的角色（等級、金幣、裝備、融合、翅膀與背包）。不用 Apple、Facebook、Memory Code，也不需要 Firebase Firestore；玩家存檔仍儲存在現有 Cloudflare Durable Object。

程式已導入 Firebase Auth JS SDK（Google-only），Cloudflare Worker 使用 Google 公鑰驗證 Firebase ID Token，驗證 `aud`、`iss`、`exp`、`iat`、`auth_time`、RS256 簽章，及 Firebase `sign_in_provider: google.com`。只有持有效 Google Firebase Token 的玩家能進入公開正式環境。單次登入交換後，遊戲沿用原 Cloudflare session/Socket；每次重返遊戲重新驗證 Google 身份，進度依 Firebase UID 綁定。

## 唯一需要的 Firebase 手動設定

1. 打開 https://console.firebase.google.com/，以 Google 帳戶建立一個 Firebase project，例如 `ggtemple`。不需開啟 Analytics，也不用建立 Firestore。
2. Firebase Console → **Build → Authentication → Get started → Sign-in method → Google → Enable → Save**。只有 Google 必須打開。
3. Firebase Console → **Authentication → Settings → Authorized domains → Add domain**，加入 `zhenggdove-artist.github.io`（只填網域，不包含 `https://` 或路徑）。開發用 `localhost` 需另外加入。
4. Firebase 專案 **Project settings（齒輪）→ General → Your apps → Web app（</>）→ Register app**。取出 `firebaseConfig` 中的四個值：
    - `apiKey`
    - `authDomain`
    - `projectId`
    - `appId`
5. Cloudflare Dashboard → **Workers & Pages → temple-arena → Settings → Variables and Secrets**，新增下列四項，數值完全依照 Firebase 的 `firebaseConfig` 貼上：

| Cloudflare variable | Firebase web config |
|---|---|
| `FIREBASE_WEB_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_WEB_APP_ID` | `appId` |

這四項屬於公開用 Firebase Web 設定，不是 Firebase 私密金鑰。**不要貼服務帳戶 JSON 或 Google 密碼。** Cloudflare 設好並部署後，開啟 `https://zhenggdove-artist.github.io/3Dgallery01/`。登入按鈕會啟用。

`wrangler.jsonc` 已設定 `keep_vars: true`，避免下次 GitHub 自動部署覆蓋 Dashboard 變數。

## GM 唯一 Google 帳號

預設所有 Google 帳號皆為普通玩家。GM 必須靠已驗證 UID 指派，不能只靠名字 `Ely`。

使用預定當 GM 的 Google 帳戶在 Firebase 首次登入後，前往 Firebase Console → Authentication → Users 找到對應的 **User UID**。在 Cloudflare Worker Variables and Secrets 新增：

`FIREBASE_GM_UID` = 那個帳號的 Firebase UID

重新部署或套用 Cloudflare 設定後，使用同一 Google 帳號登入。系統會驗證該 UID，啟用 GM；首次啟用會從現有舊版 GM（Ely）存檔複製等級、裝備、背包、翅膀等，不刪除舊存檔。

## 目前限制

- 未設定四項 Firebase Web 變數前，正式網站的 Google 登入按鈕維持停用，公開 API 也拒絕匿名登入；不會擅自創造 Firebase 專案或憑證。
- 由於 OAuth 身份體系不同，先前尚未綁定 Firebase UID 的**其他舊玩家** Memory Code 存檔不會自動合併，以免把別人的存檔交給錯誤帳號。
- Firebase Google popup 可能遭瀏覽器封鎖；在 iPhone Safari 需允許登入視窗。SDK 先預熱，避免動態載入時失去使用者點擊手勢。
- 不需要 Firebase Hosting：網頁仍由 GitHub Pages 發布，Worker 仍部署到 Cloudflare。付款功能仍停用。

## GM 翅膀工作室

`S → GM 控制中心 → 畫翅膀／上架翅膀`。繪圖、命名及設定屬性後可上架到只有 GM 能看見的測試扭蛋機，並直接加入 GM 背包。
