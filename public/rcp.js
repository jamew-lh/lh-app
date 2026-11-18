// RCP Pipe Lookup (Field Reference). Data from RCP_DATA.xlsx (field corrections 11/18/2026).
// Data from RCP_DATA.xlsx (with field corrections 11/18/2026)
const ROUND = [
 // size, wall, od, bell, wpf, lay, area, truck pcs, truck ft, truck wt
 [12,2.25,16.5,20.625,116,8,0.78,52,416,48360],
 [15,2.25,19.5,24.125,143,8,1.23,42,336,47880],
 [18,2.5,23,27.625,192,8,1.7,32,256,48960],
 [21,2.75,26.5,31.625,220,8,2.41,28,224,49000],
 [24,3,30,35.625,288,8,3.14,21,168,48300],
 [27,3.25,33.5,39.625,350,8,3.98,17,136,47600],
 [30,3.5,37,43.125,400,8,4.91,15,120,48000],
 [36,4.75,45.5,47.625,694,8,7.07,9,72,49950],
 [42,5.25,52.5,52.5,810,8,9.62,7,56,45360],
 [48,5.75,59.5,59.5,1020,8,12.57,6,48,48960],
 [54,6.25,66.5,66.5,1232,8,15.92,5,40,44180],
 [60,6.75,73.5,73.5,1475,8,19.63,4,32,47200],
 [66,7.25,80.5,80.5,1738,8,23.76,3,24,41712],
 [72,7.75,87.5,87.5,2023,8,28.27,3,24,48552],
 [78,8.25,94.5,94.5,2350,8,33.18,null,null,null],
 [84,8.75,101.5,101.5,2660,8,38.48,null,null,null],
].map(r=>({size:r[0],wall:r[1],od:r[2],bell:r[3],wpf:r[4],lay:r[5],area:r[6],tPcs:r[7],tFt:r[8],tWt:r[9]}));

const ELL = [
 // inside rise x span, round equal, wall, outside R&S, lay, wpf, area, truck pcs, ft, wt
 ["14X23",18,2.75,"19.5X28.5",8,182,1.8,23,184,33419],
 ["19X30",24,3.25,"25.5X36.5",8,320,3.1,18,144,46080],
 ["22X34",27,3.5,"29X41",8,390,4.1,15,120,46800],
 ["24X38",30,3.75,"31.5X45.5",8,460,5.1,13,104,47840],
 ["29X45",36,4.5,"38X54",8,680,7.4,9,72,48960],
 ["34X53",42,5,"44X63",8,840,10.2,7,56,47040],
 ["38X60",48,5.5,"49X71",8,1060,12.9,5,40,42400],
 ["43X68",54,6,"55X80",8,1320,16.6,4,32,42240],
 ["48X76",60,6.5,"61X89",8,1475,20.5,4,32,47200],
 ["53X83",66,7,"67X97",8,1765,24.8,3,24,42336],
 ["58X91",72,7.5,"73X106",8,2070,29.4,3,24,49656],
].map(r=>({size:r[0],eq:r[1],wall:r[2],out:r[3],lay:r[4],wpf:r[5],area:r[6],tPcs:r[7],tFt:r[8],tWt:r[9]}));

const I = {
  pipe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><ellipse cx="6" cy="12" rx="3" ry="6"/><path d="M6 6h12M6 18h12"/><ellipse cx="18" cy="12" rx="3" ry="6"/></svg>',
  truck:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h11v9H2zM13 10h4l3 3v3h-7z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
  swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h12l-3-3M17 17H5l3 3"/></svg>',
  copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
};

let mode="round", current=null;
const $=id=>document.getElementById(id);
const fmt=n=>n==null?"—":Number(n).toLocaleString("en-US",{maximumFractionDigits:3});
const dims=s=>s.replace("X"," × ");

function setMode(m,keep){
  mode=m;
  $("bRound").setAttribute("aria-pressed",m==="round");
  $("bEll").setAttribute("aria-pressed",m==="ell");
  $("sizesTitle").textContent = m==="round" ? "Round sizes" : "Elliptical sizes (inside rise × span)";
  if(!keep){ current=null; $("q").value=""; $("msg").innerHTML=""; render(); }
  drawSizes();
}

function drawSizes(){
  const list = mode==="round"?ROUND:ELL;
  $("count").textContent = `${list.length} sizes`;
  $("sizes").innerHTML = list.map(r=>{
    const on = current && String(current.size)===String(r.size) ? " on":"";
    return mode==="round"
      ? `<button class="size${on}" data-k="${r.size}"><b>${r.size}"</b><small>round</small></button>`
      : `<button class="size${on}" data-k="${r.size}"><b>${dims(r.size)}</b><small>= ${r.eq}" rnd</small></button>`;
  }).join("");
  $("sizes").querySelectorAll("button").forEach(b=>b.onclick=()=>pick(b.dataset.k,true));
}

function pick(key,scroll){
  const list = mode==="round"?ROUND:ELL;
  current = list.find(r=>String(r.size)===String(key))||null;
  $("msg").innerHTML="";
  render(); drawSizes();
  if(current){
    try{ history.replaceState(null,"","#"+(mode==="round"?"rcp-":"ell-")+String(current.size).toLowerCase()); }catch(e){}
    if(scroll) $("out").scrollIntoView({behavior:"smooth",block:"start"});
  }
}

const row=(l,v,u)=>`<div class="drow"><span class="dlabel">${l}</span><span class="dval">${v}${u?`<u>${u}</u>`:""}</span></div>`;

function truck(r){
  const body = r.tPcs==null
    ? `<div class="none">No truck loading info for this size.</div>`
    : `<div class="truck"><div><span class="dval">${fmt(r.tPcs)}</span><span class="dlabel">Pieces</span></div><div><span class="dval">${fmt(r.tFt)}</span><span class="dlabel">Feet</span></div><div><span class="dval">${fmt(r.tWt)}</span><span class="dlabel">Lbs</span></div></div>`;
  return `<section class="card"><h3><span class="dot">${I.truck}</span>Truck Loading</h3>${body}</section>`;
}

function render(){
  const out=$("out");
  if(!current){ out.innerHTML=`<div class="empty">Select or type a pipe size above to see its data.</div>`; return; }
  const r=current;
  let head, rows, swapTo=null;
  if(mode==="round"){
    const e=ELL.find(x=>x.eq===r.size);
    swapTo = e ? ()=>{ setMode("ell",true); pick(e.size); } : null;
    head = `<div class="eyebrow">Round RCP</div><h2>${r.size}" Round</h2>
      <div class="meta">${e?`<button class="btn btn-tan" id="swap">${I.swap}Elliptical equal: ${dims(e.size)}</button>`:`<span class="pill">No elliptical equal</span>`}
      <button class="btn btn-light" id="copy">${I.copy}Copy</button></div>`;
    rows = row("Wall thickness",fmt(r.wall),"in")+row("Pipe OD",fmt(r.od),"in")+row("Bell OD",fmt(r.bell),"in")+
      row("Weight per foot",fmt(r.wpf),"lbs/ft")+row("Laying length",fmt(r.lay),"ft")+row("Nominal end area",fmt(r.area),"sq ft")+
      row("Weight per piece",fmt(r.wpf*r.lay),"lbs");
  } else {
    swapTo = ()=>{ setMode("round",true); pick(r.eq); };
    head = `<div class="eyebrow">Elliptical RCP</div><h2>${dims(r.size)} Elliptical</h2>
      <div class="meta"><button class="btn btn-tan" id="swap">${I.swap}Round equal: ${r.eq}"</button>
      <button class="btn btn-light" id="copy">${I.copy}Copy</button></div>`;
    rows = row("Inside rise × span",dims(r.size),"in")+row("Round equal",r.eq+'"',"")+row("Wall thickness",fmt(r.wall),"in")+
      row("Outside rise × span",dims(r.out),"in")+row("Weight per foot",fmt(r.wpf),"lbs/ft")+row("Laying length",fmt(r.lay),"ft")+
      row("Nominal end area",fmt(r.area),"sq ft")+row("Weight per piece",fmt(r.wpf*r.lay),"lbs");
  }
  out.innerHTML = `<section class="pipehead">${head}</section>
    <div class="cards"><section class="card"><h3><span class="dot">${I.pipe}</span>Pipe Data</h3>${rows}</section>${truck(r)}</div>`;
  if(swapTo) $("swap").onclick=swapTo;
  $("copy").onclick=async()=>{
    const b=$("copy");
    try{ await navigator.clipboard.writeText(summary()); b.innerHTML=`${I.copy}Copied ✓`; }
    catch(e){ b.innerHTML=`${I.copy}Copy blocked`; }
    setTimeout(()=>{ if($("copy")) $("copy").innerHTML=`${I.copy}Copy`; },1500);
  };
}

function summary(){
  const r=current;
  const t = r.tPcs!=null?`\nTruck: ${r.tPcs} pcs / ${r.tFt} ft / ${fmt(r.tWt)} lbs`:"\nTruck: no info";
  if(mode==="round") return `${r.size}" ROUND RCP\nWall: ${r.wall}" | Pipe OD: ${r.od}" | Bell OD: ${r.bell}"\nWeight: ${fmt(r.wpf)} lbs/ft | Laying length: ${r.lay} ft | End area: ${r.area} sq ft`+t;
  return `${dims(r.size)} ELLIPTICAL RCP (round equal ${r.eq}")\nWall: ${r.wall}" | Outside R×S: ${dims(r.out)}"\nWeight: ${fmt(r.wpf)} lbs/ft | Laying length: ${r.lay} ft | End area: ${r.area} sq ft`+t;
}

function err(t){ $("msg").innerHTML=`<div class="err">${t}</div>`; }
function info(t){ $("msg").innerHTML=`<div class="ok">${t}</div>`; }

// Search: "36", 36", "29x45", "29 x 45", "ell 36"
function search(raw){
  const s=raw.trim().toUpperCase().replace(/["”″]|IN(CH(ES)?)?/g,"").replace(/\s*[X×*]\s*/g,"X").replace(/\s+/g," ").trim();
  if(!s) return;
  const rs=s.match(/^(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)$/);
  if(rs){
    const key=`${+rs[1]}X${+rs[2]}`, e=ELL.find(x=>x.size===key);
    if(e){ setMode("ell",true); pick(e.size); return; }
    return err(`No elliptical size ${dims(key)}. Available: ${ELL.map(x=>dims(x.size)).join(", ")}`);
  }
  const wantEll=/^(E|ELL|ELLIP|ELLIPTICAL)\s*\d/.test(s);
  const n=parseFloat((s.match(/\d+(\.\d+)?/)||[])[0]);
  if(isNaN(n)) return err("Type a round size (e.g. 36) or elliptical rise × span (e.g. 29x45).");
  if(wantEll||mode==="ell"){
    const e=ELL.find(x=>x.eq===n);
    if(e){ setMode("ell",true); pick(e.size); info(`Showing the elliptical equal of ${n}" round.`); return; }
    if(wantEll) return err(`No elliptical equal for ${n}" round.`);
  }
  const r=ROUND.find(x=>x.size===n);
  if(r){ setMode("round",true); pick(r.size); return; }
  err(`No ${n}" round size. Available: ${ROUND.map(x=>x.size+'"').join(", ")}`);
}

$("f").addEventListener("submit",e=>{e.preventDefault(); search($("q").value); $("q").blur();});
$("q").addEventListener("input",()=>{
  const v=$("q").value.trim();
  if(/^\d+$/.test(v) && (mode==="round"?ROUND.some(x=>x.size==+v):ELL.some(x=>x.eq==+v))) search(v);
  else if(/^\d+\s*[xX×]\s*\d+$/.test(v)) search(v);
});
$("bRound").onclick=()=>setMode("round");
$("bEll").onclick=()=>setMode("ell");

// Deep links from the main app: #rcp-36 or #ell-29x45
function fromHash(){
  const h=decodeURIComponent(location.hash.slice(1)).toLowerCase(); let m;
  if((m=h.match(/^rcp-(\d+)$/))){ setMode("round",true); pick(+m[1]); }
  else if((m=h.match(/^ell-(\d+x\d+)$/))){ setMode("ell",true); pick(m[1].toUpperCase()); }
}
window.addEventListener("hashchange",fromHash);
drawSizes(); render(); fromHash();
