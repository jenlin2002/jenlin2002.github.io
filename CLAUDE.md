# 網站首頁（jenlin2002.github.io）說明

- `index.html`：BRANDEN & MELISSA 成長學習館，所有子網站的入口；上方有點數存摺橫幅（`points.js`）與「B&M 學習 App」連結。
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
