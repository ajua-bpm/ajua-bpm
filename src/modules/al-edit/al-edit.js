// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/al-edit/index.js
// Editar turnos de Acceso y Lavado de Manos
// Build 63 — Marzo 2026
// ══════════════════════════════════════════════════════════════════

// Editar un turno existente — carga los datos en el formulario
function alEdit(id) {
  const rec = (DB.al || []).find(r => r.id === id);
  if (!rec) return;

  // Setear campos del formulario
  const setV = (elId, val) => { const e = document.getElementById(elId); if (e) e.value = val || ''; };
  setV('al-fecha',    rec.fecha);
  setV('al-turno',   rec.turno || 'AM');
  setV('al-hi-turno',rec.hi   || '07:00');
  setV('al-hs-turno',rec.hs   || '17:00');

  // Marcar empleados del turno
  alSelAll(false);
  (rec.empleados || []).forEach(e => {
    // Buscar por empleadoId o nombre
    const chk = document.getElementById(`al-chk-${e.empleadoId}`) ||
      [...document.querySelectorAll('#al-emp-tbody input[id^=al-chk-]')]
        .find(c => {
          const row = c.closest('tr');
          return row && row.querySelector('td:nth-child(2)')?.textContent?.trim() === e.nombre;
        });
    if (chk) chk.checked = true;
  });
  alUpdateCount();

  // Guardar id en campo oculto
  let hiddenId = document.getElementById('al-edit-id');
  if (!hiddenId) {
    hiddenId = document.createElement('input');
    hiddenId.type = 'hidden';
    hiddenId.id = 'al-edit-id';
    document.getElementById('al-fecha')?.closest('form, .card')?.appendChild(hiddenId);
  }
  hiddenId.value = id;

  // Mostrar botón cancelar y cambiar título
  const title = document.getElementById('al-form-title');
  if (title) title.textContent = `✏️ Editando turno: ${rec.fecha} ${rec.turno || 'AM'}`;

  let cancelBtn = document.getElementById('al-cancel-btn');
  if (!cancelBtn) {
    cancelBtn = document.createElement('button');
    cancelBtn.id = 'al-cancel-btn';
    cancelBtn.className = 'btn bo bsm';
    cancelBtn.style.cssText = 'font-size:.75rem;margin-left:8px;';
    cancelBtn.textContent = '✕ Cancelar edición';
    cancelBtn.onclick = alCancelEdit;
    document.getElementById('al-save-btn')?.insertAdjacentElement('afterend', cancelBtn);
  }
  cancelBtn.style.display = '';

  // Scroll al formulario
  document.getElementById('al-fecha')?.closest('.card')?.scrollIntoView({ behavior: 'smooth' });
  toast('✏️ Editando turno — modificá y guardá');
}

function alCancelEdit() {
  const hiddenId = document.getElementById('al-edit-id');
  if (hiddenId) hiddenId.value = '';
  const title = document.getElementById('al-form-title');
  if (title) title.textContent = '➕ Registrar Turno';
  const cancelBtn = document.getElementById('al-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  alSelAll(false);
}

// Patch saveAL to support editing
const _alSaveOriginal = typeof saveAL === 'function' ? saveAL : null;
function saveAL() {
  const editId = document.getElementById('al-edit-id')?.value;

  const fecha = document.getElementById('al-fecha')?.value;
  if (!fecha) { toast('⚠ Seleccione la fecha del turno', true); return; }

  const activos = (DB.empleados || []).filter(e => !e.estado || e.estado === 'activo')
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const turno = document.getElementById('al-turno')?.value || 'AM';
  const hi    = document.getElementById('al-hi-turno')?.value || '07:00';
  const hs    = document.getElementById('al-hs-turno')?.value || '17:00';

  const lavActivos = AL_LAVADOS.map((h, i) => ({
    hora: h,
    activo: document.getElementById(`al-fix-${i+1}`)?.checked || false,
  }));

  const empleados = [];
  activos.forEach(e => {
    const sel = document.getElementById(`al-chk-${e.id}`)?.checked;
    if (!sel) return;
    const lavados = AL_LAVADOS.map((h, i) => ({
      hora: h,
      activo: lavActivos[i].activo,
      cumplido: lavActivos[i].activo,
    }));
    empleados.push({ empleadoId: e.id, nombre: e.nombre, area: e.area || '', lavados });
  });

  if (!empleados.length) { toast('⚠ Seleccione al menos un empleado', true); return; }

  const totalCompletos = empleados.length;

  if (editId) {
    // Editar existente
    const idx = DB.al.findIndex(r => r.id === editId);
    if (idx >= 0) {
      DB.al[idx] = { ...DB.al[idx], fecha, turno, hi, hs, empleados, totalEmp: empleados.length, totalCompletos, lavActivos };
      toast(`✓ Turno actualizado — ${empleados.length} empleados`);
    }
    alCancelEdit();
  } else {
    // Nuevo registro
    DB.al.unshift({ id: uid(), ts: now(), fecha, turno, hi, hs, empleados, totalEmp: empleados.length, totalCompletos, lavActivos });
    toast(`✓ Turno ${turno} guardado — ${empleados.length} empleados`);
  }

  alSelAll(false);
  save(); renderAL();
}

// Patch renderAL to include edit button
function renderAL() {
  const tb = document.getElementById('al-tbody'); if (!tb) return;
  if (!DB.al.length) {
    tb.innerHTML = `<tr><td colspan="9"><div class="empty">Sin turnos registrados</div></td></tr>`;
    return;
  }
  tb.innerHTML = DB.al.slice().sort((a,b)=>(b.fecha||b.ts||'').localeCompare(a.fecha||a.ts||'')).map(r => {
    if (r.empleados) {
      const pct = r.totalEmp > 0 ? Math.round(r.totalCompletos / r.totalEmp * 100) : 0;
      return `<tr>
        <td>${r.fecha}</td>
        <td><span class="chip cb">${r.turno || 'AM'}</span></td>
        <td>${r.hi || '—'}</td><td>${r.hs || '—'}</td>
        <td><span class="chip ck">${r.totalEmp} personas</span></td>
        <td><span class="chip ${pct===100?'ck':pct>=75?'cw':'cr'}">${r.totalCompletos}/${r.totalEmp} · ${pct}%</span></td>
        <td><button class="btn bo bsm" style="font-size:.65rem;border-color:var(--acc);color:var(--acc);" onclick="alExportExcel('${r.id}')">📊 Excel</button></td>
        <td><button class="btn bo bsm" style="font-size:.65rem;" onclick="alEdit('${r.id}')">✏️</button></td>
        <td><button class="btn bo bsm" onclick="del('al','${r.id}')">✕</button></td>
      </tr>`;
    } else {
      return `<tr>
        <td>${r.fecha}</td><td><span class="chip cb">AM</span></td>
        <td>${r.hi||'—'}</td><td>${r.hs||'—'}</td>
        <td><span class="chip ck">1 persona</span></td>
        <td>—</td><td>—</td>
        <td><button class="btn bo bsm" style="font-size:.65rem;" onclick="alEdit('${r.id}')">✏️</button></td>
        <td><button class="btn bo bsm" onclick="del('al','${r.id}')">✕</button></td>
      </tr>`;
    }
  }).join('');
}

console.log('✅ al-edit.js cargado — edición de turnos activada');
