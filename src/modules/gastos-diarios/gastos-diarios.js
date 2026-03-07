// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/gastos-diarios/index.js
// Control de gastos operativos diarios por categoría
// Build 51 — Marzo 2026
//
// Dependencias externas:
//   - DB, save()            → core/firebase.js
//   - uid(), now(), toast() → core/utils.js
// ══════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// 💸 GASTOS DIARIOS
// ════════════════════════════════════════════════════════════════════

const GD_CATS = {
  combustible:   { label:'Combustible',            ico:'⛽', grupo:'Combustible y Transporte' },
  basura:        { label:'Basura',                 ico:'🗑', grupo:'Limpieza' },
  limpieza:      { label:'Limpieza',               ico:'🧹', grupo:'Limpieza' },
  mantenimiento: { label:'Mantenimiento',          ico:'🔧', grupo:'Mantenimiento' },
  servicios:     { label:'Servicios',              ico:'💡', grupo:'Servicios' },
  seguridad:     { label:'Seguridad',              ico:'🔒', grupo:'Servicios' },
  transporte:    { label:'Transporte',             ico:'🚛', grupo:'Combustible y Transporte' },
  papeleria:     { label:'Papelería',              ico:'📄', grupo:'Administrativo' },
  alimentacion:  { label:'Alimentación',           ico:'🍽', grupo:'Alimentación' },
  bancario:      { label:'Gasto Bancario',         ico:'🏦', grupo:'Financiero' },
  'comb-camiones':  { label:'Combustible Camiones',   ico:'⛽', grupo:'Combustible y Transporte' },
  'comb-vehiculos': { label:'Combustible Vehículos',  ico:'⛽', grupo:'Combustible y Transporte' },
  'flete-local':    { label:'Flete / Transporte',     ico:'🚛', grupo:'Combustible y Transporte' },
  'renta-furgon':   { label:'Renta Furgón Refrigerado',ico:'❄️',grupo:'Combustible y Transporte' },
  'emp-redes':      { label:'Redes / Mallas',         ico:'📦', grupo:'Material Empaque' },
  'emp-etiquetas':  { label:'Etiquetas',              ico:'🏷', grupo:'Material Empaque' },
  'emp-sellos':     { label:'Sellos / Stickers',      ico:'🔖', grupo:'Material Empaque' },
  'emp-bolsas':     { label:'Bolsas Plásticas',       ico:'🛍', grupo:'Material Empaque' },
  'emp-cajas':      { label:'Cajas de Cartón',        ico:'📫', grupo:'Material Empaque' },
  'emp-zuncho':     { label:'Zuncho / Flejes',        ico:'🔗', grupo:'Material Empaque' },
  'emp-ganchos':    { label:'Ganchos / Broches',      ico:'🪝', grupo:'Material Empaque' },
  'emp-pallets':    { label:'Pallets',                ico:'🪵', grupo:'Material Empaque' },
  'emp-otro':       { label:'Otro Mat. Empaque',      ico:'📦', grupo:'Material Empaque' },
  'limp-productos': { label:'Prod. Limpieza',         ico:'🧹', grupo:'Limpieza' },
  'limp-basura':    { label:'Recolección Basura',     ico:'🗑', grupo:'Limpieza' },
  'limp-fumig':     { label:'Fumigación',             ico:'🧪', grupo:'Limpieza' },
  'limp-otro':      { label:'Otro Limpieza',          ico:'🧼', grupo:'Limpieza' },
  'alim-desayuno':  { label:'Desayuno',               ico:'☕', grupo:'Alimentación' },
  'alim-almuerzo':  { label:'Almuerzo',               ico:'🍽', grupo:'Alimentación' },
  'alim-cena':      { label:'Cena',                   ico:'🌙', grupo:'Alimentación' },
  'alim-refaccion': { label:'Refacción / Snack',      ico:'🥪', grupo:'Alimentación' },
  'mant-vehiculos': { label:'Mant. Vehículos',        ico:'🚗', grupo:'Mantenimiento' },
  'mant-equipo-frio':{ label:'Mant. Equipo Frío',     ico:'❄️', grupo:'Mantenimiento' },
  'mant-bodega':    { label:'Mant. Bodega',           ico:'🏭', grupo:'Mantenimiento' },
  'mant-herramientas':{ label:'Herramientas',         ico:'🔨', grupo:'Mantenimiento' },
  'mant-reparaciones':{ label:'Reparaciones',         ico:'🛠', grupo:'Mantenimiento' },
  'adm-papeleria':  { label:'Papelería',              ico:'📄', grupo:'Administrativo' },
  'adm-comunicaciones':{ label:'Comunicaciones',      ico:'📱', grupo:'Administrativo' },
  'adm-contabilidad':{ label:'Contabilidad / Legal',  ico:'📊', grupo:'Administrativo' },
  'adm-seguros':    { label:'Seguros',                ico:'🛡', grupo:'Administrativo' },
  'adm-otro':       { label:'Otro Administrativo',    ico:'🏢', grupo:'Administrativo' },
  'srv-agua':       { label:'Agua',                   ico:'💧', grupo:'Servicios' },
  'srv-luz':        { label:'Electricidad',           ico:'💡', grupo:'Servicios' },
  'srv-renta':      { label:'Renta',                  ico:'🏠', grupo:'Servicios' },
  'srv-seguridad':  { label:'Seguridad / Vigilancia', ico:'🔒', grupo:'Servicios' },
  'fin-comision':   { label:'Comisión Bancaria',      ico:'🏦', grupo:'Financiero' },
  'fin-intereses':  { label:'Intereses',              ico:'💸', grupo:'Financiero' },
  'fin-cambio':     { label:'Diferencial Cambiario',  ico:'💱', grupo:'Financiero' },
  'com-comisiones': { label:'Comisiones Ventas',      ico:'💰', grupo:'Comercial' },
  'com-publicidad': { label:'Publicidad',             ico:'📢', grupo:'Comercial' },
  'com-muestras':   { label:'Muestras / Degustaciones',ico:'🥬',grupo:'Comercial' },
  'com-certificaciones':{ label:'Certificaciones',    ico:'📜', grupo:'Comercial' },
  'imp-isr':        { label:'ISR',                    ico:'🧾', grupo:'Impuestos' },
  'imp-iva':        { label:'IVA',                    ico:'🧾', grupo:'Impuestos' },
  'imp-ret':        { label:'Retenciones',            ico:'🧾', grupo:'Impuestos' },
  'imp-otro':       { label:'Otro Impuesto',          ico:'🧾', grupo:'Impuestos' },
  'gastos-varios':  { label:'Gastos Varios',          ico:'📋', grupo:'Varios' },
  otro:             { label:'Otro',                   ico:'🔖', grupo:'Varios' },
  // Importación
  'imp-agente':     { label:'Agente Aduanal',         ico:'🛃', grupo:'Importación' },
  'imp-anticipo':   { label:'Anticipo a Proveedor MX', ico:'💸', grupo:'Costo Producto' },
  'imp-descarga':   { label:'Descargadores',          ico:'🏋', grupo:'Importación' },
  'imp-ministe':    { label:'Ministerio / Sanidad',   ico:'🏛', grupo:'Importación' },
  'imp-aranceles':  { label:'Aranceles / DAI',        ico:'💲', grupo:'Importación' },
  'imp-flete-int':  { label:'Flete Internacional',    ico:'🚢', grupo:'Importación' },
  'imp-fumig-imp':  { label:'Fumigación Importación', ico:'🧪', grupo:'Importación' },
  'imp-otros':      { label:'Otros Gastos Importación',ico:'📦',grupo:'Importación' },
  'imp-anticipo':   { label:'Anticipo a Proveedor MX',  ico:'💸',grupo:'Importación' },
  // Personal
  'per-salario':    { label:'Salario / Jornal',       ico:'👷', grupo:'Personal' },
  'per-anticipo':   { label:'Anticipo',               ico:'💵', grupo:'Personal' },
  'per-bonif':      { label:'Bonificación',           ico:'🎁', grupo:'Personal' },
  'per-prestamo':   { label:'Préstamo a empleado',    ico:'🤝', grupo:'Personal' },
  'per-otro':       { label:'Otro Personal',          ico:'👤', grupo:'Personal' },
};

let _gdFotoData = null;

function gdInitFecha() {
  const fi = document.getElementById('gd-fecha');
  if (fi && !fi.value) {
    const gt = new Date(Date.now() - 6*3600000);
    fi.value = gt.toISOString().split('T')[0];
  }
  const ft = document.getElementById('gd-filtro-tipo');
  if (ft) ft.value = 'semana';
  gdToggleFiltroPersonal();
}

function gdToggleFiltroPersonal() {
  const tipo = document.getElementById('gd-filtro-tipo')?.value;
  const show = tipo === 'personalizado';
  ['gd-filtro-desde-wrap','gd-filtro-hasta-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  });
}
// hook filtro tipo
document.addEventListener('DOMContentLoaded', () => {
  const ft = document.getElementById('gd-filtro-tipo');
  if (ft) ft.addEventListener('change', () => { gdToggleFiltroPersonal(); gdRender(); });
});

function gdLoadFoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _gdFotoData = e.target.result;
    const prev = document.getElementById('gd-foto-preview');
    if (prev) prev.innerHTML = `<img src="${_gdFotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`;
    const clr = document.getElementById('gd-foto-clear');
    if (clr) clr.style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
}

function gdClearFoto() {
  _gdFotoData = null;
  const prev = document.getElementById('gd-foto-preview');
  if (prev) prev.innerHTML = '🧾';
  const clr = document.getElementById('gd-foto-clear');
  if (clr) clr.style.display = 'none';
  const inp = document.getElementById('gd-foto-input');
  if (inp) inp.value = '';
}

function gdSave() {
  if (!DB.gastosDiarios) DB.gastosDiarios = [];
  const fecha  = document.getElementById('gd-fecha')?.value;
  const cat    = document.getElementById('gd-cat')?.value;
  const monto  = parseFloat(document.getElementById('gd-monto')?.value) || 0;
  const desc   = document.getElementById('gd-desc')?.value.trim() || '';
  const metodo = document.getElementById('gd-metodo')?.value || 'efectivo';
  const editId = document.getElementById('gd-edit-id')?.value;

  if (!fecha) { toast('⚠ Ingrese la fecha', true); return; }
  if (!cat)   { toast('⚠ Seleccione categoría', true); return; }
  if (!monto) { toast('⚠ Ingrese el monto', true); return; }

  const pagadoPor = document.getElementById('gd-pagado-por')?.value || 'empresa';
  const devolucionQuien = pagadoPor === 'empleado'
    ? (document.getElementById('gd-devolucion-quien')?.value || '')
    : null;
  // Datos de empleado para categorías de Personal
  const gdInfo = GD_CATS[cat] || {};
  const empleadoId  = gdInfo.grupo === 'Personal' ? (document.getElementById('gd-empleado')?.value || '') : null;
  const empRef      = gdInfo.grupo === 'Personal' ? (document.getElementById('gd-emp-ref')?.value.trim() || '') : null;
  const empleadoNom = empleadoId
    ? ((DB.empleados||[]).find(e=>(e.id||e.nombre)===empleadoId)?.nombre || empleadoId)
    : null;
  const rec = { fecha, cat, monto, desc, metodo,
    pagadoPor, devolucionQuien,
    devolucionPendiente: pagadoPor === 'empleado',
    empleadoId, empleadoNombre: empleadoNom, empRef,
    foto: _gdFotoData || null };

  if (editId) {
    const idx = DB.gastosDiarios.findIndex(g => g.id === editId);
    if (idx >= 0) {
      Object.assign(DB.gastosDiarios[idx], rec);
      toast('✓ Gasto actualizado');
    }
    gdCancelEdit();
  } else {
    DB.gastosDiarios.unshift({ id: uid(), ts: now(), ...rec });
    toast('✓ Gasto registrado');
  }

  // Reset form
  document.getElementById('gd-cat').value   = '';
  document.getElementById('gd-monto').value = '';
  document.getElementById('gd-desc').value  = '';
  const _ppEl = document.getElementById('gd-pagado-por');
  if (_ppEl) { _ppEl.value = 'empresa'; gdPagadoPorChange(); }
  const _empEl = document.getElementById('gd-empleado'); if (_empEl) _empEl.value = '';
  const _empRef = document.getElementById('gd-emp-ref'); if (_empRef) _empRef.value = '';
  const _empRow = document.getElementById('gd-empleado-row'); if (_empRow) _empRow.style.display = 'none';
  gdClearFoto();
  save();
  gdRender();
}

function gdEdit(id) {
  const g = (DB.gastosDiarios||[]).find(g => g.id === id);
  if (!g) return;
  document.getElementById('gd-edit-id').value  = g.id;
  document.getElementById('gd-fecha').value    = g.fecha;
  document.getElementById('gd-cat').value      = g.cat;
  document.getElementById('gd-monto').value    = g.monto;
  document.getElementById('gd-desc').value     = g.desc || '';
  document.getElementById('gd-metodo').value   = g.metodo || 'efectivo';
  if (g.foto) {
    _gdFotoData = g.foto;
    const prev = document.getElementById('gd-foto-preview');
    if (prev) prev.innerHTML = `<img src="${g.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`;
    const clr = document.getElementById('gd-foto-clear');
    if (clr) clr.style.display = 'inline-flex';
  }
  const cancelBtn = document.getElementById('gd-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = '';
  // Populate pago fields
  const ppEl = document.getElementById('gd-pagado-por');
  if (ppEl) { ppEl.value = g.pagadoPor || 'empresa'; gdPagadoPorChange(); }
  const dqEl = document.getElementById('gd-devolucion-quien');
  if (dqEl && g.devolucionQuien) dqEl.value = g.devolucionQuien;
  document.getElementById('gd-fecha').scrollIntoView({behavior:'smooth', block:'center'});
}

function gdCancelEdit() {
  document.getElementById('gd-edit-id').value = '';
  document.getElementById('gd-cat').value     = '';
  document.getElementById('gd-monto').value   = '';
  document.getElementById('gd-desc').value    = '';
  gdClearFoto();
  const cancelBtn = document.getElementById('gd-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

function gdDel(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  DB.gastosDiarios = (DB.gastosDiarios||[]).filter(g => g.id !== id);
  save(); gdRender(); toast('Gasto eliminado');
}

function gdGetRango() {
  const tipo = document.getElementById('gd-filtro-tipo')?.value || 'semana';
  const gt   = new Date(Date.now() - 6*3600000);
  const hoy  = gt.toISOString().split('T')[0];

  if (tipo === 'semana') {
    const dow = gt.getDay(); // 0=dom
    const lunes = new Date(gt); lunes.setDate(gt.getDate() - ((dow+6)%7));
    const sab   = new Date(lunes); sab.setDate(lunes.getDate() + 6);
    return { desde: lunes.toISOString().split('T')[0], hasta: sab.toISOString().split('T')[0], label: 'Esta semana' };
  }
  if (tipo === 'mes') {
    const desde = hoy.slice(0,7) + '-01';
    const hasta = new Date(gt.getFullYear(), gt.getMonth()+1, 0).toISOString().split('T')[0];
    return { desde, hasta, label: 'Este mes' };
  }
  if (tipo === 'personalizado') {
    const desde = document.getElementById('gd-filtro-desde')?.value || '';
    const hasta = document.getElementById('gd-filtro-hasta')?.value || hoy;
    return { desde, hasta, label: `${desde} → ${hasta}` };
  }
  return { desde: '2000-01-01', hasta: '2099-12-31', label: 'Todo el historial' };
}

function gdPagadoPorChange() {
  const val = document.getElementById('gd-pagado-por')?.value;
  const grp = document.getElementById('gd-devolucion-group');
  const badge = document.getElementById('gd-devolucion-badge');
  if (grp) grp.style.display = val === 'empleado' ? '' : 'none';
  if (badge) badge.style.display = val === 'empleado' ? 'block' : 'none';
  // Populate empleados select
  if (val === 'empleado') {
    const sel = document.getElementById('gd-devolucion-quien');
    if (sel) {
      const activos = (DB.empleados||[]).filter(e=>e.estado==='activo').sort((a,b)=>a.nombre.localeCompare(b.nombre));
      sel.innerHTML = '<option value="">— Seleccionar empleado —</option>' +
        activos.map(e=>`<option value="${e.id}">${e.nombre}</option>`).join('');
    }
  }
}

function gdRender() {
  if (!DB.gastosDiarios) DB.gastosDiarios = [];
  const { desde, hasta } = gdGetRango();
  const filtrados = DB.gastosDiarios.filter(g => g.fecha >= desde && g.fecha <= hasta)
    .sort((a,b) => b.fecha.localeCompare(a.fecha));

  const total = filtrados.reduce((s,g) => s + (g.monto||0), 0);
  document.getElementById('gd-total-periodo').textContent = 'Q ' + total.toFixed(2);

  // Totales por categoría
  const porCat = {};
  filtrados.forEach(g => { porCat[g.cat] = (porCat[g.cat]||0) + (g.monto||0); });
  const catsEl = document.getElementById('gd-resumen-cats');
  if (catsEl) {
    catsEl.innerHTML = Object.entries(porCat)
      .sort((a,b) => b[1]-a[1])
      .map(([cat, tot]) => {
        const info = GD_CATS[cat] || { label: cat, ico: '📋' };
        return `<div style="background:var(--s2);border:1px solid var(--br);border-radius:6px;padding:8px 12px;min-width:110px;">
          <div style="font-size:.9rem;">${info.ico}</div>
          <div style="font-size:.68rem;color:var(--muted2);margin-top:2px;">${info.label}</div>
          <div style="font-size:.88rem;font-weight:700;color:var(--green-deep);">Q ${tot.toFixed(2)}</div>
        </div>`;
      }).join('');
  }

  // Tabla
  const tb = document.getElementById('gd-tbody');
  if (!tb) return;
  if (!filtrados.length) {
    tb.innerHTML = '<tr><td colspan="7"><div class="empty">Sin gastos en este período</div></td></tr>';
    return;
  }
  tb.innerHTML = filtrados.map(g => {
    const info = GD_CATS[g.cat] || { label: g.cat, ico: '📋' };
    const metMap = { efectivo:'💵 Efectivo', banco:'🏦 Banco', tarjeta:'💳 Tarjeta', cheque:'📝 Cheque' };
    const nombreDevol = g.devolucionQuien
      ? ((DB.empleados||[]).find(e=>e.id===g.devolucionQuien)?.nombre || g.devolucionQuien)
      : '';
    const pagadorChip = g.pagadoPor === 'empleado'
      ? `<br><span style="font-size:.6rem;background:rgba(245,197,24,.2);color:var(--warn);padding:1px 5px;border-radius:4px;border:1px solid var(--warn);">⚠ Reembolso${nombreDevol?' → '+nombreDevol:''}</span>`
      : '';
    const fotoBtn = g.foto
      ? `<button class="btn bo bsm" style="font-size:.65rem;" onclick="gdVerFoto('${g.id}')">🧾 Ver</button>`
      : '<span style="color:var(--muted2);font-size:.68rem;">—</span>';
    return `<tr>
      <td>${g.fecha}</td>
      <td><span class="chip cb">${info.ico} ${info.label}</span></td>
      <td style="font-size:.78rem;">${g.empleadoNombre ? '<span style="font-weight:600;color:var(--info);">👤 '+g.empleadoNombre+'</span>' + (g.desc?' · '+g.desc:'') : (g.desc || '—')}</td>
      <td style="font-size:.72rem;">${metMap[g.metodo]||g.metodo||'—'}${pagadorChip}</td>
      <td style="text-align:right;font-weight:700;color:var(--green-deep);">Q ${(g.monto||0).toFixed(2)}</td>
      <td>${fotoBtn}</td>
      <td style="white-space:nowrap;">
        <button class="btn bo bsm" onclick="gdEdit('${g.id}')" style="font-size:.65rem;">✏</button>
        <button class="btn bo bsm" onclick="gdDel('${g.id}')" style="font-size:.65rem;border-color:var(--danger);color:var(--danger);">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function gdVerFoto(id) {
  const g = (DB.gastosDiarios||[]).find(g => g.id === id);
  if (!g || !g.foto) return;
  const w = window.open('', '_blank', 'width=700,height=600');
  w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;">
    <img src="${g.foto}" style="max-width:100%;max-height:100%;object-fit:contain;">
  </body></html>`);
}

function gdExportExcel() {
  const { desde, hasta, label } = gdGetRango();
  const filtrados = (DB.gastosDiarios||[])
    .filter(g => g.fecha >= desde && g.fecha <= hasta)
    .sort((a,b) => b.fecha.localeCompare(a.fecha));
  if (!filtrados.length) { toast('⚠ Sin datos en el período', true); return; }
  let csv = '\uFEFF' + 'Fecha,Categoría,Descripción,Método de Pago,Monto (Q)\n';
  filtrados.forEach(g => {
    const info = GD_CATS[g.cat] || { label: g.cat };
    const metMap = { efectivo:'Efectivo', banco:'Banco/Transferencia', tarjeta:'Tarjeta', cheque:'Cheque' };
    csv += [g.fecha, info.label, g.desc||'', metMap[g.metodo]||g.metodo||'', (g.monto||0).toFixed(2)]
      .map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',') + '\n';
  });
  const total = filtrados.reduce((s,g)=>s+(g.monto||0),0);
  csv += `"","","","TOTAL","${total.toFixed(2)}"\n`;
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `GastosDiarios_${label.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().split('T')[0]}.csv`
  });
  a.click();
  toast('✅ Excel descargado');
}


