[![Netlify Status](https://api.netlify.com/api/v1/badges/e719ef59-2a5b-4a35-b619-c01d690ab537/deploy-status)](https://app.netlify.com/projects/tw-nav-checker/deploys)
# 基金即時估值 (Taiwan Fund Live NAV Estimator)

每天想買基金前，不用再手動把基金的股票組成一檔檔輸入看盤 App。
搜尋基金，它會自動抓取該基金**最新揭露的前十大持股與權重**，拉**台股即時報價**，
算出「今日估算漲跌」，幫你判斷當天要不要進場。持股每月自動更新，不會再過期。

手機開網頁即可看，也可「加入主畫面」當成 App 使用。

## 功能

- **首頁**：上方顯示**加權指數 / 櫃買指數**即時行情；下方「常用」排行榜列出你加入最愛的
  基金，依今日估算漲跌排序，可切換**漲幅 / 跌幅**。
- **搜尋基金**：打名稱或代碼（例：「安聯台灣科技」或 `ACDD04`），即時帶出結果。
- **基金頁**：
  - **今日估算漲跌** — 依已揭露前十大持股加權即時股價計算。
  - **大盤對比** — 顯示大盤今日漲跌，以及本基金「估算相對」大盤多少。
  - **官方淨值** — 最新公告淨值、日期與當日變化。
  - **淨值走勢圖** — 近 1 月 / 3 月 / 6 月 / 1 年的每日淨值走勢（純 SVG，無外部套件）。
  - **持股明細** — 前十大個股：權重、現價、漲跌、對估算的貢獻。
  - **基金資料** — 近 1 月～5 年報酬、晨星評等、風險等級、經理費、規模、幣別、成立日。
  - **估算準確度** — 累積「估算 vs 官方淨值」的平均誤差（存在你的裝置，用久了才會出現）。
- **常用清單（側邊抽屜）**：點 ★ 加入；抽屜列出各基金**淨值**（每次開啟時更新）與今日估算。
- **深 / 淺色**：跟隨系統，可手動切換。
- **PWA**：可安裝到主畫面、離線可開啟外殼（即時資料仍需連線）。

## 運作方式

1. **持股**：從 MoneyDJ（嘉實資訊）抓各基金每月揭露的前十大持股明細（Big5 解碼）。
2. **股名對代碼**：用證交所 ISIN 名單把中文股名對到上市 / 上櫃代碼。
3. **即時報價**：從證交所 MIS 批次抓持股股價，依權重加權算出**今日估算漲跌 %**。
4. **淨值 / 走勢 / 基金資料**：官方淨值來自 MoneyDJ；淨值歷史與基金資料來自鉅亨網
   （以基金名稱對到鉅亨基金代碼，名稱↔代碼索引取自鉅亨 sitemap）。
5. **大盤**：加權 / 櫃買指數來自證交所 MIS。

## 限制（重要）

基金公司每月只揭露**前十大持股**（約占淨值 50–70%），不是完整投資組合。
所以「今日估算漲跌」是一個**方向性估算**，不等於基金公司公告的正式淨值 —
但前幾大持股通常主導當日漲跌，足以判斷「今天大概是紅還是綠」。
畫面上會顯示「估算涵蓋」讓你知道涵蓋多少。**估算僅在台股交易時間內有意義**，
非交易時間各數字會貼近前一日收盤。

## 執行

```bash
npm install
npm start
```

- 電腦：開 http://localhost:3000
- 手機（同一個 Wi-Fi）：開 `http://<你電腦的區網IP>:3000`（例如 http://192.168.0.139:3000）
- 手機瀏覽器選「加入主畫面」即可當 App 用。

> 啟動時會在背景建立索引並快取到 `data/`：約 4,400 檔基金的**名稱↔代碼**（搜尋用）、
> 約 38,000 檔股票的**股名↔代碼**（估算用）、以及約 5,600 檔基金的**名稱↔鉅亨代碼**
> （淨值走勢用），所以查詢很快、部署時 serverless 冷啟也不會逐次重抓。
> `npm run build:index` 可手動預先建立（部署時會自動執行）。

## API

| 路徑 | 說明 |
| --- | --- |
| `GET /api/search?q=` | 基金名稱 / 代碼搜尋建議 |
| `GET /api/fund/:code` | 單一基金：持股＋即時估算＋官方淨值＋基金資料＋大盤 |
| `GET /api/estimates?codes=A,B` | 多檔基金的輕量估算＋淨值（常用清單 / 排行用） |
| `GET /api/navhistory?name=` | 每日淨值序列（鉅亨） |
| `GET /api/market` | 加權 / 櫃買指數即時 |

## 結構

```
server/
  index.js       Express 進入點（本機 / 自架）
  app.js         路由（本機與 Netlify Function 共用）
  http.js        帶逾時的 fetch（避免慢速上游拖垮 serverless function）
  holdings.js    抓 & 解析 MoneyDJ 持股明細（Big5）
  stocks.js      證交所 ISIN 名單 → 中文股名對代碼（預建並快取到 data/）
  prices.js      證交所 MIS 即時報價（去重、分批、逾時）
  nav.js         MoneyDJ 官方淨值
  estimate.js    核心估算（單檔 computeFund / 多檔 computeMany）
  fundindex.js   MoneyDJ 全站基金名稱↔代碼索引（搜尋）
  cnyesindex.js  鉅亨 sitemap 名稱↔鉅亨代碼索引（淨值走勢 / 基金資料）
  navhistory.js  鉅亨每日淨值序列 + 基金資料（快取）
  market.js      加權 / 櫃買指數
public/          手機版單頁前端 + PWA（index.html / app.js / styles.css /
                 tokens.css / manifest.webmanifest / sw.js / icon-*.png）
scripts/         build-index.mjs（預建索引：基金搜尋、股名對代碼、鉅亨對應）
data/            fund-index.json / stock-map.json / cnyes-index.json（快取，已提交供部署）
netlify/functions/api.mjs   以 serverless-http 包裝 Express app
```

## 部署

已部署於 Netlify。前端為靜態，API 以單一 Netlify Function（`serverless-http`
包裝同一個 Express app）提供；`/api/*` 由 `netlify.toml` 轉址過去。
詳見 [DEPLOY_NETLIFY.md](DEPLOY_NETLIFY.md)。

## 資料來源

- 持股 / 官方淨值：MoneyDJ 理財網（嘉實資訊）`www.moneydj.com`
- 股名對代碼、即時報價、大盤：證券交易所 `isin.twse.com.tw`、`mis.twse.com.tw`
- 淨值走勢 / 基金資料：鉅亨網 `api.cnyes.com`、`fund.cnyes.com`

僅供個人參考，非投資建議；報價與淨值以官方公告為準。
本工具擷取第三方網站資料，適合個人使用，不宜承載大量流量。
