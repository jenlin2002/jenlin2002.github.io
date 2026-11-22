# 網站首頁（jenlin2002.github.io）說明

## 登入改成 Cloudflare Access＋Google 帳號（2026-11-04 規劃，程式已做好、等使用者設定後台）

- **2026-11-04 晚上進度**：後台已設好——網址 `https://learn-6td.pages.dev`（Pages 專案 `learn`；2026-11-05 改成 `https://bmlearn.pages.dev`、專案 `bmlearn`，舊的只剩轉址）、Access 應用程式「成長學習館」（Google 登入、Policy「家人」3 個 Gmail）、Pages 變數 `ACCESS_TEAM`、`USER_MAP`、`ACCESS_AUD` 都已設；`/api/me` 用家長 Gmail 測試回 `PARENT` ✅。
  曾遇到 Access「Failed to fetch user/group information」：是 Cloudflare 裡 Google 的 App ID／Client secret 不對，重貼後 Test 通過（Google 用戶端密鑰最多 2 組，舊的已刪）。
- **2026-11-05 改網址成 bmlearn.pages.dev**（使用者：「1+2 都做，3 改成 bmlearn.pages.dev」）：workflow `PROJECT: bmlearn`、`SITE_URL`；舊 `learn` 專案在 push／手動部署時換成 `_redirects` 轉到新網址同一路徑（`OLD_PROJECT`）；
  舊網址 jenlin2002.github.io 由 `gh-redirect/`＋workflow「舊網址轉到新網站」（只手動執行，要先把 Pages Source 改成 GitHub Actions）發布轉址頁（index.html＝404.html，JS 轉到新網址同一路徑，sw.js 把舊 App 的 service worker 移除），5 個子站 repo 的 GitHub Pages 要關掉才會落到這個 404；
  QR Code `app/install-qr.png`／`install-qr.svg`、`app/install.html` 已改成 `https://bmlearn.pages.dev/app/`（用 opencv 解碼驗證過）。**後台步驟（先加 Access 網址再 Push）在 `CLOUDFLARE-SETUP.md` 第七節，使用者還沒做。**
- **2026-11-05 bmlearn.pages.dev 接通**：Access 加了 bmlearn 兩筆網址、bmlearn 三個變數設好（`ACCESS_AUD` 曾因名稱藏字元讀不到，刪掉貼上重建才好）；家長、BRANDEN、MELISSA 三個帳號都測試 OK（使用者回報「兩個都 OK 了」）。learn-6td 已變成轉址。
- **之後要做：5 個子站改 Private（2026-11-05 使用者同意，版權考量）**：GitHub 上 Public repo 任何人都能看到教材，exam-bank 有出版社考卷、聽力 zip、社會 PDF，風險最高。順序：①先完成舊網址轉址 ②使用者產生 `REPOS_TOKEN`（可讀 5 個 repo 的 fine-grained token）貼到首頁 repo Secrets、Claude 把 >24MB 大檔改放 Cloudflare R2（現在是 `_redirects` 轉 raw.githubusercontent.com，Private 後會失效）③確認部署正常再把 5 個子站改 Private。**首頁 repo 維持 Public**（GitHub Pages 轉址免費版需要 Public；部署 workflow 在這裡跑，Public 不耗 Actions 時數）；`stock`、`stock-dashboard` 不動。**2026-11-06：①②做完，exam-bank 已改 Private 並測過（部署 #28 成功、大檔經 `/api/big` 正常）；其他 4 個子站還是 Public，之後照 `CLOUDFLARE-SETUP.md` 第八節第 4、5 步做。**
- **2026-11-05 舊網址轉址完成**：首頁 repo Pages Source 改成 GitHub Actions、跑了「舊網址轉到新網站」，5 個子站 Pages 關掉；實測 jenlin2002.github.io/、/app/、/english-quiz/、/vocab-king/topic.html?t=home-1 都轉到 bmlearn.pages.dev 同一頁（子站路徑回 HTTP 404 但內容是轉址頁，瀏覽器照樣跳轉）；/stock/ 不受影響。
- 還沒做：各裝置換新主畫面圖示、圖示 Bypass 應用程式、第二階段（Code.gs `cfUser_`）。

- 使用者選定：學習網站跟股票網站一樣用 Cloudflare 保護（但兩邊完全分開），BRANDEN、MELISSA 用自己的 Google 帳號、家長用自己的 Gmail 登入，不再「選名字＋4 位數 PIN」。
- 6 個 repo 由首頁 repo（jenlin2002.github.io）的 GitHub Actions「部署到 Cloudflare Pages」合成一個網站（Pages 專案 `bmlearn`，網址 **https://bmlearn.pages.dev**，路徑和 GitHub Pages 一樣；2026-11-05 從 learn-6td.pages.dev 改名，舊網址和 jenlin2002.github.io 都轉到這裡，後台步驟在首頁 repo `CLOUDFLARE-SETUP.md` 第七節），`functions/api/me.js` 用 Access 憑證＋`USER_MAP`（Cloudflare 變數，email 不放 repo）回傳登入者名字。
- `points.js`（各站副本內容相同）：在 Cloudflare 網址打開時問 `/api/me`，自動設定 `quizStudentName`、不出現「你是誰？」關卡；第一階段每台裝置第一次只問一次自己的 PIN；第二階段（Code.gs 加 `cfUser_`、Cloudflare 設 `POINTS_SECRET`）點數改走 `/api/points`，不用 PIN。登出會連 Google 登入一起登出。在 jenlin2002.github.io 舊網址一切照舊（2026-11-05 起舊網址改成轉到 bmlearn.pages.dev，使用者接受不再用舊 PIN 版）。
- 後台設定步驟、測試方法、第二階段 Code.gs 改法都在首頁 repo 的 `CLOUDFLARE-SETUP.md`。密碼、金鑰一律使用者自己在 Cloudflare／GitHub／Google 後台輸入。
- 之後新做的頁面照舊用相對路徑；子站寫死的 `https://jenlin2002.github.io/` 部署時會自動改成 `/`。Cloudflare Pages 單檔上限 25 MB、整站 20000 個檔（2026-11-04 約 15300 個），大檔（>24 MB）部署時自動改由 `/api/big` 轉給登入的人（2026-11-05 起；要有 `REPOS_TOKEN`，repo 改 Private 也能讀；金鑰到期要重做，見首頁 repo `CLOUDFLARE-SETUP.md` 第八節）。寫頁面照舊連原本的相對路徑，不用改。
## 課本習作重點複習 textbook-review（2026-11-21 公司電腦）

- 新子站 repo `jenlin2002/textbook-review`（**一開始就是 Private**、不開 GitHub Pages），網址 `https://bmlearn.pages.dev/textbook-review/`；已加進 workflow 的 `SUBSITES`，首頁「段考題庫」卡片後面加了一張卡。
- 內容：依興雅國中 115 學年度版本表，Melissa 七年級（翰林國文、英語 iE1、社會）、Branden 八年級（翰林國文、英語 iE3＋康軒社會），80 課、547 題；重點／必背／習作練習，依三次段考分組。資料在 `data/*.js`，來源是 `OneDrive\興雅國中\XXY\課本` 的課本與教用習作 PDF（康軒八年級歷史、公民從 `DAE5310\3.iso` 取出，亂碼頁用 Windows OCR）。題目為改寫，不是原題。
- 送成績用段考題庫同一個 Apps Script（`SHEET_ENDPOINT` 與 exam-bank `sync.js` 相同）。2026-11-22 接上 `points.js`（第 8 份副本，`textbook-review/points.js`；改主檔要一起同步）：自動帶登入者，整課做完送出每題 1 點，只練錯題不算點。還沒接訂正補點、全站字典。
- `REPOS_TOKEN`（fine-grained token `bmlearn-deploy`，Only select repositories、Contents 唯讀）2026-11-22 已加勾 `textbook-review`，現在勾了 6 個：english-quiz、nat-geo-reading、daily_life_listening、exam-bank、vocab-king、textbook-review。以後新增 Private 子站都要回來加勾，**不要改成 All repositories**（會連 stock-dashboard 等私人 repo 都能讀）。
- 2026-11-21 查 repo 公開狀態：Private＝exam-bank、textbook-review、english-quiz-plan、stock-dashboard；Public＝首頁 repo（刻意）、stock（GitHub Pages 短網址）、以及 **english-quiz、vocab-king、daily_life_listening、nat-geo-reading 這 4 個子站還是 Public**。使用者說「之後再來改」，改法照 `CLOUDFLARE-SETUP.md` 第八節（先確認 token 有勾 → Make private → Run workflow）。改完可用 `https://api.github.com/users/jenlin2002/repos` 對照確認。

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

## 我的字卡（2026-11-17 使用者要求，手機雲端版）

- 登入者可以把單字／句子存成字卡、自己分類；字卡存在點數存摺同一份 Google 試算表的「字卡」「字卡分類」分頁（每人一份，手機、平板、電腦同步）。後端是 english-quiz-plan `points/Code.gs` 的 `cardlist／cardsave／carddel／cardmove／cardstatus／deckadd／deckrename／deckdel`（用存摺的登入憑證；同一人同一個英文只存一張；答錯再加入時「錯次」+1）。**要重新部署 Apps Script 才能用**，沒部署前按 ☆ 會提示「後端還沒更新」。
- 全站共用前端 `/cards/cards.js`（首頁 repo）：`Cards.btn(card)` 產生「☆」按鈕（點了選分類／新分類存起來，已存的變 ★，可改分類或移除）；`Cards.addWrong([card…])` 把測驗答錯的字自動放進「錯題」。card 欄位：en、zh、pos、ex、exzh、img、audio（網站根目錄開頭的絕對路徑）、src（來源名稱）、url。需要 `points.js`（它開放了 `Points.call／Points.auth／Points.who` 給字卡用，7 份副本一致）。
- 「我的字卡」頁 `/cards/`（首頁 repo；首頁右上角「📇 我的字卡」、App 入口頁都有連結）：分類（新增、改名、刪除→卡片移到未分類）、字卡列表（多選後移動、刪除、標會了／還不會）、🔄 翻卡複習（可只看還不會的）、✏️ 小測驗（看中文選英文＋拼字，照段考題庫規則用 `/cards/fixkit.js`：送出、對答案、訂正、補送 1 點、暫存；答錯的字再加進錯題；點數 label `Cards｜分類名`）、🖨️ 印出（左正面右背面，對摺剪下）。
- 各站接法：圖解單字 `topic.html`（單字卡 ☆、三種測驗答錯自動加入）；英文測驗系統 `vocab/vocab.js`（國中2000字單字卡頁 ☆，會自動載入 points.js）、`grammar2/gquiz.js`（單字區測驗答錯自動加入）、`eqfix.js`（每週測驗的單字題 ☆、答錯自動加入）；國家地理閱讀 `points-glue.js`（Vocabulary 卡 ☆、克漏字答錯自動加入）；美式生活館 `engine.js`、`units.html`（場景單字、你要說的、你會聽到的句子 ☆）。段考題庫沒有接（題型不是單字卡）。
- 這個 repo：`cards/cards.js`、`cards/index.html`、`cards/fixkit.js`（國家地理閱讀那份的副本）；`index.html` 右上角多「📇 我的字卡」、`points.js?v=20261117a`；`app/index.html` 多一張「我的字卡」、`sw.js` CACHE 改 `bm-app-v3`。

## 全站字典（2026-11-18 使用者要求，手機雲端版）

- 各單元的英文（文章、文法講解、對話、投影片、單字卡、測驗解答）都能查字典：電腦**點兩下**英文字、手機平板**長按**（選取 1～3 個英文字會出現「🔍 查字典」按鈕）→ 小框顯示中文意思、程度（國中／高中）、原形（went→go、bears→bear）、🔊 發音（瀏覽器語音，沒有語音的裝置不會出錯）、☆ 存字卡、劍橋／Yahoo 外部字典、📖 字典頁、✏️ 自己加字卡（外部字典查到的意思可以貼上、改好再存成字卡）。
- **測驗還沒送出成績時不能查**（跳出「🔒 測驗還沒送出成績，先不能查字典喔！」）；送出後看解答、訂正中可以查（一題一題的英文測驗系統、美式生活館是「這一題還沒送出」不能查）。判斷寫在 `/dict/dict.js` 的 `blocked()`：段考題庫 `#examSubmitBtn`＋body `exam-locked`／`.q.fixing`、文法與單字測驗 `[data-act="submit"]`、每週測驗 `#nextBtn` 的 `data-fk-stage="pick"`、圖解單字 `#go`「送出成績」、fixkit 的 `kit.status==='open'`＋`kit.box`、美式生活館 `.qtop` 那一題的 `button.next` 還沒啟用。**新做的測驗**：照這些既有寫法就會自動擋；不一樣的寫法用 `(window.DictGuard = window.DictGuard || []).push(el => 要擋就回 true)`。不想被查的區塊加 `data-dict-off`。
- 字典資料 `/dict/data/a.json～z.json`（首頁 repo，約 3.6 萬個常用字＋2.8 萬個變化形，共 2.7 MB，查哪個字母才下載那一份）、`zh.json`（中文查英文用）；由首頁 repo `tools/dict/build_dict.py` 從 ECDICT（MIT 授權，`dict/data/LICENSE-ECDICT.txt`）產生，中文用 OpenCC s2twp 轉台灣繁體。
- 字典頁 `/dict/`（首頁右上角「🔍 查字典」、App 入口、我的字卡頁上方都有連結）：輸入英文（列出開頭相同的字）或中文（列出意思裡有這個詞的字）查；「🕘 查詢紀錄」（`/dict/#hist`）看自己查過哪些字、查了幾次，可排序、存字卡、刪除。
- 查詢紀錄：先存這台裝置（localStorage `dictHist:<登入者>`），有登入憑證時批次送到存摺試算表「查詢紀錄」分頁（Code.gs `dictlog／dictlist／dictdel`，`dictQ:<登入者>` 是還沒送出的佇列）。**要重新部署 Apps Script 才會同步到雲端**，沒部署前只記在各裝置。
- 載入方式：`points.js` 會自動載入 `/dict/dict.js?v=20261118a`（7 份副本一致；也開放了 `Points.tokenOf`）；沒載入 points.js 的頁面（文法講解、各種投影片、目錄頁）直接在 `</body>` 前加 `<script src="/dict/dict.js?v=20261118a" defer></script>`。查字典不會跳出登入關卡，按 ☆ 存字卡時才載入 points.js／cards.js。改 dict.js 要把 v 一起改。
- 這個 repo：`dict/dict.js`、`dict/index.html`、`dict/data/`、`tools/dict/build_dict.py`；`index.html` 右上角「🔍 查字典」、`app/index.html` 一張「查字典」、`cards/index.html` 上方連結、`sw.js` CACHE `bm-app-v4`；`cards/fixkit.js` 的 kit 多存 `box`；`points.js?v=20261118a`。

## WORD UP（已購買的網頁版）整合（2026-11-18 手機雲端版）

- 使用者在 WORD UP 網頁版（app.wordup.com.tw）有兩本書：《全民英檢初級單字一本通》（背單字）、《準！GEPT 新制全民英檢初級初試 10 回》（聽力＋閱讀模擬試題，2026-11-18 進度 12%）。使用者說的「全民英檢」就是第二本，也在 WORD UP 裡。
- WORD UP 沒有匯出、沒有 API，題目、中文、例句、音檔有版權，不搬進學習館；做法是放入口連結，加上家長在**電腦**的內建瀏覽器登入後讀取進度（雲端版不能登入使用者的帳號）。
- 已做：首頁卡片「WORD UP｜全民英檢單字＋模擬試題」、App 入口一張（都連到 app.wordup.com.tw，另開分頁，`sw.js` CACHE `bm-app-v5`）；字典小框顯示「🃏 WORD UP 單元名稱＋熟悉度」（讀 `/english-quiz/vocab/wordup/status.json`；學生看自己的，PARENT／TEST 看兩人的；本站測驗答對的字加註「本站測驗已答對」），程式在 `dict/dict.js` 的 `wordupHtml()`，dict.js 內部版本 `V = '20261118b'`。
- **2026-11-18（電腦版）**：兩人的 WORD UP 熟悉度與 GEPT 成績已讀進 english-quiz（`vocab/wordup/status.json`、`gept.json`，成績表在 `/english-quiz/vocab/wordup/` 上方，細節見 english-quiz 的 CLAUDE.md）。首頁（使用者要求）：新增卡片「📊 WORD UP 成績與單字熟悉度」連到 `/english-quiz/vocab/wordup/`（放在 WORD UP 卡片後面、空位卡片前面）；**刪掉「英文聽力高頻句練習」卡片**（和美式生活館都連到 daily_life_listening，重複）。App 入口頁 `app/index.html` 也在 WORD UP 方塊後面加了同樣的「📊 WORD UP 成績與單字熟悉度」方塊，`sw.js` CACHE 改成 `bm-app-v6`。同一天首頁卡片名稱（使用者定）：段考題庫卡片＝「國中段考題庫大全」；英文測驗系統卡片＝「Grammar Course Hub｜文法課程總目錄」（中文保留，英文原本的 English Quiz 和中文對不上），說明改成目前內容（兩期課程、文法 20 單元、2000 字）。
- **單字學習總目錄 `/vocab/`（2026-11-18 使用者要求）**：首頁一張「🔤 Vocabulary Hub｜單字學習總目錄」卡片（取代原本的「圖解單字」「WORD UP｜全民英檢單字＋模擬試題」兩張），點進 `vocab/index.html`：01 圖解單字（/vocab-king/）、02 國中2000字．分科練習（/english-quiz/vocab/）、03 WORD UP（外部，另開分頁）、04 我的字卡（/cards/），下面快速連結：我的字卡、查字典、查詢紀錄。**「📊 WORD UP 成績與單字熟悉度」使用者指定留在首頁**，不放進單字總目錄。新的單字網站之後加在這一頁。App 入口一致：WORD UP 方塊換成 Vocabulary Hub 方塊（我的字卡方塊保留，等於網頁右上角的按鈕），`sw.js` CACHE `bm-app-v7`。
- **App 入口和首頁一致（2026-11-18）**：使用者發現 App 看不到國家地理閱讀；App 方塊改成照首頁卡片順序與名稱：Grammar Course Hub｜文法課程總目錄、Nat-Geo Reading（新加）、Vocabulary Hub、國中段考題庫大全（新加）、美式生活館、WORD UP 成績與單字熟悉度，最後是查字典、我的字卡（工具）。`sw.js` CACHE `bm-app-v8`。**之後首頁新增或改名卡片，App 入口要一起改。**
- 待辦（等使用者選）：① WORD UP 剩下 51 個複習單元（自編內容）② ~~GEPT 10 回成績整理進學習館~~（11-18 已做）③ 自己出題的全民英檢初級形式練習（聽力、閱讀，照段考題庫規則）④ 熟悉度定期更新（電腦）。

## 連續學習紅利＋稱讚畫面（2026-10-18）

- 送出測驗後跳出稱讚卡（得幾點、連續第幾天、還差幾點到 100 點）；每跨過 100 點跳出大的恭喜兌換畫面。
- 連續學習紅利：第 2 天 +2、第 3、4 天 +3、第 5 天起每天 +4（2026-10-18 使用者改），中斷就重算；不算在每天 50 點上限內；存摺分頁記成類型「紅利」。
- **答對率計分（2026-10-18）**：答對 1 題得幾點看答對率（第三版，2026-10-18 使用者定）：低於 30% 0.25、30～50% 0.5、50～60% 0.8、60～70% 1、70～90% 1.2、90% 以上 1.5、全對 2，四捨五入成整數（80～90% 使用者沒另外寫，同 7～8 成）；後端 `Code.gs` 的 `CONFIG.RATE_TIERS`，要重新部署 Apps Script 才生效。
- **段考訂正完成補送 1 點（2026-10-18）**：段考題庫錯題全部訂正完成後 `Points.earn({kind:'fix-bonus'})`，後端 `fixBonus_()` 記一筆類型「訂正獎勵」+`CONFIG.FIX_BONUS`（1）點，同一份考卷每天一次、不算每天上限與連續天數；要重新部署 Apps Script 才生效（舊版後端會當成一般賺點、全對每題 2 點＝給 2 點）。
- 程式在 `points.js`（7 份副本內容一致，主檔在 english-quiz-plan `points/points.js`）與後端 `Code.gs`（`CONFIG.STREAK_BONUS`）。
- **要先更新 Apps Script 後端（貼新版 Code.gs → 部署新版本）紅利才會開始算**，步驟在 english-quiz-plan `points/README-點數存摺.md` 最後一節。

- **GitHub Pages 部署卡住（2026-10-18）**：PR #10 合併後「pages build and deployment」一直排隊／進行中（沒有任何 job），網站停在上一版。處理方式：到 Actions 取消那次部署，再推一個新的 commit 到 main（例如更新這份 CLAUDE.md）觸發新的部署；單純 Re-run 那次不一定會好。查部署狀態：Actions → pages build and deployment。


## 寫作園地（2026-11-21）

- 首頁卡片「Writing Hub｜寫作園地」→ `/english-quiz/writing/`（內容在 english-quiz repo，說明見那邊 CLAUDE.md「寫作園地」一節）。
- 這個 repo 的 `functions/api/write-check.js`：登入者送短文 → LanguageTool 文法拼字＋Cloudflare Workers AI 老師建議（綁定名稱 `AI`，沒綁定時回 `aiReady:false`）。開啟步驟在 `CLOUDFLARE-SETUP.md` 第九節（家長自己在 Cloudflare 後台操作）。
- 同一天：`cards/index.html` 播放支援英文測驗系統的合併音檔（`all.mp3#t=`），舊字卡的小音檔路徑會查 `all.json` 對應。