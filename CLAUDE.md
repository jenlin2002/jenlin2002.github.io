# 網站首頁（jenlin2002.github.io）說明

## 登入改成 Cloudflare Access＋Google 帳號（2026-11-04 規劃，程式已做好、等使用者設定後台）

- **2026-11-04 晚上進度**：後台已設好——網址 `https://learn-6td.pages.dev`（Pages 專案 `learn`；2026-11-05 改成 `https://bmlearn.pages.dev`、專案 `bmlearn`，舊的只剩轉址）、Access 應用程式「成長學習館」（Google 登入、Policy「家人」3 個 Gmail）、Pages 變數 `ACCESS_TEAM`、`USER_MAP`、`ACCESS_AUD` 都已設；`/api/me` 用家長 Gmail 測試回 `PARENT` ✅。
  曾遇到 Access「Failed to fetch user/group information」：是 Cloudflare 裡 Google 的 App ID／Client secret 不對，重貼後 Test 通過（Google 用戶端密鑰最多 2 組，舊的已刪）。
- **2026-11-05 改網址成 bmlearn.pages.dev**（使用者：「1+2 都做，3 改成 bmlearn.pages.dev」）：workflow `PROJECT: bmlearn`、`SITE_URL`；舊 `learn` 專案在 push／手動部署時換成 `_redirects` 轉到新網址同一路徑（`OLD_PROJECT`）；
  舊網址 jenlin2002.github.io 由 `gh-redirect/`＋workflow「舊網址轉到新網站」（只手動執行，要先把 Pages Source 改成 GitHub Actions）發布轉址頁（index.html＝404.html，JS 轉到新網址同一路徑，sw.js 把舊 App 的 service worker 移除），5 個子站 repo 的 GitHub Pages 要關掉才會落到這個 404；
  QR Code `app/install-qr.png`／`install-qr.svg`、`app/install.html` 已改成 `https://bmlearn.pages.dev/app/`（用 opencv 解碼驗證過）。**後台步驟（先加 Access 網址再 Push）在 `CLOUDFLARE-SETUP.md` 第七節，使用者還沒做。**
- 還沒做：用孩子帳號實測測驗加點（BRANDEN 登入 OK；iPad 曾停在 Access 的 App Launcher 畫面）、圖示 Bypass 應用程式、各裝置換新網址與主畫面圖示、第二階段（Code.gs `cfUser_`）。

- 使用者選定：學習網站跟股票網站一樣用 Cloudflare 保護（但兩邊完全分開），BRANDEN、MELISSA 用自己的 Google 帳號、家長用自己的 Gmail 登入，不再「選名字＋4 位數 PIN」。
- 6 個 repo 由首頁 repo（jenlin2002.github.io）的 GitHub Actions「部署到 Cloudflare Pages」合成一個網站（Pages 專案 `bmlearn`，網址 **https://bmlearn.pages.dev**，路徑和 GitHub Pages 一樣；2026-11-05 從 learn-6td.pages.dev 改名，舊網址和 jenlin2002.github.io 都轉到這裡，後台步驟在首頁 repo `CLOUDFLARE-SETUP.md` 第七節），`functions/api/me.js` 用 Access 憑證＋`USER_MAP`（Cloudflare 變數，email 不放 repo）回傳登入者名字。
- `points.js`（各站副本內容相同）：在 Cloudflare 網址打開時問 `/api/me`，自動設定 `quizStudentName`、不出現「你是誰？」關卡；第一階段每台裝置第一次只問一次自己的 PIN；第二階段（Code.gs 加 `cfUser_`、Cloudflare 設 `POINTS_SECRET`）點數改走 `/api/points`，不用 PIN。登出會連 Google 登入一起登出。在 jenlin2002.github.io 舊網址一切照舊（2026-11-05 起舊網址改成轉到 bmlearn.pages.dev，使用者接受不再用舊 PIN 版）。
- 後台設定步驟、測試方法、第二階段 Code.gs 改法都在首頁 repo 的 `CLOUDFLARE-SETUP.md`。密碼、金鑰一律使用者自己在 Cloudflare／GitHub／Google 後台輸入。
- 之後新做的頁面照舊用相對路徑；子站寫死的 `https://jenlin2002.github.io/` 部署時會自動改成 `/`。Cloudflare Pages 單檔上限 25 MB、整站 20000 個檔（2026-11-04 約 15300 個），大檔自動轉到 GitHub 原始檔。
## 使用者與工作方式（四個 repo 共用同一段，2026-10-13）

- 使用者在三個地方用 Claude Code：**家裡電腦、公司電腦**（兩台都有 GitHub Desktop，用它 Pull／Push）、**外出用手機 App（雲端版）**。學習成長網站已經做很久了，不用從頭介紹。
- **不用教 git／GitHub Desktop／PowerShell 的操作。** 改完直接開 PR 合併到 `main`（使用者另一台電腦用 GitHub Desktop Pull 就好），只要回報「改了什麼、合併到哪裡」。
- 一律用**繁體中文**回覆。
- **每次結束前**：把這次做的事、待辦更新到這個 CLAUDE.md，合併到 `main`，下一個地方 Pull 後就接得上。
- 學習網站的 repo（都在 jenlin2002 底下，GitHub Pages 從 `main` 發布）：
  `jenlin2002.github.io`（網站首頁＝成長學習館總入口、點數存摺、B&M 學習 App）、`english-quiz`（英文測驗系統）、
  `daily_life_listening`（美式生活館）、`vocab-king`（圖解單字）、`nat-geo-reading`（國家地理風閱讀）、`exam-bank`（段考題庫）。
  雲端版只讀得到這次有載入的 repo；要改的 repo 沒載入時，直接用 add_repo 加進來。
- 股票（`stock`、`stock-dashboard`）和學習網站分開，學習網站裡不要放股票相關的東西。

## 檔案與功能

- **右上角工具列（2026-10-18 使用者要求，像一般網站的登入區）**：`header` 裡的 `.top-right` 小按鈕（高 32px），桌機兩行靠右：第一行「安裝 App」、第二行（使用者 10-18 指定的位置）「🪙 BRANDEN 69｜MELISSA 48 點 ▼」（`Points.mount(el, { compact: true })`，點開下拉面板：每人點數、離 100 點的進度條與還差幾點、可換幾次電腦時間、🔥 連續學習天數、家長管理／我的測試存摺、規則；點外面或 Esc 收起；手機寬度面板橫跨畫面、只顯示數字）＋「登出」；手機寬度排成一行。標題下的大橫幅已拿掉。`points.js` 用 `?v=` 版本號載入（改 points.js 時要把 v 加一，否則瀏覽器會用快取的舊版，舊版不認得 compact，會把大橫幅塞進右上角——使用者 10-18 就遇到）；CSS 另外把非 compact 的橫幅在右上角藏起來當保險。
- `index.html`：BRANDEN & MELISSA 成長學習館，所有子網站的入口；上方有點數存摺橫幅（`points.js`）；「📱 安裝 B&M 學習 App」按鈕在**右上角**（`header` 裡的 `.app-btn`，2026-10-18 使用者要求從點數存摺下面移過去；手機寬度只顯示圖示＋名稱）。
- `points.js`：學習點數存摺＋PIN 登入關卡。訪客模式（不用 PIN、不計點數）程式還在，但 **2026-10-04 使用者決定先關閉**：`GUEST_ENABLED = false`，要開放時三個 repo 都改成 true。english-quiz、daily_life_listening 各有一份，**三份內容要一樣**；
  主檔在私人 repo english-quiz-plan 的 `points/points.js`。後端是 Google Apps Script（`POINTS_URL`）。
- `app/`：**B&M 學習 App**（2026-10-04），可「加入主畫面」的網頁 App（PWA）。一個入口放英文測驗系統與美式生活館。
  - `app/index.html`：入口頁；登入沿用 points.js 的關卡（BRANDEN／MELISSA 用 PIN；家長）。
  - `app/manifest.webmanifest`：`start_url` 是 `/app/`，`scope` 是 `/`，所以從 App 點進 `/english-quiz/`、`/daily_life_listening/` 仍在 App 裡。
  - `sw.js`（根目錄）：只快取 `/app/` 底下的入口頁，其他網站的請求不經過它。改了入口頁要把 `CACHE` 版本號加 1。
  - 圖示 `app/icon-192.png`、`icon-512.png`、`apple-touch-icon.png`。
  - iPhone 加到主畫面後，App 和 Safari 的登入資料是分開的，第一次在 App 裡要重新登入。
- 英文測驗系統裡不要放美式生活館的連結（使用者要求）。

## 2026-10-04 手機雲端版的工作紀錄

- 已合併：網站首頁 PR #1（B&M 學習 App、訪客模式；訪客模式之後依使用者要求關閉）、english-quiz PR #6、daily_life_listening PR #3（訪客模式＋手機版點數橫幅修正）。
- **還沒驗證**（雲端環境連不到網站與點數後端）：
  1. 真的手機上「加入主畫面」安裝 App、從 App 打開兩個網站。
  2. 在 App 裡用真的 PIN 登入 BRANDEN／MELISSA、做測驗加點（後端 Apps Script 沒有被改，應該照常運作）。
- **回家電腦第一件事**：把這裡（或任一 repo）的 `points.js` 複製回私人 repo english-quiz-plan 的 `points/points.js`，
  三份公開副本與主檔要一樣（公開副本多了 `GUEST_ENABLED` 開關〔目前 false〕與手機版橫幅修正），否則下次從 plan repo 部署會把這些改動蓋掉。
- 使用者的分工習慣：手機上用 Claude Code 雲端版做，回家用電腦接手；每次結束前要更新各 repo 的 CLAUDE.md 並合併到 main。

- **其他人＝家長開帳號（2026-10-04）**：除了 BRANDEN、MELISSA、家長，其他人要由家長在「家長管理 → 帳號管理」建立帳號（學生＝有存摺可賺點；只能練習＝不計點數），PIN 由家長設定；本人在關卡按「其他帳號登入」。訪客模式關閉（`GUEST_ENABLED = false`）。**要先更新 Apps Script 後端（貼新版 Code.gs → 部署新版本）才能用**，步驟在 plan repo `points/README-點數存摺.md` 最後一節。points.js 主檔與三個網站的副本已同步一致。

- **`/stock` 短網址（2026-10-12）**：`jenlin2002.github.io/stock` 轉到台美股看盤，**由另一個公開 repo `jenlin2002/stock` 提供**（GitHub Pages，main／root），不在這個學習網站 repo 裡；這裡不要放任何股票相關的東西（使用者要求學習網站和股票分開）。

## 測驗規則統一以段考題庫為準（2026-10-18 使用者要求，以後新做的測驗也照做）

- **成長學習館各單元有測驗的地方，作答、送出、計分、訂正方式一律以國中英語段考題庫（exam-bank `sync.js`）為準**（使用者已測試驗證 OK）：
  送出成績（全部作答才送）→ 馬上對答案（綠對紅錯＋正解）→ 有錯題時上方「✏️ 訂正錯誤」＋「錯誤全部訂正完畢再另加補送 1 點」（答對的鎖住、錯題清空重答）→「送出訂正」直到全對 → 補送 1 點（`Points.earn` `kind:'fix-bonus'`）；
  沒訂正完不能離開這一頁（擋連結、關分頁跳確認）；測試帳號 TEST、家長 PARENT 有「🚪 立即離開」；試算表每次訂正 mode／單元名稱註明「【第 N 次訂正】」、完成記「【全部訂正完成】補送 1 點」；點數只算第一次作答；「💾 暫存」＋自動暫存接續作答。
- 各站的做法：段考題庫 `sync.js`；圖解單字 `topic.html`；國家地理閱讀 `fixkit.js`（`points-glue.js` 載入）；英文測驗系統 `eqfix.js`；美式生活館 `lifefix.js`（engine.js、index.html 用）。
  英文測驗系統、美式生活館是「一題一題做、答完看解說」的形式，使用者選擇保留，只把結果頁改成訂正規則（只重做錯題、直到全對）。

## 連續學習紅利＋稱讚畫面（2026-10-18）

- 送出測驗後跳出稱讚卡（得幾點、連續第幾天、還差幾點到 100 點）；每跨過 100 點跳出大的恭喜兌換畫面。
- 連續學習紅利：第 2 天 +2、第 3、4 天 +3、第 5 天起每天 +4（2026-10-18 使用者改），中斷就重算；不算在每天 50 點上限內；存摺分頁記成類型「紅利」。
- **答對率計分（2026-10-18）**：答對 1 題得幾點看答對率（第三版，2026-10-18 使用者定）：低於 30% 0.25、30～50% 0.5、50～60% 0.8、60～70% 1、70～90% 1.2、90% 以上 1.5、全對 2，四捨五入成整數（80～90% 使用者沒另外寫，同 7～8 成）；後端 `Code.gs` 的 `CONFIG.RATE_TIERS`，要重新部署 Apps Script 才生效。
- **段考訂正完成補送 1 點（2026-10-18）**：段考題庫錯題全部訂正完成後 `Points.earn({kind:'fix-bonus'})`，後端 `fixBonus_()` 記一筆類型「訂正獎勵」+`CONFIG.FIX_BONUS`（1）點，同一份考卷每天一次、不算每天上限與連續天數；要重新部署 Apps Script 才生效（舊版後端會當成一般賺點、全對每題 2 點＝給 2 點）。
- 程式在 `points.js`（7 份副本內容一致，主檔在 english-quiz-plan `points/points.js`）與後端 `Code.gs`（`CONFIG.STREAK_BONUS`）。
- **要先更新 Apps Script 後端（貼新版 Code.gs → 部署新版本）紅利才會開始算**，步驟在 english-quiz-plan `points/README-點數存摺.md` 最後一節。

- **GitHub Pages 部署卡住（2026-10-18）**：PR #10 合併後「pages build and deployment」一直排隊／進行中（沒有任何 job），網站停在上一版。處理方式：到 Actions 取消那次部署，再推一個新的 commit 到 main（例如更新這份 CLAUDE.md）觸發新的部署；單純 Re-run 那次不一定會好。查部署狀態：Actions → pages build and deployment。

