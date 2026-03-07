// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/walmart/index.js
// Pedidos Walmart — Estados: pendiente | en_curso | cerrado | con_rechazo
// Build 54 — Marzo 2026
//
// Dependencias externas:
//   - DB, save()            → core/firebase.js
//   - uid(), now(), toast() → core/utils.js
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// PEDIDOS WALMART
// Estados: pendiente | en_curso | cerrado | con_rechazo
// ══════════════════════════════════════════════════════════════════

let pwActivoId   = null;
let pwRubroCount = 0;
let pwCalYear    = new Date().getFullYear();
let pwCalMonth   = new Date().getMonth(); // 0-indexed
let pwNotifInterval = null;

const PW_ESTADOS = {
  pendiente:    { label:'Pendiente',    color:'var(--orange)',  icon:'⏳' },
  en_curso:     { label:'En curso',     color:'var(--info)',    icon:'🚛' },
  cerrado:      { label:'Aceptado ✓',   color:'var(--acc)',     icon:'✅' },
  con_rechazo:  { label:'Con rechazo',  color:'var(--danger)',  icon:'⚠️' },
  sin_stock:    { label:'Sin stock',    color:'var(--muted2)',  icon:'📦' },
};

// ── Init ─────────────────────────────────────────────────────────
function pwInit() {
  if (!DB.pedidosWalmart) DB.pedidosWalmart = [];
  // Set default month filter
  const fil = document.getElementById('pw-fil-fecha');
  if (fil && !fil.value) {
    const now = new Date();
    fil.value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  }
  pwRenderLista();
  pwRenderCalendario();
  pwCheckNotificaciones();
  // Start notification checker every minute
  if (pwNotifInterval) clearInterval(pwNotifInterval);
  pwNotifInterval = setInterval(pwCheckNotificaciones, 60000);
}

// ── Tab navigation ────────────────────────────────────────────────
function pwTab(name, el) {
  ['lista','calendario','form'].forEach(t => {
    document.getElementById('pw-panel-'+t).style.display = t===name ? '' : 'none';
    const tab = document.getElementById('pw-tab-'+t);
    if (tab) tab.classList.toggle('active', t===name);
  });
  if (name === 'lista')      pwRenderLista();
  if (name === 'calendario') pwRenderCalendario();
}

// ── Nuevo pedido ──────────────────────────────────────────────────


// ── Excel-like grid for pedido rubros ─────────────────────────────
let pwGridRowCount = 0;

function pwGridAddRow(item, desc, cajas, prodId) {
  pwGridRowCount++;
  const n = pwGridRowCount;
  const tbody = document.getElementById('pw-grid-body');
  if (!tbody) return;
  const prodOpts = '<option value="">— Vincular producto —</option>' +
    (DB.iproductos||[]).map(p => `<option value="${p.id}"${prodId===p.id?' selected':''}>${p.nombre}</option>`).join('');
  const tr = document.createElement('tr');
  tr.id = 'pw-grid-row-'+n;
  tr.style.cssText = 'transition:background .1s;';
  tr.innerHTML = `
    <td style="padding:3px 4px;border:1.5px solid var(--br);">
      <input id="pwg-item-${n}" value="${item||''}" placeholder="Código" 
        style="width:100%;background:transparent;border:none;color:var(--txt);font-family:var(--fm);font-size:.82rem;padding:5px 7px;outline:none;"
        oninput="pwGridCalcTotal()">
    </td>
    <td style="padding:3px 4px;border:1.5px solid var(--br);">
      <input id="pwg-desc-${n}" value="${desc||''}" placeholder="Descripción del producto"
        style="width:100%;background:transparent;border:none;color:var(--txt);font-family:var(--fm);font-size:.82rem;padding:5px 7px;outline:none;"
        oninput="pwGridCalcTotal()">
    </td>
    <td style="padding:3px 4px;border:1.5px solid var(--br);text-align:center;">
      <input id="pwg-cajas-${n}" type="number" value="${cajas||''}" min="0" placeholder="0"
        style="width:80px;background:transparent;border:none;color:var(--green-deep);font-family:var(--fh);font-size:.9rem;font-weight:700;padding:5px 7px;outline:none;text-align:center;"
        oninput="pwGridCalcTotal()">
    </td>
    <td style="padding:3px 4px;border:1.5px solid var(--br);">
      <select id="pwg-prod-${n}" 
        style="width:100%;background:transparent;border:none;color:var(--txt);font-family:var(--fn);font-size:.75rem;padding:5px 4px;outline:none;cursor:pointer;">
        ${prodOpts}
      </select>
    </td>
    <td style="padding:3px 4px;border:1.5px solid var(--br);text-align:center;">
      <button onclick="pwGridDelRow(${n})" style="background:none;border:none;cursor:pointer;font-size:1rem;color:var(--muted);padding:3px;" title="Eliminar fila">✕</button>
    </td>`;
  tbody.appendChild(tr);
  // Focus the item field of new row
  setTimeout(() => document.getElementById('pwg-item-'+n)?.focus(), 50);
  pwGridCalcTotal();
}

function pwGridDelRow(n) {
  const row = document.getElementById('pw-grid-row-'+n);
  if (row) row.remove();
  pwGridCalcTotal();
}

function pwGridCalcTotal() {
  let total = 0;
  for (let i = 1; i <= pwGridRowCount; i++) {
    const el = document.getElementById('pwg-cajas-'+i);
    if (el && el.closest('#pw-grid-body')) total += parseFloat(el.value)||0;
  }
  const tot = document.getElementById('pw-grid-total');
  if (tot) {
    if (total > 0) {
      tot.style.display = '';
      tot.innerHTML = `📦 Total cajas: <strong style="font-size:1rem;color:var(--green-deep);">${total}</strong>`;
    } else {
      tot.style.display = 'none';
    }
  }
}

function pwGridClear() {
  const tbody = document.getElementById('pw-grid-body');
  if (tbody) tbody.innerHTML = '';
  pwGridRowCount = 0;
  pwGridCalcTotal();
}

function pwGridGetRubros() {
  const rubros = [];
  for (let i = 1; i <= pwGridRowCount; i++) {
    const itemEl  = document.getElementById('pwg-item-'+i);
    if (!itemEl || !itemEl.closest('#pw-grid-body')) continue;
    const descEl  = document.getElementById('pwg-desc-'+i);
    const cajasEl = document.getElementById('pwg-cajas-'+i);
    const prodEl  = document.getElementById('pwg-prod-'+i);
    const cajas   = parseFloat(cajasEl?.value) || 0;
    const desc    = (descEl?.value || '').trim();
    if (!desc && cajas === 0) continue;
    rubros.push({
      n: rubros.length + 1,
      item:        (itemEl?.value || '').trim(),
      descripcion: desc,
      cajasPedidas: cajas,
      productoId:  prodEl?.value || '',
      estado:      'pendiente',
      cajasAceptadas:  null,
      cajasRechazadas: null,
    });
  }
  return rubros;
}

function pwImportarDesdeCorreo() {
  const dlg = document.getElementById('pw-import-dialog');
  if (dlg) dlg.style.display = dlg.style.display === 'none' ? '' : 'none';
}

// ── Updated parser — populates Excel grid ─────────────────────────
function pwParsearCorreo() {
  const raw = (document.getElementById('pw-correo-raw')?.value || '').trim();
  if (!raw) { toast('\u26a0 Pega el texto del correo primero', true); return; }

  const KNOWN_SIZES = ['_300','_200','_100','_50','_48','_40','_36','_30',
                       '_24','_20','_18','_12','_10','_8','_6','_4'];

  // Auto-match product in inventory
  function matchProd(desc) {
    const dn = desc.toUpperCase().replace(/\s+/g,'').replace(/UXC_\d+/,'').replace(/LB/,'');
    return (DB.iproductos || []).find(p => {
      const pn = (p.nombre||'').toUpperCase().replace(/\s+/g,'');
      return pn.length > 3 && dn.length > 3 &&
             (pn.includes(dn.slice(0,5)) || dn.includes(pn.slice(0,5)));
    });
  }

  // Split desc+cajas string using known UXC size codes
  function splitDescCajas(str) {
    for (const sz of KNOWN_SIZES) {
      const idx = str.lastIndexOf(sz);
      if (idx < 0) continue;
      const after = str.slice(idx + sz.length).trim();
      if (/^\d+$/.test(after)) {
        return { desc: str.slice(0, idx + sz.length).trim(), cajas: parseInt(after, 10) };
      }
    }
    // fallback: trailing digit group
    const m = str.match(/^(.*\D)\s+(\d+)\s*$/);
    return m ? { desc: m[1].trim(), cajas: parseInt(m[2], 10) } : { desc: str.trim(), cajas: 0 };
  }

  const parsed = [];

  // ── FORMAT A: TAB-SEPARATED (copy from HTML table in email) ──────
  // Columns: #ATLAS | #SAP | CÓD.PROV | NOM.PROV | Item | Descrip | Cajas | Hora | Rampa | Dia | Nota
  const hasTab = raw.includes('\t');
  if (hasTab) {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      const cols = line.split('\t').map(c => c.trim());
      // Skip header row
      if (cols[0].includes('ATLAS') || cols[0].includes('#') || cols[4] === 'Item') return;
      if (cols.length < 6) return;
      // col[4]=item, col[5]=desc, col[6]=cajas, col[7]=hora, col[8]=rampa, col[9]=dia
      const item  = cols[4] || '';
      const desc  = cols[5] || '';
      const cajas = parseInt(cols[6], 10) || 0;
      const hora  = (cols[7] || '16:00').slice(0, 5);
      const rampa = cols[8] || '';
      const dia   = (cols[9] || '').replace(/\s*-\s*$/, '').trim();
      if (!item && !desc) return;
      const prod = matchProd(desc);
      parsed.push({ item, desc, cajas, hora, rampa, dia, prodId: prod ? prod.id : '' });
    });
  }

  // ── FORMAT B: CONCATENATED STRING (copy as plain text) ───────────
  // "001599010650AGROINDUSTRIA AJUA, S.A.9425739CEBOLLA BLANCA UXC_309816:00:005010 MIERCOLES..."
  if (!parsed.length) {
    const dataM = raw.match(/0015\d{8}|\d{10}/);
    const data = dataM ? raw.slice(dataM.index) : raw;
    const recStarts = [];
    const recRe = /0015\d{8}/g;
    let rm;
    while ((rm = recRe.exec(data)) !== null) recStarts.push(rm.index);
    recStarts.push(data.length);

    for (let i = 0; i < recStarts.length - 1; i++) {
      let chunk = data.slice(recStarts[i], recStarts[i+1]).trim().replace(/\s*-\s*$/, '');
      const tmM = chunk.match(/(\d{2}:\d{2}:\d{2})/);
      if (!tmM) continue;
      const before = chunk.slice(0, tmM.index);
      const afterT = chunk.slice(tmM.index + tmM[1].length).trim();
      const raM    = afterT.match(/^(\d{4})\s*([\s\S]*)/);
      const rampa  = raM ? raM[1] : '';
      const dia    = raM ? raM[2].replace(/\s{2,}/g,' ').replace(/\s*-\s*$/,'').trim() : '';
      const pfxM   = before.match(/^(\d{4})(\d{8})/);
      if (!pfxM) continue;
      const rest   = before.slice(pfxM[0].length);
      const itemM  = rest.match(/(\d{5,})/);
      if (!itemM) continue;
      const item   = itemM[1];
      const { desc, cajas } = splitDescCajas(rest.slice(itemM.index + item.length));
      const prod = matchProd(desc);
      parsed.push({ item, desc, cajas, hora: tmM[1].slice(0,5), rampa, dia, prodId: prod ? prod.id : '' });
    }
  }

  // ── FORMAT C: LINE-BY-LINE with spaces/time anchor ───────────────
  if (!parsed.length) {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      const tmM = line.match(/(\d{2}:\d{2}:\d{2})/);
      if (!tmM) return;
      const before = line.slice(0, tmM.index).trim();
      const afterT = line.slice(tmM.index + tmM[1].length).trim();
      const raM    = afterT.match(/^(\d{4,})\s*(.*)/);
      const rampa  = raM ? raM[1] : '';
      const dia    = raM ? raM[2].replace(/\s*-\s*$/, '').trim() : '';
      const itemM  = before.match(/(\d{5,8})\s+/);
      if (!itemM) return;
      const item   = itemM[1];
      const { desc, cajas } = splitDescCajas(before.slice(itemM.index + itemM[0].length));
      if (!desc) return;
      const prod = matchProd(desc);
      parsed.push({ item, desc, cajas, hora: tmM[1].slice(0,5), rampa, dia, prodId: prod ? prod.id : '' });
    });
  }

  if (!parsed.length) {
    toast('\u26a0 No se pudo leer el pedido. Prueba copiando la tabla completa del correo (Ctrl+A en el correo, luego Ctrl+C).', true);
    return;
  }

  // Fill header from parsed data — ALWAYS overwrite hora/rampa/dia (they come from email)
  const f = parsed[0];
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  const setIfEmpty = (id, val) => { const el = document.getElementById(id); if (el && !el.value && val) el.value = val; };
  setVal('pw-hora-entrega', f.hora || '16:00');   // always from email
  setVal('pw-rampa',        f.rampa);              // always from email
  setVal('pw-nota',         f.dia);               // always from email (DIA DE ENTREGA)
  setIfEmpty('pw-atlas',   f.sap || '');           // only if empty
  // Try to parse fecha from DIA DE ENTREGA e.g. "MIERCOLES 04 DE MARZO"
  if (f.dia && !document.getElementById('pw-fecha-entrega')?.value) {
    const MESES = {ENERO:1,FEBRERO:2,MARZO:3,ABRIL:4,MAYO:5,JUNIO:6,
                   JULIO:7,AGOSTO:8,SEPTIEMBRE:9,OCTUBRE:10,NOVIEMBRE:11,DICIEMBRE:12};
    const dm = f.dia.toUpperCase().match(/(\d{1,2})\s+DE\s+(\w+)/);
    if (dm) {
      const day = parseInt(dm[1], 10);
      const mon = MESES[dm[2]];
      if (mon) {
        const yr  = new Date().getFullYear();
        const fe  = document.getElementById('pw-fecha-entrega');
        if (fe) fe.value = yr+'-'+String(mon).padStart(2,'0')+'-'+String(day).padStart(2,'0');
      }
    }
  }

  // Populate grid
  pwGridClear();
  parsed.forEach(p => pwGridAddRow(p.item, p.desc, p.cajas, p.prodId));

  document.getElementById('pw-correo-raw').value = '';
  const dlg = document.getElementById('pw-import-dialog');
  if (dlg) dlg.style.display = 'none';

  toast('\u2705 ' + parsed.length + ' rubros importados \u2014 ' + (f.dia || ''));
}

function pwNuevoPedido(baseId) {
  pwActivoId = null;
  pwRubroCount = 0;
  // Clear form
  ['pw-fecha-entrega','pw-hora-entrega','pw-rampa','pw-oc','pw-atlas','pw-nota','pw-obs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id==='pw-hora-entrega' ? '16:00' : '';
  });
  pwGridClear();
  document.getElementById('pw-cierre-card').style.display = 'none';

  const header = document.getElementById('pw-form-header');
  if (header) {
    let baseInfo = '';
    if (baseId) {
      const base = DB.pedidosWalmart.find(p=>p.id===baseId);
      if (base) {
        // Pre-fill date and rampa from base
        document.getElementById('pw-fecha-entrega').value = base.fechaEntrega;
        document.getElementById('pw-hora-entrega').value  = base.horaEntrega || '16:00';
        document.getElementById('pw-rampa').value         = base.rampa || '';
        baseInfo = '<div style="background:var(--orange-pale);border:1.5px solid rgba(242,104,34,.3);border-radius:var(--r);padding:8px 12px;font-size:.78rem;font-family:var(--fn);color:var(--orange-deep);margin-bottom:12px;">📎 Agregado al pedido del '+base.fechaEntrega+'</div>';
        document.getElementById('pw-oc').dataset.baseId = baseId;
      }
    }
    header.innerHTML = baseInfo + '<div style="font-family:var(--fh);font-size:1.1rem;font-weight:800;color:var(--green-deep);">✏️ Nuevo Pedido Walmart</div>';
  }

  // Add first grid row
  pwGridAddRow();
  pwTab('form', document.getElementById('pw-tab-form'));
  document.getElementById('pw-tab-form').style.display = '';
}

// ── Editar pedido ─────────────────────────────────────────────────
function pwEditarPedido(id) {
  const rec = DB.pedidosWalmart.find(p=>p.id===id);
  if (!rec) return;
  pwActivoId = id;
  pwRubroCount = 0;

  document.getElementById('pw-fecha-entrega').value = rec.fechaEntrega || '';
  document.getElementById('pw-hora-entrega').value  = rec.horaEntrega || '16:00';
  document.getElementById('pw-rampa').value         = rec.rampa || '';
  document.getElementById('pw-oc').value            = rec.oc || '';
  document.getElementById('pw-atlas').value         = rec.atlas || '';
  document.getElementById('pw-nota').value          = rec.nota || '';
  document.getElementById('pw-obs').value           = rec.obs || '';

  pwGridClear();
  (rec.rubros || []).forEach(r => pwGridAddRow(r.item, r.descripcion, r.cajasPedidas, r.productoId||''));

  const header = document.getElementById('pw-form-header');
  if (header) header.innerHTML = '<div style="font-family:var(--fh);font-size:1.1rem;font-weight:800;color:var(--green-deep);">✏️ Editando Pedido — '+rec.fechaEntrega+'</div>';

  // Show cierre card if en_curso and same day or past
  const hoy = new Date().toISOString().split('T')[0];
  if ((rec.estado === 'en_curso' || rec.estado === 'pendiente') && rec.fechaEntrega <= hoy) {
    pwMostrarCierre(rec);
  } else {
    document.getElementById('pw-cierre-card').style.display = 'none';
  }

  pwTab('form', document.getElementById('pw-tab-form'));
  document.getElementById('pw-tab-form').style.display = '';
}

// ── Add rubro ─────────────────────────────────────────────────────
function pwAddRubro() {
  pwRubroCount++;
  const n = pwRubroCount;
  const cont = document.getElementById('pw-rubros-container');
  const prodOpts = (DB.iproductos||[]).map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');
  const div = document.createElement('div');
  div.id = 'pw-rb-'+n;
  div.style.cssText = 'background:var(--s1);border:1.5px solid var(--br);border-radius:var(--r);padding:12px;margin-bottom:8px;position:relative;';
  div.innerHTML = `
    <div style="position:absolute;top:8px;right:8px;">
      <button class="btn bsm" style="background:rgba(214,48,48,.1);color:var(--danger);border:none;padding:3px 8px;" onclick="pwDelRubro(${n})">✕</button>
    </div>
    <div style="font-family:var(--fn);font-size:.65rem;font-weight:700;color:var(--muted);letter-spacing:.08em;margin-bottom:8px;">RUBRO ${n}</div>
    <div class="fgrid g5" style="margin-bottom:0;">
      <div class="fg"><label>Ítem / Código</label><input id="pw-rb-item-${n}" placeholder="Ej. 3424269" oninput="pwCalcTotales()"></div>
      <div class="fg" style="grid-column:span 2;"><label>Descripción del ítem</label><input id="pw-rb-desc-${n}" placeholder="CEBOLLA BLANCA UXC_30" oninput="pwCalcTotales()"></div>
      <div class="fg"><label>Cajas pedidas *</label><input type="number" id="pw-rb-cajas-${n}" placeholder="0" min="0" oninput="pwCalcTotales()"></div>
      <div class="fg"><label>Producto (inventario)</label>
        <select id="pw-rb-prod-${n}">
          <option value="">— Vincular —</option>
          ${prodOpts}
        </select>
      </div>
    </div>`;
  cont.appendChild(div);
  pwCalcTotales();
}

function pwDelRubro(n) {
  const el = document.getElementById('pw-rb-'+n);
  if (el) el.remove();
  pwCalcTotales();
}

function pwCalcTotales() {
  let totalCajas = 0;
  for (let i=1; i<=pwRubroCount; i++) {
    const el = document.getElementById('pw-rb-cajas-'+i);
    if (el) totalCajas += parseFloat(el.value)||0;
  }
  const tot = document.getElementById('pw-rubros-totales');
  if (!tot) return;
  if (totalCajas > 0) {
    tot.style.display = '';
    tot.innerHTML = `📦 Total cajas pedidas: <strong style="font-size:1rem;color:var(--green-deep);">${totalCajas}</strong>`;
  } else {
    tot.style.display = 'none';
  }
}

// ── Guardar pedido ────────────────────────────────────────────────
function pwGuardarPedido() {
  const fechaEntrega = document.getElementById('pw-fecha-entrega')?.value;
  if (!fechaEntrega) { toast('⚠ Ingresa la fecha de entrega', true); return; }

  const rubros = pwGridGetRubros();
  if (!rubros.length) { toast('⚠ Agrega al menos un rubro', true); return; }

  const baseIdEl = document.getElementById('pw-oc');
  const baseId   = baseIdEl?.dataset?.baseId || null;

  const rec = {
    id:           pwActivoId || uid(),
    ts:           now(),
    fechaEntrega,
    horaEntrega:  document.getElementById('pw-hora-entrega')?.value || '16:00',
    rampa:        document.getElementById('pw-rampa')?.value || '',
    oc:           document.getElementById('pw-oc')?.value || '',
    atlas:        document.getElementById('pw-atlas')?.value || '',
    nota:         document.getElementById('pw-nota')?.value || '',
    obs:          document.getElementById('pw-obs')?.value || '',
    rubros,
    estado:       'pendiente',
    esAgregado:   !!baseId,
    baseId,
    albaranDoc:   null,
    rechazoDoc:   null,
    cierreTs:     null,
  };

  if (pwActivoId) {
    // Keep existing docs and estado on edit
    const old = DB.pedidosWalmart.find(p=>p.id===pwActivoId);
    if (old) {
      rec.estado    = old.estado;
      rec.albaranDoc= old.albaranDoc;
      rec.rechazoDoc= old.rechazoDoc;
      rec.cierreTs  = old.cierreTs;
      rec.rubros    = rubros.map(r => {
        const oldR = old.rubros?.find(o=>o.n===r.n);
        return oldR ? {...r, estado:oldR.estado, cajasAceptadas:oldR.cajasAceptadas, cajasRechazadas:oldR.cajasRechazadas} : r;
      });
      const idx = DB.pedidosWalmart.findIndex(p=>p.id===pwActivoId);
      DB.pedidosWalmart[idx] = rec;
    }
  } else {
    DB.pedidosWalmart.unshift(rec);
    pwActivoId = rec.id;
  }

  if (baseIdEl) delete baseIdEl.dataset.baseId;

  save(); pwRenderLista(); pwRenderCalendario();
  toast('✅ Pedido guardado — '+fechaEntrega);
  pwTab('lista', document.getElementById('pw-tab-lista'));
  document.getElementById('pw-tab-form').style.display = 'none';
}

// ── Mostrar cierre del día ────────────────────────────────────────
function pwMostrarCierre(rec) {
  const card = document.getElementById('pw-cierre-card');
  if (!card) return;
  card.style.display = '';
  const cont = document.getElementById('pw-cierre-rubros');
  if (!cont) return;

  cont.innerHTML = `
    <div style="background:rgba(242,104,34,.08);border:1.5px solid rgba(242,104,34,.3);border-radius:var(--r);padding:10px 14px;margin-bottom:14px;font-family:var(--fn);font-size:.8rem;color:var(--orange-deep);">
      🔔 Fin de día — confirma si cada rubro fue aceptado o rechazado por Walmart.
    </div>` +
    (rec.rubros||[]).map(r => `
    <div style="background:var(--s1);border:1.5px solid var(--br);border-radius:var(--r);padding:12px;margin-bottom:8px;" id="pw-cierre-rb-${r.n}">
      <div style="font-family:var(--fn);font-weight:700;font-size:.85rem;color:var(--green-deep);margin-bottom:10px;">
        ${r.item ? r.item+' · ' : ''}${r.descripcion} <span style="color:var(--muted);font-weight:400;">(${r.cajasPedidas} cajas pedidas)</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;align-items:end;">
        <div class="fg"><label>¿Resultado?</label>
          <select id="pw-cr-estado-${r.n}" onchange="pwCierreToggle(${r.n})" style="font-weight:700;">
            <option value="">— Seleccionar —</option>
            <option value="aceptado">✅ Aceptado completo</option>
            <option value="parcial">⚠️ Aceptado parcial</option>
            <option value="rechazado">❌ Rechazado</option>
            <option value="no_llevado">📦 No lo llevé (sin stock)</option>
          </select>
        </div>
        <div class="fg" id="pw-cr-aceptadas-wrap-${r.n}" style="display:none;">
          <label>Cajas aceptadas</label>
          <input type="number" id="pw-cr-aceptadas-${r.n}" min="0" max="${r.cajasPedidas}" placeholder="0" oninput="pwCierreCalc(${r.n},${r.cajasPedidas})">
        </div>
        <div class="fg" id="pw-cr-rechazadas-wrap-${r.n}" style="display:none;">
          <label>Cajas rechazadas</label>
          <input type="number" id="pw-cr-rechazadas-${r.n}" min="0" max="${r.cajasPedidas}" placeholder="0" readonly style="background:var(--orange-pale);color:var(--orange-deep);font-weight:700;">
        </div>
      </div>
    </div>`).join('');
}

function pwCierreToggle(n) {
  const estado = document.getElementById('pw-cr-estado-'+n)?.value;
  const showParcial = estado === 'parcial';
  document.getElementById('pw-cr-aceptadas-wrap-'+n).style.display  = showParcial ? '' : 'none';
  document.getElementById('pw-cr-rechazadas-wrap-'+n).style.display = showParcial ? '' : 'none';
  if (estado === 'aceptado') {
    const rb = (DB.pedidosWalmart.find(p=>p.id===pwActivoId)?.rubros||[]).find(r=>r.n===n);
    if (rb) document.getElementById('pw-cr-aceptadas-'+n) && (document.getElementById('pw-cr-aceptadas-'+n).value = rb.cajasPedidas);
  }
  pwUpdateCierreDoc();
}

function pwCierreCalc(n, cajasPedidas) {
  const aceptadas = parseFloat(document.getElementById('pw-cr-aceptadas-'+n)?.value)||0;
  const rechEl = document.getElementById('pw-cr-rechazadas-'+n);
  if (rechEl) rechEl.value = Math.max(0, cajasPedidas - aceptadas);
  pwUpdateCierreDoc();
}

function pwUpdateCierreDoc() {
  const rec = DB.pedidosWalmart.find(p=>p.id===pwActivoId);
  if (!rec) return;
  let hayRechazo = false;
  (rec.rubros||[]).forEach(r => {
    const est = document.getElementById('pw-cr-estado-'+r.n)?.value;
    if (est==='rechazado' || est==='parcial') hayRechazo = true;
  });

  const docCont = document.getElementById('pw-cierre-docs');
  if (!docCont) return;
  docCont.style.display = '';
  docCont.innerHTML = `
    <div style="background:var(--s2);border:1.5px solid var(--br);border-radius:var(--r2);padding:14px;">
      <div style="font-family:var(--fn);font-size:.65rem;font-weight:700;color:var(--green-deep);letter-spacing:.1em;margin-bottom:12px;">📎 DOCUMENTOS OBLIGATORIOS</div>
      <div class="fgrid g2" style="margin-bottom:0;">
        <div style="background:${rec.albaranDoc?'rgba(0,122,82,.08)':'rgba(242,104,34,.06)'};border:1.5px ${rec.albaranDoc?'solid rgba(0,122,82,.3)':'dashed rgba(242,104,34,.4)'};border-radius:var(--r);padding:12px;text-align:center;">
          <div style="font-size:2rem;margin-bottom:6px;">${rec.albaranDoc?'✅':'📄'}</div>
          <div style="font-family:var(--fn);font-size:.78rem;font-weight:700;color:var(--green-deep);margin-bottom:6px;">Albarán de entrega *</div>
          <div style="font-size:.7rem;color:var(--muted);margin-bottom:8px;">Obligatorio siempre</div>
          ${rec.albaranDoc ?
            '<span class="chip ck">✓ Cargado</span>' :
            '<label class="btn bsm" style="cursor:pointer;background:var(--green-deep);color:var(--cream);display:inline-flex;align-items:center;gap:5px;">📎 Cargar<input type="file" accept="image/*,.pdf" style="display:none;" onchange="pwLoadDoc(this,\'albaran\')"></label>'
          }
        </div>
        <div id="pw-doc-rechazo-wrap" style="background:${hayRechazo?(rec.rechazoDoc?'rgba(0,122,82,.08)':'rgba(214,48,48,.06)'):'var(--s3)'};border:1.5px ${hayRechazo?(rec.rechazoDoc?'solid rgba(0,122,82,.3)':'dashed rgba(214,48,48,.4)'):'solid var(--br)'};border-radius:var(--r);padding:12px;text-align:center;${!hayRechazo?'opacity:.5;':''}">
          <div style="font-size:2rem;margin-bottom:6px;">${rec.rechazoDoc?'✅':'🚫'}</div>
          <div style="font-family:var(--fn);font-size:.78rem;font-weight:700;color:${hayRechazo?'var(--danger)':'var(--muted)'};margin-bottom:6px;">Hoja de rechazo${hayRechazo?' *':''}</div>
          <div style="font-size:.7rem;color:var(--muted);margin-bottom:8px;">${hayRechazo?'Obligatorio — hubo rechazo':'Solo si hay rechazo'}</div>
          ${hayRechazo ?
            (rec.rechazoDoc ?
              '<span class="chip ck">✓ Cargado</span>' :
              '<label class="btn bsm" style="cursor:pointer;background:var(--danger);color:#fff;display:inline-flex;align-items:center;gap:5px;">📎 Cargar<input type="file" accept="image/*,.pdf" style="display:none;" onchange="pwLoadDoc(this,\'rechazo\')"></label>'
            ) : ''
          }
        </div>
      </div>
    </div>`;
}

function pwLoadDoc(input, tipo) {
  const file = input.files[0]; if (!file) return;
  const rec = DB.pedidosWalmart.find(p=>p.id===pwActivoId);
  if (!rec) return;
  const reader = new FileReader();
  reader.onload = e => {
    if (tipo === 'albaran')  rec.albaranDoc  = e.target.result;
    if (tipo === 'rechazo')  rec.rechazoDoc  = e.target.result;
    save();
    pwUpdateCierreDoc();
    toast('✅ Documento cargado — '+(tipo==='albaran'?'Albarán':'Hoja de rechazo'));
  };
  reader.readAsDataURL(file);
}

// ── Guardar cierre ────────────────────────────────────────────────
function pwGuardarCierre() {
  const rec = DB.pedidosWalmart.find(p=>p.id===pwActivoId);
  if (!rec) return;

  let hayRechazo   = false;
  let haySinStock  = false;
  let todosResueltos = true;
  let todosNoEntregados = true; // true si todos son no_llevado

  rec.rubros.forEach(r => {
    const est = document.getElementById('pw-cr-estado-'+r.n)?.value;
    if (!est) { todosResueltos = false; return; }
    r.estado = est;
    if (est === 'aceptado') {
      r.cajasAceptadas  = r.cajasPedidas;
      r.cajasRechazadas = 0;
      todosNoEntregados = false;
    } else if (est === 'parcial') {
      r.cajasAceptadas  = parseFloat(document.getElementById('pw-cr-aceptadas-'+r.n)?.value)||0;
      r.cajasRechazadas = r.cajasPedidas - r.cajasAceptadas;
      hayRechazo = true;
      todosNoEntregados = false;
    } else if (est === 'rechazado') {
      r.cajasAceptadas  = 0;
      r.cajasRechazadas = r.cajasPedidas;
      hayRechazo = true;
      todosNoEntregados = false;
    } else if (est === 'no_llevado') {
      // Sin stock — no es rechazo, es falta de inventario
      r.cajasAceptadas  = 0;
      r.cajasRechazadas = 0;
      r.cajasSinStock   = r.cajasPedidas;
      haySinStock = true;
    }
  });

  if (!todosResueltos) { toast('⚠ Indica el resultado de cada rubro', true); return; }

  // Albarán: no requerido si todo fue sin stock (no hubo entrega física)
  if (!todosNoEntregados && !rec.albaranDoc) {
    toast('🚫 Debes cargar el albarán antes de cerrar el pedido', true);
    return;
  }
  if (hayRechazo && !rec.rechazoDoc) {
    toast('🚫 Hay rubros rechazados — debes cargar la hoja de rechazo', true);
    return;
  }

  // Estado del pedido — sin_stock es su propia categoría, no con_rechazo
  rec.estado   = todosNoEntregados ? 'sin_stock'
               : hayRechazo        ? 'con_rechazo'
               : haySinStock       ? 'con_rechazo'  // parcialmente sin stock + algo entregado
               : 'cerrado';
  rec.cierreTs = now();

  // Build summary
  const totalCajas      = rec.rubros.reduce((s,r)=>s+r.cajasPedidas,0);
  const totalAceptadas  = rec.rubros.reduce((s,r)=>s+(r.cajasAceptadas||0),0);
  const totalRechazadas = rec.rubros.reduce((s,r)=>s+(r.cajasRechazadas||0),0);
  const totalSinStock   = rec.rubros.reduce((s,r)=>s+(r.cajasSinStock||0),0);
  rec.resumen = { totalCajas, totalAceptadas, totalRechazadas, totalSinStock };

  // ── AUTO-CREATE isalida record so inventory is updated ────────────
  invEnsureDB();
  if (!DB.isalidas) DB.isalidas = [];
  // Only create if not already linked
  const yaVinculado = DB.isalidas.some(s => s.pedidoWalmartId === rec.id);
  if (!yaVinculado) {
    const lineas = rec.rubros
      .filter(r => (r.cajasAceptadas||0) > 0)
      .map(r => {
        const prod = DB.iproductos?.find(p =>
          p.nombre?.toUpperCase().includes(r.descripcion?.toUpperCase()?.split(' ')[0]) ||
          r.descripcion?.toUpperCase().includes(p.nombre?.toUpperCase())
        );
        const pres = (DB.ipresentaciones||[]).find(p =>
          p.productoId === prod?.id || p.nombre?.toUpperCase().includes(r.descripcion?.toUpperCase()?.split(' ')[0])
        );
        const lbsBulto = pres?.lbsBulto || 0;
        const totalLbs = r.cajasAceptadas * lbsBulto;
        return {
          productoId:        prod?.id || '',
          productoNombre:    r.descripcion || '',
          presentacionId:    pres?.id || '',
          presentacionNombre: pres?.nombre || r.descripcion || '',
          bultos:            r.cajasAceptadas,
          lbsBulto,
          totalLbs,
          precio:            r.precioUnit || 0,
          totalNeto:         (r.cajasAceptadas*(r.precioUnit||0))/1.12,
          totalIVA:          (r.cajasAceptadas*(r.precioUnit||0))/1.12*0.12,
          totalConIVA:       r.cajasAceptadas*(r.precioUnit||0),
          totalRetencion:    (r.cajasAceptadas*(r.precioUnit||0))/1.12*0.12*0.80,
          totalACobrar:      r.cajasAceptadas*(r.precioUnit||0) - (r.cajasAceptadas*(r.precioUnit||0))/1.12*0.12*0.80,
        };
      });
    if (lineas.length) {
      const totalLbs    = lineas.reduce((s,l)=>s+(l.totalLbs||0),0);
      const totalConIVA = lineas.reduce((s,l)=>s+(l.totalConIVA||0),0);
      DB.isalidas.unshift({
        id: uid(), ts: now(),
        fecha:          rec.fechaEntrega || today(),
        tipo:           'walmart',
        pedidoWalmartId: rec.id,
        clienteId:      'walmart-gt',
        clienteNombre:  'Walmart Guatemala',
        clienteNit:     '1926272',
        oc:             rec.oc || '',
        obs:            'Auto-generado desde cierre pedido Walmart',
        albaranFoto:    rec.albaranDoc || null,
        docEdiwin:      !!(rec.ediwinDoc),
        lineas, totalLbs,
        totalNeto:      lineas.reduce((s,l)=>s+(l.totalNeto||0),0),
        totalIVA:       lineas.reduce((s,l)=>s+(l.totalIVA||0),0),
        totalConIVA,
        totalRetencion: lineas.reduce((s,l)=>s+(l.totalRetencion||0),0),
        totalACobrar:   lineas.reduce((s,l)=>s+(l.totalACobrar||0),0),
        totalQ:         totalConIVA,
      });
    }
  }
  // ──────────────────────────────────────────────────────────────────

  save(); pwRenderLista(); pwRenderCalendario();
  try { renderInvStock(); } catch(e) {}
  try { renderSal(); } catch(e) {}
  const _msg = todosNoEntregados ? '📦 Pedido cerrado — sin stock, no se generó albarán'
              : hayRechazo ? '⚠️ Pedido cerrado con '+totalRechazadas+' cajas rechazadas'
              : '✅ Pedido cerrado — '+totalAceptadas+' cajas aceptadas';
  toast(_msg);
  pwTab('lista', document.getElementById('pw-tab-lista'));
  document.getElementById('pw-tab-form').style.display = 'none';
}

// ── Render lista ──────────────────────────────────────────────────
function pwRenderLista() {
  const cont = document.getElementById('pw-lista-container');
  if (!cont) return;

  const filMes    = document.getElementById('pw-fil-fecha')?.value || '';
  const filEstado = document.getElementById('pw-fil-estado')?.value || '';

  // Separar pedidos base de agregados
  const todos = (DB.pedidosWalmart || []).filter(p => {
    if (filMes    && !p.fechaEntrega?.startsWith(filMes)) return false;
    if (filEstado && p.estado !== filEstado) return false;
    return true;
  });

  // Pedidos base (no son agregados, o su base no existe en la lista filtrada)
  const bases     = todos.filter(p => !p.esAgregado || !todos.some(b => b.id === p.baseId));
  const agregados = todos.filter(p => p.esAgregado  &&  todos.some(b => b.id === p.baseId));

  bases.sort((a,b) => b.fechaEntrega.localeCompare(a.fechaEntrega));

  if (!bases.length && !agregados.length) {
    cont.innerHTML = '<div class="empty">Sin pedidos en este período.</div>';
    return;
  }

  const hoy = new Date(Date.now()-6*60*60*1000).toISOString().split('T')[0];

  const renderRubros = (p) => (p.rubros||[]).map((r,ri) => {
    const eA = r.estado==='aceptado', eP=r.estado==='parcial', eR=r.estado==='rechazado';
    const borde = eA?'var(--acc)':eP?'var(--orange)':eR?'var(--danger)':'var(--br)';
    const stateLabel = !r.estado||r.estado==='pendiente' ? '—'
      : eA ? '✅ Aceptado' : eP ? '⚠️ Parcial' : '❌ Rechazo';
    return `<div style="border-left:3px solid ${borde};padding:6px 10px;margin-bottom:5px;background:${eA?'rgba(0,122,82,.04)':eR?'rgba(214,48,48,.04)':'var(--s2)'};border-radius:0 6px 6px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
        <div>
          ${r.item?`<span style="font-size:.62rem;color:var(--muted2);margin-right:4px;">${r.item}</span>`:''}
          <span style="font-size:.78rem;font-weight:600;">${r.descripcion}</span>
        </div>
        <span style="font-size:.65rem;color:${eA?'var(--acc)':eR?'var(--danger)':'var(--muted2)'};">${stateLabel}</span>
      </div>
      <div style="display:flex;gap:14px;margin-top:4px;font-size:.72rem;">
        <span style="color:var(--muted2);">Pedido: <strong style="color:var(--tx);">${r.cajasPedidas}</strong></span>
        ${r.cajasAceptadas!=null?`<span style="color:var(--muted2);">Acept: <strong style="color:var(--acc);">${r.cajasAceptadas}</strong></span>`:''}
        ${r.cajasRechazadas>0?`<span style="color:var(--muted2);">Rech: <strong style="color:var(--danger);">${r.cajasRechazadas}</strong></span>`:''}
      </div>
    </div>`;
  }).join('');

  const renderCard = (p, isAgregado) => {
    const est        = PW_ESTADOS[p.estado] || PW_ESTADOS.pendiente;
    const totalCajas = p.rubros?.reduce((s,r)=>s+r.cajasPedidas,0) || 0;
    const totAcep    = p.rubros?.reduce((s,r)=>s+(r.cajasAceptadas||0),0) || 0;
    const totRech    = p.rubros?.reduce((s,r)=>s+(r.cajasRechazadas||0),0) || 0;
    const esHoy      = p.fechaEntrega === hoy;
    const esPasado   = p.fechaEntrega < hoy;
    const urgente    = !isAgregado && (p.estado==='pendiente'||p.estado==='en_curso') && (esHoy||esPasado);
    const rubrosHTML = renderRubros(p);

    if (isAgregado) {
      // Agregado: bloque compacto dentro de la tarjeta base
      return `<div style="border-top:1.5px dashed var(--br);margin-top:10px;padding-top:10px;">
        <div style="font-size:.65rem;font-weight:700;color:var(--orange-deep);letter-spacing:.05em;margin-bottom:6px;">
          📎 AGREGADO ${p.oc?'· OC: '+p.oc:''}
          <span style="background:${est.color}22;color:${est.color};border:1px solid ${est.color}44;font-size:.6rem;padding:1px 7px;border-radius:10px;margin-left:6px;">${est.icon} ${est.label}</span>
        </div>
        <div style="margin-bottom:8px;">${rubrosHTML}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          <button class="btn bsm bo" style="flex:1;min-width:80px;" onclick="pwEditarPedido('${p.id}')">✏️ Ver / Editar</button>
          ${(p.estado==='pendiente'||p.estado==='en_curso') ?
            `<button class="btn bsm" style="flex:1;min-width:80px;background:var(--orange);color:#fff;font-weight:700;"
              onclick="pwEditarPedido('${p.id}')">🔔 Cerrar día</button>` : ''}
        </div>
        ${p.albaranDoc||p.rechazoDoc ? `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
          ${p.albaranDoc?'<span class="chip ck" style="font-size:.65rem;">📄 Albarán ✓</span>':''}
          ${p.rechazoDoc?'<span class="chip cr" style="font-size:.65rem;">🚫 Rechazo ✓</span>':''}
        </div>` : ''}
      </div>`;
    }

    // Pedido base completo
    const hijos = agregados.filter(a => a.baseId === p.id);
    return `<div style="background:var(--s1);border:1.5px solid ${urgente?'var(--orange)':'var(--br)'};
      border-radius:10px;padding:14px;margin-bottom:12px;
      ${urgente?'box-shadow:0 0 0 3px rgba(242,104,34,.12);':''}">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--fh);font-size:.95rem;font-weight:800;color:var(--green-deep);line-height:1.2;">
            📅 ${pwFechaAmigable(p.fechaEntrega)}
            ${p.horaEntrega?`<span style="font-size:.78rem;font-weight:600;"> · ${p.horaEntrega}</span>`:''}
            ${esHoy?'<span style="background:var(--orange);color:#fff;font-size:.58rem;padding:2px 7px;border-radius:10px;margin-left:6px;font-family:var(--fn);vertical-align:middle;">HOY</span>':''}
          </div>
          <div style="font-size:.72rem;color:var(--muted2);margin-top:3px;font-family:var(--fn);">
            Rampa: <strong>${p.rampa||'—'}</strong> · <strong>${totalCajas}</strong> cajas
            ${p.oc?` · OC: <strong>${p.oc}</strong>`:''}
            ${p.nota?`<div style="color:var(--orange-deep);font-weight:600;margin-top:2px;">📝 ${p.nota}</div>`:''}
          </div>
        </div>
        <span style="background:${est.color}22;color:${est.color};border:1.5px solid ${est.color}44;
          font-size:.7rem;font-family:var(--fn);font-weight:700;padding:3px 9px;border-radius:20px;
          white-space:nowrap;flex-shrink:0;">
          ${est.icon} ${est.label}
        </span>
      </div>

      ${totAcep||totRech ? `<div style="display:flex;gap:10px;margin-bottom:8px;font-size:.72rem;font-family:var(--fn);">
        ${totAcep?`<span style="color:var(--acc);font-weight:700;">✅ ${totAcep} aceptadas</span>`:''}
        ${totRech?`<span style="color:var(--danger);font-weight:700;">❌ ${totRech} rechazadas</span>`:''}
      </div>` : ''}

      <!-- Rubros base -->
      <div style="margin-bottom:10px;">${rubrosHTML}</div>

      <!-- Agregados inline -->
      ${hijos.map(h => renderCard(h, true)).join('')}

      <!-- Botones -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;${hijos.length?'margin-top:12px;':''}">
        <button class="btn bsm bo" style="flex:1;min-width:100px;"
          onclick="pwEditarPedido('${p.id}')">✏️ Ver / Editar</button>
        ${(p.estado==='pendiente'||p.estado==='en_curso') ?
          `<button class="btn bsm" style="flex:1;min-width:100px;background:var(--orange);color:#fff;font-weight:700;"
            onclick="pwEditarPedido('${p.id}')">🔔 Cerrar día</button>` : ''}
        <button class="btn bsm bo" style="flex:1;min-width:100px;"
          onclick="pwNuevoPedido('${p.id}')">+ Agregado</button>
      </div>

      ${p.albaranDoc||p.rechazoDoc ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
        ${p.albaranDoc?'<span class="chip ck" style="font-size:.65rem;">📄 Albarán ✓</span>':''}
        ${p.rechazoDoc?'<span class="chip cr" style="font-size:.65rem;">🚫 Rechazo ✓</span>':''}
      </div>` : ''}
    </div>`;
  };

  cont.innerHTML = bases.map(p => renderCard(p, false)).join('');
}


function pwRenderCalendario() {
  const grid = document.getElementById('pw-cal-grid');
  const tit  = document.getElementById('pw-cal-titulo');
  if (!grid || !tit) return;

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dias  = ['L','M','X','J','V','S','D'];
  tit.textContent = meses[pwCalMonth] + ' ' + pwCalYear;

  const firstDay = new Date(pwCalYear, pwCalMonth, 1);
  const lastDay  = new Date(pwCalYear, pwCalMonth+1, 0);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const byDate = {};
  (DB.pedidosWalmart||[]).forEach(p => {
    if (!byDate[p.fechaEntrega]) byDate[p.fechaEntrega] = [];
    byDate[p.fechaEntrega].push(p);
  });

  const hoy = new Date(Date.now()-6*60*60*1000).toISOString().split('T')[0];

  let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">';

  // Header — single letter days, compact
  dias.forEach(d => {
    html += `<div style="background:var(--green-pale);padding:6px 2px;text-align:center;
      font-family:var(--fn);font-size:.68rem;font-weight:700;color:var(--green-deep);
      border-radius:4px 4px 0 0;">${d}</div>`;
  });

  // Empty offset cells
  for (let i=0; i<startDow; i++) {
    html += '<div style="background:var(--s2);min-height:56px;border-radius:4px;"></div>';
  }

  for (let d=1; d<=lastDay.getDate(); d++) {
    const ds = pwCalYear+'-'+String(pwCalMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const pedidos = byDate[ds] || [];
    const isHoy   = ds === hoy;
    const hasPed  = pedidos.length > 0;

    // Summarize: total cajas across all pedidos that day
    const totalCajas = pedidos.reduce((s,p)=>s+(p.rubros?.reduce((x,r)=>x+r.cajasPedidas,0)||0),0);
    // Dominant status color
    const dominantEst = pedidos.find(p=>p.estado==='con_rechazo')
      || pedidos.find(p=>p.estado==='sin_stock')
      || pedidos.find(p=>p.estado==='en_curso')
      || pedidos.find(p=>p.estado==='cerrado')
      || pedidos[0];
    const estColor = dominantEst ? (PW_ESTADOS[dominantEst.estado]||PW_ESTADOS.pendiente).color : 'transparent';

    html += `<div
      style="background:${isHoy?'rgba(0,65,45,.07)':'var(--s1)'};
             border:1.5px solid ${isHoy?'var(--green-light)':hasPed?estColor+'66':'var(--br)'};
             min-height:56px;border-radius:4px;padding:4px 3px;
             cursor:${hasPed?'pointer':'default'};
             transition:all .12s;"
      ${hasPed?`onclick="pwCalDiaClick('${ds}')" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'"`:''}>
      <div style="font-family:var(--fn);font-size:.7rem;font-weight:${isHoy?'800':'600'};
        color:${isHoy?'var(--green-deep)':'var(--txt2)'};">${d}</div>
      ${hasPed ? `
        <div style="background:${estColor};color:#fff;border-radius:3px;
          padding:1px 3px;font-size:.55rem;font-family:var(--fn);font-weight:700;
          margin-top:2px;line-height:1.3;text-align:center;">
          ${totalCajas}<br><span style="font-weight:400;font-size:.5rem;">cajas</span>
        </div>
        ${pedidos.length > 1 ? `<div style="font-size:.5rem;color:${estColor};text-align:center;font-weight:700;">+${pedidos.length-1}</div>` : ''}
      ` : ''}
    </div>`;
  }

  html += '</div>';

  // Legend below
  html += `<div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;font-size:.68rem;font-family:var(--fn);">
    ${Object.entries(PW_ESTADOS).map(([k,v])=>`
      <span style="display:flex;align-items:center;gap:4px;">
        <span style="width:10px;height:10px;background:${v.color};border-radius:2px;display:inline-block;flex-shrink:0;"></span>
        ${v.label}
      </span>`).join('')}
  </div>`;

  grid.innerHTML = html;
}

function pwCalDiaClick(dateStr) {
  // Filter lista to this date
  const fil = document.getElementById('pw-fil-fecha');
  if (fil) fil.value = dateStr.substring(0,7);
  pwTab('lista', document.getElementById('pw-tab-lista'));
  // Filter by day
  const pedidosDia = (DB.pedidosWalmart||[]).filter(p=>p.fechaEntrega===dateStr);
  if (pedidosDia.length === 1) {
    pwEditarPedido(pedidosDia[0].id);
  } else {
    pwRenderLista();
    // Highlight
    toast('📅 '+pedidosDia.length+' pedido(s) el '+pwFechaAmigable(dateStr));
  }
}

function pwCalPrev() { pwCalMonth--; if(pwCalMonth<0){pwCalMonth=11;pwCalYear--;} pwRenderCalendario(); }
function pwCalNext() { pwCalMonth++; if(pwCalMonth>11){pwCalMonth=0;pwCalYear++;} pwRenderCalendario(); }
function pwCalHoy()  { pwCalYear=new Date().getFullYear(); pwCalMonth=new Date().getMonth(); pwRenderCalendario(); }

// ── Notificaciones ────────────────────────────────────────────────
function pwCheckNotificaciones() {
  if (!DB.pedidosWalmart) return;
  const hoy  = new Date().toISOString().split('T')[0];
  const hora  = new Date().getHours();

  DB.pedidosWalmart.forEach(p => {
    if (p.fechaEntrega !== hoy) return;
    if (p.estado === 'cerrado' || p.estado === 'con_rechazo' || p.estado === 'sin_stock') return;

    const [hh] = (p.horaEntrega||'16:00').split(':').map(Number);

    // Alert 1h before delivery
    if (hora >= hh-1 && hora < hh && !p._notif1h) {
      p._notif1h = true;
      pwShowBanner(`⏰ Pedido hoy a las ${p.horaEntrega} — Rampa ${p.rampa||'?'} · ${p.rubros?.reduce((s,r)=>s+r.cajasPedidas,0)||0} cajas`, 'warn');
    }
    // End of day alert (after delivery time)
    if (hora >= hh+2 && !p._notifCierre) {
      p._notifCierre = true;
      pwShowBanner(`🔔 ¡Cierre del día! Registra el resultado del pedido del ${pwFechaAmigable(hoy)}`, 'alert');
    }
  });
}

function pwShowBanner(msg, tipo) {
  // Show a persistent banner at top of pedidos section
  let banner = document.getElementById('pw-notif-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'pw-notif-banner';
    const sec = document.getElementById('sec-pedidos-walmart');
    if (sec) sec.insertBefore(banner, sec.firstChild);
  }
  const bg = tipo==='warn' ? 'rgba(242,104,34,.12)' : 'rgba(214,48,48,.1)';
  const bc = tipo==='warn' ? 'rgba(242,104,34,.4)' : 'rgba(214,48,48,.4)';
  const tc = tipo==='warn' ? 'var(--orange-deep)' : 'var(--danger)';
  banner.innerHTML = `<div style="background:${bg};border:1.5px solid ${bc};border-radius:var(--r);padding:10px 16px;margin-bottom:14px;font-family:var(--fn);font-weight:700;font-size:.82rem;color:${tc};display:flex;justify-content:space-between;align-items:center;">
    ${msg}
    <button onclick="this.parentElement.parentElement.innerHTML=''" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:${tc};">✕</button>
  </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────
function pwFechaAmigable(dateStr) {
  if (!dateStr) return '—';
  const [y,m,d] = dateStr.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return d + ' ' + (meses[parseInt(m)-1]||m) + ' ' + y;
}

const DB_KEY      = 'ajua_bpm_v2';
// Snapshots locales eliminados — Firebase es el único backup
const BACKUP_DOC  = 'backup_auto';        // Documento separado en Firebase para backups

// 🔒 FLAG CRÍTICO: save() bloqueado hasta que Firebase confirme que cargó datos
// Evita que una DB vacía al inicio sobreescriba Firebase antes de que lleguen los datos
let _fbLoaded = false;  // true solo cuando initFirebase terminó de leer y mergeó datos

