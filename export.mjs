import { Database } from "duckdb-async";
import fs from 'fs';

const DB_PATH = "steam.ddb";
const OUTPUT_PATH = "data.json";

const db = await Database.create(DB_PATH);
const rows = await db.all("SELECT * FROM main.games ORDER BY uuid");
await db.close();

// Transform data for web consumption
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
  return -code; // negative = discount percentage
}

function decodeReview(code) {
  if (code === 1) return "positive";
  if (code === 0) return "mixed";
  if (code === -1) return "negative";
  return "none";
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 0), 'utf8');
console.log(`Exported ${data.length} apps to ${OUTPUT_PATH}`);
