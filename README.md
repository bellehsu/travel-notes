# travel-notes

一份可以線上瀏覽 + 在 Google Drive 直接編輯/存檔的旅遊筆記頁面。

---

## 一、線上瀏覽：用 GitHub Pages

1. GitHub 倉庫 → **Settings** → 左邊 **Pages**
2. **Source** 選 `Deploy from a branch`
3. **Branch** 選 `jp2026`、資料夾 `/ (root)` → **Save**
4. 等 1~3 分鐘，會出現網址：
   - 預設：`https://eithwa.github.io/travel-notes/`
   - 自訂：`https://travel.omnixaas.com/`（需要在網域 DNS 設定 CNAME 指向 `eithwa.github.io`）

---

## 二、Google Drive 同步功能（雙向：讀 + 存）

頁面上的 ☁️ Google Drive 同步區塊 可以：

- **以 Google 登入**：用你的 Google 帳號授權
- **建立新檔**：在你的 Drive 建立 `trip.json`
- **選現有檔案**：用 Google Picker 從 Drive 選一個 JSON
- **自動儲存**：每次編輯後 4 秒自動寫回 Drive
- **立即儲存**：手動觸發同步

要啟用此功能，必須先做下列設定（只做一次，約 5 分鐘）。

### 步驟 1：建立 Google Cloud 專案

1. 打開 <https://console.cloud.google.com/>
2. 上方專案選單 → **新增專案** → 名稱例如 `travel-notes` → 建立

### 步驟 2：啟用 Google Drive API + Google Picker API

1. 左側選單 → **API 和服務** → **程式庫**
2. 搜尋 `Google Drive API` → 點進去 → **啟用**
3. 再搜尋 `Google Picker API` → 點進去 → **啟用**

### 步驟 3：建立 OAuth 同意畫面

1. 左側 → **API 和服務** → **OAuth 同意畫面**
2. User Type 選 **外部** → 建立
3. 應用程式名稱：`travel-notes`
4. 使用者支援電子郵件：填你自己的 Email
5. 開發人員聯絡資訊：填你自己的 Email
6. 一路下一步、儲存
7. **測試使用者** 區塊 → **新增使用者** → 把所有要編輯的旅伴 Email 都加進去（最多 100 個）
   - **重要**：在「測試模式」下，只有清單裡的 Email 才能登入。

### 步驟 4：建立 API Key

1. **API 和服務** → **憑證** → 上方 **+ 建立憑證** → **API 金鑰**
2. 複製產生的 Key（像 `AIzaSyA...`）
3. 點該 Key 旁邊的編輯 → **應用程式限制** 選 `HTTP 參照網址`
4. 加入網址：
   - `https://eithwa.github.io/*`
   - `https://travel.omnixaas.com/*`（如果用自訂網域）
   - `http://localhost/*`（如果本機測試）
5. **API 限制** → 限制金鑰 → 勾選 `Google Drive API` 與 `Google Picker API` → 儲存

### 步驟 5：建立 OAuth Client ID

1. **API 和服務** → **憑證** → **+ 建立憑證** → **OAuth 用戶端 ID**
2. 應用程式類型：**網頁應用程式**
3. 名稱：`travel-notes-web`
4. **已授權的 JavaScript 來源** 加入：
   - `https://eithwa.github.io`
   - `https://travel.omnixaas.com`（如果用自訂網域）
   - `http://localhost:8080` 或 `http://127.0.0.1:5500`（本機測試常用 port）
5. **已授權的重新導向 URI** 不用填（我們用 token flow）
6. 建立 → 複製 **用戶端 ID**（像 `1234567890-xxxxx.apps.googleusercontent.com`）

### 步驟 6：把兩個值填進 `index.html`

打開 `index.html`，搜尋 `GOOGLE_CONFIG`，把空字串換成你剛才複製的兩個值：

```js
const GOOGLE_CONFIG = {
  CLIENT_ID: '1234567890-xxxxx.apps.googleusercontent.com',
  API_KEY:   'AIzaSyA-你的key',
  ...
};
```

存檔 → push 到 GitHub → GitHub Pages 自動更新 → 完成！

### 步驟 7：把檔案分享給旅伴

第一次自己用「**建立新檔**」在 Drive 建好 `trip.json` 之後：

1. 到 <https://drive.google.com> 找到那個 `trip.json`
2. 右鍵 → **共用** → 加入旅伴的 Email → 權限 **編輯者** → 傳送
3. 旅伴打開網頁 → 點 **以 Google 登入** → 點 **選現有檔案** → Picker 裡選那個 `trip.json` 就行了

之後大家都會自動同步到同一份。

---

## 三、注意事項

- **避免同時編輯**：兩個人同一時間改，後存的會蓋掉先存的（沒有衝突合併）。可以約定誰在改。
- **CLIENT_ID 與 API_KEY 是公開的**：放前端是設計如此（OAuth flow 本來就這樣），安全靠的是 **HTTP 參照網址限制** 與 **OAuth 同意畫面的測試使用者清單**。所以步驟 4、5 一定要設好。
- **要正式發佈給很多人用？** 步驟 3 的 OAuth 同意畫面要送 Google 審核（測試模式只能 100 人）。
- **本機沒登入時的舊行為仍然保留**：拖曳 JSON、匯出 JSON、重置為預設，都跟原本一樣。
