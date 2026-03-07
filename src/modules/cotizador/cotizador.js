// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/cotizador/index.js
// Cotizador Rápido — Ofertas comerciales con seguimiento
// Build 49 — Marzo 2026
//
// Dependencias externas:
//   - DB, save()   → core/firebase.js
//   - uid(), now() → core/utils.js
//   - del()        → core/utils.js (L7262)
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// COTIZADOR RÁPIDO — Ofertas comerciales con seguimiento
// ══════════════════════════════════════════════════════════════════

let _crProductos = []; // productos de la oferta en edición
let _crGastos    = []; // gastos varios en edición

function crInit() {
  if (!DB.cotizadorRapido) DB.cotizadorRapido = [];
  const fi = document.getElementById('cr-fecha-oferta');
  if (fi && !fi.value) {
    const gt = new Date(Date.now() - 6*3600000);
    fi.value = gt.toISOString().split('T')[0];
  }
}

// ── Checklist Guatecompras ────────────────────────────────────────
let _crChecklist = []; // [{id, texto, estado}] estado: 'pendiente'|'listo'|'falta'

function crTipoChange() {
  const tipo = document.getElementById('cr-tipo')?.value;
  const sec  = document.getElementById('cr-checklist-section');
  if (sec) sec.style.display = tipo === 'guatecompras' ? '' : 'none';
}

function crAddChecklist() {
  const inp = document.getElementById('cr-chk-nuevo');
  const texto = inp?.value.trim();
  if (!texto) return;
  _crChecklist.push({ id: uid(), texto, estado: 'pendiente' });
  inp.value = '';
  crRenderChecklist();
}

function crChecklistEstado(id) {
  const item = _crChecklist.find(c => c.id === id);
  if (!item) return;
  const ciclo = { pendiente: 'listo', listo: 'falta', falta: 'pendiente' };
  item.estado = ciclo[item.estado] || 'pendiente';
  crRenderChecklist();
}

function crChecklistDel(id) {
  _crChecklist = _crChecklist.filter(c => c.id !== id);
  crRenderChecklist();
}

function crRenderChecklist() {
  const cont = document.getElementById('cr-checklist-items');
  if (!cont) return;
  const EST = {
    pendiente: { ico: '⏳', color: 'var(--warn)',   bg: 'rgba(242,167,34,.1)',  label: 'Pendiente' },
    listo:     { ico: '✅', color: 'var(--acc)',    bg: 'rgba(0,122,82,.08)',   label: 'Listo' },
    falta:     { ico: '❌', color: 'var(--danger)', bg: 'rgba(214,48,48,.08)',  label: 'Falta' },
  };
  if (!_crChecklist.length) {
    cont.innerHTML = '<div style="font-size:.72rem;color:var(--muted2);font-style:italic;padding:8px 0;">Sin requisitos agregados aún</div>';
    return;
  }
  cont.innerHTML = _crChecklist.map(c => {
    const e = EST[c.estado] || EST.pendiente;
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:${e.bg};border-radius:6px;border:1px solid ${e.color}33;">
      <button onclick="crChecklistEstado('${c.id}')" title="Click para cambiar estado"
        style="background:${e.bg};border:1.5px solid ${e.color};border-radius:20px;padding:2px 10px;font-size:.65rem;font-weight:700;color:${e.color};cursor:pointer;white-space:nowrap;flex-shrink:0;">
        ${e.ico} ${e.label}
      </button>
      <span style="flex:1;font-size:.75rem;">${escHtml(c.texto)}</span>
      <button onclick="crChecklistDel('${c.id}')"
        style="background:none;border:none;color:var(--muted2);cursor:pointer;font-size:.85rem;padding:0 4px;flex-shrink:0;">✕</button>
    </div>`;
  }).join('');
}

// ── Producto row ──────────────────────────────────────────────────
function crAddProducto(prod) {
  const row = {
    id: uid(),
    nombre: prod?.nombre || '',
    cant: prod?.cant || 1,
    unidad: prod?.unidad || 'lb',
    costo: prod?.costo || 0,
    precio: prod?.precio || 0,
  };
  _crProductos.push(row);
  crRenderProductos();
}

function crRemoveProducto(id) {
  _crProductos = _crProductos.filter(p => p.id !== id);
  crRenderProductos();
}

function crRenderProductos() {
  const tbody = document.getElementById('cr-productos-tbody');
  if (!tbody) return;
  if (!_crProductos.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="padding:20px;text-align:center;font-size:.78rem;color:var(--muted2);">Sin productos — haz clic en "Agregar producto"</td></tr>';
    crUpdateTotales();
    return;
  }
  tbody.innerHTML = _crProductos.map(p => `
    <tr id="cr-prod-row-${p.id}">
      <td style="padding:6px 8px;"><input value="${escHtml(p.nombre)}" placeholder="Nombre del producto"
        style="width:100%;min-width:140px;background:var(--s2);border:1px solid var(--br);border-radius:4px;padding:6px 8px;font-size:.78rem;"
        oninput="crProdSet('${p.id}','nombre',this.value)"></td>
      <td style="padding:6px 8px;"><input type="number" value="${p.cant}" min="0" step="0.01"
        style="width:70px;background:var(--s2);border:1px solid var(--br);border-radius:4px;padding:6px 8px;font-size:.78rem;text-align:right;"
        oninput="crProdSet('${p.id}','cant',parseFloat(this.value)||0)"></td>
      <td style="padding:6px 8px;"><select
        style="background:var(--s2);border:1px solid var(--br);border-radius:4px;padding:6px 6px;font-size:.75rem;"
        onchange="crProdSet('${p.id}','unidad',this.value)">
        ${['lb','kg','quintal','caja','unidad','docena','bolsa','canasta','saco','galón'].map(u=>
          `<option${p.unidad===u?' selected':''}>${u}</option>`).join('')}
      </select></td>
      <td style="padding:6px 8px;"><input type="number" value="${p.costo}" min="0" step="0.0001"
        style="width:90px;background:var(--s2);border:1px solid var(--br);border-radius:4px;padding:6px 8px;font-size:.78rem;text-align:right;"
        oninput="crProdSet('${p.id}','costo',parseFloat(this.value)||0)"></td>
      <td style="padding:6px 8px;"><input type="number" value="${p.precio}" min="0" step="0.0001"
        style="width:90px;background:var(--s2);border:1px solid var(--br);border-radius:4px;padding:6px 8px;font-size:.78rem;text-align:right;"
        oninput="crProdSet('${p.id}','precio',parseFloat(this.value)||0)"></td>
      <td style="padding:6px 8px;text-align:right;font-weight:700;color:var(--green-deep);font-size:.82rem;">
        Q ${((p.precio||0)*(p.cant||0)).toFixed(2)}</td>
      <td style="padding:6px 8px;text-align:right;font-size:.78rem;">
        ${p.costo>0 && p.precio>0 ? '<span style="color:'+((p.precio-p.costo)/p.precio*100 >= 15?'var(--acc)':'var(--warn)')+';">'+((p.precio-p.costo)/p.precio*100).toFixed(1)+'%</span>' : '—'}</td>
      <td style="padding:6px 6px;"><button class="btn bo bsm" onclick="crRemoveProducto('${p.id}')"
        style="font-size:.65rem;padding:3px 7px;border-color:var(--danger);color:var(--danger);">✕</button></td>
    </tr>`).join('');
  crUpdateTotales();
}

function crProdSet(id, field, val) {
  const p = _crProductos.find(p => p.id === id);
  if (p) { p[field] = val; crUpdateTotales(); }
}

function crUpdateTotales() {
  let totalCosto = 0, totalVenta = 0;
  _crProductos.forEach(p => {
    totalCosto += (p.costo||0) * (p.cant||0);
    totalVenta += (p.precio||0) * (p.cant||0);
  });
  // Add gastos varios
  _crGastos.forEach(g => { totalCosto += (g.monto||0); });
  const margen = totalVenta > 0 ? ((totalVenta-totalCosto)/totalVenta*100).toFixed(1) : null;
  const tc = document.getElementById('cr-total-costo');
  const tv = document.getElementById('cr-total-venta');
  const tm = document.getElementById('cr-total-margen');
  if (tc) tc.textContent = 'Q ' + totalCosto.toFixed(2);
  if (tv) tv.textContent = 'Q ' + totalVenta.toFixed(2);
  if (tm) tm.textContent = margen ? margen + '%' : '—';
  // Comision
  const comVal = parseFloat(document.getElementById('cr-comision-val')?.value)||0;
  const comTipo = document.getElementById('cr-comision-tipo')?.value;
  if (comVal > 0) {
    const comisionMonto = comTipo === '%' ? totalVenta * comVal / 100 : comVal;
    const badge = document.getElementById('cr-resumen-comision');
    const cm = document.getElementById('cr-comision-monto');
    if (badge) badge.style.display = 'block';
    if (cm) cm.textContent = 'Q ' + comMonto.toFixed(2);
  } else {
    const badge = document.getElementById('cr-resumen-comision');
    if (badge) badge.style.display = 'none';
  }
  // Re-render margen on each row
  document.querySelectorAll('#cr-productos-tbody tr').forEach((row, i) => {
    const p = _crProductos[i];
    if (!p) return;
    const cells = row.querySelectorAll('td');
    if (cells[5]) cells[5].textContent = 'Q ' + ((p.precio||0)*(p.cant||0)).toFixed(2);
  });
}

// ── Gastos varios ─────────────────────────────────────────────────
function crAddGasto(g) {
  const row = { id: uid(), desc: g?.desc||'', monto: g?.monto||0 };
  _crGastos.push(row);
  crRenderGastos();
}

function crRemoveGasto(id) {
  _crGastos = _crGastos.filter(g => g.id !== id);
  crRenderGastos();
}

function crRenderGastos() {
  const cont = document.getElementById('cr-gastos-list');
  if (!cont) return;
  if (!_crGastos.length) {
    cont.innerHTML = '<div style="font-size:.75rem;color:var(--muted2);padding:6px 0;">Sin gastos adicionales.</div>';
    crUpdateTotales();
    return;
  }
  cont.innerHTML = _crGastos.map(g => `
    <div style="display:flex;gap:8px;align-items:center;background:var(--s2);border:1px solid var(--br);border-radius:6px;padding:8px 10px;">
      <input value="${escHtml(g.desc)}" placeholder="Descripción del gasto"
        style="flex:1;background:var(--s1);border:1px solid var(--br);border-radius:4px;padding:6px 8px;font-size:.78rem;"
        oninput="crGastoSet('${g.id}','desc',this.value)">
      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:.75rem;color:var(--muted2);">Q</span>
        <input type="number" value="${g.monto}" min="0" step="0.01" placeholder="0.00"
          style="width:90px;background:var(--s1);border:1px solid var(--br);border-radius:4px;padding:6px 8px;font-size:.78rem;text-align:right;"
          oninput="crGastoSet('${g.id}','monto',parseFloat(this.value)||0)">
      </div>
      <button class="btn bo bsm" onclick="crRemoveGasto('${g.id}')"
        style="font-size:.65rem;border-color:var(--danger);color:var(--danger);">✕</button>
    </div>`).join('');
  crUpdateTotales();
}

function crGastoSet(id, field, val) {
  const g = _crGastos.find(g => g.id === id);
  if (g) { g[field] = val; crUpdateTotales(); }
}

// ── Save / Edit / Delete ──────────────────────────────────────────
function crSave() {
  if (!DB.cotizadorRapido) DB.cotizadorRapido = [];
  const fechaOferta = document.getElementById('cr-fecha-oferta')?.value;
  const cliente     = document.getElementById('cr-cliente')?.value.trim();
  if (!fechaOferta || !cliente) { toast('⚠ Complete fecha y cliente', true); return; }
  if (!_crProductos.length)  { toast('⚠ Agrega al menos un producto', true); return; }

  const editId = document.getElementById('cr-edit-id')?.value;
  let totalCosto = 0, totalVenta = 0;
  _crProductos.forEach(p => { totalCosto += (p.costo||0)*(p.cant||0); totalVenta += (p.precio||0)*(p.cant||0); });
  _crGastos.forEach(g => { totalCosto += (g.monto||0); });
  const comVal  = parseFloat(document.getElementById('cr-comision-val')?.value)||0;
  const comTipo = document.getElementById('cr-comision-tipo')?.value;
  const comisionMonto = comTipo === '%' ? totalVenta * comVal / 100 : comVal;

  const rec = {
    fechaOferta,
    cliente,
    ref:            document.getElementById('cr-ref')?.value.trim()||'',
    tipo:           document.getElementById('cr-tipo')?.value,
    fechaEntrega:   document.getElementById('cr-fecha-entrega')?.value||'',
    requerimientos: document.getElementById('cr-requerimientos')?.value.trim()||'',
    obs:            document.getElementById('cr-obs')?.value.trim()||'',
    comisionVal:    comVal,
    comisionTipo:   comTipo,
    comisionMonto,
    productos:      JSON.parse(JSON.stringify(_crProductos)),
    gastosVarios:   JSON.parse(JSON.stringify(_crGastos)),
    totalCosto, totalVenta,
    margen: totalVenta > 0 ? ((totalVenta-totalCosto)/totalVenta*100) : 0,
    estado: 'pendiente',
    checklist: JSON.parse(JSON.stringify(_crChecklist)),
  };

  if (editId) {
    const idx = DB.cotizadorRapido.findIndex(r => r.id === editId);
    if (idx >= 0) { Object.assign(DB.cotizadorRapido[idx], rec); toast('✓ Oferta actualizada'); }
    crCancelEdit();
  } else {
    DB.cotizadorRapido.unshift({ id: uid(), ts: now(), ...rec });
    toast('✓ Oferta guardada');
  }
  crResetForm();
  save(); crRender();
}

function crSetEstado(id, estado) {
  const r = (DB.cotizadorRapido||[]).find(r => r.id === id);
  if (!r) return;
  r.estado = estado;
  r.fechaEstado = new Date().toISOString().split('T')[0];
  // If accepted, also add to dashboard calendar note
  if (estado === 'aceptada') {
    toast('✅ Oferta aceptada — registrada en calendario', false);
    // Mark in DB for dashboard
    if (!DB.calEventos) DB.calEventos = [];
    DB.calEventos.push({
      id: uid(),
      fecha: r.fechaEntrega || r.fechaOferta,
      tipo: 'entrega',
      titulo: '📦 Entrega: ' + r.cliente,
      desc: r.ref ? 'Ref: ' + r.ref : '',
      ofertaId: id,
    });
  } else {
    toast('Oferta marcada como ' + estado, false);
  }
  save(); crRender();
}

function crEdit(id) {
  const r = (DB.cotizadorRapido||[]).find(r => r.id === id);
  if (!r) return;
  document.getElementById('cr-edit-id').value = r.id;
  document.getElementById('cr-fecha-oferta').value = r.fechaOferta||'';
  document.getElementById('cr-cliente').value = r.cliente||'';
  document.getElementById('cr-ref').value = r.ref||'';
  document.getElementById('cr-tipo').value = r.tipo||'privada';
  document.getElementById('cr-fecha-entrega').value = r.fechaEntrega||'';
  document.getElementById('cr-requerimientos').value = r.requerimientos||'';
  document.getElementById('cr-obs').value = r.obs||'';
  document.getElementById('cr-comision-val').value = r.comisionVal||'';
  document.getElementById('cr-comision-tipo').value = r.comisionTipo||'Q';
  _crProductos  = JSON.parse(JSON.stringify(r.productos||[]));
  _crGastos     = JSON.parse(JSON.stringify(r.gastosVarios||[]));
  _crChecklist  = JSON.parse(JSON.stringify(r.checklist||[]));
  crRenderProductos();
  crRenderGastos();
  crRenderChecklist();
  // Mostrar checklist section si es guatecompras
  const chkSec = document.getElementById('cr-checklist-section');
  if (chkSec) chkSec.style.display = r.tipo === 'guatecompras' ? '' : 'none';
  document.getElementById('cr-form-title').textContent = 'Editando oferta: ' + r.cliente;
  document.getElementById('cr-cancel-btn').style.display = '';
  document.getElementById('cr-form-card')?.scrollIntoView({behavior:'smooth'});
}

function crCancelEdit() {
  crResetForm();
  crRender();
}

function crResetForm() {
  document.getElementById('cr-edit-id').value = '';
  document.getElementById('cr-cliente').value = '';
  document.getElementById('cr-ref').value = '';
  document.getElementById('cr-fecha-entrega').value = '';
  document.getElementById('cr-requerimientos').value = '';
  document.getElementById('cr-obs').value = '';
  document.getElementById('cr-comision-val').value = '';
  document.getElementById('cr-form-title').textContent = '➕ Nueva Oferta / Cotización';
  document.getElementById('cr-cancel-btn').style.display = 'none';
  _crProductos = [];
  _crGastos    = [];
  _crChecklist = [];
  crRenderProductos();
  crRenderGastos();
  crRenderChecklist();
  const chkSec = document.getElementById('cr-checklist-section');
  if (chkSec) chkSec.style.display = 'none';
  const fi = document.getElementById('cr-fecha-oferta');
  if (fi) { const gt = new Date(Date.now()-6*3600000); fi.value = gt.toISOString().split('T')[0]; }
}

// ── Render table ──────────────────────────────────────────────────
function crRender() {
  const tb = document.getElementById('cr-tbody');
  if (!tb) return;
  const list = (DB.cotizadorRapido||[]).slice().sort((a,b)=>(b.fechaOferta||b.ts||'').localeCompare(a.fechaOferta||a.ts||''));
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="9"><div class="empty">Sin ofertas registradas</div></td></tr>';
    return;
  }
  const TIPO_LBL = { privada:'🤝 Privado', guatecompras:'🏛 Guatecompras', walmart:'🛒 Walmart', exportacion:'🌎 Exportación', otro:'📋 Otro' };
  const EST_CHIP = {
    pendiente: '<span class="chip cw">⏳ Pendiente</span>',
    aceptada:  '<span class="chip ck">✅ Aceptada</span>',
    rechazada: '<span class="chip cr">❌ Rechazada</span>',
  };
  tb.innerHTML = list.map(r => {
    // Checklist summary
    const chk = r.checklist||[];
    const chkHtml = r.tipo==='guatecompras' && chk.length
      ? (() => {
          const tot=chk.length, ok=chk.filter(c=>c.estado==='listo').length, mal=chk.filter(c=>c.estado==='falta').length;
          const pct=Math.round(ok/tot*100);
          const color = mal>0?'var(--danger)':pct===100?'var(--acc)':'var(--warn)';
          return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:.65rem;">
            <span style="width:36px;height:5px;background:var(--br);border-radius:3px;display:inline-block;overflow:hidden;">
              <span style="width:${pct}%;height:100%;background:${color};display:block;"></span>
            </span>
            <span style="color:${color};font-weight:700;">${ok}/${tot}</span>
          </span>`;
        })()
      : '—';

    return `<tr style="cursor:pointer;" onclick="crToggleDetalle('${r.id}')" title="Click para ver detalle">
      <td>${r.fechaOferta||'—'}</td>
      <td style="font-weight:600;">${escHtml(r.cliente||'—')}</td>
      <td><span class="chip cb" style="font-size:.6rem;">${TIPO_LBL[r.tipo]||r.tipo}</span></td>
      <td style="font-size:.72rem;color:var(--muted2);">${escHtml(r.ref||'—')}</td>
      <td style="font-size:.68rem;">${chkHtml}</td>
      <td>${r.fechaEntrega||'—'}</td>
      <td style="text-align:right;font-weight:700;color:var(--green-deep);">Q ${(r.totalVenta||0).toFixed(2)}</td>
      <td>${EST_CHIP[r.estado]||EST_CHIP.pendiente}</td>
      <td style="white-space:nowrap;" onclick="event.stopPropagation()">
        ${r.estado==='pendiente'?`
          <button class="btn bo bsm" onclick="crSetEstado('${r.id}','aceptada')" style="font-size:.62rem;color:var(--acc);border-color:var(--acc);">✅</button>
          <button class="btn bo bsm" onclick="crSetEstado('${r.id}','rechazada')" style="font-size:.62rem;color:var(--danger);border-color:var(--danger);">❌</button>
        `:''}
        <button class="btn bo bsm" onclick="crEdit('${r.id}')" style="font-size:.62rem;" title="Editar">✏</button>
        <button class="btn bo bsm" onclick="del('cotizadorRapido','${r.id}')" style="font-size:.62rem;border-color:var(--danger);color:var(--danger);" title="Eliminar">✕</button>
      </td>
    </tr>
    <tr id="cr-det-${r.id}" style="display:none;">
      <td colspan="9" style="padding:0;background:var(--s2);border-bottom:2px solid var(--br);">
        <div style="padding:14px 18px;">
          ${crDetalleHTML(r)}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function crToggleDetalle(id) {
  const row = document.getElementById('cr-det-'+id);
  if (!row) return;
  const open = row.style.display !== 'none';
  // Close all others
  document.querySelectorAll('[id^="cr-det-"]').forEach(r => r.style.display = 'none');
  if (!open) row.style.display = '';
}

function crDetalleHTML(r) {
  const EST_CHK = {
    pendiente: { ico:'⏳', color:'var(--warn)' },
    listo:     { ico:'✅', color:'var(--acc)' },
    falta:     { ico:'❌', color:'var(--danger)' },
  };
  let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;flex-wrap:wrap;">';

  // Left: productos + gastos
  html += '<div>';
  html += '<div style="font-size:.65rem;font-weight:700;color:var(--muted2);letter-spacing:.07em;text-transform:uppercase;margin-bottom:8px;">Productos</div>';
  html += '<table style="width:100%;font-size:.72rem;border-collapse:collapse;">';
  html += '<thead><tr style="color:var(--muted2);"><th style="text-align:left;padding:3px 6px;">Producto</th><th style="text-align:right;padding:3px 6px;">Cant</th><th style="text-align:right;padding:3px 6px;">Costo</th><th style="text-align:right;padding:3px 6px;">Precio</th><th style="text-align:right;padding:3px 6px;">Total</th></tr></thead>';
  html += '<tbody>';
  (r.productos||[]).forEach(p => {
    html += `<tr style="border-top:1px solid var(--br);">
      <td style="padding:4px 6px;">${escHtml(p.nombre||p.desc||'—')}</td>
      <td style="text-align:right;padding:4px 6px;">${p.cant||0} ${p.unidad||''}</td>
      <td style="text-align:right;padding:4px 6px;">Q ${(p.costo||0).toFixed(2)}</td>
      <td style="text-align:right;padding:4px 6px;">Q ${(p.precio||0).toFixed(2)}</td>
      <td style="text-align:right;padding:4px 6px;font-weight:700;">Q ${((p.precio||0)*(p.cant||0)).toFixed(2)}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  if ((r.gastosVarios||[]).length) {
    html += '<div style="margin-top:10px;font-size:.65rem;font-weight:700;color:var(--muted2);letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px;">Gastos Varios</div>';
    (r.gastosVarios||[]).forEach(g => {
      html += `<div style="display:flex;justify-content:space-between;font-size:.72rem;padding:3px 0;border-bottom:1px solid var(--br);">
        <span>${escHtml(g.desc||g.nombre||'—')}</span>
        <span style="font-weight:700;">Q ${(g.monto||0).toFixed(2)}</span>
      </div>`;
    });
  }
  // Totals
  html += `<div style="margin-top:10px;display:flex;gap:16px;font-size:.75rem;">
    <span>Costo: <strong>Q ${(r.totalCosto||0).toFixed(2)}</strong></span>
    <span>Venta: <strong style="color:var(--acc);">Q ${(r.totalVenta||0).toFixed(2)}</strong></span>
    <span>Margen: <strong style="color:${(r.margen||0)>=15?'var(--acc)':'var(--warn)'};">${(r.margen||0).toFixed(1)}%</strong></span>
    ${r.comisionMonto>0?`<span>Comisión: <strong>Q ${r.comisionMonto.toFixed(2)}</strong></span>`:''}
  </div>`;
  html += '</div>';

  // Right: checklist + obs
  html += '<div>';
  if (r.requerimientos) {
    html += `<div style="font-size:.65rem;font-weight:700;color:var(--muted2);letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px;">Requerimientos</div>`;
    html += `<div style="font-size:.72rem;background:var(--s1);border:1px solid var(--br);border-radius:6px;padding:8px;margin-bottom:12px;white-space:pre-wrap;">${escHtml(r.requerimientos)}</div>`;
  }
  if (r.tipo==='guatecompras' && (r.checklist||[]).length) {
    html += '<div style="font-size:.65rem;font-weight:700;color:var(--muted2);letter-spacing:.07em;text-transform:uppercase;margin-bottom:8px;">📋 Checklist Requisitos</div>';
    const tot=r.checklist.length, ok=r.checklist.filter(c=>c.estado==='listo').length;
    html += `<div style="margin-bottom:8px;font-size:.7rem;">
      <div style="width:100%;height:7px;background:var(--br);border-radius:4px;overflow:hidden;margin-bottom:4px;">
        <div style="width:${Math.round(ok/tot*100)}%;height:100%;background:${ok===tot?'var(--acc)':'var(--warn)'};transition:.3s;"></div>
      </div>
      <span style="color:var(--muted2);">${ok} de ${tot} requisitos listos</span>
    </div>`;
    r.checklist.forEach(c => {
      const e = EST_CHK[c.estado]||EST_CHK.pendiente;
      html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;margin-bottom:4px;border-radius:5px;border:1px solid var(--br);font-size:.72rem;">
        <button onclick="crChecklistToggleInline('${r.id}','${c.id}',event)"
          style="background:none;border:none;cursor:pointer;font-size:.85rem;padding:0;flex-shrink:0;"
          title="Click para cambiar estado">${e.ico}</button>
        <span style="flex:1;color:${c.estado==='falta'?'var(--danger)':c.estado==='listo'?'var(--muted2)':'var(--txt)'};
          ${c.estado==='listo'?'text-decoration:line-through;':''}">${escHtml(c.texto)}</span>
        <span style="font-size:.6rem;color:${e.color};font-weight:700;">${c.estado.toUpperCase()}</span>
      </div>`;
    });
  }
  if (r.obs) {
    html += `<div style="margin-top:10px;font-size:.65rem;font-weight:700;color:var(--muted2);letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px;">Observaciones</div>`;
    html += `<div style="font-size:.72rem;color:var(--muted2);white-space:pre-wrap;">${escHtml(r.obs)}</div>`;
  }
  html += `<div style="margin-top:14px;display:flex;gap:8px;">
    <button class="btn bo bsm" onclick="crEdit('${r.id}');crToggleDetalle('${r.id}')" style="font-size:.7rem;">✏️ Editar oferta completa</button>
  </div>`;
  html += '</div>';
  html += '</div>';
  return html;
}

function crChecklistToggleInline(offerId, itemId, event) {
  event.stopPropagation();
  const r = (DB.cotizadorRapido||[]).find(x => x.id === offerId);
  if (!r) return;
  const item = (r.checklist||[]).find(c => c.id === itemId);
  if (!item) return;
  const ciclo = { pendiente:'listo', listo:'falta', falta:'pendiente' };
  item.estado = ciclo[item.estado]||'pendiente';
  save();
  crRender();
  // Re-open the detail row
  setTimeout(() => {
    const row = document.getElementById('cr-det-'+offerId);
    if (row) row.style.display = '';
  }, 50);
}


function crExportCSV() {
  const list = (DB.cotizadorRapido||[]).slice().sort((a,b)=>(b.fechaOferta||'').localeCompare(a.fechaOferta||''));
  if (!list.length) { toast('Sin datos para exportar', true); return; }
  let csv = '\uFEFF' + 'Fecha Oferta,Cliente,Tipo,Referencia,F.Entrega,Costo Total,Precio Total,Margen%,Comisión Q,Estado\n';
  list.forEach(r => {
    csv += [r.fechaOferta,r.cliente,r.tipo,r.ref||'',r.fechaEntrega||'',(r.totalCosto||0).toFixed(2),(r.totalVenta||0).toFixed(2),(r.margen||0).toFixed(1),(r.comisionMonto||0).toFixed(2),r.estado||'pendiente']
      .map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',') + '\n';
  });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),
    download: 'CotizadorRapido_'+new Date().toISOString().split('T')[0]+'.csv'
  });
  a.click();
  toast('✅ CSV descargado');
}

// Helper to escape HTML in user inputs
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


