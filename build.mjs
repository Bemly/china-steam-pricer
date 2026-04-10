import fs from 'fs';

const DATA_PATH = "data.json";
const HTML_PATH = "index.html";

let data;
try {
  data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
} catch {
  data = [];
  console.warn("data.json not found, building empty page");
}

const updateDate = data.length > 0
  ? new Date(Math.max(...data.map(d => new Date(d.updated).getTime()))).toISOString().slice(0, 10)
  : "unknown";

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>蒸汽平台价格查询</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#1b2838;color:#c6d4df;min-height:100vh}
.header{background:linear-gradient(135deg,#1b2838 0%,#2a475e 100%);padding:16px 24px;border-bottom:1px solid #000}
.header h1{color:#fff;font-size:20px;margin-bottom:8px}
.header .meta{font-size:12px;color:#8f98a0}
.controls{display:flex;gap:8px;padding:12px 24px;flex-wrap:wrap;background:#171a21;position:sticky;top:0;z-index:100;border-bottom:1px solid #000}
.controls input,.controls select{background:#32353c;color:#c6d4df;border:1px solid #4c545e;border-radius:3px;padding:6px 10px;font-size:13px;outline:none}
.controls input:focus,.controls select:focus{border-color:#66c0f4}
.controls input[type="text"]{width:260px;flex-grow:1;max-width:400px}
.controls select{cursor:pointer}
.stats{padding:8px 24px;font-size:12px;color:#8f98a0;background:#171a21}
.stats span{color:#66c0f4;font-weight:bold}
.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px;padding:12px 24px}
.card{display:flex;gap:10px;background:#1e2a38;border:1px solid #000;border-radius:4px;padding:10px;cursor:pointer;transition:border-color .15s}
.card:hover{border-color:#66c0f4}
.card img{width:120px;height:45px;object-fit:cover;border-radius:2px;flex-shrink:0;background:#000}
.card .info{flex:1;min-width:0}
.card .name{color:#c6d4df;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px}
.card .name .appid{color:#62727e;font-size:11px;margin-left:4px}
.card .tags{display:flex;gap:4px;margin-bottom:4px;flex-wrap:wrap}
.card .tag{font-size:10px;padding:1px 5px;border-radius:2px;background:#32353c;color:#8f98a0}
.card .tag.win{background:#1a3a5c;color:#66c0f4}
.card .review-positive{color:#a3cf00}
.card .review-mixed{color:#e5e621}
.card .review-negative{color:#c94846}
.price-row{display:flex;align-items:center;gap:6px;margin-top:4px}
.discount{background:#4c6b22;color:#a3cf00;font-size:12px;font-weight:bold;padding:1px 4px;border-radius:2px}
.price-original{color:#738895;font-size:11px;text-decoration:line-through}
.price-final{color:#acdbf5;font-size:14px;font-weight:bold}
.price-free{color:#a3cf00;font-size:13px;font-weight:bold}
.no-data{text-align:center;padding:60px 24px;color:#62727e;font-size:16px}
</style>
</head>
<body>
<div class="header">
  <h1>蒸汽平台价格查询</h1>
  <div class="meta">共 <span id="total">0</span> 款游戏 · 数据更新于 <span id="date">${updateDate}</span></div>
</div>
<div class="controls">
  <input type="text" id="search" placeholder="搜索游戏名称或 AppID..." />
  <select id="platform"><option value="">全部平台</option><option value="win">Windows</option></select>
  <select id="discount"><option value="">折扣筛选</option><option value="free">免费</option><option value="sale">正在打折</option><option value="nosale">未打折</option><option value="noprice">暂无价格</option></select>
  <select id="review"><option value="">评价筛选</option><option value="positive">好评</option><option value="mixed">褒贬不一</option><option value="negative">差评</option><option value="none">无评价</option></select>
  <select id="sort"><option value="name">按名称排序</option><option value="appid-desc">AppID 降序</option><option value="appid-asc">AppID 升序</option><option value="price-asc">价格低到高</option><option value="price-desc">价格高到低</option><option value="discount-desc">折扣力度</option></select>
</div>
<div class="stats">显示 <span id="showing">0</span> / <span id="total2">0</span> 款</div>
<div class="list" id="list"></div>
<div class="no-data" id="nodata" style="display:none">没有找到匹配的游戏</div>
<script>
const DATA=JSON.parse(decodeURIComponent(atob('${btoa(encodeURIComponent(JSON.stringify(data)))}')));
const REVIEW_LABELS={positive:"好评",mixed:"褒贬不一",negative:"差评",none:"无评价"};
const MAX_PRICE=15728.40;
let filtered=[...DATA];
function decodePrice(v){if(v===null)return null;return(v/100).toFixed(2)}
function renderList(){
  const el=document.getElementById("list");
  const nodata=document.getElementById("nodata");
  const showing=document.getElementById("showing");
  el.innerHTML="";
  showing.textContent=filtered.length;
  if(filtered.length===0){nodata.style.display="block";return}
  nodata.style.display="none";
  const frag=document.createDocumentFragment();
  const limit=Math.min(filtered.length,500);
  for(let i=0;i<limit;i++){
    const g=filtered[i];
    const card=document.createElement("div");
    card.className="card";
    const disc=g.pct==="free"||g.pct===0?"":'<span class="discount">'+(typeof g.pct==="number"?g.pct+"%":"")+'</span>';
    let priceHTML="";
    if(g.pct==="free"){priceHTML='<span class="price-free">免费</span>'}
    else if(g.pct==="noprice"){priceHTML='<span style="color:#62727e;font-size:12px">暂无价格</span>'}
    else{const op=g.original_price?('<span class="price-original">¥'+decodePrice(g.original_price)+'</span>'):"";priceHTML=disc+op+'<span class="price-final">¥'+decodePrice(g.final_price)+'</span>'}
    const tags=[];
    if(g.platform.includes("win"))tags.push('<span class="tag win">Win</span>');
    if(g.steam_deck)tags.push('<span class="tag">Deck</span>');
    if(g.review!=="none")tags.push('<span class="tag review-'+g.review+'">'+REVIEW_LABELS[g.review]+'</span>');
    card.innerHTML='<img src="'+(g.imgsrc||g.img||"")+'" alt="" loading="lazy"><div class="info"><div class="name">'+esc(g.name)+'<span class="appid">#'+g.appid+'</span></div><div class="tags">'+tags.join("")+'</div><div class="price-row">'+priceHTML+'</div></div>';
    card.onclick=()=>window.open("https://store.steamchina.com/app/"+g.appid,"_blank");
    frag.appendChild(card);
  }
  if(filtered.length>500){const more=document.createElement("div");more.style.cssText="text-align:center;padding:16px;color:#62727e;font-size:13px;grid-column:1/-1";more.textContent="仅显示前500条结果，请使用筛选缩小范围";frag.appendChild(more)}
  el.appendChild(frag);
}
function esc(s){return s?s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):''}
function applyFilters(){
  const q=document.getElementById("search").value.trim().toLowerCase();
  const pf=document.getElementById("platform").value;
  const df=document.getElementById("discount").value;
  const rf=document.getElementById("review").value;
  const sf=document.getElementById("sort").value;
  filtered=DATA.filter(g=>{
    if(q&&!(g.name.toLowerCase().includes(q)||String(g.appid).includes(q)))return false;
    if(pf&&!g.platform.includes(pf))return false;
    if(df==="free"&&g.pct!=="free")return false;
    if(df==="sale"&&(!g.pct||g.pct===0||typeof g.pct!=="number"))return false;
    if(df==="nosale"&&(g.pct!=="free"&&g.pct!==0&&typeof g.pct!=="number"))return false;
    if(df==="noprice"&&g.pct!=="noprice")return false;
    if(rf&&g.review!==rf)return false;
    return true;
  });
  const[a,d]=sf.split("-");
  filtered.sort((x,y)=>{
    let r=0;
    if(a==="name")r=x.name.localeCompare(y.name,"zh");
    else if(a==="appid")r=x.appid-y.appid;
    else if(a==="price")r=parseFloat(x.final_price||0)-parseFloat(y.final_price||0);
    else if(a==="discount")r=(typeof x.pct==="number"?x.pct:0)-(typeof y.pct==="number"?y.pct:0);
    return d==="desc"?-r:r;
  });
  renderList();
}
document.getElementById("total").textContent=DATA.length;
document.getElementById("total2").textContent=DATA.length;
document.getElementById("search").addEventListener("input",debounce(applyFilters,200));
document.getElementById("platform").addEventListener("change",applyFilters);
document.getElementById("discount").addEventListener("change",applyFilters);
document.getElementById("review").addEventListener("change",applyFilters);
document.getElementById("sort").addEventListener("change",applyFilters);
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
applyFilters();
</script>
</body>
</html>`;

fs.writeFileSync(HTML_PATH, html, 'utf8');
console.log(`Built ${HTML_PATH} with ${data.length} apps`);
