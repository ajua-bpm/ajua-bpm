// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/helpers/index.js
// Funciones misceláneas — printSec, updateDash, populateSelects, etc.
// Build 55 — Marzo 2026
//
// Dependencias externas:
//   - DB                    → core/firebase.js
//   - toast()               → core/utils.js
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// FUNCIONES FALTANTES — todas las detectadas en análisis build 13
// ══════════════════════════════════════════════════════════════════

// ── printSec — imprime cualquier sección ─────────────────────────
function printSec(secId) {
  const sec = document.getElementById(secId);
  if (!sec) { window.print(); return; }
  const orig = document.body.innerHTML;
  const style = `<style>
    body{background:#fff!important;color:#000!important;font-family:Arial,sans-serif;font-size:12px;}
    .nav,.sidebar,.btn,.fa,button{display:none!important;}
    table{border-collapse:collapse;width:100%;}
    th,td{border:1px solid #ccc;padding:4px 8px;}
    th{background:#f0f0f0;}
    @media print{@page{margin:1cm;}}
  </style>`;
  document.body.innerHTML = style + sec.outerHTML;
  window.print();
  document.body.innerHTML = orig;
  location.reload();
}

// ── exportCSV — exporta cualquier tabla BPM a CSV ────────────────
function exportCSV(modulo) {
  const map = {
    lp: { arr: 'lp',  cols: ['fecha','hora','responsable','obs'] },
    tl: { arr: 'tl',  cols: ['fecha','conductor','placa','obs'] },
    bl: { arr: 'bl',  cols: ['fecha','responsable','obs'] },
    rod:{ arr: 'rod', cols: ['fecha','responsable','obs'] },
    vis:{ arr: 'vis', cols: ['fecha','nombre','empresa','obs'] },
    bas:{ arr: 'bas', cols: ['fecha','responsable','obs'] },
  };
  const m = map[modulo] || { arr: modulo, cols: ['fecha','obs'] };
  const data = DB[m.arr] || [];
  if (!data.length) { toast('Sin datos para exportar', true); return; }
  const header = m.cols.join(',');
  const rows = data.map(r => m.cols.map(c => '"'+(r[c]||'').toString().replace(/"/g,'""')+'"').join(','));
  const csv = [header, ...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'ajua_' + modulo + '_' + today() + '.csv';
  a.click();
  toast('✓ CSV exportado');
}

// ── salTab — alterna paneles Ediwin / Albarán / XML FEL ──────────
function salTab(panel) {
  ['ediwin','albaran','xml'].forEach(p => {
    const btn = document.getElementById('sal-tab-' + p);
    const pan = document.getElementById('sal-panel-' + p);
    if (btn) btn.className = p === panel ? 'btn bp' : 'btn bo bsm';
    if (pan) pan.style.display = p === panel ? '' : 'none';
  });
}

// ── salClearForm — limpia formulario ventas Walmart ───────────────
function salClearForm() {
  document.getElementById('sal-lineas').innerHTML = '';
  salLineaCount = 0;
  salEdiwinData = null; salAlbaranData = null;
  const totEl = document.getElementById('sal-totales');
  if (totEl) totEl.style.display = 'none';
  ['sal-ediwin-badge','sal-xml-badge'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  ['sal-ediwin-result','sal-xml-preview'].forEach(id => {
    const el = document.getElementById(id); if (el) { el.style.display='none'; el.innerHTML=''; }
  });
  ['sal-oc','sal-docmat','sal-factura','sal-serie','sal-dte','sal-almacen','sal-obs'].forEach(id => set(id,''));
  set('sal-fecha', today());
  // reset ediwin file input
  const inp = document.getElementById('sal-ediwin-input');
  if (inp) inp.value = '';
  const xmlInp = document.getElementById('sal-xml-input');
  if (xmlInp) xmlInp.value = '';
  toast('✓ Formulario limpiado');
}

// ── deleteConductor — elimina conductor por id ───────────────────
function deleteConductor(id) {
  if (!confirm('¿Eliminar este conductor?')) return;
  DB.conductores = (DB.conductores||[]).filter(c => c.id !== id);
  save();
  try { renderConductores(); } catch(e) {}
  toast('Conductor eliminado');
}

// ── toggleLicFields — muestra/oculta campos de licencia ──────────
function toggleLicFields(show) {
  const el = document.getElementById('emp-lic-fields');
  if (el) el.style.display = show ? '' : 'none';
}

// ── gdCatChange — filtra subcategoría según categoría gasto ──────
function gdCatChange() {
  const cat    = document.getElementById('gd-cat')?.value || '';
  const info   = GD_CATS[cat] || null;
  const descEl = document.getElementById('gd-desc');
  if (descEl && info) descEl.placeholder = 'Descripción — ' + (info.label || cat);

  // Mostrar selector de empleado solo para categorías de Personal
  const esPersonal = info?.grupo === 'Personal';
  const empRow = document.getElementById('gd-empleado-row');
  if (empRow) empRow.style.display = esPersonal ? '' : 'none';

  // Poblar select de empleados activos
  if (esPersonal) {
    const sel = document.getElementById('gd-empleado');
    if (sel) {
      const activos = (DB.empleados||[]).filter(e => e.activo !== false && e.nombre);
      sel.innerHTML = '<option value="">— Seleccionar empleado —</option>' +
        activos.map(e => `<option value="${e.id||e.nombre}">${e.nombre}${e.cargo?' · '+e.cargo:''}</option>`).join('');
    }
  }
}

// ── Cotizador pipeline — estados post-cotización ─────────────────
function cotMarcarAceptada() {
  const rec = DB.cotizaciones?.find(c => c.id === cotActivaId);
  if (!rec) return;
  if (!confirm('¿Marcar esta cotización como ACEPTADA por el cliente?')) return;
  rec.estado = 'aceptada';
  rec.fechaAceptada = today();
  save();
  cotVerDetalle(cotActivaId);
  toast('✅ Cotización marcada como aceptada');
}

function cotProcederEntrega() {
  const rec = DB.cotizaciones?.find(c => c.id === cotActivaId);
  if (!rec) return;
  if (!confirm('¿Cambiar estado a EN ENTREGA?')) return;
  rec.estado = 'en_entrega';
  rec.fechaInicioEntrega = today();
  save();
  cotVerDetalle(cotActivaId);
  toast('🚛 Estado cambiado a En Entrega');
}

function cotConfirmarEntrega() {
  const rec = DB.cotizaciones?.find(c => c.id === cotActivaId);
  if (!rec) return;
  const receptor = v('ent-receptor') || '';
  const fecha    = v('ent-fecha')    || today();
  const obs      = v('ent-obs')      || '';
  if (!receptor) { toast('⚠ Indica quién recibió el producto', true); return; }
  rec.estado          = 'entregada';
  rec.fechaEntrega    = fecha;
  rec.entregaReceptor = receptor;
  rec.entregaObs      = obs;
  if (window._entFotoData) {
    rec.entregaFoto     = window._entFotoData;
    window._entFotoData = null;
  }
  // Also save DUCA data if filled
  const ducaNum  = v('ent-duca');
  const factProv = v('ent-fact-prov');
  const factProd = v('ent-fact-prod');
  if (ducaNum || factProv || factProd) {
    rec.ducaEntrega = {
      numero:    ducaNum,
      fecha:     v('ent-duca-fecha'),
      agente:    v('ent-agente'),
      factProv,  factProd,
      aranceles: parseFloat(v('ent-aranceles')) || 0,
    };
  }
  save();
  cotVerDetalle(cotActivaId);
  renderCotList();
  const badge = document.getElementById('ent-entregado-badge');
  if (badge) badge.innerHTML = '<div style="background:rgba(0,217,139,.1);border:1.5px solid var(--acc);border-radius:6px;padding:12px;font-size:.78rem;color:var(--acc);font-weight:700;">✅ Entrega confirmada — '+fecha+' · Receptor: '+receptor+'</div>';
  toast('📦 Entrega confirmada correctamente');
}

function cotIrADespacho() {
  const rec = DB.cotizaciones?.find(c => c.id === cotActivaId);
  if (!rec) return;
  // Pre-fill despacho form with cotizacion data
  show('despacho', document.querySelector('[onclick*="despacho"]'));
  setTimeout(() => {
    try {
      const fSel = document.getElementById('dt-fecha');
      if (fSel) fSel.value = today();
      const obs = document.getElementById('dt-obs');
      if (obs) obs.value = 'Cotización: ' + rec.nombre + (rec.duca ? ' · DUCA: ' + rec.duca : '');
    } catch(e) {}
  }, 400);
  toast('🚛 Abriendo módulo de Despacho');
}

// ── saveEntregaDuca — guarda datos DUCA en tab entrega ────────────
function saveEntregaDuca() {
  const rec = DB.cotizaciones?.find(c => c.id === cotActivaId);
  if (!rec) return;
  rec.ducaEntrega = {
    numero:    v('ent-duca'),
    fecha:     v('ent-duca-fecha'),
    agente:    v('ent-agente'),
    factProv:  v('ent-fact-prov'),
    factProd:  v('ent-fact-prod'),
    aranceles: parseFloat(v('ent-aranceles')) || 0,
    ts:        now(),
  };
  save();
  toast('✅ Datos DUCA guardados');
}

// ── entLoadFoto — carga foto de entrega ──────────────────────────
function entLoadFoto(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    window._entFotoData = e.target.result;
    const preview = document.getElementById('ent-foto-preview');
    const badge   = document.getElementById('ent-foto-badge');
    if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
    if (badge)   badge.style.display = 'inline-flex';
    toast('✓ Foto cargada');
  };
  reader.readAsDataURL(file);
}

// ── renderEntregaPanel — rellena campos de entrega si ya tiene datos
function renderEntregaPanel(rec) {
  if (!rec) return;
  if (rec.ducaEntrega) {
    set('ent-duca',       rec.ducaEntrega.numero   || '');
    set('ent-duca-fecha', rec.ducaEntrega.fecha     || '');
    set('ent-agente',     rec.ducaEntrega.agente    || '');
    set('ent-fact-prov',  rec.ducaEntrega.factProv  || '');
    set('ent-fact-prod',  rec.ducaEntrega.factProd  || '');
    set('ent-aranceles',  rec.ducaEntrega.aranceles || '');
  }
  if (rec.fechaEntrega) {
    set('ent-fecha',    rec.fechaEntrega    || '');
    set('ent-receptor', rec.entregaReceptor || '');
    set('ent-obs',      rec.entregaObs      || '');
  }
  if (rec.estado === 'entregada') {
    const badge = document.getElementById('ent-entregado-badge');
    if (badge) badge.innerHTML = '<div style="background:rgba(0,217,139,.1);border:1.5px solid var(--acc);border-radius:6px;padding:12px;font-size:.78rem;color:var(--acc);font-weight:700;">✅ Entregada el '+rec.fechaEntrega+' · Receptor: '+rec.entregaReceptor+'</div>';
    // Disable inputs
    ['ent-fecha','ent-receptor','ent-obs'].forEach(id => {
      const el = document.getElementById(id); if (el) el.readOnly = true;
    });
  }
}

// ── maqToggleGrp — colapsa/expande grupo de maquila ──────────────
function maqToggleGrp(grpId) {
  const el  = document.getElementById('maq-grp-' + grpId);
  const tog = document.getElementById('maq-grp-toggle-' + grpId);
  if (!el) return;
  const hidden = el.style.display === 'none';
  el.style.display  = hidden ? '' : 'none';
  if (tog) tog.textContent = hidden ? '▼' : '▶';
}

// ── maqSetLabel — actualiza etiqueta de fila en maquila ──────────
function maqSetLabel(grpId, ri, val) {
  if (!maqCuentas[grpId]?.[ri]) return;
  maqCuentas[grpId][ri].label = val;
}

// ── maqSetMonto — actualiza monto de fila en maquila ─────────────
function maqSetMonto(grpId, ri, val) {
  if (!maqCuentas[grpId]?.[ri]) return;
  maqCuentas[grpId][ri].monto = parseFloat(val) || 0;
}

// ── maqSetQxlb — actualiza Q/lb de fila en maquila ───────────────
function maqSetQxlb(grpId, ri, val) {
  if (!maqCuentas[grpId]?.[ri]) return;
  maqCuentas[grpId][ri].qxlb = parseFloat(val) || 0;
}

// ── maqAddRow — agrega fila a grupo de maquila ───────────────────
function maqAddRow(grpId) {
  if (!maqCuentas[grpId]) maqCuentas[grpId] = [];
  maqCuentas[grpId].push({ label: '', monto: 0, qxlb: 0 });
  maqRenderCuentas();
}

// ── Plan de Cuentas — Gastos Generales ───────────────────────────
const MAQ_CUENTAS = [
  { id:'personal',     label:'👷 Personal y Mano de Obra',                color:'#4a9eff',  tipo:'personal',      mensual:false, items:[] },
  { id:'alimentos',    label:'🍽️ Alimentos (3 tiempos de comida)',        color:'#ff9f43',  tipo:'monto_detalle', mensual:false, items:['Desayuno','Almuerzo','Cena','Refacción / Snack','Otros alimentos'] },
  { id:'empaque',      label:'📦 Material de Empaque',                    color:'#a078ff',  tipo:'monto',         mensual:false, items:['Redes / Mallas','Etiquetas','Sellos / Stickers','Bolsas plásticas','Cajas de cartón','Zuncho / Flejes','Ganchos / Broches','Pallets','Otros empaque'] },
  { id:'proceso',      label:'⚙️ Procesos (Q/lb)',                        color:'#00d98b',  tipo:'qxlb',          mensual:false, items:['Lavado','Limpieza / Selección','Lavado y desinfección producto'] },
  { id:'bodega',       label:'🏭 Renta de Bodega e Instalaciones',        color:'#4ae88a',  tipo:'monto',         mensual:true,  items:['Renta bodega principal','Renta bodega secundaria','Servicios (agua, luz, teléfono)','Seguridad / Vigilancia','Limpieza instalaciones'] },
  { id:'transporte',   label:'🚛 Transporte Local',                       color:'#f5c518',  tipo:'monto',         mensual:true,  items:['Renta furgón refrigerado mensual','Entregas locales diarias GT','Combustible Camiones','Combustible Vehículos','Otros transporte local'] },
  { id:'mantenimiento',label:'🔧 Mantenimiento y Equipo',                 color:'#ff6b6b',  tipo:'monto',         mensual:false, items:['Mantenimiento vehículos','Mantenimiento equipo frío','Mantenimiento bodega','Compra equipo','Herramientas y utensilios','Reparaciones'] },
  { id:'admin',        label:'🏢 Gastos Administrativos',                 color:'#ffd93d',  tipo:'monto',         mensual:true,  items:['Sueldos administrativos','Contabilidad / Legal','Seguros','Comunicaciones','Papelería / Útiles','Gastos No Deducibles','Otros admin'] },
  { id:'impuestos',    label:'🧾 Impuestos',                              color:'#ff8c00',  tipo:'monto',         mensual:true,  items:['ISR','ISO','Retenciones','IVA','IVA Facturas Especiales','Otros impuestos'] },
  { id:'comercial',    label:'💰 Gastos Comerciales',                     color:'#c8e6c9',  tipo:'monto',         mensual:false, items:['Comisiones ventas','Publicidad / Marketing','Certificaciones','Gastos representación','Muestras / Degustaciones'] },
  { id:'financiero',   label:'🏦 Gastos Financieros',                     color:'#b0bec5',  tipo:'monto',         mensual:false, items:['Intereses bancarios','Comisiones bancarias','Diferencial cambiario','Servicios OSMO / cambista'] },
];
let maqCuentas = {};

