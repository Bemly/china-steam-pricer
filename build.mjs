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

/* Modal */
.modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s}
.modal-overlay.active{opacity:1;pointer-events:all}
.modal{background:#1e2a38;border:1px solid #000;border-radius:8px;max-width:800px;width:92%;max-height:90vh;overflow-y:auto;padding:20px;position:relative}
.modal-close{position:absolute;top:12px;right:16px;background:none;border:none;color:#8f98a0;font-size:22px;cursor:pointer}
.modal-close:hover{color:#fff}
.modal h2{color:#fff;font-size:16px;margin-bottom:4px;padding-right:30px}
.modal .modal-meta{font-size:12px;color:#8f98a0;margin-bottom:12px}
.chart-container{width:100%;margin:12px 0;background:#171a21;border-radius:4px;padding:8px;position:relative}
.chart-container svg{width:100%;height:auto}
.chart-tooltip{position:absolute;background:#2a475e;color:#fff;font-size:11px;padding:4px 8px;border-radius:3px;pointer-events:none;opacity:0;transition:opacity .15s;white-space:nowrap}
.chart-tooltip.visible{opacity:1}
.chart-legend{display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:11px;color:#8f98a0}
.chart-legend span{display:flex;align-items:center;gap:4px}
.chart-legend .dot{width:10px;height:3px;border-radius:1px;display:inline-block}
.no-history{text-align:center;padding:20px;color:#62727e;font-size:13px}
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

<!-- Modal -->
<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <button class="modal-close" id="modalClose">&times;</button>
    <h2 id="modalTitle"></h2>
    <div class="modal-meta" id="modalMeta"></div>
    <div id="modalChart"></div>
  </div>
</div>

<script>
const DATA=JSON.parse(decodeURIComponent(atob('${btoa(encodeURIComponent(JSON.stringify(data)))}')));
const REVIEW_LABELS={positive:"好评",mixed:"褒贬不一",negative:"差评",none:"无评价"};
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
    card.onclick=()=>showModal(g);
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

// ============ PRICE CHART MODAL ============
const overlay=document.getElementById("modalOverlay");
const titleEl=document.getElementById("modalTitle");
const metaEl=document.getElementById("modalMeta");
const chartEl=document.getElementById("modalChart");
const closeBtn=document.getElementById("modalClose");

function showModal(game){
  titleEl.textContent=game.name;
  metaEl.textContent='AppID: '+game.appid+' | 平台: '+(game.platform.join(', ')||'未知')+' | 更新于 '+game.updated.slice(0,10);
  if(!game.history||game.history.length===0){
    chartEl.innerHTML='<div class="no-history">暂无价格历史数据（需要至少两次抓取后才显示）</div>';
  }else{
    chartEl.innerHTML=drawChart(game.history, game.original_price, game.final_price);
  }
  overlay.classList.add("active");
}

function hideModal(){overlay.classList.remove("active")}
closeBtn.onclick=hideModal;
overlay.onclick=(e)=>{if(e.target===overlay)hideModal()};
document.addEventListener("keydown",(e)=>{if(e.key==="Escape")hideModal()});

function drawChart(history, currentOrig, currentFinal){
  if(history.length<2) return '<div class="no-history">数据点不足，需要至少2个记录</div>';

  // 当前价格作为最新点
  const current={date:new Date().toISOString(), original_price:currentOrig, final_price:currentFinal, pct:0};
  const points=[...history, current];

  const W=720,H=220,PAD={top:20,right:20,bottom:30,left:50};
  const cw=W-PAD.left-PAD.right,ch=H-PAD.top-PAD.bottom;

  // 解析价格
  const prices=points.map(p=>{
    const f=parseFloat(p.final_price||0);
    const o=parseFloat(p.original_price||0);
    return{date:p.date.slice(0,10),final:f,orig:o};
  });

  // 找价格范围
  let maxP=0;
  for(const p of prices){if(p.final>maxP)maxP=p.final;if(p.orig>maxP)maxP=p.orig}
  maxP=Math.max(maxP*1.1,10);

  // Y轴刻度
  const yTicks=[];
  const step=Math.ceil(maxP/5);
  for(let i=0;i<=maxP;i+=step)yTicks.push(i);

  const xScale=i=>PAD.left+(i/(prices.length-1))*cw;
  const yScale=v=>PAD.top+ch-(v/maxP)*ch;

  // 生成路径
  const finalPath=prices.map((p,i)=>(i===0?"M":"L")+xScale(i).toFixed(1)+","+yScale(p.final).toFixed(1)).join("");
  const origPath=prices.map((p,i)=>(i===0?"M":"L")+xScale(i).toFixed(1)+","+yScale(p.orig).toFixed(1)).join("");

  // 填充区域
  const finalArea=finalPath+"L"+xScale(prices.length-1).toFixed(1)+","+(PAD.top+ch)+"L"+xScale(0).toFixed(1)+","+(PAD.top+ch)+"Z";

  // X轴标签
  const xLabels=[];
  const labelCount=Math.min(6,prices.length);
  const labelStep=Math.max(1,Math.floor(prices.length/labelCount));
  for(let i=0;i<prices.length;i+=labelStep){
    xLabels.push('<text x="'+xScale(i)+'" y="'+(H-5)+'" text-anchor="middle" fill="#8f98a0" font-size="10">'+prices[i].date+'</text>');
  }

  // Y轴标签
  const yLabels=yTicks.map(v=>'<text x="'+(PAD.left-6)+'" y="'+yScale(v)+4+'" text-anchor="end" fill="#8f98a0" font-size="10">'+v.toFixed(0)+'</text>');

  // 网格线
  const gridLines=yTicks.map(v=>'<line x1="'+PAD.left+'" y1="'+yScale(v)+'" x2="'+(PAD.left+cw)+'" y2="'+yScale(v)+'" stroke="#2a3a4a" stroke-width="0.5"/>');

  // 数据点
  const finalDots=prices.map((p,i)=>'<circle cx="'+xScale(i)+'" cy="'+yScale(p.final)+'" r="3" fill="#acdbf5"/>');
  const origDots=prices.map((p,i)=>'<circle cx="'+xScale(i)+'" cy="'+yScale(p.orig)+'" r="2.5" fill="#738895"/>');

  const hasOrig=prices.some(p=>p.orig>0&&p.orig!==p.final);

  const svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">'+
    '<rect x="'+PAD.left+'" y="'+PAD.top+'" width="'+cw+'" height="'+ch+'" fill="#1b2838"/>'+
    gridLines.join("")+
    yLabels.join("")+
    xLabels.join("")+
    '<polyline points="'+prices.map((p,i)=>xScale(i).toFixed(1)+","+yScale(p.final).toFixed(1)).join(" ")+'" fill="none" stroke="#acdbf5" stroke-width="2" stroke-linejoin="round"/>'+
    (hasOrig?'<polyline points="'+prices.map((p,i)=>xScale(i).toFixed(1)+","+yScale(p.orig).toFixed(1)).join(" ")+'" fill="none" stroke="#738895" stroke-width="1.5" stroke-dasharray="4,3" stroke-linejoin="round"/>':'')+
    finalDots.join("")+
    (hasOrig?origDots.join(""):'')+
    '</svg>';

  const legend='<div class="chart-legend">'+
    '<span><span class="dot" style="background:#acdbf5"></span> 现价</span>'+
    (hasOrig?'<span><span class="dot" style="background:#738895"></span> 原价</span>':'')+
    '</div>';

  return '<div class="chart-container">'+svg+legend+'</div>';
}

// ============ INIT ============
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
