// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — Módulo Guatecompras
// Rol requerido: 'guatecompras' o 'admin'
// build-74
// ═══════════════════════════════════════════════════════════════════

// ── Asegurar colección en DB ─────────────────────────────────────
function gcEnsureDB() {
  if (!DB.gcConcursos)  DB.gcConcursos  = [];
  if (!DB.gcSeguimiento) DB.gcSeguimiento = [];
}

// ── Etapas de seguimiento ─────────────────────────────────────────
const GC_ETAPAS = [
  'Identificado', 'Analizando', 'Cotizando', 'Documentos', 'Presentado', 'Adjudicado', 'No adjudicado', 'Archivado'
];

const GC_ETAPA_COLOR = {
  'Identificado':    '#607D8B',
  'Analizando':      '#1565C0',
  'Cotizando':       '#E65100',
  'Documentos':      '#6A1B9A',
  'Presentado':      '#0288D1',
  'Adjudicado':      '#2E7D32',
  'No adjudicado':   '#C62828',
  'Archivado':       '#9E9E9E',
};

// ── Checklist base de documentos ─────────────────────────────────
const GC_DOCS_BASE = [
  { id:'pat_comercio',   label:'Patente de Comercio',            cat:'legal'   },
  { id:'pat_sociedad',   label:'Patente de Sociedad',            cat:'legal'   },
  { id:'rtu',            label:'RTU actualizado',                 cat:'legal'   },
  { id:'acta_nombramiento', label:'Acta nombramiento representante', cat:'legal' },
  { id:'estado_cuenta',  label:'Estado de Cuenta Bancario',      cat:'financiero' },
  { id:'solvencia_sat',  label:'Solvencia SAT',                  cat:'financiero' },
  { id:'iggs',           label:'Constancia IGSS al día',         cat:'financiero' },
  { id:'declaracion_cr', label:'Declaración Conflicto de Interés',cat:'legal'  },
  { id:'oferta_eco',     label:'Oferta Económica firmada',       cat:'oferta'  },
  { id:'oferta_tec',     label:'Oferta Técnica',                 cat:'oferta'  },
  { id:'cotizacion',     label:'Cotización de precios',          cat:'oferta'  },
  { id:'muestras',       label:'Muestras físicas (si aplica)',   cat:'tecnico' },
  { id:'cert_calidad',   label:'Certificados de calidad',        cat:'tecnico' },
  { id:'foto_producto',  label:'Fotografías del producto',       cat:'tecnico' },
  { id:'registro_san',   label:'Registro Sanitario (si aplica)', cat:'tecnico' },
];

// ── Script para copiar desde Guatecompras.gt ─────────────────────
const GC_SCRIPT_CONSOLA = `var gc={url:window.location.href,nog:'',titulo:'',entidad:'',monto:'',fechaPub:'',fechaCierre:'',estado:'',modalidad:'',productos:[]};var m=location.href.match(/nog=([\\w-]+)/i)||location.href.match(/noc=(\\d+)/i);if(m)gc.nog=m[1];var all=Array.from(document.querySelectorAll('body *')).filter(function(el){return el.children.length===0&&el.innerText.trim().length>0;});for(var i=0;i<all.length;i++){var t=all[i].innerText.trim();if(/Descripci/.test(t)&&all[i+1])gc.titulo=all[i+1].innerText.trim();if(/Modalidad/.test(t)&&all[i+1])gc.modalidad=all[i+1].innerText.trim();if(/Entidad:/i.test(t)&&all[i+1])gc.entidad=all[i+1].innerText.trim();if(/Monto|Valor estimado/i.test(t)&&all[i+1])gc.monto=all[i+1].innerText.trim();if(/Fecha de publicaci/i.test(t)&&all[i+1])gc.fechaPub=all[i+1].innerText.trim();if(/Fecha.*presentaci|Fecha.*cierre/i.test(t)&&all[i+1])gc.fechaCierre=all[i+1].innerText.trim();if(/Estatus|Estado/i.test(t)&&all[i+1])gc.estado=all[i+1].innerText.trim();}document.querySelectorAll('table').forEach(function(tbl){var hs=Array.from(tbl.querySelectorAll('th')).map(function(h){return h.innerText.trim();});if(hs.some(function(h){return/descripci|producto|cantidad|nombre|rengl/i.test(h);})){tbl.querySelectorAll('tr').forEach(function(row){var cells=Array.from(row.querySelectorAll('td'));if(cells.length>=2){var obj={};cells.forEach(function(c,i){if(hs[i])obj[hs[i]]=c.innerText.trim();});if(Object.values(obj).some(function(v){return v&&v.length>1;}))gc.productos.push(obj);}});}});copy(JSON.stringify(gc,null,2));alert('AJUA: Datos copiados!\\nNOG: '+gc.nog+'\\nTitulo: '+gc.titulo.substring(0,60)+'\\nProductos: '+gc.productos.length+'\\n\\nPegalo en el BPM.');`;

// ── Tab activo ────────────────────────────────────────────────────
let _gcTab = 'concursos';
let _gcEditId = null;
let _gcCotizLines = 1;

// ── Render principal ──────────────────────────────────────────────
function renderGC() {
  gcEnsureDB();
  gcRenderTabs();
  gcShowTab(_gcTab);
}

function gcRenderTabs() {
  const tabs = document.getElementById('gc-tabs');
  if (!tabs) return;
  const list = [
    { id:'concursos',    label:'📋 Concursos',   badge: DB.gcConcursos.length },
    { id:'seguimiento',  label:'⭐ Seguimiento',  badge: DB.gcConcursos.filter(c=>c.etapa && c.etapa!=='Archivado').length },
    { id:'documentos',   label:'📁 Documentos' },
    { id:'cotizador',    label:'🧮 Cotizador' },
    { id:'importar',     label:'⬇ Importar' },
  ];
  tabs.innerHTML = list.map(t => `
    <button class="tab${_gcTab===t.id?' active':''}" onclick="gcShowTab('${t.id}')">
      ${t.label}${t.badge!=null?` <span style="background:rgba(255,255,255,.25);border-radius:10px;padding:1px 7px;font-size:.72rem;margin-left:4px;">${t.badge}</span>`:''}
    </button>`).join('');
}

function gcShowTab(tab) {
  _gcTab = tab;
  gcRenderTabs();
  const panel = document.getElementById('gc-panel');
  if (!panel) return;
  if (tab === 'concursos')   gcPanelConcursos(panel);
  if (tab === 'seguimiento') gcPanelSeguimiento(panel);
  if (tab === 'documentos')  gcPanelDocumentos(panel);
  if (tab === 'cotizador')   gcPanelCotizador(panel);
  if (tab === 'importar')    gcPanelImportar(panel);
}

// ════════════════════════════════════════════════════════════════
// TAB 1: CONCURSOS
// ════════════════════════════════════════════════════════════════
function gcPanelConcursos(panel) {
  gcEnsureDB();
  const concursos = [...DB.gcConcursos].sort((a,b) => (a.fechaCierre||'9999').localeCompare(b.fechaCierre||'9999'));

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <input id="gc-buscar" placeholder="🔍 Buscar NOG, entidad, título..." oninput="gcFiltrarConcursos()"
          style="padding:8px 12px;border:1.5px solid var(--br);border-radius:6px;font-size:.82rem;min-width:260px;">
        <select id="gc-filtro-etapa" onchange="gcFiltrarConcursos()"
          style="padding:8px 10px;border:1.5px solid var(--br);border-radius:6px;font-size:.82rem;">
          <option value="">Todas las etapas</option>
          ${GC_ETAPAS.map(e=>`<option value="${e}">${e}</option>`).join('')}
        </select>
      </div>
      <button class="btn bp bsm" onclick="gcNuevoConcurso()">➕ Nuevo concurso</button>
    </div>
    <div id="gc-lista-concursos">
      ${concursos.length ? gcRenderListaConcursos(concursos) : `<div class="empty">Sin concursos registrados — importá uno o creá manualmente</div>`}
    </div>`;
}

function gcRenderListaConcursos(list) {
  return `<div style="display:flex;flex-direction:column;gap:10px;">` +
    list.map(c => {
      const dias = gcDiasRestantes(c.fechaCierre);
      const diasColor = dias <= 3 ? '#C62828' : dias <= 7 ? '#E65100' : dias <= 14 ? '#F9A825' : '#2E7D32';
      const etapaColor = GC_ETAPA_COLOR[c.etapa] || '#607D8B';
      return `
      <div style="background:#fff;border:1.5px solid var(--br);border-radius:10px;padding:14px 16px;border-left:4px solid ${etapaColor};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
              <span style="font-family:var(--f-mono);font-size:.72rem;background:var(--ink);color:#fff;padding:2px 8px;border-radius:4px;">${c.nog || '—'}</span>
              <span style="font-size:.72rem;padding:2px 10px;border-radius:10px;background:${etapaColor}22;color:${etapaColor};font-weight:600;">${c.etapa || 'Identificado'}</span>
              ${c.adjudicado ? `<span style="font-size:.72rem;padding:2px 8px;border-radius:10px;background:#E8F5E9;color:#2E7D32;font-weight:700;">🏆 Adjudicado</span>` : ''}
            </div>
            <div style="font-weight:600;font-size:.92rem;margin-bottom:3px;">${c.titulo || 'Sin título'}</div>
            <div style="font-size:.78rem;color:var(--muted);">${c.entidad || '—'}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:140px;">
            ${c.monto ? `<div style="font-weight:700;font-size:.9rem;color:var(--forest);">${c.monto}</div>` : ''}
            ${c.fechaCierre ? `<div style="font-size:.75rem;font-weight:600;color:${diasColor};">📅 ${dias >= 0 ? `${dias} días` : 'Vencido'} — ${c.fechaCierre}</div>` : ''}
            <div style="display:flex;gap:6px;margin-top:4px;">
              <button class="btn bo bsm" onclick="gcVerConcurso('${c.id}')" style="font-size:.7rem;">👁 Ver</button>
              <button class="btn bo bsm" onclick="gcEditarConcurso('${c.id}')" style="font-size:.7rem;">✏️</button>
              <button class="btn bo bsm" onclick="gcEliminarConcurso('${c.id}')" style="font-size:.7rem;border-color:var(--danger);color:var(--danger);">✕</button>
            </div>
          </div>
        </div>
        ${c.notas ? `<div style="margin-top:8px;font-size:.78rem;color:var(--muted);border-top:1px solid var(--br);padding-top:7px;">📝 ${c.notas}</div>` : ''}
      </div>`;
    }).join('') + `</div>`;
}

function gcFiltrarConcursos() {
  gcEnsureDB();
  const q = document.getElementById('gc-buscar')?.value.toLowerCase() || '';
  const etapa = document.getElementById('gc-filtro-etapa')?.value || '';
  let list = [...DB.gcConcursos];
  if (q) list = list.filter(c => (c.nog+c.titulo+c.entidad).toLowerCase().includes(q));
  if (etapa) list = list.filter(c => c.etapa === etapa);
  list.sort((a,b) => (a.fechaCierre||'9999').localeCompare(b.fechaCierre||'9999'));
  const el = document.getElementById('gc-lista-concursos');
  if (el) el.innerHTML = list.length ? gcRenderListaConcursos(list) : `<div class="empty">Sin resultados</div>`;
}

function gcDiasRestantes(fecha) {
  if (!fecha) return 99;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f = new Date(fecha + 'T12:00:00');
  return Math.ceil((f - hoy) / 86400000);
}

// ── Formulario nuevo / editar concurso ───────────────────────────
function gcNuevoConcurso() {
  _gcEditId = null;
  gcMostrarFormConcurso({});
}

function gcEditarConcurso(id) {
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === id);
  if (c) { _gcEditId = id; gcMostrarFormConcurso(c); }
}

function gcMostrarFormConcurso(c) {
  const modal = document.getElementById('gc-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;width:min(640px,95vw);max-height:90vh;overflow-y:auto;position:relative;">
      <button onclick="gcCerrarModal()" style="position:absolute;top:12px;right:14px;background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--muted);">✕</button>
      <h3 style="font-family:var(--f-display);font-size:1.2rem;margin-bottom:18px;color:var(--forest);">
        ${_gcEditId ? '✏️ Editar concurso' : '➕ Nuevo concurso'}
      </h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="fg"><label>NOG / Número</label><input id="gcf-nog" value="${c.nog||''}" placeholder="Ej: 12-2026"></div>
        <div class="fg"><label>Etapa actual</label>
          <select id="gcf-etapa">
            ${GC_ETAPAS.map(e=>`<option value="${e}" ${c.etapa===e?'selected':''}>${e}</option>`).join('')}
          </select>
        </div>
        <div class="fg" style="grid-column:1/-1"><label>Título / Descripción</label><input id="gcf-titulo" value="${c.titulo||''}" placeholder="Descripción del concurso"></div>
        <div class="fg" style="grid-column:1/-1"><label>Entidad</label><input id="gcf-entidad" value="${c.entidad||''}" placeholder="Nombre de la entidad compradora"></div>
        <div class="fg"><label>Monto estimado</label><input id="gcf-monto" value="${c.monto||''}" placeholder="Q 0.00"></div>
        <div class="fg"><label>Modalidad</label>
          <select id="gcf-modalidad">
            ${['—','Cotización','Licitación','Compra Directa','Subasta Inversa','Convenio Marco'].map(m=>`<option ${c.modalidad===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>Fecha publicación</label><input type="date" id="gcf-pub" value="${c.fechaPub||''}"></div>
        <div class="fg"><label>Fecha cierre / entrega</label><input type="date" id="gcf-cierre" value="${c.fechaCierre||''}"></div>
        <div class="fg"><label>Responsable interno</label>
          <select id="gcf-resp">
            <option value="">— Sin asignar —</option>
            ${(DB.empleados||[]).filter(e=>e.estado==='activo').map(e=>`<option value="${e.nombre}" ${c.resp===e.nombre?'selected':''}>${e.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>URL Guatecompras</label><input id="gcf-url" value="${c.url||''}" placeholder="https://www.guatecompras.gt/..."></div>
        <div class="fg" style="grid-column:1/-1"><label>Notas internas</label>
          <textarea id="gcf-notas" rows="3" style="width:100%;padding:8px;border:1.5px solid var(--br);border-radius:6px;font-size:.85rem;resize:vertical;">${c.notas||''}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end;">
        <button class="btn bo" onclick="gcCerrarModal()">Cancelar</button>
        <button class="btn bp" onclick="gcGuardarConcurso()">💾 Guardar</button>
      </div>
    </div>`;
}

function gcGuardarConcurso() {
  gcEnsureDB();
  const nog     = document.getElementById('gcf-nog')?.value.trim();
  const titulo  = document.getElementById('gcf-titulo')?.value.trim();
  if (!nog && !titulo) { toast('⚠ Ingresá al menos el NOG o título', true); return; }

  const rec = {
    id:          _gcEditId || uid(),
    ts:          now(),
    nog:         nog,
    titulo:      titulo,
    etidad:      document.getElementById('gcf-entidad')?.value.trim(),
    entidad:     document.getElementById('gcf-entidad')?.value.trim(),
    monto:       document.getElementById('gcf-monto')?.value.trim(),
    modalidad:   document.getElementById('gcf-modalidad')?.value,
    fechaPub:    document.getElementById('gcf-pub')?.value,
    fechaCierre: document.getElementById('gcf-cierre')?.value,
    resp:        document.getElementById('gcf-resp')?.value,
    url:         document.getElementById('gcf-url')?.value.trim(),
    notas:       document.getElementById('gcf-notas')?.value.trim(),
    etapa:       document.getElementById('gcf-etapa')?.value || 'Identificado',
  };

  if (_gcEditId) {
    const idx = DB.gcConcursos.findIndex(x => x.id === _gcEditId);
    if (idx >= 0) DB.gcConcursos[idx] = { ...DB.gcConcursos[idx], ...rec };
  } else {
    // Init checklist de docs
    rec.docs = GC_DOCS_BASE.map(d => ({ ...d, estado: 'pendiente', obs: '' }));
    rec.renglones = [];
    DB.gcConcursos.unshift(rec);
  }

  gcCerrarModal();
  save();
  gcShowTab('concursos');
  toast(`✓ Concurso ${rec.nog || rec.titulo.slice(0,20)} guardado`);
}

function gcEliminarConcurso(id) {
  if (!confirm('¿Eliminar este concurso y todos sus datos?')) return;
  DB.gcConcursos = DB.gcConcursos.filter(c => c.id !== id);
  save();
  gcShowTab('concursos');
  toast('✓ Concurso eliminado');
}

function gcCerrarModal() {
  const modal = document.getElementById('gc-modal');
  if (modal) modal.style.display = 'none';
}

function gcVerConcurso(id) {
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === id);
  if (!c) return;
  const modal = document.getElementById('gc-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const dias = gcDiasRestantes(c.fechaCierre);
  const etapaColor = GC_ETAPA_COLOR[c.etapa] || '#607D8B';
  const docsPend = (c.docs||[]).filter(d=>d.estado==='pendiente').length;
  const docsOk   = (c.docs||[]).filter(d=>d.estado==='listo').length;
  const renglonesTotal = (c.renglones||[]).reduce((s,r)=>s+(r.totalQ||0),0);

  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;width:min(680px,95vw);max-height:90vh;overflow-y:auto;position:relative;">
      <button onclick="gcCerrarModal()" style="position:absolute;top:12px;right:14px;background:none;border:none;font-size:1.3rem;cursor:pointer;">✕</button>
      <div style="border-left:4px solid ${etapaColor};padding-left:14px;margin-bottom:18px;">
        <div style="font-family:var(--f-mono);font-size:.72rem;color:var(--muted);margin-bottom:4px;">NOG ${c.nog||'—'}</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--forest);">${c.titulo||'Sin título'}</div>
        <div style="font-size:.82rem;color:var(--muted);margin-top:3px;">${c.entidad||'—'}</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
        ${gcStatCard('Etapa', `<span style="color:${etapaColor};font-weight:700;">${c.etapa||'—'}</span>`)}
        ${gcStatCard('Cierre', dias>=0?`<span style="color:${dias<=7?'#C62828':'#2E7D32'}">${dias} días</span>`:'<span style="color:#C62828">Vencido</span>')}
        ${gcStatCard('Monto', c.monto||'—')}
        ${gcStatCard('Docs OK', `<span style="color:#2E7D32">${docsOk}</span>/<span style="color:#C62828">${docsPend}</span> pend.`)}
        ${gcStatCard('Oferta total', renglonesTotal ? `Q ${renglonesTotal.toLocaleString('es-GT',{maximumFractionDigits:2})}` : '—')}
        ${gcStatCard('Responsable', c.resp||'—')}
      </div>

      ${c.notas ? `<div style="background:var(--cream);border-radius:8px;padding:12px;font-size:.82rem;margin-bottom:14px;"><strong>📝 Notas:</strong> ${c.notas}</div>` : ''}

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button class="btn bp bsm" onclick="gcCerrarModal();gcShowTab('seguimiento');gcFiltrarSeg('${c.id}')">⭐ Seguimiento</button>
        <button class="btn bp bsm" onclick="gcCerrarModal();gcShowTab('documentos');gcFiltrarDocs('${c.id}')">📁 Documentos</button>
        <button class="btn bp bsm" onclick="gcCerrarModal();gcShowTab('cotizador');gcCargarCotizador('${c.id}')">🧮 Cotizador</button>
        <button class="btn bo bsm" onclick="gcEditarConcurso('${c.id}')">✏️ Editar</button>
        ${c.url ? `<a href="${c.url}" target="_blank" class="btn bo bsm">🔗 Guatecompras</a>` : ''}
      </div>
    </div>`;
}

function gcStatCard(label, val) {
  return `<div style="background:var(--cream);border-radius:8px;padding:10px 12px;text-align:center;">
    <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">${label}</div>
    <div style="font-size:.9rem;font-weight:600;">${val}</div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════
// TAB 2: SEGUIMIENTO
// ════════════════════════════════════════════════════════════════
let _gcSegFiltro = '';

function gcPanelSeguimiento(panel) {
  gcEnsureDB();
  const activos = DB.gcConcursos.filter(c => c.etapa !== 'Archivado');

  panel.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
      <select id="gc-seg-concurso" onchange="gcSegCambiarConcurso(this.value)"
        style="padding:8px 10px;border:1.5px solid var(--br);border-radius:6px;font-size:.82rem;min-width:280px;">
        <option value="">— Seleccionar concurso —</option>
        ${activos.map(c=>`<option value="${c.id}" ${_gcSegFiltro===c.id?'selected':''}>${c.nog?'['+c.nog+'] ':''}${c.titulo?.slice(0,50)||'Sin título'}</option>`).join('')}
      </select>
      <button class="btn bp bsm" id="gc-seg-add-btn" onclick="gcSegAgregarActividad()" style="display:none;">➕ Actividad</button>
      <button class="btn bo bsm" id="gc-seg-etapa-btn" onclick="gcSegCambiarEtapa()" style="display:none;">🔄 Cambiar etapa</button>
    </div>
    <div id="gc-seg-panel">
      ${activos.length===0?`<div class="empty">Sin concursos activos</div>`:`<div class="empty">Seleccioná un concurso para ver su seguimiento</div>`}
    </div>`;

  if (_gcSegFiltro) gcSegCambiarConcurso(_gcSegFiltro);
}

function gcFiltrarSeg(id) {
  _gcSegFiltro = id;
  const sel = document.getElementById('gc-seg-concurso');
  if (sel) sel.value = id;
  gcSegCambiarConcurso(id);
}

function gcSegCambiarConcurso(id) {
  _gcSegFiltro = id;
  const addBtn  = document.getElementById('gc-seg-add-btn');
  const etapaBtn = document.getElementById('gc-seg-etapa-btn');
  if (addBtn)  addBtn.style.display  = id ? '' : 'none';
  if (etapaBtn) etapaBtn.style.display = id ? '' : 'none';

  const panel = document.getElementById('gc-seg-panel');
  if (!panel || !id) return;

  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === id);
  if (!c) return;

  const actividades = (c.actividades || []).slice().reverse();
  const etapaColor = GC_ETAPA_COLOR[c.etapa] || '#607D8B';

  panel.innerHTML = `
    <div style="background:#fff;border:1.5px solid var(--br);border-radius:10px;padding:14px 16px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-weight:700;font-size:.95rem;">${c.titulo?.slice(0,60)||'Sin título'}</div>
          <div style="font-size:.78rem;color:var(--muted);">${c.entidad||'—'}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="padding:4px 14px;border-radius:20px;font-size:.78rem;font-weight:700;background:${etapaColor}22;color:${etapaColor};">${c.etapa||'Identificado'}</span>
          ${c.fechaCierre ? `<span style="font-size:.75rem;color:var(--muted);">Cierre: ${c.fechaCierre}</span>` : ''}
        </div>
      </div>
    </div>

    ${actividades.length === 0 ? `<div class="empty">Sin actividades registradas — agregá la primera</div>` :
    `<div style="position:relative;padding-left:20px;border-left:2px solid var(--br);margin-left:10px;display:flex;flex-direction:column;gap:12px;">
      ${actividades.map(a => {
        const color = GC_ETAPA_COLOR[a.etapa] || '#607D8B';
        return `
        <div style="position:relative;">
          <div style="position:absolute;left:-27px;top:10px;width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 2px ${color}44;"></div>
          <div style="background:#fff;border:1.5px solid var(--br);border-radius:8px;padding:12px 14px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
              <div style="flex:1;">
                <div style="font-size:.7rem;color:var(--muted);margin-bottom:3px;">${a.fecha||''} · ${a.quien||''}</div>
                <div style="font-weight:600;font-size:.88rem;">${a.accion||''}</div>
                ${a.detalle?`<div style="font-size:.8rem;color:var(--muted);margin-top:4px;">${a.detalle}</div>`:''}
              </div>
              <div style="display:flex;gap:6px;align-items:center;">
                ${a.etapa?`<span style="padding:2px 8px;border-radius:10px;font-size:.7rem;background:${color}22;color:${color};font-weight:600;">${a.etapa}</span>`:''}
                <button class="btn bo bsm" onclick="gcSegEliminarActividad('${c.id}','${a.id}')" style="font-size:.65rem;border-color:var(--danger);color:var(--danger);">✕</button>
              </div>
            </div>
            ${a.proximo?`<div style="margin-top:8px;padding:6px 10px;background:#FFF8E1;border-radius:6px;font-size:.78rem;"><strong>📌 Próximo paso:</strong> ${a.proximo}</div>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>`}`;
}

function gcSegAgregarActividad() {
  if (!_gcSegFiltro) { toast('⚠ Seleccioná un concurso', true); return; }
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === _gcSegFiltro);
  if (!c) return;

  const modal = document.getElementById('gc-modal');
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;width:min(520px,95vw);position:relative;">
      <button onclick="gcCerrarModal()" style="position:absolute;top:12px;right:14px;background:none;border:none;font-size:1.3rem;cursor:pointer;">✕</button>
      <h3 style="font-family:var(--f-display);font-size:1.1rem;margin-bottom:16px;color:var(--forest);">➕ Nueva actividad</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="fg"><label>Acción realizada</label>
          <input id="gca-accion" placeholder="Ej: Revisión de bases, Contacto con entidad...">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="fg"><label>Fecha</label><input type="date" id="gca-fecha" value="${today()}"></div>
          <div class="fg"><label>Responsable</label>
            <select id="gca-quien">
              ${(DB.empleados||[]).filter(e=>e.estado==='activo').map(e=>`<option value="${e.nombre}">${e.nombre}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="fg"><label>Detalle / notas</label>
          <textarea id="gca-detalle" rows="2" style="width:100%;padding:8px;border:1.5px solid var(--br);border-radius:6px;font-size:.85rem;resize:vertical;" placeholder="Información adicional..."></textarea>
        </div>
        <div class="fg"><label>Próximo paso</label>
          <input id="gca-proximo" placeholder="Ej: Enviar oferta económica el lunes">
        </div>
        <div class="fg"><label>Cambiar etapa a</label>
          <select id="gca-etapa">
            <option value="">— Sin cambio —</option>
            ${GC_ETAPAS.map(e=>`<option value="${e}" ${c.etapa===e?'selected':''}>${e}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">
        <button class="btn bo" onclick="gcCerrarModal()">Cancelar</button>
        <button class="btn bp" onclick="gcSegGuardarActividad('${c.id}')">💾 Guardar</button>
      </div>
    </div>`;
}

function gcSegGuardarActividad(concursoId) {
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === concursoId);
  if (!c) return;
  const accion = document.getElementById('gca-accion')?.value.trim();
  if (!accion) { toast('⚠ Ingresá la acción', true); return; }

  if (!c.actividades) c.actividades = [];
  const nuevaEtapa = document.getElementById('gca-etapa')?.value;
  const act = {
    id:      uid(),
    fecha:   document.getElementById('gca-fecha')?.value || today(),
    quien:   document.getElementById('gca-quien')?.value || '',
    accion,
    detalle: document.getElementById('gca-detalle')?.value.trim(),
    proximo: document.getElementById('gca-proximo')?.value.trim(),
    etapa:   nuevaEtapa || c.etapa,
  };

  if (nuevaEtapa && nuevaEtapa !== c.etapa) {
    c.etapa = nuevaEtapa;
    if (nuevaEtapa === 'Adjudicado') c.adjudicado = true;
  }

  c.actividades.push(act);
  gcCerrarModal();
  save();
  gcSegCambiarConcurso(concursoId);
  gcRenderTabs();
  toast('✓ Actividad guardada');
}

function gcSegEliminarActividad(concursoId, actId) {
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === concursoId);
  if (!c) return;
  c.actividades = (c.actividades||[]).filter(a => a.id !== actId);
  save();
  gcSegCambiarConcurso(concursoId);
  toast('✓ Actividad eliminada');
}

function gcSegCambiarEtapa() {
  if (!_gcSegFiltro) return;
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === _gcSegFiltro);
  if (!c) return;
  const nueva = prompt(`Etapa actual: ${c.etapa}\n\nNueva etapa:\n${GC_ETAPAS.join('\n')}\n\nEscribí exactamente una de las opciones:`);
  if (!nueva || !GC_ETAPAS.includes(nueva)) { toast('⚠ Etapa no válida', true); return; }
  c.etapa = nueva;
  if (nueva === 'Adjudicado') c.adjudicado = true;
  save();
  gcSegCambiarConcurso(_gcSegFiltro);
  gcRenderTabs();
  toast(`✓ Etapa → ${nueva}`);
}

// ════════════════════════════════════════════════════════════════
// TAB 3: DOCUMENTOS / CHECKLIST
// ════════════════════════════════════════════════════════════════
let _gcDocsFiltro = '';

function gcPanelDocumentos(panel) {
  gcEnsureDB();
  panel.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
      <select id="gc-docs-concurso" onchange="gcDocsCambiarConcurso(this.value)"
        style="padding:8px 10px;border:1.5px solid var(--br);border-radius:6px;font-size:.82rem;min-width:280px;">
        <option value="">— Seleccionar concurso —</option>
        ${DB.gcConcursos.map(c=>`<option value="${c.id}" ${_gcDocsFiltro===c.id?'selected':''}>${c.nog?'['+c.nog+'] ':''}${c.titulo?.slice(0,50)||'Sin título'}</option>`).join('')}
      </select>
    </div>
    <div id="gc-docs-panel">
      ${DB.gcConcursos.length===0?`<div class="empty">Sin concursos registrados</div>`:`<div class="empty">Seleccioná un concurso</div>`}
    </div>`;

  if (_gcDocsFiltro) gcDocsCambiarConcurso(_gcDocsFiltro);
}

function gcFiltrarDocs(id) {
  _gcDocsFiltro = id;
  const sel = document.getElementById('gc-docs-concurso');
  if (sel) sel.value = id;
  gcDocsCambiarConcurso(id);
}

function gcDocsCambiarConcurso(id) {
  _gcDocsFiltro = id;
  const panel = document.getElementById('gc-docs-panel');
  if (!panel || !id) return;
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === id);
  if (!c) return;

  if (!c.docs || c.docs.length === 0) {
    c.docs = GC_DOCS_BASE.map(d => ({ ...d, estado: 'pendiente', obs: '' }));
    save();
  }

  const pct = Math.round(c.docs.filter(d=>d.estado==='listo').length / c.docs.length * 100);

  panel.innerHTML = `
    <div style="background:#fff;border:1.5px solid var(--br);border-radius:10px;padding:14px 16px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-weight:700;">${c.titulo?.slice(0,60)||'Sin título'}</div>
          <div style="font-size:.78rem;color:var(--muted);">NOG ${c.nog||'—'} · ${c.entidad||'—'}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.4rem;font-weight:800;color:${pct===100?'#2E7D32':pct>=60?'#E65100':'#C62828'};">${pct}%</div>
          <div style="font-size:.7rem;color:var(--muted);">${c.docs.filter(d=>d.estado==='listo').length}/${c.docs.length} documentos</div>
        </div>
      </div>
      <div style="margin-top:10px;background:var(--br);border-radius:4px;height:6px;overflow:hidden;">
        <div style="height:100%;background:${pct===100?'#2E7D32':pct>=60?'#E65100':'#C62828'};width:${pct}%;transition:width .4s;"></div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;">
      ${['legal','financiero','oferta','tecnico'].map(cat => {
        const docs = c.docs.filter(d => d.cat === cat);
        const catLabel = {legal:'⚖️ Legal',financiero:'💰 Financiero',oferta:'📋 Oferta',tecnico:'🔬 Técnico'}[cat];
        return `
          <div style="background:#fff;border:1.5px solid var(--br);border-radius:8px;overflow:hidden;">
            <div style="background:var(--forest);color:#fff;padding:8px 14px;font-size:.78rem;font-weight:700;">${catLabel}</div>
            ${docs.map(d => `
              <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--br);flex-wrap:wrap;">
                <select onchange="gcDocsSetEstado('${c.id}','${d.id}',this.value)"
                  style="padding:4px 8px;border:1.5px solid var(--br);border-radius:6px;font-size:.78rem;background:${d.estado==='listo'?'#E8F5E9':d.estado==='no-aplica'?'#F5F5F5':'#FFF8E1'};">
                  <option value="pendiente" ${d.estado==='pendiente'?'selected':''}>⏳ Pendiente</option>
                  <option value="en-proceso" ${d.estado==='en-proceso'?'selected':''}>🔄 En proceso</option>
                  <option value="listo" ${d.estado==='listo'?'selected':''}>✅ Listo</option>
                  <option value="no-aplica" ${d.estado==='no-aplica'?'selected':''}>— No aplica</option>
                </select>
                <span style="flex:1;font-size:.85rem;">${d.label}</span>
                <input placeholder="Obs." value="${d.obs||''}"
                  onchange="gcDocsSetObs('${c.id}','${d.id}',this.value)"
                  style="width:160px;padding:4px 8px;border:1.5px solid var(--br);border-radius:6px;font-size:.75rem;">
              </div>`).join('')}
          </div>`;
      }).join('')}
    </div>

    <div style="margin-top:12px;display:flex;gap:8px;">
      <button class="btn bp bsm" onclick="gcDocsMarcarTodos('${c.id}','listo')">✅ Marcar todos listos</button>
      <button class="btn bo bsm" onclick="gcDocsMarcarTodos('${c.id}','pendiente')">↺ Resetear</button>
    </div>`;
}

function gcDocsSetEstado(concursoId, docId, estado) {
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === concursoId);
  if (!c) return;
  const d = (c.docs||[]).find(x => x.id === docId);
  if (d) { d.estado = estado; save(); }
  // Update progress bar
  const pct = Math.round(c.docs.filter(d=>d.estado==='listo').length / c.docs.length * 100);
  const bar = document.querySelector('#gc-docs-panel [style*="transition:width"]');
  if (bar) bar.style.width = pct + '%';
}

function gcDocsSetObs(concursoId, docId, obs) {
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === concursoId);
  if (!c) return;
  const d = (c.docs||[]).find(x => x.id === docId);
  if (d) { d.obs = obs; save(); }
}

function gcDocsMarcarTodos(concursoId, estado) {
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === concursoId);
  if (!c) return;
  (c.docs||[]).forEach(d => d.estado = estado);
  save();
  gcDocsCambiarConcurso(concursoId);
  toast(`✓ Todos los documentos → ${estado}`);
}

// ════════════════════════════════════════════════════════════════
// TAB 4: COTIZADOR POR RENGLÓN
// ════════════════════════════════════════════════════════════════
let _gcCotizConcursoId = '';

function gcPanelCotizador(panel) {
  gcEnsureDB();
  panel.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
      <select id="gc-cot-concurso" onchange="gcCargarCotizador(this.value)"
        style="padding:8px 10px;border:1.5px solid var(--br);border-radius:6px;font-size:.82rem;min-width:280px;">
        <option value="">— Seleccionar concurso —</option>
        ${DB.gcConcursos.map(c=>`<option value="${c.id}" ${_gcCotizConcursoId===c.id?'selected':''}>${c.nog?'['+c.nog+'] ':''}${c.titulo?.slice(0,50)||'Sin título'}</option>`).join('')}
      </select>
    </div>
    <div id="gc-cot-panel">
      <div class="empty">Seleccioná un concurso para cotizar sus renglones</div>
    </div>`;

  if (_gcCotizConcursoId) gcCargarCotizador(_gcCotizConcursoId);
}

function gcCargarCotizador(id) {
  _gcCotizConcursoId = id;
  const sel = document.getElementById('gc-cot-concurso');
  if (sel) sel.value = id;
  const panel = document.getElementById('gc-cot-panel');
  if (!panel || !id) return;

  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === id);
  if (!c) return;
  if (!c.renglones) c.renglones = [];

  gcRenderCotizador(c, panel);
}

function gcRenderCotizador(c, panel) {
  const totalOferta = c.renglones.reduce((s,r) => s+(r.totalQ||0), 0);
  const totalCosto  = c.renglones.reduce((s,r) => s+(r.totalCosto||0), 0);
  const margenPct   = totalOferta > 0 ? ((totalOferta-totalCosto)/totalOferta*100).toFixed(1) : 0;

  panel.innerHTML = `
    <div style="background:#fff;border:1.5px solid var(--br);border-radius:10px;padding:14px 16px;margin-bottom:14px;">
      <div style="font-weight:700;margin-bottom:4px;">${c.titulo?.slice(0,70)||'Sin título'}</div>
      <div style="font-size:.78rem;color:var(--muted);">NOG ${c.nog||'—'} · ${c.entidad||'—'}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px;">
        ${gcStatCard('Total Oferta', `<strong style="color:var(--forest);">Q ${totalOferta.toLocaleString('es-GT',{maximumFractionDigits:2})}</strong>`)}
        ${gcStatCard('Costo total', `Q ${totalCosto.toLocaleString('es-GT',{maximumFractionDigits:2})}`)}
        ${gcStatCard('Margen', `<span style="color:${margenPct>=15?'#2E7D32':margenPct>=5?'#E65100':'#C62828'}">${margenPct}%</span>`)}
      </div>
    </div>

    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
        <thead>
          <tr style="background:var(--forest);color:#fff;">
            <th style="padding:8px 10px;text-align:left;">Renglón</th>
            <th style="padding:8px;text-align:left;">Descripción / Producto</th>
            <th style="padding:8px;text-align:right;">Cantidad</th>
            <th style="padding:8px;text-align:left;">Unidad</th>
            <th style="padding:8px;text-align:right;">Precio unit. oferta Q</th>
            <th style="padding:8px;text-align:right;">Costo unit. Q</th>
            <th style="padding:8px;text-align:right;">Total oferta Q</th>
            <th style="padding:8px;text-align:right;">Margen %</th>
            <th style="padding:8px;"></th>
          </tr>
        </thead>
        <tbody id="gc-cot-tbody">
          ${c.renglones.map((r,i) => gcCotRenglon(r,i,c.id)).join('')}
        </tbody>
      </table>
    </div>

    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
      <button class="btn bp bsm" onclick="gcCotAgregarRenglon('${c.id}')">➕ Agregar renglón</button>
      <button class="btn bo bsm" onclick="gcCotExportar('${c.id}')">📊 Exportar Excel</button>
    </div>`;
}

function gcCotRenglon(r, i, concursoId) {
  const bg = i % 2 === 0 ? '#fafafa' : '#fff';
  const margen = r.precioUnit > 0 && r.costoUnit >= 0
    ? (((r.precioUnit - r.costoUnit) / r.precioUnit) * 100).toFixed(1)
    : '—';
  const margenColor = parseFloat(margen) >= 15 ? '#2E7D32' : parseFloat(margen) >= 5 ? '#E65100' : '#C62828';

  return `<tr style="background:${bg};">
    <td style="padding:8px 10px;font-weight:700;color:var(--muted);">${r.renglon||i+1}</td>
    <td style="padding:8px 10px;max-width:220px;">
      <div style="font-weight:600;">${r.desc||'—'}</div>
      ${r.especificaciones?`<div style="font-size:.72rem;color:var(--muted);">${r.especificaciones}</div>`:''}
    </td>
    <td style="padding:8px;text-align:right;">${r.cantidad||0}</td>
    <td style="padding:8px;">${r.unidad||'—'}</td>
    <td style="padding:8px;text-align:right;font-weight:600;">Q ${(r.precioUnit||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
    <td style="padding:8px;text-align:right;">Q ${(r.costoUnit||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
    <td style="padding:8px;text-align:right;font-weight:700;color:var(--forest);">Q ${(r.totalQ||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
    <td style="padding:8px;text-align:right;font-weight:700;color:${margenColor};">${margen}%</td>
    <td style="padding:8px;">
      <div style="display:flex;gap:4px;">
        <button class="btn bo bsm" onclick="gcCotEditarRenglon('${concursoId}','${r.id}')" style="font-size:.65rem;">✏️</button>
        <button class="btn bo bsm" onclick="gcCotEliminarRenglon('${concursoId}','${r.id}')" style="font-size:.65rem;border-color:var(--danger);color:var(--danger);">✕</button>
      </div>
    </td>
  </tr>`;
}

function gcCotAgregarRenglon(concursoId) {
  gcCotFormRenglon(concursoId, null);
}

function gcCotEditarRenglon(concursoId, rId) {
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === concursoId);
  const r = (c?.renglones||[]).find(x => x.id === rId);
  if (r) gcCotFormRenglon(concursoId, r);
}

function gcCotFormRenglon(concursoId, r) {
  const modal = document.getElementById('gc-modal');
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;width:min(560px,95vw);position:relative;">
      <button onclick="gcCerrarModal()" style="position:absolute;top:12px;right:14px;background:none;border:none;font-size:1.3rem;cursor:pointer;">✕</button>
      <h3 style="font-family:var(--f-display);font-size:1.1rem;margin-bottom:16px;color:var(--forest);">${r?'✏️ Editar renglón':'➕ Nuevo renglón'}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="fg"><label>Nº Renglón</label><input id="gcr-num" type="number" value="${r?.renglon||''}" placeholder="1"></div>
        <div class="fg"><label>Unidad de medida</label>
          <select id="gcr-unidad">
            ${['Unidad','Caja','Bolsa','Red','Quintal','Libra','Kilogramo','Docena','Garrafa','Saco'].map(u=>`<option ${r?.unidad===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
        <div class="fg" style="grid-column:1/-1"><label>Descripción del producto</label>
          <input id="gcr-desc" value="${r?.desc||''}" placeholder="Ej: Cebolla blanca empacada en red de 2 lb">
        </div>
        <div class="fg" style="grid-column:1/-1"><label>Especificaciones técnicas</label>
          <textarea id="gcr-esp" rows="2" style="width:100%;padding:8px;border:1.5px solid var(--br);border-radius:6px;font-size:.85rem;resize:vertical;" placeholder="Peso, tamaño, calidad, norma...">${r?.especificaciones||''}</textarea>
        </div>
        <div class="fg"><label>Cantidad requerida</label><input id="gcr-cant" type="number" value="${r?.cantidad||''}" placeholder="0" oninput="gcCotCalc()"></div>
        <div class="fg"><label>Precio unitario oferta Q</label><input id="gcr-precio" type="number" step="0.01" value="${r?.precioUnit||''}" placeholder="0.00" oninput="gcCotCalc()"></div>
        <div class="fg"><label>Costo unitario Q</label><input id="gcr-costo" type="number" step="0.01" value="${r?.costoUnit||''}" placeholder="0.00" oninput="gcCotCalc()"></div>
        <div class="fg"><label>Notas</label><input id="gcr-notas" value="${r?.notas||''}" placeholder="Observaciones del renglón"></div>
      </div>
      <div id="gcr-preview" style="margin-top:12px;padding:10px;background:var(--cream);border-radius:8px;font-size:.82rem;display:none;"></div>
      <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">
        <button class="btn bo" onclick="gcCerrarModal()">Cancelar</button>
        <button class="btn bp" onclick="gcCotGuardarRenglon('${concursoId}','${r?.id||''}')">💾 Guardar</button>
      </div>
    </div>`;
  gcCotCalc();
}

function gcCotCalc() {
  const cant   = parseFloat(document.getElementById('gcr-cant')?.value) || 0;
  const precio = parseFloat(document.getElementById('gcr-precio')?.value) || 0;
  const costo  = parseFloat(document.getElementById('gcr-costo')?.value) || 0;
  const totalQ = cant * precio;
  const totalC = cant * costo;
  const margen = precio > 0 ? ((precio - costo) / precio * 100).toFixed(1) : 0;
  const prev = document.getElementById('gcr-preview');
  if (prev && cant > 0) {
    prev.style.display = 'block';
    prev.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;">
        <div><div style="font-size:.65rem;color:var(--muted);">TOTAL OFERTA</div><div style="font-weight:700;color:var(--forest);">Q ${totalQ.toLocaleString('es-GT',{minimumFractionDigits:2})}</div></div>
        <div><div style="font-size:.65rem;color:var(--muted);">TOTAL COSTO</div><div style="font-weight:700;">Q ${totalC.toLocaleString('es-GT',{minimumFractionDigits:2})}</div></div>
        <div><div style="font-size:.65rem;color:var(--muted);">MARGEN</div><div style="font-weight:700;color:${parseFloat(margen)>=15?'#2E7D32':parseFloat(margen)>=5?'#E65100':'#C62828'};">${margen}%</div></div>
      </div>`;
  }
}

function gcCotGuardarRenglon(concursoId, rId) {
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === concursoId);
  if (!c) return;
  if (!c.renglones) c.renglones = [];

  const desc = document.getElementById('gcr-desc')?.value.trim();
  if (!desc) { toast('⚠ Ingresá la descripción', true); return; }

  const cant   = parseFloat(document.getElementById('gcr-cant')?.value) || 0;
  const precio = parseFloat(document.getElementById('gcr-precio')?.value) || 0;
  const costo  = parseFloat(document.getElementById('gcr-costo')?.value) || 0;

  const rec = {
    id:              rId || uid(),
    renglon:         parseInt(document.getElementById('gcr-num')?.value) || c.renglones.length + 1,
    desc,
    especificaciones: document.getElementById('gcr-esp')?.value.trim(),
    unidad:          document.getElementById('gcr-unidad')?.value,
    cantidad:        cant,
    precioUnit:      precio,
    costoUnit:       costo,
    totalQ:          cant * precio,
    totalCosto:      cant * costo,
    notas:           document.getElementById('gcr-notas')?.value.trim(),
  };

  if (rId) {
    const idx = c.renglones.findIndex(x => x.id === rId);
    if (idx >= 0) c.renglones[idx] = rec;
  } else {
    c.renglones.push(rec);
  }

  gcCerrarModal();
  save();
  gcRenderCotizador(c, document.getElementById('gc-cot-panel'));
  toast('✓ Renglón guardado');
}

function gcCotEliminarRenglon(concursoId, rId) {
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === concursoId);
  if (!c) return;
  c.renglones = (c.renglones||[]).filter(x => x.id !== rId);
  save();
  gcRenderCotizador(c, document.getElementById('gc-cot-panel'));
  toast('✓ Renglón eliminado');
}

function gcCotExportar(concursoId) {
  gcEnsureDB();
  const c = DB.gcConcursos.find(x => x.id === concursoId);
  if (!c || !c.renglones?.length) { toast('⚠ Sin renglones para exportar', true); return; }

  const headers = ['Renglón','Descripción','Especificaciones','Cantidad','Unidad','Precio Unit. Q','Costo Unit. Q','Total Oferta Q','Total Costo Q','Margen %'];
  const rows = c.renglones.map(r => [
    r.renglon, r.desc, r.especificaciones, r.cantidad, r.unidad,
    r.precioUnit, r.costoUnit, r.totalQ, r.totalCosto,
    r.precioUnit > 0 ? ((r.precioUnit-r.costoUnit)/r.precioUnit*100).toFixed(1)+'%' : '—'
  ]);

  const totalQ = c.renglones.reduce((s,r)=>s+(r.totalQ||0),0);
  const totalC = c.renglones.reduce((s,r)=>s+(r.totalCosto||0),0);
  rows.push(['','','','','','','TOTAL', totalQ.toFixed(2), totalC.toFixed(2),
    totalQ>0?((totalQ-totalC)/totalQ*100).toFixed(1)+'%':'—']);

  const csv = [headers, ...rows].map(r => r.map(v => `"${v||''}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Cotizacion_NOG${c.nog||'SN'}_${today()}.csv`;
  a.click();
  toast('✓ CSV exportado');
}

// ════════════════════════════════════════════════════════════════
// TAB 5: IMPORTAR DESDE GUATECOMPRAS
// ════════════════════════════════════════════════════════════════
function gcPanelImportar(panel) {
  panel.innerHTML = `
    <div style="max-width:680px;">
      <div style="background:#fff;border:1.5px solid var(--br);border-radius:10px;padding:20px;margin-bottom:16px;">
        <h4 style="font-family:var(--f-display);color:var(--forest);margin-bottom:10px;">📋 Cómo importar un concurso de Guatecompras</h4>
        <ol style="font-size:.85rem;line-height:2;color:var(--muted);padding-left:18px;">
          <li>Abrí <a href="https://www.guatecompras.gt" target="_blank" style="color:var(--canopy);">guatecompras.gt</a> y buscá el concurso que te interesa</li>
          <li>Abrí la consola del navegador (F12 → Consola)</li>
          <li>Copiá el script de abajo y pegálo en la consola</li>
          <li>Se copiará el JSON automáticamente</li>
          <li>Pegalo en el campo de texto de abajo y presioná <strong>Importar</strong></li>
        </ol>
      </div>

      <div style="background:#0D1117;border-radius:8px;padding:12px 14px;margin-bottom:16px;position:relative;">
        <div style="font-size:.65rem;color:#58A6FF;font-family:monospace;margin-bottom:6px;">// SCRIPT — pegar en consola de Guatecompras.gt</div>
        <div style="font-size:.72rem;color:#E6EDF3;font-family:monospace;white-space:pre-wrap;line-height:1.5;word-break:break-all;max-height:80px;overflow:hidden;">${GC_SCRIPT_CONSOLA.slice(0,200)}...</div>
        <button onclick="gcCopiarScript()"
          style="margin-top:8px;background:#238636;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:.75rem;cursor:pointer;font-weight:600;">
          📋 Copiar script completo
        </button>
      </div>

      <div style="background:#fff;border:1.5px solid var(--br);border-radius:10px;padding:20px;">
        <label style="font-weight:600;font-size:.85rem;display:block;margin-bottom:8px;">Pegá el JSON copiado:</label>
        <textarea id="gc-import-json" rows="8"
          style="width:100%;padding:10px;border:1.5px solid var(--br);border-radius:6px;font-family:monospace;font-size:.75rem;resize:vertical;"
          placeholder='{ "nog": "12345-2026", "titulo": "...", "entidad": "...", ... }'></textarea>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn bp" onclick="gcImportarJSON()">⬇ Importar concurso</button>
          <button class="btn bo bsm" onclick="document.getElementById('gc-import-json').value=''">Limpiar</button>
        </div>
        <div id="gc-import-status" style="margin-top:10px;font-size:.82rem;"></div>
      </div>
    </div>`;
}

function gcCopiarScript() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(GC_SCRIPT_CONSOLA).then(() => toast('✓ Script copiado — pegálo en la consola de Guatecompras'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = GC_SCRIPT_CONSOLA;
    document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    toast('✓ Script copiado');
  }
}

function gcImportarJSON() {
  const raw = document.getElementById('gc-import-json')?.value.trim();
  if (!raw) { toast('⚠ Pegá el JSON primero', true); return; }

  let data;
  try { data = JSON.parse(raw); }
  catch(e) { toast('⚠ JSON inválido — copiaste bien el resultado?', true); return; }

  gcEnsureDB();

  // Check duplicate NOG
  if (data.nog && DB.gcConcursos.find(c => c.nog === data.nog)) {
    const status = document.getElementById('gc-import-status');
    if (status) status.innerHTML = `<span style="color:#E65100;">⚠ NOG ${data.nog} ya existe. <button class="btn bo bsm" onclick="gcImportarForzar(${JSON.stringify(data).replace(/"/g,'&quot;')})">Actualizar de todas formas</button></span>`;
    return;
  }

  gcImportarForzar(data);
}

function gcImportarForzar(data) {
  gcEnsureDB();
  const rec = {
    id:          uid(),
    ts:          now(),
    nog:         data.nog || '',
    titulo:      data.titulo || data.title || 'Sin título',
    entidad:     data.entidad || data.buyer || '—',
    monto:       data.monto || data.amount || '',
    modalidad:   data.modalidad || '—',
    fechaPub:    data.fechaPub || '',
    fechaCierre: data.fechaCierre || data.fechaOfertas || '',
    url:         data.url || '',
    etapa:       'Identificado',
    notas:       '',
    docs:        GC_DOCS_BASE.map(d => ({ ...d, estado: 'pendiente', obs: '' })),
    renglones:   (data.productos||[]).map((p,i) => ({
      id:        uid(),
      renglon:   i+1,
      desc:      p.Descripción || p.descripcion || p['Descripción'] || p['Nombre'] || Object.values(p)[0] || '',
      especificaciones: p['Especificaciones'] || p.especificaciones || '',
      cantidad:  parseFloat(p.Cantidad || p.cantidad || 0) || 0,
      unidad:    p.Unidad || p.unidad || 'Unidad',
      precioUnit: 0, costoUnit: 0, totalQ: 0, totalCosto: 0,
    })),
    actividades: [],
  };

  DB.gcConcursos.unshift(rec);
  save();

  const status = document.getElementById('gc-import-status');
  if (status) status.innerHTML = `<span style="color:#2E7D32;">✅ Concurso importado — ${rec.renglones.length} renglones detectados</span>`;
  document.getElementById('gc-import-json').value = '';

  toast(`✓ NOG ${rec.nog} importado — ${rec.renglones.length} renglones`);
  setTimeout(() => { gcShowTab('cotizador'); gcCargarCotizador(rec.id); }, 1200);
}

// ── Render externo (llamado desde show()) ─────────────────────────
window.renderGC = renderGC;
