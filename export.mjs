import { Database } from "duckdb-async";
import fs from 'fs';

const DB_PATH = "steam.ddb";
const OUTPUT_PATH = "data.json";

const db = await Database.create(DB_PATH);

// 当前价格
const rows = await db.all("SELECT * FROM main.games ORDER BY uuid");

// 价格历史
let historyRows;
try {
  historyRows = await db.all("SELECT * FROM price_history ORDER BY uuid, record_date");
} catch {
  historyRows = [];
  console.warn("price_history table not found, no history data");
}

await db.close();

// 构建历史索引 { appid: [{date, original_price, final_price, pct, price_label}] }
const historyMap = {};
for (const row of historyRows) {
  const key = row.uuid;
  if (!historyMap[key]) historyMap[key] = [];
  historyMap[key].push({
    date: row.record_date,
    original_price: decodePrice(row.original_price),
    final_price: decodePrice(row.final_price),
    pct: decodePct(row.pct_price),
    label: row.price_label,
  });
}

// 去重：同一天只保留一条
for (const key of Object.keys(historyMap)) {
  const deduped = [];
  for (const entry of historyMap[key]) {
    const day = entry.date.slice(0, 10);
    if (deduped.length === 0 || deduped[deduped.length - 1].date.slice(0, 10) !== day) {
      deduped.push(entry);
    } else {
      deduped[deduped.length - 1] = entry; // 覆盖为当天最新
    }
  }
  historyMap[key] = deduped;
}

const data = rows.map(row => ({
  appid: row.uuid,
  name: row.name,
  img: row.img,
  imgsrc: row.imgsrc,
  platform: decodePlatform(row.platform),
  release_date: row.release_date,
  original_price: decodePrice(row.original_price),
  final_price: decodePrice(row.final_price),
  pct: decodePct(row.pct_price),
  review: decodeReview(row.review),
  review_label: row.review_label,
  steam_deck: row.steam_deck_support,
  updated: row.update_date,
  history: historyMap[row.uuid] || [],
}));

function decodePlatform(bits) {
  const flags = [];
  if (bits & 0b10) flags.push("win");
  if (bits & 0b01) flags.push("mac");
  return flags;
}

function decodePrice(val) {
  if (val === null || val === undefined) return null;
  return (val / 100).toFixed(2);
}

function decodePct(code) {
  if (code === 0) return 0;
  if (code === 127) return "free";
  if (code === 126) return "noprice";
  if (code === 125) return "overflow";
  if (code >= 100) return "overflow";
  return -code;
}

function decodeReview(code) {
  if (code === 1) return "positive";
  if (code === 0) return "mixed";
  if (code === -1) return "negative";
  return "none";
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 0), 'utf8');
console.log(`Exported ${data.length} apps to ${OUTPUT_PATH}`);
