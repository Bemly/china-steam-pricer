# ChinaSteamPricer

蒸汽平台价格历史查询工具

## 使用技术栈 Dependent

- **Github Actions** — 每日自动更新
- **Node.js v20** (target 20, minium 18)
- **cheerio**
  - npm 上有名的 jQuery $ 处理语法 DOM 解释器
  - The famous jQuery $ processing syntax DOM interpreter on npm
- **json5**
  - 类似微软用在 tsconfig 的 JSONC ，支持 json 注释
  - json5 is similar to JSONC used by Microsoft in tsconfig.json, supporting json comments
- **duckDB**
  - 一款支持 Node.js WASM Rust 等多种语言的 类PostgreSQL方言 袖珍嵌入式数据库
  - duckDB is a PostgreSQL-like dialect pocket embedded database that supports multiple languages such as Node.js WASM Rust
- **duckdb-async**
  - 不支持加密，嵌套类型 Update 语法和唯一键/主键冲突
  - duckdb-async does not support encryption, nested type Update syntax and unique key/primary key conflicts

## 使用 Usage

### 在线查询

直接访问本仓库的 GitHub Pages 页面即可查看最新价格数据。

### 本地运行

```bash
npm install
npm run full
```

### 脚本说明

| 命令 | 说明 |
|------|------|
| `npm run update-list` | 编译 TypeScript 并爬取蒸汽平台价格 |
| `npm run export` | 将 DuckDB 数据导出为 data.json |
| `npm run build` | 生成查询页面 index.html |
| `npm run full` | 依次执行以上三步 |

## 数据文件

| 文件 | 说明 |
|------|------|
| `steam.ddb` | DuckDB 数据库（价格历史） |
| `data.json` | 导出的 JSON 数据 |
| `index.html` | 价格查询页面 |

## GitHub Actions

工作流每天 UTC 02:00（北京时间 10:00）自动运行，也支持手动触发（Actions → Update Steam China Prices → Run workflow）。
