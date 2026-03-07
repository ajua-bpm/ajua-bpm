// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/backup-auto/index.js
// Sistema de backup automático — 3 métodos
// 1. Firebase (ya existe en anti-loss)
// 2. localStorage snapshots cada 6 horas
// 3. Descarga automática JSON diaria
// Build 63 — Marzo 2026
// ══════════════════════════════════════════════════════════════════

const BACKUP_LS_KEY    = 'ajua_backups_v1';   // array de snapshots en localStorage
const BACKUP_MAX_SNAPS = 8;                    // máximo 8 snapshots (48 horas a c/6h)
const BACKUP_INTERVAL  = 6 * 60 * 60 * 1000;  // cada 6 horas
const BACKUP_DAILY_KEY = 'ajua_last_daily_backup';

// ── Snapshot a localStorage ────────────────────────────────────────
function backupSnapshotLS() {
  try {
    const raw = JSON.stringify(DB);
    const snap = {
      ts: new Date().toISOString(),
      gtTime: new Date(Date.now() - 6*3600000).toISOString().slice(0,16).replace('T',' '),
      size: raw.length,
      totalRecords: _dbTotalRecords(DB),
      data: JSON.parse(raw),
    };
    let snaps = [];
    try { snaps = JSON.parse(localStorage.getItem(BACKUP_LS_KEY) || '[]'); } catch(e) {}
    snaps.unshift(snap);
    if (snaps.length > BACKUP_MAX_SNAPS) snaps = snaps.slice(0, BACKUP_MAX_SNAPS);
    localStorage.setItem(BACKUP_LS_KEY, JSON.stringify(snaps));
    console.log(`💾 Snapshot guardado: ${snap.totalRecords} registros (${(snap.size/1024).toFixed(1)}KB)`);
    backupUpdateUI();
    return true;
  } catch(e) {
    console.warn('⚠ Backup localStorage falló:', e.message);
    return false;
  }
}

// ── Descarga JSON diaria ───────────────────────────────────────────
function backupDownloadJSON(manual = false) {
  try {
    const today = new Date(Date.now() - 6*3600000).toISOString().split('T')[0];
    if (!manual) {
      const lastDaily = localStorage.getItem(BACKUP_DAILY_KEY);
      if (lastDaily === today) return; // ya se descargó hoy
    }
    const data = JSON.stringify(DB, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ajua_backup_${today}.json`;
    a.click();
    localStorage.setItem(BACKUP_DAILY_KEY, today);
    if (manual) toast('✅ Backup descargado');
    console.log(`📥 Backup diario descargado: ${today}`);
  } catch(e) {
    console.warn('⚠ Descarga backup falló:', e.message);
  }
}

// ── Restaurar desde snapshot ───────────────────────────────────────
function backupRestoreSnap(idx) {
  try {
    const snaps = JSON.parse(localStorage.getItem(BACKUP_LS_KEY) || '[]');
    const snap  = snaps[idx];
    if (!snap) { toast('⚠ Snapshot no encontrado', true); return; }
    if (!confirm(`¿Restaurar backup del ${snap.gtTime}?\n${snap.totalRecords} registros\n\nEsto sobreescribirá los datos actuales.`)) return;
    Object.keys(snap.data).forEach(k => { DB[k] = snap.data[k]; });
    _fbLoaded = true;
    _lastKnownTotal = 0;
    save();
    try { renderAll(); } catch(e) {}
    toast(`✅ Restaurado backup del ${snap.gtTime}`);
    backupUpdateUI();
  } catch(e) {
    toast('⚠ Error al restaurar: ' + e.message, true);
  }
}

// ── Restaurar desde archivo JSON ───────────────────────────────────
function backupRestoreFile(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const total = _dbTotalRecords(data);
      if (!confirm(`¿Restaurar desde ${file.name}?\n${total} registros encontrados.\n\nEsto sobreescribirá los datos actuales.`)) return;
      Object.keys(data).forEach(k => { if (Array.isArray(data[k])) DB[k] = data[k]; });
      _fbLoaded = true;
      _lastKnownTotal = 0;
      save();
      try { renderAll(); } catch(e) {}
      toast(`✅ Restaurado desde ${file.name} — ${total} registros`);
      backupUpdateUI();
    } catch(err) {
      toast('⚠ Archivo inválido: ' + err.message, true);
    }
  };
  reader.readAsText(file);
}

// ── UI de backups ──────────────────────────────────────────────────
function backupUpdateUI() {
  const cont = document.getElementById('backup-snaps-list');
  if (!cont) return;
  let snaps = [];
  try { snaps = JSON.parse(localStorage.getItem(BACKUP_LS_KEY) || '[]'); } catch(e) {}
  if (!snaps.length) {
    cont.innerHTML = '<div style="font-size:.75rem;color:var(--muted2);">Sin snapshots aún — el primero se creará en 6 horas.</div>';
    return;
  }
  cont.innerHTML = snaps.map((s, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--s2);border-radius:6px;border:1px solid var(--br);margin-bottom:6px;">
      <div style="flex:1;">
        <div style="font-size:.78rem;font-weight:600;">${s.gtTime} GT</div>
        <div style="font-size:.65rem;color:var(--muted2);">${s.totalRecords} registros · ${(s.size/1024).toFixed(1)} KB</div>
      </div>
      <button class="btn bo bsm" onclick="backupRestoreSnap(${i})" style="font-size:.65rem;">⏪ Restaurar</button>
    </div>`).join('');

  // Update next backup time
  const nextEl = document.getElementById('backup-next-time');
  if (nextEl && snaps[0]) {
    const nextMs = new Date(snaps[0].ts).getTime() + BACKUP_INTERVAL;
    const diffMin = Math.round((nextMs - Date.now()) / 60000);
    nextEl.textContent = diffMin > 0 ? `Próximo en ${diffMin} min` : 'Próximamente';
  }
}

// ── Iniciar sistema de backup ──────────────────────────────────────
function backupInit() {
  // Primer snapshot inmediato si hay datos
  setTimeout(() => {
    if (_dbTotalRecords(DB) > 10) {
      backupSnapshotLS();
    }
  }, 30000); // 30 segundos después de cargar

  // Snapshot cada 6 horas
  setInterval(() => {
    backupSnapshotLS();
    backupDownloadJSON(false); // descarga automática diaria
  }, BACKUP_INTERVAL);

  console.log('🛡️ Sistema de backup automático iniciado');
}

// Iniciar cuando Firebase esté listo
const _backupInitInterval = setInterval(() => {
  if (_fbLoaded) {
    clearInterval(_backupInitInterval);
    backupInit();
  }
}, 5000);

console.log('✅ backup-auto.js cargado');
