# 學習網站搬到 Cloudflare（Google 帳號登入）設定步驟

> **2026-11-05 改網址**：主網址改成 **https://bmlearn.pages.dev**（Pages 專案 `bmlearn`），步驟見最後「七、改成 bmlearn.pages.dev」。
> 下面一～六節寫的是第一次設定（當時專案叫 `learn`、網址 learn-6td.pages.dev），之後看到 `learn` 就換成 `bmlearn`。

2026-11-04 公司電腦規劃（使用者選「B：Cloudflare Access ＋ Google 帳號登入」）。做法和股票網站一樣（Cloudflare Pages ＋ Access），
但學習網站**和股票網站完全分開**（不同的 Pages 專案、不同的 Access 應用程式）。

- 網站：6 個 repo 由這個 repo 的 GitHub Actions「部署到 Cloudflare Pages」（`.github/workflows/cloudflare-pages.yml`）合成一個網站，
  部署到 Cloudflare Pages 專案 `learn`（網址 `https://learn.pages.dev` 或 `learn-xxx.pages.dev`，以 Cloudflare 給的為準）。
  路徑和現在一樣：`/`、`/english-quiz/`、`/vocab-king/`、`/daily_life_listening/`、`/nat-geo-reading/`、`/exam-bank/`。
  子站寫死的 `https://jenlin2002.github.io/` 在部署時自動改成 `/`（repo 不用改）。
  段考題庫超過 25 MB 的檔（聽力 zip、社會 PDF）不能放 Cloudflare，部署時自動改成轉到 GitHub 原始檔（repo 要維持 Public）。
- 什麼時候更新：這個 repo push 時、手動 Run workflow、每 15 分鐘檢查一次子站有沒有新 commit（有才部署）。
- 登入：Cloudflare Access，只用 Google 帳號；BRANDEN、MELISSA 用自己的 Google 帳號，家長用自己的 Gmail。
- 身分：`functions/api/me.js` 驗證 Access 的登入憑證，用 `USER_MAP` 把 email 對照成 BRANDEN／MELISSA／PARENT；
  `points.js` 打開頁面時問 `/api/me`，自動設定登入者，不再出現「你是誰？」關卡。
- 點數：
  - 第一階段（不用改 Apps Script）：每台裝置第一次只問一次自己的 PIN（名字已經自動選好），之後照舊。
  - 第二階段（家裡電腦改 Code.gs 後）：`/api/points` 代轉，連 PIN 都不用。
- 在 jenlin2002.github.io 舊網址一切照舊（選名字＋PIN），所以搬家過程中不會壞。

**密碼、金鑰都由使用者自己在後台輸入，不寫進 repo。**

## 一、Google 登入用的 OAuth 用戶端（Google Cloud，做一次）

1. 先到 Cloudflare 後台 → **Zero Trust**（第一次要選 Free 方案；股票網站已經開過，就用同一個團隊）→ Settings → Custom Pages／General，
   記下「團隊網域」`<團隊>.cloudflareaccess.com`。
2. https://console.cloud.google.com → 建立專案（例如「learn-login」）。
3. APIs & Services → **OAuth consent screen**：User type 選 External，App name 填「成長學習館」，
   Test users 加入家長、BRANDEN、MELISSA 的 Gmail（或按 Publish app 發布）。
4. APIs & Services → **Credentials → Create credentials → OAuth client ID** → Web application：
   - Authorized JavaScript origins：`https://<團隊>.cloudflareaccess.com`
   - Authorized redirect URIs：`https://<團隊>.cloudflareaccess.com/cdn-cgi/access/callback`
   - 建立後記下 Client ID、Client secret。
5. Cloudflare Zero Trust → Settings → **Authentication → Login methods → Add new → Google**，貼上 Client ID、Client secret → Save → Test。

## 二、讓 GitHub Actions 能部署（做一次）

1. Cloudflare 後台 → My Profile → **API Tokens → Create Token** → Custom token：權限 **Account → Cloudflare Pages → Edit** → 建立，複製 token。
2. Cloudflare 後台首頁右側複製 **Account ID**。
3. GitHub → `jenlin2002.github.io` repo → Settings → Secrets and variables → Actions → New repository secret：
   `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
4. Actions 分頁 →「部署到 Cloudflare Pages」→ **Run workflow**。第一次段考題庫檔案多，要跑十幾分鐘。
   跑完到 Cloudflare 後台 → Workers & Pages → `learn` 看網址（下面用 `<網址>` 代表，例如 learn-abc.pages.dev）。

## 三、Access 登入保護（做一次）

1. Zero Trust → Access → **Applications → Add an application → Self-hosted**：
   - 名稱「成長學習館」；Session Duration **1 month**
   - Domain：`<網址>`；再加一筆 `*.<網址>`（每次部署的預覽網址）
   - Login methods：只勾 **Google**，打開 Instant Auth（直接跳 Google 登入）
   - Policy：Action **Allow**，Include → **Emails**：家長、BRANDEN、MELISSA 的 Gmail
   - 存好後，在這個應用程式的 Overview 複製 **Application Audience (AUD) Tag**。
2. 另外新增一個 Self-hosted 應用程式「學習 App 圖示」（讓手機加入主畫面抓得到圖示）：
   Domain `<網址>`，Path `app/icon-*`；再加 Path `app/apple-touch-icon.png`、`app/manifest.webmanifest`；Policy Action **Bypass**，Include **Everyone**。
   （`app/install-qr.png` 的 QR Code 還是舊網址，換新網址後要重做。）
3. Cloudflare 後台 → Workers & Pages → `learn` → Settings → **Variables and Secrets**（Production）新增：
   - `ACCESS_TEAM` = `<團隊>.cloudflareaccess.com`
   - `ACCESS_AUD` = 上面複製的 AUD Tag（新版後台常找不到：先只設 `ACCESS_TEAM`、`USER_MAP`，部署、用 Google 登入後開 `<網址>/api/aud`，畫面上的 `aud` 就是，再填進 `ACCESS_AUD`、重新部署）
   - `USER_MAP` = `孩子1的gmail=BRANDEN,孩子2的gmail=MELISSA,家長的gmail=PARENT`（用 Secret 類型，email 不放 repo）
4. 再 Run workflow 一次（改了變數要重新部署才生效）。

## 四、測試

1. 無痕視窗開 `<網址>`：要先跳 Google 登入；用 BRANDEN 的 Google 帳號登入。
2. 開 `<網址>/api/me`：要看到 `{"name":"BRANDEN",...}`。看到 `unknown-user` 是 USER_MAP 沒對到這個 email；`no-access` 是 ACCESS_TEAM／ACCESS_AUD 沒設好。
3. 回首頁：不會出現「你是誰？」，第一次會問 BRANDEN 的 PIN（第一階段）。做一份測驗，確認存摺有加點。
4. 單字區的學習進度、段考題庫、美式生活館、圖解單字、國家地理閱讀都點一遍。
5. 點數存摺的「登出」會連 Google 登入一起登出（`/cdn-cgi/access/logout`），換人重新登入。
   注意：同一個瀏覽器同時只能有一個人登入；兩個孩子共用一台電腦時，用完要按登出，或各用不同的瀏覽器設定檔。

## 五、都正常後

- 把孩子手機／平板上的書籤、主畫面 App 換成新網址（App：`<網址>/app/`）。
- 舊網址：各 repo Settings → Pages 可以關掉 GitHub Pages（關了之後只剩 Cloudflare 網址，才真的有登入保護）。
  repo 先維持 **Public**（段考題庫的大檔要從 GitHub 原始檔下載；Actions 也免費）。要改 Private 的話：
  大檔要改放別處（例如 Cloudflare R2），並在這個 repo 加 Secret `REPOS_TOKEN`（可讀 6 個 repo 的 GitHub token）。

## 六、第二階段：連 PIN 都不用（家裡電腦，english-quiz-plan 的 Code.gs）

1. 自己想一串長的隨機密語（不要告訴任何人、不要寫進 repo）。
2. Apps Script 編輯器 → 專案設定 → **指令碼屬性** 新增 `CF_SECRET` = 這串密語。
3. Code.gs 加上下面的函式，並在「檢查 token」的地方加一條：`cfUser_(p)` 等於該名字、或等於 `PARENT`（家長管理、看孩子存摺）就當成驗證通過：
   ```js
   // Cloudflare /api/points 代轉的請求：cfsecret 對了，cfuser 就是 Cloudflare Access 驗證過的登入者
   function cfUser_(p) {
     var s = PropertiesService.getScriptProperties().getProperty('CF_SECRET');
     return (s && p.cfsecret === s) ? String(p.cfuser || '').toUpperCase() : '';
   }
   ```
   `/api/points` 送來的請求一律 `token=cf`，孩子只能查／動自己的存摺（Cloudflare 那邊已經擋住改別人名字），PARENT 可以看兩個孩子。
4. 部署新版本（網址不變）。
5. Cloudflare `learn` → Variables and Secrets 新增 `POINTS_URL`（Apps Script /exec 網址）、`POINTS_SECRET`（同一串密語，Secret 類型）→ Run workflow。
   之後 `/api/me` 會回 `proxy:true`，points.js 自動改走 `/api/points`，不再問 PIN。

## 七、改成 bmlearn.pages.dev（2026-11-05，使用者要好打的網址）

程式這邊已改好：部署目標改成 Pages 專案 `bmlearn`；舊的 `learn` 專案（learn-6td.pages.dev）每次 push／手動部署時換成「轉到新網址同一路徑」；
舊網址 jenlin2002.github.io 改由 `gh-redirect/`（workflow「舊網址轉到新網站」）發布轉址頁；新 QR Code 在 `app/install.html`、`app/install-qr.png`。

**順序很重要：先做 1（Access 先擋住新網址），再 Push，否則新網站剛建好的幾分鐘沒有登入保護。**

1. Zero Trust → Access → Applications →「成長學習館」→ Edit → Public hostnames（Domain）**新增兩筆**：`bmlearn.pages.dev`、`*.bmlearn.pages.dev`（learn-6td 那兩筆先留著）→ Save。
   AUD Tag 不變，所以 `ACCESS_AUD` 用同一個值。有做「學習 App 圖示」Bypass 應用程式的話，也加上 `bmlearn.pages.dev` 的同樣路徑。
2. GitHub Desktop → jenlin2002.github.io → Push。Actions 會自動跑「部署到 Cloudflare Pages」，第一次會建立 `bmlearn` 專案（約 10 分鐘）。
   跑完到 Cloudflare → Workers & Pages → `bmlearn`，確認網址是 `bmlearn.pages.dev`（如果被加了尾碼，例如 bmlearn-xxx.pages.dev，告訴 Claude 改程式和 QR Code）。
3. `bmlearn` → Settings → Variables and Secrets（Production）新增，值和 `learn` 專案一樣（自己輸入／複製）：
   `ACCESS_TEAM`（Text）、`ACCESS_AUD`（Text）、`USER_MAP`（Secret，重新打一次 email=名字）；第二階段做了的話再加 `POINTS_URL`、`POINTS_SECRET`。
4. GitHub → Actions →「部署到 Cloudflare Pages」→ Run workflow（變數要重新部署才生效）。
   2026-11-05 實際遇到：畫面上 `ACCESS_AUD` 看起來對，但 `/api/aud` 一直 `set:false`（名稱可能藏了空格或全形字）；刪掉那一列、名稱和值都用**貼上**重建，再 Run workflow 就好了。`/api/aud` 的 `set` 就是用來查這個的。
5. 測試：新的無痕視窗開 `https://bmlearn.pages.dev/api/me` → 看到 `"name":"PARENT"`；再開首頁、做一份測驗。
   開 `https://learn-6td.pages.dev/english-quiz/` → 應該自動跳到 `https://bmlearn.pages.dev/english-quiz/`。
6. 舊網址 jenlin2002.github.io 轉過去（5 確認沒問題後再做）：
   - jenlin2002.github.io repo → Settings → Pages → Build and deployment → Source 選「**GitHub Actions**」→ Actions →「舊網址轉到新網站」→ Run workflow。
   - english-quiz、daily_life_listening、vocab-king、nat-geo-reading、exam-bank 五個 repo：Settings → Pages → Branch 選「**None**」→ Save（關掉子站的 GitHub Pages）。
   - 測試：開 `https://jenlin2002.github.io/english-quiz/` → 會跳到 `https://bmlearn.pages.dev/english-quiz/`。
   - repo 維持 Public（Cloudflare 部署要讀、段考題庫大檔從 GitHub 原始檔下載）。
7. iPad／手機：刪掉主畫面舊的「B&M 學習」圖示 → 印出或打開 `app/install.html`（QR Code 指向 `https://bmlearn.pages.dev/app/`）→ 用相機掃 → Google 登入 → 加入主畫面。
8. 過幾週確定沒人用舊 Cloudflare 網址後：Cloudflare 刪掉 `learn` 專案、Access 刪掉 learn-6td 兩筆網址，workflow 裡 `OLD_PROJECT` 那行和「舊網址轉址」步驟一起刪。