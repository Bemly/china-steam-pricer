import fs from 'fs';

const HTML_PATH = "index.html";

// ========== 全部 JS 放在一个 module script 里 ==========
const pageJS = [
"import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';",
"",
"// ---- DuckDB WASM 加载 ----",
"const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();",
"const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);",
"const worker_url = URL.createObjectURL(",
"  new Blob(['importScripts(\"' + bundle.mainWorker + '\");'], {type: 'text/javascript'}));",
"const worker = new Worker(worker_url);",
"const logger = new duckdb.ConsoleLogger();",
"const db = new duckdb.AsyncDuckDB(logger, worker);",
"await db.instantiate(bundle.mainModule, bundle.pthreadWorker);",
"URL.revokeObjectURL(worker_url);",
"",
"const res = await fetch('steam.ddb');",
"const buf = await res.arrayBuffer();",
"await db.registerFileBuffer('steam.ddb', new Uint8Array(buf));",
"const conn = await db.connect();",
"await conn.query(\"ATTACH 'steam.ddb' AS db (READ_ONLY)\");",
"",
"const gamesResult = await conn.query('SELECT * FROM db.main.games ORDER BY uuid');",
"const historyResult = await conn.query('SELECT * FROM db.price_history ORDER BY uuid, record_date').catch(() => ({numRows:0, toArray:()=>[]}));",
"",
"// ---- 解码函数 ----",
"function decodePlatform(bits) {",
"  const flags = [];",
"  if (bits & 0b10) flags.push('win');",
"  if (bits & 0b01) flags.push('mac');",
"  return flags;",
"}",
"function decodePrice(val) {",
"  if (val === null || val === undefined || isNaN(val)) return null;",
"  return (val / 100).toFixed(2);",
"}",
"function decodePct(code) {",
"  if (code === 0) return 0;",
"  if (code === 127) return 'free';",
"  if (code === 126) return 'noprice';",
"  if (code === 125) return 'overflow';",
"  if (code >= 100) return 'overflow';",
"  return -code;",
"}",
"function decodeReview(code) {",
"  if (code === 1) return 'positive';",
"  if (code === 0) return 'mixed';",
"  if (code === -1) return 'negative';",
"  return 'none';",
"}",
"",
"// ---- 解析数据 ----",
"const games = gamesResult.toArray().map(r => ({",
"  appid: Number(r.uuid),",
"  name: r.name,",
"  img: r.img,",
"  imgsrc: r.imgsrc,",
"  platform: decodePlatform(Number(r.platform)),",
"  release_date: r.release_date,",
"  original_price: decodePrice(Number(r.original_price)),",
"  final_price: decodePrice(Number(r.final_price)),",
"  pct: decodePct(Number(r.pct_price)),",
"  review: decodeReview(Number(r.review)),",
"  review_label: r.review_label,",
"  steam_deck: Boolean(r.steam_deck_support),",
"  updated: String(r.update_date).slice(0, 10),",
"  history: [],",
"}));",
"",
"const historyMap = {};",
"if (historyResult.numRows > 0) {",
"  const rows = historyResult.toArray();",
"  for (const r of rows) {",
"    const key = Number(r.uuid);",
"    if (!historyMap[key]) historyMap[key] = [];",
"    const d = new Date(r.record_date);",
"    if (!isNaN(d.getTime())) {",
"      historyMap[key].push({",
"        date: d.toISOString(),",
"        original_price: decodePrice(Number(r.original_price)),",
"        final_price: decodePrice(Number(r.final_price)),",
"        pct: decodePct(Number(r.pct_price)),",
"      });",
"    }",
"  }",
"  for (const key of Object.keys(historyMap)) {",
"    const deduped = [];",
"    for (const entry of historyMap[key]) {",
"      const day = entry.date.slice(0, 10);",
"      if (deduped.length === 0 || deduped[deduped.length - 1].date.slice(0, 10) !== day) {",
"        deduped.push(entry);",
"      } else {",
"        deduped[deduped.length - 1] = entry;",
"      }",
"    }",
"    historyMap[key] = deduped;",
"  }",
"}",
"for (const g of games) {",
"  g.history = historyMap[g.appid] || [];",
"}",
"",
"const updateDate = games.length > 0 ? games.reduce((a, b) => a.updated > b.updated ? a : b).updated : 'unknown';",
"document.getElementById('total').textContent = games.length;",
"document.getElementById('total2').textContent = games.length;",
"document.getElementById('date').textContent = updateDate;",
"",
"// ========== App 逻辑 ==========",
"const DATA = games;",
"const REVIEW_LABELS = {positive:'好评',mixed:'褒贬不一',negative:'差评',none:'无评价'};",
"let filtered = DATA.slice();",
"",
"function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }",
"",
"function renderList() {",
"  const el = document.getElementById('list');",
"  const nodata = document.getElementById('nodata');",
"  const showing = document.getElementById('showing');",
"  el.innerHTML = '';",
"  showing.textContent = filtered.length;",
"  if (filtered.length === 0) { nodata.style.display = 'block'; return; }",
"  nodata.style.display = 'none';",
"  const frag = document.createDocumentFragment();",
"  const limit = Math.min(filtered.length, 500);",
"  for (let i = 0; i < limit; i++) {",
"    const g = filtered[i];",
"    const card = document.createElement('div');",
"    card.className = 'card';",
"    const disc = (g.pct === 'free' || g.pct === 0) ? '' : '<span class=\"discount\">' + (typeof g.pct === 'number' ? g.pct + '%' : '') + '</span>';",
"    let priceHTML = '';",
"    if (g.pct === 'free') {",
"      priceHTML = '<span class=\"price-free\">免费</span>';",
"    } else if (g.pct === 'noprice') {",
"      priceHTML = '<span style=\"color:#62727e;font-size:12px\">暂无价格</span>';",
"    } else {",
"      const op = g.original_price ? ('<span class=\"price-original\">¥' + g.original_price + '</span>') : '';",
"      priceHTML = disc + op + '<span class=\"price-final\">¥' + g.final_price + '</span>';",
"    }",
"    const tags = [];",
"    if (g.platform.indexOf('win') !== -1) tags.push('<span class=\"tag win\">Win</span>');",
"    if (g.steam_deck) tags.push('<span class=\"tag\">Deck</span>');",
"    if (g.review !== 'none') tags.push('<span class=\"tag review-' + g.review + '\">' + REVIEW_LABELS[g.review] + '</span>');",
"    card.innerHTML = '<img src=\"' + (g.imgsrc || g.img || '') + '\" alt=\"\" loading=\"lazy\"><div class=\"info\"><div class=\"name\">' + esc(g.name) + '<span class=\"appid\">#' + g.appid + '</span></div><div class=\"tags\">' + tags.join('') + '</div><div class=\"price-row\">' + priceHTML + '</div></div>';",
"    card.onclick = () => showModal(g);",
"    frag.appendChild(card);",
"  }",
"  if (filtered.length > 500) {",
"    const more = document.createElement('div');",
"    more.style.cssText = 'text-align:center;padding:16px;color:#62727e;font-size:13px;grid-column:1/-1';",
"    more.textContent = '仅显示前500条结果，请使用筛选缩小范围';",
"    frag.appendChild(more);",
"  }",
"  el.appendChild(frag);",
"}",
"",
"function applyFilters() {",
"  const q = document.getElementById('search').value.trim().toLowerCase();",
"  const pf = document.getElementById('platform').value;",
"  const df = document.getElementById('discount').value;",
"  const rf = document.getElementById('review').value;",
"  const sf = document.getElementById('sort').value;",
"  filtered = DATA.filter(g => {",
"    if (q && !(g.name.toLowerCase().indexOf(q) !== -1 || String(g.appid).indexOf(q) !== -1)) return false;",
"    if (pf && g.platform.indexOf(pf) === -1) return false;",
"    if (df === 'free' && g.pct !== 'free') return false;",
"    if (df === 'sale' && (!g.pct || g.pct === 0 || typeof g.pct !== 'number')) return false;",
"    if (df === 'nosale' && (g.pct !== 'free' && g.pct !== 0 && typeof g.pct !== 'number')) return false;",
"    if (df === 'noprice' && g.pct !== 'noprice') return false;",
"    if (rf && g.review !== rf) return false;",
"    return true;",
"  });",
"  const parts = sf.split('-');",
"  const field = parts[0], dir = parts[1];",
"  filtered.sort((x, y) => {",
"    let r = 0;",
"    if (field === 'name') r = x.name.localeCompare(y.name, 'zh');",
"    else if (field === 'appid') r = x.appid - y.appid;",
"    else if (field === 'price') r = parseFloat(x.final_price || 0) - parseFloat(y.final_price || 0);",
"    else if (field === 'discount') r = (typeof x.pct === 'number' ? x.pct : 0) - (typeof y.pct === 'number' ? y.pct : 0);",
"    return dir === 'desc' ? -r : r;",
"  });",
"  renderList();",
"}",
"",
"// ---- Modal ----",
"const overlay = document.getElementById('modalOverlay');",
"const titleEl = document.getElementById('modalTitle');",
"const metaEl = document.getElementById('modalMeta');",
"const chartEl = document.getElementById('modalChart');",
"const closeBtn = document.getElementById('modalClose');",
"",
"function showModal(game) {",
"  titleEl.textContent = game.name;",
"  metaEl.textContent = 'AppID: ' + game.appid + ' | 平台: ' + (game.platform.join(', ') || '未知') + ' | 更新于 ' + game.updated;",
"  if (!game.history || game.history.length < 2) {",
"    chartEl.innerHTML = '<div class=\"no-history\">暂无价格历史数据（需要至少两次抓取后才显示）</div>';",
"  } else {",
"    chartEl.innerHTML = drawChart(game.history, game.original_price, game.final_price);",
"    initChartTooltip();",
"  }",
"  overlay.classList.add('active');",
"}",
"",
"function hideModal() { overlay.classList.remove('active'); }",
"closeBtn.onclick = hideModal;",
"overlay.onclick = (e) => { if (e.target === overlay) hideModal(); };",
"document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideModal(); });",
"",
"// ---- Chart ----",
"function drawChart(history, currentOrig, currentFinal) {",
"  const current = { date: new Date().toISOString(), original_price: currentOrig, final_price: currentFinal };",
"  const points = history.concat([current]);",
"  const W = 720, H = 220, PADT = 20, PADR = 20, PADB = 30, PADL = 50;",
"  const cw = W - PADL - PADR, ch = H - PADT - PADB;",
"  const prices = points.map(p => ({ date: p.date.slice(0,10), final: parseFloat(p.final_price || 0), orig: parseFloat(p.original_price || 0) }));",
"  let maxP = 0;",
"  for (let i = 0; i < prices.length; i++) {",
"    if (prices[i].final > maxP) maxP = prices[i].final;",
"    if (prices[i].orig > maxP) maxP = prices[i].orig;",
"  }",
"  maxP = Math.max(maxP * 1.1, 10);",
"  const yTicks = [];",
"  const step = Math.ceil(maxP / 5);",
"  for (let i = 0; i <= maxP; i += step) yTicks.push(i);",
"  function xScale(i) { return PADL + (i / (prices.length - 1)) * cw; }",
"  function yScale(v) { return PADT + ch - (v / maxP) * ch; }",
"  const xLabels = [];",
"  const labelStep = Math.max(1, Math.floor(prices.length / 6));",
"  for (let i = 0; i < prices.length; i += labelStep) {",
"    xLabels.push('<text x=\"' + xScale(i) + '\" y=\"' + (H - 5) + '\" text-anchor=\"middle\" fill=\"#8f98a0\" font-size=\"10\">' + prices[i].date + '</text>');",
"  }",
"  const yLabels = yTicks.map(v => '<text x=\"' + (PADL - 6) + '\" y=\"' + (yScale(v) + 4) + '\" text-anchor=\"end\" fill=\"#8f98a0\" font-size=\"10\">' + v.toFixed(0) + '</text>');",
"  const gridLines = yTicks.map(v => '<line x1=\"' + PADL + '\" y1=\"' + yScale(v) + '\" x2=\"' + (PADL + cw) + '\" y2=\"' + yScale(v) + '\" stroke=\"#2a3a4a\" stroke-width=\"0.5\"/>');",
"  const finalDots = prices.map((p, i) => '<circle cx=\"' + xScale(i) + '\" cy=\"' + yScale(p.final) + '\" r=\"3\" fill=\"#acdbf5\"/>');",
"  const hasOrig = prices.some(p => p.orig > 0 && p.orig !== p.final);",
"  const origDots = hasOrig ? prices.map((p, i) => '<circle cx=\"' + xScale(i) + '\" cy=\"' + yScale(p.orig) + '\" r=\"2.5\" fill=\"#738895\"/>') : [];",
"  const hitAreas = prices.map((p, i) => '<circle cx=\"' + xScale(i).toFixed(1) + '\" cy=\"' + yScale(p.final).toFixed(1) + '\" r=\"12\" fill=\"transparent\" class=\"chart-hit\" data-i=\"' + i + '\"/>').join('');",
"  const pts = prices.map((p, i) => xScale(i).toFixed(1) + ',' + yScale(p.final).toFixed(1)).join(' ');",
"  const origPts = hasOrig ? prices.map((p, i) => xScale(i).toFixed(1) + ',' + yScale(p.orig).toFixed(1)).join(' ') : '';",
"  let svg = '<svg viewBox=\"0 0 ' + W + ' ' + H + '\" xmlns=\"http://www.w3.org/2000/svg\">';",
"  svg += '<rect x=\"' + PADL + '\" y=\"' + PADT + '\" width=\"' + cw + '\" height=\"' + ch + '\" fill=\"#1b2838\"/>';",
"  svg += gridLines.join('') + yLabels.join('') + xLabels.join('');",
"  svg += '<polyline points=\"' + pts + '\" fill=\"none\" stroke=\"#acdbf5\" stroke-width=\"2\" stroke-linejoin=\"round\"/>';",
"  if (hasOrig) svg += '<polyline points=\"' + origPts + '\" fill=\"none\" stroke=\"#738895\" stroke-width=\"1.5\" stroke-dasharray=\"4,3\" stroke-linejoin=\"round\"/>';",
"  svg += finalDots.join('');",
"  if (hasOrig) svg += origDots.join('');",
"  svg += hitAreas + '</svg>';",
"  let legend = '<div class=\"chart-legend\">';",
"  legend += '<span><span class=\"dot\" style=\"background:#acdbf5\"></span> 现价</span>';",
"  if (hasOrig) legend += '<span><span class=\"dot\" style=\"background:#738895\"></span> 原价</span>';",
"  legend += '</div>';",
"  // 用 base64 编码价格数据，避免任何转义问题",
"  const dataB64 = btoa(JSON.stringify(prices));",
"  let html = '<div class=\"chart-container\" style=\"position:relative\" data-prices-b64=\"' + dataB64 + '\">' + svg;",
"  html += '<div class=\"chart-tooltip\" id=\"chartTooltip\"></div>' + legend + '</div>';",
"  return html;",
"}",
"",
"function initChartTooltip() {",
"  setTimeout(() => {",
"    const c = document.querySelector('.chart-container');",
"    if (!c) return;",
"    const t = document.getElementById('chartTooltip');",
"    const s = c.querySelector('svg');",
"    let prices;",
"    try {",
"      prices = JSON.parse(atob(c.getAttribute('data-prices-b64')));",
"    } catch(e) { return; }",
"    function gs() { const r = s.getBoundingClientRect(), v = s.viewBox.baseVal; return { x: r.width / v.width, y: r.height / v.height }; }",
"    function st(el) {",
"      const i = parseInt(el.getAttribute('data-i'));",
"      const p = prices[i];",
"      if (!p) return;",
"      const sc = gs();",
"      const cx = parseFloat(el.getAttribute('cx')) * sc.x;",
"      const cy = parseFloat(el.getAttribute('cy')) * sc.y;",
"      let h = p.date + '<br>现价: ¥' + p.final.toFixed(2);",
"      if (p.orig > 0) h += '<br>原价: ¥' + p.orig.toFixed(2);",
"      t.innerHTML = h;",
"      t.classList.add('visible');",
"      const sr = s.getBoundingClientRect();",
"      const cr = c.getBoundingClientRect();",
"      const tw = t.offsetWidth, th = t.offsetHeight;",
"      let tx = cx + sr.left - cr.left - tw / 2;",
"      let ty = cy + sr.top - cr.top - th - 10;",
"      if (ty < 0) ty = cy + sr.top - cr.top + 15;",
"      if (tx < 0) tx = 4;",
"      if (tx + tw > cr.width) tx = cr.width - tw - 4;",
"      t.style.left = tx + 'px';",
"      t.style.top = ty + 'px';",
"    }",
"    c.querySelectorAll('.chart-hit').forEach(el => {",
"      el.addEventListener('mouseenter', () => st(el));",
"      el.addEventListener('touchstart', (e) => { st(el); e.preventDefault(); }, { passive: false });",
"      el.addEventListener('touchend', () => { setTimeout(() => t.classList.remove('visible'), 1500); });",
"      el.addEventListener('mouseleave', () => t.classList.remove('visible'));",
"    });",
"    document.addEventListener('touchstart', (e) => { if (!c.contains(e.target)) t.classList.remove('visible'); });",
"  }, 100);",
"}",
"",
"// ---- 事件绑定 ----",
"document.getElementById('search').addEventListener('input', debounce(applyFilters, 200));",
"document.getElementById('platform').addEventListener('change', applyFilters);",
"document.getElementById('discount').addEventListener('change', applyFilters);",
"document.getElementById('review').addEventListener('change', applyFilters);",
"document.getElementById('sort').addEventListener('change', applyFilters);",
"",
"function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(() => fn(), ms); }; }",
"",
"// ---- 启动 ----",
"applyFilters();",
].join('\n');

// ========== 拼接 HTML ==========
var html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'<title>蒸汽平台价格查询</title>\n' +
'<script type="module">\n' + pageJS + '\n</' + 'script>\n' +
'<style>\n' +
'*{margin:0;padding:0;box-sizing:border-box}\n' +
'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#1b2838;color:#c6d4df;min-height:100vh}\n' +
'.header{background:linear-gradient(135deg,#1b2838 0%,#2a475e 100%);padding:16px 24px;border-bottom:1px solid #000}\n' +
'.header h1{color:#fff;font-size:20px;margin-bottom:8px}\n' +
'.header .meta{font-size:12px;color:#8f98a0}\n' +
'.controls{display:flex;gap:8px;padding:12px 24px;flex-wrap:wrap;background:#171a21;position:sticky;top:0;z-index:100;border-bottom:1px solid #000}\n' +
'.controls input,.controls select{background:#32353c;color:#c6d4df;border:1px solid #4c545e;border-radius:3px;padding:6px 10px;font-size:13px;outline:none}\n' +
'.controls input:focus,.controls select:focus{border-color:#66c0f4}\n' +
'.controls input[type="text"]{width:260px;flex-grow:1;max-width:400px}\n' +
'.controls select{cursor:pointer}\n' +
'.stats{padding:8px 24px;font-size:12px;color:#8f98a0;background:#171a21}\n' +
'.stats span{color:#66c0f4;font-weight:bold}\n' +
'.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px;padding:12px 24px}\n' +
'.card{display:flex;gap:10px;background:#1e2a38;border:1px solid #000;border-radius:4px;padding:10px;cursor:pointer;transition:border-color .15s}\n' +
'.card:hover{border-color:#66c0f4}\n' +
'.card img{width:120px;height:45px;object-fit:cover;border-radius:2px;flex-shrink:0;background:#000}\n' +
'.card .info{flex:1;min-width:0}\n' +
'.card .name{color:#c6d4df;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px}\n' +
'.card .name .appid{color:#62727e;font-size:11px;margin-left:4px}\n' +
'.card .tags{display:flex;gap:4px;margin-bottom:4px;flex-wrap:wrap}\n' +
'.card .tag{font-size:10px;padding:1px 5px;border-radius:2px;background:#32353c;color:#8f98a0}\n' +
'.card .tag.win{background:#1a3a5c;color:#66c0f4}\n' +
'.card .review-positive{color:#a3cf00}\n' +
'.card .review-mixed{color:#e5e621}\n' +
'.card .review-negative{color:#c94846}\n' +
'.price-row{display:flex;align-items:center;gap:6px;margin-top:4px}\n' +
'.discount{background:#4c6b22;color:#a3cf00;font-size:12px;font-weight:bold;padding:1px 4px;border-radius:2px}\n' +
'.price-original{color:#738895;font-size:11px;text-decoration:line-through}\n' +
'.price-final{color:#acdbf5;font-size:14px;font-weight:bold}\n' +
'.price-free{color:#a3cf00;font-size:13px;font-weight:bold}\n' +
'.no-data{text-align:center;padding:60px 24px;color:#62727e;font-size:16px}\n' +
'.modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s}\n' +
'.modal-overlay.active{opacity:1;pointer-events:all}\n' +
'.modal{background:#1e2a38;border:1px solid #000;border-radius:8px;max-width:800px;width:92%;max-height:90vh;overflow-y:auto;padding:20px;position:relative}\n' +
'.modal-close{position:absolute;top:12px;right:16px;background:none;border:none;color:#8f98a0;font-size:22px;cursor:pointer}\n' +
'.modal-close:hover{color:#fff}\n' +
'.modal h2{color:#fff;font-size:16px;margin-bottom:4px;padding-right:30px}\n' +
'.modal .modal-meta{font-size:12px;color:#8f98a0;margin-bottom:12px}\n' +
'.chart-container{width:100%;margin:12px 0;background:#171a21;border-radius:4px;padding:8px}\n' +
'.chart-container svg{width:100%;height:auto}\n' +
'.chart-tooltip{position:absolute;background:#2a475e;color:#fff;font-size:11px;padding:5px 9px;border-radius:4px;pointer-events:none;opacity:0;transition:opacity .12s;white-space:nowrap;z-index:10;border:1px solid #66c0f4;line-height:1.5}\n' +
'.chart-tooltip.visible{opacity:1}\n' +
'.chart-legend{display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:11px;color:#8f98a0}\n' +
'.chart-legend span{display:flex;align-items:center;gap:4px}\n' +
'.chart-legend .dot{width:10px;height:3px;border-radius:1px;display:inline-block}\n' +
'.no-history{text-align:center;padding:20px;color:#62727e;font-size:13px}\n' +
'.loading{text-align:center;padding:60px 24px;color:#66c0f4;font-size:16px}\n' +
'</style>\n' +
'</head>\n<body>\n' +
'<div class="header">\n' +
'  <h1>蒸汽平台价格查询</h1>\n' +
'  <div class="meta">共 <span id="total">--</span> 款游戏 · 数据更新于 <span id="date">--</span></div>\n' +
'</div>\n' +
'<div class="controls">\n' +
'  <input type="text" id="search" placeholder="搜索游戏名称或 AppID..." />\n' +
'  <select id="platform"><option value="">全部平台</option><option value="win">Windows</option></select>\n' +
'  <select id="discount"><option value="">折扣筛选</option><option value="free">免费</option><option value="sale">正在打折</option><option value="nosale">未打折</option><option value="noprice">暂无价格</option></select>\n' +
'  <select id="review"><option value="">评价筛选</option><option value="positive">好评</option><option value="mixed">褒贬不一</option><option value="negative">差评</option><option value="none">无评价</option></select>\n' +
'  <select id="sort"><option value="name">按名称排序</option><option value="appid-desc">AppID 降序</option><option value="appid-asc">AppID 升序</option><option value="price-asc">价格低到高</option><option value="price-desc">价格高到低</option><option value="discount-desc">折扣力度</option></select>\n' +
'</div>\n' +
'<div class="stats">显示 <span id="showing">--</span> / <span id="total2">--</span> 款</div>\n' +
'<div class="list" id="list"></div>\n' +
'<div class="no-data" id="nodata" style="display:none">没有找到匹配的游戏</div>\n' +
'<div class="modal-overlay" id="modalOverlay">\n' +
'  <div class="modal">\n' +
'    <button class="modal-close" id="modalClose">&times;</button>\n' +
'    <h2 id="modalTitle"></h2>\n' +
'    <div class="modal-meta" id="modalMeta"></div>\n' +
'    <div id="modalChart"></div>\n' +
'  </div>\n' +
'</div>\n' +
'<scr' + 'ipt>\n' +
"var listEl=document.getElementById('list');\n" +
"listEl.innerHTML='<div class=\\\"loading\\\">正在加载 DuckDB WASM 和数据库...</div>';\n" +
"setTimeout(function(){\n" +
"  if(listEl.querySelector('.loading')){\n" +
"    listEl.innerHTML='<div class=\\\"no-data\\\">加载超时，请检查网络后刷新页面<br><button onclick=\\\"location.reload()\\\" style=\\\"margin-top:12px;padding:8px 20px;background:#66c0f4;color:#1b2838;border:none;border-radius:4px;cursor:pointer;font-size:14px\\\">重新加载</button></div>';\n" +
"  }\n" +
"},5000);\n" +
'</scr' + 'ipt>\n' +
'</body>\n</html>';

fs.writeFileSync(HTML_PATH, html, 'utf8');
console.log('Built ' + HTML_PATH);
