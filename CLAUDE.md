# 網站首頁（jenlin2002.github.io）說明

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

## 連續學習紅利＋稱讚畫面（2026-10-18）

- 送出測驗後跳出稱讚卡（得幾點、連續第幾天、還差幾點到 100 點）；每跨過 100 點跳出大的恭喜兌換畫面。
- 連續學習紅利：第 2 天 +2、第 3、4 天 +5、第 5 天起每天 +10，中斷就重算；不算在每天 50 點上限內；存摺分頁記成類型「紅利」。
- 程式在 `points.js`（7 份副本內容一致，主檔在 english-quiz-plan `points/points.js`）與後端 `Code.gs`（`CONFIG.STREAK_BONUS`）。
- **要先更新 Apps Script 後端（貼新版 Code.gs → 部署新版本）紅利才會開始算**，步驟在 english-quiz-plan `points/README-點數存摺.md` 最後一節。

- **GitHub Pages 部署卡住（2026-10-18）**：PR #10 合併後「pages build and deployment」一直排隊／進行中（沒有任何 job），網站停在上一版。處理方式：到 Actions 取消那次部署，再推一個新的 commit 到 main（例如更新這份 CLAUDE.md）觸發新的部署；單純 Re-run 那次不一定會好。查部署狀態：Actions → pages build and deployment。

