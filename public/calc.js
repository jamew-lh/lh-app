// Field Calculators (Field Reference): stone, concrete, fabric, paving, rip-rap. From James's page, 11/18/2026.
(function(){
const root=document.getElementById('lhc');
const $=s=>root.querySelector(s);
const STONES=[["1B",1.8],["2B",1.75],["2A Mod.",2],["3A Mod.",2],["#1 Ballast",1.75],["2RC",2],["#3",1.5],["#4",1.5]];
const RCP_OD={12:16.5,15:19.5,18:23,21:26.5,24:30,27:33.5,30:37,36:45.5,42:52.5,48:59.5,54:66.5,60:73.5,66:80.5,72:87.5,78:94.5,84:101.5};
const HDPE_OD={12:14.5,15:17.5,18:21.5,24:28,30:34.5,36:41,42:47.5,48:54.5,60:66};
const CONCRETE_LBS=3750, RIPRAP_TPY=1.75;

// ---------- parsing & formatting
function parseFt(v){ // returns feet
  if(v==null) return null; v=String(v).trim().replace(/[’′]/g,"'").replace(/[”″]/g,'"').replace(/''/g,'"');
  if(v==='') return null; let m;
  if((m=v.match(/^(\d*\.?\d+)\s*'\s*(?:-?\s*(\d*\.?\d+)\s*"?)?$/))) return +m[1]+(m[2]?+m[2]/12:0);
  if((m=v.match(/^(\d*\.?\d+)\s*"$/))) return +m[1]/12;
  if((m=v.match(/^(\d*\.?\d+)\s+(\d*\.?\d+)$/))) return +m[1]+ +m[2]/12;
  if((m=v.match(/^\d*\.?\d+$/))) return +v;
  return NaN;
}
function parseIn(v){ // returns inches
  if(v==null) return null; v=String(v).trim().replace(/[”″]/g,'"');
  if(v==='') return null;
  if(/'/.test(v)){ const f=parseFt(v); return isNaN(f)?NaN:f*12; }
  const m=v.match(/^(\d*\.?\d+)\s*"?$/); return m?+m[1]:NaN;
}
function parseNum(v){ if(v==null||String(v).trim()==='') return null; const n=Number(String(v).replace(/[,%]/g,'')); return isNaN(n)?NaN:n; }
const fmt=(n,d=2)=>n==null||isNaN(n)?'—':Number(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:d});
const fmtFixed=(n,d=2)=>n==null||isNaN(n)?'—':Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const ftLabel=f=>{ if(f==null||isNaN(f)) return ''; const ft=Math.floor(f+1e-9), inch=Math.round((f-ft)*12*100)/100; return `= ${fmt(f,3)} ft`+(inch&&ft?` (${ft}' ${fmt(inch,2)}")`:''); };
const stoneOpts=sel=>STONES.map(([n,t])=>`<option value="${n}"${n===sel?' selected':''}>${n} · ${t} t/cy</option>`).join('');
const factor=n=>(STONES.find(s=>s[0]===n)||STONES[1])[1];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ---------- tab definitions
const TABS={
 stone:{label:'Stone',rowName:'Area',
  fields:[{k:'L',label:'Length (ft)',t:'ft'},{k:'W',label:'Width (ft)',t:'ft'},{k:'H',label:'Height (ft)',t:'ft'},{k:'s',label:'Stone',t:'stone',full:true}],
  blank:()=>({L:'',W:'',H:'',s:'2B'}),
  calc(r){ const L=parseFt(r.L),W=parseFt(r.W),H=parseFt(r.H); if([L,W,H].some(x=>x==null||isNaN(x))) return null;
    const cf=L*W*H, cy=cf/27, t=cy*factor(r.s); return {res:[['CF',fmt(cf,1)],['CY',fmtFixed(cy)],['Tons',fmtFixed(t),1]],tot:{cf,cy,t}}; },
  formula:'L × W × H = CF · CF ÷ 27 = CY · CY × stone factor = Tons'},
 concrete:{label:'Concrete',rowName:'Pour',
  fields:[{k:'L',label:'Length (ft)',t:'ft'},{k:'W',label:'Width (ft)',t:'ft'},{k:'H',label:'Height / thick',t:'ft',ph:'ft or 6"'}],
  blank:()=>({L:'',W:'',H:''}),
  calc(r){ const L=parseFt(r.L),W=parseFt(r.W),H=parseFt(r.H); if([L,W,H].some(x=>x==null||isNaN(x))) return null;
    const cf=L*W*H, cy=cf/27, lbs=cy*CONCRETE_LBS; return {res:[['CF',fmt(cf,1)],['CY',fmtFixed(cy),1],['Lbs',fmt(lbs,0)]],tot:{cf,cy,lbs}}; },
  formula:`L × W × H = CF · CF ÷ 27 = CY · CY × ${CONCRETE_LBS.toLocaleString()} = Lbs`},
 fabric:{label:'Fabric',rowName:'Area',
  fields:[{k:'L',label:'Length (ft)',t:'ft'},{k:'W',label:'Width (ft)',t:'ft'},{k:'H',label:'Height (ft)',t:'ft'}],
  blank:()=>({L:'',W:'',H:''}),
  calc(r){ const L=parseFt(r.L),W=parseFt(r.W),H=parseFt(r.H); if([L,W,H].some(x=>x==null||isNaN(x))) return null;
    const sf=2*L*W+2*L*H+2*W*H, sy=sf/9; return {res:[['SF',fmt(sf,1)],['SY',fmtFixed(sy),1]],tot:{sf,sy}}; },
  formula:'All six sides: 2(L×W) + 2(L×H) + 2(W×H) = SF · SF ÷ 9 = SY'},
 paving:{label:'Paving',rowName:'Area',
  fields:[{k:'L',label:'Length (ft)',t:'ft'},{k:'W',label:'Width (ft)',t:'ft'},{k:'T',label:'Thickness (in)',t:'in'}],
  blank:()=>({L:'',W:'',T:''}),
  calc(r,set){ const L=parseFt(r.L),W=parseFt(r.W),T=parseIn(r.T); if([L,W,T].some(x=>x==null||isNaN(x))) return null;
    const rate=num(set.rate,114); const sf=L*W, sy=sf/9, t=sy*T*rate/2000; return {res:[['SF',fmt(sf,1)],['SY',fmtFixed(sy)],['Tons',fmtFixed(t),1]],tot:{sf,sy,t}}; },
  formula:'L × W = SF · SF ÷ 9 = SY · SY × thickness (in) × lbs/SY/in ÷ 2,000 = Tons'},
 riprap:{label:'Rip-Rap',rowName:'Apron',
  fields:[{k:'o',label:'Outlet #',t:'text'},{k:'D',label:'Stone depth (ft)',t:'ft'},{k:'L',label:'Length (ft)',t:'ft'},{k:'S',label:'Start width (ft)',t:'ft'},{k:'T',label:'Term. width (ft)',t:'ft'}],
  blank:()=>({o:'',D:'',L:'',S:'',T:''}),
  calc(r){ const D=parseFt(r.D),L=parseFt(r.L),S=parseFt(r.S),T=parseFt(r.T); if([D,L,S,T].some(x=>x==null||isNaN(x))) return null;
    const B=(T-S)/2, cf=(S+B)*L*D, cy=cf/27, t=cy*RIPRAP_TPY; return {res:[['B',fmt(B,2)],['CF',fmt(cf,1)],['CY',fmtFixed(cy)],['Tons',fmtFixed(t),1]],tot:{cf,cy,t}}; },
  formula:`B = (Term. − Start) ÷ 2 · (Start + B) × L × Depth = CF · CF ÷ 27 = CY · CY × ${RIPRAP_TPY} = Tons`},
};
const ORDER=['stone','concrete','fabric','paving','riprap'];
function num(v,d){ const n=parseNum(v); return n==null||isNaN(n)?d:n; }

// ---------- state
const DEF={tab:'stone',rows:{},set:{concrete:{waste:'0'},fabric:{overlap:'20'},paving:{rate:'114'},stone:{pipe:false,ptype:'RCP',psize:'24',plen:'',ps:'2B'}}};
let S;
try{ S=JSON.parse(localStorage.getItem('lh-field-calcs')||'null'); }catch(e){ S=null; }
if(!S||!S.rows) S=JSON.parse(JSON.stringify(DEF));
ORDER.forEach(k=>{ if(!S.rows[k]||!S.rows[k].length) S.rows[k]=[TABS[k].blank()]; S.set[k]=Object.assign({},DEF.set[k]||{},S.set[k]||{}); });
const save=()=>{ try{ localStorage.setItem('lh-field-calcs',JSON.stringify(S)); }catch(e){} };

// ---------- rendering
function drawTabs(){
  $('#lhc-tabs').innerHTML=ORDER.map(k=>`<button class="tab" role="tab" data-t="${k}" aria-selected="${S.tab===k}">${TABS[k].label}</button>`).join('');
  root.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{ go(b.dataset.t,true); });
}
function go(k,setHash){
  if(!TABS[k]) return; S.tab=k; save(); drawTabs(); drawPanel();
  if(setHash){ try{ history.replaceState(null,'','#'+k); }catch(e){} }
}
function fieldHTML(t,f,r,i){
  const v=esc(r[f.k]);
  let input;
  if(f.t==='stone') input=`<select data-i="${i}" data-k="${f.k}">${stoneOpts(r[f.k])}</select>`;
  else input=`<input data-i="${i}" data-k="${f.k}" value="${v}" placeholder="${f.ph||(f.t==='text'?'':'0')}" autocomplete="off" ${f.t==='text'?'':'inputmode="text"'}>`;
  return `<div class="fld${f.full?' full':''}"><label>${f.label}</label>${input}<span class="hint" id="lhc-h-${i}-${f.k}"></span></div>`;
}
function setField(label,id,val,ph,hint){
  return `<div class="fld"><label>${label}</label><input data-set="${id}" value="${esc(val)}" placeholder="${ph}" autocomplete="off"><span class="hint">${hint||''}</span></div>`;
}
function drawPanel(){
  const k=S.tab, t=TABS[k], rows=S.rows[k], set=S.set[k];
  let html=`<div class="section-title"><span>${t.label} — ${rows.length} ${t.rowName.toLowerCase()}${rows.length>1?'s':''}</span>`+
    (k==='fabric'?`<button class="lnk" id="lhc-fromstone">Use Stone sizes</button>`:'')+
    `<button class="lnk" id="lhc-clear">Clear</button></div>`;
  html+=rows.map((r,i)=>`<section class="card"><div class="card-h"><span class="dot">${i+1}</span><b>${t.rowName} ${i+1}</b>${rows.length>1?`<button class="x" data-del="${i}">Remove</button>`:''}</div>
    <div class="fields">${t.fields.map(f=>fieldHTML(t,f,r,i)).join('')}</div>
    <div class="res" id="lhc-r-${i}"></div></section>`).join('');
  html+=`<button class="btn btn-add" id="lhc-add">+ Add ${t.rowName.toLowerCase()}</button>`;
  if(k==='stone'){
    html+=`<div class="section-title"><span>Subtract pipe</span></div><section class="card">
      <label class="chk"><input type="checkbox" id="lhc-pipe" ${set.pipe?'checked':''}>Subtract the pipe from the stone</label>
      <div class="fields" id="lhc-pipebox" ${set.pipe?'':'hidden'}>
        <div class="fld"><label>Pipe type</label><select data-set="ptype"><option${set.ptype==='RCP'?' selected':''}>RCP</option><option${set.ptype==='HDPE'?' selected':''}>HDPE</option></select><span class="hint"></span></div>
        <div class="fld"><label>Size</label><select data-set="psize">${sizeOpts(set.ptype,set.psize)}</select><span class="hint" id="lhc-od"></span></div>
        <div class="fld"><label>Run length (ft)</label><input data-set="plen" value="${esc(set.plen)}" placeholder="0" autocomplete="off"><span class="hint" id="lhc-plh"></span></div>
        <div class="fld full"><label>Stone factor for pipe</label><select data-set="ps">${stoneOpts(set.ps)}</select><span class="hint"></span></div>
      </div>
      <div class="res" id="lhc-pres" ${set.pipe?'':'hidden'}></div>
      <div class="formula" ${set.pipe?'':'hidden'} id="lhc-pf">Pipe CF = π × (OD ÷ 2)² × run length, using the pipe's outside diameter.</div></section>`;
  }
  if(k==='concrete') html+=`<div class="section-title"><span>Settings</span></div><section class="card"><div class="fields two">${setField('Waste / overage %','waste',set.waste,'0','Added before rounding the order')}<div class="fld"><label>Weight per CY</label><input value="3,750 lbs" disabled><span class="hint">Fixed</span></div></div></section>`;
  if(k==='fabric') html+=`<div class="section-title"><span>Settings</span></div><section class="card"><div class="fields two">${setField('Overlap %','overlap',set.overlap,'20','Sheet default 20%')}</div></section>`;
  if(k==='paving') html+=`<div class="section-title"><span>Settings</span></div><section class="card"><div class="fields two">${setField('Lbs per SY per inch','rate',set.rate,'114','Sheet default 114')}</div></section>`;
  html+=`<section class="tot"><div class="eyebrow">Totals</div><div class="tgrid" id="lhc-tot"></div>
    <div class="tact"><button class="btn btn-tan" id="lhc-copy">Copy results</button></div></section>
    <p class="note">${t.formula}</p>`;
  $('#lhc-panel').innerHTML=html;
  bind(); update();
}
function sizeOpts(type,sel){ const T=type==='HDPE'?HDPE_OD:RCP_OD; return Object.keys(T).map(s=>`<option value="${s}"${String(s)===String(sel)?' selected':''}>${s}"</option>`).join(''); }

function bind(){
  const k=S.tab;
  root.querySelectorAll('#lhc-panel [data-k]').forEach(el=>{
    const ev=el.tagName==='SELECT'?'change':'input';
    el.addEventListener(ev,()=>{ S.rows[k][+el.dataset.i][el.dataset.k]=el.value; save(); update(); });
  });
  root.querySelectorAll('#lhc-panel [data-set]').forEach(el=>{
    const ev=el.tagName==='SELECT'?'change':'input';
    el.addEventListener(ev,()=>{
      S.set[k][el.dataset.set]=el.value;
      if(el.dataset.set==='ptype'){ const T=el.value==='HDPE'?HDPE_OD:RCP_OD; if(!T[S.set[k].psize]) S.set[k].psize=Object.keys(T)[0]; save(); drawPanel(); return; }
      save(); update();
    });
  });
  root.querySelectorAll('#lhc-panel [data-del]').forEach(b=>b.onclick=()=>{ S.rows[k].splice(+b.dataset.del,1); save(); drawPanel(); });
  $('#lhc-add').onclick=()=>{ const last=S.rows[k][S.rows[k].length-1]; const n=TABS[k].blank(); if(k==='stone'&&last) n.s=last.s; S.rows[k].push(n); save(); drawPanel();
    const ins=root.querySelectorAll('#lhc-panel .card'); const c=ins[S.rows[k].length-1]; if(c){ const i=c.querySelector('input'); if(i) i.focus(); } };
  $('#lhc-clear').onclick=()=>{ S.rows[k]=[TABS[k].blank()]; if(k==='stone') S.set.stone.plen=''; save(); drawPanel(); };
  const fs=$('#lhc-fromstone'); if(fs) fs.onclick=()=>{ S.rows.fabric=S.rows.stone.map(r=>({L:r.L,W:r.W,H:r.H})); save(); drawPanel(); };
  const pc=$('#lhc-pipe'); if(pc) pc.onchange=()=>{ S.set.stone.pipe=pc.checked; save(); drawPanel(); };
  $('#lhc-copy').onclick=async()=>{ const b=$('#lhc-copy'); try{ await navigator.clipboard.writeText(summary()); b.textContent='Copied ✓'; }catch(e){ b.textContent='Copy blocked'; } setTimeout(()=>{ const x=$('#lhc-copy'); if(x) x.textContent='Copy results'; },1500); };
}

let last={};
function update(){
  const k=S.tab, t=TABS[k], rows=S.rows[k], set=S.set[k];
  const tot={}; let complete=0;
  rows.forEach((r,i)=>{
    t.fields.forEach(f=>{
      const h=$(`#lhc-h-${i}-${f.k}`), el=root.querySelector(`#lhc-panel [data-i="${i}"][data-k="${f.k}"]`);
      if(!h||f.t==='stone'||f.t==='text') return;
      const v=r[f.k]; let txt='', bad=false;
      if(f.t==='ft'){ const x=parseFt(v); if(x!=null){ if(isNaN(x)){bad=true;txt='Not a length';} else if(/['"\s]/.test(String(v).trim())) txt=ftLabel(x); } }
      if(f.t==='in'){ const x=parseIn(v); if(x!=null){ if(isNaN(x)){bad=true;txt='Not a number';} else if(/'/.test(v)) txt=`= ${fmt(x,2)} in`; } }
      h.textContent=txt; if(el) el.classList.toggle('bad',bad);
    });
    const out=t.calc(r,set), box=$(`#lhc-r-${i}`);
    if(!out){ box.innerHTML=`<span class="wait">Enter ${t.fields.filter(f=>f.t!=='stone'&&f.t!=='text').map(f=>f.label.replace(/ \(.*\)/,'').toLowerCase()).join(', ')}</span>`; return; }
    complete++;
    box.innerHTML=out.res.map(([l,v,key])=>`<span class="r${key?' key':''}"><i>${l}</i><b>${v}</b></span>`).join('');
    for(const [kk,vv] of Object.entries(out.tot)) tot[kk]=(tot[kk]||0)+vv;
  });
  const T=[]; const n=complete;
  if(k==='stone'){
    T.push(['Cubic yards',fmtFixed(tot.cy||0),'CY'],['Tons',fmtFixed(tot.t||0),'tons',!set.pipe]);
    if(set.pipe){
      const OD=(set.ptype==='HDPE'?HDPE_OD:RCP_OD)[set.psize], len=parseFt(set.plen);
      const odh=$('#lhc-od'); if(odh) odh.textContent=OD?`OD ${OD}" (${fmt(OD/12,3)} ft)`:'';
      const plh=$('#lhc-plh'); if(plh) plh.textContent=len!=null&&!isNaN(len)&&/['"\s]/.test(String(set.plen).trim())?ftLabel(len):(len!=null&&isNaN(len)?'Not a length':'');
      const pres=$('#lhc-pres');
      if(OD&&len!=null&&!isNaN(len)){
        const area=Math.PI*Math.pow(OD/12/2,2), cf=area*len, cy=cf/27, tn=cy*factor(set.ps);
        pres.innerHTML=`<span class="r"><i>Pipe area</i><b>${fmt(area,3)}</b><i>sf</i></span><span class="r"><i>CF</i><b>${fmt(cf,1)}</b></span><span class="r"><i>CY</i><b>${fmtFixed(cy)}</b></span><span class="r key"><i>Tons</i><b>${fmtFixed(tn)}</b></span>`;
        T.push(['Minus pipe','−'+fmtFixed(tn),'tons'],['Net cubic yards',fmtFixed((tot.cy||0)-cy),'CY'],['Net tons',fmtFixed((tot.t||0)-tn),'tons',true]);
        last.pipe={OD,len,cy,tn,size:set.psize,type:set.ptype};
      } else { pres.innerHTML=`<span class="wait">Enter the pipe run length</span>`; last.pipe=null; }
    } else last.pipe=null;
  }
  if(k==='concrete'){
    const w=num(set.waste,0), withW=(tot.cy||0)*(1+w/100), order=Math.ceil(withW*4-1e-9)/4;
    T.push(['Cubic yards',fmtFixed(tot.cy||0),'CY'],['Weight',fmt(tot.lbs||0,0),'lbs']);
    if(w) T.push([`With ${fmt(w,1)}% waste`,fmtFixed(withW),'CY']);
    T.push(['Order (next ¼ yd)',fmtFixed(order),'CY',true]);
    last.order=order; last.withW=withW; last.w=w;
  }
  if(k==='fabric'){
    const o=num(set.overlap,20), total=(tot.sy||0)*(1+o/100);
    T.push(['Square feet',fmt(tot.sf||0,1),'SF'],['Square yards',fmtFixed(tot.sy||0),'SY'],[`Total with ${fmt(o,1)}% overlap`,fmtFixed(total),'SY',true]);
    last.total=total; last.o=o;
  }
  if(k==='paving') T.push(['Square feet',fmt(tot.sf||0,1),'SF'],['Square yards',fmtFixed(tot.sy||0),'SY'],['Tons',fmtFixed(tot.t||0),'tons',true]);
  if(k==='riprap') T.push(['Cubic yards',fmtFixed(tot.cy||0),'CY'],['Tons',fmtFixed(tot.t||0),'tons',true]);
  $('#lhc-tot').innerHTML=T.map(([l,v,u,big])=>`<div class="${big?'big':''}"><i>${l}</i><b>${v}<u>${u}</u></b></div>`).join('');
  last.tot=tot; last.T=T;
}

function summary(){
  const k=S.tab, t=TABS[k], set=S.set[k];
  const lines=[`L&H ${t.label.toUpperCase()} CALCULATOR`];
  S.rows[k].forEach((r,i)=>{
    const out=t.calc(r,set); if(!out) return;
    const dims=t.fields.filter(f=>f.t!=='text').map(f=>f.t==='stone'?r[f.k]:`${f.label.replace(/ \(.*\)/,'')} ${r[f.k]}`).join(', ');
    lines.push(`${t.rowName} ${i+1}${r.o?` (Outlet ${r.o})`:''}: ${dims} → ${out.res.map(([l,v])=>`${v} ${l}`).join(', ')}`);
  });
  if(k==='stone'&&last.pipe) lines.push(`Minus ${last.pipe.size}" ${last.pipe.type} × ${fmt(last.pipe.len,2)} ft: −${fmtFixed(last.pipe.cy)} CY / −${fmtFixed(last.pipe.tn)} tons`);
  lines.push('TOTAL: '+last.T.map(([l,v,u])=>`${l} ${v} ${u}`).join(' | '));
  return lines.join('\n');
}

window.addEventListener('hashchange',()=>{ const h=location.hash.slice(1).toLowerCase(); if(TABS[h]) go(h,false); });
const h0=location.hash.slice(1).toLowerCase(); if(TABS[h0]) S.tab=h0;
drawTabs(); drawPanel();
})();
