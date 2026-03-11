// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — Módulo Guatecompras v2  (build-75)
// Visual mejorado: cards estilo dashboard, dias restantes, urgentes
// ═══════════════════════════════════════════════════════════════════

function gcEnsureDB(){if(!DB.gcConcursos)DB.gcConcursos=[];if(!DB.gcDescubiertos)DB.gcDescubiertos=[];}

const GC_ETAPAS=['Identificado','Analizando','Cotizando','Documentos','Presentado','Adjudicado','No adjudicado','Archivado'];
const GC_ETAPA_COL={'Identificado':'#607D8B','Analizando':'#1565C0','Cotizando':'#E65100','Documentos':'#6A1B9A','Presentado':'#0288D1','Adjudicado':'#2E7D32','No adjudicado':'#C62828','Archivado':'#9E9E9E'};
const GC_DOCS_BASE=[
  {id:'pat_comercio',label:'Patente de Comercio',cat:'legal'},
  {id:'pat_sociedad',label:'Patente de Sociedad',cat:'legal'},
  {id:'rtu',label:'RTU actualizado',cat:'legal'},
  {id:'acta_nom',label:'Acta nombramiento representante',cat:'legal'},
  {id:'conflicto',label:'Declaración Conflicto de Interés',cat:'legal'},
  {id:'estado_cuenta',label:'Estado de Cuenta Bancario',cat:'financiero'},
  {id:'solvencia_sat',label:'Solvencia SAT',cat:'financiero'},
  {id:'igss',label:'Constancia IGSS al día',cat:'financiero'},
  {id:'oferta_eco',label:'Oferta Económica firmada',cat:'oferta'},
  {id:'oferta_tec',label:'Oferta Técnica',cat:'oferta'},
  {id:'cotizacion',label:'Cotización de precios',cat:'oferta'},
  {id:'muestras',label:'Muestras físicas (si aplica)',cat:'tecnico'},
  {id:'cert_calidad',label:'Certificados de calidad',cat:'tecnico'},
  {id:'foto_prod',label:'Fotografías del producto',cat:'tecnico'},
  {id:'reg_san',label:'Registro Sanitario (si aplica)',cat:'tecnico'},
];
const GC_SCRIPT=(function(){
  var s='(function(){try{';
  s+='var gc={url:window.location.href,nog:"",titulo:"",entidad:"",monto:"",fechaPub:"",fechaCierre:"",modalidad:"",productos:[]};';
  s+='var mn=location.href.match(/nog=([\\w-]+)/i)||location.href.match(/noc=(\\d+)/i);if(mn)gc.nog=mn[1];';
  s+='var all=Array.from(document.querySelectorAll("body *")).filter(function(el){return el.children.length===0&&el.innerText.trim().length>0;});';
  s+='for(var i=0;i<all.length-1;i++){var t=all[i].innerText.trim();var tn=all[i+1].innerText.trim();';
  s+='if(/^Descripci/.test(t))gc.titulo=tn;';
  s+='if(/^Modalidad/.test(t))gc.modalidad=tn;';
  s+='if(/^Entidad:/i.test(t))gc.entidad=tn;';
  s+='if(/^(Monto|Valor estimado)/i.test(t))gc.monto=tn;';
  s+='if(/^Fecha de publicaci/i.test(t))gc.fechaPub=tn;';
  s+='if(/Fecha.*(presentaci|cierre)/i.test(t))gc.fechaCierre=tn;}';
  s+='var seen=[];';
  s+='Array.from(document.querySelectorAll("table")).forEach(function(tbl){';
  s+='var hs=Array.from(tbl.querySelectorAll("th")).map(function(h){return h.innerText.trim();});';
  s+='var hdSet=hs.map(function(h){return h.toLowerCase();});';
  s+='if(!hdSet.some(function(h){return /descripci|producto|cantidad|nombre|rengl/.test(h);}))return;';
  s+='Array.from(tbl.querySelectorAll("tr")).forEach(function(row){';
  s+='var cells=Array.from(row.querySelectorAll("td,th")).map(function(c){return c.innerText.trim();});';
  s+='if(cells.length<2)return;';
  s+='var obj={};cells.forEach(function(v,j){if(hs[j])obj[hs[j]]=v;});';
  s+='var desc=obj["Descripcion"]||obj["Nombre del Producto"]||obj["Nombre"]||Object.values(obj).find(function(v){return v&&v.length>3&&!/^\\d+$/.test(v);})||"";';
  s+='var cant=obj["Cantidad"]||obj["cantidad"]||"";';
  s+='if(!desc||desc.length<2)return;';
  s+='if(/^(nombre|cantidad|descripcion|tipo|unidad|medida|acciones|no\\.|renglon|producto|#)$/i.test(desc.trim()))return;';
  s+='var key=desc.toLowerCase().trim()+"|"+cant;';
  s+='if(seen.indexOf(key)>=0)return;seen.push(key);';
  s+='var num=obj["Renglon"]||obj["No."]||obj["#"]||"";';
  s+='gc.productos.push({_desc:desc,_cant:cant,_num:num});';
  s+='});});';
  s+='var json=JSON.stringify(gc,null,2);';
  s+='try{copy(json);}catch(e){}';
  s+='console.log("AJUA_DATA:",json);';
  s+='alert("AJUA OK!\\nNOG: "+gc.nog+"\\nTitulo: "+gc.titulo.substring(0,55)+"\\nProductos: "+gc.productos.length);';
  s+='}catch(e){alert("ERROR: "+e.message);console.error(e);}})();';
  return s;
})();

let _gcTab='concursos',_gcSegId='',_gcDocsId='',_gcCotId='',_gcEditId=null;

function gcInjectCSS(){
  if(document.getElementById('gc-style2'))return;
  const s=document.createElement('style');s.id='gc-style2';
  s.textContent=`
  #gc-tabs{display:flex;gap:3px;background:#fff;border:1px solid var(--br);border-radius:10px;padding:4px;margin-bottom:16px;flex-wrap:wrap;}
  #gc-tabs .tab{flex:1;min-width:80px;text-align:center;padding:7px 8px;border-radius:7px;cursor:pointer;font-size:.78rem;font-weight:700;border:none;background:transparent;color:var(--muted);transition:all .15s;}
  #gc-tabs .tab.active{background:var(--forest);color:#fff;}
  #gc-tabs .tab:not(.active):hover{background:var(--cream);}
  /* STATS */
  .gc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;}
  .gc-stat{background:#fff;border:1px solid #D0D9E3;border-radius:10px;padding:12px 14px;border-top:3px solid;}
  .gc-stat-n{font-size:2rem;font-weight:800;line-height:1;}
  .gc-stat-l{font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#607D8B;margin-top:3px;}
  /* FILTERS */
  .gc-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;}
  .gc-filters input,.gc-filters select{padding:7px 10px;border:1.5px solid var(--br);border-radius:6px;font-size:.8rem;}
  /* CARD */
  .ocard{background:#fff;border:1px solid #D0D9E3;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,40,100,.07);transition:all .2s;margin-bottom:9px;display:flex;cursor:default;}
  .ocard:hover{box-shadow:0 6px 22px rgba(0,40,100,.13);transform:translateY(-2px);border-color:#BBDEFB;}
  .ocard.ucard{border-color:#FFCDD2;}
  .ocard.vencido{opacity:.6;}
  .ocard.adjudicado{border-color:#A5D6A7;background:#FAFFFE;}
  .obar{width:5px;flex-shrink:0;}
  .obody{flex:1;padding:13px 16px;min-width:0;}
  .otop{display:flex;align-items:flex-start;gap:8px;margin-bottom:9px;flex-wrap:wrap;}
  .opills{display:flex;gap:4px;flex-wrap:wrap;flex:1;}
  .pill{font-size:.62rem;font-weight:700;padding:2px 7px;border-radius:5px;text-transform:uppercase;letter-spacing:.04em;border:1px solid transparent;}
  .p-lic{background:#E3F2FD;color:#1565C0;border-color:#BBDEFB;}
  .p-cot{background:#FFF8E1;color:#E65100;border-color:#FFE082;}
  .p-dir{background:#F3E5F5;color:#6A1B9A;border-color:#CE93D8;}
  .p-urg{background:#FFEBEE;color:#C62828;border-color:#FFCDD2;}
  .p-adj{background:#E8F5E9;color:#2E7D32;border-color:#A5D6A7;}
  .p-venc{background:#ECEFF1;color:#607D8B;border-color:#CFD8DC;}
  .p-etapa{font-size:.6rem;font-weight:700;padding:2px 8px;border-radius:10px;}
  .oactions{display:flex;gap:5px;flex-shrink:0;}
  .otitle{font-size:.88rem;font-weight:700;color:#1C2B3A;margin-bottom:5px;line-height:1.3;}
  .ometa{display:grid;grid-template-columns:repeat(4,1fr);gap:5px 12px;margin-bottom:7px;}
  .mi{display:flex;flex-direction:column;gap:1px;}
  .ml{font-size:.62rem;text-transform:uppercase;letter-spacing:.05em;color:#607D8B;font-weight:600;}
  .mv{font-size:.78rem;color:#1C2B3A;font-weight:500;}
  .mv.urg{color:#C62828;font-weight:700;}
  .nog{font-size:.68rem;font-family:monospace;background:#F0F4F8;border:1px solid #D0D9E3;border-radius:4px;padding:2px 6px;color:#607D8B;display:inline-block;margin-top:2px;}
  .oprods{margin-top:7px;padding-top:7px;border-top:1px solid #EEF2F7;font-size:.74rem;color:#607D8B;}
  .oprods strong{color:#1C2B3A;}
  /* TIMELINE */
  .gc-tl{position:relative;padding-left:20px;border-left:2px solid #D0D9E3;margin-left:8px;display:flex;flex-direction:column;gap:12px;}
  .gc-tl-dot{position:absolute;left:-25px;top:10px;width:10px;height:10px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 2px currentColor;}
  .gc-tl-card{background:#fff;border:1.5px solid #D0D9E3;border-radius:8px;padding:11px 13px;}
  /* DOCS */
  .gc-docs-sec{background:#fff;border:1.5px solid #D0D9E3;border-radius:8px;overflow:hidden;margin-bottom:10px;}
  .gc-docs-hdr{padding:7px 14px;font-size:.72rem;font-weight:700;color:#fff;}
  .gc-doc-row{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid #EEF2F7;flex-wrap:wrap;}
  .gc-doc-row:last-child{border-bottom:none;}
  /* COTIZADOR */
  .gc-cot-tbl{width:100%;border-collapse:collapse;font-size:.78rem;}
  .gc-cot-tbl th{background:var(--forest);color:#fff;padding:8px 9px;text-align:left;white-space:nowrap;}
  .gc-cot-tbl td{padding:7px 9px;border-bottom:1px solid #EEF2F7;vertical-align:middle;}
  .gc-cot-tbl tr:nth-child(even) td{background:#FAFAFA;}
  .gc-cot-tbl tr:hover td{background:#F0F7FF;}
  /* MODAL */
  #gc-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;align-items:center;justify-content:center;}
  #gc-modal.open{display:flex;}
  .gc-mbox{background:#fff;border-radius:12px;padding:22px;width:min(620px,95vw);max-height:90vh;overflow-y:auto;position:relative;}
  @media(max-width:700px){.ometa{grid-template-columns:repeat(2,1fr);}.gc-stats{grid-template-columns:repeat(2,1fr);}}
  `;
  document.head.appendChild(s);
}

function gcDias(f){if(!f)return null;const h=new Date();h.setHours(0,0,0,0);return Math.ceil((new Date(f+'T12:00:00')-h)/86400000);}
function gcDiasLabel(d){if(d===null)return'—';if(d<0)return`Vencido ${Math.abs(d)}d`;if(d===0)return'¡HOY!';if(d===1)return'¡Mañana!';return`${d} días`;}
function gcMpill(mod){if(!mod||mod==='—')return'';const m=mod.toLowerCase();const cls=m.includes('licitac')?'p-lic':m.includes('cotizac')?'p-cot':m.includes('directa')?'p-dir':'p-cot';const lbl=m.includes('licitac')?'Licitación':m.includes('cotizac')?'Cotización':m.includes('directa')?'C.Directa':mod.slice(0,10);return`<span class="pill ${cls}">${lbl}</span>`;}
function gcBarCol(c){const d=gcDias(c.fechaCierre);if(c.adjudicado)return'#2E7D32';if(d!==null&&d<0)return'#9E9E9E';if(d!==null&&d<=3)return'#C62828';if(d!==null&&d<=7)return'#E65100';return GC_ETAPA_COL[c.etapa]||'#1565C0';}

function renderGC(){gcEnsureDB();gcInjectCSS();gcRenderTabs();gcShowTab(_gcTab);}

function gcRenderTabs(){
  const el=document.getElementById('gc-tabs');if(!el)return;
  const act=DB.gcConcursos.filter(c=>c.etapa!=='Archivado').length;
  const descPend=(DB.gcDescubiertos||[]).filter(d=>!d.importado&&!d.descartado).length;
  const tabs=[{id:'concursos',l:'📋 Concursos',b:DB.gcConcursos.length},{id:'seguimiento',l:'⭐ Seguimiento',b:act},{id:'documentos',l:'📁 Documentos'},{id:'cotizador',l:'🧮 Cotizador'},{id:'descubiertos',l:'🔍 Descubiertos',b:descPend,bBg:'#1565C0'},{id:'importar',l:'⬇ Importar'}];
  el.innerHTML=tabs.map(t=>`<button class="tab${_gcTab===t.id?' active':''}" onclick="gcShowTab('${t.id}')">${t.l}${t.b!=null?`<span style="background:${_gcTab===t.id?'rgba(255,255,255,.25)':t.bBg||'rgba(255,255,255,.2)'};color:#fff;border-radius:10px;padding:0 6px;font-size:.65rem;margin-left:4px;">${t.b}</span>`:''}</button>`).join('');
}

function gcShowTab(tab){
  _gcTab=tab;gcRenderTabs();
  const p=document.getElementById('gc-panel');if(!p)return;
  ({concursos:gcTabConcursos,seguimiento:gcTabSeguimiento,documentos:gcTabDocumentos,cotizador:gcTabCotizador,descubiertos:gcTabDescubiertos,importar:gcTabImportar})[tab]?.(p);
}

// ── TAB 1: CONCURSOS ──────────────────────────────────────────
function gcTabConcursos(p){
  gcEnsureDB();
  const total=DB.gcConcursos.length;
  const enProc=DB.gcConcursos.filter(c=>!['Archivado','No adjudicado'].includes(c.etapa)).length;
  const urg=DB.gcConcursos.filter(c=>{const d=gcDias(c.fechaCierre);return d!==null&&d>=0&&d<=7;}).length;
  const adj=DB.gcConcursos.filter(c=>c.adjudicado).length;
  p.innerHTML=`
    <div class="gc-stats">
      <div class="gc-stat" style="border-top-color:#1565C0"><div class="gc-stat-n" style="color:#1565C0">${total}</div><div class="gc-stat-l">Total</div></div>
      <div class="gc-stat" style="border-top-color:#E65100"><div class="gc-stat-n" style="color:#E65100">${enProc}</div><div class="gc-stat-l">En proceso</div></div>
      <div class="gc-stat" style="border-top-color:#C62828"><div class="gc-stat-n" style="color:#C62828">${urg}</div><div class="gc-stat-l">Urgentes ≤7d</div></div>
      <div class="gc-stat" style="border-top-color:#2E7D32"><div class="gc-stat-n" style="color:#2E7D32">${adj}</div><div class="gc-stat-l">Adjudicados</div></div>
    </div>
    <div class="gc-filters">
      <input id="gc-q" placeholder="🔍 Buscar NOG, entidad, título..." oninput="gcFiltrar()" style="min-width:220px;">
      <select id="gc-fe" onchange="gcFiltrar()">
        <option value="">Todas las etapas</option>
        ${GC_ETAPAS.map(e=>`<option>${e}</option>`).join('')}
      </select>
      <select id="gc-fs" onchange="gcFiltrar()">
        <option value="">Todos</option>
        <option value="activo">Solo activos</option>
        <option value="urgente">Urgentes ≤7d</option>
        <option value="vencido">Vencidos</option>
      </select>
      <button class="btn bp bsm" onclick="gcNuevo()" style="margin-left:auto">➕ Nuevo</button>
    </div>
    <div id="gc-lista">${gcRenderCards(DB.gcConcursos)}</div>`;
}

function gcRenderCards(list){
  if(!list.length)return`<div class="empty">Sin concursos — importá o creá uno</div>`;
  return [...list].sort((a,b)=>(gcDias(a.fechaCierre)??999)-(gcDias(b.fechaCierre)??999)).map(c=>{
    const d=gcDias(c.fechaCierre);
    const urg=d!==null&&d>=0&&d<=7;
    const venc=d!==null&&d<0;
    const dc=d===null?'#607D8B':d<0?'#9E9E9E':d<=3?'#C62828':d<=7?'#E65100':'#2E7D32';
    const ec=GC_ETAPA_COL[c.etapa]||'#607D8B';
    const prods=(c.renglones||[]).slice(0,4).map(r=>r.desc).filter(Boolean).join(' · ')+((c.renglones||[]).length>4?` +${c.renglones.length-4}`:'');
    return `<div class="ocard${urg?' ucard':''}${venc?' vencido':''}${c.adjudicado?' adjudicado':''}">
      <div class="obar" style="background:${gcBarCol(c)}"></div>
      <div class="obody">
        <div class="otop">
          <div class="opills">
            ${gcMpill(c.modalidad)}
            ${urg?'<span class="pill p-urg">⚠ Urgente</span>':''}
            ${c.adjudicado?'<span class="pill p-adj">🏆 Adjudicado</span>':''}
            ${venc?'<span class="pill p-venc">Vencido</span>':''}
            <span class="pill p-etapa" style="background:${ec}22;color:${ec};border-color:${ec}44">${c.etapa||'Identificado'}</span>
          </div>
          <div class="oactions">
            <button class="btn bo bsm" onclick="gcVer('${c.id}')" style="font-size:.65rem">Ver →</button>
            <button class="btn bo bsm" onclick="gcEditar('${c.id}')" style="font-size:.65rem">✏️</button>
            <button class="btn bo bsm" onclick="gcEliminar('${c.id}')" style="font-size:.65rem;border-color:var(--danger);color:var(--danger)">✕</button>
          </div>
        </div>
        <div class="otitle">${c.titulo||'Sin título'}</div>
        <div class="ometa">
          <div class="mi"><span class="ml">Entidad</span><span class="mv">${(c.entidad||'—').slice(0,28)}</span></div>
          <div class="mi"><span class="ml">Monto</span><span class="mv" style="color:var(--forest);font-weight:700">${c.monto||'—'}</span></div>
          <div class="mi"><span class="ml">Cierre</span><span class="mv${urg||venc?' urg':''}">${c.fechaCierre||'—'}${urg||venc?' ⚠️':''}</span></div>
          <div class="mi"><span class="ml">Días restantes</span><span class="mv" style="font-weight:800;color:${dc}">${gcDiasLabel(d)}</span></div>
        </div>
        <span class="nog">NOG: ${c.nog||'—'}</span>
        ${prods?`<div class="oprods"><strong>Renglones:</strong> ${prods}</div>`:''}
        ${c.notas?`<div style="margin-top:5px;font-size:.72rem;color:#607D8B;font-style:italic">📝 ${c.notas.slice(0,80)}${c.notas.length>80?'…':''}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

function gcFiltrar(){
  gcEnsureDB();
  const q=(document.getElementById('gc-q')?.value||'').toLowerCase();
  const fe=document.getElementById('gc-fe')?.value||'';
  const fs=document.getElementById('gc-fs')?.value||'';
  let l=[...DB.gcConcursos];
  if(q)l=l.filter(c=>(c.nog+c.titulo+c.entidad).toLowerCase().includes(q));
  if(fe)l=l.filter(c=>c.etapa===fe);
  if(fs==='activo')l=l.filter(c=>{const d=gcDias(c.fechaCierre);return d===null||d>=0;});
  if(fs==='urgente')l=l.filter(c=>{const d=gcDias(c.fechaCierre);return d!==null&&d>=0&&d<=7;});
  if(fs==='vencido')l=l.filter(c=>{const d=gcDias(c.fechaCierre);return d!==null&&d<0;});
  const el=document.getElementById('gc-lista');if(el)el.innerHTML=gcRenderCards(l);
}

function gcNuevo(){_gcEditId=null;gcForm({});}
function gcEditar(id){gcEnsureDB();const c=DB.gcConcursos.find(x=>x.id===id);if(c){_gcEditId=id;gcForm(c);}}

function gcForm(c){
  gcOpenModal(`<div class="gc-mbox">
    <button onclick="gcCM()" style="position:absolute;top:10px;right:12px;background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
    <h3 style="font-family:var(--f-display);margin-bottom:14px;color:var(--forest)">${_gcEditId?'✏️ Editar':'➕ Nuevo'} concurso</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="fg"><label>NOG</label><input id="gcf-nog" value="${c.nog||''}" placeholder="12345-2026"></div>
      <div class="fg"><label>Etapa</label><select id="gcf-etapa">${GC_ETAPAS.map(e=>`<option${c.etapa===e?' selected':''}>${e}</option>`).join('')}</select></div>
      <div class="fg" style="grid-column:1/-1"><label>Título</label><input id="gcf-titulo" value="${c.titulo||''}" placeholder="Descripción del concurso"></div>
      <div class="fg" style="grid-column:1/-1"><label>Entidad</label><input id="gcf-entidad" value="${c.entidad||''}" placeholder="Nombre de la entidad"></div>
      <div class="fg"><label>Monto estimado</label><input id="gcf-monto" value="${c.monto||''}" placeholder="Q 0.00"></div>
      <div class="fg"><label>Modalidad</label><select id="gcf-mod">${['—','Cotización','Licitación','Compra Directa','Subasta Inversa','Convenio Marco'].map(m=>`<option${c.modalidad===m?' selected':''}>${m}</option>`).join('')}</select></div>
      <div class="fg"><label>Fecha publicación</label><input type="date" id="gcf-pub" value="${c.fechaPub||''}"></div>
      <div class="fg"><label>Fecha cierre</label><input type="date" id="gcf-cierre" value="${c.fechaCierre||''}"></div>
      <div class="fg"><label>Responsable</label><select id="gcf-resp"><option value="">— Sin asignar —</option>${(DB.empleados||[]).filter(e=>e.estado==='activo').map(e=>`<option${c.resp===e.nombre?' selected':''}>${e.nombre}</option>`).join('')}</select></div>
      <div class="fg"><label>URL Guatecompras</label><input id="gcf-url" value="${c.url||''}" placeholder="https://..."></div>
      <div class="fg" style="grid-column:1/-1"><label>Notas internas</label><textarea id="gcf-notas" rows="2" style="width:100%;padding:8px;border:1.5px solid var(--br);border-radius:6px;font-size:.85rem;resize:vertical">${c.notas||''}</textarea></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
      <button class="btn bo" onclick="gcCM()">Cancelar</button>
      <button class="btn bp" onclick="gcGuardar()">💾 Guardar</button>
    </div>
  </div>`);
}

function gcGuardar(){
  gcEnsureDB();
  const nog=document.getElementById('gcf-nog')?.value.trim();
  const titulo=document.getElementById('gcf-titulo')?.value.trim();
  if(!nog&&!titulo){toast('⚠ Ingresá NOG o título',true);return;}
  const rec={id:_gcEditId||uid(),ts:now(),nog,titulo,
    entidad:document.getElementById('gcf-entidad')?.value.trim(),
    monto:document.getElementById('gcf-monto')?.value.trim(),
    modalidad:document.getElementById('gcf-mod')?.value,
    fechaPub:document.getElementById('gcf-pub')?.value,
    fechaCierre:document.getElementById('gcf-cierre')?.value,
    resp:document.getElementById('gcf-resp')?.value,
    url:document.getElementById('gcf-url')?.value.trim(),
    notas:document.getElementById('gcf-notas')?.value.trim(),
    etapa:document.getElementById('gcf-etapa')?.value||'Identificado',
  };
  if(_gcEditId){const i=DB.gcConcursos.findIndex(x=>x.id===_gcEditId);if(i>=0)DB.gcConcursos[i]={...DB.gcConcursos[i],...rec};}
  else{rec.docs=GC_DOCS_BASE.map(d=>({...d,estado:'pendiente',obs:''}));rec.renglones=[];rec.actividades=[];DB.gcConcursos.unshift(rec);}
  gcCM();save();gcShowTab('concursos');toast(`✓ ${rec.nog||rec.titulo?.slice(0,20)} guardado`);
}

function gcEliminar(id){
  if(!confirm('¿Eliminar concurso?'))return;
  DB.gcConcursos=DB.gcConcursos.filter(c=>c.id!==id);
  save();gcShowTab('concursos');toast('✓ Eliminado');
}

function gcVer(id){
  gcEnsureDB();
  const c=DB.gcConcursos.find(x=>x.id===id);if(!c)return;
  const d=gcDias(c.fechaCierre);
  const dc=d===null?'#607D8B':d<0?'#9E9E9E':d<=3?'#C62828':d<=7?'#E65100':'#2E7D32';
  const ec=GC_ETAPA_COL[c.etapa]||'#607D8B';
  const ok=(c.docs||[]).filter(x=>x.estado==='listo').length;
  const pend=(c.docs||[]).filter(x=>x.estado==='pendiente').length;
  const totQ=(c.renglones||[]).reduce((s,r)=>s+(r.totalQ||0),0);
  gcOpenModal(`<div class="gc-mbox">
    <button onclick="gcCM()" style="position:absolute;top:10px;right:12px;background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
    <div style="border-left:4px solid ${ec};padding-left:12px;margin-bottom:16px">
      <div style="font-family:monospace;font-size:.68rem;color:var(--muted)">NOG ${c.nog||'—'}</div>
      <div style="font-size:1rem;font-weight:700;color:var(--forest)">${c.titulo||'Sin título'}</div>
      <div style="font-size:.78rem;color:var(--muted)">${c.entidad||'—'}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${[['Etapa',c.etapa||'—',ec],['Días',gcDiasLabel(d),dc],['Monto',c.monto||'—','var(--forest)'],['Docs OK/Pend',ok+'/'+pend,'#1565C0'],['Oferta',totQ?'Q '+totQ.toLocaleString('es-GT',{maximumFractionDigits:2}):'—','var(--forest)'],['Resp',c.resp||'—','var(--ink)']].map(([lbl,val,col])=>`
      <div style="background:var(--cream);border-radius:7px;padding:9px;text-align:center">
        <div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;margin-bottom:2px">${lbl}</div>
        <div style="font-weight:700;color:${col};font-size:.88rem">${val}</div>
      </div>`).join('')}
    </div>
    ${c.notas?`<div style="background:#FFF8E1;border-radius:7px;padding:9px 11px;font-size:.78rem;margin-bottom:12px">📝 ${c.notas}</div>`:''}
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn bp bsm" onclick="gcCM();_gcSegId='${c.id}';gcShowTab('seguimiento')">⭐ Seguimiento</button>
      <button class="btn bp bsm" onclick="gcCM();_gcDocsId='${c.id}';gcShowTab('documentos')">📁 Docs</button>
      <button class="btn bp bsm" onclick="gcCM();_gcCotId='${c.id}';gcShowTab('cotizador')">🧮 Cotizador</button>
      <button class="btn bo bsm" onclick="gcCM();gcEditar('${c.id}')">✏️ Editar</button>
      ${c.url?`<a href="${c.url}" target="_blank" class="btn bo bsm">🔗 Portal</a>`:''}
    </div>
  </div>`);
}

function gcOpenModal(html){const m=document.getElementById('gc-modal');if(!m)return;m.innerHTML=html;m.style.display='flex';m.classList.add('open');}
function gcCM(){const m=document.getElementById('gc-modal');if(!m)return;m.style.display='none';m.classList.remove('open');}
function gcCerrarModal(){gcCM();}

// ── TAB 2: SEGUIMIENTO ────────────────────────────────────────
function gcTabSeguimiento(p){
  gcEnsureDB();
  const activos=DB.gcConcursos.filter(c=>c.etapa!=='Archivado');
  p.innerHTML=`
    <div class="gc-filters">
      <select id="gc-seg-sel" onchange="gcSegLoad(this.value)" style="min-width:280px">
        <option value="">— Seleccionar concurso —</option>
        ${activos.map(c=>`<option value="${c.id}"${_gcSegId===c.id?' selected':''}>${c.nog?'['+c.nog+'] ':''}${(c.titulo||'Sin título').slice(0,45)}</option>`).join('')}
      </select>
      <button class="btn bp bsm" id="gc-sa" style="display:none" onclick="gcSegNueva()">➕ Actividad</button>
      <button class="btn bo bsm" id="gc-se" style="display:none" onclick="gcSegEtapa()">🔄 Etapa</button>
    </div>
    <div id="gc-seg-body">${activos.length?'<div class="empty">Seleccioná un concurso</div>':'<div class="empty">Sin concursos activos</div>'}</div>`;
  if(_gcSegId)gcSegLoad(_gcSegId);
}

function gcSegLoad(id){
  _gcSegId=id;
  ['gc-sa','gc-se'].forEach(i=>{const el=document.getElementById(i);if(el)el.style.display=id?'':'none';});
  const body=document.getElementById('gc-seg-body');if(!body||!id)return;
  gcEnsureDB();
  const c=DB.gcConcursos.find(x=>x.id===id);if(!c)return;
  const acts=[...(c.actividades||[])].reverse();
  const ec=GC_ETAPA_COL[c.etapa]||'#607D8B';
  body.innerHTML=`
    <div class="ocard" style="margin-bottom:14px">
      <div class="obar" style="background:${ec}"></div>
      <div class="obody" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div><div style="font-weight:700">${(c.titulo||'').slice(0,60)}</div><div style="font-size:.74rem;color:var(--muted)">${c.entidad||'—'}</div></div>
        <span class="pill p-etapa" style="background:${ec}22;color:${ec};border-color:${ec}44;padding:3px 10px">${c.etapa}</span>
      </div>
    </div>
    ${!acts.length?'<div class="empty">Sin actividades aún</div>':`<div class="gc-tl">${acts.map(a=>{const col=GC_ETAPA_COL[a.etapa]||'#607D8B';return`<div style="position:relative">
      <div class="gc-tl-dot" style="color:${col};background:${col}"></div>
      <div class="gc-tl-card">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div style="flex:1">
            <div style="font-size:.66rem;color:var(--muted);margin-bottom:2px">${a.fecha||''} · ${a.quien||''}</div>
            <div style="font-weight:600;font-size:.86rem">${a.accion||''}</div>
            ${a.detalle?`<div style="font-size:.76rem;color:var(--muted);margin-top:2px">${a.detalle}</div>`:''}
          </div>
          <div style="display:flex;gap:5px;align-items:flex-start">
            ${a.etapa?`<span class="pill p-etapa" style="background:${col}22;color:${col};border-color:${col}44">${a.etapa}</span>`:''}
            <button class="btn bo bsm" onclick="gcSegDel('${c.id}','${a.id}')" style="font-size:.6rem;border-color:var(--danger);color:var(--danger)">✕</button>
          </div>
        </div>
        ${a.proximo?`<div style="margin-top:6px;padding:5px 9px;background:#FFF8E1;border-radius:5px;font-size:.73rem"><strong>📌</strong> ${a.proximo}</div>`:''}
      </div>
    </div>`;}).join('')}</div>`}`;
}

function gcSegNueva(){
  if(!_gcSegId){toast('⚠ Seleccioná un concurso',true);return;}
  gcEnsureDB();
  const c=DB.gcConcursos.find(x=>x.id===_gcSegId);if(!c)return;
  gcOpenModal(`<div class="gc-mbox">
    <button onclick="gcCM()" style="position:absolute;top:10px;right:12px;background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
    <h3 style="font-family:var(--f-display);margin-bottom:14px;color:var(--forest)">➕ Nueva actividad</h3>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="fg"><label>Acción realizada</label><input id="gca-acc" placeholder="Ej: Revisión de bases..."></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="fg"><label>Fecha</label><input type="date" id="gca-fecha" value="${today()}"></div>
        <div class="fg"><label>Responsable</label><select id="gca-quien"><option value="">— —</option>${(DB.empleados||[]).filter(e=>e.estado==='activo').map(e=>`<option>${e.nombre}</option>`).join('')}</select></div>
      </div>
      <div class="fg"><label>Detalle</label><textarea id="gca-det" rows="2" style="width:100%;padding:8px;border:1.5px solid var(--br);border-radius:6px;font-size:.85rem;resize:vertical"></textarea></div>
      <div class="fg"><label>Próximo paso</label><input id="gca-prox" placeholder="Ej: Enviar oferta el lunes"></div>
      <div class="fg"><label>Cambiar etapa a</label><select id="gca-etapa"><option value="">— Sin cambio —</option>${GC_ETAPAS.map(e=>`<option${c.etapa===e?' selected':''}>${e}</option>`).join('')}</select></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
      <button class="btn bo" onclick="gcCM()">Cancelar</button>
      <button class="btn bp" onclick="gcSegGuardar('${c.id}')">💾 Guardar</button>
    </div>
  </div>`);
}

function gcSegGuardar(cid){
  gcEnsureDB();
  const c=DB.gcConcursos.find(x=>x.id===cid);if(!c)return;
  const acc=document.getElementById('gca-acc')?.value.trim();
  if(!acc){toast('⚠ Ingresá la acción',true);return;}
  if(!c.actividades)c.actividades=[];
  const ne=document.getElementById('gca-etapa')?.value;
  c.actividades.push({id:uid(),fecha:document.getElementById('gca-fecha')?.value||today(),quien:document.getElementById('gca-quien')?.value||'',accion:acc,detalle:document.getElementById('gca-det')?.value.trim(),proximo:document.getElementById('gca-prox')?.value.trim(),etapa:ne||c.etapa});
  if(ne&&ne!==c.etapa){c.etapa=ne;if(ne==='Adjudicado')c.adjudicado=true;}
  gcCM();save();gcSegLoad(cid);gcRenderTabs();toast('✓ Actividad guardada');
}

function gcSegDel(cid,aid){gcEnsureDB();const c=DB.gcConcursos.find(x=>x.id===cid);if(!c)return;c.actividades=(c.actividades||[]).filter(a=>a.id!==aid);save();gcSegLoad(cid);toast('✓ Eliminado');}

function gcSegEtapa(){
  if(!_gcSegId)return;gcEnsureDB();
  const c=DB.gcConcursos.find(x=>x.id===_gcSegId);if(!c)return;
  gcOpenModal(`<div class="gc-mbox" style="max-width:320px">
    <button onclick="gcCM()" style="position:absolute;top:10px;right:12px;background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
    <h3 style="font-family:var(--f-display);margin-bottom:14px;color:var(--forest)">🔄 Cambiar etapa</h3>
    <div class="fg" style="margin-bottom:14px"><label>Nueva etapa</label>
      <select id="gc-ne">${GC_ETAPAS.map(e=>`<option${c.etapa===e?' selected':''}>${e}</option>`).join('')}</select>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn bo" onclick="gcCM()">Cancelar</button>
      <button class="btn bp" onclick="gcSegSetEtapa('${c.id}')">Guardar</button>
    </div>
  </div>`);
}

function gcSegSetEtapa(cid){gcEnsureDB();const c=DB.gcConcursos.find(x=>x.id===cid);if(!c)return;const ne=document.getElementById('gc-ne')?.value;if(!ne)return;c.etapa=ne;if(ne==='Adjudicado')c.adjudicado=true;gcCM();save();gcSegLoad(cid);gcRenderTabs();toast(`✓ Etapa → ${ne}`);}

// ── TAB 3: DOCUMENTOS ────────────────────────────────────────
function gcTabDocumentos(p){
  gcEnsureDB();
  p.innerHTML=`
    <div class="gc-filters">
      <select id="gc-ds" onchange="gcDocsLoad(this.value)" style="min-width:280px">
        <option value="">— Seleccionar concurso —</option>
        ${DB.gcConcursos.map(c=>`<option value="${c.id}"${_gcDocsId===c.id?' selected':''}>${c.nog?'['+c.nog+'] ':''}${(c.titulo||'').slice(0,45)}</option>`).join('')}
      </select>
    </div>
    <div id="gc-docs-body">${DB.gcConcursos.length?'<div class="empty">Seleccioná un concurso</div>':'<div class="empty">Sin concursos</div>'}</div>`;
  if(_gcDocsId)gcDocsLoad(_gcDocsId);
}

function gcDocsLoad(id){
  _gcDocsId=id;
  const body=document.getElementById('gc-docs-body');if(!body||!id)return;
  gcEnsureDB();
  const c=DB.gcConcursos.find(x=>x.id===id);if(!c)return;
  if(!c.docs?.length)c.docs=GC_DOCS_BASE.map(d=>({...d,estado:'pendiente',obs:''}));
  const ok=c.docs.filter(d=>d.estado==='listo').length;
  const pct=Math.round(ok/c.docs.length*100);
  const pc=pct===100?'#2E7D32':pct>=60?'#E65100':'#C62828';
  body.innerHTML=`
    <div class="ocard" style="margin-bottom:14px">
      <div class="obar" style="background:${pc}"></div>
      <div class="obody" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div><div style="font-weight:700">${(c.titulo||'').slice(0,60)}</div><div style="font-size:.74rem;color:var(--muted)">NOG ${c.nog||'—'}</div></div>
        <div style="text-align:right"><div style="font-size:1.5rem;font-weight:800;color:${pc};line-height:1">${pct}%</div><div style="font-size:.65rem;color:var(--muted)">${ok}/${c.docs.length} listos</div></div>
      </div>
      <div style="width:100%;background:#D0D9E3;height:5px"><div style="height:100%;background:${pc};width:${pct}%;transition:width .4s"></div></div>
    </div>
    ${['legal','financiero','oferta','tecnico'].map(cat=>{
      const CL={legal:'⚖️ Legal',financiero:'💰 Financiero',oferta:'📋 Oferta',tecnico:'🔬 Técnico'}[cat];
      const CC={legal:'#1565C0',financiero:'#2E7D32',oferta:'#E65100',tecnico:'#6A1B9A'}[cat];
      return`<div class="gc-docs-sec">
        <div class="gc-docs-hdr" style="background:${CC}">${CL}</div>
        ${c.docs.filter(d=>d.cat===cat).map(d=>`<div class="gc-doc-row">
          <select onchange="gcDSet('${c.id}','${d.id}',this.value)" style="padding:4px 7px;border:1.5px solid var(--br);border-radius:5px;font-size:.74rem;background:${d.estado==='listo'?'#E8F5E9':d.estado==='no-aplica'?'#F5F5F5':'#FFF8E1'}">
            <option value="pendiente"${d.estado==='pendiente'?' selected':''}>⏳ Pendiente</option>
            <option value="en-proceso"${d.estado==='en-proceso'?' selected':''}>🔄 En proceso</option>
            <option value="listo"${d.estado==='listo'?' selected':''}>✅ Listo</option>
            <option value="no-aplica"${d.estado==='no-aplica'?' selected':''}>— N/A</option>
          </select>
          <span style="flex:1;font-size:.82rem">${d.label}</span>
          <input placeholder="Obs." value="${d.obs||''}" onchange="gcDObs('${c.id}','${d.id}',this.value)" style="width:130px;padding:4px 7px;border:1.5px solid var(--br);border-radius:5px;font-size:.72rem">
        </div>`).join('')}
      </div>`;
    }).join('')}
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn bp bsm" onclick="gcDTodos('${c.id}','listo')">✅ Todos listos</button>
      <button class="btn bo bsm" onclick="gcDTodos('${c.id}','pendiente')">↺ Resetear</button>
    </div>`;
}

function gcDSet(cid,did,est){gcEnsureDB();const c=DB.gcConcursos.find(x=>x.id===cid);if(!c)return;const d=(c.docs||[]).find(x=>x.id===did);if(d){d.estado=est;save();}}
function gcDObs(cid,did,obs){gcEnsureDB();const c=DB.gcConcursos.find(x=>x.id===cid);if(!c)return;const d=(c.docs||[]).find(x=>x.id===did);if(d){d.obs=obs;save();}}
function gcDTodos(cid,est){gcEnsureDB();const c=DB.gcConcursos.find(x=>x.id===cid);if(!c)return;(c.docs||[]).forEach(d=>d.estado=est);save();gcDocsLoad(cid);toast(`✓ Todos → ${est}`);}

// ── TAB 4: COTIZADOR ─────────────────────────────────────────
function gcTabCotizador(p){
  gcEnsureDB();
  p.innerHTML=`
    <div class="gc-filters">
      <select id="gc-cs" onchange="gcCotLoad(this.value)" style="min-width:280px">
        <option value="">— Seleccionar concurso —</option>
        ${DB.gcConcursos.map(c=>`<option value="${c.id}"${_gcCotId===c.id?' selected':''}>${c.nog?'['+c.nog+'] ':''}${(c.titulo||'').slice(0,45)}</option>`).join('')}
      </select>
    </div>
    <div id="gc-cot-body"><div class="empty">Seleccioná un concurso para cotizar</div></div>`;
  if(_gcCotId)gcCotLoad(_gcCotId);
}

function gcCotLoad(id){
  _gcCotId=id;
  const body=document.getElementById('gc-cot-body');if(!body||!id)return;
  gcEnsureDB();const c=DB.gcConcursos.find(x=>x.id===id);if(!c)return;
  if(!c.renglones)c.renglones=[];
  gcCotRender(c,body);
}

function gcCotRender(c,body){
  const totQ=c.renglones.reduce((s,r)=>s+(r.totalQ||0),0);
  const totC=c.renglones.reduce((s,r)=>s+(r.totalCosto||0),0);
  const mg=totQ>0?((totQ-totC)/totQ*100).toFixed(1):0;
  const mc=parseFloat(mg)>=15?'#2E7D32':parseFloat(mg)>=5?'#E65100':'#C62828';
  body.innerHTML=`
    <div class="ocard" style="margin-bottom:14px">
      <div class="obar" style="background:var(--forest)"></div>
      <div class="obody">
        <div style="font-weight:700;margin-bottom:3px">${(c.titulo||'').slice(0,70)}</div>
        <div style="font-size:.74rem;color:var(--muted);margin-bottom:10px">NOG ${c.nog||'—'} · ${c.entidad||'—'}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <div style="background:var(--cream);border-radius:7px;padding:9px;text-align:center"><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;margin-bottom:2px">Total oferta</div><div style="font-weight:800;color:var(--forest)">Q ${totQ.toLocaleString('es-GT',{minimumFractionDigits:2})}</div></div>
          <div style="background:var(--cream);border-radius:7px;padding:9px;text-align:center"><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;margin-bottom:2px">Costo total</div><div style="font-weight:700">Q ${totC.toLocaleString('es-GT',{minimumFractionDigits:2})}</div></div>
          <div style="background:var(--cream);border-radius:7px;padding:9px;text-align:center"><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;margin-bottom:2px">Margen</div><div style="font-weight:800;color:${mc}">${mg}%</div></div>
        </div>
      </div>
    </div>
    <div style="overflow-x:auto;background:#fff;border:1px solid var(--br);border-radius:8px">
      <table class="gc-cot-tbl"><thead><tr>
        <th>#</th><th>Descripción</th><th>Cant.</th><th>Unidad</th><th>Precio Q</th><th>Costo Q</th><th>Total Q</th><th>Margen</th><th></th>
      </tr></thead><tbody>
        ${c.renglones.map((r,i)=>{
          const mg2=r.precioUnit>0?(((r.precioUnit-r.costoUnit)/r.precioUnit)*100).toFixed(1):'—';
          const mc2=parseFloat(mg2)>=15?'#2E7D32':parseFloat(mg2)>=5?'#E65100':'#C62828';
          return`<tr>
            <td style="font-weight:700;color:var(--muted)">${r.renglon||i+1}</td>
            <td><div style="font-weight:600">${r.desc||'—'}</div>${r.especificaciones?`<div style="font-size:.68rem;color:var(--muted)">${r.especificaciones}</div>`:''}</td>
            <td style="text-align:right">${r.cantidad||0}</td>
            <td>${r.unidad||'—'}</td>
            <td style="text-align:right;font-weight:600">Q ${(r.precioUnit||0).toLocaleString('es-GT',{minimumFractionDigits:2})}</td>
            <td style="text-align:right">Q ${(r.costoUnit||0).toLocaleString('es-GT',{minimumFractionDigits:2})}</td>
            <td style="text-align:right;font-weight:700;color:var(--forest)">Q ${(r.totalQ||0).toLocaleString('es-GT',{minimumFractionDigits:2})}</td>
            <td style="text-align:right;font-weight:700;color:${mc2}">${mg2}%</td>
            <td><div style="display:flex;gap:3px">
              <button class="btn bo bsm" onclick="gcCotForm('${c.id}','${r.id}')" style="font-size:.6rem">✏️</button>
              <button class="btn bo bsm" onclick="gcCotDel('${c.id}','${r.id}')" style="font-size:.6rem;border-color:var(--danger);color:var(--danger)">✕</button>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody></table>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      <button class="btn bp bsm" onclick="gcCotForm('${c.id}',null)">➕ Renglón</button>
      <button class="btn bo bsm" onclick="gcCotExp('${c.id}')">📊 Exportar CSV</button>
    </div>`;
}

function gcCotForm(cid,rId){
  gcEnsureDB();const c=DB.gcConcursos.find(x=>x.id===cid);if(!c)return;
  const r=rId?(c.renglones||[]).find(x=>x.id===rId):null;
  gcOpenModal(`<div class="gc-mbox">
    <button onclick="gcCM()" style="position:absolute;top:10px;right:12px;background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
    <h3 style="font-family:var(--f-display);margin-bottom:14px;color:var(--forest)">${r?'✏️ Editar':'➕ Nuevo'} renglón</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="fg"><label>Nº Renglón</label><input id="gcr-n" type="number" value="${r?.renglon||((c.renglones||[]).length+1)}"></div>
      <div class="fg"><label>Unidad</label><select id="gcr-u">${['Unidad','Caja','Bolsa','Red','Quintal','Libra','Kilogramo','Docena','Saco'].map(u=>`<option${r?.unidad===u?' selected':''}>${u}</option>`).join('')}</select></div>
      <div class="fg" style="grid-column:1/-1"><label>Descripción</label><input id="gcr-d" value="${r?.desc||''}" placeholder="Ej: Cebolla blanca en red 2 lb"></div>
      <div class="fg" style="grid-column:1/-1"><label>Especificaciones</label><textarea id="gcr-e" rows="2" style="width:100%;padding:8px;border:1.5px solid var(--br);border-radius:6px;font-size:.85rem;resize:vertical">${r?.especificaciones||''}</textarea></div>
      <div class="fg"><label>Cantidad</label><input id="gcr-c" type="number" value="${r?.cantidad||''}" oninput="gcCC()"></div>
      <div class="fg"><label>Precio oferta Q</label><input id="gcr-p" type="number" step="0.01" value="${r?.precioUnit||''}" oninput="gcCC()"></div>
      <div class="fg"><label>Costo unitario Q</label><input id="gcr-k" type="number" step="0.01" value="${r?.costoUnit||''}" oninput="gcCC()"></div>
      <div class="fg"><label>Notas</label><input id="gcr-no" value="${r?.notas||''}"></div>
    </div>
    <div id="gcr-prev" style="display:none;margin-top:10px;padding:9px;background:var(--cream);border-radius:7px"></div>
    <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
      <button class="btn bo" onclick="gcCM()">Cancelar</button>
      <button class="btn bp" onclick="gcCotG('${cid}','${rId||''}')">💾 Guardar</button>
    </div>
  </div>`);gcCC();
}

function gcCC(){
  const c=parseFloat(document.getElementById('gcr-c')?.value)||0;
  const p=parseFloat(document.getElementById('gcr-p')?.value)||0;
  const k=parseFloat(document.getElementById('gcr-k')?.value)||0;
  const tQ=c*p,tC=c*k,mg=p>0?((p-k)/p*100).toFixed(1):0;
  const mc=parseFloat(mg)>=15?'#2E7D32':parseFloat(mg)>=5?'#E65100':'#C62828';
  const prev=document.getElementById('gcr-prev');
  if(prev&&c>0){prev.style.display='block';prev.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;font-size:.82rem">
    <div><div style="font-size:.6rem;color:var(--muted)">TOTAL OFERTA</div><div style="font-weight:700;color:var(--forest)">Q ${tQ.toLocaleString('es-GT',{minimumFractionDigits:2})}</div></div>
    <div><div style="font-size:.6rem;color:var(--muted)">COSTO</div><div style="font-weight:700">Q ${tC.toLocaleString('es-GT',{minimumFractionDigits:2})}</div></div>
    <div><div style="font-size:.6rem;color:var(--muted)">MARGEN</div><div style="font-weight:700;color:${mc}">${mg}%</div></div>
  </div>`;}
}

function gcCotG(cid,rId){
  gcEnsureDB();const c=DB.gcConcursos.find(x=>x.id===cid);if(!c)return;
  if(!c.renglones)c.renglones=[];
  const desc=document.getElementById('gcr-d')?.value.trim();if(!desc){toast('⚠ Ingresá descripción',true);return;}
  const cant=parseFloat(document.getElementById('gcr-c')?.value)||0;
  const prec=parseFloat(document.getElementById('gcr-p')?.value)||0;
  const cost=parseFloat(document.getElementById('gcr-k')?.value)||0;
  const rec={id:rId||uid(),renglon:parseInt(document.getElementById('gcr-n')?.value)||c.renglones.length+1,desc,especificaciones:document.getElementById('gcr-e')?.value.trim(),unidad:document.getElementById('gcr-u')?.value,cantidad:cant,precioUnit:prec,costoUnit:cost,totalQ:cant*prec,totalCosto:cant*cost,notas:document.getElementById('gcr-no')?.value.trim()};
  if(rId){const i=c.renglones.findIndex(x=>x.id===rId);if(i>=0)c.renglones[i]=rec;}else c.renglones.push(rec);
  gcCM();save();const body=document.getElementById('gc-cot-body');if(body)gcCotRender(c,body);toast('✓ Renglón guardado');
}

function gcCotDel(cid,rId){gcEnsureDB();const c=DB.gcConcursos.find(x=>x.id===cid);if(!c)return;c.renglones=(c.renglones||[]).filter(x=>x.id!==rId);save();const body=document.getElementById('gc-cot-body');if(body)gcCotRender(c,body);toast('✓ Eliminado');}

function gcCotExp(cid){
  gcEnsureDB();const c=DB.gcConcursos.find(x=>x.id===cid);
  if(!c?.renglones?.length){toast('⚠ Sin renglones',true);return;}
  const hdrs=['Renglón','Descripción','Especificaciones','Cantidad','Unidad','Precio Q','Costo Q','Total Q','Total Costo Q','Margen %'];
  const rows=c.renglones.map(r=>[r.renglon,r.desc,r.especificaciones,r.cantidad,r.unidad,r.precioUnit,r.costoUnit,r.totalQ,r.totalCosto,r.precioUnit>0?((r.precioUnit-r.costoUnit)/r.precioUnit*100).toFixed(1)+'%':'—']);
  const tQ=c.renglones.reduce((s,r)=>s+(r.totalQ||0),0),tC=c.renglones.reduce((s,r)=>s+(r.totalCosto||0),0);
  rows.push(['','','','','','','TOTAL',tQ.toFixed(2),tC.toFixed(2),tQ>0?((tQ-tC)/tQ*100).toFixed(1)+'%':'—']);
  const csv=[hdrs,...rows].map(r=>r.map(v=>`"${v||''}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));a.download=`Cotizacion_NOG${c.nog||'SN'}_${today()}.csv`;a.click();toast('✓ CSV exportado');
}

// ── TAB 5: IMPORTAR ───────────────────────────────────────────
function gcTabImportar(p){
  p.innerHTML=`<div style="max-width:660px">
    <div style="background:#fff;border:1.5px solid var(--br);border-radius:10px;padding:18px;margin-bottom:14px">
      <h4 style="font-family:var(--f-display);color:var(--forest);margin-bottom:10px">📋 Cómo importar desde Guatecompras.gt</h4>
      <ol style="font-size:.83rem;line-height:2.1;color:var(--muted);padding-left:18px">
        <li>Abrí <a href="https://www.guatecompras.gt" target="_blank" style="color:var(--canopy)">guatecompras.gt</a> y buscá el concurso</li>
        <li>Presioná <strong>F12 → Consola</strong></li>
        <li>Copiá el script y pegálo en consola</li>
        <li>El JSON se copia solo al clipboard</li>
        <li>Pegálo abajo y presioná <strong>Importar</strong></li>
      </ol>
    </div>
    <div style="background:#0D1117;border-radius:8px;padding:11px 13px;margin-bottom:14px">
      <div style="font-size:.6rem;color:#58A6FF;font-family:monospace;margin-bottom:5px">// Script para consola F12</div>
      <div style="font-size:.68rem;color:#E6EDF3;font-family:monospace;line-height:1.5;word-break:break-all;max-height:55px;overflow:hidden;opacity:.8">${GC_SCRIPT.slice(0,150)}...</div>
      <button onclick="gcCopScript()" style="margin-top:8px;background:#238636;color:#fff;border:none;padding:5px 13px;border-radius:5px;font-size:.72rem;cursor:pointer;font-weight:600">📋 Copiar script completo</button>
    </div>
    <div style="background:#fff;border:1.5px solid var(--br);border-radius:10px;padding:18px">
      <label style="font-weight:600;font-size:.83rem;display:block;margin-bottom:7px">Pegá el JSON aquí:</label>
      <textarea id="gc-ij" rows="7" style="width:100%;padding:9px;border:1.5px solid var(--br);border-radius:6px;font-family:monospace;font-size:.72rem;resize:vertical" placeholder='{ "nog": "12345-2026", "titulo": "...", ... }'></textarea>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn bp" onclick="gcImport()">⬇ Importar concurso</button>
        <button class="btn bo bsm" onclick="document.getElementById('gc-ij').value=''">Limpiar</button>
      </div>
      <div id="gc-is" style="margin-top:9px;font-size:.8rem"></div>
    </div>
  </div>`;
}

function gcCopScript(){
  if(navigator.clipboard)navigator.clipboard.writeText(GC_SCRIPT).then(()=>toast('✓ Script copiado'));
  else{const t=document.createElement('textarea');t.value=GC_SCRIPT;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);toast('✓ Script copiado');}
}

function gcImport(){
  const raw=document.getElementById('gc-ij')?.value.trim();if(!raw){toast('⚠ Pegá el JSON',true);return;}
  let data;try{data=JSON.parse(raw);}catch(e){toast('⚠ JSON inválido',true);return;}
  gcEnsureDB();
  const st=document.getElementById('gc-is');
  if(data.nog&&DB.gcConcursos.find(c=>c.nog===data.nog)){
    if(st)st.innerHTML=`<span style="color:#E65100">⚠ NOG ${data.nog} ya existe. <button class="btn bo bsm" onclick="gcImportF(${JSON.stringify(data).replace(/"/g,'&quot;')})">Actualizar igual</button></span>`;
    return;
  }
  gcImportF(data);
}

function gcImportF(data){
  gcEnsureDB();
  const rec={id:uid(),ts:now(),nog:data.nog||'',titulo:data.titulo||data.title||'Sin título',
    entidad:data.entidad||'—',monto:data.monto||'',modalidad:data.modalidad||'—',
    fechaPub:data.fechaPub||'',fechaCierre:data.fechaCierre||data.fechaOfertas||'',
    url:data.url||'',etapa:'Identificado',notas:'',
    docs:GC_DOCS_BASE.map(d=>({...d,estado:'pendiente',obs:''})),
    renglones:(data.productos||[]).map((p,i)=>({id:uid(),
      renglon:parseInt(p._num||p['Renglón']||p['No.']||p['#']||i+1)||i+1,
      desc:p._desc||p['Descripción']||p['Descripcion']||p['descripcion']||p['Nombre del Producto']||p['Nombre']||Object.values(p).find(v=>v&&v.length>3&&!/^\d+$/.test(v))||'',
      especificaciones:p['Especificaciones']||p.especificaciones||p['Descripción Técnica']||'',
      cantidad:parseFloat(p._cant||p.Cantidad||p.cantidad||0)||0,
      unidad:p.Unidad||p['Unidad de Medida']||p.unidad||'Unidad',
      precioUnit:0,costoUnit:0,totalQ:0,totalCosto:0,
    })).filter(r=>r.desc&&r.desc.length>1&&!/^(nombre|cantidad|descripci[oó]n?|tipo de producto|unidad(?: de medida)?|acciones|no\.|rengl[oó]n|#|producto|costo|precio|total)$/i.test(r.desc.trim())),actividades:[],
  };
  DB.gcConcursos.unshift(rec);save();
  const st=document.getElementById('gc-is');
  if(st)st.innerHTML=`<span style="color:#2E7D32">✅ Importado — ${rec.renglones.length} renglones detectados</span>`;
  if(document.getElementById('gc-ij'))document.getElementById('gc-ij').value='';
  toast(`✓ NOG ${rec.nog} importado`);
  setTimeout(()=>{_gcCotId=rec.id;gcShowTab('cotizador');},1200);
}

// ── TAB DESCUBIERTOS ──────────────────────────────────────────────────────────
var _gcDescFiltro='pendientes';

function gcTabDescubiertos(p){
  gcEnsureDB();
  const all=DB.gcDescubiertos||[];
  const pend=all.filter(d=>!d.importado&&!d.descartado);
  const imp=all.filter(d=>d.importado);
  const desc=all.filter(d=>d.descartado&&!d.importado);
  const filtros=[
    {id:'pendientes',l:'🔍 Nuevos',n:pend.length,c:'#1565C0'},
    {id:'importados',l:'✅ Importados',n:imp.length,c:'#2E7D32'},
    {id:'descartados',l:'🗑 Descartados',n:desc.length,c:'#757575'},
    {id:'todos',l:'📋 Todos',n:all.length,c:'#37474F'},
  ];
  const lista=_gcDescFiltro==='pendientes'?pend:_gcDescFiltro==='importados'?imp:_gcDescFiltro==='descartados'?desc:all;
  lista.sort((a,b)=>(a.fechaCierre||'9999')<(b.fechaCierre||'9999')?-1:1);

  p.innerHTML=`<div style="max-width:860px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h4 style="font-family:var(--f-display);color:var(--forest);margin:0 0 2px">🔍 Concursos Descubiertos</h4>
        <div style="font-size:.75rem;color:var(--muted)">Detectados por el scraper automático de Guatecompras</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn bo bsm" onclick="gcDescRefresh()">↻ Actualizar</button>
        <button class="btn bp bsm" onclick="gcDescImportarTodos()" ${pend.length===0?'disabled':''}>⬇ Importar todos (${pend.length})</button>
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${filtros.map(f=>`<button onclick="gcDescSetFiltro('${f.id}')" style="border:none;padding:5px 12px;border-radius:20px;font-size:.75rem;cursor:pointer;font-weight:600;background:${_gcDescFiltro===f.id?f.c:'#EEF2F7'};color:${_gcDescFiltro===f.id?'#fff':'#37474F'}">${f.l} ${f.n}</button>`).join('')}
    </div>
    ${lista.length===0?`
    <div style="background:#fff;border:1.5px solid var(--br);border-radius:10px;padding:40px;text-align:center">
      <div style="font-size:2rem;margin-bottom:10px">${_gcDescFiltro==='pendientes'?'🎉':'📭'}</div>
      <div style="font-weight:600;color:var(--forest);margin-bottom:6px">${_gcDescFiltro==='pendientes'?'Sin concursos nuevos todavía':'Sin resultados'}</div>
      <div style="font-size:.78rem;color:var(--muted)">${_gcDescFiltro==='pendientes'?'El scraper corre cada mañana (lun–vie) y busca concursos activos de vegetales y frutas':'Cambiá el filtro para ver otros'}</div>
    </div>`:`<div style="display:grid;gap:10px">${lista.map(d=>gcDescCard(d)).join('')}</div>`}
    <div style="background:#F8F9FA;border:1.5px solid #DEE2E6;border-radius:8px;padding:12px 16px;margin-top:16px;font-size:.75rem;color:#6C757D">
      <strong style="color:#37474F">⚙️ Cómo funciona:</strong>
      El scraper corre automáticamente lun–vie a las 6am. Busca en Guatecompras por palabras clave: verduras, hortalizas, frutas, alimentos.
      Los nuevos aparecen aquí para que vos decidás cuáles importar.
      <a href="https://github.com/ajua-bpm/gc-scraper/actions" target="_blank" style="color:#1565C0;font-weight:600;margin-left:6px">Ver logs →</a>
    </div>
  </div>`;
}

function gcDescCard(d){
  const dias=gcDias(d.fechaCierre);
  const lbl=gcDiasLabel(dias);
  const urg=dias!==null&&dias>=0&&dias<=7;
  const venc=dias!==null&&dias<0;
  const brd=venc?'#9E9E9E':urg?'#C62828':'var(--br)';
  return `<div style="background:#fff;border:1.5px solid ${brd};border-radius:10px;padding:14px 16px;${d.importado?'background:#F0FFF4;':''}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.88rem;color:var(--forest);margin-bottom:4px;line-height:1.3">${d.titulo||'Sin título'}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-bottom:6px">
          ${d.entidad?`🏛 ${d.entidad} &nbsp;·&nbsp; `:''}${d.nog?`NOG: <strong>${d.nog}</strong> &nbsp;·&nbsp; `:''}${d.modalidad&&d.modalidad!=='—'?gcMpill(d.modalidad)+' &nbsp;·&nbsp; ':''}${d.monto&&d.monto!=='—'?`💰 ${d.monto}`:''}
        </div>
        <div style="display:flex;gap:10px;font-size:.73rem;flex-wrap:wrap">
          ${d.fechaPub?`<span style="color:#546E7A">📅 ${d.fechaPub}</span>`:''}
          ${d.fechaCierre?`<span style="color:${venc?'#9E9E9E':urg?'#C62828':'#1565C0'};font-weight:${urg?'700':'400'}">⏰ Cierra: ${d.fechaCierre} (${lbl})</span>`:''}
          ${d.keyword?`<span style="color:#BDBDBD">🔑 "${d.keyword}"</span>`:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">
        ${d.importado
          ?`<span style="color:#2E7D32;font-size:.75rem;font-weight:600">✅ Importado</span>`
          :d.descartado
          ?`<div style="display:flex;gap:5px;align-items:center">
              <span style="color:#9E9E9E;font-size:.75rem">Descartado</span>
              <button onclick="gcDescReactivar('${d.id}')" style="border:1px solid #9E9E9E;background:#fff;color:#546E7A;padding:3px 8px;border-radius:5px;font-size:.7rem;cursor:pointer">↩ Restaurar</button>
            </div>`
          :`<div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">
              ${d.url?`<a href="${d.url}" target="_blank" class="btn bo bsm" style="font-size:.7rem;text-decoration:none">🔗 Ver</a>`:''}
              <button onclick="gcDescDescartar('${d.id}')" style="border:1px solid #EF5350;background:#fff;color:#C62828;padding:4px 10px;border-radius:5px;font-size:.72rem;cursor:pointer">🗑 Descartar</button>
              <button onclick="gcDescImportar('${d.id}')" style="background:#1565C0;color:#fff;border:none;padding:4px 12px;border-radius:5px;font-size:.72rem;cursor:pointer;font-weight:600">⬇ Importar</button>
            </div>`}
      </div>
    </div>
  </div>`;
}

function gcDescSetFiltro(f){_gcDescFiltro=f;const p=document.getElementById('gc-panel');if(p)gcTabDescubiertos(p);}

function gcDescRefresh(){
  // Solo re-renderiza la vista con los datos en memoria — NO llama save()
  const p=document.getElementById('gc-panel');
  if(p)gcTabDescubiertos(p);
  toast('✓ Vista actualizada');
}

function gcDescImportar(id){
  gcEnsureDB();
  const d=(DB.gcDescubiertos||[]).find(x=>x.id===id);
  if(!d){toast('⚠ No encontrado',true);return;}
  if(d.nog&&DB.gcConcursos.find(c=>c.nog===d.nog)){
    d.importado=true;save();
    toast(`⚠ NOG ${d.nog} ya existe en concursos`,true);
    gcRenderTabs();gcTabDescubiertos(document.getElementById('gc-panel'));
    return;
  }
  gcImportF({
    nog:d.nog||'',titulo:d.titulo||'Sin título',entidad:d.entidad||'—',
    monto:d.monto||'',modalidad:d.modalidad||'—',fechaPub:d.fechaPub||'',
    fechaCierre:d.fechaCierre||'',url:d.url||'',productos:[],
  });
  d.importado=true;save();
  gcRenderTabs();
  gcTabDescubiertos(document.getElementById('gc-panel'));
}

function gcDescImportarTodos(){
  gcEnsureDB();
  const pend=(DB.gcDescubiertos||[]).filter(x=>!x.importado&&!x.descartado);
  if(!pend.length){toast('Sin pendientes',true);return;}
  let n=0;
  for(const d of pend){
    if(d.nog&&DB.gcConcursos.find(c=>c.nog===d.nog)){d.importado=true;continue;}
    gcImportF({
      nog:d.nog||'',titulo:d.titulo||'Sin título',entidad:d.entidad||'—',
      monto:d.monto||'',modalidad:d.modalidad||'—',fechaPub:d.fechaPub||'',
      fechaCierre:d.fechaCierre||'',url:d.url||'',productos:[],
    });
    d.importado=true;n++;
  }
  save();gcRenderTabs();
  toast(`✓ ${n} concursos importados`);
  gcTabDescubiertos(document.getElementById('gc-panel'));
}

function gcDescDescartar(id){
  gcEnsureDB();
  const d=(DB.gcDescubiertos||[]).find(x=>x.id===id);
  if(d){d.descartado=true;save();gcRenderTabs();gcTabDescubiertos(document.getElementById('gc-panel'));}
}

function gcDescReactivar(id){
  gcEnsureDB();
  const d=(DB.gcDescubiertos||[]).find(x=>x.id===id);
  if(d){d.descartado=false;save();gcRenderTabs();gcTabDescubiertos(document.getElementById('gc-panel'));}
}

window.renderGC=renderGC;
