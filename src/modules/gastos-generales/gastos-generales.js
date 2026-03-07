// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/gastos-generales/index.js
// Gastos Generales — Weekly Expense Control
// Build 53 — Marzo 2026
//
// Dependencias externas:
//   - DB, save()            → core/firebase.js
//   - uid(), now(), toast() → core/utils.js
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// GASTOS GENERALES — WEEKLY EXPENSE CONTROL
// ══════════════════════════════════════════════════════════════════

// ── Week helpers ─────────────────────────────────────────────────
function maqGetWeekDates(lunesStr) {
  const d = new Date(lunesStr + 'T12:00:00');
  const day = d.getDay(); // 0=sun
  // Adjust to Monday
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const lunes = d.toISOString().split('T')[0];
  const sabado = new Date(d);
  sabado.setDate(sabado.getDate() + 5);
  return { lunes, sabado: sabado.toISOString().split('T')[0] };
}

function maqOnWeekChange() {
  const val = document.getElementById('maq-semana-inicio')?.value;
  if (!val) return;
  const { lunes, sabado } = maqGetWeekDates(val);
  // Always snap to Monday, fin always Saturday — not user-editable
  document.getElementById('maq-semana-inicio').value = lunes;
  document.getElementById('maq-semana-fin').value = sabado;
  // Update display label
  const lbl = document.getElementById('maq-semana-label');
  if (lbl) {
    const fmt = d => { const [y,m,da] = d.split('-'); return `${da}/${m}/${y}`; };
    lbl.textContent = fmt(lunes) + ' al ' + fmt(sabado);
  }
  maqRefreshPersonal();
  maqRenderCuentas();
  maqUpdateStatus();
}

function maqUpdateStatus() {
  const el = document.getElementById('maq-semana-status');
  if (!el) return;
  const inicio = document.getElementById('maq-semana-inicio')?.value;
  if (!inicio) return;
  const existing = (DB.gastosSemanales||[]).find(s => s.semanaInicio === inicio);
  if (existing) {
    el.innerHTML = '<span style="color:var(--acc);">✓ Semana guardada — editando</span>';
  } else {
    el.innerHTML = '<span style="color:var(--orange);">● Semana nueva — sin guardar</span>';
  }
}

function maqNuevaSemana() {
  // Set to current Monday
  const today = new Date();
  const day = today.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  today.setDate(today.getDate() + diff);
  const lunes = today.toISOString().split('T')[0];
  document.getElementById('maq-semana-inicio').value = lunes;
  maqOnWeekChange(); // will set fin=sabado and update label
  // Reset cuentas
  maqCuentas = {};
  maqRenderCuentas();
  document.getElementById('maq-grand-total').textContent = 'Q 0.00';
  toast('Nueva semana lista');
}

// ── Personal rows from access control ────────────────────────────
function maqBuildPersonalRows() {
  const inicio = document.getElementById('maq-semana-inicio')?.value || '';
  let fin = document.getElementById('maq-semana-fin')?.value || '';
  // If hidden input not yet set, derive Saturday from Monday
  if (!fin && inicio) {
    const _fd = new Date(inicio + 'T12:00:00');
    _fd.setDate(_fd.getDate() + 5);
    fin = _fd.toISOString().split('T')[0];
  }
  const rows   = [];

  // Build days of this week (Mon-Sat)
  const weekDays = [];
  if (inicio) {
    const d = new Date(inicio + 'T12:00:00');
    for (let i = 0; i < 6; i++) {
      weekDays.push(new Date(d.getTime() + i * 86400000).toISOString().split('T')[0]);
    }
  }

  // Get employees who worked from DB.al (access control)
  const trabajadores = {};
  (DB.al || []).forEach(reg => {
    const fecha = reg.fecha || '';
    if (inicio && (fecha < inicio || fecha > fin)) return;
    (reg.empleados || []).forEach(e => {
      const nombre = typeof e === 'string' ? e : (e.nombre || '');
      if (!nombre) return;
      if (!trabajadores[nombre]) trabajadores[nombre] = new Set();
      trabajadores[nombre].add(fecha);
    });
  });

  // Also add all employees from DB.empleados as options (even if no access record)
  const todosEmp = (DB.empleados || []).map(e => e.nombre || e).filter(Boolean);

  // Merge: prioritize those with access records, then add rest
  const allNames = [...new Set([...Object.keys(trabajadores), ...todosEmp])];

  allNames.forEach(nombre => {
    const diasTrabajados = trabajadores[nombre] ? [...trabajadores[nombre]].sort() : [];
    // Load saved anticipo for this employee
    const empObj = (DB.empleados || []).find(e => (e.nombre||e) === nombre);
    const anticipo = empObj?.anticipo || 0;

    rows.push({
      label:         nombre,
      diasSemana:    weekDays,
      diasTrabajados: diasTrabajados,
      salarioSemanal: 0,
      anticipo:       anticipo,
      monto:          0,  // net = salario - anticipo
    });
  });

  return rows;
}

function maqRefreshPersonal() {
  const inicio = document.getElementById('maq-semana-inicio')?.value || '';
  if (!inicio) return;
  // Check if already loaded from saved week
  const saved = (DB.gastosSemanales||[]).find(s => s.semanaInicio === inicio);
  if (saved && saved.cuentas?.personal) {
    maqCuentas['personal'] = saved.cuentas.personal;
  } else {
    maqCuentas['personal'] = maqBuildPersonalRows();
  }
}

// ── Render ────────────────────────────────────────────────────────
function maqRenderCuentas() {
  const container = document.getElementById('maq-cuentas-container');
  if (!container) return;

  const inicio = document.getElementById('maq-semana-inicio')?.value || '';

  // Load saved week data if exists
  const saved = (DB.gastosSemanales||[]).find(s => s.semanaInicio === inicio);
  if (saved) {
    maqCuentas = JSON.parse(JSON.stringify(saved.cuentas || {}));
    if (document.getElementById('maq-lbs-proc'))
      document.getElementById('maq-lbs-proc').value = saved.lbsProc || 0;
  }

  // SIEMPRE reconstruir asistencia de personal desde DB.al (acceso y lavado = fuente de verdad)
  // Preserva salario/anticipo guardados, pero refreshea qué días trabajó cada uno
  {
    const _fresh = maqBuildPersonalRows();
    const _savedP = maqCuentas['personal'] || [];
    maqCuentas['personal'] = _fresh.map(fr => {
      const sr = _savedP.find(r => r.label === fr.label);
      return Object.assign({}, fr, {
        salarioSemanal: sr ? (sr.salarioSemanal || 0) : 0,
        anticipo:       sr ? (sr.anticipo       || 0) : (fr.anticipo || 0),
      });
    });
  }

  let html = '';
  MAQ_CUENTAS.forEach(grp => {
    if (!maqCuentas[grp.id] || maqCuentas[grp.id].length === 0) {
      if (grp.tipo === 'personal') {
        maqCuentas['personal'] = maqBuildPersonalRows();
      } else {
        maqCuentas[grp.id] = grp.items.map(item => ({
          label: item, monto: 0, qxlb: 0
        }));
      }
    }

    const rows = maqCuentas[grp.id] || [];

    html += `<div class="card" style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:4px 0;"
           onclick="maqToggleGrp('${grp.id}')">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:700;font-size:.9rem;color:${grp.color};">${grp.label}</span>
          ${grp.mensual ? `<span style="font-size:.6rem;background:#ff8c00;color:#fff;padding:2px 7px;border-radius:10px;font-weight:700;">📅 SOLO FIN DE MES</span>` : ''}
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <span id="maq-grp-subtotal-${grp.id}" style="font-weight:700;font-size:.85rem;color:var(--green-deep);">Q 0.00</span>
          <span id="maq-grp-toggle-${grp.id}" style="color:var(--muted);font-size:.8rem;">▼</span>
        </div>
      </div>
      <div id="maq-grp-${grp.id}">`;

    if (grp.tipo === 'personal') {
      html += maqRenderPersonalHTML(rows);
    } else if (grp.tipo === 'qxlb') {
      rows.forEach((row, ri) => {
        html += `<div class="fgrid g3" style="margin-bottom:6px;align-items:center;">
          <div class="fg"><input value="${row.label||''}" onchange="maqSetLabel('${grp.id}',${ri},this.value)" style="font-size:.78rem;"></div>
          <div class="fg"><label style="font-size:.68rem;">Q/lb</label>
            <input type="number" value="${row.qxlb||0}" onchange="maqSetQxlb('${grp.id}',${ri},this.value);maqCalc()" style="font-size:.78rem;"></div>
          <div class="fg"><label style="font-size:.68rem;">Total</label>
            <input readonly id="maq-qxlb-tot-${grp.id}-${ri}" value="Q 0.00" style="font-size:.78rem;background:var(--s2);"></div>
        </div>`;
      });
    } else {
      rows.forEach((row, ri) => {
        html += `<div class="fgrid g2" style="margin-bottom:6px;align-items:center;">
          <div class="fg"><input value="${row.label||''}" onchange="maqSetLabel('${grp.id}',${ri},this.value)" style="font-size:.78rem;"></div>
          <div class="fg"><label style="font-size:.68rem;">Monto (Q)</label>
            <input type="number" value="${row.monto||0}" onchange="maqSetMonto('${grp.id}',${ri},this.value);maqCalc()" style="font-size:.78rem;"></div>
        </div>`;
      });
      html += `<button class="btn bo bsm" onclick="maqAddRow('${grp.id}')" style="margin-top:4px;">+ Agregar</button>`;
    }

    html += `</div></div>`;
  });

  container.innerHTML = html;
  maqCalc();
}

// ── Personal HTML ─────────────────────────────────────────────────
function maqRenderPersonalHTML(rows) {
  if (!rows || rows.length === 0) {
    return '<div style="font-size:.78rem;color:var(--muted);padding:8px;">No hay empleados. Agrega empleados en el módulo de Empleados.</div>';
  }

  let h = `<div style="overflow-x:auto;margin-bottom:8px;">
    <table style="width:100%;font-size:.75rem;border-collapse:collapse;">
      <thead>
        <tr style="background:var(--s2);">
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--br);">Empleado</th>
          <th style="padding:6px 4px;border-bottom:1px solid var(--br);">Lun</th>
          <th style="padding:6px 4px;border-bottom:1px solid var(--br);">Mar</th>
          <th style="padding:6px 4px;border-bottom:1px solid var(--br);">Mié</th>
          <th style="padding:6px 4px;border-bottom:1px solid var(--br);">Jue</th>
          <th style="padding:6px 4px;border-bottom:1px solid var(--br);">Vie</th>
          <th style="padding:6px 4px;border-bottom:1px solid var(--br);">Sáb</th>
          <th style="padding:6px 6px;border-bottom:1px solid var(--br);">Días</th>
          <th style="padding:6px 6px;border-bottom:1px solid var(--br);">Salario sem.</th>
          <th style="padding:6px 6px;border-bottom:1px solid var(--br);">Anticipo</th>
          <th style="padding:6px 6px;border-bottom:1px solid var(--br);color:var(--green-deep);">Neto a pagar</th>
        </tr>
      </thead>
      <tbody>`;

  rows.forEach((row, ri) => {
    const dias = row.diasSemana || [];
    const trabajados = new Set(row.diasTrabajados || []);
    const numDias = trabajados.size;
    const salario = row.salarioSemanal || 0;
    const anticipo = row.anticipo || 0;
    const neto = Math.max(0, salario - anticipo);

    h += `<tr style="border-bottom:1px solid var(--br);">
      <td style="padding:6px 8px;font-weight:600;">${row.label}</td>`;

    dias.forEach(fecha => {
      const worked = trabajados.has(fecha);
      h += `<td style="text-align:center;padding:4px;">
        <input type="checkbox" ${worked?'checked':''} 
          onchange="maqPersToggleDia(${ri},'${fecha}',this.checked)"
          title="${fecha}">
      </td>`;
    });

    // Fill empty if less than 6 days defined
    for (let i = dias.length; i < 6; i++) {
      h += `<td></td>`;
    }

    h += `
      <td style="text-align:center;padding:4px;font-weight:700;color:var(--info);">${numDias}</td>
      <td style="padding:4px;">
        <input type="number" value="${salario}" min="0" step="50"
          style="width:90px;font-size:.75rem;"
          oninput="maqPersSetSalario(${ri},this.value)">
      </td>
      <td style="padding:4px;">
        <input type="number" value="${anticipo}" min="0" step="50"
          style="width:80px;font-size:.75rem;"
          oninput="maqPersSetAnticipo(${ri},this.value)">
      </td>
      <td style="padding:4px;font-weight:700;color:var(--green-deep);">Q ${neto.toFixed(2)}</td>
    </tr>`;
  });

  h += `</tbody></table></div>
    <button class="btn bo bsm" onclick="maqAddPersonalRow()">+ Agregar empleado manual</button>`;

  return h;
}

// ── Personal event handlers ───────────────────────────────────────
function maqPersToggleDia(ri, fecha, checked) {
  const row = maqCuentas['personal']?.[ri];
  if (!row) return;
  const set = new Set(row.diasTrabajados || []);
  checked ? set.add(fecha) : set.delete(fecha);
  row.diasTrabajados = [...set];
  maqCalc();
  // Update dias count cell
  maqRenderCuentas();
}

function maqPersSetSalario(ri, val) {
  const row = maqCuentas['personal']?.[ri];
  if (!row) return;
  row.salarioSemanal = parseFloat(val) || 0;
  maqCalc();
}

function maqPersSetAnticipo(ri, val) {
  const row = maqCuentas['personal']?.[ri];
  if (!row) return;
  row.anticipo = parseFloat(val) || 0;
  // Also save anticipo to employee record
  const emp = (DB.empleados||[]).find(e => (e.nombre||e) === row.label);
  if (emp && typeof emp === 'object') {
    emp.anticipo = row.anticipo;
    save();
  }
  maqCalc();
}

function maqAddPersonalRow() {
  if (!maqCuentas['personal']) maqCuentas['personal'] = [];
  maqCuentas['personal'].push({
    label: 'Nuevo empleado', diasSemana: [], diasTrabajados: [],
    salarioSemanal: 0, anticipo: 0, monto: 0
  });
  maqRenderCuentas();
}

// ── Calc ──────────────────────────────────────────────────────────
function maqCalc() {
  const lbsProc = parseFloat(document.getElementById('maq-lbs-proc')?.value) || 0;
  let grandTotal = 0;
  const resumen = [];

  MAQ_CUENTAS.forEach(grp => {
    const rows = maqCuentas[grp.id] || [];
    let grpTotal = 0;

    if (grp.tipo === 'personal') {
      rows.forEach(r => {
        const neto = Math.max(0, (r.salarioSemanal||0) - (r.anticipo||0));
        r.monto = neto;
        grpTotal += neto;
      });
    } else if (grp.tipo === 'qxlb') {
      rows.forEach((r, ri) => {
        const amt = (r.qxlb||0) * lbsProc;
        grpTotal += amt;
        const el = document.getElementById(`maq-qxlb-tot-${grp.id}-${ri}`);
        if (el) el.value = 'Q ' + amt.toFixed(2);
      });
    } else {
      rows.forEach(r => grpTotal += (r.monto||0));
    }

    const subEl = document.getElementById(`maq-grp-subtotal-${grp.id}`);
    if (subEl) subEl.textContent = 'Q ' + grpTotal.toFixed(2);
    grandTotal += grpTotal;
    if (grpTotal > 0) resumen.push({ label: grp.label, total: grpTotal });
  });

  const gtEl = document.getElementById('maq-grand-total');
  if (gtEl) gtEl.textContent = 'Q ' + grandTotal.toFixed(2);

  // Render resumen
  const resEl = document.getElementById('maq-resumen-semanal');
  if (resEl) {
    resEl.innerHTML = resumen.map(r =>
      `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--br);font-size:.82rem;">
        <span>${r.label}</span>
        <span style="font-weight:700;">Q ${r.total.toFixed(2)}</span>
      </div>`
    ).join('');
  }
}

// ── Save / Load week ──────────────────────────────────────────────
function maqIsFinDeMes(fechaInicio) {
  // Returns true if this week includes the last day of the month
  if (!fechaInicio) return false;
  const d = new Date(fechaInicio + 'T12:00:00');
  const mes = d.getMonth();
  for (let i = 0; i < 7; i++) {
    const dd = new Date(d); dd.setDate(d.getDate() + i);
    if (dd.getMonth() !== mes) return true; // week crosses into next month
  }
  // Also check if last day of month falls in this week
  const lastDay = new Date(d.getFullYear(), mes+1, 0);
  const startOfWeek = new Date(d);
  const endOfWeek = new Date(d); endOfWeek.setDate(d.getDate() + 6);
  return lastDay >= startOfWeek && lastDay <= endOfWeek;
}

function maqGuardarSemana() {
  const inicio = document.getElementById('maq-semana-inicio')?.value;
  const fin    = document.getElementById('maq-semana-fin')?.value;
  if (!inicio) { toast('Selecciona una semana primero', true); return; }

  // Warn if monthly rubros are empty and it's end of month
  if (maqIsFinDeMes(inicio)) {
    const mensualIds = MAQ_CUENTAS.filter(g => g.mensual).map(g => g.id);
    const emptyMensual = mensualIds.filter(id => {
      const rows = maqCuentas[id] || [];
      return rows.length === 0 || rows.every(r => !r.monto || parseFloat(r.monto) === 0);
    }).map(id => MAQ_CUENTAS.find(g => g.id === id)?.label || id);
    if (emptyMensual.length > 0) {
      if (!confirm('⚠️ Es fin de mes y estos rubros están vacíos:\n\n' + emptyMensual.join('\n') + '\n\n¿Guardar de todas formas?')) return;
    }
  }

  const lbsProc = parseFloat(document.getElementById('maq-lbs-proc')?.value) || 0;

  // Compute totals
  const totales = {};
  let grandTotal = 0;
  MAQ_CUENTAS.forEach(grp => {
    const rows = maqCuentas[grp.id] || [];
    let t = 0;
    if (grp.tipo === 'personal') {
      rows.forEach(r => t += Math.max(0,(r.salarioSemanal||0)-(r.anticipo||0)));
    } else if (grp.tipo === 'qxlb') {
      rows.forEach(r => t += (r.qxlb||0) * lbsProc);
    } else {
      rows.forEach(r => t += (r.monto||0));
    }
    totales[grp.id] = t;
    grandTotal += t;
  });

  const record = {
    id:           uid(),
    semanaInicio: inicio,
    semanaFin:    fin,
    lbsProc,
    cuentas:      JSON.parse(JSON.stringify(maqCuentas)),
    totales,
    grandTotal,
    ts:           new Date().toISOString(),
  };

  if (!DB.gastosSemanales) DB.gastosSemanales = [];
  const existingIdx = DB.gastosSemanales.findIndex(s => s.semanaInicio === inicio);
  if (existingIdx >= 0) {
    record.id = DB.gastosSemanales[existingIdx].id;
    DB.gastosSemanales[existingIdx] = record;
  } else {
    DB.gastosSemanales.unshift(record);
  }

  save();
  maqUpdateStatus();
  toast('✅ Semana guardada');
}

function maqVerHistorial() {
  const panel = document.getElementById('maq-historial-panel');
  const lista = document.getElementById('maq-historial-lista');
  if (!panel || !lista) return;

  const visible = panel.style.display !== 'none';
  if (visible) { panel.style.display = 'none'; return; }

  const semanas = (DB.gastosSemanales || []).sort((a,b) => b.semanaInicio.localeCompare(a.semanaInicio));
  if (!semanas.length) {
    lista.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:8px;">No hay semanas guardadas aún.</div>';
  } else {
    lista.innerHTML = semanas.map(s => {
      const d1 = s.semanaInicio.split('-').reverse().join('/');
      const d2 = s.semanaFin?.split('-').reverse().join('/') || '';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid var(--br);">
        <div>
          <span style="font-weight:700;font-size:.85rem;">${d1} — ${d2}</span>
          <span style="font-size:.75rem;color:var(--muted);margin-left:8px;">Q ${(s.grandTotal||0).toFixed(2)} total</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn bsm bo" onclick="maqCargarSemana('${s.semanaInicio}')">📂 Cargar</button>
          <button class="btn bsm" style="background:#d63030;color:#fff;" onclick="maqEliminarSemana('${s.semanaInicio}')">🗑</button>
        </div>
      </div>`;
    }).join('');
  }
  panel.style.display = '';
}

function maqCargarSemana(inicio) {
  const saved = (DB.gastosSemanales||[]).find(s => s.semanaInicio === inicio);
  if (!saved) return;
  document.getElementById('maq-semana-inicio').value = saved.semanaInicio;
  document.getElementById('maq-semana-fin').value    = saved.semanaFin || '';
  // Update display label
  const _lbl = document.getElementById('maq-semana-label');
  if (_lbl) {
    const fmt = d => { const [y,m,da] = d.split('-'); return `${da}/${m}/${y}`; };
    _lbl.textContent = fmt(saved.semanaInicio) + ' al ' + fmt(saved.semanaFin || saved.semanaInicio);
  }
  if (document.getElementById('maq-lbs-proc'))
    document.getElementById('maq-lbs-proc').value = saved.lbsProc || 0;
  maqCuentas = JSON.parse(JSON.stringify(saved.cuentas || {}));
  maqRenderCuentas();
  maqUpdateStatus();
  document.getElementById('maq-historial-panel').style.display = 'none';
  toast('Semana cargada');
}

function maqEliminarSemana(inicio) {
  if (!confirm('¿Eliminar esta semana?')) return;
  DB.gastosSemanales = (DB.gastosSemanales||[]).filter(s => s.semanaInicio !== inicio);
  save();
  maqVerHistorial();
  toast('Semana eliminada');
}

// ── maqInit (called on section load) ─────────────────────────────
function maqInit() {
  // Set current week by default
  const today = new Date();
  const day = today.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  today.setDate(today.getDate() + diff);
  const lunes = today.toISOString().split('T')[0];

  const inEl = document.getElementById('maq-semana-inicio');
  // Always set to current week on first load
  inEl.value = lunes;
  maqOnWeekChange(); // sets fin=sabado and updates label

  maqRefreshPersonal();
  maqRenderCuentas();
  maqUpdateStatus();
}

// ── Excel export ──────────────────────────────────────────────────
function maqExportExcel() {
  const inicio = document.getElementById('maq-semana-inicio')?.value || 'semana';
  const fin    = document.getElementById('maq-semana-fin')?.value    || '';
  const lbsProc = parseFloat(document.getElementById('maq-lbs-proc')?.value) || 0;

  let csv = `GASTOS GENERALES AJÚA\n`;
  csv += `Semana:,${inicio} al ${fin}\n`;
  csv += `Lbs procesadas:,${lbsProc}\n\n`;
  csv += `Categoría,Rubro,Días trabajados,Salario sem.,Anticipo,Neto/Monto (Q)\n`;

  MAQ_CUENTAS.forEach(grp => {
    const rows = maqCuentas[grp.id] || [];
    rows.forEach(r => {
      if (grp.tipo === 'personal') {
        const dias = (r.diasTrabajados||[]).length;
        const neto = Math.max(0,(r.salarioSemanal||0)-(r.anticipo||0));
        csv += `"${grp.label}","${r.label}",${dias},${r.salarioSemanal||0},${r.anticipo||0},${neto}\n`;
      } else if (grp.tipo === 'qxlb') {
        const amt = (r.qxlb||0) * lbsProc;
        csv += `"${grp.label}","${r.label}",,,,${amt.toFixed(2)}\n`;
      } else {
        if (r.monto) csv += `"${grp.label}","${r.label}",,,,${r.monto}\n`;
      }
    });
  });

  // Grand total
  let gt = 0;
  MAQ_CUENTAS.forEach(grp => {
    const rows = maqCuentas[grp.id]||[];
    if (grp.tipo==='personal') rows.forEach(r=>gt+=Math.max(0,(r.salarioSemanal||0)-(r.anticipo||0)));
    else if (grp.tipo==='qxlb') rows.forEach(r=>gt+=(r.qxlb||0)*lbsProc);
    else rows.forEach(r=>gt+=(r.monto||0));
  });
  csv += `\nTOTAL SEMANA,,,,, ${gt.toFixed(2)}\n`;

  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `GastosGenerales_${inicio}_al_${fin}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ Excel descargado');
}



function saveMaquila() {
  invEnsureDB();
  if (!DB.maquila) DB.maquila = [];
  const mes = document.getElementById('maq-mes')?.value || '';
  if (!mes) { toast('⚠ Selecciona el mes', true); return; }
  const calc = maqCalc();
  if (!calc || calc.grandTotal === 0) { toast('⚠ Ingresa al menos un costo', true); return; }

  const existing = DB.maquila.findIndex(m =>
    m.mes === mes && (!v('maq-prod') || m.productoId === v('maq-prod'))
  );
  const rec = {
    id:        existing >= 0 ? DB.maquila[existing].id : uid(),
    ts:        now(), mes,
    productoId: v('maq-prod') || null,
    ref:        v('maq-ref')  || '',
    obs:        v('maq-obs')  || '',
    lbsImp:    parseFloat(v('maq-lbs-imp'))  || 0,
    lbsVend:   parseFloat(v('maq-lbs-vend')) || 0,
    lbsProc:   calc.lbsProc,
    cuentas:   JSON.parse(JSON.stringify(maqCuentas)),
    groupTotals: calc.groupTotals,
    totalMaq:  calc.grandTotal,
    cxlb:      calc.cxlb,
    materiales:[], procesos:[], totalMat:calc.grandTotal, totalProc:0,
  };

  if (existing >= 0) DB.maquila[existing] = rec;
  else DB.maquila.unshift(rec);

  maqCuentas = {};
  maqInit();
  ['maq-mes','maq-ref','maq-obs'].forEach(id => set(id,''));
  save(); maqAutoLbs();
  toast('✓ Maquila guardada — Costo/lb: Q ' + calc.cxlb.toFixed(4));
}

function limpiarBaseOperativa() {
  if (!confirm(
    '⚠ LIMPIAR DATOS OPERATIVOS\n\n' +
    'Se eliminarán TODOS los registros de:\n' +
    '• BPM (limpiezas, despachos, fumigación, roedores, etc.)\n' +
    '• Ingresos a bodega\n' +
    '• Ventas (Walmart, Locales GT, Exportación)\n' +
    '• Maquila\n' +
    '• Trazabilidad\n\n' +
    'Se CONSERVAN: usuarios, empleados, productos, presentaciones, clientes, cotizaciones.\n\n' +
    '¿Confirmas? Esta acción NO se puede deshacer.'
  )) return;

  // 🛡️ Backup automático ANTES de limpiar
    backupToFirebase().catch(()=>{});

  maqCuentas = {};
  DB.tl   = []; DB.dt  = []; DB.bl  = []; DB.fum = [];
  DB.rod  = []; DB.cap = []; DB.ee  = []; DB.al  = [];
  DB.vis  = []; DB.vp  = []; DB.bas = []; DB.lp  = [];
  DB.ientradas  = [];
  DB.isalidas   = [];
  DB.vgtVentas  = [];
  DB.vintVentas = [];
  DB.maquila    = [];

  save();
  renderAll();
  toast('✓ Operativos limpiados — snapshot guardado como respaldo');
}

function limpiarTodo() {
  // 🛡️ Backup automático ANTES de limpiar TODO
    backupToFirebase().catch(()=>{});

  if (!confirm(
    '💣 LIMPIAR TODO\n\n' +
    'Se eliminarán ABSOLUTAMENTE TODOS los datos incluyendo:\n' +
    '• Empleados, productos, presentaciones\n' +
    '• Clientes, conductores\n' +
    '• Todos los registros operativos\n' +
    '• Todos los usuarios (se recreará solo "Admin")\n\n' +
    'La aplicación quedará como recién instalada.\n\n' +
    '¿Confirmas? ESTA ACCIÓN NO SE PUEDE DESHACER.'
  )) return;

  if (!confirm('Última confirmación — ¿estás SEGURO de borrar TODO?')) return;

  localStorage.removeItem(DB_KEY);
  DB = {
    tl:[],dt:[],bl:[],fum:[],rod:[],cap:[],ee:[],al:[],vis:[],vp:[],bas:[],lp:[],
    conductores:[], clientes:[], empleados:[], calibraciones:[],
    iproductos:[], ipresentaciones:[], iclientes:[], ientradas:[], isalidas:[],
    cotizaciones:[], vgtVentas:[], vintVentas:[], maquila:[], usuarios:[],
  };
  save();
  authEnsureDB();
  renderAll();
  toast('✓ Base completamente limpiada — inicia sesión con tus credenciales');
}

