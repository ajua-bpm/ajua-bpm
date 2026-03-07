// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/nomina/index.js
// Nómina — Cálculo automático desde registros de acceso
// Build 55 — Marzo 2026
//
// Dependencias externas:
//   - DB, save()            → core/firebase.js
//   - uid(), now(), toast() → core/utils.js
// ══════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// 👷 NÓMINA DESDE ACCESO — calcular días trabajados automáticamente
// ════════════════════════════════════════════════════════════════════

function nomCalcDias(empId, desde, hasta) {
  // Cuenta días únicos en que el empleado aparece en DB.al dentro del rango
  const dias = new Set();
  (DB.al||[]).forEach(turno => {
    if (!turno.fecha || turno.fecha < desde || turno.fecha > hasta) return;
    const participantes = turno.empleados || [];
    const estaPresente = participantes.some(e => e.id === empId || e.empleadoId === empId);
    if (estaPresente) dias.add(turno.fecha);
  });
  return dias.size;
}

function nomGetResumen(desde, hasta) {
  // Retorna array con días trabajados por empleado en el rango
  const activos = (DB.empleados||[]).filter(e => e.estado === 'activo');
  return activos.map(emp => {
    const dias = nomCalcDias(emp.id, desde, hasta);
    return {
      id: emp.id, nombre: emp.nombre, cargo: emp.cargo || '—',
      roles: (emp.roles||[]).join(', '),
      diasTrabajados: dias,
      salarioDia: emp.salarioDia || 0,
      totalPago: dias * (emp.salarioDia || 0),
    };
  }).filter(e => e.diasTrabajados > 0);
}

function nomMostrarModal(desde, hasta) {
  const resumen = nomGetResumen(desde, hasta);
  if (!resumen.length) {
    toast('⚠ Sin registros de acceso en ese período', true); return;
  }
  const total = resumen.reduce((s,e) => s + e.totalPago, 0);
  const rows = resumen.map(e => `
    <tr>
      <td style="padding:5px 8px;">${e.nombre}</td>
      <td style="padding:5px 8px;color:var(--muted2);font-size:.75rem;">${e.cargo}</td>
      <td style="padding:5px 8px;text-align:center;font-weight:700;">${e.diasTrabajados}</td>
      <td style="padding:5px 8px;text-align:right;">
        <input type="number" value="${e.salarioDia||0}" step="1" min="0"
          style="width:80px;text-align:right;font-size:.78rem;padding:3px 6px;border:1px solid var(--br);border-radius:3px;background:var(--s2);"
          onchange="nomUpdateSalarioDia('${e.id}', this.value, '${desde}', '${hasta}')">
      </td>
      <td style="padding:5px 8px;text-align:right;font-weight:700;color:var(--green-deep);" id="nom-total-${e.id}">
        Q ${e.totalPago.toFixed(2)}
      </td>
    </tr>`).join('');

  const modal = document.createElement('div');
  modal.id = 'nom-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:8px;padding:20px;max-width:700px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <div style="font-family:var(--fh);font-weight:700;font-size:1rem;">👷 Nómina del Período</div>
          <div style="font-size:.72rem;color:var(--muted2);">${desde} → ${hasta} · Días contados desde Control de Acceso</div>
        </div>
        <button onclick="document.getElementById('nom-modal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--muted2);">✕</button>
      </div>
      <div style="background:var(--s2);border-radius:6px;overflow:hidden;margin-bottom:14px;">
        <table style="width:100%;border-collapse:collapse;font-size:.8rem;">
          <thead>
            <tr style="background:var(--s1);">
              <th style="padding:7px 8px;text-align:left;">Empleado</th>
              <th style="padding:7px 8px;text-align:left;">Cargo</th>
              <th style="padding:7px 8px;text-align:center;">Días</th>
              <th style="padding:7px 8px;text-align:right;">Q/día</th>
              <th style="padding:7px 8px;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:2px solid var(--green-deep);padding-top:10px;margin-bottom:14px;">
        <span style="font-weight:800;font-size:.95rem;">TOTAL NÓMINA</span>
        <span id="nom-grand-total" style="font-weight:800;font-size:1.1rem;color:var(--green-deep);">Q ${total.toFixed(2)}</span>
      </div>
      <div style="font-size:.7rem;color:var(--muted2);margin-bottom:12px;">
        💡 Ajusta el salario por día si no está configurado. Se guardará en el perfil del empleado.
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn bp" onclick="nomExportExcel('${desde}','${hasta}')">⬇ Descargar Excel</button>
        <button class="btn bo" onclick="document.getElementById('nom-modal').remove()">Cerrar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function nomUpdateSalarioDia(empId, val, desde, hasta) {
  const salario = parseFloat(val) || 0;
  const emp = (DB.empleados||[]).find(e => e.id === empId);
  if (emp) { emp.salarioDia = salario; save(); }
  // Actualizar total en la fila
  const dias = nomCalcDias(empId, desde, hasta);
  const totalEl = document.getElementById('nom-total-' + empId);
  if (totalEl) totalEl.textContent = 'Q ' + (dias * salario).toFixed(2);
  // Actualizar gran total
  const resumen = nomGetResumen(desde, hasta);
  const total = resumen.reduce((s,e) => s + e.totalPago, 0);
  const gt = document.getElementById('nom-grand-total');
  if (gt) gt.textContent = 'Q ' + total.toFixed(2);
}

function nomExportExcel(desde, hasta) {
  const resumen = nomGetResumen(desde, hasta);
  if (!resumen.length) return;
  let csv = '\uFEFF' + `Nómina ${desde} a ${hasta}\n`;
  csv += 'Empleado,Cargo,Roles,Días Trabajados,Salario/Día (Q),Total (Q)\n';
  resumen.forEach(e => {
    csv += [e.nombre, e.cargo, e.roles, e.diasTrabajados, e.salarioDia.toFixed(2), e.totalPago.toFixed(2)]
      .map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',') + '\n';
  });
  const total = resumen.reduce((s,e)=>s+e.totalPago,0);
  csv += `"","","","","TOTAL","${total.toFixed(2)}"\n`;
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a = Object.assign(document.createElement('a'),{
    href:URL.createObjectURL(blob),
    download:`Nomina_${desde}_${hasta}.csv`
  });
  a.click();
  toast('✅ Excel de nómina descargado');
}

function nomAbrir() {
  const desde = document.getElementById('nom-desde')?.value;
  const hasta  = document.getElementById('nom-hasta')?.value;
  if (!desde || !hasta) { toast('⚠ Selecciona el rango de fechas', true); return; }
  if (desde > hasta) { toast('⚠ La fecha desde debe ser menor que hasta', true); return; }
  nomMostrarModal(desde, hasta);
}

function showSnapshots() {
  toast('ℹ️ Snapshots locales deshabilitados — usa Restaurar desde Firebase', false);
}


function fbShowStatus(status) {
  const el = document.getElementById('fb-status');
  if (!el) return;
  const map = {
    loading: '<span style="color:#f26822;">⏳ Cargando datos...</span>',
    online:  '<span style="color:#00a86b;">☁ En línea</span>',
    saving:  '<span style="color:#f26822;">↑ Guardando...</span>',
    offline: '<span style="color:#d63030;">⚠ Sin conexión — guardando local</span>',
    config:  '<span style="color:#f26822;">⚙ Sin configurar — usando modo local</span>',
  };
  el.innerHTML = map[status] || '';
  // ✅ Also update login screen indicator
  const loginStatus = document.getElementById('login-fb-status');
  if (loginStatus) {
    if (status === 'loading') {
      loginStatus.style.background = 'rgba(242,104,34,.08)';
      loginStatus.style.borderColor = 'rgba(242,104,34,.3)';
      loginStatus.style.color = '#f26822';
      loginStatus.textContent = '⏳ Conectando y cargando datos...';
    } else if (status === 'online') {
      loginStatus.style.background = 'rgba(0,168,107,.1)';
      loginStatus.style.borderColor = 'rgba(0,168,107,.3)';
      loginStatus.style.color = '#00a86b';
      loginStatus.textContent = '☁ Conectado — datos cargados correctamente';
    } else if (status === 'offline') {
      loginStatus.style.background = 'rgba(214,48,48,.08)';
      loginStatus.style.borderColor = 'rgba(214,48,48,.3)';
      loginStatus.style.color = '#d63030';
      loginStatus.textContent = '⚠ Sin conexión — usando datos locales';
    }
  }
}

// ── Firebase init ─────────────────────────────────────────────────
async function initFirebase(firebaseConfig) {
  try {
    // ── Esperar módulos ESM (máx 12 segundos) ────────────────────
    if (!window._fbModulesReady) {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Firebase modules timeout — revisa conexión')), 12000);
        window.addEventListener('fb-modules-ready', () => { clearTimeout(t); resolve(); }, {once:true});
      });
    }

    const initializeApp       = window._fbInitializeApp;
    const initializeFirestore = window._fbInitFirestore;
    const getFirestore        = window._fbGetFirestore;
    const persistentLocalCache     = window._fbPersistCache;
    const persistentMultipleTabManager = window._fbMultiTab;
    const doc        = window._fbDoc;
    const getDoc     = window._fbGetDoc;
    const setDoc     = window._fbSetDoc;
    const onSnapshot = window._fbOnSnapshot;

    const app = initializeApp(firebaseConfig);

    // ── Persistencia offline moderna (reemplaza enableMultiTabIndexedDbPersistence) ──
    let db;
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      });
      console.log('✅ Firestore con persistencia multi-tab activada');
    } catch(persistErr) {
      // Si falla (otra pestaña ya la tiene), usar getFirestore normal
      try { db = getFirestore(app); } catch(e) { db = getFirestore(); }
      console.warn('⚠️ Persistencia multi-tab no disponible — usando modo normal:', persistErr.message);
    }

    _fbDb = { db, doc, getDoc, setDoc };

    // ── Cargar datos desde Firestore ──────────────────────────────
    fbShowStatus('loading');
    const docRef = doc(db, 'ajua_bpm', 'main');
    let snap;
    try {
      snap = await getDoc(docRef);
    } catch(fetchErr) {
      console.error('❌ Error al leer Firestore:', fetchErr);
      fbShowStatus('offline');
      try { authEnsureDB(); } catch(e) {}
      return;
    }

    if (snap.exists()) {
      const cloud = snap.data();
      const cloudTotal = _dbTotalRecords(cloud);
      console.log('✅ Firebase: documento encontrado —', Object.keys(cloud).length, 'colecciones —', cloudTotal, 'registros');

      // 🛡️ AUTO-RECOVERY: Si main tiene muy pocos datos, verificar backup_auto
      // Esto maneja el caso donde main fue sobreescrito accidentalmente con DB vacía
      if (cloudTotal < 10) {
        console.warn('⚠️ main tiene pocos datos (' + cloudTotal + ') — verificando backup_auto...');
        try {
          const backupRef = doc(db, 'ajua_bpm', BACKUP_DOC);
          const backupSnap = await getDoc(backupRef);
          if (backupSnap.exists()) {
            const backupData = backupSnap.data();
            const backupTotal = _dbTotalRecords(backupData);
            console.log('📦 backup_auto tiene', backupTotal, 'registros');
            if (backupTotal > cloudTotal * 3) {
              // Backup tiene significativamente más datos — auto-restaurar
              console.warn('🔄 AUTO-RESTORE: backup_auto(' + backupTotal + ') >> main(' + cloudTotal + ') — restaurando automáticamente...');
              const clean = Object.assign({}, backupData);
              delete clean._backupMeta;
              DB = Object.assign({}, DB_DEFAULT, clean);
              try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch(e) { console.warn("localStorage full:", e); }
    // Restaurar main desde backup
              try { await setDoc(docRef, DB); console.log('✅ main restaurado desde backup_auto'); } catch(e) { console.warn('Error restaurando main:', e); }
              fbShowStatus('online');
              // Notificar al usuario
              setTimeout(() => {
                const restored = _dbTotalRecords(DB);
                toast('🔄 Auto-restauración: ' + restored + ' registros recuperados desde backup', false);
              }, 2000);
              _fbReady = true;
              _fbLoaded = true; // ✅ Firebase cargó (auto-restore) — save() ya puede escribir
              startAutoBackup();
              try { authEnsureDB(); } catch(e) {}
              try { renderAll(); } catch(e) {}
              setTimeout(() => { try { renderAll(); } catch(e) {} try { populateAllRespSelects(); } catch(e) {} try { updateDash(); } catch(e) {} }, 400);
              // Setup listener and return early
              onSnapshot(docRef, (snap) => {
                if (!snap.exists() || _fbSaving) return;
                const cloud = snap.data();
                const cloudTotal2 = _dbTotalRecords(cloud);
                const currentTotal2 = _dbTotalRecords(DB);
                if (currentTotal2 > 20 && cloudTotal2 < currentTotal2 * 0.4) { console.warn('🚨 onSnapshot BLOQUEADO post-restore'); return; }
                Object.keys(cloud).forEach(k => { DB[k] = cloud[k]; });
                try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch(e) { console.warn("localStorage full:", e); }
                try { updateDash(); } catch(e) {}
                fbShowStatus('online');
              });
              return;
            }
          }
        } catch(backupErr) {
          console.warn('Error verificando backup_auto:', backupErr);
        }
      }

      // ── Merge: cloud es la fuente de verdad COMPLETA ────────────
      DB = Object.assign({}, DB_DEFAULT, cloud);
      try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch(e) { console.warn("localStorage full:", e); }
      _lastKnownTotal = _dbTotalRecords(DB); // fijar baseline sin snapshots
      _fbLoaded = true; // ✅ Firebase cargó — save() ya puede escribir
      // Liberar espacio: eliminar snapshots locales de versiones anteriores
      try { localStorage.removeItem('ajua_bpm_snapshots'); } catch(e) {}
      const counts = Object.entries(DB)
        .filter(([,v]) => Array.isArray(v))
        .map(([k,v]) => `${k}:${v.length}`)
        .join(' | ');
      console.log('✅ DB cargada desde Firebase:', counts);
    } else {
      // Documento NO existe en Firestore
      const hasData = Object.values(DB).some(v => Array.isArray(v) && v.length > 0);
      if (hasData) {
        await setDoc(docRef, DB);
        console.log('✅ Firebase: datos locales subidos (primer registro)');
      } else {
        console.warn('⚠️ Firebase: documento no existe y DB local vacía — no se sube nada');
      }
    }

    _fbReady = true;
    _fbLoaded = true; // ✅ Firebase listo — save() ya puede escribir
    startAutoBackup(); // 🛡️ Iniciar sistema de backup automático
    // ── authEnsureDB DESPUÉS de cargar cloud ──────────────────────
    try { authEnsureDB(); } catch(e) {}
    // Si ya hay sesión activa, re-validarla con datos reales de Firebase
    // (puede haber hecho login antes de que Firebase cargara)
    if (AUTH_SESSION) {
      const user = (DB.usuarios||[]).find(u => u.id === AUTH_SESSION.id && u.activo !== false);
      if (user) {
        AUTH_SESSION = { id: user.id, nombre: user.nombre, rol: user.rol, modulos: user.modulos || [] };
      }
    }

    // ── Refrescar toda la UI con datos cloud ──────────────────────
    try { renderAll(); } catch(e) { console.error('renderAll:', e); }
    // Re-render en cascada para asegurar que TODO se actualice
    setTimeout(() => {
      try { renderAll(); } catch(e) {}
      try { populateAllRespSelects(); } catch(e) {}
      try { alBuildEmpTable();        } catch(e) {}
      try { capBuildAsistentesList(); } catch(e) {}
      try { eePopulateSelect();       } catch(e) {}
      try { renderUsuarios();         } catch(e) {}
      try { renderInvAll();           } catch(e) {}
      try { updateDash();             } catch(e) {}
      try { populateProvSelects();    } catch(e) {}
      try { populateCotSelects();     } catch(e) {}
    }, 300);
    // Segundo render para garantizar — algunos renders dependen de otros
    setTimeout(() => {
      try { renderAll(); } catch(e) {}
      try { populateAllRespSelects(); } catch(e) {}
    }, 800);

    // ── Listener en tiempo real ───────────────────────────────────
    onSnapshot(docRef, (snap) => {
      if (!snap.exists() || _fbSaving) return;
      const cloud = snap.data();
      // 🛡️ GUARD: nunca dejar que un snapshot con menos datos sobreescriba la DB actual
      const cloudTotal = _dbTotalRecords(cloud);
      const currentTotal = _dbTotalRecords(DB);
      if (currentTotal > 20 && cloudTotal < currentTotal * 0.4) {
        console.warn(`🚨 onSnapshot BLOQUEADO: cloud(${cloudTotal}) << DB actual(${currentTotal}) — posible borrado accidental`);
        return;
      }
      // Merge: cloud gana sobre DB actual
      Object.keys(cloud).forEach(k => { DB[k] = cloud[k]; });
      try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch(e) { console.warn("localStorage full:", e); }
      try { updateDash(); } catch(e) {}
      try {
        const active = document.querySelector('.sec.active');
        if (active) {
          const id = active.id.replace('sec-','');
          if (['inv-stock','inv-entrada','maquila','inv-salida','ventas-gt','ventas-int',
               'reporte','inv-trazabilidad','pedidos-walmart','inv-config'].includes(id)) {
            try { renderInvAll(); } catch(e) {}
          }
          if (id === 'usuarios') try { renderUsuarios(); } catch(e) {}
        }
      } catch(e) {}
      try { populateAllRespSelects(); } catch(e) {}
      try { alBuildEmpTable();        } catch(e) {}
      try { capBuildAsistentesList(); } catch(e) {}
      try { eePopulateSelect();       } catch(e) {}
      fbShowStatus('online');
      setTimeout(() => { try { authEnsureDB(); } catch(e) {} }, 500);
    });

    fbShowStatus('online');
  } catch(err) {
    console.error('❌ Firebase init error:', err);
    _fbLoaded = true; // ✅ Fallback offline — permitir save() a localStorage al menos
    fbShowStatus('offline');
    try { authEnsureDB(); } catch(e) {}
  }
}

const EMPLEADOS=['MARIA VILLANUEVA','EDUARDO GARCIA','HENRY CU','OSCAR BA','AURELIO CHOC','ROLANDO ICAL','ROLANDO CHOCOJ','MANUEL SALAZAR','BYRON FAJARDO','RICARDO SAGASTUME','ANGELES QUEZADA'];

function save() {
  const currentTotal = _dbTotalRecords(DB);

  // ══ GUARD 0: Nunca guardar nada hasta que Firebase haya cargado ══
  // Esto evita que una DB vacía al inicio sobreescriba datos reales
  if (!_fbLoaded) {
    // Solo log — no hacer nada, ni siquiera localStorage
    console.warn('⏸ save() bloqueado — Firebase aún no terminó de cargar');
    return;
  }

  // ══ GUARD 1: Nunca subir a Firebase antes de que cargue ══════════
  const canWriteFirebase = _fbReady;

  // ══ GUARD 2: Nunca subir menos datos de los que había ════════════
  // Compara contra el snapshot local más reciente
  // Guard: nunca subir a Firebase si los datos bajaron más del 40% sin explicación
  // Usa _lastKnownTotal en memoria (no localStorage) para evitar falsos positivos
  let blockedByGuard = false;
  try {
    if (typeof _lastKnownTotal === 'number' && _lastKnownTotal > 10) {
      if (currentTotal < _lastKnownTotal * 0.6) {
        console.error(`🚨 FIREBASE BLOQUEADO: actual(${currentTotal}) < 60% de último conocido(${_lastKnownTotal})`);
        blockedByGuard = true;
      }
    }
    if (!blockedByGuard && currentTotal > (_lastKnownTotal||0)) {
      _lastKnownTotal = currentTotal; // actualizar máximo conocido
    }
  } catch(e) {}

  // ── Guardar en localStorage siempre (rápido, reversible) ─────────
  try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch(e) {}
  updateDash();

  // ── Guardar en Firebase solo si pasa ambos guards ─────────────────
  if (!canWriteFirebase || blockedByGuard || !_fbDb) return;

  fbShowStatus('saving');
  if (_fbSaveQ) clearTimeout(_fbSaveQ);
  _fbSaveQ = setTimeout(async () => {
    try {
      _fbSaving = true;
      const { db, doc, setDoc } = _fbDb;
      // Verificación final justo antes de escribir
      const finalTotal = _dbTotalRecords(DB);
      if (finalTotal === 0) {
        console.error('🚨 ABORT: intentando guardar DB completamente vacía en Firebase');
        fbShowStatus('offline');
        return;
      }
      await setDoc(doc(db, 'ajua_bpm', 'main'), DB);
      fbShowStatus('online');
    } catch(err) {
      console.error('Firebase save error:', err);
      fbShowStatus('offline');
    } finally {
      _fbSaving = false;
    }
  }, 500);
}
function toast(m='✓ Guardado',err=false){
  const t=document.getElementById('toast');
  t.textContent=m;t.className=err?'err show':'show';
  setTimeout(()=>t.className='',2500);
}
function uid(){return Date.now()+'_'+Math.random().toString(36).slice(2,7);}
function now(){return new Date().toLocaleString('es-GT');}
function today(){return new Date().toLocaleDateString('es-GT');}
function v(id){return document.getElementById(id)?.value||'';}
function set(id,val){const e=document.getElementById(id);if(e)e.value=val;}

function tick(){
  const now=new Date();
  document.getElementById('hclock').textContent=now.toLocaleTimeString('es-GT');
  const fd=now.toLocaleDateString('es-GT',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const el=document.getElementById('fecha-hoy');if(el)el.textContent=fd;
}
setInterval(tick,1000);tick();

function show(id,el){closeNavOnMobile();
  if (AUTH_SESSION && id !== 'dashboard' && id !== 'usuarios') {
    if (!authCanAccess(id)) {
      toast('⚠ No tienes acceso a este módulo', true); return;
    }
  }
  // Switch active section
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  document.getElementById('sec-'+id)?.classList.add('active');
  // Mark nav item active — el puede ser cualquier elemento dentro del ni
  if(el) {
    const ni = el.closest ? el.closest('.ni') : el;
    if(ni) ni.classList.add('active');
  } else {
    // Buscar el ni que tenga show('id') en su onclick
    const found = document.querySelector('.ni[onclick*="show(\''+id+'\'"]');
    if(found) found.classList.add('active');
  }
  // Persistir último módulo
  try { sessionStorage.setItem('ajua_last_sec', id); } catch(e) {}

  // Lazy render — only what's needed for this module
  try {
    switch(id) {
      case 'dashboard':
        updateDash(); break;
      case 'transporte-limpieza':
        buildTLChecklist(); renderTL(); populateAllRespSelects(); break;
      case 'despacho':
        buildDTChecklist(); renderDT(); populateAllRespSelects(); break;
      case 'bodega-limpieza':
        buildBLChecklist(); renderBL(); populateAllRespSelects(); break;
      case 'roedores':
        buildRodTrampas(); renderRod(); populateAllRespSelects(); break;
      case 'vidrio':
        buildVPChecklist(); renderVP(); populateAllRespSelects(); break;
      case 'basculas':
        buildBasList(); renderBas(); renderCalib(); populateAllRespSelects(); break;
      case 'lavado-prod':
        buildLPTanques(); renderLP(); populateAllRespSelects(); break;
      case 'fumigacion':
        renderFum(); populateAllRespSelects(); break;
      case 'capacitacion':
        renderCap(); break;
      case 'empleados-enfermos':
        renderEE(); break;
      case 'acceso-lavado':
        alBuildEmpTable(); renderAL(); break;
      case 'visitas':
        renderVis(); break;
      case 'usuarios':
        cancelEditUsuario(); renderUsuarios(); break;
      case 'empleados-db':
        renderEmpleados(); populateAllRespSelects(); break;
      case 'proveedores':
        provTab(provActivaTipo, document.querySelector('#sec-proveedores .tab.active')); break;
      case 'inv-stock':
        invEnsureDB(); invPopulateSelects(); renderInvStock();
        // Pre-populate traz-producto for when user clicks traza buttons
        (function() {
          const sel = document.getElementById('traz-producto');
          if (sel && DB.iproductos?.length && sel.options.length <= 1) {
            sel.innerHTML = '<option value="">— Todos los productos —</option>' +
              DB.iproductos.map(p => '<option value="'+p.id+'">'+p.nombre+'</option>').join('');
          }
        })(); break;
      case 'inv-entrada':
        invEnsureDB(); invPopulateSelects(); renderIne(); break;
      case 'inv-salida':
        invEnsureDB(); invPopulateSelects(); renderSal();
        // Asegurarse que el panel XML esté oculto y el Ediwin activo por defecto
        setTimeout(() => { if(typeof salTab==='function') salTab('ediwin'); }, 50);
        break;
      case 'inv-cotizador':
        invEnsureDB(); invPopulateSelects(); renderCotList(); break;
      case 'inv-trazabilidad':
        invEnsureDB();
        // Populate product selector
        (function() {
          const sel = document.getElementById('traz-producto');
          if (sel && DB.iproductos?.length) {
            const cur = sel.value;
            sel.innerHTML = '<option value="">— Todos los productos —</option>' +
              DB.iproductos.map(p => '<option value="'+p.id+'">'+p.nombre+'</option>').join('');
            sel.value = cur;
          }
        })();
        renderInvMovs(); break;
      case 'inv-config':
        invEnsureDB(); renderIprod(); renderIpres(); renderIcli(); invConfigTab('productos', null); break;
      case 'maquila':
        invEnsureDB(); maqInit(); break;
      case 'gastos-diarios':
        if (!DB.gastosDiarios) DB.gastosDiarios = [];
        gdInitFecha(); gdRender(); break;
      case 'cotizador-rapido':
        if (!DB.cotizadorRapido) DB.cotizadorRapido = [];
        crInit(); crRender(); break;
      case 'pedidos-walmart':
        invEnsureDB(); pwInit(); break;
      case 'ventas-gt':
        invEnsureDB(); renderVgtVentas(); break;
      case 'ventas-int':
        invEnsureDB(); renderVintVentas(); break;
      case 'reporte':
        invEnsureDB();
        // Set default date range to current month
        if (!document.getElementById('rep-desde')?.value) {
          const gt = new Date(Date.now()-6*3600000);
          const y = gt.getFullYear(), m = String(gt.getMonth()+1).padStart(2,'0');
          const lastDay = new Date(y, gt.getMonth()+1, 0).getDate();
          document.getElementById('rep-desde').value = `${y}-${m}-01`;
          document.getElementById('rep-hasta').value = `${y}-${m}-${lastDay}`;
        }
        // Populate product selector
        const repProdSel = document.getElementById('rep-prod');
        if (repProdSel && repProdSel.options.length <= 1) {
          (DB.iproductos||[]).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id; opt.textContent = p.nombre;
            repProdSel.appendChild(opt);
          });
        }
        break;
    }
  } catch(e) { console.error('show error ['+id+']:', e); }
}

function chipSN(v){
  if(v==='si'||v===true||v==='ok'||v==='realizado'||v==='controlado')return'<span class="chip ck">SI</span>';
  if(v==='no'||v==='no_cumple')return'<span class="chip cr">NO</span>';
  if(v==='alerta')return'<span class="chip cw">ALERTA</span>';
  if(v==='pendiente')return'<span class="chip cw">PENDIENTE</span>';
  if(v==='reprogramado')return'<span class="chip co">REPROGRAMADO</span>';
  if(v==='na')return'<span class="chip cb">N/A</span>';
  return`<span class="chip cb">${v||'—'}</span>`;
}
function chipEstado(e){
  const m={baja:'<span class="chip cr">BAJA</span>',reintegrado:'<span class="chip ck">REINTEGRADO</span>',seguimiento:'<span class="chip cw">SEGUIMIENTO</span>',sin_actividad:'<span class="chip ck">SIN ACT.</span>',con_actividad:'<span class="chip cr">CON ACT.</span>',cebo_repuesto:'<span class="chip cw">CEBO REP.</span>',trampa_dañada:'<span class="chip cr">DAÑADA</span>',programada:'<span class="chip cb">PROGRAMADA</span>',ok:'<span class="chip ck">OK</span>',alerta:'<span class="chip cw">ALERTA</span>'};
  return m[e]||`<span class="chip cb">${e||'—'}</span>`;
}
function del(key,id){DB[key]=DB[key].filter(r=>r.id!==id);save();renderAll();}

const TL_ITEMS=[
  {cat:'EXTERIOR',item:'Lavado de Furgón'},
  {cat:'EXTERIOR',item:'Lavado Carrocería'},
  {cat:'INTERIOR',item:'Barrido Furgón'},
  {cat:'INTERIOR',item:'Desinfección Agua-Cloro'},
  {cat:'INTERIOR',item:'Cabina'},
];
let tlStream=null,tlFacing='environment',tlPhotos=[];

function clBtn(el, name, val, rowId) {
  // Toggle radio logic
  const row = document.getElementById(rowId);
  const btns = el.closest('.cl-btns').querySelectorAll('.cl-btn');
  btns.forEach(b => b.classList.remove('active-si','active-no','active-na'));
  const cls = val==='si'||val==='cumple' ? 'active-si' : val==='no'||val==='mal' ? 'active-no' : 'active-na';
  el.classList.add(cls);
  // Set hidden radio for save compatibility
  let radio = document.querySelector(`input[name="${name}"][value="${val}"]`);
  if (!radio) {
    // Create hidden radios if they don't exist
    const existing = document.querySelectorAll(`input[name="${name}"]`);
    existing.forEach(r=>r.remove());
    ['si','no','na','cumple','mal'].forEach(v=>{
      const r=document.createElement('input');
      r.type='radio';r.name=name;r.value=v;r.style.display='none';
      document.body.appendChild(r);
    });
    radio = document.querySelector(`input[name="${name}"][value="${val}"]`);
  }
  if (radio) radio.checked = true;
  // Update row color
  if (row) {
    row.classList.remove('si','no','na');
    if (val==='si'||val==='cumple') row.classList.add('si');
    else if (val==='no'||val==='mal') row.classList.add('no');
    else row.classList.add('na');
  }
}
function buildTLChecklist(){
  const tb=document.getElementById('tl-checklist');
  if(!tb||tb.dataset.built)return;
  tb.dataset.built='1';
  tb.className='cl-list';
  tb.removeAttribute('style');
  let lastCat='';
  TL_ITEMS.forEach((x,i)=>{
    if(x.cat!==lastCat){
      lastCat=x.cat;
      tb.insertAdjacentHTML('beforeend',`<div class="cl-cat-header">${x.cat}</div>`);
    }
    tb.insertAdjacentHTML('beforeend',`
    <div class="cl-item" id="tl-ci-${i}">
      <div class="cl-item-txt">
        <div class="cl-item-cat">${x.cat}</div>
        <div class="cl-item-name">${x.item}</div>
      </div>
      <div class="cl-btns">
        <button class="cl-btn" onclick="clBtn(this,'tl_${i}','si','tl-ci-${i}')">SI</button>
        <button class="cl-btn" onclick="clBtn(this,'tl_${i}','no','tl-ci-${i}')">NO</button>
      </div>
    </div>`);
  });
}
async function tlOpenCam(){
  try{
    tlStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:tlFacing,width:{ideal:1280},height:{ideal:720}}});
    const vid=document.getElementById('tl-cam-video');
    vid.srcObject=tlStream;vid.style.display='block';
    document.getElementById('tl-cam-open').style.display='none';
    document.getElementById('tl-cam-active').style.display='block';
    toast('📷 Cámara activada');
  }catch(e){toast('⚠ No se pudo acceder a la cámara',true);}
}
async function tlSwitchCam(){
  tlFacing=tlFacing==='environment'?'user':'environment';
  if(tlStream)tlStream.getTracks().forEach(t=>t.stop());
  await tlOpenCam();
}
function tlCapture(){
  const vid=document.getElementById('tl-cam-video'),can=document.getElementById('tl-cam-canvas');
  const lbl=document.getElementById('tl-photo-label');
  can.width=vid.videoWidth;can.height=vid.videoHeight;
  const ctx=can.getContext('2d');ctx.drawImage(vid,0,0);
  const ts=new Date().toLocaleString('es-GT');
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,can.height-34,can.width,34);
  ctx.fillStyle='#00d98b';ctx.font='bold 14px monospace';
  ctx.fillText(`AJÚA BPM · Limpieza · ${ts}`,10,can.height-10);
  const data=can.toDataURL('image/jpeg',.85);
  tlPhotos.push({data,labelText:lbl.options[lbl.selectedIndex].text,ts});
  tlRenderPhotos();toast(`✓ Foto capturada`);
}
function tlRenderPhotos(){
  const g=document.getElementById('tl-photos-grid');
  const b=document.getElementById('tl-photo-badge');
  b.textContent=tlPhotos.length?`${tlPhotos.length} foto${tlPhotos.length>1?'s':''}`:' 0 fotos';
  b.style.color=tlPhotos.length?'var(--acc)':'var(--muted2)';
  g.innerHTML=tlPhotos.map((p,i)=>`
    <div style="position:relative;border-radius:3px;overflow:hidden;border:1.5px solid var(--br);aspect-ratio:4/3;background:var(--s3);">
      <img src="${p.data}" style="width:100%;height:100%;object-fit:cover;">
      <div style="position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;opacity:0;transition:.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">
        <button onclick="tlPhotos.splice(${i},1);tlRenderPhotos()" style="background:var(--danger);color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:.68rem;">✕</button>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.7);font-size:.55rem;color:rgba(255,255,255,.8);padding:2px 5px;text-align:center;">${p.labelText}</div>
    </div>`).join('');
}
function tlCloseCam(){
  if(tlStream){tlStream.getTracks().forEach(t=>t.stop());tlStream=null;}
  const vid=document.getElementById('tl-cam-video');vid.style.display='none';vid.srcObject=null;
  document.getElementById('tl-cam-open').style.display='';
  document.getElementById('tl-cam-active').style.display='none';
}
function saveTL(){
  const checks=TL_ITEMS.map((_,i)=>{const r=document.querySelector(`input[name="tl_${i}"]:checked`);return r?r.value:'';});
  if(!v('tl-fecha')||!v('tl-resp')){toast('⚠ Complete fecha y responsable',true);return;}
  tlCloseCam();
  DB.tl.unshift({id:uid(),ts:now(),fecha:v('tl-fecha'),resp:v('tl-resp'),hora:v('tl-hora'),placa:v('tl-placa'),tipo:v('tl-tipo'),checks,photos:[...tlPhotos],obs:v('tl-obs')});
  tlPhotos=[];tlRenderPhotos();
  save();renderTL();toast('✓ Registro de limpieza guardado');
}
function renderTL(){
  const tb=document.getElementById('tl-tbody');if(!tb)return;
  if(!DB.tl.length){tb.innerHTML=`<tr><td colspan="13"><div class="empty">Sin registros</div></td></tr>`;return;}
  const TIPO_MAP={completa:'Completa',exterior:'Solo Exterior',interior:'Solo Interior',desinfeccion:'Desinfección Prof.'};
  tb.innerHTML=DB.tl.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r=>`<tr>
    <td>${r.fecha}</td><td>${r.resp}</td><td>${r.hora||'—'}</td>
    <td>${r.placa||'—'}</td><td style="font-size:.68rem">${TIPO_MAP[r.tipo]||r.tipo||'—'}</td>
    ${(r.checks||[]).map(c=>chipSN(c)).map(c=>`<td>${c}</td>`).join('')}
    <td>${r.photos&&r.photos.length?`<span class="chip cb">📷 ${r.photos.length}</span>`:'—'}</td>
    <td style="font-size:.68rem;color:var(--muted2)">${r.obs||'—'}</td>
    <td><button class="btn bo bsm" onclick="del('tl','${r.id}')">✕</button></td>
  </tr>`).join('');
}

function dtTab(name,el){
  ['form','conductores','clientes'].forEach(t=>{
    document.getElementById('dt-tab-'+t).style.display=t===name?'block':'none';
  });
  document.querySelectorAll('#sec-despacho .tab').forEach(t=>t.classList.remove('active'));
  if(el)el.classList.add('active');
  if(name==='conductores')renderConductores();
  if(name==='clientes')renderClientes();
}

if(!DB.conductores)DB.conductores=[];
if(!DB.clientes)DB.clientes=[];

let condStream=null,condLicStream=null,condFotoData=null,condLicData=null,condFacing='user';

async function condOpenCam(tipo){
  const vidId=tipo==='foto'?'cond-cam-video':'cond-lic-cam-video';
  const openId=tipo==='foto'?'cond-cam-btns-open':'cond-lic-cam-btns-open';
  const activeId=tipo==='foto'?'cond-cam-btns-active':'cond-lic-cam-btns-active';
  const facing=tipo==='foto'?'user':'environment';
  try{
    const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:640},height:{ideal:480}}});
    if(tipo==='foto'){condStream=s;}else{condLicStream=s;}
    const vid=document.getElementById(vidId);
    vid.srcObject=s;vid.style.display='block';
    document.getElementById(openId).style.display='none';
    document.getElementById(activeId).style.display='flex';
    toast('📷 Cámara lista');
  }catch(e){toast('⚠ No se pudo acceder a la cámara',true);}
}
function condCapture(tipo){
  const vidId=tipo==='foto'?'cond-cam-video':'cond-lic-cam-video';
  const canId=tipo==='foto'?'cond-cam-canvas':'cond-lic-cam-canvas';
  const vid=document.getElementById(vidId),can=document.getElementById(canId);
  can.width=vid.videoWidth;can.height=vid.videoHeight;
  can.getContext('2d').drawImage(vid,0,0);
  const data=can.toDataURL('image/jpeg',.88);
  if(tipo==='foto'){
    condFotoData=data;
    const prev=document.getElementById('cond-foto-preview');
    prev.innerHTML=`<img src="${data}" style="width:100%;height:100%;object-fit:cover;">`;
    condCloseCam();
  }else{
    condLicData=data;
    const prev=document.getElementById('cond-lic-preview');
    prev.innerHTML=`<img src="${data}" style="width:100%;height:100%;object-fit:cover;">`;
    condLicCloseCam();
  }
  toast('✓ Foto capturada');
}
function condCloseCam(){
  if(condStream){condStream.getTracks().forEach(t=>t.stop());condStream=null;}
  const vid=document.getElementById('cond-cam-video');vid.style.display='none';vid.srcObject=null;
  document.getElementById('cond-cam-btns-open').style.display='block';
  document.getElementById('cond-cam-btns-active').style.display='none';
}
function condLicCloseCam(){
  if(condLicStream){condLicStream.getTracks().forEach(t=>t.stop());condLicStream=null;}
  const vid=document.getElementById('cond-lic-cam-video');vid.style.display='none';vid.srcObject=null;
  document.getElementById('cond-lic-cam-btns-open').style.display='block';
  document.getElementById('cond-lic-cam-btns-active').style.display='none';
}
function saveConductor(){
  const nombre=document.getElementById('cond-nombre').value.trim();
  const lic=document.getElementById('cond-lic').value.trim();
  if(!nombre||!lic){toast('⚠ Nombre y número de licencia son obligatorios',true);return;}
  const rec={
    id:uid(),nombre,lic,
    tipoLic:document.getElementById('cond-tipo-lic').value,
    tel:document.getElementById('cond-tel').value,
    dpi:document.getElementById('cond-dpi').value,
    venc:document.getElementById('cond-venc').value,
    foto:condFotoData||null,
    licFoto:condLicData||null,
    ts:now()
  };
  DB.conductores.push(rec);
  condFotoData=null;condLicData=null;
  ['cond-nombre','cond-lic','cond-tel','cond-dpi','cond-venc'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('cond-foto-preview').innerHTML='👤';
  document.getElementById('cond-lic-preview').innerHTML='Licencia';
  save();
  renderConductores();
  dtPopulateConductorSelect();
  toast(`✓ Conductor "${nombre}" agregado`);
}
function renderConductores(){
  const lista = document.getElementById('cond-lista');
  if (!lista) return;

  const hoy = new Date(Date.now()-6*60*60*1000).toISOString().split('T')[0];

  // Pilotos desde DB.empleados
  const empPilotos = (DB.empleados||[])
    .filter(e => e.estado==='activo' && (e.roles||[]).includes('piloto'))
    .sort((a,b)=>a.nombre.localeCompare(b.nombre));

  // Conductores legacy
  const legacyConds = (DB.conductores||[]);

  if (!empPilotos.length && !legacyConds.length) {
    lista.innerHTML = `<div class="empty" style="grid-column:1/-1;">Sin conductores/pilotos registrados.<br><small>Agrega empleados con rol Piloto en Base de Empleados.</small></div>`;
    return;
  }

  const empCards = empPilotos.map(e => {
    const vencido = e.lic_venc && e.lic_venc < hoy;
    const pronto  = e.lic_venc && !vencido && (new Date(e.lic_venc)-new Date(hoy)) < 30*86400000;
    const badge   = vencido ? `<span style="color:var(--danger);font-size:.6rem;font-weight:700;">⚠ LIC VENCIDA</span>`
                  : pronto  ? `<span style="color:var(--orange);font-size:.6rem;font-weight:700;">⏰ Vence pronto</span>`
                  : e.lic_venc ? `<span style="color:var(--acc);font-size:.6rem;">✓ Vigente</span>` : '';
    return `<div style="background:var(--s2);border:1.5px solid ${vencido?'var(--danger)':pronto?'var(--orange)':'var(--br)'};border-radius:8px;padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div style="font-weight:700;font-size:.82rem;">🚛 ${e.nombre}</div>
          <div style="font-size:.68rem;color:var(--muted2);">${e.cargo||'Piloto'}</div>
        </div>
        ${badge}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.7rem;">
        <div><span style="color:var(--muted2);">Licencia:</span> <b>${e.lic_num||'—'}</b></div>
        <div><span style="color:var(--muted2);">Tipo:</span> <b>${e.lic_tipo||'—'}</b></div>
        <div><span style="color:var(--muted2);">Vence:</span> <b>${e.lic_venc||'—'}</b></div>
        <div><span style="color:var(--muted2);">Tel:</span> <b>${e.tel||'—'}</b></div>
      </div>
      <div style="margin-top:8px;display:flex;gap:6px;">
        <span style="font-size:.6rem;background:var(--acc)22;color:var(--acc);padding:2px 7px;border-radius:4px;border:1px solid var(--acc)44;">Empleado</span>
      </div>
    </div>`;
  }).join('');

  const legacyCards = legacyConds.map(c => {
    const vencido = c.venc && c.venc < hoy;
    const pronto  = c.venc && !vencido && (new Date(c.venc)-new Date(hoy)) < 30*86400000;
    const badge   = vencido ? `<span style="color:var(--danger);font-size:.6rem;font-weight:700;">⚠ VENCIDA</span>`
                  : pronto  ? `<span style="color:var(--orange);font-size:.6rem;">⏰ Pronto</span>` : '';
    return `<div style="background:var(--s2);border:1.5px solid ${vencido?'var(--danger)':pronto?'var(--orange)':'var(--br)'};border-radius:8px;padding:14px;opacity:.85;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div style="font-weight:700;font-size:.82rem;">🚛 ${c.nombre}</div>
          <div style="font-size:.68rem;color:var(--muted2);">Conductor externo</div>
        </div>
        ${badge}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.7rem;">
        <div><span style="color:var(--muted2);">Licencia:</span> <b>${c.lic}</b></div>
        <div><span style="color:var(--muted2);">Tipo:</span> <b>${c.tipo||'—'}</b></div>
        <div><span style="color:var(--muted2);">Vence:</span> <b>${c.venc||'—'}</b></div>
        <div><span style="color:var(--muted2);">Tel:</span> <b>${c.tel||'—'}</b></div>
      </div>
      <div style="margin-top:8px;display:flex;gap:6px;align-items:center;">
        <span style="font-size:.6rem;background:var(--muted2)22;color:var(--muted2);padding:2px 7px;border-radius:4px;border:1px solid var(--muted2)44;">Legacy</span>
        <button class="btn bo bsm" style="font-size:.6rem;padding:3px 8px;border-color:var(--danger);color:var(--danger);" onclick="deleteConductor('${c.id}')">Eliminar</button>
      </div>
    </div>`;
  }).join('');

  lista.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;';
  lista.innerHTML = empCards + legacyCards;
}
function delConductor(id){
  DB.conductores=DB.conductores.filter(c=>c.id!==id);
  save();renderConductores();dtPopulateConductorSelect();toast('Conductor eliminado');
}
function dtPopulateConductorSelect(){
  const sel=document.getElementById('dt-conductor-sel');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">— Seleccionar conductor —</option>'+
    DB.conductores.map(c=>`<option value="${c.id}">${c.nombre} · ${c.lic}</option>`).join('');
  sel.value=cur;
}
function dtSelectConductor(val){
  const card = document.getElementById('dt-conductor-card');
  if (!val) { card.style.display='none'; return; }

  let c = null;
  if (val.startsWith('emp:')) {
    const emp = (DB.empleados||[]).find(e => e.id === val.replace('emp:',''));
    if (emp) c = { nombre: emp.nombre, lic: emp.cargo||'—', tipoLic:'', venc:'', foto:'', licFoto:'' };
  } else if (val.startsWith('cond:')) {
    c = (DB.conductores||[]).find(x => x.id === val.replace('cond:',''));
  }

  if (!c) { card.style.display='none'; return; }
  card.style.display = 'block';
  const fotoEl = document.getElementById('dt-cond-foto');
  if (fotoEl) fotoEl.innerHTML = c.foto ? '<img src="'+c.foto+'" style="width:100%;height:100%;object-fit:cover;">' : '👤';
  const nmEl = document.getElementById('dt-cond-nombre');
  if (nmEl) nmEl.textContent = c.nombre;
  const lcEl = document.getElementById('dt-cond-lic');
  if (lcEl) lcEl.textContent = 'Licencia ' + (c.lic||'—') + (c.tipoLic?' · '+c.tipoLic:'');
  const hoy = new Date().toISOString().split('T')[0];
  const vencido = c.venc && c.venc < hoy;
  const vcEl = document.getElementById('dt-cond-venc');
  if (vcEl) vcEl.innerHTML = c.venc
    ? '<span class="chip '+(vencido?'cr':'ck')+'" style="font-size:.6rem;">'+(vencido?'⚠ LICENCIA VENCIDA':'✓ Lic. vigente hasta '+c.venc)+'</span>'
    : '';
  const licEl = document.getElementById('dt-cond-licfoto');
  if (licEl) licEl.innerHTML = c.licFoto ? '<img src="'+c.licFoto+'" style="width:100%;height:100%;object-fit:cover;">' : 'Sin foto';
}

function saveCliente(){
  const nombre=document.getElementById('cli-nombre').value.trim();
  if(!nombre){toast('⚠ El nombre del cliente es obligatorio',true);return;}
  const rec={
    id:uid(),nombre,
    contacto:document.getElementById('cli-contacto').value,
    tel:document.getElementById('cli-tel').value,
    dir:document.getElementById('cli-dir').value,
    muni:document.getElementById('cli-muni').value,
    notas:document.getElementById('cli-notas').value,
    ts:now()
  };
  DB.clientes.push(rec);
  ['cli-nombre','cli-contacto','cli-tel','cli-dir','cli-muni','cli-notas'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  save();renderClientes();dtPopulateClienteSelect();toast(`✓ Cliente "${nombre}" agregado`);
}
function renderClientes(){
  const lista=document.getElementById('cli-lista');if(!lista)return;
  if(!DB.clientes.length){lista.innerHTML=`<div class="empty" style="grid-column:1/-1;">Sin clientes registrados</div>`;return;}
  lista.innerHTML=DB.clientes.map(c=>`
    <div style="background:var(--s1);border:1.5px solid var(--br);border-radius:4px;padding:14px;">
      <div style="font-family:var(--fh);font-size:.85rem;font-weight:600;margin-bottom:4px;">📍 ${c.nombre}</div>
      ${c.dir?`<div style="font-size:.72rem;color:var(--muted2);">${c.dir}</div>`:''}
      ${c.muni?`<div style="font-size:.7rem;color:var(--muted2);">${c.muni}</div>`:''}
      ${c.contacto?`<div style="font-size:.7rem;margin-top:4px;">👤 ${c.contacto}${c.tel?' · '+c.tel:''}</div>`:''}
      ${c.notas?`<div style="font-size:.68rem;color:var(--muted2);margin-top:4px;font-style:italic;">${c.notas}</div>`:''}
      <button class="btn bo bsm" style="border-color:var(--danger);color:var(--danger);font-size:.62rem;margin-top:8px;" onclick="delCliente('${c.id}')">✕ Eliminar</button>
    </div>`).join('');
}
function delCliente(id){
  DB.clientes=DB.clientes.filter(c=>c.id!==id);
  save();renderClientes();dtPopulateClienteSelect();toast('Cliente eliminado');
}
function dtPopulateClienteSelect(){
  const sel=document.getElementById('dt-cliente-sel');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">— Seleccionar cliente —</option>'+
    DB.clientes.map(c=>`<option value="${c.id}">${c.nombre}${c.muni?' · '+c.muni:''}</option>`).join('');
  sel.value=cur;
}
function dtSelectCliente(id){
  const card=document.getElementById('dt-cliente-card');
  if(!id){card.style.display='none';return;}
  const c=DB.clientes.find(x=>x.id===id);if(!c){card.style.display='none';return;}
  card.style.display='block';
  document.getElementById('dt-cli-nombre').textContent=c.nombre;
  document.getElementById('dt-cli-dir').textContent=[c.dir,c.muni].filter(Boolean).join(' · ');
}

const DT_ITEMS=[
  {area:'Limpieza del Vehículo',crit:'El interior del vehículo está limpio y libre de residuos'},
  {area:'Limpieza del Vehículo',crit:'El exterior del vehículo está limpio'},
  {area:'Limpieza del Vehículo',crit:'Las superficies en contacto con producto están desinfectadas'},
  {area:'Limpieza del Vehículo',crit:'Se realizó desinfección periódica del vehículo'},
  {area:'Limpieza del Vehículo',crit:'No hay olores fuertes o inusuales en el área de carga'},
  {area:'Equipos Transporte',crit:'El sistema de refrigeración funciona adecuadamente'},
  {area:'Equipos Transporte',crit:'Las puertas del compartimento cierran herméticamente'},
  {area:'Equipos Transporte',crit:'Las paredes del compartimento están en buen estado'},
  {area:'Equipos Transporte',crit:'El piso está limpio, seco y sin roturas'},
  {area:'Equipos Transporte',crit:'El vehículo cuenta con ventilación adecuada'},
];
let dtStream=null,dtFacing='environment',dtPhotos=[];

function buildDTChecklist(){
  const tb=document.getElementById('dt-checklist');
  if(!tb||tb.dataset.built)return;
  tb.dataset.built='1';
  tb.className='cl-list';
  tb.removeAttribute('style');
  let lastArea='';
  DT_ITEMS.forEach((x,i)=>{
    if(x.area!==lastArea){
      lastArea=x.area;
      tb.insertAdjacentHTML('beforeend',`<div class="cl-cat-header">${x.area}</div>`);
    }
    tb.insertAdjacentHTML('beforeend',`
    <div class="cl-item" id="dt-ci-${i}">
      <div class="cl-item-txt">
        <div class="cl-item-cat">${x.area}</div>
        <div class="cl-item-name">${x.crit}</div>
      </div>
      <div class="cl-btns">
        <button class="cl-btn" onclick="clBtn(this,'dt_${i}','si','dt-ci-${i}');dtUpdateResult()">SI</button>
        <button class="cl-btn" onclick="clBtn(this,'dt_${i}','no','dt-ci-${i}');dtUpdateResult()">NO</button>
        <button class="cl-btn" onclick="clBtn(this,'dt_${i}','na','dt-ci-${i}');dtUpdateResult()">N/A</button>
      </div>
    </div>`);
  });
}
function dtUpdateResult(){
  const checks=DT_ITEMS.map((_,i)=>{const r=document.querySelector(`input[name="dt_${i}"]:checked`);return r?r.value:'';});
  const answered=checks.filter(c=>c!=='').length;
  if(answered<DT_ITEMS.length){document.getElementById('dt-result').style.display='none';return;}
  const si=checks.filter(c=>c==='si').length,total=DT_ITEMS.length,pct=Math.round(si/total*100);
  const box=document.getElementById('dt-result'),score=document.getElementById('dt-result-score'),lbl=document.getElementById('dt-result-label');
  box.style.display='block';score.textContent=pct+'%';
  if(pct===100){box.style.cssText='display:block;padding:12px 16px;border-radius:4px;margin-bottom:12px;text-align:center;border:2px solid var(--acc);background:rgba(0,217,139,.08)';score.style.color='var(--acc)';lbl.textContent='✓ APROBADO — Vehículo listo para despacho';lbl.style.color='var(--acc)';}
  else if(pct>=80){box.style.cssText='display:block;padding:12px 16px;border-radius:4px;margin-bottom:12px;text-align:center;border:2px solid var(--warn);background:rgba(245,197,24,.08)';score.style.color='var(--warn)';lbl.textContent=`⚠ APROBADO CON OBSERVACIONES — ${total-si} criterio(s) sin cumplir`;lbl.style.color='var(--warn)';}
  else{box.style.cssText='display:block;padding:12px 16px;border-radius:4px;margin-bottom:12px;text-align:center;border:2px solid var(--danger);background:rgba(255,56,88,.08)';score.style.color='var(--danger)';lbl.textContent=`✕ RECHAZADO — ${total-si} de ${total} criterios no cumplen`;lbl.style.color='var(--danger)';}
}
async function dtOpenCam(){
  try{
    dtStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:dtFacing,width:{ideal:1280},height:{ideal:720}}});
    const vid=document.getElementById('dt-cam-video');vid.srcObject=dtStream;vid.style.display='block';
    document.getElementById('dt-cam-open').style.display='none';
    document.getElementById('dt-cam-active').style.display='block';
    toast('📷 Cámara activada');
  }catch(e){toast('⚠ No se pudo acceder a la cámara',true);}
}
async function dtSwitchCam(){
  dtFacing=dtFacing==='environment'?'user':'environment';
  if(dtStream)dtStream.getTracks().forEach(t=>t.stop());
  await dtOpenCam();
}
function dtCapture(){
  const vid=document.getElementById('dt-cam-video'),can=document.getElementById('dt-cam-canvas');
  const lbl=document.getElementById('dt-photo-label');
  can.width=vid.videoWidth;can.height=vid.videoHeight;
  const ctx=can.getContext('2d');ctx.drawImage(vid,0,0);
  const ts=new Date().toLocaleString('es-GT');
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,can.height-34,can.width,34);
  ctx.fillStyle='#ff6b35';ctx.font='bold 14px monospace';
  ctx.fillText(`AJÚA BPM · Despacho · ${ts}`,10,can.height-10);
  const data=can.toDataURL('image/jpeg',.85);
  dtPhotos.push({data,labelText:lbl.options[lbl.selectedIndex].text,ts});
  dtRenderPhotos();toast('✓ Foto capturada');
}
function dtRenderPhotos(){
  const g=document.getElementById('dt-photos-grid'),b=document.getElementById('dt-photo-badge');
  b.textContent=dtPhotos.length?`${dtPhotos.length} foto${dtPhotos.length>1?'s':''}`:' 0 fotos';
  b.style.color=dtPhotos.length?'var(--acc)':'var(--muted2)';
  g.innerHTML=dtPhotos.map((p,i)=>`
    <div style="position:relative;border-radius:3px;overflow:hidden;border:1.5px solid var(--br);aspect-ratio:4/3;background:var(--s3);">
      <img src="${p.data}" style="width:100%;height:100%;object-fit:cover;">
      <div style="position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;opacity:0;transition:.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">
        <button onclick="dtPhotos.splice(${i},1);dtRenderPhotos()" style="background:var(--danger);color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:.68rem;">✕</button>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.7);font-size:.55rem;color:rgba(255,255,255,.8);padding:2px 5px;text-align:center;">${p.labelText}</div>
    </div>`).join('');
}
function dtCloseCam(){
  if(dtStream){dtStream.getTracks().forEach(t=>t.stop());dtStream=null;}
  const vid=document.getElementById('dt-cam-video');vid.style.display='none';vid.srcObject=null;
  document.getElementById('dt-cam-open').style.display='';
  document.getElementById('dt-cam-active').style.display='none';
}
function saveDT(){
  const condSelVal = document.getElementById('dt-conductor-sel')?.value || '';
  const condId = condSelVal;  // may be 'emp:xxx' or 'cond:xxx'
  let condNombre = '';
  if (condSelVal.startsWith('emp:')) {
    const empId = condSelVal.replace('emp:','');
    condNombre = (DB.empleados||[]).find(e=>e.id===empId)?.nombre || '';
  } else if (condSelVal.startsWith('cond:')) {
    const cId = condSelVal.replace('cond:','');
    condNombre = (DB.conductores||[]).find(c=>c.id===cId)?.nombre || '';
  }
  const cliId=document.getElementById('dt-cliente-sel')?.value;
  if(!v('dt-fecha')||!v('dt-placa')){toast('⚠ Complete fecha y placa',true);return;}
  if(!condId){toast('⚠ Seleccione un conductor',true);return;}
  const cond = condSelVal.startsWith('cond:')
    ? DB.conductores.find(c=>c.id===condSelVal.replace('cond:',''))
    : (DB.empleados||[]).find(e=>e.id===condSelVal.replace('emp:',''));
  const cli=DB.clientes.find(c=>c.id===cliId);
  const checks=DT_ITEMS.map((_,i)=>{const r=document.querySelector(`input[name="dt_${i}"]:checked`);return r?r.value:'';});
  const obsItems=DT_ITEMS.map((_,i)=>document.getElementById(`dt_obs_${i}`)?.value||'');
  const ok=checks.filter(c=>c==='si').length;
  const pct=Math.round(ok/DT_ITEMS.length*100);
  dtCloseCam();
  DB.dt.unshift({
    id:uid(),ts:now(),fecha:v('dt-fecha'),hora:v('dt-hora'),placa:v('dt-placa'),
    conductorId:condId,conductorNombre:cond?.nombre||'',conductorLic:cond?.lic||'',
    clienteId:cliId||'',clienteNombre:cli?.nombre||'Sin destino',clienteDir:cli?[cli.dir,cli.muni].filter(Boolean).join(', '):'',
    carga:v('dt-carga'),temp:v('dt-temp'),
    checks,obsItems,ok,total:DT_ITEMS.length,pct,
    obsGen:v('dt-obs'),accion:v('dt-accion'),autorizado:v('dt-autorizado'),
    photos:[...dtPhotos]
  });
  dtPhotos=[];dtRenderPhotos();
  save();renderDT();toast(`✓ Inspección guardada — ${pct}% cumplimiento`);
}
function renderDT(){
  const tb=document.getElementById('dt-tbody');if(!tb)return;
  if(!DB.dt.length){tb.innerHTML=`<tr><td colspan="11"><div class="empty">Sin inspecciones</div></td></tr>`;return;}
  const AUTH={si:'<span class="chip ck">AUTORIZADO</span>',condicional:'<span class="chip cw">CONDICIONAL</span>',no:'<span class="chip cr">RECHAZADO</span>'};
  tb.innerHTML=DB.dt.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r=>{
    const pct=r.pct??Math.round((r.ok/r.total)*100);
    const c=pct>=80?'ck':pct>=60?'cw':'cr';
    return`<tr>
      <td>${r.fecha}</td><td>${r.hora||'—'}</td><td><strong>${r.placa||'—'}</strong></td>
      <td>${r.conductorNombre||r.conductor||'—'}</td>
      <td style="font-size:.7rem">${r.clienteNombre||r.ruta||'—'}</td>
      <td style="font-size:.7rem">${r.carga||'—'}</td>
      <td>${r.temp?r.temp+'°C':'—'}</td>
      <td><span class="chip ${c}">${pct}%</span></td>
      <td>${AUTH[r.autorizado]||'—'}</td>
      <td>${r.photos?.length?`<button class="btn bo bsm" style="font-size:.65rem;" onclick="dtViewPhotos('${r.id}')">📷 ${r.photos.length}</button>`:'—'}</td>
      <td><button class="btn bo bsm" onclick="del('dt','${r.id}')">✕</button></td>
    </tr>`;
  }).join('');
}
function dtViewPhotos(id){
  const rec=DB.dt.find(r=>r.id===id);if(!rec?.photos?.length)return;
  document.getElementById('dt-modal-title').textContent=`Fotos — ${rec.fecha} · ${rec.placa} · ${rec.conductorNombre||''}`;
  document.getElementById('dt-modal-photos').innerHTML=rec.photos.map(p=>`
    <div><img src="${p.data}" style="width:100%;border-radius:4px;border:1.5px solid var(--br);">
    <div style="font-size:.62rem;color:var(--muted2);text-align:center;margin-top:4px;">${p.labelText}<br>${p.ts}</div></div>`).join('');
  document.getElementById('dt-photo-modal').style.display='flex';
}

if(!DB.empleados)DB.empleados=[];


function editEmpleado(id) {
  const e = DB.empleados.find(e => e.id === id);
  if (!e) return;
  document.getElementById('emp-edit-id').value = e.id;
  document.getElementById('emp-nombre').value  = e.nombre || '';
  document.getElementById('emp-dpi').value     = e.dpi    || '';
  document.getElementById('emp-tel').value     = e.tel    || '';
  document.getElementById('emp-cargo').value   = e.cargo  || '';
  document.getElementById('emp-estado').value  = e.estado || 'activo';
  const ALL_ROLES = ['piloto','operaciones','maquila','resp-limpieza','calidad','supervisor','admin','ventas'];
  ALL_ROLES.forEach(r => {
    const cb = document.getElementById('rol-'+r);
    if (cb) cb.checked = (e.roles||[]).includes(r);
  });
  const ct = document.querySelector('#sec-empleados-db .card .ct');
  if (ct) ct.textContent = '✏️ Editando: ' + e.nombre;
  const cb = document.getElementById('emp-cancel-btn');
  if (cb) cb.style.display = '';
  const sb = document.getElementById('emp-save-btn');
  if (sb) sb.textContent = '💾 Guardar Cambios';
  // Populate licencia fields if piloto
  const isPiloto = (e.roles||[]).includes('piloto');
  toggleLicFields(isPiloto);
  const licNum  = document.getElementById('emp-lic-num');
  const licTipo = document.getElementById('emp-lic-tipo');
  const licVenc = document.getElementById('emp-lic-venc');
  if (licNum)  licNum.value  = e.lic_num  || '';
  if (licTipo) licTipo.value = e.lic_tipo || '';
  if (licVenc) licVenc.value = e.lic_venc || '';
  document.getElementById('sec-empleados-db').scrollIntoView({behavior:'smooth'});
}

function cancelEditEmpleado() {
  document.getElementById('emp-edit-id').value = '';
  document.getElementById('emp-nombre').value  = '';
  document.getElementById('emp-dpi').value     = '';
  document.getElementById('emp-tel').value     = '';
  document.getElementById('emp-cargo').value   = '';
  document.getElementById('emp-estado').value  = 'activo';
  const ALL_ROLES = ['piloto','operaciones','maquila','resp-limpieza','calidad','supervisor','admin','ventas'];
  ALL_ROLES.forEach(r => { const cb = document.getElementById('rol-'+r); if (cb) cb.checked = false; });
  const ct = document.querySelector('#sec-empleados-db .card .ct');
  if (ct) ct.textContent = 'Agregar Empleado';
  const cb = document.getElementById('emp-cancel-btn');
  if (cb) cb.style.display = 'none';
  const sb = document.getElementById('emp-save-btn');
  if (sb) sb.textContent = '➕ Agregar Empleado';
}

function deleteEmpleado(id) {
  const e = DB.empleados.find(e => e.id === id);
  if (!e) return;
  if (!confirm('¿Eliminar a ' + e.nombre + '?')) return;
  DB.empleados = DB.empleados.filter(x => x.id !== id);
  save();
  renderEmpleados();
  toast('✓ Empleado eliminado');
}

function empExportCSV() {
  if (!DB.empleados.length) { toast('No hay empleados para exportar', true); return; }
  const ROL_LBL = {'piloto':'Piloto','operaciones':'Operaciones','maquila':'Maquila',
    'resp-limpieza':'Limpieza','calidad':'Calidad','supervisor':'Supervisor','admin':'Admin','ventas':'Ventas'};
  let csv = '\uFEFF' + 'Nombre,DPI,Teléfono,Cargo,Roles,Estado,Anticipo,Fecha Ingreso\n';
  DB.empleados.forEach(e => {
    const roles = (e.roles||[]).map(r => ROL_LBL[r]||r).join(' | ');
    const fecha = (e.ts||'').split('T')[0];
    csv += [e.nombre,e.dpi,e.tel,e.cargo,roles,e.estado,e.anticipo||0,fecha]
      .map(v => '"'+String(v||'').replace(/"/g,'""')+'"').join(',') + '\n';
  });
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'Empleados_AJUA_'+new Date().toISOString().split('T')[0]+'.csv'});
  a.click();
  toast('✅ Listado descargado');
}

function saveEmpleado(){
  const nombre = document.getElementById('emp-nombre')?.value.trim();
  if (!nombre) { toast('⚠ El nombre es obligatorio', true); return; }

  const ALL_ROLES = ['piloto','operaciones','maquila','resp-limpieza','calidad','supervisor','admin','ventas'];
  const roles = ALL_ROLES.filter(r => document.getElementById('rol-'+r)?.checked);

  const empData = {
    nombre,
    dpi:      document.getElementById('emp-dpi')?.value.trim()      || '',
    tel:      document.getElementById('emp-tel')?.value.trim()      || '',
    cargo:    document.getElementById('emp-cargo')?.value.trim()    || '',
    lic_num:  document.getElementById('emp-lic-num')?.value.trim()  || '',
    lic_tipo: document.getElementById('emp-lic-tipo')?.value        || '',
    lic_venc: document.getElementById('emp-lic-venc')?.value        || '',
    roles,
    estado:   document.getElementById('emp-estado')?.value         || 'activo',
  };

  const editId = document.getElementById('emp-edit-id')?.value;
  if (editId) {
    const idx2 = DB.empleados.findIndex(e => e.id === editId);
    if (idx2 >= 0) Object.assign(DB.empleados[idx2], empData);
    toast('✓ Empleado "' + nombre + '" actualizado');
  } else {
    DB.empleados.push({ id: uid(), ts: now(), ...empData });
    toast('✓ Empleado "' + nombre + '" agregado');
  }

  // Reset form
  ['emp-nombre','emp-dpi','emp-tel','emp-cargo','emp-lic-num','emp-lic-venc'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
  const licTipo = document.getElementById('emp-lic-tipo'); if (licTipo) licTipo.value = '';
  ALL_ROLES.forEach(r => { const cb = document.getElementById('rol-'+r); if (cb) cb.checked = false; });
  const editIdEl = document.getElementById('emp-edit-id'); if (editIdEl) editIdEl.value = '';
  const cancelBtn = document.getElementById('emp-cancel-btn'); if (cancelBtn) cancelBtn.style.display = 'none';
  const saveBtn = document.getElementById('emp-save-btn'); if (saveBtn) saveBtn.textContent = '➕ Agregar Empleado';
  toggleLicFields(false);

  save();
  renderEmpleados();
  populateAllRespSelects();
  capBuildAsistentesList();
  eePopulateSelect();
  alBuildEmpTable();
}

function empByRol(rol) {
  return (DB.empleados || []).filter(e => e.estado === 'activo' && (e.roles||[]).includes(rol));
}

function renderEmpleados(){
  const tb = document.getElementById('emp-tbody'); if (!tb) return;
  const count = document.getElementById('emp-count');
  const activos = DB.empleados.filter(e => e.estado === 'activo').length;
  if (count) count.textContent = DB.empleados.length + ' total · ' + activos + ' activos';

  if (!DB.empleados.length) {
    tb.innerHTML = '<tr><td colspan="6"><div class="empty">Sin empleados registrados — agrega el primero arriba</div></td></tr>';
    return;
  }

  const ROL_LBL = {
    'piloto':'🚛 Piloto', 'operaciones':'📦 Operaciones', 'maquila':'⚙️ Maquila',
    'resp-limpieza':'🧹 Limpieza', 'calidad':'🔍 Calidad',
    'supervisor':'👷 Supervisor', 'admin':'🏢 Admin', 'ventas':'💰 Ventas',
  };

  tb.innerHTML = DB.empleados.map(e => {
    const missingDpi = !e.dpi;
    const rolesHtml = (e.roles||[]).length
      ? (e.roles||[]).map(r => '<span class="chip cb" style="font-size:.58rem;margin:1px;">' + (ROL_LBL[r]||r) + '</span>').join(' ')
      : '<span style="font-size:.68rem;color:var(--muted2);">' + (e.cargo||'Sin rol asignado') + '</span>';
    const dpiHtml = missingDpi
      ? '<span style="color:#e07b00;font-weight:700;">⚠ Sin DPI</span>'
      : '<span style="font-size:.7rem;">' + e.dpi + '</span>';
    return '<tr style="' + (missingDpi ? 'background:rgba(255,165,0,.06);' : '') + '">' +
      '<td style="font-weight:600;">' + e.nombre + '</td>' +
      '<td>' + dpiHtml + '<span style="font-size:.68rem;color:var(--muted2);margin-left:6px;">' + (e.tel||'—') + '</span></td>' +
      '<td style="line-height:1.8;">' + rolesHtml + '</td>' +
      '<td>' + (e.cargo||'—') + '</td>' +
      '<td><span class="chip ' + (e.estado==='activo'?'ck':'cr') + '" style="font-size:.6rem;">' + (e.estado==='activo'?'ACTIVO':'INACTIVO') + '</span></td>' +
      '<td style="white-space:nowrap;">' +
        '<button class="btn bo bsm" onclick="editEmpleado(\'' + e.id + '\')" style="font-size:.65rem;margin-right:4px;">✏️ Editar</button> ' +
        '<button class="btn bsm" onclick="deleteEmpleado(\'' + e.id + '\')" style="background:#d63030;color:#fff;font-size:.65rem;">🗑</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

function delEmpleado(id){
  DB.empleados=DB.empleados.filter(e=>e.id!==id);
  save();renderEmpleados();populateAllRespSelects();capBuildAsistentesList();eePopulateSelect();alBuildEmpTable();toast('Empleado eliminado');
}

function populateAllRespSelects(){
  const activos = (DB.empleados||[]).filter(e=>e.estado==='activo').sort((a,b)=>a.nombre.localeCompare(b.nombre));
  const optsAll = '<option value="">— Seleccionar responsable —</option>' +
    activos.map(e => '<option value="' + e.nombre + '">' + e.nombre + (e.cargo?' · '+e.cargo:'') + '</option>').join('');

  const respLimp = empByRol('resp-limpieza').concat(empByRol('supervisor')).concat(empByRol('operaciones'));
  const respLimpDedupe = respLimp.filter((e,i,a) => a.findIndex(x=>(x.id&&x.id===e.id)||(x.nombre===e.nombre))===i);
  const optsLimp = '<option value="">— Seleccionar responsable —</option>' +
    (respLimpDedupe.length ? respLimpDedupe : activos).map(e =>
      '<option value="' + e.nombre + '">' + e.nombre + (e.cargo?' · '+e.cargo:'') + '</option>'
    ).join('');

  const pilotos = empByRol('piloto');
  const optsPiloto = '<option value="">— Seleccionar piloto —</option>' +
    (pilotos.length ? pilotos : activos).map(e =>
      '<option value="' + e.nombre + '">' + e.nombre + (e.cargo?' · '+e.cargo:'') + '</option>'
    ).join('');

  ['bl-resp','fum-resp-sel','rod-resp-sel','vp-resp-sel','bas-resp-sel','lp-resp-sel'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){const cur=el.value;el.innerHTML=optsAll;el.value=cur;}
  });

  const tlResp = document.getElementById('tl-resp-sel');
  if (tlResp) { const cur=tlResp.value; tlResp.innerHTML=optsLimp; tlResp.value=cur; }

  const dtCond = document.getElementById('dt-conductor-sel');
  if (dtCond) {
    const cur = dtCond.value;
    const legacyConds = (DB.conductores||[]).map(c =>
      '<option value="cond:' + c.id + '">' + c.nombre + ' · ' + c.lic + '</option>'
    ).join('');
    const empPilotos = (pilotos.length ? pilotos : []).map(e =>
      '<option value="emp:' + e.id + '">' + e.nombre + (e.cargo?' · '+e.cargo:'') + '</option>'
    ).join('');
    dtCond.innerHTML = '<option value="">— Seleccionar piloto/conductor —</option>' + empPilotos + (legacyConds ? '<optgroup label="Registros legacy">' + legacyConds + '</optgroup>' : '');
    dtCond.value = cur;
  }
}

const BL_ITEMS=[
  {cat:'Piso 1',item:'Limpieza de Mesas'},
  {cat:'Piso 1',item:'Limpieza Balanzas'},
  {cat:'Piso 1',item:'Barrido'},
  {cat:'Piso 1',item:'Trapeado'},
  {cat:'Piso 2',item:'Baño'},
  {cat:'Piso 2',item:'Limpieza General'},
  {cat:'Piso 2',item:'Revisión Trampas'},
  {cat:'Piso 2',item:'Secador de manos'},
  {cat:'Kit de Desinfección',item:'Jabón para manos'},
  {cat:'Kit de Desinfección',item:'Desinfectante en gel'},
  {cat:'Kit de Desinfección',item:'Escobas, Trapeador'},
  {cat:'Kit de Desinfección',item:'Bolsas de basura'},
  {cat:'Kit de Desinfección',item:'Papel de Baño'},
  {cat:'Bioseguridad',item:'Tapabocas'},
  {cat:'Bioseguridad',item:'Red de cabello'},
  {cat:'Bioseguridad',item:'Guantes'},
];
function buildBLChecklist(){
  const tb=document.getElementById('bl-checklist');
  if(!tb||tb.dataset.built)return;
  tb.dataset.built='1';
  tb.className='cl-list';
  tb.removeAttribute('style');
  let lastCat='';
  BL_ITEMS.forEach((x,i)=>{
    if(x.cat!==lastCat){
      lastCat=x.cat;
      tb.insertAdjacentHTML('beforeend',`<div class="cl-cat-header">${x.cat}</div>`);
    }
    tb.insertAdjacentHTML('beforeend',`
    <div class="cl-item" id="bl-ci-${i}">
      <div class="cl-item-txt">
        <div class="cl-item-cat">${x.cat}</div>
        <div class="cl-item-name">${x.item}</div>
      </div>
      <div class="cl-btns">
        <button class="cl-btn" onclick="clBtn(this,'bl_${i}','si','bl-ci-${i}')">SI</button>
        <button class="cl-btn" onclick="clBtn(this,'bl_${i}','no','bl-ci-${i}')">NO</button>
        <button class="cl-btn" onclick="clBtn(this,'bl_${i}','na','bl-ci-${i}')">N/A</button>
      </div>
    </div>`);
  });
}
function saveBL(){
  if(!v('bl-fecha')||!v('bl-resp')){toast('⚠ Complete fecha y seleccione responsable',true);return;}
  const checks=BL_ITEMS.map((_,i)=>{const r=document.querySelector(`input[name="bl_${i}"]:checked`);return r?r.value:'';});
  const si=checks.filter(c=>c==='si').length;
  const no=checks.filter(c=>c==='no').length;
  const na=checks.filter(c=>c==='na').length;
  DB.bl.unshift({id:uid(),ts:now(),fecha:v('bl-fecha'),resp:v('bl-resp'),hora:v('bl-hora'),checks,si,no,na,obs:v('bl-obs')});
  save();renderBL();toast('✓ Registro de limpieza bodega guardado');
}
function renderBL(){
  const tb=document.getElementById('bl-tbody');if(!tb)return;
  if(!DB.bl.length){tb.innerHTML=`<tr><td colspan="8"><div class="empty">Sin registros</div></td></tr>`;return;}
  tb.innerHTML=DB.bl.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r=>`<tr>
    <td>${r.fecha}</td><td>${r.resp}</td><td>${r.hora||'—'}</td>
    <td style="color:var(--acc)">${r.si}</td>
    <td style="color:var(--danger)">${r.no}</td>
    <td style="color:var(--muted2)">${r.na}</td>
    <td style="font-size:.68rem">${r.obs||'—'}</td>
    <td><button class="btn bo bsm" onclick="del('bl','${r.id}')">✕</button></td>
  </tr>`).join('');
}

function saveFum(){
  if(!v('fum-resp-sel')){toast('⚠ Ingrese responsable',true);return;}
  DB.fum.unshift({id:uid(),ts:now(),inst:v('fum-inst'),mes:v('fum-mes'),sem:v('fum-sem'),resp:v('fum-resp-sel'),fecha:v('fum-fecha'),tipo:v('fum-tipo'),res:v('fum-res'),obs:v('fum-obs')});
  save();renderFum();toast('✓ Control de fumigación registrado');
}
function renderFum(){
  const tb=document.getElementById('fum-tbody');if(!tb)return;
  if(!DB.fum.length){tb.innerHTML=`<tr><td colspan="9"><div class="empty">Sin registros</div></td></tr>`;return;}
  tb.innerHTML=DB.fum.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r=>`<tr>
    <td>${r.inst}</td><td>${r.mes}</td><td>Sem. ${r.sem}</td><td>${r.resp}</td><td>${r.fecha||'—'}</td>
    <td>${r.tipo}</td><td>${chipSN(r.res)}</td>
    <td style="font-size:.68rem">${r.obs||'—'}</td>
    <td><button class="btn bo bsm" onclick="del('fum','${r.id}')">✕</button></td>
  </tr>`).join('');
}

const ROD_TRAMPAS = [
  { id:1, nivel:1, label:'Trampa 1', ubicacion:'Entrada Bodega N1' },
  { id:2, nivel:1, label:'Trampa 2', ubicacion:'Fondo Bodega N1' },
  { id:3, nivel:2, label:'Trampa 3', ubicacion:'Esquina A — Bodega N2' },
  { id:4, nivel:2, label:'Trampa 4', ubicacion:'Esquina B — Bodega N2' },
  { id:5, nivel:2, label:'Trampa 5', ubicacion:'Pasillo Central — Bodega N2' },
  { id:6, nivel:2, label:'Trampa 6', ubicacion:'Área de Carga — Bodega N2' },
  { id:7, nivel:2, label:'Trampa 7', ubicacion:'Salida — Bodega N2' },
];

function buildRodTrampas() {
  const n1 = document.getElementById('rod-trampas-n1');
  const n2 = document.getElementById('rod-trampas-n2');
  if (!n1 || n1.children.length > 0) return;

  ROD_TRAMPAS.forEach(t => {
    const container = t.nivel === 1 ? n1 : n2;
    const color = t.nivel === 1 ? 'var(--acc2)' : 'var(--info)';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:6px;';

    const row = document.createElement('div');
    row.id = `rod-row-${t.id}`;
    row.style.cssText = `display:grid;grid-template-columns:auto 1fr auto auto auto;align-items:center;gap:8px;padding:10px 12px;background:var(--s2);border-radius:6px;border:1.5px solid transparent;transition:all .15s;`;

    // Label elements with IDs for rodUpdate()
    const lbl_rev   = `rod-lbl-rev-${t.id}`;
    const lbl_lugar = `rod-lbl-lugar-${t.id}`;
    const lbl_nov   = `rod-lbl-nov-${t.id}`;

    row.innerHTML = `
      <div style="width:26px;height:26px;border-radius:4px;background:${color}1a;border:1.5px solid ${color}44;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;color:${color};flex-shrink:0;">${t.id}</div>
      <div>
        <div style="font-size:.78rem;font-weight:600;color:var(--txt);">${t.label}</div>
        <div style="font-size:.62rem;color:var(--muted2);">${t.ubicacion}</div>
      </div>
      <label id="${lbl_rev}" style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;font-size:.62rem;color:var(--muted2);padding:6px 8px;border-radius:6px;border:1.5px solid var(--br);transition:all .12s;min-width:64px;text-align:center;">
        <input type="checkbox" id="rod-rev-${t.id}" style="accent-color:var(--acc);width:15px;height:15px;" onchange="rodUpdate(${t.id})"> ✓ Revisada
      </label>
      <label id="${lbl_lugar}" style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;font-size:.62rem;color:var(--muted2);padding:6px 8px;border-radius:6px;border:1.5px solid var(--br);transition:all .12s;min-width:64px;text-align:center;">
        <input type="checkbox" id="rod-lugar-${t.id}" style="accent-color:var(--acc2);width:15px;height:15px;" onchange="rodUpdate(${t.id})"> 📍 En lugar
      </label>
      <label id="${lbl_nov}" style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;font-size:.62rem;color:var(--danger);padding:6px 8px;border-radius:6px;border:1.5px solid var(--br);transition:all .12s;min-width:64px;text-align:center;">
        <input type="checkbox" id="rod-nov-${t.id}" style="accent-color:var(--danger);width:15px;height:15px;" onchange="rodUpdate(${t.id})"> ⚠ Novedad
      </label>`;

    // Novedad textarea (hidden by default)
    const notaDiv = document.createElement('div');
    notaDiv.id = `rod-nota-wrap-${t.id}`;
    notaDiv.style.cssText = 'display:none;padding:6px 10px 8px 40px;';
    notaDiv.innerHTML = `
      <textarea id="rod-nota-${t.id}" rows="2" placeholder="Describe la novedad encontrada en ${t.label}..."
        style="width:100%;background:rgba(214,48,48,.05);border:1.5px solid rgba(214,48,48,.3);
               border-radius:4px;padding:7px 10px;font-size:.78rem;font-family:var(--fm);
               color:var(--txt);resize:vertical;"></textarea>`;

    wrap.appendChild(row);
    wrap.appendChild(notaDiv);
    container.appendChild(wrap);
  });
}

function rodUpdate(id) {
  const rev   = document.getElementById(`rod-rev-${id}`)?.checked;
  const lugar = document.getElementById(`rod-lugar-${id}`)?.checked;
  const nov   = document.getElementById(`rod-nov-${id}`)?.checked;
  const notaWrap = document.getElementById(`rod-nota-wrap-${id}`);
  const row   = document.getElementById(`rod-row-${id}`);

  if (notaWrap) notaWrap.style.display = nov ? 'block' : 'none';

  if (!rev) {
    row.style.borderColor = 'transparent';
    row.style.background = 'var(--s2)';
  } else if (nov) {
    row.style.borderColor = 'rgba(245,197,24,.4)';
    row.style.background = 'rgba(245,197,24,.04)';
  } else if (rev && lugar) {
    row.style.borderColor = 'rgba(0,217,139,.3)';
    row.style.background = 'rgba(0,217,139,.04)';
  } else {
    row.style.borderColor = 'rgba(74,158,255,.3)';
    row.style.background = 'rgba(74,158,255,.04)';
  }

  const lblRev   = document.getElementById(`rod-lbl-rev-${id}`);
  const lblLugar = document.getElementById(`rod-lbl-lugar-${id}`);
  const lblNov   = document.getElementById(`rod-lbl-nov-${id}`);
  lblRev.style.borderColor   = rev   ? 'var(--acc)'  : 'var(--br)';
  lblRev.style.color         = rev   ? 'var(--acc)'  : '';
  lblLugar.style.borderColor = lugar ? 'var(--acc)'  : 'var(--br)';
  lblLugar.style.color       = lugar ? 'var(--acc)'  : '';
  lblNov.style.borderColor   = nov   ? 'var(--warn)' : 'var(--br)';
  lblNov.style.color         = nov   ? 'var(--warn)' : '';

  rodActualizarResumen();
}

function rodActualizarResumen() {
  const total = ROD_TRAMPAS.length;
  let rev = 0, lugar = 0, nov = 0;
  ROD_TRAMPAS.forEach(t => {
    if (document.getElementById(`rod-rev-${t.id}`)?.checked)   rev++;
    if (document.getElementById(`rod-lugar-${t.id}`)?.checked) lugar++;
    if (document.getElementById(`rod-nov-${t.id}`)?.checked)   nov++;
  });
  document.getElementById('rod-resumen').style.display = rev > 0 ? 'block' : 'none';
  document.getElementById('rod-cnt-rev').textContent   = rev;
  document.getElementById('rod-cnt-lugar').textContent = lugar;
  document.getElementById('rod-cnt-nov').textContent   = nov;
  document.getElementById('rod-cnt-falt').textContent  = total - rev;
}

function saveRod() {
  const resp = document.getElementById('rod-resp-sel')?.value;
  const fecha = v('rod-fecha');
  if (!fecha || !resp) { toast('⚠ Complete fecha y responsable', true); return; }

  const trampas = ROD_TRAMPAS.map(t => ({
    id:    t.id,
    nivel: t.nivel,
    label: t.label,
    ubicacion: t.ubicacion,
    revisada: document.getElementById(`rod-rev-${t.id}`)?.checked || false,
    enLugar:  document.getElementById(`rod-lugar-${t.id}`)?.checked || false,
    novedad:  document.getElementById(`rod-nov-${t.id}`)?.checked || false,
    nota:     document.getElementById(`rod-nota-${t.id}`)?.value || '',
  }));

  const totalRev   = trampas.filter(t => t.revisada).length;
  const totalLugar = trampas.filter(t => t.enLugar).length;
  const totalNov   = trampas.filter(t => t.novedad).length;
  const resultado  = totalNov > 0 ? 'alerta' : totalRev === ROD_TRAMPAS.length ? 'ok' : 'parcial';

  DB.rod.unshift({
    id: uid(), ts: now(), fecha, hora: v('rod-hora'), resp,
    trampas, totalRev, totalLugar, totalNov,
    total: ROD_TRAMPAS.length, resultado, obs: v('rod-obs'),
  });

  ROD_TRAMPAS.forEach(t => {
    ['rev','lugar','nov'].forEach(k => {
      const el = document.getElementById(`rod-${k}-${t.id}`);
      if (el) el.checked = false;
    });
    const nota = document.getElementById(`rod-nota-${t.id}`);
    if (nota) nota.value = '';
    const notaWrap = document.getElementById(`rod-nota-wrap-${t.id}`);
    if (notaWrap) notaWrap.style.display = 'none';
    rodUpdate(t.id);
  });
  document.getElementById('rod-obs').value = '';
  document.getElementById('rod-resumen').style.display = 'none';

  save(); renderRod(); toast('✓ Revisión de trampas guardada');
}

function renderRod() {
  const tb = document.getElementById('rod-tbody'); if (!tb) return;
  if (!DB.rod.length) { tb.innerHTML = `<tr><td colspan="9"><div class="empty">Sin revisiones registradas</div></td></tr>`; return; }
  const RES = {
    ok:      '<span class="chip ck">✓ OK</span>',
    alerta:  '<span class="chip cw">⚠ ALERTA</span>',
    parcial: '<span class="chip cb">PARCIAL</span>',
  };
  tb.innerHTML = DB.rod.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r => `<tr>
    <td>${r.fecha}</td>
    <td>${r.hora || '—'}</td>
    <td>${r.resp}</td>
    <td style="color:var(--acc);font-weight:600;">${r.totalRev ?? '—'} / ${r.total ?? 7}</td>
    <td style="color:var(--acc);">${r.totalLugar ?? '—'}</td>
    <td style="color:var(--warn);">${r.totalNov ?? 0}</td>
    <td>${RES[r.resultado] || RES[r.res] || '—'}</td>
    <td style="font-size:.68rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.obs || '—'}</td>
    <td><button class="btn bo bsm" onclick="del('rod','${r.id}')">✕</button></td>
  </tr>`).join('');
}

let capExternosCount = 0;

function capBuildAsistentesList() {
  const tbody = document.getElementById('cap-asistentes-tbody');
  const noEmp = document.getElementById('cap-no-empleados');
  if (!tbody) return;
  const activos = (DB.empleados || []).filter(e => e.estado === 'activo')
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (!activos.length) {
    tbody.innerHTML = '';
    if (noEmp) noEmp.style.display = 'block';
    return;
  }
  if (noEmp) noEmp.style.display = 'none';
  tbody.innerHTML = activos.map(e => `
    <tr id="cap-emp-row-${e.id}" style="transition:.12s;" onclick="capToggleEmp('${e.id}')" style="cursor:pointer;">
      <td style="padding:8px 10px;text-align:center;border-bottom:1px solid rgba(34,42,48,.8);">
        <input type="checkbox" id="cap-chk-${e.id}" style="accent-color:var(--acc);width:14px;height:14px;" onchange="capUpdateCount()">
      </td>
      <td style="padding:8px 10px;font-size:.78rem;font-weight:500;border-bottom:1px solid rgba(34,42,48,.8);">${e.nombre}</td>
      <td style="padding:8px 10px;font-size:.72rem;color:var(--muted2);border-bottom:1px solid rgba(34,42,48,.8);">${e.dpi || '—'}</td>
      <td style="padding:8px 10px;font-size:.72rem;border-bottom:1px solid rgba(34,42,48,.8);">${e.cargo || '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(34,42,48,.8);"><span class="chip cb" style="font-size:.58rem;">${e.area || '—'}</span></td>
    </tr>`).join('');
  capUpdateCount();
}

function capToggleEmp(id) {
  const chk = document.getElementById(`cap-chk-${id}`);
  if (chk) { chk.checked = !chk.checked; capUpdateCount(); }
}

function capUpdateCount() {
  const checks = document.querySelectorAll('#cap-asistentes-tbody input[type=checkbox]:checked');
  const badge = document.getElementById('cap-count-badge');
  const total = checks.length + capExternosCount;
  if (badge) {
    badge.textContent = `${total} seleccionado${total !== 1 ? 's' : ''}`;
    badge.className = total > 0 ? 'chip ck' : 'chip cb';
  }
  document.querySelectorAll('#cap-asistentes-tbody tr').forEach(row => {
    const chk = row.querySelector('input[type=checkbox]');
    row.style.background = chk?.checked ? 'rgba(0,217,139,.05)' : '';
  });
  const all = document.querySelectorAll('#cap-asistentes-tbody input[type=checkbox]');
  const allChk = document.getElementById('cap-chk-all');
  if (allChk && all.length) allChk.checked = all.length === checks.length;
}

function capSelAll(val) {
  document.querySelectorAll('#cap-asistentes-tbody input[type=checkbox]')
    .forEach(c => { c.checked = val; });
  const allChk = document.getElementById('cap-chk-all');
  if (allChk) allChk.checked = val;
  capUpdateCount();
}

function capAddExterno() {
  capExternosCount++;
  const list = document.getElementById('cap-externos-list');
  const div = document.createElement('div');
  div.id = `cap-ext-${capExternosCount}`;
  div.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-bottom:6px;align-items:end;';
  div.innerHTML = `
    <div class="fg"><label>Nombre</label><input id="cap-ext-n${capExternosCount}" placeholder="Nombre completo"></div>
    <div class="fg"><label>DPI</label><input id="cap-ext-d${capExternosCount}" placeholder="No. DPI"></div>
    <div class="fg"><label>Cargo / Área</label><input id="cap-ext-a${capExternosCount}" placeholder="Cargo o área"></div>
    <button onclick="document.getElementById('cap-ext-${capExternosCount}').remove();capExternosCount--;capUpdateCount();" style="background:var(--danger);color:#fff;border:none;padding:7px 10px;border-radius:3px;cursor:pointer;font-size:.8rem;margin-bottom:0;height:34px;">✕</button>`;
  list.appendChild(div);
  capUpdateCount();
}

function saveCap() {
  if (!v('cap-fecha') || !v('cap-prof')) { toast('⚠ Complete fecha e instructor', true); return; }

  const asistentes = [];
  const activos = (DB.empleados || []).filter(e => e.estado === 'activo');
  activos.forEach(e => {
    const chk = document.getElementById(`cap-chk-${e.id}`);
    if (chk?.checked) asistentes.push({ nombre: e.nombre, dpi: e.dpi || '', cargo: e.cargo || '', area: e.area || '', externo: false });
  });

  for (let i = 1; i <= capExternosCount + 10; i++) {
    const n = document.getElementById(`cap-ext-n${i}`);
    if (!n) continue;
    if (n.value.trim()) asistentes.push({
      nombre: n.value.trim(),
      dpi: document.getElementById(`cap-ext-d${i}`)?.value || '',
      cargo: document.getElementById(`cap-ext-a${i}`)?.value || '',
      area: 'Externo',
      externo: true,
    });
  }

  if (!asistentes.length) { toast('⚠ Seleccione al menos un asistente', true); return; }

  DB.cap.unshift({
    id: uid(), ts: now(),
    fecha: v('cap-fecha'), hi: v('cap-hi'), ht: v('cap-ht'), dur: v('cap-dur'),
    prof: v('cap-prof'), cargo: v('cap-cargo'), lugar: v('cap-lugar'),
    tipo: v('cap-tipo'), temas: v('cap-temas'), obs: v('cap-obs'),
    asistentes,
  });

  capSelAll(false);
  document.getElementById('cap-externos-list').innerHTML = '';
  capExternosCount = 0;
  capUpdateCount();

  save(); renderCap(); toast(`✓ Capacitación guardada — ${asistentes.length} asistentes`);
}

function renderCap() {
  const tb = document.getElementById('cap-tbody'); if (!tb) return;
  if (!DB.cap.length) { tb.innerHTML = `<tr><td colspan="8"><div class="empty">Sin capacitaciones registradas</div></td></tr>`; return; }
  tb.innerHTML = DB.cap.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r => `<tr>
    <td>${r.fecha}</td>
    <td>${r.prof}</td>
    <td><span class="chip cb" style="font-size:.6rem;">${r.tipo || '—'}</span></td>
    <td style="font-size:.7rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.temas || '—'}</td>
    <td>${r.lugar || '—'}</td>
    <td><span class="chip ck">${r.asistentes?.length || 0} personas</span></td>
    <td>
      <button class="btn bo bsm" style="font-size:.65rem;border-color:var(--acc);color:var(--acc);" onclick="capExportExcel('${r.id}')">📊 Excel</button>
    </td>
    <td><button class="btn bo bsm" onclick="del('cap','${r.id}')">✕</button></td>
  </tr>`).join('');
}

function capExportExcel(id) {
  const rec = DB.cap.find(r => r.id === id);
  if (!rec) return;

  const empresa = 'AGROINDUSTRIA AJÚA';
  const titulo = `REGISTRO DE ${rec.tipo || 'CAPACITACIÓN'}`;

  const header = [
    [`${empresa}`],
    [`${titulo}`],
    [`Fecha: ${rec.fecha}`, `Hora inicio: ${rec.hi || ''}`, `Hora término: ${rec.ht || ''}`, `Duración: ${rec.dur ? rec.dur + ' min' : ''}`],
    [`Instructor: ${rec.prof}`, `Cargo: ${rec.cargo || ''}`, `Lugar: ${rec.lugar || ''}`],
    [`Temas: ${rec.temas || ''}`],
    [],
    ['No.', 'Nombre Completo', 'DPI', 'Cargo / Puesto', 'Área', 'Firma'],
    ...rec.asistentes.map((a, i) => [i + 1, a.nombre, a.dpi || '', a.cargo || '', a.area || '', '']),
    [],
    [`Total asistentes: ${rec.asistentes.length}`],
    [],
    ['Observaciones:', rec.obs || ''],
  ];

  const csv = header.map(row =>
    row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Capacitacion_AJUA_${rec.fecha}_${(rec.tipo || 'registro').replace(/\s+/g, '_')}.csv`;
  a.click();
  toast('📊 Excel generado');
}

function eePopulateSelect() {
  const sel = document.getElementById('ee-nombre');
  if (!sel) return;
  const cur = sel.value;
  const activos = (DB.empleados || [])
    .filter(e => e.estado === 'activo')
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  sel.innerHTML = '<option value="">— Seleccionar empleado —</option>' +
    activos.map(e => `<option value="${e.id}">${e.nombre}${e.cargo ? ' · ' + e.cargo : ''}</option>`).join('');
  sel.value = cur;
}
function eeSelectEmpleado(id) {
  const emp = (DB.empleados || []).find(e => e.id === id);
  const dptoEl = document.getElementById('ee-dpto');
  if (dptoEl) dptoEl.value = emp ? (emp.area || emp.cargo || '—') : '';
}
function saveEE() {
  const empId = document.getElementById('ee-nombre')?.value;
  const emp = (DB.empleados || []).find(e => e.id === empId);
  if (!empId || !v('ee-fecha')) { toast('⚠ Seleccione empleado y fecha', true); return; }
  DB.ee.unshift({
    id: uid(), ts: now(),
    fecha: v('ee-fecha'),
    empleadoId: empId,
    nombre: emp?.nombre || empId,
    dpto: emp?.area || emp?.cargo || '',
    diag: v('ee-diag'), ini: v('ee-ini'), fin: v('ee-fin'),
    dias: v('ee-dias'), estado: v('ee-estado'), obs: v('ee-obs'),
  });
  save(); renderEE(); toast('✓ Empleado enfermo registrado');
}
function renderEE() {
  const tb = document.getElementById('ee-tbody'); if (!tb) return;
  if (!DB.ee.length) { tb.innerHTML = `<tr><td colspan="9"><div class="empty">Sin registros</div></td></tr>`; return; }
  tb.innerHTML = DB.ee.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r => `<tr>
    <td>${r.fecha}</td><td>${r.nombre}</td><td>${r.dpto || '—'}</td>
    <td>${r.diag || '—'}</td><td>${r.ini || '—'}</td><td>${r.fin || '—'}</td>
    <td><strong ${r.dias > 3 ? 'style="color:var(--danger)"' : ''}>${r.dias || 0}</strong></td>
    <td>${chipEstado(r.estado)}</td>
    <td><button class="btn bo bsm" onclick="del('ee','${r.id}')">✕</button></td>
  </tr>`).join('');
}

const AL_LAVADOS = ['10:00','12:00','14:00','16:00'];


function alToggleEmpList() {
  const wrap  = document.getElementById('al-emp-wrap');
  const arrow = document.getElementById('al-emp-arrow');
  if (!wrap) return;
  const open = wrap.style.display === '';
  wrap.style.display = open ? 'none' : '';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
}
function alBuildEmpTable() {
  const tbody = document.getElementById('al-emp-tbody');
  const noEmp = document.getElementById('al-no-empleados');
  if (!tbody) return;
  // Activo = estado 'activo' O sin estado definido (empleados guardados antes del campo)
  const activos = (DB.empleados || [])
    .filter(e => !e.estado || e.estado === 'activo')
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (!activos.length) {
    tbody.innerHTML = '';
    if (noEmp) noEmp.style.display = 'block';
    return;
  }
  if (noEmp) noEmp.style.display = 'none';
  // Render as cards for mobile-friendly tap targets
  tbody.innerHTML = activos.map((e) => {
    return `<tr id="al-emp-row-${e.id}" style="cursor:pointer;" onclick="alToggleEmp('${e.id}')">
      <td style="padding:8px 10px;width:36px;">
        <input type="checkbox" id="al-chk-${e.id}" style="accent-color:var(--acc);width:18px;height:18px;"
          onchange="alUpdateCount()" onclick="event.stopPropagation()">
      </td>
      <td style="padding:8px 10px;font-size:.82rem;font-weight:600;">${e.nombre}</td>
      <td style="padding:8px 10px;">
        <span class="chip cb" style="font-size:.6rem;">${e.area||'—'}</span>
      </td>
    </tr>`;
  }).join('');
  alUpdateCount();
}

function alToggleEmp(id) {
  const chk = document.getElementById(`al-chk-${id}`);
  if (!chk) return;
  chk.checked = !chk.checked;
  alUpdateCount();
}

function alUpdateCount() {
  const checks = document.querySelectorAll('#al-emp-tbody input[type=checkbox][id^=al-chk-]:checked');
  const badge = document.getElementById('al-count-badge');
  if (badge) {
    badge.textContent = `${checks.length} seleccionado${checks.length !== 1 ? 's' : ''}`;
    badge.className = checks.length > 0 ? 'chip ck' : 'chip cb';
  }
  document.querySelectorAll('#al-emp-tbody tr').forEach(row => {
    const chk = row.querySelector('input[id^=al-chk-]');
    row.style.background = chk?.checked ? 'rgba(0,217,139,.05)' : '';
  });
  const all = document.querySelectorAll('#al-emp-tbody input[id^=al-chk-]');
  const allChk = document.getElementById('al-chk-all');
  if (allChk && all.length) allChk.checked = all.length === checks.length;
}

function alSelAll(val) {
  document.querySelectorAll('#al-emp-tbody input[id^=al-chk-]').forEach(c => { c.checked = val; });
  const allChk = document.getElementById('al-chk-all');
  if (allChk) allChk.checked = val;
  alUpdateCount();
}

function saveAL() {
  const fecha = v('al-fecha');
  if (!fecha) { toast('⚠ Seleccione la fecha del turno', true); return; }

  const activos = (DB.empleados || []).filter(e => e.estado === 'activo')
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const turno   = v('al-turno');
  const hi      = v('al-hi-turno');
  const hs      = v('al-hs-turno');

  const lavActivos = AL_LAVADOS.map((h, i) => ({
    hora: h,
    activo: document.getElementById(`al-fix-${i+1}`)?.checked || false,
  }));

  const empleados = [];
  activos.forEach(e => {
    const sel = document.getElementById(`al-chk-${e.id}`)?.checked;
    if (!sel) return;
    // Presencia en turno = cumplimiento de todos los lavados activos
    const lavados = AL_LAVADOS.map((h, i) => ({
      hora: h,
      activo: lavActivos[i].activo,
      cumplido: lavActivos[i].activo, // presente = cumplió todos los horarios activos
    }));
    empleados.push({
      empleadoId: e.id,
      nombre: e.nombre,
      area: e.area || '',
      lavados,
    });
  });

  if (!empleados.length) { toast('⚠ Seleccione al menos un empleado', true); return; }

  // Todos los seleccionados completaron los lavados (presencia = cumplimiento)
  const totalCompletos = empleados.length;

  DB.al.unshift({
    id: uid(), ts: now(), fecha, turno, hi, hs,
    empleados, totalEmp: empleados.length, totalCompletos,
    lavActivos,
  });

  alSelAll(false);
  save(); renderAL(); toast(`✓ Turno ${turno} guardado — ${empleados.length} empleados`);
}

function renderAL() {
  const tb = document.getElementById('al-tbody'); if (!tb) return;
  if (!DB.al.length) { tb.innerHTML = `<tr><td colspan="8"><div class="empty">Sin turnos registrados</div></td></tr>`; return; }
  tb.innerHTML = DB.al.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r => {
    if (r.empleados) {
      const pct = r.totalEmp > 0 ? Math.round(r.totalCompletos / r.totalEmp * 100) : 0;
      return `<tr>
        <td>${r.fecha}</td>
        <td><span class="chip cb">${r.turno || 'AM'}</span></td>
        <td>${r.hi || '—'}</td><td>${r.hs || '—'}</td>
        <td><span class="chip ck">${r.totalEmp} personas</span></td>
        <td><span class="chip ${pct === 100 ? 'ck' : pct >= 75 ? 'cw' : 'cr'}">${r.totalCompletos}/${r.totalEmp} · ${pct}%</span></td>
        <td><button class="btn bo bsm" style="font-size:.65rem;border-color:var(--acc);color:var(--acc);" onclick="alExportExcel('${r.id}')">📊 Excel</button></td>
        <td><button class="btn bo bsm" onclick="del('al','${r.id}')">✕</button></td>
      </tr>`;
    } else {
      return `<tr>
        <td>${r.fecha}</td><td><span class="chip cb">AM</span></td>
        <td>${r.hi || '—'}</td><td>${r.hs || '—'}</td>
        <td><span class="chip ck">1 persona</span></td>
        <td>—</td><td>—</td>
        <td><button class="btn bo bsm" onclick="del('al','${r.id}')">✕</button></td>
      </tr>`;
    }
  }).join('');
}

function alExportExcel(id) {
  const rec = DB.al.find(r => r.id === id);
  if (!rec || !rec.empleados) return;

  const lavHoras = AL_LAVADOS;
  const header = [
    ['AGROINDUSTRIA AJÚA'],
    ['CONTROL DE ACCESO Y LAVADO DE MANOS'],
    [`Fecha: ${rec.fecha}`, `Turno: ${rec.turno || 'AM'}`, `Hora ingreso: ${rec.hi || ''}`, `Hora salida: ${rec.hs || ''}`],
    [],
    ['No.', 'Nombre Completo', 'Área', 'Ingreso', 'Salida',
      `Lavado 10:00`, `Lavado 12:00`, `Lavado 14:00`, `Lavado 16:00`, 'Firma'],
    ...rec.empleados.map((e, i) => [
      i + 1,
      e.nombre,
      e.area || '',
      rec.hi || '',
      rec.hs || '',
      ...e.lavados.map(l => !l.activo ? 'N/A' : l.cumplido ? '✓' : ''),
      '', // firma
    ]),
    [],
    [`Total empleados: ${rec.totalEmp}`, `Lavados completos: ${rec.totalCompletos}`],
  ];

  const csv = header.map(row =>
    row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = `Acceso_Lavado_AJUA_${rec.fecha}_Turno${rec.turno || 'AM'}.csv`;
  a.click();
  toast('📊 Excel generado');
}

function saveVis(){
  if(!v('vis-nombre')||!v('vis-fecha')){toast('⚠ Complete nombre y fecha',true);return;}
  DB.vis.unshift({id:uid(),ts:now(),fecha:v('vis-fecha'),nombre:v('vis-nombre'),empresa:v('vis-empresa'),dpi:v('vis-dpi'),motivo:v('vis-motivo'),area:v('vis-area'),he:v('vis-he'),hs:v('vis-hs'),aut:v('vis-aut')});
  save();renderVis();toast('✓ Visita registrada');
}
function renderVis(){
  const tb=document.getElementById('vis-tbody');if(!tb)return;
  if(!DB.vis.length){tb.innerHTML=`<tr><td colspan="10"><div class="empty">Sin visitas registradas</div></td></tr>`;return;}
  tb.innerHTML=DB.vis.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r=>`<tr>
    <td>${r.fecha}</td><td>${r.nombre}</td><td>${r.empresa||'—'}</td><td>${r.dpi||'—'}</td>
    <td>${r.motivo||'—'}</td><td>${r.area||'—'}</td>
    <td>${r.he||'—'}</td><td>${r.hs||'—'}</td><td>${r.aut||'—'}</td>
    <td><button class="btn bo bsm" onclick="del('vis','${r.id}')">✕</button></td>
  </tr>`).join('');
}

const VP_ITEMS=[
  {nivel:'NIVEL 1',item:'Dispensador de jabón 1'},
  {nivel:'NIVEL 1',item:'Dispensador de Gel'},
  {nivel:'NIVEL 1',item:'Lámpara 1'},{nivel:'NIVEL 1',item:'Lámpara 2'},
  {nivel:'NIVEL 1',item:'Lámpara 3'},{nivel:'NIVEL 1',item:'Lámpara 4'},
  {nivel:'NIVEL 1',item:'Ventilador 1'},{nivel:'NIVEL 1',item:'Ventilador 2'},
  {nivel:'NIVEL 1',item:'Ventilador 3'},{nivel:'NIVEL 1',item:'Ventilador 4'},
  {nivel:'NIVEL 1',item:'Trampa para roedores 1'},{nivel:'NIVEL 1',item:'Trampa para roedores 2'},
  {nivel:'NIVEL 2',item:'Dispensador de jabón 1'},
  {nivel:'NIVEL 2',item:'Trampa para roedores 3'},{nivel:'NIVEL 2',item:'Trampa para roedores 4'},
  {nivel:'NIVEL 2',item:'Ventilador 1'},{nivel:'NIVEL 2',item:'Ventilador 2'},{nivel:'NIVEL 2',item:'Ventilador 3'},
  {nivel:'NIVEL 2',item:'Lámpara 1'},{nivel:'NIVEL 2',item:'Lámpara 2'},{nivel:'NIVEL 2',item:'Lámpara 3'},
];
function buildVPChecklist(){
  const tb=document.getElementById('vp-checklist');
  if(!tb||tb.dataset.built)return;
  tb.dataset.built='1';
  tb.className='cl-list';
  tb.removeAttribute('style');
  let lastNivel='';
  VP_ITEMS.forEach((x,i)=>{
    if(x.nivel!==lastNivel){
      lastNivel=x.nivel;
      tb.insertAdjacentHTML('beforeend',`<div class="cl-cat-header">${x.nivel}</div>`);
    }
    tb.insertAdjacentHTML('beforeend',`
    <div class="cl-item" id="vp-ci-${i}">
      <div class="cl-item-txt">
        <div class="cl-item-cat">${x.nivel}</div>
        <div class="cl-item-name">${x.item}</div>
      </div>
      <div class="cl-btns">
        <button class="cl-btn" onclick="clBtn(this,'vp_${i}','cumple','vp-ci-${i}')">✓</button>
        <button class="cl-btn" onclick="clBtn(this,'vp_${i}','mal','vp-ci-${i}')">✗</button>
        <button class="cl-btn" onclick="clBtn(this,'vp_${i}','na','vp-ci-${i}')">N/A</button>
      </div>
    </div>`);
  });
}
function saveVP(){
  if(!v('vp-fecha')||!v('vp-resp-sel')){toast('⚠ Complete fecha y responsable',true);return;}
  const checks=VP_ITEMS.map((_,i)=>{const r=document.querySelector(`input[name="vp_${i}"]:checked`);return r?r.value:'';});
  const obs=VP_ITEMS.map((_,i)=>document.getElementById(`vp_obs_${i}`)?.value||'');
  const ok=checks.filter(c=>c==='cumple').length;
  const nok=checks.filter(c=>c==='no_cumple').length;
  DB.vp.unshift({id:uid(),ts:now(),fecha:v('vp-fecha'),mes:v('vp-mes'),resp:v('vp-resp-sel'),checks,obs,ok,nok});
  save();renderVP();toast('✓ Revisión de vidrio y plástico guardada');
}
function renderVP(){
  const tb=document.getElementById('vp-tbody');if(!tb)return;
  if(!DB.vp.length){tb.innerHTML=`<tr><td colspan="7"><div class="empty">Sin revisiones</div></td></tr>`;return;}
  tb.innerHTML=DB.vp.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r=>{
    const total=r.ok+r.nok;
    const pct=total>0?Math.round(r.ok/total*100):0;
    return`<tr>
      <td>${r.fecha}</td><td>${r.mes}</td><td>${r.resp}</td>
      <td style="color:var(--acc)">${r.ok}</td>
      <td style="color:var(--danger)">${r.nok}</td>
      <td><span class="chip ${pct>=80?'ck':pct>=60?'cw':'cr'}">${pct}%</span></td>
      <td><button class="btn bo bsm" onclick="del('vp','${r.id}')">✕</button></td>
    </tr>`;
  }).join('');
}

if (!DB.calibraciones) DB.calibraciones = [];

const BAS_NOMBRES = ['Báscula 1','Báscula 2','Báscula 3','Báscula 4'];
const BAS_VARIACIONES = ['0.10','0.20','0.30','0.40','0.50'];

function basTab(name, el) {
  ['revision','calibracion'].forEach(t => {
    document.getElementById('bas-tab-'+t).style.display = t===name ? 'block' : 'none';
  });
  document.querySelectorAll('#sec-basculas .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  if (name === 'calibracion') { renderCalib(); basRenderCalCards(); }
}

function buildBasList() {
  const list = document.getElementById('bas-basculas-list');
  if (!list || list.children.length > 0) return;
  BAS_NOMBRES.forEach((nombre, i) => {
    const id = i + 1;
    const row = document.createElement('div');
    row.id = `bas-row-${id}`;
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:11px 14px;background:var(--s2);border-radius:4px;border:1.5px solid transparent;transition:all .15s;gap:12px;flex-wrap:wrap;';
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <div style="width:32px;height:32px;border-radius:4px;background:rgba(0,217,139,.12);border:1.5px solid rgba(0,217,139,.3);display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;color:var(--acc);">${id}</div>
        <div>
          <div style="font-size:.82rem;font-weight:600;">${nombre}</div>
          <div style="font-size:.64rem;color:var(--muted2);">Masa madre: 10.00 lbs</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.74rem;padding:6px 12px;border:1.5px solid var(--br);border-radius:4px;transition:.15s;" id="bas-lbl-ok-${id}">
          <input type="radio" name="bas_${id}" value="cumple" onchange="basUpdate(${id})" style="accent-color:var(--acc);"> ✓ Cumple
        </label>
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.74rem;padding:6px 12px;border:1.5px solid var(--br);border-radius:4px;transition:.15s;" id="bas-lbl-fail-${id}">
          <input type="radio" name="bas_${id}" value="no_cumple" onchange="basUpdate(${id})" style="accent-color:var(--danger);"> ✕ No cumple
        </label>
        <div id="bas-var-wrap-${id}" style="display:none;">
          <select id="bas-var-${id}" style="background:var(--s2);border:1.5px solid var(--warn);color:var(--warn);padding:6px 10px;border-radius:4px;font-family:var(--fm);font-size:.74rem;">
            <option value="">— Variación —</option>
            ${BAS_VARIACIONES.map(v => `<option value="${v}">+ ${v} lbs</option>`).join('')}
            ${BAS_VARIACIONES.map(v => `<option value="-${v}">− ${v} lbs</option>`).join('')}
          </select>
        </div>
      </div>`;
    list.appendChild(row);
  });
}

function basUpdate(id) {
  const val = document.querySelector(`input[name="bas_${id}"]:checked`)?.value;
  const row = document.getElementById(`bas-row-${id}`);
  const varWrap = document.getElementById(`bas-var-wrap-${id}`);
  const lblOk   = document.getElementById(`bas-lbl-ok-${id}`);
  const lblFail = document.getElementById(`bas-lbl-fail-${id}`);

  varWrap.style.display = val === 'no_cumple' ? 'block' : 'none';

  if (val === 'cumple') {
    row.style.background = 'rgba(0,217,139,.05)';
    row.style.borderColor = 'rgba(0,217,139,.3)';
    lblOk.style.cssText += ';border-color:var(--acc);color:var(--acc);';
    lblFail.style.cssText += ';border-color:var(--br);color:var(--txt);';
  } else if (val === 'no_cumple') {
    row.style.background = 'rgba(255,56,88,.05)';
    row.style.borderColor = 'rgba(255,56,88,.3)';
    lblFail.style.cssText += ';border-color:var(--danger);color:var(--danger);';
    lblOk.style.cssText += ';border-color:var(--br);color:var(--txt);';
  } else {
    row.style.background = 'var(--s2)';
    row.style.borderColor = 'transparent';
  }
  basUpdateResumen();
}

function basUpdateResumen() {
  let ok = 0, fail = 0, pend = 0;
  BAS_NOMBRES.forEach((_, i) => {
    const v = document.querySelector(`input[name="bas_${i+1}"]:checked`)?.value;
    if (v === 'cumple') ok++;
    else if (v === 'no_cumple') fail++;
    else pend++;
  });
  const res = document.getElementById('bas-resumen');
  res.style.display = (ok+fail) > 0 ? 'block' : 'none';
  document.getElementById('bas-cnt-ok').textContent = ok;
  document.getElementById('bas-cnt-fail').textContent = fail;
  document.getElementById('bas-cnt-pend').textContent = pend;
}

function saveBas() {
  const resp = document.getElementById('bas-resp-sel')?.value;
  const fecha = v('bas-fecha');
  if (!fecha || !resp) { toast('⚠ Complete fecha y responsable', true); return; }

  const basculas = BAS_NOMBRES.map((nombre, i) => {
    const id = i + 1;
    const resultado = document.querySelector(`input[name="bas_${id}"]:checked`)?.value || '';
    const variacion = resultado === 'no_cumple' ? (document.getElementById(`bas-var-${id}`)?.value || '') : '';
    return { id, nombre, resultado, variacion };
  });

  const ok   = basculas.filter(b => b.resultado === 'cumple').length;
  const fail = basculas.filter(b => b.resultado === 'no_cumple').length;
  const resultado = fail > 0 ? 'alerta' : ok === 4 ? 'ok' : 'parcial';

  DB.bas.unshift({
    id: uid(), ts: now(), fecha, hora: v('bas-hora'), resp, basculas, ok, fail, resultado, obs: v('bas-obs'),
  });

  BAS_NOMBRES.forEach((_, i) => {
    const id = i + 1;
    document.querySelectorAll(`input[name="bas_${id}"]`).forEach(r => r.checked = false);
    const varEl = document.getElementById(`bas-var-${id}`);
    if (varEl) varEl.value = '';
    basUpdate(id);
  });
  document.getElementById('bas-obs').value = '';
  document.getElementById('bas-resumen').style.display = 'none';

  if (fail > 0) toast(`⚠ ${fail} báscula(s) fuera de tolerancia — verificar calibración`, true);
  else toast(`✓ Revisión guardada — ${ok}/4 básculas OK`);

  save(); renderBas(); basShowCalStatus();
}

function basShowCalStatus() {
  const box = document.getElementById('bas-cal-status');
  if (!box) return;
  if (!DB.calibraciones?.length) {
    box.style.display = 'block';
    box.style.cssText += ';background:rgba(245,197,24,.08);border:1.5px solid var(--warn);color:var(--warn);';
    box.innerHTML = '⚠ No hay calibraciones registradas. <a onclick="basTab(\'calibracion\',document.querySelectorAll(\'#sec-basculas .tab\')[1])" style="cursor:pointer;text-decoration:underline;">Registrar primera calibración →</a>';
    return;
  }
  const hoy = new Date();
  const ultimas = BAS_NOMBRES.map((nombre, i) => {
    const cals = DB.calibraciones.filter(c => c.bascula == (i+1) || c.bascula === 'todas');
    if (!cals.length) return { nombre, fecha: null };
    cals.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return { nombre, ...cals[0] };
  });
  const vencidas = ultimas.filter(u => {
    if (!u.proxima) return false;
    return new Date(u.proxima) < hoy;
  });
  const proximas = ultimas.filter(u => {
    if (!u.proxima) return false;
    const diff = (new Date(u.proxima) - hoy) / (1000*60*60*24);
    return diff >= 0 && diff <= 30;
  });
  if (vencidas.length) {
    box.style.display = 'block';
    box.style.cssText = 'display:block;padding:10px 14px;border-radius:4px;margin-bottom:14px;font-size:.74rem;background:rgba(255,56,88,.08);border:1.5px solid var(--danger);color:var(--danger);';
    box.innerHTML = `⚠ Calibración vencida: ${vencidas.map(u=>u.nombre).join(', ')}`;
  } else if (proximas.length) {
    box.style.display = 'block';
    box.style.cssText = 'display:block;padding:10px 14px;border-radius:4px;margin-bottom:14px;font-size:.74rem;background:rgba(245,197,24,.08);border:1.5px solid var(--warn);color:var(--warn);';
    box.innerHTML = `⚠ Calibración próxima a vencer: ${proximas.map(u=>u.nombre).join(', ')}`;
  } else {
    box.style.display = 'none';
  }
}

function renderBas() {
  const tb = document.getElementById('bas-tbody'); if (!tb) return;
  if (!DB.bas.length) { tb.innerHTML = `<tr><td colspan="10"><div class="empty">Sin revisiones registradas</div></td></tr>`; return; }
  const RES = {
    ok:      '<span class="chip ck">✓ OK</span>',
    alerta:  '<span class="chip cr">⚠ ALERTA</span>',
    parcial: '<span class="chip cw">PARCIAL</span>',
  };
  tb.innerHTML = DB.bas.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r => {
    if (r.basculas) {
      const cols = r.basculas.map(b => {
        if (!b.resultado) return '<td>—</td>';
        if (b.resultado === 'cumple') return `<td><span class="chip ck" style="font-size:.6rem;">✓</span></td>`;
        return `<td><span class="chip cr" style="font-size:.6rem;">✕ ${b.variacion ? b.variacion+' lbs' : ''}</span></td>`;
      }).join('');
      return `<tr>
        <td>${r.fecha}</td><td>${r.hora||'—'}</td><td>${r.resp}</td>
        ${cols}
        <td>${RES[r.resultado]||'—'}</td>
        <td style="font-size:.68rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.obs||'—'}</td>
        <td><button class="btn bo bsm" onclick="del('bas','${r.id}')">✕</button></td>
      </tr>`;
    } else {
      const legacyCols = [r.b1,r.b2,r.b3,r.b4].map(val => {
        if (!val) return '<td>—</td>';
        const ok = Math.abs(parseFloat(val)-10) <= 0.10;
        return `<td><span style="color:var(--${ok?'acc':'danger'})">${parseFloat(val).toFixed(2)}</span></td>`;
      }).join('');
      return `<tr><td>${r.fecha}</td><td>—</td><td>${r.resp||'—'}</td>${legacyCols}<td>—</td><td>—</td><td><button class="btn bo bsm" onclick="del('bas','${r.id}')">✕</button></td></tr>`;
    }
  }).join('');
}

let calCertData = null, calCamStream = null;

async function calOpenCam() {
  try {
    calCamStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:960}}});
    const vid = document.getElementById('cal-cam-video');
    vid.srcObject = calCamStream; vid.style.display = 'block';
    document.getElementById('cal-cam-open-btn').style.display = 'none';
    document.getElementById('cal-cam-active').style.display = 'flex';
    toast('📷 Cámara lista');
  } catch(e) { toast('⚠ No se pudo acceder a la cámara', true); }
}
function calCapture() {
  const vid = document.getElementById('cal-cam-video');
  const can = document.getElementById('cal-cam-canvas');
  can.width = vid.videoWidth; can.height = vid.videoHeight;
  const ctx = can.getContext('2d'); ctx.drawImage(vid, 0, 0);
  const ts = new Date().toLocaleString('es-GT');
  ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0, can.height-30, can.width, 30);
  ctx.fillStyle='#00d98b'; ctx.font='bold 13px monospace';
  ctx.fillText(`AJÚA BPM · Calibración · ${ts}`, 10, can.height-8);
  calCertData = can.toDataURL('image/jpeg', .88);
  document.getElementById('cal-cert-img').src = calCertData;
  document.getElementById('cal-cert-preview').style.display = 'block';
  calCloseCam();
  toast('✓ Certificado capturado');
}
function calCloseCam() {
  if (calCamStream) { calCamStream.getTracks().forEach(t => t.stop()); calCamStream = null; }
  const vid = document.getElementById('cal-cam-video');
  vid.style.display = 'none'; vid.srcObject = null;
  document.getElementById('cal-cam-open-btn').style.display = 'block';
  document.getElementById('cal-cam-active').style.display = 'none';
}
function calDeleteCert() {
  calCertData = null;
  document.getElementById('cal-cert-preview').style.display = 'none';
  document.getElementById('cal-cert-img').src = '';
}

function saveCalib() {
  const fecha = v('cal-fecha');
  const empresa = document.getElementById('cal-empresa').value.trim();
  if (!fecha || !empresa) { toast('⚠ Complete fecha y empresa calibradora', true); return; }
  calCloseCam();
  DB.calibraciones.unshift({
    id: uid(), ts: now(),
    bascula: v('cal-bascula'),
    fecha, proxima: v('cal-proxima'),
    empresa, tecnico: v('cal-tecnico'),
    motivo: v('cal-motivo'),
    obs: v('cal-obs'),
    cert: calCertData || null,
  });
  calCertData = null;
  document.getElementById('cal-cert-preview').style.display = 'none';
  document.getElementById('cal-cert-img').src = '';
  ['cal-fecha','cal-proxima','cal-empresa','cal-tecnico','cal-obs'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  save(); renderCalib(); basRenderCalCards(); basShowCalStatus();
  toast('✓ Calibración registrada');
}

function renderCalib() {
  const tb = document.getElementById('cal-tbody'); if (!tb) return;
  if (!DB.calibraciones?.length) {
    tb.innerHTML = `<tr><td colspan="9"><div class="empty">Sin calibraciones registradas</div></td></tr>`; return;
  }
  const hoy = new Date().toISOString().split('T')[0];
  tb.innerHTML = DB.calibraciones.map(r => {
    const vencida = r.proxima && r.proxima < hoy;
    const pronto  = r.proxima && !vencida && (new Date(r.proxima)-new Date()) < 30*24*3600*1000;
    const badgeProx = r.proxima
      ? `<span class="chip ${vencida?'cr':pronto?'cw':'ck'}" style="font-size:.6rem;">${vencida?'⚠ VENCIDA':pronto?'⏳ PRÓXIMA':'✓ VIGENTE'} · ${r.proxima}</span>`
      : '—';
    const basNombre = r.bascula === 'todas' ? 'Todas' : `Báscula ${r.bascula}`;
    return `<tr>
      <td><strong>${basNombre}</strong></td>
      <td>${r.fecha}</td>
      <td>${r.empresa}</td>
      <td style="font-size:.72rem;">${r.tecnico||'—'}</td>
      <td style="font-size:.7rem;">${r.motivo||'—'}</td>
      <td>${badgeProx}</td>
      <td>${r.proxima?`<span class="chip ${vencida?'cr':pronto?'cw':'ck'}" style="font-size:.6rem;">${vencida?'VENCIDA':pronto?'POR VENCER':'VIGENTE'}</span>`:'—'}</td>
      <td>${r.cert
        ? `<img src="${r.cert}" style="height:36px;border-radius:3px;border:1.5px solid var(--br);cursor:pointer;" onclick="calViewCert('${r.id}')">`
        : '<span style="font-size:.68rem;color:var(--muted2);">Sin foto</span>'}</td>
      <td><button class="btn bo bsm" onclick="delCalib('${r.id}')">✕</button></td>
    </tr>`;
  }).join('');
}

function basRenderCalCards() {
  const cont = document.getElementById('bas-cal-cards'); if (!cont) return;
  const hoy = new Date().toISOString().split('T')[0];
  cont.innerHTML = BAS_NOMBRES.map((nombre, i) => {
    const cals = (DB.calibraciones||[]).filter(c => c.bascula == (i+1) || c.bascula === 'todas');
    cals.sort((a,b) => b.fecha.localeCompare(a.fecha));
    const ultima = cals[0];
    const vencida = ultima?.proxima && ultima.proxima < hoy;
    const pronto  = ultima?.proxima && !vencida && (new Date(ultima.proxima)-new Date()) < 30*24*3600*1000;
    const color   = !ultima ? 'var(--br2)' : vencida ? 'var(--danger)' : pronto ? 'var(--warn)' : 'var(--acc)';
    return `<div style="background:var(--s1);border:1.5px solid ${color};border-radius:4px;padding:14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:30px;height:30px;border-radius:4px;background:rgba(0,217,139,.1);border:1.5px solid rgba(0,217,139,.3);display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:var(--acc);">${i+1}</div>
        <span style="font-family:var(--fh);font-size:.82rem;font-weight:600;">${nombre}</span>
      </div>
      ${ultima ? `
        <div style="font-size:.72rem;color:var(--muted2);margin-bottom:3px;">Última: ${ultima.fecha}</div>
        <div style="font-size:.72rem;margin-bottom:3px;">${ultima.empresa}</div>
        <div style="font-size:.7rem;color:var(--muted2);margin-bottom:6px;">Motivo: ${ultima.motivo||'—'}</div>
        <span class="chip ${vencida?'cr':pronto?'cw':'ck'}" style="font-size:.6rem;">${vencida?'⚠ CALIBRACIÓN VENCIDA':pronto?'⏳ PRÓXIMA A VENCER':'✓ CALIBRACIÓN VIGENTE'}</span>
        ${ultima.proxima?`<div style="font-size:.66rem;color:var(--muted2);margin-top:4px;">Próxima: ${ultima.proxima}</div>`:''}
      ` : `<div class="chip cr" style="font-size:.6rem;">SIN CALIBRACIÓN REGISTRADA</div>`}
    </div>`;
  }).join('');
}

function delCalib(id) {
  DB.calibraciones = DB.calibraciones.filter(c => c.id !== id);
  save(); renderCalib(); basRenderCalCards(); basShowCalStatus(); toast('Calibración eliminada');
}

function calViewCert(id) {
  const cal = DB.calibraciones.find(c => c.id === id);
  if (!cal?.cert) return;
  const w = window.open('', '_blank');
  w.document.write(`<html><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;">
    <img src="${cal.cert}" style="max-width:100%;max-height:100vh;"><\/body><\/html>`);
}

const LP_TRATAMIENTOS = [
  { value: 'cloro',   label: 'Agua-Cloro 150 PPM', color: 'var(--info)',    bg: 'rgba(74,158,255,.08)',   border: 'rgba(74,158,255,.35)'  },
  { value: 'perox',   label: 'Agua-Peróxido',       color: 'var(--warn)',    bg: 'rgba(245,197,24,.08)',   border: 'rgba(245,197,24,.35)'  },
  { value: 'cera',    label: 'Agua-Cera',            color: '#a078ff',        bg: 'rgba(160,120,255,.08)',  border: 'rgba(160,120,255,.35)' },
  { value: 'agua',    label: 'Solo Agua',            color: 'var(--acc)',     bg: 'rgba(0,217,139,.08)',    border: 'rgba(0,217,139,.35)'   },
];

function buildLPTanques() {
  const grid = document.getElementById('lp-tanques-grid');
  if (!grid || grid.children.length > 0) return;
  [1, 2, 3, 4].forEach(t => {
    const card = document.createElement('div');
    card.id = `lp-tank-${t}`;
    card.style.cssText = 'background:var(--s2);border:1.5px solid var(--br);border-radius:4px;padding:14px;transition:all .2s;';
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:4px;background:rgba(0,217,139,.1);border:1.5px solid rgba(0,217,139,.3);display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:var(--acc);">${t}</div>
          <span style="font-family:var(--fh);font-size:.82rem;font-weight:600;">Tanque ${t}</span>
        </div>
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.72rem;color:var(--muted2);" id="lp-lbl-realizado-${t}">
          <input type="checkbox" id="lp-realizado-${t}" onchange="lpToggleTank(${t})" style="accent-color:var(--acc);width:14px;height:14px;"> Realizado
        </label>
      </div>
      <div id="lp-tratamiento-wrap-${t}" style="opacity:.35;pointer-events:none;transition:.2s;">
        <div style="font-size:.62rem;color:var(--muted2);letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px;">Tipo de tratamiento</div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${LP_TRATAMIENTOS.map(tr => `
            <label id="lp-opt-${t}-${tr.value}" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:7px 10px;border:1.5px solid var(--br);border-radius:4px;font-size:.74rem;transition:.15s;">
              <input type="radio" name="lp_trat_${t}" value="${tr.value}" onchange="lpStyleTrat(${t})" style="accent-color:${tr.color};width:14px;height:14px;">
              <span>${tr.label}</span>
            </label>`).join('')}
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

function lpToggleTank(t) {
  const chk   = document.getElementById(`lp-realizado-${t}`).checked;
  const wrap  = document.getElementById(`lp-tratamiento-wrap-${t}`);
  const card  = document.getElementById(`lp-tank-${t}`);
  const lbl   = document.getElementById(`lp-lbl-realizado-${t}`);
  wrap.style.opacity        = chk ? '1' : '.35';
  wrap.style.pointerEvents  = chk ? 'auto' : 'none';
  if (chk) {
    card.style.borderColor  = 'var(--acc)';
    card.style.background   = 'rgba(0,217,139,.04)';
    lbl.style.color         = 'var(--acc)';
  } else {
    card.style.borderColor  = 'var(--br)';
    card.style.background   = 'var(--s2)';
    lbl.style.color         = 'var(--muted2)';
    document.querySelectorAll(`input[name="lp_trat_${t}"]`).forEach(r => r.checked = false);
    lpStyleTrat(t);
  }
}

function lpStyleTrat(t) {
  const val = document.querySelector(`input[name="lp_trat_${t}"]:checked`)?.value;
  const tr  = LP_TRATAMIENTOS.find(x => x.value === val);
  LP_TRATAMIENTOS.forEach(x => {
    const lbl = document.getElementById(`lp-opt-${t}-${x.value}`);
    if (!lbl) return;
    if (val && x.value === val) {
      lbl.style.borderColor  = x.border;
      lbl.style.background   = x.bg;
      lbl.style.color        = x.color;
    } else {
      lbl.style.borderColor  = 'var(--br)';
      lbl.style.background   = '';
      lbl.style.color        = '';
    }
  });
  const card = document.getElementById(`lp-tank-${t}`);
  const chk  = document.getElementById(`lp-realizado-${t}`)?.checked;
  if (chk && tr) {
    card.style.borderColor = tr.border;
    card.style.background  = tr.bg;
  }
}

function saveLP() {
  const fecha = v('lp-fecha');
  const resp  = document.getElementById('lp-resp-sel')?.value;
  if (!fecha || !resp) { toast('⚠ Complete fecha y responsable', true); return; }

  const tanques = [1,2,3,4].map(t => {
    const realizado  = document.getElementById(`lp-realizado-${t}`)?.checked || false;
    const tratVal    = document.querySelector(`input[name="lp_trat_${t}"]:checked`)?.value || '';
    const tratLabel  = LP_TRATAMIENTOS.find(x => x.value === tratVal)?.label || '';
    return { tanque: t, realizado, tratamiento: tratVal, tratamientoLabel: tratLabel };
  });

  const realizados = tanques.filter(t => t.realizado).length;
  if (!realizados) { toast('⚠ Marque al menos un tanque como realizado', true); return; }

  const sinTrat = tanques.filter(t => t.realizado && !t.tratamiento);
  if (sinTrat.length) {
    toast(`⚠ Seleccione el tipo de tratamiento para Tanque ${sinTrat.map(t=>t.tanque).join(', ')}`, true);
    return;
  }

  DB.lp.unshift({
    id: uid(), ts: now(), fecha, hora: v('lp-hora'), resp, tanques, obs: v('lp-obs'),
  });

  [1,2,3,4].forEach(t => {
    document.getElementById(`lp-realizado-${t}`).checked = false;
    document.querySelectorAll(`input[name="lp_trat_${t}"]`).forEach(r => r.checked = false);
    lpToggleTank(t);
    lpStyleTrat(t);
  });
  document.getElementById('lp-obs').value = '';

  save(); renderLP(); toast(`✓ Registro guardado — ${realizados} tanque${realizados>1?'s':''} registrado${realizados>1?'s':''}`);
}

function renderLP() {
  const tb = document.getElementById('lp-tbody'); if (!tb) return;
  if (!DB.lp.length) { tb.innerHTML = `<tr><td colspan="9"><div class="empty">Sin registros</div></td></tr>`; return; }

  const TRAT_COLOR = { cloro:'cb', perox:'cw', cera:'', agua:'ck' };
  const TRAT_ICON  = { cloro:'💧', perox:'🧪', cera:'🫧', agua:'💦' };

  tb.innerHTML = DB.lp.slice().sort((a,b)=>(b.fecha||b.ts||"").localeCompare(a.fecha||a.ts||"")).map(r => {
    if (r.tanques) {
      const cols = r.tanques.map(t => {
        if (!t.realizado) return `<td><span style="font-size:.65rem;color:var(--muted2);">—</span></td>`;
        const ic = TRAT_ICON[t.tratamiento] || '';
        const cl = TRAT_COLOR[t.tratamiento] || 'cb';
        return `<td><span class="chip ${cl}" style="font-size:.6rem;">${ic} ${t.tratamientoLabel||t.tratamiento||'✓'}</span></td>`;
      }).join('');
      return `<tr>
        <td>${r.fecha}</td><td>${r.hora||'—'}</td><td>${r.resp}</td>
        ${cols}
        <td style="font-size:.68rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.obs||'—'}</td>
        <td><button class="btn bo bsm" onclick="del('lp','${r.id}')">✕</button></td>
      </tr>`;
    }
    return `<tr>
      <td>${r.fecha}</td><td>—</td><td>${r.resp||'—'}</td>
      <td>${chipSN(r.cloro)}</td><td>${chipSN(r.perox)}</td><td>${chipSN(r.cera)}</td><td>—</td><td>—</td>
      <td style="font-size:.68rem">${r.obs||'—'}</td>
      <td><button class="btn bo bsm" onclick="del('lp','${r.id}')">✕</button></td>
    </tr>`;
  }).join('');
}

