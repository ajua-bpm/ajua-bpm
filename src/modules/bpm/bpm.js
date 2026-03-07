// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/bpm/index.js
// Dashboard BPM — Control de procesos e inocuidad
// Build 55 — Marzo 2026
//
// Dependencias externas:
//   - DB, save()            → core/firebase.js
//   - uid(), now(), toast() → core/utils.js
//   - AUTH_SESSION          → core/auth.js
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// DASHBOARD BPM — COMPLETO
// ══════════════════════════════════════════════════════════════════

// Definición de módulos BPM con sus reglas
const BPM_MODULOS = [
  // DIARIOS — activos solo si hay maquila ese día
  { id:'al',  nombre:'Acceso y Lavado de Manos', icono:'🖐',  tipo:'diario',   seccion:'acceso-lavado',     color:'#00a86b' },
  { id:'bl',  nombre:'Limpieza Bodega',           icono:'🏭',  tipo:'diario',   seccion:'bodega-limpieza',   color:'#00a86b' },
  { id:'rod', nombre:'Control Roedores',           icono:'🐭',  tipo:'diario',   seccion:'roedores',          color:'#00a86b' },
  { id:'tl',  nombre:'Limpieza Transporte',        icono:'🚛',  tipo:'diario',   seccion:'transporte-limpieza',color:'#00a86b' },
  { id:'maq', nombre:'Gastos Generales (Maquila)', icono:'⚙️', tipo:'maestro',  seccion:'maquila',           color:'#4a9eff' },
  { id:'dt',  nombre:'Despacho Transporte',        icono:'📦',  tipo:'entrega',  seccion:'despacho',          color:'#f26822' },
  { id:'vgt', nombre:'Ventas GT / Walmart',        icono:'🛒',  tipo:'entrega',  seccion:'pedidos-walmart',    color:'#f26822' },
  { id:'ee',  nombre:'Empleados Enfermos',         icono:'🏥',  tipo:'eventual', seccion:'empleados-enfermos',color:'#888' },
  { id:'cap', nombre:'Registro Capacitación',      icono:'📚',  tipo:'eventual', seccion:'capacitacion',      color:'#888' },
  { id:'vis', nombre:'Visitas',                    icono:'👤',  tipo:'eventual', seccion:'visitas',           color:'#888' },
  { id:'fum', nombre:'Control Fumigación',         icono:'💨',  tipo:'periodico',seccion:'fumigacion',        color:'#a078ff' },
  { id:'vp',  nombre:'Vidrio y Plástico',          icono:'🔍',  tipo:'periodico',seccion:'vidrio',            color:'#a078ff' },
  { id:'bas', nombre:'Básculas / Calibración',     icono:'⚖️',  tipo:'periodico',seccion:'basculas',          color:'#a078ff' },
  { id:'lp',  nombre:'Lavado de Producto',         icono:'💧',  tipo:'periodico',seccion:'lavado-prod',       color:'#a078ff' },
];

// Nombres legibles de tipo
const TIPO_LABEL = {
  maestro:  'Maestro del día',
  diario:   'Diario (si hay operación)',
  entrega:  'Requerido con entrega',
  eventual: 'Eventual',
  periodico:'Periódico / Semanal',
};

function dashFechaHoy() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function dashGetTodayRecords(fecha) {
  // Returns map: moduleId -> array of records today
  const result = {};
  const today = fecha || dashFechaHoy();

  // Helper: check if record belongs to today
  const isToday = (r) => {
    const f = r.fecha || (r.ts ? r.ts.split('T')[0] : '');
    return f === today;
  };

  // Map DB keys to module ids
  const dbMap = {
    al: DB.al, bl: DB.bl, rod: DB.rod, tl: DB.tl, fum: DB.fum,
    dt: DB.dt, ee: DB.ee, cap: DB.cap, vis: DB.vis, vp: DB.vp,
    bas: DB.bas, lp: DB.lp,
  };

  // Maquila/Gastos — check gastosSemanales for week containing today
  const maqHoy = (DB.gastosSemanales||[]).filter(s =>
    s.semanaInicio <= today && (s.semanaFin||'9999') >= today
  );
  result['maq'] = maqHoy;

  // Ventas GT/Walmart
  const ventasHoy = [
    ...(DB.vgtVentas||[]).filter(isToday),
    ...(DB.vintVentas||[]).filter(isToday),
    ...(DB.pedidosWalmart||[]).filter(p => {
      const f = p.fechaEntrega || p.fecha || '';
      return f === today && (p.estado === 'cerrado' || p.estado === 'en_curso');
    }),
  ];
  result['vgt'] = ventasHoy;

  Object.entries(dbMap).forEach(([key, arr]) => {
    result[key] = (arr||[]).filter(isToday);
  });

  return result;
}

function dashHayEntregaHoy(fecha) {
  const today = fecha || dashFechaHoy();
  return (DB.pedidosWalmart||[]).some(p => {
    const f = p.fechaEntrega || p.fecha || '';
    return f === today && p.estado !== 'cancelado';
  });
}

function dashHayMaquilaHoy(fecha) {
  const today = fecha || dashFechaHoy();
  const records = dashGetTodayRecords(today);
  return records['maq'] && records['maq'].length > 0;
}

// ── BPM Status for a given date ───────────────────────────────────
function dashGetBpmStatus(fecha) {
  const today = fecha || dashFechaHoy();
  const records = dashGetTodayRecords(today);
  const hayMaquila = records['maq'] && records['maq'].length > 0;
  const hayEntrega = dashHayEntregaHoy(today);

  const statuses = BPM_MODULOS.map(mod => {
    const recs = records[mod.id] || [];
    const hecho = recs.length > 0;

    let aplica = false;
    let requerido = false;

    if (mod.tipo === 'maestro') {
      aplica = true;
      requerido = true; // always show maquila status
    } else if (mod.tipo === 'diario') {
      aplica = hayMaquila;
      requerido = hayMaquila;
    } else if (mod.tipo === 'entrega') {
      aplica = hayEntrega || hecho;
      requerido = hayEntrega;
    } else if (mod.tipo === 'eventual') {
      aplica = hecho; // only show if filled
      requerido = false;
    } else if (mod.tipo === 'periodico') {
      aplica = true; // always show but not required daily
      requerido = false;
    }

    return { ...mod, hecho, aplica, requerido, recs };
  });

  // Compute % completion (only required modules)
  const required = statuses.filter(s => s.requerido);
  const done     = required.filter(s => s.hecho);
  const pct = required.length ? Math.round(done.length / required.length * 100) : 100;

  return { statuses, pct, hayMaquila, hayEntrega, required, done };
}

// ── Render Activity Timeline ──────────────────────────────────────
function dashRenderActividad(fecha) {
  const today = fecha || dashFechaHoy();
  const events = [];

  // Collect all records today with timestamp and user
  const sources = [
    { arr: DB.al,  nombre: 'Acceso y Lavado de Manos', icono: '🖐' },
    { arr: DB.bl,  nombre: 'Limpieza Bodega',           icono: '🏭' },
    { arr: DB.rod, nombre: 'Control Roedores',           icono: '🐭' },
    { arr: DB.tl,  nombre: 'Limpieza Transporte',        icono: '🚛' },
    { arr: DB.fum, nombre: 'Control Fumigación',         icono: '💨' },
    { arr: DB.dt,  nombre: 'Despacho Transporte',        icono: '📦' },
    { arr: DB.ee,  nombre: 'Empleado Enfermo',           icono: '🏥' },
    { arr: DB.cap, nombre: 'Capacitación',               icono: '📚' },
    { arr: DB.vis, nombre: 'Visita',                     icono: '👤' },
    { arr: DB.vp,  nombre: 'Vidrio/Plástico',            icono: '🔍' },
    { arr: DB.bas, nombre: 'Báscula',                    icono: '⚖️' },
    { arr: DB.lp,  nombre: 'Lavado Producto',            icono: '💧' },
    { arr: DB.vgtVentas, nombre: 'Venta GT',             icono: '🛒' },
    { arr: DB.vintVentas, nombre: 'Venta Internacional', icono: '🌎' },
  ];

  sources.forEach(src => {
    (src.arr||[]).forEach(r => {
      const f = r.fecha || (r.ts ? r.ts.split('T')[0] : '');
      if (f !== today) return;

      const ts = r.ts || '';
      const hora = ts.includes('T') ?
        new Date(ts).toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit'}) :
        (r.hora || r.hi || '—');

      // Encargado: user who saved + field encargado if exists
      const usuario = r.usuario || r.user || '';
      const encargado = r.encargado || r.resp || r.responsable || '';
      const quienLabel = [usuario, encargado].filter(Boolean).join(' / ') || 'Sistema';

      events.push({ hora, nombre: src.nombre, icono: src.icono, quien: quienLabel, ts });
    });
  });

  // Also add maquila week saves
  (DB.gastosSemanales||[]).forEach(s => {
    if (s.semanaInicio <= today && (s.semanaFin||'9999') >= today) {
      const ts = s.ts || '';
      const hora = ts.includes('T') ?
        new Date(ts).toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit'}) : '—';
      events.push({ hora, nombre: 'Gastos Generales (semana)', icono: '⚙️', quien: 'Sistema', ts });
    }
  });

  // Sort by timestamp desc
  events.sort((a,b) => (b.ts||'').localeCompare(a.ts||''));

  return events;
}

// ── Render weekly mini calendar ───────────────────────────────────
function dashRenderCalendario() {
  const today = dashFechaHoy();
  const d = new Date(today + 'T12:00:00');
  const dow = d.getDay(); // 0=sun
  const diff = dow === 0 ? -6 : 1 - dow;
  const lunes = new Date(d); lunes.setDate(d.getDate() + diff);

  const days = ['Lun','Mar','Mié','Jue','Vie','Sáb'];
  let html = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:8px;">';

  for (let i = 0; i < 6; i++) {
    const day = new Date(lunes); day.setDate(lunes.getDate() + i);
    const fecha = day.toISOString().split('T')[0];
    const isToday = fecha === today;
    const { pct, hayMaquila, hayEntrega, required, done } = dashGetBpmStatus(fecha);

    // Color logic
    let bg = '#f5f5f5', color = '#999', border = '#ddd';
    if (!hayMaquila && fecha <= today) {
      bg = '#f9f9f9'; color = '#bbb'; border = '#e0e0e0'; // no op day
    } else if (hayMaquila) {
      if (pct === 100)       { bg = '#e8f5ef'; color = '#00412d'; border = '#00412d'; }
      else if (pct >= 60)    { bg = '#fff8e6'; color = '#b45309'; border = '#f5c518'; }
      else                   { bg = '#fff0f0'; color = '#cc3300'; border = '#ff6b6b'; }
    }
    if (hayEntrega) border = '#f26822';
    if (isToday) border = '#00412d';

    const dayNum = day.getDate();
    html += `<div onclick="dashSelectDay('${fecha}')" style="
      background:${bg};color:${color};border:2px solid ${border};
      border-radius:8px;padding:6px 4px;text-align:center;cursor:pointer;
      transition:.15s;${isToday?'box-shadow:0 0 0 3px rgba(0,66,45,.3);':''}">
      <div style="font-size:.65rem;font-weight:600;">${days[i]}</div>
      <div style="font-size:1rem;font-weight:800;">${dayNum}</div>
      <div style="font-size:.6rem;margin-top:2px;">${hayMaquila ? pct+'%' : '—'}</div>
      ${hayEntrega ? '<div style="font-size:.6rem;color:#f26822;">🚚</div>' : ''}
    </div>`;
  }
  html += '</div>';
  return html;
}

// ── Main render ───────────────────────────────────────────────────
let _dashSelectedDay = null;

function dashSelectDay(fecha) {
  _dashSelectedDay = fecha;
  updateDash();
}

function updateDash() {
  const today = dashFechaHoy();
  const fecha = _dashSelectedDay || today;
  const isToday = fecha === today;

  // Update date display
  const fechaEl = document.getElementById('fecha-hoy');
  if (fechaEl) {
    const d = new Date(fecha + 'T12:00:00');
    const label = isToday ? 'hoy, ' : '';
    fechaEl.textContent = label + d.toLocaleDateString('es-GT',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  }

  const { statuses, pct, hayMaquila, hayEntrega, required, done } = dashGetBpmStatus(fecha);

  // ── Alert banner ──────────────────────────────────────────────
  const alertEl = document.getElementById('dash-alerta');
  if (alertEl) {
    if (hayEntrega) {
      const faltanEntrega = statuses.filter(s => s.tipo === 'entrega' && s.requerido && !s.hecho);
      const faltanDiarios = statuses.filter(s => s.tipo === 'diario' && s.requerido && !s.hecho);
      const faltan = [...faltanDiarios, ...faltanEntrega];
      if (faltan.length > 0) {
        alertEl.style.display = '';
        alertEl.innerHTML = `<div style="background:#fff3e0;border:2px solid #f26822;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;gap:10px;align-items:flex-start;">
          <span style="font-size:1.3rem;">⚠️</span>
          <div>
            <div style="font-weight:800;color:#f26822;font-size:.85rem;">HAY ENTREGA HOY — Formularios pendientes:</div>
            <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:6px;">
              ${faltan.map(m=>`<span onclick="show('${m.seccion}',null)" style="background:#f26822;color:#fff;border-radius:20px;padding:3px 10px;font-size:.72rem;cursor:pointer;font-weight:600;">${m.icono} ${m.nombre}</span>`).join('')}
            </div>
          </div>
        </div>`;
      } else {
        alertEl.innerHTML = `<div style="background:#e8f5ef;border:2px solid #00412d;border-radius:8px;padding:8px 14px;margin-bottom:12px;font-size:.82rem;color:#00412d;font-weight:700;">
          ✅ Entrega hoy — todos los formularios completados
        </div>`;
        alertEl.style.display = '';
      }
    } else {
      alertEl.style.display = 'none';
    }
  }

  // ── Stats cards ───────────────────────────────────────────────
  const alHoy = (DB.al||[]).filter(r => (r.fecha||'') === fecha);
  const personalHoy = alHoy.reduce((sum,r) => sum + (r.totalEmp||0), 0);
  document.getElementById('ds-hoy').textContent   = done.length + '/' + required.length;
  document.getElementById('ds-personal').textContent = personalHoy;
  document.getElementById('ds-cap').textContent   = (DB.cap||[]).filter(r=>(r.fecha||r.ts||'').includes(fecha)).length;
  document.getElementById('ds-enf').textContent   = (DB.ee||[]).filter(r=>(r.fecha||r.ts||'').includes(fecha)).length;

  // ── BPM Circle ────────────────────────────────────────────────
  const circleEl = document.getElementById('dash-bpm-circle');
  if (circleEl) {
    const radius = 52, circ = 2 * Math.PI * radius;
    const dash = (pct / 100) * circ;
    const color = pct === 100 ? '#00412d' : pct >= 60 ? '#f5c518' : '#ff4444';
    circleEl.innerHTML = `
      <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;margin:8px auto;display:flex;">
        <svg width="130" height="130" style="transform:rotate(-90deg)">
          <circle cx="65" cy="65" r="${radius}" fill="none" stroke="#e0e0e0" stroke-width="10"/>
          <circle cx="65" cy="65" r="${radius}" fill="none" stroke="${color}" stroke-width="10"
            stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
            stroke-linecap="round" style="transition:stroke-dasharray .4s ease;"/>
        </svg>
        <div style="position:absolute;text-align:center;">
          <div style="font-size:1.6rem;font-weight:900;color:${color};">${pct}%</div>
          <div style="font-size:.6rem;color:#999;margin-top:-2px;">BPM completadas</div>
        </div>
      </div>
      <div style="text-align:center;font-size:.72rem;color:#666;margin-bottom:4px;">
        ${done.length} de ${required.length} requeridos${hayMaquila?'':' <span style="color:#999">(sin operación)</span>'}
      </div>`;
  }

  // ── BPM List ──────────────────────────────────────────────────
  const listEl = document.getElementById('dash-bpm-list');
  if (listEl) {
    const groups = [
      { tipo:'maestro',  label:'🔑 Maestro del día' },
      { tipo:'diario',   label:'📋 Diarios (si hay operación)' },
      { tipo:'entrega',  label:'🚚 Con entrega' },
      { tipo:'periodico',label:'📅 Periódicos / Semanales' },
      { tipo:'eventual', label:'⚡ Eventuales' },
    ];

    listEl.innerHTML = groups.map(grp => {
      const mods = statuses.filter(s => s.tipo === grp.tipo && s.aplica);
      if (!mods.length) return '';
      return `<div style="margin-bottom:10px;">
        <div style="font-size:.65rem;font-weight:700;color:#999;text-transform:uppercase;margin-bottom:4px;">${grp.label}</div>
        ${mods.map(m => {
          let icon, bg, color;
          if (m.hecho)           { icon='✅'; bg='#e8f5ef'; color='#00412d'; }
          else if (m.requerido)  { icon='🔴'; bg='#fff0f0'; color='#cc3300'; }
          else                   { icon='⬜'; bg='#f9f9f9'; color='#666'; }
          return `<div onclick="show('${m.seccion}',null)"
            style="display:flex;align-items:center;gap:8px;padding:7px 10px;
                   background:${bg};border-radius:6px;margin-bottom:4px;
                   cursor:pointer;border:1px solid ${m.hecho?'#00a86b':m.requerido?'#ff6b6b':'#e0e0e0'};
                   transition:.1s;" onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
            <span style="font-size:.85rem;">${icon}</span>
            <span style="font-size:.72rem;">${m.icono}</span>
            <span style="font-size:.75rem;font-weight:${m.requerido&&!m.hecho?'700':'500'};color:${color};flex:1;">${m.nombre}</span>
            <span style="font-size:.6rem;color:#aaa;">${m.hecho ? m.recs.length+' reg.' : m.requerido?'PENDIENTE':'—'}</span>
            <span style="font-size:.65rem;color:#aaa;">→</span>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');
  }

  // ── Activity Timeline ─────────────────────────────────────────
  const actEl = document.getElementById('dash-actividad');
  if (actEl) {
    const events = dashRenderActividad(fecha);
    if (!events.length) {
      actEl.innerHTML = '<div class="empty">Sin actividad' + (isToday?' aún':' ese día') + '</div>';
    } else {
      actEl.innerHTML = events.map(e => `
        <div style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--br);">
          <div style="font-size:1rem;margin-top:1px;">${e.icono}</div>
          <div style="flex:1;">
            <div style="font-size:.78rem;font-weight:600;color:var(--green-deep);">${e.nombre}</div>
            <div style="font-size:.68rem;color:var(--muted);">${e.quien}</div>
          </div>
          <div style="font-size:.68rem;color:var(--muted2);white-space:nowrap;">${e.hora}</div>
        </div>`).join('');
    }
  }

  // ── Weekly calendar ───────────────────────────────────────────
  const calEl = document.getElementById('dash-calendario');
  if (calEl) calEl.innerHTML = dashRenderCalendario();
}


let ineCamStream = null, ineAlbaranData = null;
let ineDocData = { prod: null, mx: null, duca: null };

function invEnsureDB() {
  if (!DB.iproductos)     DB.iproductos = [];
  if (!DB.ipresentaciones) DB.ipresentaciones = [];
  if (!DB.iclientes)      DB.iclientes = [];
  if (!DB.ientradas)      DB.ientradas = [];
  if (!DB.isalidas)       DB.isalidas = [];
  if (!DB.cotizaciones)   DB.cotizaciones = [];
  if (!DB.pedidosWalmart) DB.pedidosWalmart = [];
  if (!DB.vgtVentas)      DB.vgtVentas = [];
  if (!DB.vintVentas)     DB.vintVentas = [];
  if (!DB.maquila)        DB.maquila = [];
}

function saveIprod() {
  invEnsureDB();
  const nombre = document.getElementById('iprod-nombre')?.value.trim();
  if (!nombre) { toast('⚠ Ingrese nombre del producto', true); return; }
  DB.iproductos.push({
    id: uid(), nombre,
    codigo:        v('iprod-codigo'),
    categoria:     v('iprod-categoria'),
    unidadCompra:  v('iprod-unidad-compra'),
    kgBulto:       parseFloat(v('iprod-kg-bulto'))  || 0,
    empaqueCompra: v('iprod-empaque-compra'),
    pctMerma:      parseFloat(v('iprod-pct-merma')) || 0,
    diasMax:       parseInt(v('iprod-dias-max'))     || 30,
    minStock:      parseFloat(v('iprod-min-stock'))  || 0,
  });
  ['iprod-nombre','iprod-codigo','iprod-kg-bulto','iprod-pct-merma','iprod-dias-max','iprod-min-stock'].forEach(id => set(id,''));
  save(); renderIprod(); invPopulateSelects();
  toast('"' + nombre + '" agregado ✓');
}

function renderIprod() {
  invEnsureDB();
  const cont = document.getElementById('iprod-lista'); if (!cont) return;
  if (!DB.iproductos.length) {
    cont.innerHTML = '<div class="empty" style="grid-column:1/-1;">Sin productos. Agrega los productos que importas.</div>'; return;
  }
  const EMPAQ = { costal:'Costal/Bulto', caja:'Caja', red:'Red/Malla', bolsa:'Bolsa', granel:'Granel', unidad:'Unidad' };
  const UNID  = { kg:'KG', bulto:'Bulto', caja:'Caja', red:'Red', unidad:'Unidad' };
  cont.innerHTML = DB.iproductos.map(p => {
    const pres = (DB.ipresentaciones || []).filter(pr => pr.productoId === p.id);
    return '<div style="background:var(--s2);border:1.5px solid var(--br);border-radius:4px;padding:14px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">' +
        '<div><span style="font-family:var(--fh);font-size:.84rem;font-weight:700;">' + p.nombre + '</span>' +
        (p.codigo ? '<div style="font-size:.62rem;color:var(--muted2);">Código: ' + p.codigo + '</div>' : '') +
        '<div style="font-size:.62rem;color:var(--info);margin-top:1px;">' + p.categoria + '</div></div>' +
        '<button class="btn bo bsm" style="border-color:var(--danger);color:var(--danger);" onclick="delIprod(\'' + p.id + '\')">✕</button>' +
      '</div>' +
      '<div style="font-size:.68rem;color:var(--muted2);line-height:1.9;">' +
        '<div>Se compra en: <span style="color:var(--txt);">' + (UNID[p.unidadCompra] || p.unidadCompra) + (p.kgBulto ? ' ≈ ' + p.kgBulto + ' kg/bulto' : '') + '</span></div>' +
        '<div>Empaque: <span style="color:var(--txt);">' + (EMPAQ[p.empaqueCompra] || p.empaqueCompra) + '</span></div>' +
        '<div>Merma natural: <span style="color:var(--warn);">' + p.pctMerma + '% / semana</span></div>' +
        (p.minStock ? '<div>Stock mínimo: <span style="color:var(--acc);">' + p.minStock + ' lbs</span></div>' : '') +
      '</div>' +
      '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--br);font-size:.66rem;color:var(--muted2);">' +
        'Presentaciones: <span style="color:var(--acc);">' + (pres.length ? pres.map(pr => pr.nombre).join(' · ') : 'Ninguna aún') + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

function delIprod(id) {
  if (!confirm('¿Eliminar producto y todas sus presentaciones?')) return;
  DB.iproductos      = DB.iproductos.filter(p => p.id !== id);
  DB.ipresentaciones = (DB.ipresentaciones || []).filter(p => p.productoId !== id);
  save(); renderIprod(); renderIpres(); invPopulateSelects();
  toast('Producto eliminado');
}

function ipresToggleCanal(canal) {
  const isWal = canal === 'walmart' || canal === 'walmart_mx';
  const walSec = document.getElementById('ipres-wal-section');
  const otrSec = document.getElementById('ipres-otro-section');
  if (walSec) walSec.style.display = isWal ? 'block' : 'none';
  if (otrSec) otrSec.style.display = isWal ? 'none' : 'block';
  if (isWal) ipresCalcWal(); else ipresCalcOtro();
}

function ipresCalcWal() {
  const tipo   = v('ipres-tipo-contenido');
  const qty    = parseFloat(v('ipres-qty'))    || 0;
  const lbsUd  = parseFloat(v('ipres-lbs-ud')) || 0;

  const qtyRow    = document.getElementById('ipres-qty-row');
  const lbsudRow  = document.getElementById('ipres-lbsud-row');
  const qtyLabel  = document.getElementById('ipres-qty-label');
  const lbsLabel  = document.getElementById('ipres-lbsud-label');
  const ejemploEl = document.getElementById('ipres-wal-ejemplo');

  let lbsCaja = 0, ejemplo = '';

  if (tipo === 'granel') {
    if (qtyRow)   qtyRow.style.display  = 'none';
    if (lbsudRow) lbsudRow.style.display = 'block';
    if (lbsLabel) lbsLabel.textContent  = 'Total LBS en la caja (a granel)';
    lbsCaja = lbsUd;
    ejemplo = lbsUd > 0 ? 'Caja de ' + lbsUd + ' lbs a granel — ej. "CEBOLLA BLANCA UXC_' + Math.round(lbsUd) + '"' : '';
  } else if (tipo === 'redes' || tipo === 'bolsas') {
    if (qtyRow)   qtyRow.style.display  = 'block';
    if (lbsudRow) lbsudRow.style.display = 'block';
    if (qtyLabel) qtyLabel.textContent  = (tipo === 'redes' ? 'Redes' : 'Bolsas') + ' por caja';
    if (lbsLabel) lbsLabel.textContent  = 'LBS por ' + (tipo === 'redes' ? 'red' : 'bolsa');
    lbsCaja = qty * lbsUd;
    if (qty > 0 && lbsUd > 0)
      ejemplo = qty + ' ' + tipo + ' × ' + lbsUd + ' lbs = ' + lbsCaja.toFixed(1) + ' lbs/caja — ej. "CEBOLLA RED LB UXC_' + Math.round(lbsCaja) + '"';
  } else if (tipo === 'unidades') {
    if (qtyRow)   qtyRow.style.display  = 'block';
    if (lbsudRow) lbsudRow.style.display = 'block';
    if (qtyLabel) qtyLabel.textContent  = 'Unidades por caja';
    if (lbsLabel) lbsLabel.textContent  = 'LBS estimado por unidad';
    lbsCaja = qty * lbsUd;
    if (qty > 0)
      ejemplo = qty + ' unidades por caja' + (lbsUd > 0 ? ' × ' + lbsUd + ' lbs ≈ ' + lbsCaja.toFixed(1) + ' lbs/caja' : '') + ' — ej. "REPOLLO UXC_4"';
  }

  set('ipres-lbs-caja', lbsCaja > 0 ? lbsCaja.toFixed(2) : '');
  set('ipres-kg-caja',  lbsCaja > 0 ? (lbsCaja / 2.20462).toFixed(2) : '');
  if (ejemploEl) ejemploEl.textContent = ejemplo;
  ipresUpdateResumen(lbsCaja);
}

function ipresCalcOtro() {
  const lbs = parseFloat(v('ipres-lbs-otro')) || 0;
  set('ipres-kg-otro', lbs > 0 ? (lbs / 2.20462).toFixed(2) : '');
  ipresUpdateResumen(lbs);
}

function ipresUpdateResumen(lbsBulto) {
  const res    = document.getElementById('ipres-resumen');
  const nombre = v('ipres-nombre');
  const canal  = v('ipres-canal');
  const isWal  = canal === 'walmart' || canal === 'walmart_mx';
  const prod   = DB.iproductos.find(p => p.id === v('ipres-producto'));
  if (!res) return;
  if (lbsBulto > 0 && nombre) {
    const CANAL_CHIP = { walmart:'ck', walmart_mx:'ck', exportacion:'cb', local:'cw', mercado:'cw', individual:'cw' };
    const CANAL_LBL  = { walmart:'Walmart GT', walmart_mx:'Walmart MX', exportacion:'Exportación', local:'Local GT', mercado:'Mercado', individual:'Individual' };
    res.style.display = 'block';
    res.innerHTML =
      '<strong style="color:var(--acc);">' + nombre + '</strong>' +
      (prod ? '<span style="color:var(--muted2);"> — ' + prod.nombre + '</span>' : '') +
      ' <span class="chip ' + (CANAL_CHIP[canal] || 'cw') + '" style="font-size:.55rem;">' + (CANAL_LBL[canal] || canal) + '</span>' +
      '<br>' + (isWal ? '<span style="color:var(--acc);">📦 Caja de cartón — </span>' : '') +
      '<strong style="color:var(--acc);">' + lbsBulto.toFixed(2) + ' lbs</strong> · <span style="color:var(--muted2);">' + (lbsBulto / 2.20462).toFixed(2) + ' kg</span>' +
      '<br><span style="font-size:.6rem;color:var(--muted2);">💡 Precio: se recoge del PDF Ediwin en cada venta</span>';
  } else {
    res.style.display = 'none';
  }
}

function saveIpres() {
  invEnsureDB();
  const prodId = v('ipres-producto');
  const nombre = document.getElementById('ipres-nombre')?.value.trim();
  if (!prodId) { toast('⚠ Seleccione un producto', true); return; }
  if (!nombre) { toast('⚠ Ingrese nombre de la presentación', true); return; }

  const canal  = v('ipres-canal');
  const isWal  = canal === 'walmart' || canal === 'walmart_mx';
  const tipo   = v('ipres-tipo-contenido');
  const qty    = parseFloat(v('ipres-qty'))    || 0;
  const lbsUd  = parseFloat(v('ipres-lbs-ud')) || 0;
  const lbsOtro= parseFloat(v('ipres-lbs-otro'))|| 0;

  let lbsBulto = 0, desc = '';
  if (isWal) {
    if (tipo === 'granel')          { lbsBulto = lbsUd;       desc = lbsUd + ' lbs a granel en caja'; }
    else if (tipo === 'unidades')   { lbsBulto = qty * lbsUd; desc = qty + ' unidades × ~' + lbsUd + ' lbs'; }
    else                            { lbsBulto = qty * lbsUd; desc = qty + ' ' + tipo + ' × ' + lbsUd + ' lbs'; }
  } else {
    lbsBulto = lbsOtro; desc = lbsOtro + ' lbs por ' + v('ipres-tipo-otro');
  }

  if (!lbsBulto) { toast('⚠ Configure el peso de la presentación', true); return; }

  DB.ipresentaciones.push({
    id: uid(), productoId: prodId, nombre,
    canal, isWalmart: isWal,
    codigo:          v('ipres-codigo'),
    tipoEmpaque:     isWal ? 'caja' : v('ipres-tipo-otro'),
    tipoContenido:   isWal ? tipo : v('ipres-tipo-otro'),
    qty, lbsUd, lbsOtro,
    lbsBulto,
    kgBulto:         lbsBulto / 2.20462,
    descripcion:     desc,
  });

  ['ipres-nombre','ipres-codigo','ipres-qty','ipres-lbs-ud','ipres-lbs-caja','ipres-kg-caja',
   'ipres-lbs-otro','ipres-kg-otro'].forEach(id => set(id,''));
  set('ipres-producto','');
  const res = document.getElementById('ipres-resumen');
  if (res) res.style.display = 'none';

  save(); renderIpres(); invPopulateSelects();
  toast('"' + nombre + '" — ' + lbsBulto.toFixed(1) + ' lbs/caja ✓');
}

function renderIpres() {
  invEnsureDB();
  const cont = document.getElementById('ipres-lista'); if (!cont) return;
  if (!DB.ipresentaciones.length) {
    cont.innerHTML = '<div class="empty">Sin presentaciones. Define cómo se vende cada producto: Caja 30 lbs, 8 Redes × 3 lbs, 4 repollos por caja, etc.</div>'; return;
  }
  const byProd = {};
  DB.ipresentaciones.forEach(pr => {
    if (!byProd[pr.productoId]) byProd[pr.productoId] = [];
    byProd[pr.productoId].push(pr);
  });
  const CANAL_CHIP = { walmart:'ck', walmart_mx:'ck', exportacion:'cb', local:'cw', mercado:'cw', individual:'cw' };
  const CANAL_LBL  = { walmart:'🏪 Walmart GT', walmart_mx:'🏪 Walmart MX', exportacion:'✈️ Export.', local:'🏢 Local', mercado:'🏪 Mercado', individual:'👤 Individual' };

  cont.innerHTML = Object.entries(byProd).map(([prodId, pres]) => {
    const prod = DB.iproductos.find(p => p.id === prodId);
    return '<div style="margin-bottom:18px;">' +
      '<div style="font-family:var(--fh);font-size:.82rem;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--br);color:var(--acc);">' +
        '🥬 ' + (prod?.nombre || prodId) + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;">' +
      pres.map(pr => {
        const isWal = pr.isWalmart;
        return '<div style="background:var(--s2);border:1.5px solid ' + (isWal ? 'rgba(0,217,139,.3)' : 'rgba(74,158,255,.2)') + ';border-radius:4px;padding:12px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
            '<div>' +
              '<div style="font-family:var(--fh);font-size:.8rem;font-weight:700;">' + pr.nombre + '</div>' +
              '<span class="chip ' + (CANAL_CHIP[pr.canal] || 'cw') + '" style="font-size:.55rem;margin-top:3px;display:inline-block;">' + (CANAL_LBL[pr.canal] || pr.canal) + '</span>' +
            '</div>' +
            '<button class="btn bo bsm" style="border-color:var(--danger);color:var(--danger);" onclick="delIpres(\'' + pr.id + '\')">✕</button>' +
          '</div>' +
          '<div style="font-size:.68rem;color:var(--muted2);line-height:1.9;">' +
            (pr.codigo ? '<div>Código SAP: <span style="color:var(--info);">' + pr.codigo + '</span></div>' : '') +
            '<div>Empaque: <span style="color:var(--txt);">' + (isWal ? '📦 Caja de cartón' : pr.tipoEmpaque) + '</span></div>' +
            (isWal && pr.qty > 0 && pr.tipoContenido !== 'granel' ? '<div>' + pr.qty + ' ' + pr.tipoContenido + ' × ' + pr.lbsUd + ' lbs</div>' : '') +
            '<div style="margin-top:4px;"><strong style="color:var(--acc);font-size:.84rem;">' + pr.lbsBulto.toFixed(2) + ' lbs / caja</strong> <span style="color:var(--muted2);">(' + pr.kgBulto.toFixed(2) + ' kg)</span></div>' +
            (pr.precio ? '<div>Precio ref: <span style="color:var(--acc);">Q' + pr.precio.toFixed(2) + '</span></div>' : '') +
          '</div>' +
        '</div>';
      }).join('') +
      '</div></div>';
  }).join('');
}

function delIpres(id) {
  DB.ipresentaciones = (DB.ipresentaciones || []).filter(p => p.id !== id);
  save(); renderIpres(); invPopulateSelects(); toast('Presentación eliminada');
}

function saveIcli() {
  invEnsureDB();
  const nombre = document.getElementById('icli-nombre')?.value.trim();
  if (!nombre) { toast('⚠ Ingrese nombre del cliente', true); return; }
  DB.iclientes.push({
    id: uid(), nombre,
    nit:      v('icli-nit'),
    tipo:     v('icli-tipo'),
    pais:     v('icli-pais'),
    contacto: v('icli-contacto'),
    tel:      v('icli-tel'),
    dir:      v('icli-dir'),
  });
  ['icli-nombre','icli-nit','icli-contacto','icli-tel','icli-dir'].forEach(id => set(id,''));
  save(); renderIcli(); invPopulateSelects();
  toast('"' + nombre + '" agregado ✓');
}

function renderIcli() {
  invEnsureDB();
  const cont = document.getElementById('icli-lista'); if (!cont) return;
  if (!DB.iclientes.length) { cont.innerHTML = '<div class="empty" style="grid-column:1/-1;">Sin clientes registrados.</div>'; return; }
  const TIPO_LBL = {
    walmart:'🏪 Walmart GT', walmart_mx:'🏪 Walmart MX', supermercado:'🛒 Supermercado',
    exportacion:'✈️ Exportación', mercado:'🏪 Mercado/Dist.', individual:'👤 Individual', otro:'🏢 Otro',
  };
  cont.innerHTML = DB.iclientes.map(c => {
    const isWal = c.tipo === 'walmart' || c.tipo === 'walmart_mx';
    return '<div style="background:var(--s2);border:1.5px solid ' + (isWal ? 'rgba(0,217,139,.3)' : 'var(--br)') + ';border-radius:4px;padding:14px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
        '<div>' +
          '<div style="font-family:var(--fh);font-size:.82rem;font-weight:700;">' + c.nombre + '</div>' +
          '<div style="font-size:.62rem;color:var(--muted2);">' + (TIPO_LBL[c.tipo] || c.tipo) + ' · ' + (c.pais || 'GT') + '</div>' +
        '</div>' +
        '<button class="btn bo bsm" style="border-color:var(--danger);color:var(--danger);" onclick="delIcli(\'' + c.id + '\')">✕</button>' +
      '</div>' +
      '<div style="font-size:.68rem;color:var(--muted2);line-height:1.8;">' +
        '<div>NIT/RFC: <span style="color:var(--acc);">' + (c.nit || '—') + '</span></div>' +
        (c.contacto ? '<div>Contacto: ' + c.contacto + (c.tel ? ' · ' + c.tel : '') + '</div>' : '') +
        (c.dir ? '<div style="font-size:.64rem;">' + c.dir + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

function delIcli(id) {
  DB.iclientes = DB.iclientes.filter(c => c.id !== id);
  save(); renderIcli(); invPopulateSelects(); toast('Cliente eliminado');
}

function invPopulateSelects() {
  invEnsureDB();
  const prodOpts = '<option value="">— Seleccionar producto —</option>' +
    DB.iproductos.map(p => '<option value="' + p.id + '">' + p.nombre + '</option>').join('');
  const filOpts = '<option value="">Todos los productos</option>' +
    DB.iproductos.map(p => '<option value="' + p.id + '">' + p.nombre + '</option>').join('');
  const cliOpts = '<option value="">— Seleccionar cliente —</option>' +
    DB.iclientes.map(c => '<option value="' + c.id + '">' + c.nombre + (c.nit ? ' · ' + c.nit : '') + '</option>').join('');

  ['ine-prod','traz-producto','ipres-producto'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const cur = el.value; el.innerHTML = prodOpts; el.value = cur;
  });
  const fp = document.getElementById('inv-fil-prod');
  if (fp) { const cur = fp.value; fp.innerHTML = filOpts; fp.value = cur; }
  const sc = document.getElementById('sal-cliente');
  if (sc) { const cur = sc.value; sc.innerHTML = cliOpts; sc.value = cur; }
  document.querySelectorAll('[id^="cot-prod-id-"]').forEach(el => {
    const cur = el.value; el.innerHTML = prodOpts; el.value = cur;
  });
}

function invConfigTab(name, el) {
  ['productos','presentaciones','clientes'].forEach(t => {
    const el2 = document.getElementById('inv-config-tab-' + t);
    if (el2) el2.style.display = t === name ? 'block' : 'none';
  });
  document.querySelectorAll('#sec-inv-config .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  if (name === 'presentaciones') { renderIpres(); invPopulateSelects(); }
  if (name === 'clientes') renderIcli();
}
let cotProdCount  = 0;
let cotGastosMX   = [];
let cotGastosGT   = [];
let cotTipo       = 'interno';   // 'interno' | 'terceros'
let cotActivaId   = null;        // ID de la cotización en detalle
const COT_COLORS  = ['#00d98b','#4a9eff','#f5c518','#ff3858','#a078ff','#ff9800','#00bcd4'];

const COT_ESTADOS = {
  borrador:    { label:'Borrador',        color:'var(--muted2)', icon:'📝' },
  anticipos:   { label:'Anticipos MX',    color:'var(--warn)',   icon:'💸' },
  aceptada:    { label:'Aceptada',        color:'#4a9eff',       icon:'🤝' },
  en_entrega:  { label:'En trámite',      color:'var(--warn)',   icon:'🚛' },
  duca:        { label:'DUCA recibida',   color:'#a078ff',       icon:'📋' },
  bodega:      { label:'En bodega',       color:'var(--acc)',    icon:'✅' },
  entregada:   { label:'Entregado',       color:'#00d98b',       icon:'📦' },
  pagado:      { label:'Pagado',          color:'var(--acc)',    icon:'💰' },
};

function cotMainTab(tab, el) {
  ['interno','terceros','lista'].forEach(t => {
    const btn = document.getElementById('cot-tab-' + t);
    if (btn) btn.classList.remove('active');
  });
  if (el) el.classList.add('active');
  else { const b = document.getElementById('cot-tab-' + tab); if (b) b.classList.add('active'); }

  document.getElementById('cot-panel-form').style.display   = (tab === 'interno' || tab === 'terceros') ? 'block' : 'none';
  document.getElementById('cot-panel-detalle').style.display = 'none';
  document.getElementById('cot-panel-lista').style.display  = tab === 'lista' ? 'block' : 'none';

  if (tab === 'interno' || tab === 'terceros') {
    cotTipo = tab;
    cotNueva();
    if (tab === 'lista') renderCotList();
  } else {
    renderCotList();
  }
}

function cotNueva() {
  cotActivaId = null;
  cotProdCount = 0;
  cotGastosMX  = [];
  cotGastosGT  = [];

  // Reset manual-edit flags for % gastos fields
  document.querySelectorAll('[id^="cot-p-pct-gas-"]').forEach(el => {
    el._userEdited = false;
    el._listenerAdded = false;
  });

  const title = document.getElementById('cot-form-title');
  if (title) title.textContent = cotTipo === 'interno' ? 'Nueva Cotización Interna' : 'Nueva Cotización para Terceros';

  const terCli = document.getElementById('cot-terceros-cliente');
  const venSec = document.getElementById('cot-venta-section');
  if (terCli) terCli.style.display = cotTipo === 'terceros' ? 'block' : 'none';
  if (venSec) venSec.style.display = cotTipo === 'terceros' ? 'block' : 'none';

  ['cot-nombre','cot-duca','cot-obs','cot-ter-cliente'].forEach(id => set(id,''));
  const fd = document.getElementById('cot-fecha');
  if (fd) fd.value = new Date().toISOString().split('T')[0];

  document.getElementById('cot-prod-list').innerHTML = '';
  document.getElementById('cot-totales-row').style.display = 'none';
  document.getElementById('cot-venta-lineas').innerHTML = '';
  document.getElementById('cot-resultados').style.display = 'none';

  ['cot-sub-mx-mxn','cot-sub-mx-gtq','cot-sub-gt-gtq',
   'cot-total-gastos','cot-total-compra','cot-total-total'].forEach(id => set(id, id.includes('mxn') ? '$ 0' : 'Q 0'));

  cotInitGastosMX();
  cotInitGastosGT();
  invPopulateSelects();
}

async function cotFetchTC() {
  const btn = document.querySelector('button[onclick="cotFetchTC()"]');
  if (btn) { btn.textContent = '...'; btn.disabled = true; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:60,
        messages:[{ role:'user', content:'Current GTQ to MXN exchange rate today, single decimal number only, no text' }]})
    });
    const d = await r.json();
    const num = parseFloat(d.content?.[0]?.text?.trim());
    if (num > 0) {
      set('cot-tc', num.toFixed(4));
      const inv = document.getElementById('cot-tc-inv');
      if (inv) inv.value = (1/num).toFixed(4); // 1 MXN = ? GTQ
      const info = document.getElementById('cot-tc-info');
      if (info) info.textContent = '1 GTQ = ' + num.toFixed(4) + ' MXN · actualizado';
      cotCalc();
      toast('✓ TC: 1 GTQ = ' + num.toFixed(4) + ' MXN');
    } else toast('⚠ Ingresa el TC manualmente', true);
  } catch { toast('⚠ Error al consultar TC', true); }
  if (btn) { btn.textContent = '🔄 TC actual'; btn.disabled = false; }
}

function cotGetTC() { return parseFloat(v('cot-tc')) || 0; }

function cotAddProducto() {
  invEnsureDB();
  cotProdCount++;
  const n    = cotProdCount;
  const cont = document.getElementById('cot-prod-list');
  const div  = document.createElement('div');
  div.id = 'cot-prod-row-' + n;
  const color = COT_COLORS[(n-1) % COT_COLORS.length];
  div.style.cssText = 'background:var(--s3);border:1.5px solid var(--br);border-left:3px solid ' + color + ';border-radius:4px;padding:12px;margin-bottom:10px;';
  const pOpts = DB.iproductos.map(p => '<option value="' + p.id + '">' + p.nombre + '</option>').join('');
  const fs = 'background:var(--s2);border:1.5px solid var(--br);color:var(--txt);padding:7px;border-radius:4px;width:100%;font-family:var(--fm);font-size:.74rem;';
  div.innerHTML =
    '<div style="display:flex;justify-content:space-between;margin-bottom:8px;">' +
      '<span style="font-size:.64rem;color:' + color + ';font-weight:700;">PRODUCTO ' + n + '</span>' +
      '<button onclick="cotRemoveProd(' + n + ')" style="background:var(--danger);color:#fff;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:.7rem;">✕</button>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;">' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Producto</label>' +
        '<select id="cot-p-id-' + n + '" onchange="cotProdChange(' + n + ')" style="' + fs + '"><option value="">— Seleccionar —</option>' + pOpts + '</select></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Nombre en cotización</label>' +
        '<input id="cot-p-nom-' + n + '" placeholder="Nombre" oninput="cotCalc()" style="' + fs + '"></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Unidad compra</label>' +
        '<select id="cot-p-unit-' + n + '" onchange="cotUnitChange(' + n + ')" style="' + fs + '">' +
          '<option value="bolsa">Bolsa</option><option value="costal">Costal/Bulto</option>' +
          '<option value="caja">Caja</option><option value="unidad">Unidad</option>' +
          '<option value="red">Red/Malla</option><option value="kg">KG (granel)</option>' +
        '</select></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;" id="cot-p-qty-lbl-' + n + '">Cantidad</label>' +
        '<input type="number" id="cot-p-qty-' + n + '" placeholder="0" step="1" oninput="cotCalc()" style="' + fs + '"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;">' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">KG / unidad</label>' +
        '<input type="number" id="cot-p-kgu-' + n + '" step="0.01" placeholder="0" oninput="cotCalc()" style="' + fs + '"></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Total KG</label>' +
        '<input id="cot-p-kgt-' + n + '" readonly style="' + fs + 'color:var(--acc);cursor:default;"></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Total LBS</label>' +
        '<input id="cot-p-lbs-' + n + '" readonly style="' + fs + 'color:var(--acc);cursor:default;"></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Precio / ud (MXN $)</label>' +
        '<input type="number" id="cot-p-pxn-' + n + '" step="0.01" placeholder="0" oninput="cotCalc()" style="' + fs + '"></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Precio / ud (GTQ Q)</label>' +
        '<input id="cot-p-pgtq-' + n + '" readonly style="' + fs + 'color:var(--muted2);cursor:default;"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Sub-compra MXN</label>' +
        '<input id="cot-p-smxn-' + n + '" readonly style="' + fs + 'color:var(--warn);cursor:default;"></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Sub-compra GTQ</label>' +
        '<input id="cot-p-sgtq-' + n + '" readonly style="' + fs + 'color:var(--acc);cursor:default;"></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">% del contenedor (KG)</label>' +
        '<input id="cot-p-pct-kg-' + n + '" readonly style="' + fs + 'cursor:default;color:var(--muted2);"></div>' +
      '<div><label style="font-size:.62rem;color:var(--warn);font-weight:600;display:block;margin-bottom:3px;">% gastos ← editable</label>' +
        '<input type="number" id="cot-p-pct-gas-' + n + '" step="0.1" min="0" max="100" placeholder="Auto" oninput="cotCalc()" style="' + fs + 'border-color:var(--warn);color:var(--warn);font-weight:700;"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--br);">' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">% Costo fijo asignado</label>' +
        '<input type="number" id="cot-p-pct-fijo-' + n + '" step="0.1" min="0" max="100" placeholder="0" oninput="cotCalc()" style="' + fs + '"></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Costo fijo asig. Q</label>' +
        '<input id="cot-p-costo-fijo-q-' + n + '" readonly style="' + fs + 'cursor:default;color:var(--muted2);"></div>' +
      '<div><label style="font-size:.62rem;color:var(--acc);font-weight:600;display:block;margin-bottom:3px;">Costo total con fijo Q</label>' +
        '<input id="cot-p-costo-total-fijo-' + n + '" readonly style="' + fs + 'cursor:default;color:var(--acc);font-weight:700;border-color:var(--acc);"></div>' +
    '</div>';
  cont.appendChild(div);
  document.getElementById('cot-totales-row').style.display = 'block';

  if (cotTipo === 'terceros') cotAddVentaLinea(n, color);
}

function cotRemoveProd(n) {
  const r = document.getElementById('cot-prod-row-' + n);
  if (r) r.remove();
  const vr = document.getElementById('cot-vent-row-' + n);
  if (vr) vr.remove();
  cotCalc();
}

function cotAddVentaLinea(n, color) {
  const cont = document.getElementById('cot-venta-lineas');
  if (!cont) return;
  const div = document.createElement('div');
  div.id = 'cot-vent-row-' + n;
  div.style.cssText = 'border-left:3px solid ' + color + ';padding:8px 12px;margin-bottom:8px;background:var(--s2);border-radius:0 4px 4px 0;';
  const fs = 'background:var(--s1);border:1.5px solid var(--br);color:var(--txt);padding:6px;border-radius:4px;width:100%;font-family:var(--fm);font-size:.74rem;';
  div.innerHTML =
    '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:8px;align-items:end;">' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;" id="cot-vent-nom-lbl-' + n + '">Producto ' + n + '</label>' +
        '<input id="cot-vent-nom-' + n + '" readonly style="' + fs + 'cursor:default;color:var(--muted2);"></div>' +
      '<div><label style="font-size:.62rem;color:var(--acc);font-weight:600;display:block;margin-bottom:3px;">Precio venta / unidad</label>' +
        '<input type="number" id="cot-vent-precio-' + n + '" step="0.01" placeholder="0" oninput="cotCalcVenta()" style="' + fs + 'border-color:var(--acc);"></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Moneda venta</label>' +
        '<select id="cot-vent-mon-' + n + '" onchange="cotCalcVenta()" style="' + fs + '">' +
          '<option value="gtq">GTQ Q</option><option value="mxn">MXN $</option>' +
        '</select></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Total venta</label>' +
        '<input id="cot-vent-total-' + n + '" readonly style="' + fs + 'color:var(--acc);font-weight:700;cursor:default;"></div>' +
      '<div><label style="font-size:.62rem;color:var(--acc);display:block;margin-bottom:3px;">Ganancia</label>' +
        '<input id="cot-vent-gan-' + n + '" readonly style="' + fs + 'color:var(--acc);cursor:default;"></div>' +
    '</div>';
  cont.appendChild(div);
}

function cotProdChange(n) {
  invEnsureDB();
  const prod = DB.iproductos.find(p => p.id === v('cot-p-id-' + n));
  if (!prod) return;
  set('cot-p-nom-' + n, prod.nombre);
  const unitMap = { kg:'kg', bulto:'costal', caja:'caja', red:'red', unidad:'unidad' };
  const us = document.getElementById('cot-p-unit-' + n);
  if (us) us.value = unitMap[prod.unidadCompra] || 'bolsa';
  if (prod.kgBulto) set('cot-p-kgu-' + n, prod.kgBulto);
  cotCalc();
}

function cotUnitChange(n) {
  const unit = v('cot-p-unit-' + n) || 'bolsa';
  const lbl  = document.getElementById('cot-p-qty-lbl-' + n);
  const LABELS = { bolsa:'Bolsas', costal:'Costales/Bultos', caja:'Cajas', unidad:'Unidades', red:'Redes', kg:'KG total' };
  if (lbl) lbl.textContent = LABELS[unit] || 'Cantidad';
  cotCalc();
}

function cotInitGastosMX() {
  if (cotGastosMX.length > 0) return;
  ['Transporte México','Agente Aduanal México','Trasbordo / Cruce frontera MX','Laboratorios / Análisis','Tarimas','Cargadores México','Unidad Verificadora','Derechos exportación MX','Gastos varios México'].forEach(label => {
    cotGastosMX.push({ id:uid(), label, monto:0, moneda:'mxn' });
  });
  cotRenderGastos('mx');
}

function cotInitGastosGT() {
  if (cotGastosGT.length > 0) return;
  ['Agente Aduanal Guatemala','Gastos MAGA','Transporte GT (frontera → bodega)','Gastos en frontera GT','Estadía camión','Combustible','Alimentos / Viáticos','Renta unidad / camión','Descargadores GT','Renta equipo descarga','DUCA — aranceles + impuestos','Gastos varios GT'].forEach(label => {
    cotGastosGT.push({ id:uid(), label, monto:0 });
  });
  cotRenderGastos('gt');
}

function cotAddGasto(lado) {
  const label = prompt(lado==='mx'?'Nombre gasto México:':'Nombre gasto Guatemala:');
  if (!label) return;
  if (lado==='mx') cotGastosMX.push({ id:uid(), label, monto:0, moneda:'mxn' });
  else             cotGastosGT.push({ id:uid(), label, monto:0 });
  cotRenderGastos(lado);
}

function cotRenderGastos(lado) {
  const cont = document.getElementById('cot-' + lado + '-items');
  if (!cont) return;
  const list = lado==='mx' ? cotGastosMX : cotGastosGT;
  const fs   = 'background:var(--s2);border:1.5px solid var(--br);color:var(--txt);padding:6px;border-radius:3px;font-family:var(--fm);font-size:.72rem;';
  cont.innerHTML = list.map(g => lado==='mx'
    ? '<div style="display:grid;grid-template-columns:2fr 1fr 80px auto;gap:5px;align-items:center;margin-bottom:5px;">' +
        '<input value="' + escH(g.label) + '" style="' + fs + 'width:100%;" onchange="cotGastoLabel(\'mx\',\'' + g.id + '\',this.value)">' +
        '<input type="number" id="cg-' + g.id + '" value="' + (g.monto||'') + '" step="0.01" placeholder="0" oninput="cotGastoMonto(\'mx\',\'' + g.id + '\',this.value)" style="' + fs + 'width:100%;">' +
        '<select id="cgm-' + g.id + '" onchange="cotGastoMoneda(\'' + g.id + '\',this.value)" style="' + fs + 'width:100%;">' +
          '<option value="mxn"' + (g.moneda==='mxn'?' selected':'') + '>MXN</option>' +
          '<option value="gtq"' + (g.moneda==='gtq'?' selected':'') + '>GTQ</option>' +
        '</select>' +
        '<button onclick="cotDelGasto(\'mx\',\'' + g.id + '\')" style="background:var(--danger);color:#fff;border:none;padding:4px 7px;border-radius:3px;cursor:pointer;font-size:.65rem;">✕</button>' +
      '</div>'
    : '<div style="display:grid;grid-template-columns:2fr 1fr auto;gap:5px;align-items:center;margin-bottom:5px;">' +
        '<input value="' + escH(g.label) + '" style="' + fs + 'width:100%;" onchange="cotGastoLabel(\'gt\',\'' + g.id + '\',this.value)">' +
        '<input type="number" id="cg-' + g.id + '" value="' + (g.monto||'') + '" step="0.01" placeholder="0 GTQ" oninput="cotGastoMonto(\'gt\',\'' + g.id + '\',this.value)" style="' + fs + 'width:100%;">' +
        '<button onclick="cotDelGasto(\'gt\',\'' + g.id + '\')" style="background:var(--danger);color:#fff;border:none;padding:4px 7px;border-radius:3px;cursor:pointer;font-size:.65rem;">✕</button>' +
      '</div>'
  ).join('');
}

function escH(s){ return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function cotGastoLabel(l,id,v){ const g=(l==='mx'?cotGastosMX:cotGastosGT).find(x=>x.id===id); if(g)g.label=v; }
function cotGastoMonto(l,id,val){ const g=(l==='mx'?cotGastosMX:cotGastosGT).find(x=>x.id===id); if(g)g.monto=parseFloat(val)||0; cotCalc(); }
function cotGastoMoneda(id,val){ const g=cotGastosMX.find(x=>x.id===id); if(g){g.moneda=val; cotCalc();} }
function cotDelGasto(l,id){ if(l==='mx') cotGastosMX=cotGastosMX.filter(x=>x.id!==id); else cotGastosGT=cotGastosGT.filter(x=>x.id!==id); cotRenderGastos(l); cotCalc(); }

function cotCalc() {
  const tc = cotGetTC();
  if (tc > 0) {
    const inv = document.getElementById('cot-tc-inv');
    if (inv) inv.value = (1/tc).toFixed(4);
  }

  const prods = [];
  let totalKg=0, totalLbs=0, totalBultos=0, totalCompraGTQ=0;

  for (let i=1; i<=cotProdCount; i++) {
    if (!document.getElementById('cot-prod-row-' + i)) continue;
    const nom  = v('cot-p-nom-' + i) || ('Producto ' + i);
    const prodId = v('cot-p-id-' + i) || '';
    const qty  = parseFloat(v('cot-p-qty-' + i))  || 0;
    const kgu  = parseFloat(v('cot-p-kgu-' + i))  || 0;
    const pMXN = parseFloat(v('cot-p-pxn-' + i))  || 0;
    const unit = v('cot-p-unit-' + i) || 'bolsa';

    // ── BUG 2 FIX: unidad/pieza no tiene peso, pero sí tiene costo ──
    const esPorUnidad = unit === 'unidad' || unit === 'pza' || unit === 'pieza';
    const kgT  = esPorUnidad ? 0 : (unit === 'kg' ? qty : qty * kgu);
    const lbsT = esPorUnidad ? 0 : kgT * 2.20462;

    const sMXN = qty * pMXN;
    const sGTQ = tc > 0 ? sMXN / tc : 0;
    const pGTQ = tc > 0 ? pMXN / tc : 0;

    set('cot-p-kgt-' + i, kgT > 0  ? kgT.toFixed(2)  : (esPorUnidad ? 'N/A (ud)' : ''));
    set('cot-p-lbs-' + i, lbsT > 0 ? lbsT.toFixed(2) : (esPorUnidad ? 'N/A (ud)' : ''));
    set('cot-p-pgtq-' + i, pGTQ > 0 ? 'Q ' + pGTQ.toFixed(4) : (tc <= 0 ? 'Falta TC' : ''));
    set('cot-p-smxn-' + i, sMXN > 0 ? '$ ' + sMXN.toFixed(2) : '');
    set('cot-p-sgtq-' + i, sGTQ > 0 ? 'Q ' + sGTQ.toFixed(2) : (tc <= 0 && sMXN > 0 ? 'Falta TC' : ''));

    const vn = document.getElementById('cot-vent-nom-' + i);
    if (vn) vn.value = nom;

    totalKg     += kgT;
    totalLbs    += lbsT;
    totalBultos += qty;
    totalCompraGTQ += sGTQ;
    prods.push({ i, nom, qty, unit, kgu, kgT, lbsT, pMXN, pGTQ, sMXN, sGTQ, esPorUnidad, productoId: prodId });
  }

  // ── BUG 1 FIX: porcentajes ─────────────────────────────────────
  // Para productos con KG: % basado en proporción de KG sobre total
  // Para productos por unidad (sin KG): % basado en proporción del costo de compra
  const totalCompraParaPct = totalCompraGTQ > 0 ? totalCompraGTQ : 1;

  prods.forEach(p => {
    let auto;
    if (p.esPorUnidad) {
      // Unidades: su % de gastos proporcional a su costo relativo
      auto = totalCompraParaPct > 0 ? p.sGTQ / totalCompraParaPct * 100 : 0;
    } else {
      // Con peso: proporcional al KG que representa
      auto = totalKg > 0 ? p.kgT / totalKg * 100 : 0;
    }
    set('cot-p-pct-kg-' + p.i, auto > 0 ? auto.toFixed(1) + '%' : '');

    const gasEl = document.getElementById('cot-p-pct-gas-' + p.i);
    // Solo auto-rellenar si el usuario NO lo ha tocado manualmente
    if (gasEl && !gasEl._userEdited && auto > 0) {
      gasEl.value = auto.toFixed(1);
    }
  });

  // Registrar edición manual solo una vez por elemento
  document.querySelectorAll('[id^="cot-p-pct-gas-"]').forEach(el => {
    if (!el._listenerAdded) {
      el.addEventListener('input', () => { el._userEdited = true; }, { once: false });
      el._listenerAdded = true;
    }
  });

  // Advertencia si los % no suman 100
  let pctSum = 0;
  prods.forEach(p => { pctSum += parseFloat(document.getElementById('cot-p-pct-gas-' + p.i)?.value) || 0; });
  const pw = document.getElementById('cot-pct-warn');
  if (pw) pw.style.display = prods.length > 1 && Math.abs(pctSum - 100) > 0.5 ? 'block' : 'none';

  set('cot-tot-bultos', totalBultos.toFixed(0));
  set('cot-tot-kg',     totalKg > 0 ? totalKg.toFixed(2) + ' kg' : '—');
  set('cot-tot-lbs',    totalLbs > 0 ? totalLbs.toFixed(2) + ' lbs' : '—');
  set('cot-tot-mxn',    '$ ' + prods.reduce((s, p) => s + p.sMXN, 0).toFixed(2));
  set('cot-tot-gtq',    'Q ' + totalCompraGTQ.toFixed(2));

  const bar = document.getElementById('cot-pct-bar');
  if (bar && prods.length > 0) {
    bar.innerHTML = prods.map((p, idx) => {
      // Barra proporcional al costo de compra (funciona para todos los tipos)
      const pct = totalCompraGTQ > 0 ? p.sGTQ / totalCompraGTQ * 100 : 0;
      return '<div style="flex:' + pct + ';background:' + COT_COLORS[idx % COT_COLORS.length] + ';display:flex;align-items:center;justify-content:center;font-size:.58rem;color:var(--green-deep);font-weight:700;overflow:hidden;white-space:nowrap;padding:0 3px;" title="' + p.nom + ' ' + pct.toFixed(1) + '%">' + (pct > 8 ? p.nom.split(' ')[0] + ' ' + pct.toFixed(0) + '%' : '') + '</div>';
    }).join('');
  }

  let subMXmxn=0, subMXgtq=0, subGTgtq=0;
  cotGastosMX.forEach(g => {
    const m = g.monto || 0;
    if (g.moneda === 'mxn') { subMXmxn += m; subMXgtq += tc > 0 ? m / tc : 0; }
    else { subMXgtq += m; }
  });
  cotGastosGT.forEach(g => { subGTgtq += g.monto || 0; });

  const totalGastos = subMXgtq + subGTgtq;
  const totalCosto  = totalCompraGTQ + totalGastos;

  set('cot-sub-mx-mxn',    '$ ' + subMXmxn.toFixed(2));
  set('cot-sub-mx-gtq',    'Q ' + subMXgtq.toFixed(2));
  set('cot-sub-gt-gtq',    'Q ' + subGTgtq.toFixed(2));
  set('cot-total-gastos',  'Q ' + totalGastos.toFixed(2));
  set('cot-total-compra',  'Q ' + totalCompraGTQ.toFixed(2));
  set('cot-total-total',   'Q ' + totalCosto.toFixed(2));

  if (prods.length === 0 || totalCompraGTQ === 0) {
    document.getElementById('cot-resultados').style.display = 'none';
    return;
  }

  const rows = prods.map((p, idx) => {
    const pctGasEl  = document.getElementById('cot-p-pct-gas-'  + p.i);
    const pctFijoEl = document.getElementById('cot-p-pct-fijo-' + p.i);

    // % gastos: lo que el usuario puso, o el auto calculado
    let pctGasVal;
    if (pctGasEl && pctGasEl._userEdited) {
      pctGasVal = parseFloat(pctGasEl.value) || 0;
    } else {
      pctGasVal = p.esPorUnidad
        ? (totalCompraParaPct > 0 ? p.sGTQ / totalCompraParaPct * 100 : 0)
        : (totalKg > 0 ? p.kgT / totalKg * 100 : 0);
    }
    const pctGas  = pctGasVal / 100;
    const pctFijo = (parseFloat(pctFijoEl?.value) || 0) / 100;

    const gastosP    = totalGastos * pctGas;
    const costoFijoQ = p.sGTQ * pctFijo;
    const costoTot   = p.sGTQ + gastosP;                    // sin % fijo
    const costoConFijo = costoTot + costoFijoQ;             // con % fijo

    // ── BUG 2 + 3 FIX: costo por unidad/kg/lb ────────────────────
    const costoUd  = p.qty  > 0 ? costoConFijo / p.qty  : 0;
    const costoKg  = p.kgT  > 0 ? costoConFijo / p.kgT  : 0;  // 0 si es por unidad
    const costoLb  = p.lbsT > 0 ? costoConFijo / p.lbsT : 0;  // 0 si es por unidad

    // ── BUG 3 FIX: última columna era costoLb en vez de costoConFijo/lbsT ──
    // Para unidades: mostrar costo/ud en lugar de costo/lb
    const costoLbConFijo = p.lbsT > 0 ? costoConFijo / p.lbsT : (p.qty > 0 ? costoConFijo / p.qty : 0);

    const cfqEl = document.getElementById('cot-p-costo-fijo-q-'  + p.i);
    const ctfEl = document.getElementById('cot-p-costo-total-fijo-' + p.i);
    if (cfqEl) cfqEl.value = costoFijoQ > 0 ? 'Q ' + costoFijoQ.toFixed(2) : '';
    if (ctfEl) ctfEl.value = costoConFijo > 0 ? 'Q ' + costoConFijo.toFixed(2) : '';

    return { ...p, pctGas: pctGasVal, pctFijo: pctFijo * 100, gastosP, costoFijoQ, costoTot, costoConFijo, costoUd, costoKg, costoLb, costoLbConFijo, color: COT_COLORS[idx % COT_COLORS.length] };
  });

  // Guardar en elemento para cotCalcVenta
  document.getElementById('cot-resultados')._computed = { rows, totalKg, totalLbs, totalBultos, totalCompraGTQ, totalGastos, totalCosto, tc, subMX: subMXgtq, subGT: subGTgtq };
  document.getElementById('cot-resultados').style.display = 'block';

  // ── BUG 3 FIX: tabla de resultados con columnas correctas ────────
  document.getElementById('cot-res-tabla').innerHTML =
    '<table style="width:100%;font-size:.72rem;"><thead><tr>' +
    '<th>Producto</th><th>Uds</th><th>KG</th><th>LBS</th><th>%gastos</th><th>Compra Q</th><th>Gastos Q</th>' +
    '<th style="background:rgba(0,217,139,.1);">Costo tot Q</th>' +
    '<th style="background:rgba(0,217,139,.12);">Costo/ud Q</th>' +
    '<th style="background:rgba(74,158,255,.1);">Costo/kg Q</th>' +
    '<th style="background:rgba(74,158,255,.15);">Costo/lb Q</th>' +
    '<th>% Fijo</th>' +
    '<th style="background:rgba(160,120,255,.1);">Costo+Fijo/lb Q</th>' +
    '</tr></thead><tbody>' +
    rows.map(r => {
      const kgStr  = r.esPorUnidad ? '<span style="color:var(--muted2);font-size:.65rem;">—</span>'   : r.kgT.toFixed(1);
      const lbsStr = r.esPorUnidad ? '<span style="color:var(--muted2);font-size:.65rem;">—</span>'   : r.lbsT.toFixed(1);
      const kgCStr = r.esPorUnidad ? '<span style="color:var(--muted2);font-size:.65rem;">N/A</span>' : 'Q ' + r.costoKg.toFixed(4);
      const lbCStr = r.esPorUnidad ? '<span style="color:var(--muted2);font-size:.65rem;">N/A</span>' : 'Q ' + r.costoLb.toFixed(4);
      const lbFStr = r.esPorUnidad
        ? '<span style="color:var(--muted2);font-size:.65rem;">Q ' + r.costoLbConFijo.toFixed(4) + '/ud</span>'
        : 'Q ' + r.costoLbConFijo.toFixed(4);
      return '<tr>' +
        '<td><span style="display:inline-block;width:7px;height:7px;background:' + r.color + ';border-radius:50%;margin-right:4px;"></span><strong>' + r.nom + '</strong>' +
        (r.esPorUnidad ? ' <span style="font-size:.6rem;color:var(--info);">(ud)</span>' : '') + '</td>' +
        '<td>' + r.qty + '</td>' +
        '<td>' + kgStr + '</td>' +
        '<td>' + lbsStr + '</td>' +
        '<td style="color:var(--warn);">' + r.pctGas.toFixed(1) + '%</td>' +
        '<td>Q ' + r.sGTQ.toFixed(2) + '</td>' +
        '<td style="color:var(--warn);">Q ' + r.gastosP.toFixed(2) + '</td>' +
        '<td style="background:rgba(0,217,139,.06);font-weight:700;">Q ' + r.costoTot.toFixed(2) + '</td>' +
        '<td style="background:rgba(0,217,139,.1);color:var(--acc);font-weight:700;">Q ' + r.costoUd.toFixed(4) + '</td>' +
        '<td style="background:rgba(74,158,255,.08);color:var(--info);">' + kgCStr + '</td>' +
        '<td style="background:rgba(74,158,255,.12);color:var(--info);">' + lbCStr + '</td>' +
        '<td style="color:var(--muted2);">' + r.pctFijo.toFixed(1) + '%</td>' +
        '<td style="background:rgba(160,120,255,.12);color:#a078ff;font-weight:700;">' + lbFStr + '</td>' +
        '</tr>';
    }).join('') + '</tbody>' +
    // Fila de totales
    '<tfoot><tr style="background:var(--s1);font-weight:700;border-top:2px solid var(--br);">' +
    '<td>TOTALES</td>' +
    '<td>' + rows.reduce((s,r)=>s+r.qty,0).toFixed(0) + '</td>' +
    '<td>' + (totalKg > 0 ? totalKg.toFixed(1) : '—') + '</td>' +
    '<td>' + (totalLbs > 0 ? totalLbs.toFixed(1) : '—') + '</td>' +
    '<td>' + (rows.reduce((s,r)=>s+r.pctGas,0)).toFixed(1) + '%</td>' +
    '<td>Q ' + totalCompraGTQ.toFixed(2) + '</td>' +
    '<td>Q ' + totalGastos.toFixed(2) + '</td>' +
    '<td style="background:rgba(0,217,139,.1);">Q ' + totalCosto.toFixed(2) + '</td>' +
    '<td colspan="5"></td>' +
    '</tr></tfoot>' +
    '</table>';

  if (cotTipo === 'terceros') cotCalcVenta();
}

function cotCalcVenta() {
  const tc = cotGetTC();
  let totalVentaGTQ=0, totalCostoGTQ=0;
  const computed = document.getElementById('cot-resultados')?._computed;

  for (let i=1; i<=cotProdCount; i++) {
    if (!document.getElementById('cot-prod-row-'+i)) continue;
    const qty    = parseFloat(v('cot-p-qty-'+i)) || 0;
    const precio = parseFloat(v('cot-vent-precio-'+i)) || 0;
    const mon    = v('cot-vent-mon-'+i) || 'gtq';
    const ventaGTQ = mon==='mxn' ? (tc>0 ? precio*qty*tc : 0) : precio*qty;
    const row = computed?.rows?.find(r=>r.i===i);
    const costoTot = row?.costoTot || 0;
    const ganancia = ventaGTQ - costoTot;
    set('cot-vent-total-'+i, ventaGTQ>0 ? 'Q '+ventaGTQ.toFixed(2) : '');
    set('cot-vent-gan-'+i, costoTot>0 ? (ganancia>=0?'▲ Q ':'▼ Q ')+Math.abs(ganancia).toFixed(2) : '');
    const ganEl = document.getElementById('cot-vent-gan-'+i);
    if (ganEl) ganEl.style.color = ganancia>=0 ? 'var(--acc)' : 'var(--danger)';
    totalVentaGTQ += ventaGTQ;
    totalCostoGTQ += costoTot;
  }
  const ganBruta = totalVentaGTQ - totalCostoGTQ;
  const margen   = totalVentaGTQ>0 ? ganBruta/totalVentaGTQ*100 : 0;
  set('cot-vent-total',   'Q '+totalVentaGTQ.toFixed(2));
  set('cot-vent-ganancia','Q '+ganBruta.toFixed(2));
  set('cot-vent-margen',  margen.toFixed(1)+'%');
  const vr = document.getElementById('cot-venta-resumen');
  if (vr) vr.style.display = totalVentaGTQ>0 ? 'block':'none';
}

function saveCot() {
  invEnsureDB();
  const computed = document.getElementById('cot-resultados')?._computed;
  if (!computed?.rows?.length) { toast('⚠ Agrega productos y calcula primero', true); return; }
  const nombre = v('cot-nombre') || ('Cotización '+new Date().toLocaleDateString('es-GT'));

  const ventaData = cotTipo==='terceros' ? computed.rows.map(r => {
    const precio = parseFloat(v('cot-vent-precio-'+r.i)) || 0;
    const mon    = v('cot-vent-mon-'+r.i) || 'gtq';
    return { i:r.i, nom:r.nom, precio, moneda:mon };
  }) : [];

  const rec = {
    id:uid(), ts:now(),
    tipo: cotTipo,
    estado: 'borrador',
    fecha:  v('cot-fecha') || new Date().toISOString().split('T')[0],
    nombre, duca:v('cot-duca'), obs:v('cot-obs'),
    tc: cotGetTC(),
    cliente:    cotTipo==='terceros' ? v('cot-ter-cliente')  : null,
    pais:       cotTipo==='terceros' ? v('cot-ter-pais')     : null,
    monedaCli:  cotTipo==='terceros' ? v('cot-ter-moneda')   : null,
    gastosMX:   cotGastosMX.map(g=>({...g})),
    gastosGT:   cotGastosGT.map(g=>({...g})),
    productos:  computed.rows.map(r => ({
      i:r.i, nom:r.nom, qty:r.qty, unit:r.unit, kgu:r.kgu, kgT:r.kgT, lbsT:r.lbsT,
      pMXN:r.pMXN, pGTQ:r.pGTQ, sMXN:r.sMXN, sGTQ:r.sGTQ, pctGas:r.pctGas,
      gastosP:r.gastosP, costoTot:r.costoTot, costoUd:r.costoUd, costoKg:r.costoKg, costoLb:r.costoLb,
      productoId: r.productoId || '',
    })),
    ventaLineas: ventaData,
    totalKg:computed.totalKg, totalLbs:computed.totalLbs, totalBultos:computed.totalBultos,
    totalCompraGTQ:computed.totalCompraGTQ, totalGastos:computed.totalGastos, totalCosto:computed.totalCosto,
    anticipos: [],
    pagos:     [],
    ducaInfo:  null,
    bodegaInfo:null,
  };

  if (cotActivaId) {
    const idx = DB.cotizaciones.findIndex(c=>c.id===cotActivaId);
    if (idx>=0) { const old=DB.cotizaciones[idx]; rec.id=old.id; rec.ts=old.ts; rec.anticipos=old.anticipos||[]; rec.pagos=old.pagos||[]; rec.ducaInfo=old.ducaInfo; rec.bodegaInfo=old.bodegaInfo; rec.estado=old.estado; DB.cotizaciones[idx]=rec; }
  } else {
    DB.cotizaciones.unshift(rec);
    cotActivaId = rec.id;
  }
  save(); renderCotList();
  toast('✓ "'+nombre+'" guardada');
  cotMainTab('lista', null);
}

function cotVerDetalle(id) {
  invEnsureDB();
  const rec = DB.cotizaciones.find(c=>c.id===id);
  if (!rec) return;
  cotActivaId = id;

  document.getElementById('cot-panel-form').style.display = 'none';
  document.getElementById('cot-panel-lista').style.display = 'none';
  document.getElementById('cot-panel-detalle').style.display = 'block';

  set('det-nombre', rec.nombre);
  const meta = [rec.fecha,
    rec.tipo==='interno' ? 'Cotización Interna' : '🤝 Terceros — Cliente: '+(rec.cliente||'—'),
    rec.pais ? 'Destino: '+rec.pais : '',
    rec.duca ? 'DUCA: '+rec.duca : ''
  ].filter(Boolean).join(' · ');
  set('det-meta', meta);

  const estInfo = COT_ESTADOS[rec.estado] || COT_ESTADOS.borrador;
  const badge = document.getElementById('det-estado-badge');
  if (badge) badge.innerHTML = '<span class="chip" style="background:rgba(0,65,45,.08);border:1.5px solid '+estInfo.color+';color:'+estInfo.color+';font-size:.7rem;padding:4px 10px;">'+estInfo.icon+' '+estInfo.label+'</span>';

  // Pipeline steps differ by tipo
  const esTerceros = rec.tipo === 'terceros';
  const steps = esTerceros
    ? ['borrador','aceptada','en_entrega','entregada','pagado']
    : ['borrador','anticipos','duca','bodega'];
  const curIdx = steps.indexOf(rec.estado);
  const pipe = document.getElementById('det-pipeline');
  if (pipe) {
    pipe.innerHTML = steps.map((s,idx) => {
      const info = COT_ESTADOS[s];
      const done = idx <= curIdx;
      return '<div style="display:flex;align-items:center;">' +
        '<div style="padding:6px 12px;border-radius:3px;font-size:.68rem;font-weight:700;white-space:nowrap;' +
          'background:'+(done?'rgba(0,217,139,.12)':'var(--s3)')+';' +
          'border:1.5px solid '+(done?info.color:'var(--br)')+';' +
          'color:'+(done?info.color:'var(--muted2)')+'">'+
          info.icon+' '+info.label+'</div>' +
        (idx<steps.length-1 ? '<div style="width:20px;height:2px;background:'+(done&&idx<curIdx?'var(--acc)':'var(--br)')+'"></div>' : '') +
      '</div>';
    }).join('');
  }

  // ── TAB VISIBILITY ──────────────────────────────────────────────────
  const tabAnticipo = document.getElementById('det-tab-anticipos');
  const tabDuca     = document.getElementById('det-tab-duca');
  const tabPagos    = document.getElementById('det-tab-pagos');
  const tabEntrega  = document.getElementById('det-tab-entrega');

  if (esTerceros) {
    // TERCEROS: Anticipos MX always visible (fondos propios a MX)
    // Pagos Cliente visible once aceptada
    // Entrega tab visible once en_entrega
    // DUCA+Bodega hidden (not for terceros)
    const estadosConPagos    = ['aceptada','en_entrega','entregada','pagado'];
    const estadosConEntrega  = ['en_entrega','entregada','pagado'];
    if (tabAnticipo) tabAnticipo.style.display = '';
    if (tabDuca)     tabDuca.style.display     = 'none';
    if (tabPagos)    tabPagos.style.display    = estadosConPagos.includes(rec.estado) ? '' : 'none';
    if (tabEntrega)  tabEntrega.style.display  = estadosConEntrega.includes(rec.estado) ? '' : 'none';
  } else {
    // INTERNO: classic flow
    if (tabAnticipo) tabAnticipo.style.display = '';
    if (tabDuca)     tabDuca.style.display     = '';
    if (tabPagos)    tabPagos.style.display    = 'none';
    if (tabEntrega)  tabEntrega.style.display  = 'none';
  }

  // ── ACTION BUTTONS ────────────────────────────────────────────────
  const btnAceptar    = document.getElementById('det-btn-aceptar');
  const btnEntrega    = document.getElementById('det-btn-entrega');
  const btnDespachar  = document.getElementById('det-btn-despachar');
  const btnEntregado  = document.getElementById('det-btn-entregado');

  if (esTerceros) {
    // "Marcar Aceptada" → visible in borrador
    if (btnAceptar) {
      btnAceptar.style.display = rec.estado === 'borrador' ? '' : 'none';
      btnAceptar.textContent = '🤝 Cliente acepta — marcar aceptada';
    }
    // "Proceder a Entrega" → visible when aceptada
    if (btnEntrega) {
      btnEntrega.style.display = rec.estado === 'aceptada' ? '' : 'none';
    }
    // "Crear Despacho" old button — hide for terceros (replaced by Entregado)
    if (btnDespachar) btnDespachar.style.display = 'none';
    // "Marcar Entregado" → visible in en_entrega
    if (btnEntregado) {
      btnEntregado.style.display = rec.estado === 'en_entrega' ? '' : 'none';
    }
  } else {
    // INTERNO
    if (btnAceptar)   btnAceptar.style.display   = 'none';
    if (btnEntrega)   btnEntrega.style.display   = 'none';
    if (btnEntregado) btnEntregado.style.display = 'none';
    if (btnDespachar) btnDespachar.style.display = 'none';
  }

  detTab('resumen', document.getElementById('det-tab-resumen'));
  renderDetResumen(rec);

  // Populate pagos tab if visible
  if (esTerceros) {
    renderAnticipos(rec);
    if (['aceptada','en_entrega','entregada','pagado'].includes(rec.estado)) renderPagos(rec);
    if (['en_entrega','entregada','pagado'].includes(rec.estado)) {
      renderDucaPanel(rec);
      renderEntregaPanel(rec);
    }
  } else {
    renderAnticipos(rec);
    renderDucaPanel(rec);
  }
}

function detTab(tab, el) {
  ['resumen','anticipos','duca','pagos','entrega'].forEach(t => {
    const btn = document.getElementById('det-tab-'+t); if (btn) btn.classList.remove('active');
    const pan = document.getElementById('det-panel-'+t); if (pan) pan.style.display='none';
  });
  if (el) el.classList.add('active');
  const pan = document.getElementById('det-panel-'+tab); if (pan) pan.style.display='block';
  const rec = DB.cotizaciones.find(c=>c.id===cotActivaId);
  if (!rec) return;
  if (tab==='anticipos') renderAnticipos(rec);
  if (tab==='duca')      renderDucaPanel(rec);
  if (tab==='pagos')     renderPagos(rec);
  if (tab==='entrega')   renderEntregaPanel(rec);
}

function renderDetResumen(rec) {
  const div = document.getElementById('det-resumen-html'); if (!div) return;
  const totalVentaGTQ = rec.ventaLineas?.reduce((s,vl) => {
    const p = rec.productos?.find(pr=>pr.i===vl.i);
    if (!p) return s;
    return s + (vl.moneda==='mxn' ? (rec.tc>0?vl.precio*p.qty*rec.tc:0) : vl.precio*p.qty);
  }, 0) || 0;
  const ganBruta = totalVentaGTQ - rec.totalCosto;
  const margen   = totalVentaGTQ>0 ? ganBruta/totalVentaGTQ*100 : 0;

  // Status banner for terceros
  let statusBanner = '';
  if (rec.tipo === 'terceros') {
    const pais = (rec.pais||'GT');
    const paisLabel = pais==='GT'?'🇬🇹 Guatemala':pais==='MX'?'🇲🇽 México':pais;
    const totAnticipo = (rec.anticipos||[]).reduce((s,a)=>s+a.gtq,0);
    const totPago     = (rec.pagos||[]).reduce((s,p)=>s+(p.gtq||0),0);
    statusBanner = '<div style="background:rgba(74,158,255,.07);border:1.5px solid rgba(74,158,255,.25);border-radius:4px;padding:12px;margin-bottom:14px;">' +
      '<div style="font-size:.6rem;color:var(--info);font-weight:700;letter-spacing:.08em;margin-bottom:8px;">🤝 COTIZACIÓN TERCEROS</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;font-size:.72rem;">' +
        '<div><span style="color:var(--muted2);">Cliente:</span> <strong>'+( rec.cliente||'—')+'</strong></div>' +
        '<div><span style="color:var(--muted2);">Destino:</span> <strong>'+paisLabel+'</strong></div>' +
        (rec.fechaAceptada ? '<div><span style="color:var(--muted2);">Aceptada:</span> <strong style="color:var(--acc);">'+rec.fechaAceptada+'</strong></div>' : '') +
        (rec.fechaEntrega  ? '<div><span style="color:var(--muted2);">Entregada:</span> <strong style="color:#00d98b;">'+rec.fechaEntrega+' — '+rec.entregaReceptor+'</strong></div>' : '') +
        (totAnticipo>0 ? '<div><span style="color:var(--muted2);">Anticipos MX:</span> <strong style="color:var(--warn);">Q '+totAnticipo.toFixed(2)+'</strong></div>' : '') +
        (totPago>0     ? '<div><span style="color:var(--muted2);">Pagos cliente:</span> <strong style="color:var(--acc);">Q '+totPago.toFixed(2)+'</strong></div>' : '') +
      '</div>' +
      (rec.estado==='borrador' ? '<div style="margin-top:10px;padding:8px;background:rgba(245,197,24,.08);border-radius:4px;font-size:.7rem;color:var(--warn);">⏳ Pendiente — el cliente aún no ha aceptado la cotización. Haz clic en "Cliente acepta" cuando confirme.</div>' : '') +
      (rec.estado==='entregada' && rec.entregaFoto ? '<div style="margin-top:8px;"><img src="'+rec.entregaFoto+'" style="max-height:120px;border-radius:4px;border:1.5px solid var(--br);"></div>' : '') +
    '</div>';
  }

  const cards = [
    { l:'Costo total', v:'Q '+rec.totalCosto.toFixed(2), c:'var(--warn)' },
    { l:'Compra producto', v:'Q '+rec.totalCompraGTQ.toFixed(2), c:'var(--muted2)' },
    { l:'Gastos logística', v:'Q '+rec.totalGastos.toFixed(2), c:'var(--muted2)' },
    { l:'Total KG', v:rec.totalKg.toFixed(1)+' kg', c:'var(--txt)' },
    { l:'Total LBS', v:rec.totalLbs.toFixed(1)+' lbs', c:'var(--txt)' },
    { l:'TC MXN→GTQ', v:'1 MXN = '+(rec.tc||'—')+' GTQ', c:'var(--muted2)' },
  ];
  if (rec.tipo==='terceros' && totalVentaGTQ>0) {
    cards.push({ l:'Total venta', v:'Q '+totalVentaGTQ.toFixed(2), c:'var(--acc)' });
    cards.push({ l:'Ganancia bruta', v:'Q '+ganBruta.toFixed(2), c:ganBruta>=0?'var(--acc)':'var(--danger)' });
    cards.push({ l:'Margen', v:margen.toFixed(1)+'%', c:margen>=0?'var(--acc)':'var(--danger)' });
  }

  const totAnticipo  = (rec.anticipos||[]).reduce((s,a)=>s+a.gtq,0);
  const totPagoGTQ   = (rec.pagos||[]).reduce((s,p)=>s+(p.gtq||0),0);
  const totPagoMXN   = (rec.pagos||[]).reduce((s,p)=>s+(p.mxn||0),0);
  if (totAnticipo>0)   cards.push({ l:'Anticipos enviados MX', v:'Q '+totAnticipo.toFixed(2), c:'var(--warn)' });
  if (totPagoGTQ>0)    cards.push({ l:'Pagos recibidos GT', v:'Q '+totPagoGTQ.toFixed(2), c:'var(--acc)' });
  if (rec.ducaInfo?.numero) cards.push({ l:'DUCA', v:rec.ducaInfo.numero, c:'#a078ff' });
  if (rec.bodegaInfo) cards.push({ l:'Recibido en bodega', v:rec.bodegaInfo.fecha, c:'var(--acc)' });

  div.innerHTML = statusBanner +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:14px;">' +
    cards.map(c => '<div style="background:var(--s2);border:1.5px solid var(--br);border-radius:4px;padding:10px;text-align:center;"><div style="font-size:.58rem;color:var(--muted2);margin-bottom:3px;">'+c.l+'</div><div style="font-family:var(--fh);font-size:.84rem;font-weight:700;color:'+c.c+';">'+c.v+'</div></div>').join('') + '</div>' +
    '<div style="overflow-x:auto;"><table style="font-size:.72rem;"><thead><tr><th>Producto</th><th>Uds</th><th>KG</th><th>LBS</th><th>Costo/ud Q</th><th>Costo/kg Q</th><th>Costo/lb Q</th>' + (rec.tipo==='terceros'?'<th>P.Vta/ud</th>':'') + '</tr></thead><tbody>' +
    (rec.productos||[]).map((p,idx) => {
      const vl = rec.ventaLineas?.find(vl=>vl.i===p.i);
      const ventaStr = vl ? (vl.moneda==='mxn'?'$':'Q')+' '+vl.precio.toFixed(2) : '—';
      return '<tr><td><span style="display:inline-block;width:7px;height:7px;background:'+COT_COLORS[idx%COT_COLORS.length]+';border-radius:50%;margin-right:4px;"></span><strong>'+p.nom+'</strong></td>' +
        '<td>'+p.qty+'</td><td>'+p.kgT.toFixed(1)+'</td><td>'+p.lbsT.toFixed(1)+'</td>' +
        '<td style="color:var(--acc);">Q '+p.costoUd.toFixed(4)+'</td>' +
        '<td style="color:var(--info);">Q '+p.costoKg.toFixed(4)+'</td>' +
        '<td style="color:var(--info);">Q '+p.costoLb.toFixed(4)+'</td>' +
        (rec.tipo==='terceros'?'<td style="color:var(--acc);">'+ventaStr+'</td>':'') + '</tr>';
    }).join('') + '</tbody></table></div>';
}

function cotEditarDesde() {
  const rec = DB.cotizaciones.find(c=>c.id===cotActivaId); if (!rec) return;
  cotTipo = rec.tipo;
  const tab = rec.tipo==='interno' ? 'interno' : 'terceros';
  cotMainTab(tab, document.getElementById('cot-tab-'+tab));
  setTimeout(() => {
    set('cot-nombre', rec.nombre); set('cot-fecha', rec.fecha); set('cot-duca', rec.duca||''); set('cot-obs', rec.obs||'');
    set('cot-tc', rec.tc||'');
    if (rec.tipo==='terceros') { set('cot-ter-cliente',rec.cliente||''); const ps=document.getElementById('cot-ter-pais'); if(ps)ps.value=rec.pais||'GT'; }
    if (rec.gastosMX) { cotGastosMX=rec.gastosMX.map(g=>({...g})); cotRenderGastos('mx'); }
    if (rec.gastosGT) { cotGastosGT=rec.gastosGT.map(g=>({...g})); cotRenderGastos('gt'); }
    document.getElementById('cot-prod-list').innerHTML=''; cotProdCount=0;
    (rec.productos||[]).forEach(p => {
      cotAddProducto();
      const n = cotProdCount;
      set('cot-p-nom-'+n, p.nom||''); set('cot-p-qty-'+n, p.qty||''); set('cot-p-kgu-'+n, p.kgu||''); set('cot-p-pxn-'+n, p.pMXN||'');
      if (p.productoId) { const sel=document.getElementById('cot-p-id-'+n); if(sel) sel.value=p.productoId; }
      const us=document.getElementById('cot-p-unit-'+n); if(us) us.value=p.unit||'bolsa';
      const ge=document.getElementById('cot-p-pct-gas-'+n); if(ge){ge.value=p.pctGas?.toFixed(1)||'';ge._userSet=true;}
      const vl=rec.ventaLineas?.find(vl=>vl.i===p.i);
      if(vl&&rec.tipo==='terceros'){ set('cot-vent-precio-'+n,vl.precio||''); const ms=document.getElementById('cot-vent-mon-'+n); if(ms)ms.value=vl.moneda||'gtq'; }
    });
    cotActivaId = rec.id;
    cotCalc();
  }, 50);
}

function antCalc() {
  const gtq = parseFloat(v('ant-gtq')) || 0;
  const tc  = parseFloat(v('ant-tc'))  || 0;
  set('ant-mxn-result', tc>0 && gtq>0 ? '$ '+(gtq*tc).toFixed(2)+' MXN' : '');
}

async function antFetchTC() {
  const btn = document.querySelector('button[onclick="antFetchTC()"]');
  if (btn) { btn.textContent='...'; btn.disabled=true; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_API_KEY,'anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:60,
        messages:[{role:'user',content:'Current GTQ to MXN exchange rate as a single decimal number only'}]})});
    const d = await r.json();
    const num = parseFloat(d.content?.[0]?.text?.trim());
    if (num>0) { set('ant-tc', num.toFixed(4)); antCalc(); toast('✓ TC: 1 GTQ = '+num.toFixed(4)+' MXN'); }
    else toast('⚠ Ingresa el TC manualmente',true);
  } catch { toast('⚠ Error',true); }
  if (btn) { btn.textContent='🔄'; btn.disabled=false; }
}

function saveAnticipo() {
  const rec = DB.cotizaciones.find(c=>c.id===cotActivaId); if(!rec) { toast('⚠ No hay cotización activa',true); return; }
  const gtq   = parseFloat(v('ant-gtq')) || 0;
  const tc    = parseFloat(v('ant-tc'))  || 0;
  if (!gtq) { toast('⚠ Ingresa el monto enviado',true); return; }
  if (!tc)  { toast('⚠ Ingresa el TC del día',true); return; }
  const mxn   = gtq * tc;
  const fecha = v('ant-fecha') || today();
  const ref   = v('ant-ref');
  const obs   = v('ant-obs');
  const metodo= v('ant-metodo') || 'banco';
  const antId = uid();

  rec.anticipos = rec.anticipos || [];
  rec.anticipos.push({ id:antId, ts:now(), fecha, metodo, gtq, tc, mxn, ref, obs });
  if (rec.estado==='borrador') rec.estado = 'anticipos';

  // ── Registrar como gasto diario contable ─────────────────────
  if (!DB.gastosDiarios) DB.gastosDiarios = [];
  DB.gastosDiarios.unshift({
    id: uid(), ts: now(),
    fecha,
    cat:    'imp-anticipo',
    monto:  gtq,
    desc:   'Anticipo MX — ' + (rec.nombre||rec.id) + (ref?' · '+ref:''),
    metodo: metodo === 'banco' ? 'banco' : 'efectivo',
    pagadoPor: 'empresa',
    devolucionPendiente: false,
    cotizacionId:  rec.id,
    anticipo_mxn:  mxn,
    anticipo_tc:   tc,
    anticipo_ref:  antId,   // link back to anticipo for dedup
    foto: null,
  });

  ['ant-gtq','ant-tc','ant-ref','ant-obs'].forEach(id=>set(id,''));
  set('ant-mxn-result','');
  save(); renderAnticipos(rec); renderDetResumen(rec); renderCotList();
  toast('✓ Anticipo registrado — Q'+gtq.toFixed(2)+' → $'+mxn.toFixed(2)+' MXN · contabilizado en gastos');
}

function delAnticipo(cotId, antId) {
  const rec = DB.cotizaciones.find(c=>c.id===cotId); if(!rec) return;
  rec.anticipos = (rec.anticipos||[]).filter(a=>a.id!==antId);
  if (!rec.anticipos.length && rec.estado==='anticipos') rec.estado='borrador';
  // Eliminar también el gasto diario vinculado
  if (DB.gastosDiarios) {
    DB.gastosDiarios = DB.gastosDiarios.filter(g => g.anticipo_ref !== antId);
  }
  save(); renderAnticipos(rec); renderDetResumen(rec); renderCotList();
  toast('Anticipo eliminado');
}

function renderAnticipos(rec) {
  const tb = document.getElementById('ant-tbody'); if(!tb) return;
  const ants = rec.anticipos || [];
  const totGTQ = ants.reduce((s,a)=>s+a.gtq,0);
  const totMXN = ants.reduce((s,a)=>s+a.mxn,0);
  const saldo  = rec.totalCosto - totGTQ;

  const resEl = document.getElementById('ant-resumen');
  if (resEl) {
    resEl.style.display = ants.length>0 ? 'block':'none';
    set('ant-tot-gtq', 'Q '+totGTQ.toFixed(2));
    set('ant-tot-mxn', '$ '+totMXN.toFixed(2));
    set('ant-cot-total', 'Q '+rec.totalCosto.toFixed(2));
    set('ant-saldo', saldo>=0?'Q '+saldo.toFixed(2):'✅ Cubierto');
    const pct = rec.totalCosto>0 ? Math.min(totGTQ/rec.totalCosto*100,100) : 0;
    const bar = document.getElementById('ant-progress-bar');
    const pctLbl = document.getElementById('ant-pct-lbl');
    if (bar) { bar.style.width=pct.toFixed(1)+'%'; bar.style.background=pct>=100?'var(--acc)':'linear-gradient(90deg,var(--warn),var(--acc))'; }
    if (pctLbl) { pctLbl.textContent=pct.toFixed(1)+'%'; pctLbl.style.color=pct>=100?'var(--acc)':'var(--warn)'; }
    const sEl = document.getElementById('ant-saldo');
    if (sEl) sEl.style.color = saldo<=0 ? 'var(--acc)':'var(--danger)';
    const sCard = document.getElementById('ant-saldo-card');
    if (sCard) { sCard.style.background=saldo<=0?'rgba(0,217,139,.08)':'rgba(255,56,88,.08)'; sCard.style.borderColor=saldo<=0?'rgba(0,217,139,.3)':'rgba(255,56,88,.3)'; }
  }

  const fd = document.getElementById('ant-fecha');
  if (fd && !fd.value) fd.value = today();

  const METODO = { banco:'🏦 Banco', osmo:'📱 OSMO', cambista:'💵 Cambista' };
  if (!ants.length) { tb.innerHTML='<tr><td colspan="8"><div class="empty">Sin anticipos registrados</div></td></tr>'; return; }
  tb.innerHTML = ants.map(a =>
    '<tr>' +
    '<td>'+a.fecha+'</td>' +
    '<td>'+(METODO[a.metodo]||a.metodo)+'</td>' +
    '<td style="color:var(--warn);font-weight:700;">Q '+a.gtq.toFixed(2)+'</td>' +
    '<td>'+a.tc+'</td>' +
    '<td style="color:var(--acc);font-weight:700;">$ '+a.mxn.toFixed(2)+'</td>' +
    '<td style="font-size:.7rem;">'+( a.ref||'—')+'</td>' +
    '<td style="font-size:.7rem;">'+( a.obs||'—')+'</td>' +
    '<td><button class="btn bo bsm" style="border-color:var(--danger);color:var(--danger);" onclick="delAnticipo(\''+rec.id+'\',\''+a.id+'\')">✕</button></td>' +
    '</tr>'
  ).join('');
}

function renderDucaPanel(rec) {
  if (rec.ducaInfo) {
    set('duca-numero',     rec.ducaInfo.numero||'');
    set('duca-fecha',      rec.ducaInfo.fecha||'');
    set('duca-agente',     rec.ducaInfo.agente||'');
    set('duca-aranceles',  rec.ducaInfo.aranceles||'');
    set('duca-otros',      rec.ducaInfo.otros||'');
    const badge = document.getElementById('duca-doc-badge');
    if (badge && rec.ducaInfo.doc) badge.style.display='inline-flex';
  }

  const yaRecibido = !!(rec.bodegaInfo);

  // ── POPULATE producer / provider dropdowns ─────────────────────
  const prodSel = document.getElementById('bodega-productor-sel');
  const provSel = document.getElementById('bodega-proveedor-sel');
  if (prodSel) {
    const productores = (DB.proveedores||[]).filter(p => p.tipo === 'producto');
    prodSel.innerHTML = '<option value="">— Seleccionar Productor —</option>' +
      productores.map(p => `<option value="${p.id}">${p.nombre}${p.pais?' ('+p.pais+')':''}</option>`).join('');
  }
  if (provSel) {
    const proveedores = (DB.proveedores||[]).filter(p => p.tipo === 'proveedor' || p.tipo === 'servicio' || !p.tipo || p.tipo === '');
    // Also include ALL if no type distinction
    const allProvs = (DB.proveedores||[]).filter(p => p.tipo !== 'producto');
    const list = allProvs.length ? allProvs : (DB.proveedores||[]);
    provSel.innerHTML = '<option value="">— Seleccionar Proveedor MX —</option>' +
      list.map(p => `<option value="${p.id}">${p.nombre}${p.pais?' ('+p.pais+')':''}</option>`).join('');
  }
  // ──────────────────────────────────────────────────────────────

  if (rec.bodegaInfo) {
    set('bodega-fecha',       rec.bodegaInfo.fecha||'');
    set('bodega-responsable', rec.bodegaInfo.responsable||'');
    set('bodega-obs',         rec.bodegaInfo.obs||'');
    set('duca-numero',        rec.bodegaInfo.duca||rec.ducaInfo?.numero||'');
    set('bodega-fact-proveedor', rec.bodegaInfo.factProveedor||'');
    set('bodega-fact-productor', rec.bodegaInfo.factProductor||'');
    // Restore saved selections
    if (prodSel && rec.bodegaInfo.productorId) prodSel.value = rec.bodegaInfo.productorId;
    if (provSel && rec.bodegaInfo.proveedorId) provSel.value = rec.bodegaInfo.proveedorId;
    const badge = document.getElementById('bodega-recibido-badge');
    if (badge) {
      badge.style.display='block';
      const chain = [rec.bodegaInfo.productorNombre, rec.bodegaInfo.proveedorNombre, 'AJÚA'].filter(Boolean).join(' → ');
      badge.innerHTML='<span class="chip ck" style="font-size:.7rem;padding:6px 12px;">✅ Recibido en bodega el '+rec.bodegaInfo.fecha+' — '+chain+'</span>';
    }
  }

  const cont = document.getElementById('bodega-productos'); if (!cont) return;
  const fd = document.getElementById('bodega-fecha');
  if (fd && !fd.value) fd.value = today();

  cont.innerHTML = (rec.productos||[]).map(p => {
    const cant = rec.bodegaInfo?.cantidades?.[p.i];
    const dispCant = cant ? cant.cant : p.qty;
    const dispKg   = cant ? cant.kg   : p.kgT;
    const disabled = yaRecibido ? 'disabled style="opacity:.6;background:var(--s1);border:1.5px solid var(--br);color:var(--muted2);padding:6px;border-radius:4px;width:100%;font-family:var(--fm);font-size:.74rem;"'
                                : 'style="background:var(--s1);border:1.5px solid var(--br);color:var(--txt);padding:6px;border-radius:4px;width:100%;font-family:var(--fm);font-size:.74rem;"';
    return '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;align-items:center;margin-bottom:6px;background:var(--s2);padding:8px;border-radius:4px;">' +
      '<span style="font-size:.74rem;font-weight:700;">'+p.nom+'</span>' +
      '<span style="font-size:.68rem;color:var(--muted2);">Cotizado: '+p.qty+' '+p.unit+'</span>' +
      '<div><label style="font-size:.6rem;color:var(--muted2);display:block;">Recibido ('+p.unit+')</label>' +
        '<input type="number" id="bodega-cant-'+p.i+'" value="'+dispCant+'" '+disabled+'></div>' +
      '<div><label style="font-size:.6rem;color:var(--muted2);display:block;">KG recibido</label>' +
        '<input type="number" id="bodega-kg-'+p.i+'" value="'+dispKg.toFixed(1)+'" '+disabled+'></div>' +
    '</div>';
  }).join('');

  // Disable confirm button if already received
  const btnSection = document.querySelector('#sec-inv-cotizador [onclick="confirmarRecepcion()"]');
  if (btnSection) {
    btnSection.disabled = yaRecibido;
    btnSection.style.opacity = yaRecibido ? '0.4' : '1';
    btnSection.textContent = yaRecibido ? '✅ Ya recibido en bodega' : '✅ Confirmar Recepción en Bodega — Cargar Inventario';
  }
  // Also disable bodega fields if already received
  ['bodega-fecha','bodega-responsable','bodega-obs','bodega-fact-proveedor','bodega-fact-productor',
   'bodega-proveedor-sel','bodega-productor-sel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = yaRecibido; if(yaRecibido) el.style.opacity='0.6'; }
  });
}

// ── CONFIRMAR RECEPCIÓN EN BODEGA ─────────────────────────────────
function confirmarRecepcion() {
  const rec = DB.cotizaciones?.find(c => c.id === cotActivaId);
  if (!rec) { toast('⚠ No hay cotización activa', true); return; }
  if (rec.bodegaInfo) { toast('⚠ Esta cotización ya fue recibida en bodega', true); return; }

  // Validate required trazabilidad fields
  const duca      = v('duca-numero-bodega') || v('duca-numero');
  const factProv  = v('bodega-fact-proveedor');
  const factProd  = v('bodega-fact-productor');
  if (!duca)     { toast('⚠ Ingresa el número de DUCA', true); return; }
  if (!factProv) { toast('⚠ Ingresa el No. de Factura Proveedor MX', true); return; }
  if (!factProd) { toast('⚠ Ingresa el No. de Factura Productor MX', true); return; }

  const fecha        = v('bodega-fecha') || today();
  const responsable  = v('bodega-responsable') || '';
  const obs          = v('bodega-obs') || '';

  // Producer / Provider selections
  const prodSel       = document.getElementById('bodega-productor-sel');
  const provSel       = document.getElementById('bodega-proveedor-sel');
  const productorId   = prodSel?.value || '';
  const productorNom  = prodSel?.options[prodSel.selectedIndex]?.text || '';
  const proveedorId   = provSel?.value || '';
  const proveedorNom  = provSel?.options[provSel.selectedIndex]?.text || '';

  // Collect actual quantities received per product
  const cantidades = {};
  (rec.productos||[]).forEach(p => {
    const cantEl = document.getElementById('bodega-cant-'+p.i);
    const kgEl   = document.getElementById('bodega-kg-'+p.i);
    cantidades[p.i] = {
      cant: parseFloat(cantEl?.value) || p.qty,
      kg:   parseFloat(kgEl?.value)   || p.kgT,
    };
  });

  // Save bodegaInfo on the cotizacion record
  rec.bodegaInfo = {
    fecha, responsable, obs,
    duca, factProveedor: factProv, factProductor: factProd,
    productorId, productorNombre: productorNom !== '— Seleccionar Productor —' ? productorNom : '',
    proveedorId, proveedorNombre: proveedorNom !== '— Seleccionar Proveedor MX —' ? proveedorNom : '',
    cantidades,
    ts: now(),
  };
  if (!['bodega','entregada'].includes(rec.estado)) rec.estado = 'bodega';

  // ── Load inventory (ientradas) ──────────────────────────────────
  invEnsureDB();
  if (!DB.ientradas) DB.ientradas = [];

  (rec.productos||[]).forEach(p => {
    const cant = cantidades[p.i];
    const lbs  = cant ? (cant.kg * 2.20462) : p.lbsT;
    const kg   = cant ? cant.kg : p.kgT;
    const costoLb = lbs > 0 ? (p.costoUd * p.qty) / lbs : 0;

    DB.ientradas.push({
      id: uid(),
      ts: now(),
      fecha,
      productoId:     p.productoId || '',
      productoNombre: p.nom || '',
      lbsTotal:  lbs,
      kgTotal:   kg,
      bultos:    cant ? cant.cant : p.qty,
      unidad:    p.unit || 'bulto',
      costoTotal: p.costoUd * p.qty,
      costoLb,
      source:        'cotizador',
      cotizacionId:  rec.id,
      cotizacionNom: rec.nombre || '',
      duca,
      productorId, productorNombre: rec.bodegaInfo.productorNombre,
      proveedorId, proveedorNombre: rec.bodegaInfo.proveedorNombre,
      factProveedor: factProv,
      factProductor: factProd,
      obs,
    });
  });

  save();
  renderDucaPanel(rec);
  renderCotList();
  try { renderInvStock(); } catch(e) {}
  try { renderIne(); } catch(e) {}

  const chain = [rec.bodegaInfo.productorNombre, rec.bodegaInfo.proveedorNombre, 'AJÚA'].filter(Boolean).join(' → ');
  toast('✅ Recibido en bodega — inventario cargado · ' + chain);
}

function ducaLoadDoc(input) {
  const badge = document.getElementById('duca-doc-badge');
  if (badge && input.files[0]) badge.style.display='inline-flex';
}

function saveDuca() {
  const rec = DB.cotizaciones.find(c=>c.id===cotActivaId); if(!rec) return;
  const numero = v('duca-numero');
  if (!numero) { toast('⚠ Ingresa el número de DUCA',true); return; }
  rec.ducaInfo = { numero, fecha:v('duca-fecha'), agente:v('duca-agente'), aranceles:parseFloat(v('duca-aranceles'))||0, otros:parseFloat(v('duca-otros'))||0, doc:true };
  if (!rec.duca) rec.duca = numero;
  if (['borrador','anticipos'].includes(rec.estado)) rec.estado='duca';
  save(); renderDetResumen(rec); renderCotList();
  toast('✓ DUCA '+numero+' guardada');
}

function pagoToggleCanal(val) {
  const gtS = document.getElementById('pago-gt-section');
  const mxS = document.getElementById('pago-mx-section');
  if (gtS) gtS.style.display = val==='banco_gt' ? 'block':'none';
  if (mxS) mxS.style.display = val==='banco_mx' ? 'block':'none';
}

function pagoToggleMX(val) {
  const mxt = document.getElementById('pago-mx-transfer');
  if (mxt) mxt.style.display = val==='si'?'block':'none';
}

function pagoCalc() {
  const canal = v('pago-canal');
  if (canal==='banco_mx') {
    const mxn = parseFloat(v('pago-mxn')) || 0;
    const tc  = parseFloat(v('pago-mxn-tc')) || 0;
    set('pago-mxn-gtq-eq', tc>0&&mxn>0 ? 'Q '+(mxn*tc).toFixed(2) : '');
  }
}

function pagoCalcMX() {
  const gtq = parseFloat(v('pago-envia-gtq')) || 0;
  const tc  = parseFloat(v('pago-mx-tc'))    || 0;
  set('pago-mxn-result', tc>0&&gtq>0 ? '$ '+(gtq*tc).toFixed(2)+' MXN' : '');
}

async function pagoFetchTC() {
  const btn = document.querySelector('button[onclick="pagoFetchTC()"]');
  if (btn) { btn.textContent='...'; btn.disabled=true; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_API_KEY,'anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:60,
        messages:[{role:'user',content:'Current GTQ to MXN exchange rate as a single decimal number only'}]})});
    const d = await r.json();
    const num=parseFloat(d.content?.[0]?.text?.trim());
    if(num>0){set('pago-mx-tc',num.toFixed(4));pagoCalcMX();toast('✓ TC: 1 GTQ = '+num.toFixed(4)+' MXN');}
    else toast('⚠ Ingresa el TC manualmente',true);
  } catch { toast('⚠ Error',true); }
  if (btn) { btn.textContent='🔄'; btn.disabled=false; }
}

function savePago() {
  const rec = DB.cotizaciones.find(c=>c.id===cotActivaId); if(!rec) return;
  const canal = v('pago-canal');
  const fecha = v('pago-fecha') || today();
  let pagoRec = { id:uid(), ts:now(), fecha, canal, ref:v('pago-ref') };

  if (canal==='banco_gt') {
    const gtq = parseFloat(v('pago-gtq')) || 0;
    if (!gtq) { toast('⚠ Ingresa el monto recibido',true); return; }
    pagoRec.gtq = gtq; pagoRec.obs = v('pago-obs-gt');
    if (v('pago-manda-mx')==='si') {
      const envia = parseFloat(v('pago-envia-gtq')) || 0;
      const tc    = parseFloat(v('pago-mx-tc'))    || 0;
      if (envia>0 && tc>0) {
        pagoRec.enviaGTQ = envia;
        pagoRec.tcMX     = tc;
        pagoRec.llegaMXN = envia*tc;
        pagoRec.mxRef    = v('pago-mx-ref');
      }
    }
  } else {
    const mxn = parseFloat(v('pago-mxn')) || 0;
    const tc  = parseFloat(v('pago-mxn-tc')) || 0;
    if (!mxn) { toast('⚠ Ingresa el monto recibido',true); return; }
    pagoRec.mxn = mxn; pagoRec.gtqEq = tc>0?mxn*tc:0; pagoRec.tc=tc; pagoRec.obs=v('pago-obs-mx');
  }

  rec.pagos = rec.pagos||[];
  rec.pagos.push(pagoRec);

  const totalVentaGTQ = rec.ventaLineas?.reduce((s,vl) => {
    const p = rec.productos?.find(pr=>pr.i===vl.i); if(!p) return s;
    return s+(vl.moneda==='mxn'?(rec.tc>0?vl.precio*p.qty*rec.tc:0):vl.precio*p.qty);
  },0)||0;
  const totPagadoGTQ = rec.pagos.reduce((s,p)=>s+(p.gtq||0)+(p.gtqEq||0),0);
  if (totPagadoGTQ>=totalVentaGTQ && totalVentaGTQ>0) rec.estado='pagado';

  ['pago-fecha','pago-ref','pago-gtq','pago-envia-gtq','pago-mx-tc','pago-mxn-result','pago-mx-ref','pago-mxn','pago-mxn-tc','pago-mxn-gtq-eq','pago-obs-gt','pago-obs-mx'].forEach(id=>set(id,''));
  document.getElementById('pago-mx-transfer').style.display='none';
  set('pago-manda-mx','no');

  save(); renderPagos(rec); renderDetResumen(rec); renderCotList();
  toast('✓ Pago registrado');
}

function renderPagos(rec) {
  const tb = document.getElementById('pagos-tbody'); if(!tb) return;
  const pagos = rec.pagos||[];

  const totalVentaGTQ = rec.ventaLineas?.reduce((s,vl) => {
    const p=rec.productos?.find(pr=>pr.i===vl.i);if(!p)return s;
    return s+(vl.moneda==='mxn'?(rec.tc>0?vl.precio*p.qty*rec.tc:0):vl.precio*p.qty);
  },0)||0;
  const totPagGTQ = pagos.reduce((s,p)=>s+(p.gtq||0)+(p.gtqEq||0),0);
  const totPagMXN = pagos.reduce((s,p)=>s+(p.mxn||0),0);
  const totEnvMXN = pagos.reduce((s,p)=>s+(p.llegaMXN||0),0);
  const saldo     = totalVentaGTQ - totPagGTQ;

  const hdr = document.getElementById('pagos-resumen-header');
  if (hdr) hdr.innerHTML =
    '<span>Total venta: <strong style="color:var(--acc);">Q '+totalVentaGTQ.toFixed(2)+'</strong></span>' +
    '<span>Cobrado GTQ: <strong style="color:var(--acc);">Q '+totPagGTQ.toFixed(2)+'</strong></span>' +
    (totPagMXN>0?'<span>Cobrado MXN: <strong style="color:var(--acc);">$ '+totPagMXN.toFixed(2)+'</strong></span>':'') +
    (totEnvMXN>0?'<span>Enviado a MX: <strong style="color:var(--warn);">$ '+totEnvMXN.toFixed(2)+' MXN</strong></span>':'') +
    '<span>Saldo: <strong style="color:'+(saldo<=0?'var(--acc)':'var(--danger)')+';">Q '+saldo.toFixed(2)+'</strong></span>';

  const fd = document.getElementById('pago-fecha');
  if (fd&&!fd.value) fd.value=today();
  pagoToggleCanal(v('pago-canal')||'banco_gt');

  if (!pagos.length) { tb.innerHTML='<tr><td colspan="9"><div class="empty">Sin pagos registrados</div></td></tr>'; return; }
  const CANAL = { banco_gt:'🏦 GT (GTQ)', banco_mx:'🏦 MX (MXN)' };
  tb.innerHTML = pagos.map(p =>
    '<tr>' +
    '<td>'+p.fecha+'</td>' +
    '<td>'+(CANAL[p.canal]||p.canal)+'</td>' +
    '<td style="color:var(--acc);">'+(p.gtq?'Q '+p.gtq.toFixed(2):'—')+'</td>' +
    '<td style="color:var(--acc);">'+(p.mxn?'$ '+p.mxn.toFixed(2):'—')+'</td>' +
    '<td style="color:var(--warn);">'+(p.enviaGTQ?'Q '+p.enviaGTQ.toFixed(2):'—')+'</td>' +
    '<td style="color:var(--warn);">'+(p.llegaMXN?'$ '+p.llegaMXN.toFixed(2)+' (TC:'+p.tcMX+')'  :'—')+'</td>' +
    '<td>'+(p.tc||p.tcMX||'—')+'</td>' +
    '<td style="font-size:.68rem;">'+(p.ref||'—')+'</td>' +
    '<td><button class="btn bo bsm" style="border-color:var(--danger);color:var(--danger);" onclick="delPago(\''+rec.id+'\',\''+p.id+'\')">✕</button></td>' +
    '</tr>'
  ).join('');
}

function delPago(cotId,pagoId) {
  const rec=DB.cotizaciones.find(c=>c.id===cotId);if(!rec)return;
  rec.pagos=(rec.pagos||[]).filter(p=>p.id!==pagoId);
  save();renderPagos(rec);renderDetResumen(rec);renderCotList();toast('Pago eliminado');
}

function renderCotList() {
  invEnsureDB();
  const tb = document.getElementById('cot-tbody'); if(!tb) return;
  let cots = [...(DB.cotizaciones||[])];
  const fTipo   = v('cot-fil-tipo');
  const fEstado = v('cot-fil-estado');
  if (fTipo)   cots=cots.filter(c=>c.tipo===fTipo);
  if (fEstado) cots=cots.filter(c=>c.estado===fEstado);

  populateCotSelects();
  if (!cots.length) { tb.innerHTML='<tr><td colspan="9"><div class="empty">Sin cotizaciones</div></td></tr>'; return; }

  const TIPO_CHIP = { interno:'<span class="chip cw" style="font-size:.55rem;">🏭 Interno</span>', terceros:'<span class="chip cb" style="font-size:.55rem;">🤝 Terceros</span>' };
  tb.innerHTML = cots.map(rec => {
    const est  = COT_ESTADOS[rec.estado]||COT_ESTADOS.borrador;
    const ants = rec.anticipos||[];
    const totAnt = ants.reduce((s,a)=>s+a.gtq,0);
    return '<tr style="cursor:pointer;" onclick="cotVerDetalle(\''+rec.id+'\')">' +
      '<td>'+(TIPO_CHIP[rec.tipo]||rec.tipo)+'</td>' +
      '<td>'+rec.fecha+'</td>' +
      '<td style="font-weight:700;">'+rec.nombre+'</td>' +
      '<td style="font-size:.68rem;">'+(rec.productos||[]).map(p=>p.nom+' ×'+p.qty).join('<br>')+'</td>' +
      '<td style="color:var(--warn);">Q '+rec.totalCosto.toFixed(2)+'</td>' +
      '<td><span class="chip" style="background:rgba(255,255,255,.06);border:1.5px solid '+est.color+';color:'+est.color+';font-size:.58rem;">'+est.icon+' '+est.label+'</span></td>' +
      '<td style="color:var(--warn);">'+(totAnt>0?'Q '+totAnt.toFixed(2):'—')+'</td>' +
      '<td style="color:#a078ff;">'+(rec.duca||rec.ducaInfo?.numero||'—')+'</td>' +
      '<td><button class="btn bo bsm" onclick="event.stopPropagation();cotVerDetalle(\''+rec.id+'\')">Ver →</button></td>' +
    '</tr>';
  }).join('');
}

function cotExport() {
  const computed = document.getElementById('cot-resultados')?._computed;
  if (!computed?.rows?.length) { toast('⚠ Primero calcula',true); return; }
  const nombre = v('cot-nombre')||'Cotizacion';
  const rows=[['AJÚA — COTIZACIÓN DE CONTENEDOR'],['Ref: '+nombre+' · TC: 1 MXN = '+cotGetTC()+' GTQ'],
    [],['PRODUCTOS'],['Nombre','Uds','Unidad','KG','LBS','%gastos','Compra MXN','Compra GTQ','Gastos asig.','Costo tot Q','Costo/ud Q','Costo/kg Q','Costo/lb Q'],
    ...computed.rows.map(r=>[r.nom,r.qty,r.unit,r.kgT.toFixed(2),r.lbsT.toFixed(2),r.pctGas.toFixed(1)+'%',r.sMXN.toFixed(2),r.sGTQ.toFixed(2),r.gastosP.toFixed(2),r.costoTot.toFixed(2),r.costoUd.toFixed(4),r.costoKg.toFixed(4),r.costoLb.toFixed(4)]),
    [],['Subtotal MX GTQ',computed.subMX.toFixed(2)],['Subtotal GT GTQ',computed.subGT.toFixed(2)],
    ['Total gastos',computed.totalGastos.toFixed(2)],['Total compra',computed.totalCompraGTQ.toFixed(2)],['COSTO TOTAL',computed.totalCosto.toFixed(2)],
  ];
  invDownloadCSV(rows,'Cotizacion_'+nombre.replace(/[^a-zA-Z0-9]/g,'_'));
}

let vgtCamStream = null, vgtDocData = null, vgtLineaCount = 0;

function vgtTipo(tipo) {
  ['mercado','distribuidor','restaurante'].forEach(t => {
    const card = document.getElementById('vgt-card-' + t);
    if (!card) return;
    const active = t === tipo;
    card.style.background = active ? 'rgba(0,217,139,.08)' : 'var(--s2)';
    card.style.borderColor = active ? 'var(--acc)' : 'var(--br)';
  });
  const unidad = document.getElementById('vgt-unidad');
  if (!unidad) return;
  if (tipo === 'mercado')      unidad.value = 'quintal';
  if (tipo === 'distribuidor') unidad.value = 'lote';
  if (tipo === 'restaurante')  unidad.value = 'caja';
  vgtCalc();
}

function vgtCalc() {
  const unidad    = v('vgt-unidad');
  const precioEl  = document.getElementById('vgt-precio-lbl');
  const cantEl    = document.getElementById('vgt-cant-lbl');
  const FACTOR    = { lb:1, quintal:100, arroba:25, kg:2.20462, caja:0, bulto:0, lote:0, unidad:0 };
  const LABELS    = { lb:'Precio por libra (Q)', quintal:'Precio por quintal (Q)', arroba:'Precio por arroba (Q)', kg:'Precio por kg (Q)', caja:'Precio por caja (Q)', bulto:'Precio por bulto (Q)', lote:'Precio total del lote (Q)', unidad:'Precio por unidad (Q)' };
  const CANT_LBL  = { lb:'Libras', quintal:'Quintales', arroba:'Arrobas', kg:'Kilogramos', caja:'Cajas', bulto:'Bultos/costales', lote:'Lote (precio único)', unidad:'Unidades' };
  if (precioEl) precioEl.textContent = LABELS[unidad] || 'Precio (Q)';
  if (cantEl)   cantEl.textContent   = CANT_LBL[unidad] || 'Cantidad';
}

function vgtDocTab(tab) {
  ['xml','manual'].forEach(t => {
    const panel = document.getElementById('vgt-doc-panel-' + t);
    const btn   = document.getElementById('vgt-doc-tab-'   + t);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
    if (btn)   btn.className = t === tab ? 'btn bp bsm' : 'btn bo bsm';
  });
}

function vgtLoadXML(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const xmlText = e.target.result;
    document.getElementById('vgt-xml-badge').style.display = 'inline-flex';
    const loading = document.getElementById('vgt-xml-loading');
    const result  = document.getElementById('vgt-xml-result');
    if (loading) loading.style.display = 'block';

    try {
      invEnsureDB();
      const prodDB = DB.iproductos.map(p => p.nombre + ' [id:' + p.id + ']').join(', ');
      const schema = '{"numero_autorizacion":"","serie":"","numero_dte":"","fecha_emision":"","comprador_nit":"","comprador_nombre":"","total_gtq":0,"total_iva":0,"productos":[{"descripcion":"","cantidad":0,"precio_unitario_con_iva":0,"total":0,"producto_id_ajua":""}]}';
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          messages: [{ role: 'user', content:
            'Analiza este XML de FEL Guatemala. Productos disponibles: ' + prodDB + '. ' +
            'Responde SOLO JSON con este esquema exacto: ' + schema + '. ' +
            'IMPORTANTE: precio_unitario_con_iva ya incluye IVA 12%. ' +
            'Asigna producto_id_ajua solo si coincide claramente. XML: ' + xmlText
          }]
        })
      });
      const d = await r.json();
      let text = d.content?.[0]?.text || '';
      text = text.replace(/```json|```/g, '').trim();
      const data = JSON.parse(text);

      if (data.numero_autorizacion) set('sal-factura', data.numero_autorizacion);
      if (data.serie)              set('vgt-num-factura', (data.serie || '') + '-' + (data.numero_dte || ''));
      if (data.comprador_nit)      set('vgt-nit-comprador', data.comprador_nit);
      if (data.comprador_nombre && !v('vgt-comprador')) set('vgt-comprador', data.comprador_nombre);
      if (data.fecha_emision)      set('vgt-fecha-factura', data.fecha_emision.substring(0,10));

      if (data.productos?.length) {
        document.getElementById('vgt-lineas').innerHTML = '';
        vgtLineaCount = 0;
        data.productos.forEach(p => {
          vgtAddLinea();
          const n = vgtLineaCount;
          if (p.producto_id_ajua) {
            const sel = document.getElementById('vgl-prod-' + n);
            if (sel) sel.value = p.producto_id_ajua;
          }
          const cantEl   = document.getElementById('vgl-cant-'   + n);
          const precioEl = document.getElementById('vgl-precio-' + n);
          if (cantEl)   cantEl.value   = p.cantidad || 1;
          if (precioEl) precioEl.value = p.precio_unitario_con_iva?.toFixed(2) || 0;
          vgtRecalc();
        });
      }

      if (loading) loading.style.display = 'none';
      if (result) {
        result.style.display = 'block';
        result.innerHTML = '<span style="color:var(--acc);">✓ XML leído — ' + (data.productos?.length || 0) + ' productos · Total Q ' + (data.total_gtq?.toFixed(2) || '—') + '</span>';
      }
      toast('✓ XML FEL cargado y aplicado');
    } catch(err) {
      if (loading) loading.style.display = 'none';
      toast('⚠ Error al leer XML: ' + err.message, true);
    }
  };
  reader.readAsText(file);
}

function vgtLoadFoto(input) {
  if (input.files[0]) document.getElementById('vgt-foto-badge').style.display = 'inline-flex';
}

function vgtAddLinea() {
  invEnsureDB();
  vgtLineaCount++;
  const n    = vgtLineaCount;
  const cont = document.getElementById('vgt-lineas');
  const div  = document.createElement('div');
  div.id = 'vgt-lin-' + n;
  div.style.cssText = 'background:var(--s2);border:1.5px solid var(--br);border-radius:4px;padding:8px;margin-bottom:6px;';
  const pOpts = DB.iproductos.map(p => '<option value="' + p.id + '">' + p.nombre + '</option>').join('');
  const fs    = 'background:var(--s1);border:1.5px solid var(--br);color:var(--txt);padding:6px;border-radius:4px;width:100%;font-family:var(--fm);font-size:.72rem;';
  const unidad = v('vgt-unidad') || 'quintal';
  const UNIT_LBL = { lb:'lbs', quintal:'quintales', arroba:'arrobas', kg:'kg', caja:'cajas', bulto:'bultos', lote:'lote' };
  div.innerHTML =
    '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:6px;align-items:end;">' +
      '<div><label style="font-size:.6rem;color:var(--muted2);display:block;margin-bottom:2px;">Producto</label>' +
        '<select id="vgl-prod-' + n + '" style="' + fs + '">' +
          '<option value="">— Seleccionar —</option>' + pOpts + '</select></div>' +
      '<div><label style="font-size:.6rem;color:var(--muted2);display:block;margin-bottom:2px;">Cantidad (' + (UNIT_LBL[unidad]||'uds') + ')</label>' +
        '<input type="number" id="vgl-cant-' + n + '" step="0.01" placeholder="0" oninput="vgtRecalc()" style="' + fs + '"></div>' +
      '<div><label style="font-size:.6rem;color:var(--muted2);display:block;margin-bottom:2px;">Precio unitario Q</label>' +
        '<input type="number" id="vgl-precio-' + n + '" step="0.01" placeholder="0" oninput="vgtRecalc()" style="' + fs + '"></div>' +
      '<div><label style="font-size:.6rem;color:var(--muted2);display:block;margin-bottom:2px;">Subtotal Q</label>' +
        '<input id="vgl-sub-' + n + '" readonly style="' + fs + 'color:var(--acc);cursor:default;background:var(--s3);"></div>' +
      '<button onclick="document.getElementById(\'vgt-lin-' + n + '\').remove();vgtRecalc();" style="background:var(--danger);color:#fff;border:none;padding:6px 8px;border-radius:3px;cursor:pointer;font-size:.7rem;height:30px;align-self:end;">✕</button>' +
    '</div>';
  cont.appendChild(div);
  document.getElementById('vgt-totales').style.display = 'block';
}

function vgtRecalc() {
  invEnsureDB();
  const unidad = v('vgt-unidad');
  const FACTOR = { lb:1, quintal:100, arroba:25, kg:2.20462, caja:null, bulto:null, lote:null };
  let totalLbs = 0, totalQ = 0;
  for (let i = 1; i <= vgtLineaCount; i++) {
    if (!document.getElementById('vgt-lin-' + i)) continue;
    const cant   = parseFloat(document.getElementById('vgl-cant-' + i)?.value) || 0;
    const precio = parseFloat(document.getElementById('vgl-precio-' + i)?.value) || 0;
    const sub    = cant * precio;
    const subEl  = document.getElementById('vgl-sub-' + i);
    if (subEl) subEl.value = sub > 0 ? 'Q ' + sub.toFixed(2) : '';
    const factor = FACTOR[unidad];
    if (factor) totalLbs += cant * factor;
    totalQ += sub;
  }
  set('vgt-tot-peso', totalLbs > 0 ? totalLbs.toFixed(1) + ' lbs' : '—');
  set('vgt-tot-q', 'Q ' + totalQ.toFixed(2));
}

async function vgtOpenCam() {
  try {
    vgtCamStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } });
    const vid = document.getElementById('vgt-cam-video');
    vid.srcObject = vgtCamStream; vid.style.display = 'block';
    document.getElementById('vgt-cam-btns').style.display = 'none';
    document.getElementById('vgt-cam-active').style.display = 'flex';
  } catch { toast('⚠ No se pudo abrir la cámara', true); }
}
function vgtCapture() {
  const vid = document.getElementById('vgt-cam-video');
  const can = document.getElementById('vgt-cam-canvas');
  can.width = vid.videoWidth; can.height = vid.videoHeight;
  const ctx = can.getContext('2d'); ctx.drawImage(vid,0,0);
  ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,can.height-30,can.width,30);
  ctx.fillStyle='#00d98b'; ctx.font='bold 12px monospace';
  ctx.fillText('AJÚA · Venta GT · '+new Date().toLocaleString('es-GT'),8,can.height-8);
  vgtDocData = can.toDataURL('image/jpeg',.85);
  document.getElementById('vgt-doc-img').src = vgtDocData;
  document.getElementById('vgt-doc-preview').style.display = 'block';
  vgtCloseCam(); toast('✓ Foto capturada');
}
function vgtCloseCam() {
  if (vgtCamStream) { vgtCamStream.getTracks().forEach(t=>t.stop()); vgtCamStream=null; }
  const vid = document.getElementById('vgt-cam-video');
  vid.style.display='none'; vid.srcObject=null;
  document.getElementById('vgt-cam-btns').style.display='flex';
  document.getElementById('vgt-cam-active').style.display='none';
}
function vgtDelDoc() { vgtDocData=null; document.getElementById('vgt-doc-preview').style.display='none'; }
function vgtLoadImg(input) {
  const file=input.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=e=>{ vgtDocData=e.target.result; document.getElementById('vgt-doc-img').src=vgtDocData; document.getElementById('vgt-doc-preview').style.display='block'; toast('✓ Imagen cargada'); };
  r.readAsDataURL(file);
}

function saveVgtVenta() {
  invEnsureDB();
  if (!DB.vgtVentas) DB.vgtVentas = [];
  const fecha = v('vgt-fecha');
  if (!fecha) { toast('⚠ Ingrese la fecha', true); return; }
  const unidad = v('vgt-unidad');
  const FACTOR = { lb:1, quintal:100, arroba:25, kg:2.20462, caja:null, bulto:null, lote:null };

  const lineas = [];
  let totalLbs = 0, totalQ = 0;
  for (let i = 1; i <= vgtLineaCount; i++) {
    if (!document.getElementById('vgt-lin-' + i)) continue;
    const prodId = document.getElementById('vgl-prod-' + i)?.value;
    const cant   = parseFloat(document.getElementById('vgl-cant-' + i)?.value) || 0;
    const precio = parseFloat(document.getElementById('vgl-precio-' + i)?.value) || 0;
    if (!cant) continue;
    const prod = DB.iproductos.find(p=>p.id===prodId);
    const sub  = cant * precio;
    const factor = FACTOR[unidad];
    if (factor) totalLbs += cant * factor;
    totalQ += sub;
    const lbs_line = factor ? cant * factor : 0;
    lineas.push({ productoId:prodId, productoNombre:prod?.nombre||'—', cant, precio, sub, unidad, lbs:lbs_line });
  }

  if (!lineas.length) { toast('⚠ Agrega al menos un producto', true); return; }

  const tipoRadio = document.querySelector('input[name="vgt-tipo"]:checked');
  const tipo = tipoRadio?.value || 'mercado';

  const rec = {
    id:uid(), ts:now(), fecha,
    tipo, comprador:v('vgt-comprador'), tel:v('vgt-tel'),
    unidad, lineas, totalLbs, totalQ,
    pago:v('vgt-pago'), diasCredito:parseInt(v('vgt-dias-credito'))||0,
    recibo:v('vgt-recibo'), obs:v('vgt-obs'),
    numFactura:  v('vgt-num-factura')  || '',
    nitComprador:v('vgt-nit-comprador')|| '',
    fechaFactura:v('vgt-fecha-factura')|| '',
    docFoto: vgtDocData || null,
  };
  DB.vgtVentas.push(rec);

  // If this came from a cotizacion terceros, mark it as entregada
  const cotBadge = document.getElementById('vgt-cot-badge');
  const cotIdLinked = cotBadge?.dataset?.cotId;
  if (cotIdLinked) {
    const cotRec = DB.cotizaciones.find(c => c.id === cotIdLinked);
    if (cotRec) {
      cotRec.estado = 'entregada';
      cotRec.ventaGTId = rec.id;
      cotRec.fechaEntrega = fecha;
    }
    if (cotBadge) cotBadge.style.display = 'none';
  }

  ['vgt-fecha','vgt-comprador','vgt-tel','vgt-recibo','vgt-obs','vgt-dias-credito'].forEach(id=>set(id,''));
  document.getElementById('vgt-lineas').innerHTML=''; vgtLineaCount=0;
  vgtDocData=null; document.getElementById('vgt-doc-preview').style.display='none';
  document.getElementById('vgt-totales').style.display='none';

  save(); renderVgtVentas(); renderInvStock();
  toast('✓ Entrega registrada — Q'+totalQ.toFixed(2));
}

function renderVgtVentas() {
  invEnsureDB();
  if (!DB.vgtVentas) DB.vgtVentas = [];
  const fp = document.getElementById('vgt-fil-prod');
  if (fp && !fp._populated) {
    fp.innerHTML = '<option value="">Todos</option>' + DB.iproductos.map(p=>'<option value="'+p.id+'">'+p.nombre+'</option>').join('');
    fp._populated = true;
  }
  const filProd  = v('vgt-fil-prod');
  const filDesde = v('vgt-fil-desde');
  const filHasta = v('vgt-fil-hasta');
  const filTipo  = v('vgt-fil-tipo');

  let ventas = [...DB.vgtVentas].reverse();
  if (filProd)  ventas = ventas.filter(v=>v.lineas?.some(l=>l.productoId===filProd));
  if (filDesde) ventas = ventas.filter(v=>v.fecha>=filDesde);
  if (filHasta) ventas = ventas.filter(v=>v.fecha<=filHasta);
  if (filTipo)  ventas = ventas.filter(v=>v.tipo===filTipo);

  const TIPO_CHIP = { mercado:'<span class="chip cw" style="font-size:.55rem;">🏪 Mercado</span>',
    distribuidor:'<span class="chip cb" style="font-size:.55rem;">🚚 Distribuidor</span>',
    restaurante:'<span class="chip ck" style="font-size:.55rem;">🍽️ Restaurante</span>' };
  const tb = document.getElementById('vgt-tbody');
  if (!tb) return;
  if (!ventas.length) { tb.innerHTML='<tr><td colspan="9"><div class="empty">Sin ventas locales</div></td></tr>'; }
  else {
    tb.innerHTML = ventas.map(r=>{
      const prods = r.lineas?.map(l=>l.productoNombre+' ×'+l.cant+' '+l.unidad).join('<br>') || '—';
      return '<tr>' +
        '<td>'+r.fecha+'</td>' +
        '<td>'+(TIPO_CHIP[r.tipo]||r.tipo)+'</td>' +
        '<td style="font-size:.72rem;">'+(r.comprador||'—')+'</td>' +
        '<td style="font-size:.68rem;line-height:1.5;">'+prods+'</td>' +
        '<td>'+(r.totalLbs>0?r.totalLbs.toFixed(0)+' lbs':'—')+'</td>' +
        '<td style="color:var(--acc);font-weight:700;">Q '+r.totalQ.toFixed(2)+'</td>' +
        '<td style="font-size:.68rem;">'+(r.pago||'—')+(r.diasCredito>0?' · '+r.diasCredito+'d crédito':'')+'</td>' +
        '<td>'+(r.docFoto?'<img src="'+r.docFoto+'" style="height:24px;border-radius:3px;">':'—')+'</td>' +
        '<td><button class="btn bo bsm" onclick="delVgtVenta(\''+r.id+'\')">✕</button></td>' +
      '</tr>';
    }).join('');
  }
  const resEl = document.getElementById('vgt-resumen');
  if (resEl) {
    const totQ = ventas.reduce((s,r)=>s+r.totalQ,0);
    const totLbs = ventas.reduce((s,r)=>s+r.totalLbs,0);
    const credito = ventas.filter(r=>r.pago==='credito').reduce((s,r)=>s+r.totalQ,0);
    resEl.innerHTML = (ventas.length>0 ?
      '<span>'+ventas.length+' ventas</span>' +
      (totLbs>0?'<span>Total: <strong style="color:var(--acc);">'+totLbs.toFixed(0)+' lbs</strong></span>':'') +
      '<span>Total Q: <strong style="color:var(--acc);">Q '+totQ.toFixed(2)+'</strong></span>' +
      (credito>0?'<span style="color:var(--warn);">Crédito pendiente: Q '+credito.toFixed(2)+'</span>':'') : '');
  }
}

function delVgtVenta(id) {
  DB.vgtVentas = (DB.vgtVentas||[]).filter(r=>r.id!==id);
  save(); renderVgtVentas(); renderInvStock(); toast('Venta eliminada');
}

function vgtFiltrar() {
  const f = document.getElementById('vgt-filtros');
  if (f) f.style.display = f.style.display === 'none' ? 'flex' : 'none';
}

function vgtExport() {
  invEnsureDB();
  if (!DB.vgtVentas?.length) { toast('Sin ventas para exportar', true); return; }
  const rows = [
    ['AJÚA — VENTAS LOCALES GUATEMALA'],
    ['Fecha','Tipo','Comprador','Producto','Cantidad','Unidad','Precio Unit Q','Subtotal Q','Pago','Crédito días'],
  ];
  DB.vgtVentas.forEach(v => {
    (v.lineas||[]).forEach(l => {
      rows.push([v.fecha,v.tipo,v.comprador||'',l.productoNombre,l.cant,l.unidad,l.precio.toFixed(2),l.sub.toFixed(2),v.pago,v.diasCredito||0]);
    });
  });
  invDownloadCSV(rows, 'Ventas_GT_' + new Date().toISOString().split('T')[0]);
}

let vintCamStream = null, vintDocData = null, vintLineaCount = 0;

function vintOp(op) {
  const ops = ['contenedor_completo','parcial_transporte','solo_producto','frontera_mx'];
  ops.forEach(o => {
    const card = document.getElementById('vint-opcard-' + o);
    if (!card) return;
    const active = o === op;
    card.style.background   = active ? 'rgba(74,158,255,.1)' : 'var(--s3)';
    card.style.borderColor  = active ? 'var(--info)' : 'var(--br)';
  });
  const incTrans = document.getElementById('vint-inc-transporte');
  const incPap   = document.getElementById('vint-inc-papeleria');
  if (incTrans) incTrans.checked = op === 'contenedor_completo' || op === 'parcial_transporte' || op === 'frontera_mx';
  if (incPap)   incPap.checked  = op === 'contenedor_completo';
  vintCalc();
}

function vintMonedaChange() {
  const moneda = v('vint-moneda');
  const tcRow  = document.getElementById('vint-tc-row');
  const totGtq = document.getElementById('vint-tot-gtq-span');
  if (tcRow)  tcRow.style.display  = moneda === 'mxn' ? 'block' : 'none';
  if (totGtq) totGtq.style.display = moneda === 'mxn' ? '' : 'none';
  const sym = moneda === 'mxn' ? 'MXN $' : 'Q';
  const totSpan = document.getElementById('vint-tot-mon-span');
  if (totSpan) totSpan.textContent = 'Total ' + sym + ':';
  vintCalc();
}

async function vintFetchTC() {
  const btn = document.querySelector('button[onclick="vintFetchTC()"]');
  if (btn) { btn.textContent='...'; btn.disabled=true; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST', headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_API_KEY,'anthropic-dangerous-direct-browser-access':'true'},
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:60,
        messages:[{role:'user',content:'MXN to GTQ exchange rate today as a single decimal number only, no text'}]})
    });
    const d = await r.json();
    const num = parseFloat(d.content?.[0]?.text?.trim());
    if (num>0) { set('vint-tc', num.toFixed(4)); vintCalc(); toast('✓ TC: 1 MXN = '+num.toFixed(4)+' GTQ'); }
    else        toast('⚠ Ingresa el TC manualmente', true);
  } catch { toast('⚠ Error al consultar TC', true); }
  if (btn) { btn.textContent='🔄 TC actual'; btn.disabled=false; }
}

function vintAddLinea() {
  invEnsureDB();
  vintLineaCount++;
  const n    = vintLineaCount;
  const cont = document.getElementById('vint-lineas');
  const div  = document.createElement('div');
  div.id = 'vint-lin-' + n;
  div.style.cssText = 'background:var(--s2);border:1.5px solid var(--br);border-radius:4px;padding:8px;margin-bottom:6px;';
  const pOpts = DB.iproductos.map(p=>'<option value="'+p.id+'">'+p.nombre+'</option>').join('');
  const fs    = 'background:var(--s1);border:1.5px solid var(--br);color:var(--txt);padding:6px;border-radius:4px;width:100%;font-family:var(--fm);font-size:.72rem;';
  div.innerHTML =
    '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr auto;gap:6px;align-items:end;">' +
      '<div><label style="font-size:.6rem;color:var(--muted2);display:block;margin-bottom:2px;">Producto</label>' +
        '<select id="vil-prod-' + n + '" style="' + fs + '"><option value="">— Seleccionar —</option>' + pOpts + '</select></div>' +
      '<div><label style="font-size:.6rem;color:var(--muted2);display:block;margin-bottom:2px;">Bultos / Cantidad</label>' +
        '<input type="number" id="vil-cant-' + n + '" step="1" placeholder="0" oninput="vintRecalc()" style="' + fs + '"></div>' +
      '<div><label style="font-size:.6rem;color:var(--muted2);display:block;margin-bottom:2px;">Kg por bulto</label>' +
        '<input type="number" id="vil-kgbu-' + n + '" step="0.01" placeholder="0" oninput="vintRecalc()" style="' + fs + '"></div>' +
      '<div><label style="font-size:.6rem;color:var(--muted2);display:block;margin-bottom:2px;" id="vil-precio-lbl-' + n + '">Precio / lb</label>' +
        '<input type="number" id="vil-precio-' + n + '" step="0.01" placeholder="0" oninput="vintRecalc()" style="' + fs + '"></div>' +
      '<div><label style="font-size:.6rem;color:var(--muted2);display:block;margin-bottom:2px;">Subtotal</label>' +
        '<input id="vil-sub-' + n + '" readonly style="' + fs + 'color:var(--acc);cursor:default;background:var(--s3);"></div>' +
      '<button onclick="document.getElementById(\'vint-lin-' + n + '\').remove();vintRecalc();" style="background:var(--danger);color:#fff;border:none;padding:6px 8px;border-radius:3px;cursor:pointer;font-size:.7rem;height:28px;align-self:end;">✕</button>' +
    '</div>';
  cont.appendChild(div);
  document.getElementById('vint-totales').style.display = 'block';
}

function vintRecalc() {
  const moneda    = v('vint-moneda');
  const precioBase= v('vint-precio-base');
  const PRECIO_FACTOR = { lb:1, kg:2.20462, quintal:100, bulto:null, contenedor:null };
  const sym = moneda === 'mxn' ? '$' : 'Q';
  let totalBultos = 0, totalLbs = 0, totalVal = 0;

  for (let i = 1; i <= vintLineaCount; i++) {
    if (!document.getElementById('vint-lin-' + i)) continue;
    const cant   = parseFloat(document.getElementById('vil-cant-' + i)?.value)   || 0;
    const kgBu   = parseFloat(document.getElementById('vil-kgbu-' + i)?.value)   || 0;
    const precio = parseFloat(document.getElementById('vil-precio-' + i)?.value) || 0;
    const lbs    = cant * kgBu * 2.20462;

    let sub = 0;
    const factor = PRECIO_FACTOR[precioBase];
    if (precioBase === 'contenedor') sub = precio; // single price for whole batch
    else if (factor)                 sub = lbs / factor * precio;
    else if (precioBase === 'bulto') sub = cant * precio;
    const subEl = document.getElementById('vil-sub-' + i);
    if (subEl) subEl.value = sub > 0 ? sym + ' ' + sub.toFixed(2) : '';
    totalBultos += cant;
    totalLbs    += lbs;
    totalVal    += sub;
  }
  const flete  = parseFloat(v('vint-flete'))  || 0;
  const pap    = parseFloat(v('vint-pap'))    || 0;
  const otros  = parseFloat(v('vint-otros'))  || 0;
  totalVal += flete + pap + otros;

  set('vint-tot-bultos', totalBultos);
  set('vint-tot-peso',   totalLbs.toFixed(1) + ' lbs');
  set('vint-tot-total',  sym + ' ' + totalVal.toFixed(2));

  if (moneda === 'mxn') {
    const tc = parseFloat(v('vint-tc')) || 0;
    const gtq = tc > 0 ? totalVal * tc : 0;
    set('vint-tot-gtq', gtq > 0 ? 'Q ' + gtq.toFixed(2) : 'Falta TC');
    set('vint-total-gtq-eq', gtq > 0 ? 'Q ' + gtq.toFixed(2) : '');
  }

  vintCalc();
}

function vintCalc() {
  vintRecalc();
  const moneda  = v('vint-moneda');
  const sym     = moneda === 'mxn' ? '$' : 'Q';
  const tc      = parseFloat(v('vint-tc')) || 0;
  const totEl   = document.getElementById('vint-tot-total');
  const totalVal= parseFloat(totEl?.value?.replace(/[^0-9.]/g,'')) || 0;
  const totGtq  = moneda === 'mxn' && tc > 0 ? totalVal * tc : (moneda === 'gtq' ? totalVal : 0);
  const totLbs  = parseFloat(document.getElementById('vint-tot-peso')?.value) || 0;

  const cards = [
    { l:'Total ' + (moneda==='mxn'?'MXN':'GTQ'), v: sym + ' ' + totalVal.toFixed(2), c:'var(--acc)' },
  ];
  if (moneda === 'mxn' && tc > 0)
    cards.push({ l:'Equivalente GTQ', v:'Q ' + totGtq.toFixed(2), c:'var(--muted2)' });
  if (totLbs > 0) {
    const cpLb = totLbs > 0 ? totalVal / totLbs : 0;
    const cpKg = totLbs > 0 ? totalVal / totLbs * 2.20462 : 0;
    cards.push({ l:'Precio efectivo / lb', v: sym + ' ' + cpLb.toFixed(4), c:'var(--info)' });
    cards.push({ l:'Precio efectivo / kg', v: sym + ' ' + cpKg.toFixed(4), c:'var(--info)' });
  }
  const svcs = [];
  ['producto','transporte','papeleria','aduana'].forEach(s => {
    if (document.getElementById('vint-inc-' + s)?.checked) svcs.push(s);
  });
  if (svcs.length) cards.push({ l:'Incluye', v:svcs.join(', '), c:'var(--muted2)' });

  const resDiv = document.getElementById('vint-resumen-total');
  const resCards = document.getElementById('vint-resumen-cards');
  if (resDiv && resCards && totalVal > 0) {
    resDiv.style.display = 'block';
    resCards.innerHTML = cards.map(c =>
      '<div style="background:var(--s2);border:1.5px solid var(--br);border-radius:4px;padding:10px;text-align:center;">' +
        '<div style="font-size:.58rem;color:var(--muted2);margin-bottom:3px;">' + c.l + '</div>' +
        '<div style="font-family:var(--fh);font-size:.84rem;font-weight:700;color:' + c.c + ';">' + c.v + '</div>' +
      '</div>'
    ).join('');
  } else if (resDiv) resDiv.style.display = 'none';
}

async function vintOpenCam() {
  try {
    vintCamStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } });
    const vid = document.getElementById('vint-cam-video');
    vid.srcObject = vintCamStream; vid.style.display = 'block';
    document.getElementById('vint-cam-btns').style.display = 'none';
    document.getElementById('vint-cam-active').style.display = 'flex';
  } catch { toast('⚠ No se pudo abrir la cámara', true); }
}
function vintCapture() {
  const vid=document.getElementById('vint-cam-video'); const can=document.getElementById('vint-cam-canvas');
  can.width=vid.videoWidth; can.height=vid.videoHeight;
  const ctx=can.getContext('2d'); ctx.drawImage(vid,0,0);
  ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,can.height-30,can.width,30);
  ctx.fillStyle='#00d98b'; ctx.font='bold 12px monospace';
  ctx.fillText('AJÚA · Export · '+new Date().toLocaleString('es-GT'),8,can.height-8);
  vintDocData=can.toDataURL('image/jpeg',.85);
  document.getElementById('vint-doc-img').src=vintDocData;
  document.getElementById('vint-doc-preview').style.display='block';
  vintCloseCam(); toast('✓ Foto capturada');
}
function vintCloseCam() {
  if(vintCamStream){vintCamStream.getTracks().forEach(t=>t.stop());vintCamStream=null;}
  const vid=document.getElementById('vint-cam-video'); vid.style.display='none'; vid.srcObject=null;
  document.getElementById('vint-cam-btns').style.display='flex';
  document.getElementById('vint-cam-active').style.display='none';
}
function vintDelDoc(){vintDocData=null;document.getElementById('vint-doc-preview').style.display='none';}
function vintLoadImg(input){
  const file=input.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{vintDocData=e.target.result;document.getElementById('vint-doc-img').src=vintDocData;document.getElementById('vint-doc-preview').style.display='block';toast('✓ Cargado');};
  r.readAsDataURL(file);
}

function saveVintVenta() {
  invEnsureDB();
  if (!DB.vintVentas) DB.vintVentas = [];
  const fecha = v('vint-fecha');
  if (!fecha) { toast('⚠ Ingrese la fecha', true); return; }
  const moneda  = v('vint-moneda');
  const sym     = moneda === 'mxn' ? '$' : 'Q';
  const tc      = parseFloat(v('vint-tc')) || 0;
  const opRadio = document.querySelector('input[name="vint-op"]:checked');
  const op      = opRadio?.value || 'contenedor_completo';
  const svcs    = ['producto','transporte','papeleria','aduana'].filter(s=>document.getElementById('vint-inc-' + s)?.checked);

  const lineas = [];
  let totalLbs = 0, totalBultos = 0, totalVal = 0;
  const precioBase = v('vint-precio-base');
  const PFACTOR = { lb:1, kg:2.20462, quintal:100, bulto:null, contenedor:null };
  for (let i = 1; i <= vintLineaCount; i++) {
    if (!document.getElementById('vint-lin-' + i)) continue;
    const prodId = document.getElementById('vil-prod-' + i)?.value;
    const cant   = parseFloat(document.getElementById('vil-cant-' + i)?.value) || 0;
    const kgBu   = parseFloat(document.getElementById('vil-kgbu-' + i)?.value) || 0;
    const precio = parseFloat(document.getElementById('vil-precio-' + i)?.value) || 0;
    if (!cant) continue;
    const lbs = cant * kgBu * 2.20462;
    const factor = PFACTOR[precioBase];
    const sub = precioBase==='contenedor' ? precio : precioBase==='bulto' ? cant*precio : (factor ? lbs/factor*precio : 0);
    const prod = DB.iproductos.find(p=>p.id===prodId);
    lineas.push({ productoId:prodId, productoNombre:prod?.nombre||'—', cant, kgBu, lbs, precio, sub });
    totalLbs    += lbs;
    totalBultos += cant;
    totalVal    += sub;
  }
  if (!lineas.length) { toast('⚠ Agrega al menos un producto', true); return; }

  const flete = parseFloat(v('vint-flete'))||0, pap=parseFloat(v('vint-pap'))||0, otros=parseFloat(v('vint-otros'))||0;
  totalVal += flete + pap + otros;
  const totalGtq = moneda==='mxn' && tc>0 ? totalVal*tc : (moneda==='gtq' ? totalVal : 0);

  const rec = {
    id:uid(), ts:now(), fecha,
    pais:v('vint-pais'), comprador:v('vint-comprador'),
    op, serviciosIncluidos:svcs, moneda,
    precioBase:v('vint-precio-base'), tc,
    lineas, totalLbs, totalBultos, totalVal, totalGtq,
    flete, pap, otros,
    porte:v('vint-porte'), placa:v('vint-placa'),
    contenedorRef:v('vint-contenedor-ref'), obs:v('vint-obs'),
    docFoto: vintDocData||null,
  };
  DB.vintVentas.push(rec);

  ['vint-fecha','vint-comprador','vint-porte','vint-placa','vint-contenedor-ref','vint-obs','vint-flete','vint-pap','vint-otros','vint-tc'].forEach(id=>set(id,''));
  document.getElementById('vint-lineas').innerHTML=''; vintLineaCount=0;
  vintDocData=null; document.getElementById('vint-doc-preview').style.display='none';
  document.getElementById('vint-totales').style.display='none';
  document.getElementById('vint-resumen-total').style.display='none';

  save(); renderVintVentas(); renderInvStock();
  toast('✓ Exportación registrada — '+totalLbs.toFixed(0)+' lbs · '+v('vint-moneda')==='mxn'?('$'+totalVal.toFixed(2))+' MXN':('Q'+totalVal.toFixed(2)));
}

function renderVintVentas() {
  invEnsureDB();
  if (!DB.vintVentas) DB.vintVentas = [];
  const tb = document.getElementById('vint-tbody'); if (!tb) return;
  if (!DB.vintVentas.length) { tb.innerHTML='<tr><td colspan="11"><div class="empty">Sin ventas internacionales</div></td></tr>'; return; }
  const OP_LABELS = { contenedor_completo:'🚛 Contenedor', parcial_transporte:'📦 Parcial+flete', solo_producto:'🥬 Solo producto', frontera_mx:'🇲🇽 Frontera MX' };
  const PAIS_FLAG = { MX:'🇲🇽', SV:'🇸🇻', HN:'🇭🇳', CR:'🇨🇷', NI:'🇳🇮', BZ:'🇧🇿' };
  tb.innerHTML = [...DB.vintVentas].reverse().map(r=>{
    const prods = r.lineas?.map(l=>l.productoNombre+' ×'+l.cant).join('<br>')||'—';
    const sym   = r.moneda==='mxn'?'$':'Q';
    return '<tr>'+
      '<td>'+r.fecha+'</td>'+
      '<td>'+(PAIS_FLAG[r.pais]||'🌍')+' '+r.pais+'</td>'+
      '<td style="font-size:.72rem;">'+(r.comprador||'—')+'</td>'+
      '<td style="font-size:.66rem;">'+(OP_LABELS[r.op]||r.op)+'</td>'+
      '<td style="font-size:.68rem;line-height:1.5;">'+prods+'</td>'+
      '<td>'+(r.totalLbs?.toFixed(0)||'—')+' lbs</td>'+
      '<td style="color:var(--acc);font-weight:700;">'+sym+' '+(r.totalVal?.toFixed(2)||'—')+'</td>'+
      '<td style="font-size:.66rem;color:var(--muted2);">'+(r.moneda==='mxn'?'MXN':'GTQ')+'</td>'+
      '<td style="color:var(--muted2);">'+(r.totalGtq>0?'Q '+r.totalGtq.toFixed(2):'—')+'</td>'+
      '<td>'+(r.docFoto?'<img src="'+r.docFoto+'" style="height:24px;border-radius:3px;">':'—')+'</td>'+
      '<td><button class="btn bo bsm" onclick="delVintVenta(\''+r.id+'\')">✕</button></td>'+
    '</tr>';
  }).join('');
}

function delVintVenta(id) {
  DB.vintVentas=(DB.vintVentas||[]).filter(r=>r.id!==id);
  save();renderVintVentas();renderInvStock();toast('Venta eliminada');
}

function vintExport() {
  invEnsureDB();
  if (!DB.vintVentas?.length) { toast('Sin ventas para exportar', true); return; }
  const rows=[['AJÚA — VENTAS INTERNACIONALES'],['Fecha','País','Comprador','Operación','Producto','Bultos','LBS','Precio','Subtotal','Moneda','TC','Total GTQ','Porte']];
  DB.vintVentas.forEach(v=>{
    (v.lineas||[]).forEach(l=>{
      rows.push([v.fecha,v.pais,v.comprador||'',v.op,l.productoNombre,l.cant,l.lbs.toFixed(1),l.precio,l.sub.toFixed(2),v.moneda,v.tc||'',v.totalGtq?.toFixed(2)||'',v.porte||'']);
    });
  });
  invDownloadCSV(rows,'Ventas_INT_'+new Date().toISOString().split('T')[0]);
}

function ineSelectProducto(id) {
  invEnsureDB();
  const prod = DB.iproductos.find(p => p.id === id);
  if (prod && prod.kgBulto) {
    const kgEl = document.getElementById('ine-kgbu');
    if (kgEl && !kgEl.value) kgEl.value = prod.kgBulto;
    ineCalcPesos();
  }
}

let ineCurrentDocType = null;
function ineHandleFile(input) {
  if (!input.files[0]) return;
  const type  = ineCurrentDocType || 'prod';
  const badge = document.getElementById('ine-badge-' + type);
  if (badge) badge.style.display = 'inline-flex';
  input.value = '';
  ineCurrentDocType = null;
  toast('✓ Documento cargado');
}

function ineCalcPesos() {
  const bultos = parseFloat(v('ine-bultos')) || 0;
  const kgBu   = parseFloat(v('ine-kgbu'))   || 0;
  const lbs    = bultos * kgBu * 2.20462;
  set('ine-lbs', lbs > 0 ? lbs.toFixed(1) + ' lbs' : '');
}

function ineLoadDoc(tipo, input) {
  const file = input.files[0]; if (!file) return;
  const badgeId = 'ine-foto-' + tipo + '-badge';
  const previewId = 'ine-xml-' + tipo + '-preview';

  if (file.name.endsWith('.xml') && tipo === 'mx') {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(e.target.result, 'text/xml');
        const ns  = 'http://www.sat.gob.gt/dte/fel/0.2.0';
        const emisor    = xml.getElementsByTagNameNS(ns,'Emisor')[0];
        const certif    = xml.getElementsByTagNameNS(ns,'NumeroAutorizacion')[0];
        const granTotal = xml.getElementsByTagNameNS(ns,'GranTotal')[0];
        const items     = xml.getElementsByTagNameNS(ns,'Item');
        const autNum    = certif ? (certif.getAttribute('Numero') || certif.textContent.trim()) : '';
        const emisorN   = emisor ? emisor.getAttribute('NombreEmisor') : '';
        const total     = granTotal ? parseFloat(granTotal.textContent).toFixed(2) : '0';

        ineDocData.mx = { xml: e.target.result, autNum, emisorN, total, items: Array.from(items).length };
        set('ine-fact-mx', autNum.substring(0, 16));

        const prev = document.getElementById(previewId);
        if (prev) {
          prev.style.display = 'block';
          prev.innerHTML = '<span style="color:var(--acc);">✓ ' + emisorN + '</span> — Autorización: ' + autNum.substring(0,12) + '... — Q' + total;
        }
        const badge = document.getElementById(badgeId);
        if (badge) badge.style.display = 'inline-flex';
        toast('✓ Factura MX leída');
      } catch(err) { toast('⚠ Error al leer XML', true); }
    };
    reader.readAsText(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    ineDocData[tipo] = { data: e.target.result, name: file.name };
    const badge = document.getElementById(badgeId);
    if (badge) badge.style.display = 'inline-flex';
    toast('✓ Documento cargado');
  };
  reader.readAsDataURL(file);
}

async function ineOpenCam() {
  try {
    ineCamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const vid = document.getElementById('ine-cam-video');
    vid.srcObject = ineCamStream; vid.style.display = 'block';
    document.getElementById('ine-cam-btns-open').style.display = 'none';
    document.getElementById('ine-cam-btns-active').style.display = 'flex';
  } catch { toast('⚠ No se pudo abrir la cámara', true); }
}
function ineCapture() {
  const vid = document.getElementById('ine-cam-video');
  const can = document.getElementById('ine-cam-canvas');
  can.width = vid.videoWidth; can.height = vid.videoHeight;
  const ctx = can.getContext('2d'); ctx.drawImage(vid, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, can.height - 36, can.width, 36);
  ctx.fillStyle = '#00d98b'; ctx.font = 'bold 14px monospace';
  ctx.fillText('AJÚA · Recepción · ' + new Date().toLocaleString('es-GT'), 10, can.height - 10);
  ineAlbaranData = can.toDataURL('image/jpeg', .88);
  document.getElementById('ine-albaran-img').src = ineAlbaranData;
  document.getElementById('ine-albaran-preview').style.display = 'block';
  ineCloseCam(); toast('✓ Foto capturada');
}
function ineCloseCam() {
  if (ineCamStream) { ineCamStream.getTracks().forEach(t => t.stop()); ineCamStream = null; }
  const vid = document.getElementById('ine-cam-video');
  vid.style.display = 'none'; vid.srcObject = null;
  document.getElementById('ine-cam-btns-open').style.display = 'flex';
  document.getElementById('ine-cam-btns-active').style.display = 'none';
}
function ineDeleteAlbaran() {
  ineAlbaranData = null;
  document.getElementById('ine-albaran-preview').style.display = 'none';
}
function ineLoadImage(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    ineAlbaranData = e.target.result;
    document.getElementById('ine-albaran-img').src = ineAlbaranData;
    document.getElementById('ine-albaran-preview').style.display = 'block';
    toast('✓ Imagen cargada');
  };
  reader.readAsDataURL(file);
}

function saveIne() {
  invEnsureDB();
  const fecha  = v('ine-fecha');
  const prodId = v('ine-prod');
  const bultos = parseFloat(v('ine-bultos')) || 0;
  const kgBu   = parseFloat(v('ine-kgbu'))   || 0;
  if (!fecha)  { toast('⚠ Ingresa la fecha', true); return; }
  if (!prodId) { toast('⚠ Selecciona un producto', true); return; }
  if (!bultos && !kgBu) { toast('⚠ Ingresa bultos o kg por bulto', true); return; }

  const prod    = DB.iproductos.find(p => p.id === prodId);
  const kgTotal  = bultos * kgBu;
  const lbsBruto = kgTotal * 2.20462;
  const cxlb     = parseFloat(v('ine-cxlb'))  || 0;

  const rec = {
    id: uid(), ts: now(), fecha,
    tipo: 'entrada',
    productoId:      prodId,
    productoNombre:  prod?.nombre || prodId,
    origen:          v('ine-origen') || '',
    productorNombre: v('ine-productor') || '',
    proveedorNombre: v('ine-proveedor') || '',
    factProductor:   v('ine-fact-prod') || '',
    factProveedor:   v('ine-fact-prov') || '',
    bultos, kgBu,
    kgBruto:  kgTotal,
    lbsBruto,
    cxlb,
    totalQ:   cxlb * lbsBruto,
    duca:     v('ine-duca') || '',
    cotRef:   v('ine-cot-ref') || '',
    obs:      v('ine-obs') || '',
    source:   'manual',
  };
  DB.ientradas.unshift(rec);

  ['ine-fecha','ine-bultos','ine-kgbu','ine-cxlb','ine-duca','ine-cot-ref','ine-obs','ine-origen','ine-productor','ine-proveedor','ine-fact-prod','ine-fact-prov'].forEach(id => set(id, ''));
  set('ine-prod', '');
  set('ine-lbs', '');
  ['ine-badge-prod','ine-badge-mx','ine-badge-duca'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });

  save(); renderIne(); renderInvStock();
  toast('✓ Ingreso registrado — ' + lbsBruto.toFixed(1) + ' lbs de ' + (prod?.nombre || prodId));
}


function cleanDuplicateEntradas() {
  invEnsureDB();
  const seen = new Map();
  const toKeep = [];
  let removed = 0;
  // Process oldest first (unshift puts newest first, so reverse)
  const sorted = [...DB.ientradas].reverse();
  sorted.forEach(r => {
    if (r.source === 'cotizador' && r.cotizacionId) {
      const key = r.cotizacionId + '|' + (r.productoNombre||r.productoId);
      if (seen.has(key)) { removed++; return; } // skip duplicate
      seen.set(key, true);
    }
    toKeep.push(r);
  });
  DB.ientradas = toKeep.reverse(); // restore newest-first order
  save(); renderIne(); renderInvStock();
  toast('✓ Limpiados '+removed+' ingresos duplicados');
}
function renderIne() {
  invEnsureDB();
  const tb = document.getElementById('ine-tbody'); if (!tb) return;
  const all = DB.ientradas || [];
  if (!all.length) { tb.innerHTML = '<tr><td colspan="9"><div class="empty">Sin ingresos registrados</div></td></tr>'; return; }

  // Mark duplicates (same cotizacionId + productoNombre from cotizador)
  const seen = new Map();
  all.forEach(r => {
    if (r.source === 'cotizador' && r.cotizacionId) {
      const key = r.cotizacionId + '|' + (r.productoNombre||r.productoId);
      if (!seen.has(key)) seen.set(key, r.id);
    }
  });

  tb.innerHTML = all.map(r => {
    const isDuplicate = r.source === 'cotizador' && r.cotizacionId &&
      seen.get(r.cotizacionId + '|' + (r.productoNombre||r.productoId)) !== r.id;
    const src  = r.source === 'cotizador' ? '<span class="chip ck" style="font-size:.55rem;">📋 Cotizador</span>' : '<span class="chip" style="font-size:.55rem;background:rgba(255,255,255,.06);">Manual</span>';
    const rowStyle = isDuplicate ? 'opacity:.35;background:rgba(255,56,88,.05);' : '';
    const dupBadge = isDuplicate ? '<span style="color:var(--danger);font-size:.55rem;"> ⚠ DUPLICADO</span>' : '';
    return '<tr style="'+rowStyle+'">' +
      '<td>'+r.fecha+'</td>' +
      '<td style="font-weight:700;font-size:.76rem;">'+r.productoNombre+dupBadge+'</td>' +
      '<td>'+src+'</td>' +
      '<td style="color:var(--acc);font-weight:700;">'+(r.lbsNeto||r.lbsBruto||0).toFixed(1)+' lbs</td>' +
      '<td>'+(r.bultos||'—')+'</td>' +
      '<td style="font-size:.68rem;color:var(--muted2);">'+(r.costoLb?'Q '+r.costoLb.toFixed(4):'—')+'</td>' +
      '<td style="font-size:.68rem;">'+(r.duca||'—')+'</td>' +
      '<td>'+src+'</td>' +
      '<td style="font-size:.68rem;color:var(--muted2);">'+(r.obs||'—')+'</td>' +
      '<td><button class="btn bo bsm" style="border-color:var(--danger);color:var(--danger);" onclick="delIne(\"'+r.id+'\")">✕</button></td>' +
      '</tr>';
  }).join('');
}

function delIne(id) {
  DB.ientradas = DB.ientradas.filter(r => r.id !== id);
  save(); renderIne(); renderInvStock(); toast('Entrada eliminada');
}

let salCamStream  = null;
let salAlbaranData= null;
let salEdiwinData = null;   // base64 of Ediwin PDF/image
let salLineaCount = 0;

function salSelectCliente(id) {
  if (!v('sal-fecha')) set('sal-fecha', today());
  salRefreshPresentaciones();
}

function salRefreshPresentaciones() {
  for (let i = 1; i <= salLineaCount; i++) {
    const prodSel = document.getElementById('sal-lin-prod-' + i);
    if (prodSel?.value) salLineaProdChange(i);
  }
}

function salAddLinea() {
  invEnsureDB();
  salLineaCount++;
  const n    = salLineaCount;
  const cont = document.getElementById('sal-lineas');
  const div  = document.createElement('div');
  div.id     = 'sal-lin-' + n;
  div.style.cssText = 'background:var(--s2);border:1.5px solid var(--br);border-radius:4px;padding:10px;margin-bottom:8px;';
  const pOpts = DB.iproductos.map(p => '<option value="' + p.id + '">' + p.nombre + '</option>').join('');
  const fs    = 'background:var(--s1);border:1.5px solid var(--br);color:var(--txt);padding:7px;border-radius:4px;width:100%;font-family:var(--fm);font-size:.74rem;';
  div.innerHTML =
    '<div style="display:grid;grid-template-columns:2fr 2fr 80px 100px 100px auto;gap:8px;align-items:end;">' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Producto</label>' +
        '<select id="sal-lin-prod-' + n + '" onchange="salLineaProdChange(' + n + ')" style="' + fs + '">' +
          '<option value="">— Seleccionar —</option>' + pOpts + '</select></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Presentación / Empaque</label>' +
        '<select id="sal-lin-pres-' + n + '" onchange="salLineaCalc(' + n + ')" style="' + fs + '">' +
          '<option value="">— Presentación —</option></select></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Cantidad</label>' +
        '<input type="number" id="sal-lin-bultos-' + n + '" min="1" placeholder="0" oninput="salLineaCalc(' + n + ')" style="' + fs + '"></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Precio U. Q</label>' +
        '<input type="number" id="sal-lin-precio-' + n + '" step="0.01" placeholder="0.00" oninput="salLineaCalc(' + n + ')" style="' + fs + '"></div>' +
      '<div><label style="font-size:.62rem;color:var(--muted2);display:block;margin-bottom:3px;">Total Q</label>' +
        '<input id="sal-lin-total-' + n + '" readonly style="' + fs + 'color:var(--acc);cursor:default;background:var(--s3);"></div>' +
      '<button onclick="document.getElementById(\'sal-lin-' + n + '\').remove();salRecalcTotales();" style="background:var(--danger);color:#fff;border:none;padding:7px 10px;border-radius:4px;cursor:pointer;height:34px;align-self:end;">✕</button>' +
    '</div>' +
    '<div id="sal-lin-info-' + n + '" style="font-size:.64rem;color:var(--muted2);margin-top:4px;"></div>';
  cont.appendChild(div);
  document.getElementById('sal-totales').style.display = 'block';
}

function salLineaProdChange(n) {
  invEnsureDB();
  const prodId  = document.getElementById('sal-lin-prod-' + n)?.value;
  const presSel = document.getElementById('sal-lin-pres-' + n);
  if (!presSel) return;
  const pres = (DB.ipresentaciones || []).filter(p => p.productoId === prodId);
  presSel.innerHTML = '<option value="">— Presentación —</option>' +
    pres.map(p => '<option value="' + p.id + '">' + p.nombre + ' (' + p.lbsBulto + ' lbs)</option>').join('');
  salLineaCalc(n);
}

function salLineaCalc(n) {
  invEnsureDB();
  const presId  = document.getElementById('sal-lin-pres-' + n)?.value;
  const bultos  = parseFloat(document.getElementById('sal-lin-bultos-' + n)?.value) || 0;
  const precio  = parseFloat(document.getElementById('sal-lin-precio-' + n)?.value) || 0;
  const pres    = (DB.ipresentaciones || []).find(p => p.id === presId);
  const lbs     = bultos * (pres?.lbsBulto || 0);
  const tot     = bultos * precio;
  const totEl   = document.getElementById('sal-lin-total-' + n);
  const infoEl  = document.getElementById('sal-lin-info-' + n);
  if (totEl) totEl.value = tot ? 'Q ' + tot.toFixed(2) : '';
  if (infoEl && pres) {
    infoEl.textContent = bultos + ' ' + (pres.isWalmart ? 'cajas' : pres.tipoEmpaque || 'uds') +
      (pres.lbsBulto > 0 ? ' × ' + pres.lbsBulto + ' lbs = ' + lbs.toFixed(1) + ' lbs totales' : '');
  }
  salRecalcTotales();
}

function salRecalcTotales() {
  invEnsureDB();
  const IVA_FACTOR = 1.12, RET = 0.80;
  let bultos=0, lbs=0, neto=0, iva=0, conIva=0, ret=0, aCobrar=0;
  for (let i = 1; i <= salLineaCount; i++) {
    const presId = document.getElementById('sal-lin-pres-' + i)?.value;
    const b = parseFloat(document.getElementById('sal-lin-bultos-' + i)?.value) || 0;
    const p = parseFloat(document.getElementById('sal-lin-precio-' + i)?.value) || 0;
    const pres = (DB.ipresentaciones || []).find(pr => pr.id === presId);
    const lineConIva = b * p;            // precio ya incluye IVA
    const lineNeto   = lineConIva / IVA_FACTOR;
    const lineIva    = lineConIva - lineNeto;
    bultos   += b;
    lbs      += b * (pres?.lbsBulto || 0);
    neto     += lineNeto;
    iva      += lineIva;
    conIva   += lineConIva;
    ret      += lineIva * RET;
    aCobrar  += lineConIva - (lineIva * RET);
  }
  set('sal-tot-bultos',  bultos);
  set('sal-tot-lbs',     lbs.toFixed(1) + ' lbs');
  set('sal-tot-neto',    'Q ' + neto.toFixed(2));
  set('sal-tot-iva',     'Q ' + iva.toFixed(2));
  set('sal-tot-coniva',  'Q ' + conIva.toFixed(2));
  set('sal-tot-ret',     'Q ' + ret.toFixed(2));
  set('sal-tot-acobrar', 'Q ' + aCobrar.toFixed(2));
  set('sal-tot-q', 'Q ' + conIva.toFixed(2));
  const totDiv = document.getElementById('sal-totales');
  if (totDiv) totDiv.style.display = bultos>0?'block':'none';
}

function salLoadEdiwin(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    salEdiwinData = e.target.result;
    const badge = document.getElementById('sal-ediwin-badge');
    if (badge) badge.style.display = 'inline-flex';
    toast('✓ Documento cargado — analizando...');
    await salReadEdiwinAI();
  };
  reader.readAsDataURL(file);
}

async function salReadEdiwinAI() {
  if (!salEdiwinData) return;
  const loading = document.getElementById('sal-ediwin-loading');
  const result  = document.getElementById('sal-ediwin-result');
  if (loading) loading.style.display = 'block';
  if (result)  result.style.display  = 'none';

  try {
    invEnsureDB();
    const base64    = salEdiwinData.split(',')[1];
    const mediaType = salEdiwinData.split(';')[0].split(':')[1];
    const isPDF     = mediaType === 'application/pdf';

    const prods = DB.iproductos || [];
    const pres   = DB.ipresentaciones || [];

    const prodDB = prods.map(p =>
      p.id + '|' + p.nombre + (p.nombreAlt ? '|' + p.nombreAlt : '')
    ).join('; ');

    const presDB = pres.map(pr =>
      pr.id + '|' + pr.nombre + '|' + (pr.lbsBulto||0) + 'lbs|prod:' + pr.productoId
    ).join('; ');

    const schema = '{"numero_autorizacion":"","serie":"","numero_dte":"","fecha_emision":"YYYY-MM-DD","orden_compra":"","numero_entrega":"","planta":"","total_con_iva_gtq":0,"total_iva_gtq":0,"productos":[{"descripcion_original":"","cantidad_cajas":0,"precio_con_iva_unitario":0,"total_con_iva":0,"producto_id_ajua":"ID_EXACTO_DEL_CATALOGO","presentacion_id_ajua":"ID_EXACTO_DEL_CATALOGO","nombre_matcheado":""}]}';

    const instruccion = isPDF
      ? 'Analiza este PDF Ediwin/factura de Walmart Guatemala y extrae TODOS los datos. ' +
        'CATALOGO DE PRODUCTOS (formato id|nombre): ' + prodDB + '. ' +
        'CATALOGO DE PRESENTACIONES (formato id|nombre|lbs|productoId): ' + presDB + '. ' +
        'Para cada producto en el documento: ' +
        '1) Busca el ID exacto en el catálogo comparando el nombre del documento con los nombres del catálogo. ' +
        '2) Pon ese ID en producto_id_ajua. Si no encuentras coincidencia exacta, busca la más similar. ' +
        '3) Igual para presentacion_id_ajua buscando en el catálogo de presentaciones. ' +
        '4) precio_con_iva_unitario es el precio unitario TAL COMO aparece en el documento (ya incluye IVA 12%). ' +
        'Responde SOLO con JSON válido usando este esquema exacto, sin texto adicional: ' + schema
      : 'Analiza esta imagen del documento Ediwin/factura de Walmart Guatemala. ' +
        'CATALOGO PRODUCTOS (id|nombre): ' + prodDB + '. ' +
        'PRESENTACIONES (id|nombre|lbs): ' + presDB + '. ' +
        'Extrae los datos y asigna producto_id_ajua y presentacion_id_ajua del catálogo. ' +
        'precio_con_iva_unitario incluye IVA. Responde SOLO JSON: ' + schema;

    const msgContent = isPDF
      ? [{ type:'document', source:{ type:'base64', media_type:'application/pdf', data:base64 } },
         { type:'text', text: instruccion }]
      : [{ type:'image',    source:{ type:'base64', media_type:mediaType, data:base64 } },
         { type:'text', text: instruccion }];

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':ANTHROPIC_API_KEY,
        'anthropic-dangerous-direct-browser-access':'true',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:2000,
        messages:[{ role:'user', content:msgContent }] })
    });
    const d = await r.json();
    if (!r.ok || d.error) {
      const msg = d.error?.message || JSON.stringify(d.error) || 'HTTP ' + r.status;
      throw new Error(msg);
    }
    let text = (d.content?.[0]?.text || '').replace(/```json|```/g,'').trim();
    const data = JSON.parse(text);

    if (data.numero_autorizacion) set('sal-factura', data.numero_autorizacion);
    if (data.serie)               set('sal-serie',   data.serie);
    if (data.numero_dte)          set('sal-dte',      data.numero_dte);
    if (data.orden_compra)        set('sal-oc',       data.orden_compra);
    if (data.numero_entrega)      set('sal-docmat',   data.numero_entrega);
    if (data.planta)              set('sal-almacen',  data.planta);
    if (data.fecha_emision)       set('sal-fecha',    data.fecha_emision.substring(0,10));

    if (data.productos?.length) {
      document.getElementById('sal-lineas').innerHTML = '';
      salLineaCount = 0;

      data.productos.forEach(p => {
        salAddLinea();
        const n = salLineaCount;

        let prodId = p.producto_id_ajua || '';
        if (prodId && !prods.find(pr => pr.id === prodId)) prodId = '';
        if (!prodId && p.descripcion_original) {
          const desc = p.descripcion_original.toLowerCase().replace(/[^a-záéíóúñ ]/gi,'');
          const best = prods.find(pr => {
            const nom = (pr.nombre || '').toLowerCase();
            return desc.includes(nom) || nom.includes(desc) ||
                   desc.split(' ').some(w => w.length > 3 && nom.includes(w));
          });
          if (best) prodId = best.id;
        }
        if (prodId) {
          const prodSel = document.getElementById('sal-lin-prod-' + n);
          if (prodSel) { prodSel.value = prodId; salLineaProdChange(n); }
        }

        let presId = p.presentacion_id_ajua || '';
        if (presId && !pres.find(pr => pr.id === presId)) presId = '';
        if (!presId && prodId) {
          const firstPres = pres.find(pr => pr.productoId === prodId);
          if (firstPres) presId = firstPres.id;
        }
        if (presId) {
          const presSel = document.getElementById('sal-lin-pres-' + n);
          if (presSel) { presSel.value = presId; salLineaCalc(n); }
        }

        if (p.cantidad_cajas) {
          const bEl = document.getElementById('sal-lin-bultos-' + n);
          if (bEl) bEl.value = p.cantidad_cajas;
        }
        const pVal = p.precio_con_iva_unitario || 0;
        if (pVal) {
          const pEl = document.getElementById('sal-lin-precio-' + n);
          if (pEl) pEl.value = pVal.toFixed(2);
        }
        salLineaCalc(n);
      });
      salRecalcTotales();
    }

    if (loading) loading.style.display = 'none';
    if (result) {
      result.style.display = 'block';
      const matched = (data.productos||[]).filter(p => p.producto_id_ajua).length;
      const total   = (data.productos||[]).length;
      result.innerHTML =
        '<div style="color:var(--acc);font-weight:700;margin-bottom:6px;">✅ Ediwin procesado — ' + total + ' producto(s) · ' + matched + '/' + total + ' matcheados</div>' +
        (data.orden_compra   ? '<div style="font-size:.72rem;">🛒 OC: <strong>' + data.orden_compra   + '</strong></div>' : '') +
        (data.numero_entrega ? '<div style="font-size:.72rem;">📦 No. Entrega: <strong>' + data.numero_entrega + '</strong></div>' : '') +
        (data.total_con_iva_gtq > 0 ? '<div style="font-size:.72rem;">💰 Total factura: <strong>Q ' + data.total_con_iva_gtq.toFixed(2) + '</strong></div>' : '') +
        (matched < total ? '<div style="font-size:.68rem;color:var(--warn);margin-top:4px;">⚠ ' + (total-matched) + ' producto(s) no matcheados — selecciónalos manualmente</div>' : '') +
        '<div style="font-size:.62rem;color:var(--muted2);margin-top:4px;">Verifica cantidades y precios antes de guardar.</div>';
    }
    toast('✅ Ediwin listo — ' + (data.productos?.length||0) + ' productos');
  } catch(err) {
    if (loading) loading.style.display = 'none';
    const isNetwork = !err.message || err.message.includes('fetch') || err.message.includes('Failed') || err.message.includes('network');
    if (result) {
      result.style.display = 'block';
      result.innerHTML = isNetwork
        ? '<div style="color:var(--warn);padding:10px;border:1.5px solid rgba(245,197,24,.3);border-radius:4px;">⚠ La lectura automática con IA no está disponible en esta plataforma.<br><span style="font-size:.75rem;color:var(--muted2);">Ingresa los datos del albarán manualmente en los campos de abajo.</span></div>'
        : '<span style="color:var(--danger);">⚠ Error: ' + err.message + '</span>';
    }
    console.error('salReadEdiwinAI error:', err);
  }
}

function salReadXML(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const xmlStr = e.target.result;
      const badge  = document.getElementById('sal-xml-badge');
      if (badge) badge.style.display = 'inline-flex';

      // ── Parse con DOMParser (maneja namespaces correctamente) ────
      const parser = new DOMParser();
      const doc    = parser.parseFromString(xmlStr, 'application/xml');

      // Helper: busca un elemento por localName ignorando namespace prefix
      const qn = (parent, localName) => {
        // Intentar directamente
        let els = parent.getElementsByTagNameNS('*', localName);
        if (els.length) return els;
        // Fallback: búsqueda por tagName con prefijos comunes
        for (const prefix of ['dte:', '']) {
          els = parent.getElementsByTagName(prefix + localName);
          if (els.length) return els;
        }
        return [];
      };
      const txt = (parent, localName) => {
        const els = qn(parent, localName);
        return els[0]?.textContent?.trim() || '';
      };
      const attr = (el, attrName) => {
        if (!el) return '';
        // buscar con y sin namespace
        return el.getAttribute(attrName) || el.getAttribute('dte:'+attrName) || '';
      };

      // ── Datos Generales ──────────────────────────────────────────
      const datosGen  = qn(doc, 'DatosGenerales')[0];
      const fechaHora = attr(datosGen, 'FechaHoraEmision') || '';
      const fecha     = fechaHora.substring(0, 10);
      const tipo      = attr(datosGen, 'Tipo') || 'FACT';
      const moneda    = attr(datosGen, 'CodigoMoneda') || 'GTQ';

      // ── Emisor ───────────────────────────────────────────────────
      const emisorEl  = qn(doc, 'Emisor')[0];
      const nitEmisor = attr(emisorEl, 'NITEmisor')     || '';
      const nomEmisor = attr(emisorEl, 'NombreEmisor')  || '';
      const nomCom    = attr(emisorEl, 'NombreComercial') || '';

      // ── Receptor ─────────────────────────────────────────────────
      const recEl     = qn(doc, 'Receptor')[0];
      const nitRec    = attr(recEl, 'IDReceptor')       || '';
      const nomRec    = attr(recEl, 'NombreReceptor')   || '';

      // ── Certificación ────────────────────────────────────────────
      const certEl    = qn(doc, 'Certificacion')[0];
      const numAutEl  = qn(certEl || doc, 'NumeroAutorizacion')[0];
      const numAut    = numAutEl?.textContent?.trim() || '';
      const serie     = numAutEl ? attr(numAutEl, 'Serie') : '';
      const numeroDTE = numAutEl ? attr(numAutEl, 'Numero') : '';

      // ── Totales ──────────────────────────────────────────────────
      const granTotalTxt = txt(doc, 'GranTotal');
      const granTotal    = parseFloat(granTotalTxt) || 0;
      const totalIVATxt  = qn(doc, 'TotalImpuesto')[0];
      const totalIVA     = parseFloat(attr(totalIVATxt, 'TotalMontoImpuesto')) || 0;

      // ── Aplicar datos fiscales al formulario ─────────────────────
      if (numAut)    set('sal-factura', numAut);
      if (serie)     set('sal-serie',   serie);
      if (numeroDTE) set('sal-dte',     numeroDTE);
      if (fecha)     set('sal-fecha',   fecha);
      // Si el receptor tiene NIT Walmart (~1926272) setearlo
      if (nitRec)    set('sal-nit', nitRec);

      // ── Items / Líneas ───────────────────────────────────────────
      const itemEls = [...qn(doc, 'Item')];

      // Limpiar líneas actuales y reiniciar
      document.getElementById('sal-lineas').innerHTML = '';
      salLineaCount = 0;

      const lineasCargadas = [];

      itemEls.forEach((item, idx) => {
        const desc       = txt(item, 'Descripcion');
        const cantStr    = txt(item, 'Cantidad');
        const precioStr  = txt(item, 'PrecioUnitario');
        const totalStr   = txt(item, 'Total');
        const nroLinea   = attr(item, 'NumeroLinea') || (idx+1);

        const cant    = parseFloat(cantStr)   || 1;
        // En FEL SAT Guatemala: Total = cant × PrecioUnitario, y Total YA INCLUYE IVA
        // MontoGravable = Total / 1.12 (base sin IVA)
        // MontoImpuesto = MontoGravable × 0.12
        const totalLinea    = parseFloat(totalStr) || 0;
        const montoGravable = parseFloat(txt(item, 'MontoGravable')) || (totalLinea / 1.12);
        const montoImpuesto = parseFloat(txt(item, 'MontoImpuesto')) || (montoGravable * 0.12);
        // precioConIVA = Total / Cantidad (precio unitario ya con IVA)
        const precioConIVA  = cant > 0 ? totalLinea / cant : parseFloat(precioStr) || 0;
        const precioSinIVA  = precioConIVA / 1.12;

        if (!desc && cant === 0) return; // saltar líneas vacías

        // Agregar línea al formulario
        salAddLinea();
        const n = salLineaCount;

        // Match producto por nombre (primero exacto, luego parcial)
        const descUp = desc.toUpperCase();
        let prodMatch = (DB.iproductos||[]).find(p => p.nombre.toUpperCase() === descUp);
        if (!prodMatch) {
          // Buscar por primera palabra significativa (>=4 chars)
          const palabra = descUp.split(' ').find(w => w.length >= 4) || '';
          if (palabra) prodMatch = (DB.iproductos||[]).find(p =>
            p.nombre.toUpperCase().includes(palabra) ||
            descUp.includes(p.nombre.toUpperCase())
          );
        }

        // Buscar presentación que coincida
        // PRIORIDAD 1: código UXC exacto (ej. "UXC_24" en el desc del FEL)
        let presMatch = null;
        if (prodMatch) {
          const uxcMatch = descUp.match(/UXC_(\d+)/);
          if (uxcMatch) {
            const uxcCode = uxcMatch[0]; // ej. "UXC_24"
            presMatch = (DB.ipresentaciones||[]).find(pr =>
              pr.productoId === prodMatch.id &&
              pr.nombre.toUpperCase().includes(uxcCode)
            );
          }
          if (!presMatch) {
            // Fallback: descripción completa incluida en nombre de presentación
            presMatch = (DB.ipresentaciones||[]).find(pr =>
              pr.productoId === prodMatch.id &&
              desc.toUpperCase().includes(pr.nombre.toUpperCase())
            );
          }
          if (!presMatch) {
            // Último recurso: primera presentación del producto
            presMatch = (DB.ipresentaciones||[]).find(pr =>
              pr.productoId === prodMatch.id
            );
          }
        }

        lineasCargadas.push({ n, desc, cant, precioConIVA, precioSinIVA, totalLinea, prodMatch, presMatch });
      });

      // Aplicar valores con pequeño delay para que el DOM esté listo
      setTimeout(() => {
        lineasCargadas.forEach(({ n, desc, cant, precioConIVA, prodMatch, presMatch }) => {
          // Set producto
          if (prodMatch) {
            const prodSel = document.getElementById('sal-lin-prod-' + n);
            if (prodSel) {
              prodSel.value = prodMatch.id;
              if (typeof salLineaProdChange === 'function') salLineaProdChange(n);
            }
          }
          // Set presentación si hay match
          if (presMatch) {
            setTimeout(() => {
              const presSel = document.getElementById('sal-lin-pres-' + n);
              if (presSel) presSel.value = presMatch.id;
            }, 80);
          }
          // Set cantidad y precio
          setTimeout(() => {
            const bultosEl = document.getElementById('sal-lin-bultos-' + n);
            const precioEl = document.getElementById('sal-lin-precio-' + n);
            // Si no hay campo de producto, poner descripción en un campo de obs o nombre
            const nomEl    = document.getElementById('sal-lin-nom-'    + n);
            if (nomEl && !prodMatch) nomEl.value = desc;
            if (bultosEl) bultosEl.value = cant;
            if (precioEl) precioEl.value = precioConIVA.toFixed(2);
            if (typeof salLineaCalc === 'function') salLineaCalc(n);
          }, 160);
        });
        // Recalcular totales finales
        setTimeout(() => {
          if (typeof salRecalcTotales === 'function') salRecalcTotales();
        }, 400);
      }, 100);

      // ── Vista previa ─────────────────────────────────────────────
      const previewEl = document.getElementById('sal-xml-preview');
      if (previewEl) {
        previewEl.style.display = 'block';
        const iconTipo = tipo === 'FACT' ? '🧾 Factura' : tipo === 'NCRE' ? '📝 Nota Crédito' : tipo;
        const detLines = itemEls.map((item, i) => {
          const d = txt(item, 'Descripcion');
          const c = txt(item, 'Cantidad');
          const t = txt(item, 'Total');
          const matched = lineasCargadas[i]?.prodMatch;
          const matchTag = matched
            ? `<span style="color:var(--acc);font-weight:700;">✓ ${matched.nombre}</span>`
            : `<span style="color:var(--warn);">⚠ sin match — asignar manualmente</span>`;
          return `<div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05);">
            <strong>${c}×</strong> ${d} — Q ${parseFloat(t).toFixed(2)} ${matchTag}</div>`;
        }).join('');

        previewEl.innerHTML = `
          <div style="font-weight:700;color:var(--acc);margin-bottom:6px;">✅ XML FEL del SAT Guatemala leído correctamente</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:.68rem;margin-bottom:8px;">
            <div>📄 ${iconTipo} · ${moneda}</div>
            <div>📅 ${fecha}</div>
            <div>🏭 ${nomCom || nomEmisor}</div>
            <div>👤 ${nomRec} (NIT: ${nitRec})</div>
            ${numAut ? `<div colspan="2">🔑 Auth: <strong style="color:var(--info);">${numAut.substring(0,36)}</strong></div>` : ''}
            ${serie  ? `<div>Serie: <strong>${serie}</strong>  No. ${numeroDTE}</div>` : ''}
            <div>💰 Gran Total: <strong style="color:var(--acc);">Q ${granTotal.toFixed(2)}</strong></div>
            <div>IVA: Q ${totalIVA.toFixed(2)}</div>
          </div>
          <div style="font-size:.68rem;font-weight:700;color:var(--warn);margin-bottom:4px;">📦 ${itemEls.length} línea(s) de producto:</div>
          <div style="font-size:.68rem;line-height:1.8;">${detLines}</div>`;
      }

      const matchCount = lineasCargadas.filter(l => l.prodMatch).length;
      toast(`✅ FEL cargado — ${itemEls.length} líneas · ${matchCount} productos reconocidos`);

    } catch(err) {
      console.error('salReadXML error:', err);
      const previewEl = document.getElementById('sal-xml-preview');
      if (previewEl) {
        previewEl.style.display = 'block';
        previewEl.innerHTML = `<span style="color:var(--danger);">⚠ Error leyendo XML: ${err.message}</span>`;
      }
      toast('⚠ Error al leer XML FEL: ' + err.message, true);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

async function salOpenCam() {
  try {
    salCamStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } });
    const vid = document.getElementById('sal-cam-video');
    vid.srcObject = salCamStream; vid.style.display = 'block';
    document.getElementById('sal-cam-open-btns').style.display = 'none';
    document.getElementById('sal-cam-active').style.display = 'flex';
  } catch { toast('⚠ No se pudo abrir la cámara', true); }
}
function salCapture() {
  const vid = document.getElementById('sal-cam-video');
  const can = document.getElementById('sal-cam-canvas');
  can.width = vid.videoWidth; can.height = vid.videoHeight;
  const ctx = can.getContext('2d'); ctx.drawImage(vid,0,0);
  ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(0,can.height-36,can.width,36);
  ctx.fillStyle='#00d98b'; ctx.font='bold 14px monospace';
  ctx.fillText('AJÚA · Despacho · '+new Date().toLocaleString('es-GT'),10,can.height-10);
  salAlbaranData = can.toDataURL('image/jpeg',.88);
  document.getElementById('sal-albaran-img').src = salAlbaranData;
  document.getElementById('sal-albaran-preview').style.display = 'block';
  document.getElementById('sal-ai-btn').style.display = 'block';
  salCloseCam(); toast('✓ Foto capturada');
}
function salCloseCam() {
  if (salCamStream) { salCamStream.getTracks().forEach(t=>t.stop()); salCamStream=null; }
  const vid = document.getElementById('sal-cam-video');
  vid.style.display='none'; vid.srcObject=null;
  document.getElementById('sal-cam-open-btns').style.display='flex';
  document.getElementById('sal-cam-active').style.display='none';
}
function salDeleteAlbaran() {
  salAlbaranData=null;
  document.getElementById('sal-albaran-preview').style.display='none';
  document.getElementById('sal-ai-btn').style.display='none';
  document.getElementById('sal-ai-result').style.display='none';
}
function salLoadImage(input) {
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    salAlbaranData=e.target.result;
    document.getElementById('sal-albaran-img').src=salAlbaranData;
    document.getElementById('sal-albaran-preview').style.display='block';
    document.getElementById('sal-ai-btn').style.display='block';
    toast('✓ Imagen cargada');
  };
  reader.readAsDataURL(file);
}

async function salReadAlbaranAI() {
  if (!salAlbaranData) { toast('⚠ Primero toma o carga el albarán', true); return; }
  const loading = document.getElementById('sal-ai-loading');
  const result  = document.getElementById('sal-ai-result');
  loading.style.display='inline'; result.style.display='none';
  try {
    invEnsureDB();
    const base64    = salAlbaranData.split(',')[1];
    const mediaType = salAlbaranData.split(';')[0].split(':')[1];
    const prodDB    = DB.iproductos.map(p=>p.nombre+' [id:'+p.id+']').join(', ');
    const presDB    = DB.ipresentaciones.map(pr=>pr.nombre+' [id:'+pr.id+'] '+pr.lbsBulto+'lbs').join(', ');
    const schema    = '{"orden_compra":"","numero_entrega":"","planta":"","fecha":"","productos":[{"descripcion":"","cantidad":0,"precio_unitario":0,"total":0,"producto_id_ajua":"","presentacion_id_ajua":""}],"total_general":0}';
    const r = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_API_KEY,'anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1200,
        messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:mediaType,data:base64}},
          {type:'text',text:'Analiza este albarán de Walmart Guatemala. Productos AJÚA: '+prodDB+'. Presentaciones: '+presDB+'. Responde SOLO JSON sin markdown: '+schema}
        ]}]})
    });
    const data=await r.json();
    const text=data.content?.map(i=>i.text||'').join('').trim();
    let parsed=null;
    try{parsed=JSON.parse(text.replace(/^```[\w]*\n?/,'').replace(/\n?```$/,'').trim());}catch{parsed=null;}
    loading.style.display='none';
    if(parsed){
      result._parsed=parsed;
      if(parsed.orden_compra) set('sal-oc',     parsed.orden_compra);
      if(parsed.numero_entrega) set('sal-docmat',parsed.numero_entrega);
      if(parsed.planta) set('sal-almacen',      parsed.planta);
      let html='<div style="color:var(--acc);font-weight:700;margin-bottom:8px;">✨ Albarán leído</div>';
      if(parsed.orden_compra) html+='<div>OC: <strong style="color:var(--acc);">'+parsed.orden_compra+'</strong></div>';
      if(parsed.numero_entrega) html+='<div>Entrega: <strong style="color:var(--info);">'+parsed.numero_entrega+'</strong></div>';
      if(parsed.productos?.length){
        parsed.productos.forEach(p=>{
          html+='<div style="font-size:.7rem;margin-top:3px;">• <strong>'+p.descripcion+'</strong> × '+p.cantidad+' @ Q'+p.precio_unitario+'</div>';
        });
        html+='<div style="margin-top:8px;"><button class="btn bp bsm" style="font-size:.65rem;" onclick="salApplyAlbaran()">✓ Cargar líneas</button></div>';
      }
      result.innerHTML=html; result.style.display='block';
      toast('✓ Albarán leído');
    } else {
      result.innerHTML='<pre style="font-size:.65rem;">'+text.substring(0,400)+'</pre>';
      result.style.display='block';
    }
  } catch(err) { loading.style.display='none'; toast('⚠ Error al analizar', true); }
}

function salApplyAlbaran() {
  const result=document.getElementById('sal-ai-result');
  const parsed=result?._parsed; if(!parsed) return;
  salBuildLineasFromProductos(parsed.productos||[]);
}

function salApplyAI() { salApplyAlbaran(); }

function saveSal() {
  invEnsureDB();
  const fecha = v('sal-fecha') || today();
  if (!fecha) { toast('⚠ Ingrese la fecha', true); return; }

  const lineas = [];
  for (let i = 1; i <= salLineaCount; i++) {
    const prodId = document.getElementById('sal-lin-prod-'   + i)?.value;
    const presId = document.getElementById('sal-lin-pres-'   + i)?.value;
    if (!prodId) continue;
    const bultos = parseFloat(document.getElementById('sal-lin-bultos-' + i)?.value) || 0;
    const precio = parseFloat(document.getElementById('sal-lin-precio-' + i)?.value) || 0;
    if (!bultos) continue;
    const prod = DB.iproductos.find(p => p.id === prodId);
    const pres = (DB.ipresentaciones||[]).find(p => p.id === presId);
    const lineConIVA  = bultos * precio;
    const lineNeto    = lineConIVA / 1.12;
    const lineIVA     = lineConIVA - lineNeto;
    const lineRet     = lineIVA * 0.80;   // retención Walmart: 80% del IVA
    const lineACobrar = lineConIVA - lineRet;
    // lbsBulto: if pres defines it use it; for unit products it may be 0
    const lbsBultoReal = pres?.lbsBulto || 0;
    const totalLbsLinea = lbsBultoReal > 0 ? bultos * lbsBultoReal : 0;
    lineas.push({
      productoId:       prodId,
      productoNombre:   prod?.nombre || '',
      presentacionId:   presId || null,
      presentacionNombre: pres?.nombre || '',
      bultos,
      lbsBulto:         lbsBultoReal,
      totalLbs:         totalLbsLinea,
      precio,
      totalNeto:        lineNeto,
      totalIVA:         lineIVA,
      totalConIVA:      lineConIVA,
      totalRetencion:   lineRet,
      totalACobrar:     lineACobrar,
    });
  }
  if (!lineas.length) { toast('⚠ Agrega al menos un producto con cantidad', true); return; }

  const totalLbs     = lineas.reduce((s,l) => s + l.totalLbs,       0);
  const totalNeto    = lineas.reduce((s,l) => s + l.totalNeto,      0);
  const totalIVA     = lineas.reduce((s,l) => s + l.totalIVA,       0);
  const totalConIVA  = lineas.reduce((s,l) => s + l.totalConIVA,    0);
  const totalRet     = lineas.reduce((s,l) => s + l.totalRetencion, 0);
  const totalACobrar = lineas.reduce((s,l) => s + l.totalACobrar,   0);

  const rec = {
    id: uid(), ts: now(), fecha,
    tipo:           'walmart',
    clienteId:      'walmart-gt',
    clienteNombre:  'Walmart Guatemala',
    clienteNit:     '1926272',
    lineas,
    totalLbs,
    totalNeto,    totalIVA,
    totalConIVA,  totalRetencion: totalRet,  totalACobrar,
    totalQ:       totalConIVA,
    factura:   v('sal-factura'),
    serie:     v('sal-serie'),
    dte:       v('sal-dte'),
    oc:        v('sal-oc'),
    docMat:    v('sal-docmat'),
    almacen:   v('sal-almacen'),
    obs:       v('sal-obs'),
    docEdiwin: !!salEdiwinData,
    albaranFoto: salAlbaranData || null,
  };

  DB.isalidas.unshift(rec);

  document.getElementById('sal-lineas').innerHTML = '';
  salLineaCount = 0;
  salEdiwinData = null; salAlbaranData = null;
  document.getElementById('sal-totales').style.display = 'none';
  ['sal-ediwin-badge','sal-xml-badge'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  ['sal-ediwin-result','sal-xml-preview'].forEach(id => {
    const el = document.getElementById(id); if (el) { el.style.display='none'; el.innerHTML=''; }
  });
  ['sal-oc','sal-docmat','sal-factura','sal-serie','sal-dte','sal-almacen','sal-obs'].forEach(id => set(id,''));
  set('sal-fecha', today());

  save(); renderSal(); renderInvStock();
  toast('✓ Venta registrada — ' + totalLbs.toFixed(1) + ' lbs · Q ' + totalConIVA.toFixed(2) + ' (a cobrar Q ' + totalACobrar.toFixed(2) + ')');
}

function renderSal() {
  invEnsureDB();
  const tb=document.getElementById('sal-tbody'); if(!tb) return;
  if(!DB.isalidas.length){tb.innerHTML='<tr><td colspan="10"><div class="empty">Sin salidas</div></td></tr>';return;}
  const CHIP={walmart:'<span class="chip ck" style="font-size:.55rem;">WALMART</span>',
    otro:'<span class="chip cb" style="font-size:.55rem;">CLIENTE</span>',
    rechazo:'<span class="chip cr" style="font-size:.55rem;">RECHAZO</span>'};
  tb.innerHTML=DB.isalidas.map(r=>{
    const prods=r.lineas?.map(l=>l.productoNombre+' ×'+l.bultos).join('<br>')||(r.motivoRechazo||'—');
    return '<tr>'+
      '<td>'+r.fecha+'</td>'+
      '<td style="font-size:.72rem;">'+r.clienteNombre+'</td>'+
      '<td style="font-size:.68rem;line-height:1.6;">'+prods+'</td>'+
      '<td>'+(r.totalLbs?.toFixed(1)||'—')+' lbs</td>'+
      '<td>Q '+(r.totalNeto?.toFixed(2)||r.totalQ?.toFixed(2)||'—')+'</td>'+
      '<td style="color:var(--muted2);">Q '+(r.totalIVA?.toFixed(2)||'—')+'</td>'+
      '<td style="color:var(--acc);font-weight:700;">Q '+(r.totalConIVA?.toFixed(2)||r.totalQ?.toFixed(2)||'—')+'</td>'+
      '<td style="color:var(--danger);">Q '+(r.totalRetencion?.toFixed(2)||'—')+'</td>'+
      '<td style="color:var(--info);font-weight:700;">Q '+(r.totalACobrar?.toFixed(2)||'—')+'</td>'+
      '<td style="font-size:.62rem;">'+(r.oc||'—')+'</td>'+
      '<td style="font-size:.62rem;color:var(--info);">'+(r.factura?.substring(0,12)||'—')+'</td>'+
      '<td>'+(r.docEdiwin?'<span class="chip ck" style="font-size:.55rem;">PDF</span> ':'')+
            (r.albaranFoto?'<img src="'+r.albaranFoto+'" style="height:26px;border-radius:3px;cursor:pointer;" onclick="invViewImg(\''+r.id+'\',\'salida\')">':'')+'</td>'+
      '<td><button class="btn bo bsm" onclick="delSal(\''+r.id+'\')">✕</button></td>'+
    '</tr>';
  }).join('');
}

function delSal(id) {
  DB.isalidas=DB.isalidas.filter(r=>r.id!==id);
  save();renderSal();renderInvStock();toast('Salida eliminada');
}

function invGetStock() {
  invEnsureDB();
  const stock = {};

  // Helper: resolve any productoId (UUID or name) to a canonical ID
  const resolveId = (id, nombre) => {
    if (!id) return nombre || 'desconocido';
    let prod = DB.iproductos.find(p => p.id === id);
    if (prod) return prod.id;
    prod = DB.iproductos.find(p => p.nombre?.toUpperCase() === id?.toUpperCase());
    if (prod) return prod.id;
    if (nombre) {
      prod = DB.iproductos.find(p => p.nombre?.toUpperCase() === nombre?.toUpperCase());
      if (prod) return prod.id;
    }
    return id;
  };

  const ensureEntry = (rawId, nombre) => {
    const id = resolveId(rawId, nombre);
    if (!stock[id]) {
      const prod = DB.iproductos.find(p => p.id === id) || { id, nombre: nombre || id };
      const presForProd = (DB.ipresentaciones||[]).filter(pr => pr.productoId === id);
      const allZeroLbs  = presForProd.length > 0 && presForProd.every(pr => !pr.lbsBulto || pr.lbsBulto === 0);
      const esUnidad    = prod.unidadCompra === 'unidad' || prod.unidadCompra === 'pza' || allZeroLbs;
      stock[id] = { prod, esPorUnidad: esUnidad,
        lbsEntrada:0, lbsSalida:0, bultosSalida:0, bultosEntrada:0, mermaEntrada:0,
        unidadesEntrada:0, unidadesSalida:0 };
    }
    return id;
  };

  // Resolve productoId with name fallback for entries saved before fix
  const resolveEntradaId = (r) => {
    if (r.productoId) { const f=DB.iproductos.find(p=>p.id===r.productoId); if(f) return r.productoId; }
    if (r.productoNombre) { const f=DB.iproductos.find(p=>p.nombre.toUpperCase()===r.productoNombre.toUpperCase()); if(f) return f.id; }
    return r.productoId || r.productoNombre || 'desconocido';
  };

  // FIX: Read all possible lbs field names from ientradas
  const getLbsEntrada = (r) =>
    r.lbsNeto || r.lbsBruto || r.lbsTotal ||
    (r.kgTotal ? r.kgTotal * 2.20462 : 0) || 0;

  // Deduplicate ientradas by cotizacionId+productoId
  const seenCot = new Set();
  (DB.ientradas || []).forEach(r => {
    const dedupeKey = r.source === 'cotizador' ? (r.cotizacionId + '|' + (r.productoNombre||r.productoId)) : null;
    if (dedupeKey) {
      if (seenCot.has(dedupeKey)) return;
      seenCot.add(dedupeKey);
    }
    const id = ensureEntry(resolveEntradaId(r), r.productoNombre);
    const prod = DB.iproductos.find(p => p.id === id);
    const esPorUnidad = prod?.unidadCompra === 'unidad' || prod?.unidadCompra === 'pza';
    if (esPorUnidad) {
      stock[id].unidadesEntrada = (stock[id].unidadesEntrada || 0) + (r.bultos || 0);
    } else {
      stock[id].lbsEntrada += getLbsEntrada(r);
    }
    stock[id].bultosEntrada += r.bultos  || 0;
    stock[id].mermaEntrada  += r.mermaLbs || 0;
    stock[id].esPorUnidad   = stock[id].esPorUnidad || esPorUnidad;
  });

  (DB.isalidas || []).forEach(r => {
    (r.lineas || []).forEach(l => {
      const id = ensureEntry(l.productoId, l.productoNombre);
      const isUnit = stock[id]?.esPorUnidad;
      if (isUnit) {
        // Para productos por unidad: deducir bultos × unidadesPorBulto (qty de la presentación)
        const pres = (DB.ipresentaciones || []).find(p => p.id === l.presentacionId);
        const unidadesPorBulto = (pres?.qty && pres.qty > 0) ? pres.qty : 1;
        stock[id].unidadesSalida = (stock[id].unidadesSalida || 0) + (l.bultos || 0) * unidadesPorBulto;
      } else {
        stock[id].lbsSalida += l.totalLbs || 0;
      }
      stock[id].bultosSalida += l.bultos || 0;
    });
  });

  (DB.vgtVentas || []).forEach(r => {
    (r.lineas || []).forEach(l => {
      if (!l.productoId) return;
      const id = ensureEntry(l.productoId, l.productoNombre);
      const FACTOR = { lb:1, quintal:100, arroba:25, kg:2.20462, caja:0, bulto:0, lote:0, unidad:0 };
      const lbs = l.lbs || (l.cant * (FACTOR[l.unidad || r.unidad] || 0));
      stock[id].lbsSalida    += lbs;
      stock[id].bultosSalida += l.cant || 0;
    });
  });

  (DB.vintVentas || []).forEach(r => {
    (r.lineas || []).forEach(l => {
      if (!l.productoId) return;
      const id = ensureEntry(l.productoId, l.productoNombre);
      stock[id].lbsSalida    += l.lbs  || 0;
      stock[id].bultosSalida += l.cant || 0;
    });
  });

  // Filter: only return products that exist in DB.iproductos
  // Remove phantom entries (salida references to unregistered product IDs)
  const cleanStock = {};
  Object.entries(stock).forEach(([id, s]) => {
    const inDB = DB.iproductos?.find(p => p.id === id);
    if (inDB) {
      cleanStock[id] = s;
    }
    // else: orphan/phantom entry — skip, don't show on dashboard
  });
  return cleanStock;
}


function renderInvMovs() {
  invEnsureDB();
  const tbody = document.getElementById('inv-mov-tbody'); if (!tbody) return;
  // Populate product filter
  const filSel = document.getElementById('inv-fil-prod');
  if (filSel && filSel.options.length <= 1) {
    (DB.iproductos||[]).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.nombre;
      filSel.appendChild(opt);
    });
  }
  const filtProd = v('inv-fil-prod') || '';

  const movs = [];

  // Entradas
  (DB.ientradas||[]).forEach(r => {
    if (filtProd && r.productoId !== filtProd && r.productoNombre !== filtProd) return;
    const lbs = r.lbsNeto || r.lbsBruto || r.lbsTotal || (r.kgTotal ? r.kgTotal*2.20462 : 0) || 0;
    movs.push({
      fecha: r.fecha, tipo: 'entrada', canal: r.source==='cotizador'?'Cotizador':'Manual',
      producto: r.productoNombre, entidad: r.proveedorNombre||r.cotizacionNombre||'—',
      bultos: r.bultos||0, lbs,
      doc: r.duca||r.factProd||'—', signo: '+'
    });
  });

  // Salidas Walmart
  (DB.isalidas||[]).forEach(r => {
    (r.lineas||[]).forEach(l => {
      if (filtProd && l.productoId !== filtProd) return;
      movs.push({ fecha: r.fecha||'—', tipo: 'salida', canal: 'Walmart',
        producto: l.productoNombre||l.nombre||'—',
        entidad: r.clienteNombre||r.cliente||'Walmart GT',
        bultos: l.bultos||0, lbs: l.totalLbs||l.lbs||0,
        doc: r.oc||r.factura||r.serie||'—', signo: '-' });
    });
  });

  // Salidas Local GT
  (DB.vgtVentas||[]).forEach(r => {
    (r.lineas||[]).forEach(l => {
      if (filtProd && l.productoId !== filtProd) return;
      const FACTOR = {lb:1,quintal:100,arroba:25,kg:2.20462,caja:0,bulto:0,unidad:0};
      const lbs = l.lbs||(l.cant*(FACTOR[l.unidad||r.unidad]||0));
      movs.push({ fecha: r.fecha, tipo: 'salida', canal: 'Local GT',
        producto: l.productoNombre||l.nombre, entidad: r.comprador||'—',
        bultos: l.cant||0, lbs,
        doc: r.numFactura||'—', signo: '-' });
    });
  });

  // Salidas Exportación
  (DB.vintVentas||[]).forEach(r => {
    (r.lineas||[]).forEach(l => {
      if (filtProd && l.productoId !== filtProd) return;
      movs.push({ fecha: r.fecha, tipo: 'salida', canal: 'Exportación',
        producto: l.productoNombre||l.nombre, entidad: r.comprador||'—',
        bultos: l.cant||0, lbs: l.lbs||0,
        doc: r.porte||'—', signo: '-' });
    });
  });

  movs.sort((a,b) => b.fecha.localeCompare(a.fecha));

  if (!movs.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Sin movimientos registrados</td></tr>';
    return;
  }

  tbody.innerHTML = movs.map(m =>
    '<tr>' +
    '<td>'+m.fecha+'</td>' +
    '<td><span class="chip '+(m.tipo==='entrada'?'ck':'cr')+'" style="font-size:.6rem;">'+
      (m.tipo==='entrada'?'📥 Entrada':'📤 Salida')+'</span></td>' +
    '<td><span class="chip" style="font-size:.6rem;background:rgba(255,255,255,.06);">'+m.canal+'</span></td>' +
    '<td style="font-size:.74rem;">'+m.producto+'</td>' +
    '<td style="font-size:.72rem;color:var(--muted2);">'+m.entidad+'</td>' +
    '<td>'+m.bultos+'</td>' +
    '<td style="color:'+(m.tipo==='entrada'?'var(--acc)':'var(--danger)')+';">'+m.signo+m.lbs.toFixed(1)+'</td>' +
    '<td style="font-size:.65rem;color:var(--info);">'+m.doc+'</td>' +
    '</tr>'
  ).join('');
}
function invAbrirTrazModal(prodId) {
  invEnsureDB();
  const prod = (DB.iproductos||[]).find(p => p.id === prodId);
  const prodNombre = (prod?.nombre || '').toUpperCase();
  const lotes = (DB.ientradas||[]).filter(r =>
    r.productoId === prodId ||
    (!r.productoId && prodNombre && (r.productoNombre||'').toUpperCase() === prodNombre)
  );
  if (lotes.length === 0) {
    invAbrirTraz(prodId);
    return;
  }
  if (lotes.length === 1) {
    // Single lot — open modal directly
    invVerTrazaLote(lotes[0].id);
    return;
  }
  // Multiple lots — show picker modal
  const safe = s => String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const items = lotes.map(l => {
    const lbs = (l.lbsNeto||l.lbsBruto||l.lbsTotal||(l.kgTotal?l.kgTotal*2.20462:0)||0).toFixed(0);
    const tag = l.duca ? 'DUCA '+l.duca : l.cotRef ? l.cotRef : 'Lote '+l.fecha;
    return '<button onclick="document.getElementById(\'traz-pick-overlay\').remove();invVerTrazaLote(\''+l.id+'\')" style="width:100%;text-align:left;padding:10px 14px;margin-bottom:6px;background:var(--s1);border:1.5px solid var(--br);border-radius:8px;cursor:pointer;font-size:.78rem;">' +
      '<div style="font-weight:700;color:var(--green-deep);">' + safe(tag) + '</div>' +
      '<div style="font-size:.68rem;color:var(--muted2);margin-top:2px;">' + l.fecha + ' · ' + lbs + ' lbs</div>' +
    '</button>';
  }).join('');
  const html = '<div id="traz-pick-overlay" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;">' +
    '<div style="background:var(--cream);border-radius:14px;padding:24px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4);">' +
      '<div style="font-family:var(--fh);font-size:1rem;font-weight:800;color:var(--green-deep);margin-bottom:16px;">🔗 Seleccionar lote</div>' +
      items +
      '<button onclick="document.getElementById(\'traz-pick-overlay\').remove()" style="width:100%;padding:8px;background:none;border:1px solid var(--br);border-radius:6px;font-size:.75rem;color:var(--muted2);cursor:pointer;margin-top:4px;">Cancelar</button>' +
    '</div></div>';
  const ex = document.getElementById('traz-pick-overlay');
  if (ex) ex.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

function invAbrirTraz(prodId) {
  // Pre-fill trazabilidad and navigate to it
  show('inv-trazabilidad', document.querySelector('.ni[onclick*="inv-trazabilidad"]'));
  setTimeout(() => {
    const sel = document.getElementById('traz-producto');
    if (sel && prodId) { sel.value = prodId; }
    // Set date range: 1 year back
    const hoy = new Date(); const hace1a = new Date(); hace1a.setFullYear(hoy.getFullYear()-1);
    const fmt = d => d.toISOString().split('T')[0];
    const desdeEl = document.getElementById('traz-desde');
    const hastaEl = document.getElementById('traz-hasta');
    if (desdeEl && !desdeEl.value) desdeEl.value = fmt(hace1a);
    if (hastaEl && !hastaEl.value) hastaEl.value = fmt(hoy);
    buscarTraz();
  }, 120);
}

function invVerTrazaLote(loteId) {
  invEnsureDB();
  const lote = (DB.ientradas||[]).find(r => r.id === loteId);
  if (!lote) { toast('⚠ Lote no encontrado', true); return; }

  // Resolver productoId aunque esté vacío (lotes históricos del cotizador)
  let prodId   = lote.productoId;
  let prodName = lote.productoNombre || prodId;
  if (!prodId && prodName) {
    const match = (DB.iproductos||[]).find(p => p.nombre.toUpperCase() === prodName.toUpperCase());
    if (match) prodId = match.id;
  }
  const lbsLote  = lote.lbsNeto||lote.lbsBruto||lote.lbsTotal||(lote.kgTotal?lote.kgTotal*2.20462:0)||0;
  const kgLote   = lbsLote / 2.20462;
  const safe     = s => String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Cotización como fuente de respaldo para datos históricos
  const cot = (DB.cotizaciones||[]).find(c => c.id === lote.cotizacionId);

  const productor     = safe(lote.productorNombre || cot?.bodegaInfo?.productorNombre || cot?.productorNombre || '');
  const proveedor     = safe(lote.proveedorNombre || lote.origen || cot?.bodegaInfo?.proveedorNombre || cot?.proveedorNombre || '');
  const duca          = safe(lote.duca || cot?.ducaInfo?.numero || cot?.duca || '');
  const factProductor = safe(lote.factProductor || lote.factProd || cot?.bodegaInfo?.factProductor || '');
  const factProveedor = safe(lote.factProveedor || lote.factMx  || cot?.bodegaInfo?.factProveedor  || '');
  const cotNom        = safe(lote.cotRef || cot?.nombre || '');
  const cotId         = lote.cotizacionId || '';
  const fechaFmt      = lote.fecha ? lote.fecha.split('-').reverse().join('/') : '—';

  // Destinos de venta del producto después de la fecha del lote
  const destinos = [];
  const addDest = (arr, canal, getLineas, getCliente, getRef) => {
    (arr||[]).forEach(r => {
      if (r.fecha < lote.fecha) return;
      const lineas = (getLineas(r)||[]).filter(l =>
        l.productoId === prodId ||
        (l.productoNombre||'').toUpperCase() === prodName.toUpperCase()
      );
      if (!lineas.length) return;
      const lbs = lineas.reduce((s,l)=>s+(l.totalLbs||l.lbs||0),0);
      destinos.push({ fecha:r.fecha, canal, cliente:safe(getCliente(r)), lbs, ref:safe(getRef(r)) });
    });
  };
  addDest(DB.isalidas,   '🏪 Walmart',    r=>r.lineas, r=>r.clienteNombre||'Walmart GT',  r=>r.factura||r.oc||'—');
  addDest(DB.vgtVentas,  '🛒 Local GT',   r=>r.lineas, r=>r.comprador||'—',               r=>r.numFactura||'—');
  addDest(DB.vintVentas, '✈️ Export',     r=>r.lineas, r=>r.comprador||r.pais||'—',       r=>r.porte||r.contenedorRef||'—');

  const lbsVendidas = destinos.reduce((s,d)=>s+d.lbs, 0);
  const lbsBodega   = Math.max(0, lbsLote - lbsVendidas);

  // ── Helpers ───────────────────────────────────────────────────
  const chainNode = (icon, bg, role, name, detail, nameColor) =>
    '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;">' +
      '<div style="width:36px;height:36px;border-radius:50%;background:'+bg+';display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">'+icon+'</div>' +
      '<div style="flex:1;">' +
        '<div style="font-size:.57rem;color:var(--muted2);text-transform:uppercase;letter-spacing:.06em;">'+role+'</div>' +
        '<div style="font-size:.82rem;font-weight:700;color:'+(nameColor||'var(--txt)')+';">'+name+'</div>' +
        '<div style="font-size:.63rem;color:var(--muted2);">'+detail+'</div>' +
      '</div>' +
    '</div>';

  const arrow = '<div style="padding-left:18px;color:var(--muted2);font-size:.85rem;margin-bottom:10px;">↓</div>';

  const docRow = (label, val) => {
    const ok = val && val !== '—';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--br);font-size:.75rem;">' +
      '<span>' + label + '</span>' +
      (ok
        ? '<span style="color:var(--acc);font-weight:700;">✓ ' + val + '</span>'
        : '<span style="color:var(--danger);">✗ No registrado</span>'
      ) +
    '</div>';
  };

  // ── Tab contents ──────────────────────────────────────────────

  // TAB 1: Origen
  const tabOrigen =
    '<div style="background:var(--s1);border:1.5px solid var(--br);border-radius:8px;padding:16px;">' +
      '<div style="font-size:.62rem;font-weight:700;color:var(--green-deep);letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;">🌱 Cadena de Origen</div>' +
      chainNode('🌾','rgba(0,122,82,.12)','Productor',
        productor || '<span style="color:var(--muted2);font-style:italic;font-weight:400;">No registrado</span>',
        'Origen del campo', 'var(--acc)') +
      arrow +
      chainNode('🤝','rgba(74,158,255,.12)','Intermediario / Proveedor MX',
        proveedor || '<span style="color:var(--muted2);font-style:italic;font-weight:400;">No registrado</span>',
        duca ? 'DUCA: ' + duca : 'Sin DUCA registrada', 'var(--info)') +
      arrow +
      chainNode('🏭','rgba(0,122,82,.12)','Recibido en bodega',
        'AJÚA · Guatemala',
        fechaFmt + ' · ' + (lote.bultos||'—') + ' bultos · ' + lbsLote.toFixed(0) + ' lbs', 'var(--green-deep)') +
    '</div>';

  // TAB 2: Documentos
  const tabDocs =
    '<div style="background:var(--s1);border:1.5px solid var(--br);border-radius:8px;padding:16px;">' +
      '<div style="font-size:.62rem;font-weight:700;color:var(--green-deep);letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">📄 Documentos del Lote</div>' +
      docRow('DUCA', duca) +
      docRow('Factura Productor', factProductor) +
      docRow('Factura Proveedor MX', factProveedor) +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:.75rem;">' +
        '<span>Cotización relacionada</span>' +
        (cotNom && cotId
          ? '<button onclick="document.getElementById(\'traz-modal-overlay\').remove();cotVerDetalle(\''+cotId+'\');" style="font-size:.68rem;padding:3px 10px;border:1px solid rgba(74,158,255,.4);border-radius:4px;background:rgba(74,158,255,.08);color:var(--info);cursor:pointer;font-weight:600;">'+cotNom+' →</button>'
          : '<span style="color:var(--danger);">✗ No registrada</span>'
        ) +
      '</div>' +
    '</div>';

  // TAB 3: Destinos
  let tabDests =
    '<div style="background:var(--s1);border:1.5px solid var(--br);border-radius:8px;padding:16px;">' +
      '<div style="font-size:.62rem;font-weight:700;color:var(--green-deep);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">📤 Destinos de Venta</div>';

  if (destinos.length) {
    tabDests +=
      '<table style="width:100%;border-collapse:collapse;font-size:.72rem;">' +
      '<thead><tr style="border-bottom:1.5px solid var(--br);">' +
        '<th style="padding:5px 8px;text-align:left;color:var(--muted2);font-weight:600;">Fecha</th>' +
        '<th style="padding:5px 8px;text-align:left;color:var(--muted2);font-weight:600;">Canal</th>' +
        '<th style="padding:5px 8px;text-align:left;color:var(--muted2);font-weight:600;">Cliente</th>' +
        '<th style="padding:5px 8px;text-align:right;color:var(--muted2);font-weight:600;">LBS</th>' +
        '<th style="padding:5px 8px;text-align:left;color:var(--muted2);font-weight:600;">Ref.</th>' +
      '</tr></thead><tbody>' +
      destinos.map(d => {
        const chipColor = d.canal.includes('Walmart') ? 'rgba(0,122,82,.1);color:var(--green-deep)'
                        : d.canal.includes('Local')   ? 'rgba(74,158,255,.1);color:var(--info)'
                        :                               'rgba(245,166,35,.1);color:var(--warn)';
        return '<tr style="border-bottom:1px solid var(--br);">' +
          '<td style="padding:6px 8px;white-space:nowrap;">' + d.fecha.split('-').reverse().join('/') + '</td>' +
          '<td style="padding:6px 8px;"><span style="font-size:.62rem;padding:2px 8px;border-radius:20px;font-weight:700;white-space:nowrap;background:' + chipColor + ';">' + d.canal + '</span></td>' +
          '<td style="padding:6px 8px;font-weight:600;">' + d.cliente + '</td>' +
          '<td style="padding:6px 8px;text-align:right;color:var(--danger);font-weight:700;">−' + d.lbs.toFixed(1) + ' lbs</td>' +
          '<td style="padding:6px 8px;font-size:.65rem;color:var(--info);">' + d.ref + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
  } else {
    tabDests += '<div style="text-align:center;padding:16px;font-size:.74rem;color:var(--muted2);font-style:italic;">Sin ventas registradas para este lote aún</div>';
  }
  tabDests += '</div>';

  // ── Build full modal ──────────────────────────────────────────
  const tabStyle   = 'flex:1;padding:8px;border:none;border-radius:6px;font-size:.74rem;font-weight:600;cursor:pointer;transition:.15s;';
  const tabActive  = tabStyle + 'background:white;color:var(--green-deep);box-shadow:0 1px 4px rgba(0,0,0,.12);';
  const tabInactive= tabStyle + 'background:transparent;color:var(--muted2);';

  const html =
    '<div id="traz-modal-overlay" onclick="if(event.target===this)this.remove()" ' +
    'style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;">' +
    '<div style="background:var(--cream);border-radius:14px;padding:24px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.4);">' +

    // Header
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">' +
      '<div>' +
        '<div style="font-family:var(--fh);font-size:1.1rem;font-weight:800;color:var(--green-deep);">🔗 Trazabilidad del Lote</div>' +
        '<div style="font-size:.72rem;color:var(--muted2);margin-top:3px;">' + safe(prodName) + ' · ' + fechaFmt + ' · ' + lbsLote.toFixed(0) + ' lbs (' + kgLote.toFixed(1) + ' kg)</div>' +
      '</div>' +
      '<button onclick="document.getElementById(\'traz-modal-overlay\').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--muted2);">✕</button>' +
    '</div>' +

    // Summary bar
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">' +
      '<div style="background:var(--s1);border:1.5px solid var(--br);border-radius:6px;padding:10px;text-align:center;">' +
        '<div style="font-size:1.2rem;font-weight:800;color:var(--acc);font-family:var(--fh);">' + lbsLote.toFixed(0) + '</div>' +
        '<div style="font-size:.6rem;color:var(--muted2);margin-top:2px;text-transform:uppercase;letter-spacing:.05em;">lbs entrada</div>' +
      '</div>' +
      '<div style="background:var(--s1);border:1.5px solid var(--br);border-radius:6px;padding:10px;text-align:center;">' +
        '<div style="font-size:1.2rem;font-weight:800;color:var(--danger);font-family:var(--fh);">' + lbsVendidas.toFixed(0) + '</div>' +
        '<div style="font-size:.6rem;color:var(--muted2);margin-top:2px;text-transform:uppercase;letter-spacing:.05em;">lbs vendidas</div>' +
      '</div>' +
      '<div style="background:var(--s1);border:1.5px solid var(--br);border-radius:6px;padding:10px;text-align:center;">' +
        '<div style="font-size:1.2rem;font-weight:800;color:var(--warn);font-family:var(--fh);">' + lbsBodega.toFixed(0) + '</div>' +
        '<div style="font-size:.6rem;color:var(--muted2);margin-top:2px;text-transform:uppercase;letter-spacing:.05em;">lbs en bodega</div>' +
      '</div>' +
    '</div>' +

    // Tabs
    '<div style="display:flex;gap:4px;margin-bottom:14px;background:var(--s2);border-radius:8px;padding:4px;" id="traz-tabs">' +
      '<button id="traz-tab-origen"     style="' + tabActive   + '" onclick="trazShowTab(\'origen\')">🌱 Origen</button>' +
      '<button id="traz-tab-documentos" style="' + tabInactive + '" onclick="trazShowTab(\'documentos\')">📄 Documentos</button>' +
      '<button id="traz-tab-destinos"   style="' + tabInactive + '" onclick="trazShowTab(\'destinos\')">📤 Destinos</button>' +
    '</div>' +

    '<div id="traz-panel-origen">'     + tabOrigen + '</div>' +
    '<div id="traz-panel-documentos" style="display:none;">' + tabDocs   + '</div>' +
    '<div id="traz-panel-destinos"   style="display:none;">' + tabDests  + '</div>' +

    '</div></div>';

  const ex = document.getElementById('traz-modal-overlay');
  if (ex) ex.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

// Tab switcher for trazabilidad modal
function trazShowTab(name) {
  ['origen','documentos','destinos'].forEach(t => {
    const panel = document.getElementById('traz-panel-' + t);
    const btn   = document.getElementById('traz-tab-' + t);
    if (!panel || !btn) return;
    const active = t === name;
    panel.style.display = active ? '' : 'none';
    btn.style.cssText = 'flex:1;padding:8px;border:none;border-radius:6px;font-size:.74rem;font-weight:600;cursor:pointer;transition:.15s;' +
      (active ? 'background:white;color:var(--green-deep);box-shadow:0 1px 4px rgba(0,0,0,.12);'
              : 'background:transparent;color:var(--muted2);');
  });
}


function renderInvStock() {
  invEnsureDB();
  const cards = document.getElementById('inv-stock-cards'); if (!cards) return;
  const stock = invGetStock();
  const items = Object.values(stock);

  if (!items.length) {
    cards.innerHTML = '<div class="empty" style="grid-column:1/-1;">Sin productos configurados. Ve a <strong>Inventario → Productos y Presentaciones</strong>.</div>';
  } else {
    cards.innerHTML = items.map(s => {
      // Unit-based product: flag set in ensureEntry, or explicit product setting
      const esPorUnidad = !!(s.esPorUnidad || s.prod?.unidadCompra === 'unidad' || s.prod?.unidadCompra === 'pza');
      const saldoVal = esPorUnidad
        ? (s.unidadesEntrada||0) - (s.unidadesSalida||0)
        : s.lbsEntrada - s.lbsSalida;
      const saldoLbs = esPorUnidad ? 0 : saldoVal;
      const saldoKg  = saldoLbs / 2.20462;
      const unidadLabel = esPorUnidad ? 'unidades' : 'lbs';
      const entradaVal  = esPorUnidad ? (s.unidadesEntrada||0) : s.lbsEntrada;
      const salidaVal   = esPorUnidad ? (s.unidadesSalida||0)  : s.lbsSalida;
      const pctMerma = !esPorUnidad && s.lbsEntrada > 0 ? (s.mermaEntrada / (s.lbsEntrada + s.mermaEntrada) * 100).toFixed(1) : 0;
      const pctStock = entradaVal > 0 ? Math.max(0, Math.min(100, Math.round(saldoVal / entradaVal * 100))) : 0;
      const minStock = s.prod.minStock || 0;
      const alerta   = minStock > 0 && saldoVal < minStock;
      const color    = saldoVal <= 0 ? 'var(--danger)' : alerta ? 'var(--warn)' : 'var(--acc)';
      // Count lots (ientradas) for this product
      const lotes = (DB.ientradas||[]).filter(r => r.productoId === s.prod.id);
      const loteBtns = lotes.length > 0
        ? lotes.map(l => {
            const lbsL = (l.lbsNeto||l.lbsBruto||l.lbsTotal||(l.kgTotal?l.kgTotal*2.20462:0)||0).toFixed(0);
            const tag = l.duca ? ('DUCA '+l.duca.substring(0,12)) : l.cotRef ? ('Ref: '+l.cotRef.substring(0,12)) : ('Lote '+l.fecha);
            return '<button onclick="invVerTrazaLote(\''+l.id+'\')" style="font-size:.6rem;padding:3px 7px;border:1px solid rgba(0,122,82,.4);border-radius:20px;background:rgba(0,122,82,.06);color:var(--acc);cursor:pointer;white-space:nowrap;">🔗 '+tag+' · '+lbsL+' lbs</button>';
          }).join('')
        : '';
      return '<div style="background:var(--s1);border:1.5px solid ' + color + '55;border-radius:8px;padding:16px;">' +
        // Header row: product name + traza button
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">' +
          '<div style="font-family:var(--fh);font-size:.84rem;font-weight:800;line-height:1.3;color:var(--green-deep);">' + s.prod.nombre + '</div>' +
          '<button onclick="invAbrirTrazModal(\''+s.prod.id+'\')" style="font-size:.58rem;padding:3px 8px;border:1px solid rgba(0,122,82,.3);border-radius:4px;background:rgba(0,122,82,.06);color:var(--acc);cursor:pointer;flex-shrink:0;margin-left:8px;white-space:nowrap;">🔗 Trazabilidad</button>' +
        '</div>' +
        // Big stock number
        '<div style="margin-bottom:8px;">' +
          '<div style="font-size:2rem;font-weight:900;color:' + color + ';font-family:var(--fh);line-height:1;">' + saldoVal.toFixed(0) + '</div>' +
          '<div style="font-size:.64rem;color:var(--muted2);margin-top:1px;">lbs en bodega' + (!esPorUnidad ? ' · ' + saldoKg.toFixed(1) + ' kg' : '') + '</div>' +
        '</div>' +
        // Mini stats grid
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;font-size:.68rem;">' +
          '<div style="background:rgba(0,217,139,.07);border-radius:4px;padding:5px 7px;">' +
            '<div style="color:var(--muted2);font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;">Entrada</div>' +
            '<div style="color:var(--acc);font-weight:700;">' + entradaVal.toFixed(0) + ' ' + unidadLabel + '</div>' +
          '</div>' +
          '<div style="background:rgba(255,56,88,.07);border-radius:4px;padding:5px 7px;">' +
            '<div style="color:var(--muted2);font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;">Salida</div>' +
            '<div style="color:var(--danger);font-weight:700;">' + salidaVal.toFixed(0) + ' ' + unidadLabel + '</div>' +
          '</div>' +
        '</div>' +
        (s.mermaEntrada > 0 ? '<div style="font-size:.62rem;color:var(--warn);margin-bottom:6px;">⚠ Merma: ' + s.mermaEntrada.toFixed(0) + ' lbs (' + pctMerma + '%)</div>' : '') +
        (alerta ? '<div style="font-size:.62rem;color:var(--warn);font-weight:700;margin-bottom:6px;">⚠ Bajo stock mínimo (' + minStock + ' ' + unidadLabel + ')</div>' : '') +
        // Progress bar
        '<div style="height:5px;background:var(--br);border-radius:3px;overflow:hidden;margin-bottom:' + (loteBtns?'10px':'0') + ';">' +
          '<div style="width:' + pctStock + '%;height:100%;background:' + color + ';border-radius:3px;transition:.4s;"></div>' +
        '</div>' +
        // Lot trace buttons
        (loteBtns ? '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + loteBtns + '</div>' : '') +
      '</div>';
    }).join('');
  }

  const tb = document.getElementById('inv-mov-tbody'); if (!tb) return;
  const filEl = document.getElementById('inv-fil-prod');
  if (filEl && DB.iproductos?.length) {
    const cur = filEl.value;
    filEl.innerHTML = '<option value="">Todos los productos</option>' +
      DB.iproductos.map(p => '<option value="'+p.id+'">' + p.nombre + '</option>').join('');
    filEl.value = cur;
  }
  const filProd = filEl?.value || '';

  const allMovs = [];

  (DB.ientradas || []).forEach(r => {
    if (filProd && r.productoId !== filProd) return;
    const lbs = r.lbsNeto || r.lbsBruto || r.lbsTotal || (r.kgTotal ? r.kgTotal*2.20462 : 0) || 0;
    allMovs.push({
      fecha: r.fecha, tipo: 'entrada',
      productoId: r.productoId, productoNombre: r.productoNombre,
      entidad: r.proveedorNombre || r.origen || r.cotizacionNom || 'Importación',
      bultos: r.bultos || 0,
      lbs,
      doc: r.duca || r.cotRef || '—',
      canal: '📥 Ingreso',
    });
  });

  (DB.isalidas || []).forEach(r => {
    (r.lineas || []).forEach(l => {
      if (filProd && l.productoId !== filProd) return;
      allMovs.push({
        fecha: r.fecha, tipo: 'salida',
        productoId: l.productoId, productoNombre: l.productoNombre,
        entidad: 'Walmart Guatemala',
        bultos: l.bultos || 0,
        lbs: l.totalLbs || 0,
        doc: r.oc || r.factura || '—',
        canal: '🏪 Walmart',
      });
    });
  });

  (DB.vgtVentas || []).forEach(r => {
    (r.lineas || []).forEach(l => {
      if (filProd && l.productoId !== filProd) return;
      const FACTOR = { lb:1, quintal:100, arroba:25, kg:2.20462 };
      const lbs = l.lbs || (l.cant * (FACTOR[r.unidad] || 1));
      allMovs.push({
        fecha: r.fecha, tipo: 'salida',
        productoId: l.productoId, productoNombre: l.productoNombre,
        entidad: r.comprador || r.tipo || 'Local',
        bultos: l.cant || 0,
        lbs,
        doc: r.numFactura || r.recibo || '—',
        canal: '🛒 Local GT',
      });
    });
  });

  (DB.vintVentas || []).forEach(r => {
    (r.lineas || []).forEach(l => {
      if (filProd && l.productoId !== filProd) return;
      allMovs.push({
        fecha: r.fecha, tipo: 'salida',
        productoId: l.productoId, productoNombre: l.productoNombre,
        entidad: r.comprador || r.pais || 'Exportación',
        bultos: l.cant || 0,
        lbs: l.lbs || 0,
        doc: r.porte || r.contenedorRef || '—',
        canal: '✈️ Export',
      });
    });
  });

  allMovs.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const stockRun = {};
  [...allMovs].reverse().forEach(m => {
    if (!stockRun[m.productoId]) stockRun[m.productoId] = 0;
    if (m.tipo === 'entrada') stockRun[m.productoId] += m.lbs;
    else                      stockRun[m.productoId] -= m.lbs;
    m._saldo = stockRun[m.productoId];
  });

  if (!allMovs.length) {
    tb.innerHTML = '<tr><td colspan="9"><div class="empty">Sin movimientos registrados</div></td></tr>';
    return;
  }

  tb.innerHTML = allMovs.slice(0, 120).map(m => {
    const isEnt  = m.tipo === 'entrada';
    const lbsClr = isEnt ? 'var(--acc)' : 'var(--danger)';
    const saldoColor = m._saldo > 500 ? 'var(--acc)' : m._saldo > 100 ? 'var(--warn)' : 'var(--danger)';
    const canalBg    = isEnt
      ? 'background:rgba(0,217,139,.1);color:var(--acc);'
      : 'background:rgba(255,56,88,.1);color:var(--danger);';
    return '<tr>' +
      '<td style="white-space:nowrap;">' + m.fecha + '</td>' +
      '<td><span style="font-size:.62rem;padding:2px 7px;border-radius:20px;font-weight:700;white-space:nowrap;' + canalBg + '">' + m.canal + '</span></td>' +
      '<td style="font-size:.74rem;font-weight:700;color:var(--green-deep);">' + (m.productoNombre || '—') + '</td>' +
      '<td style="font-size:.7rem;color:var(--muted2);">' + (m.entidad || '—') + '</td>' +
      '<td style="text-align:right;font-weight:600;">' + (m.bultos > 0 ? m.bultos : '—') + '</td>' +
      '<td style="text-align:right;color:' + lbsClr + ';font-weight:700;">' +
        (isEnt ? '+' : '−') + m.lbs.toFixed(1) + ' lbs' +
      '</td>' +
      '<td style="text-align:right;font-weight:800;color:' + saldoColor + ';font-family:var(--fh);">' + m._saldo.toFixed(0) + ' lbs</td>' +
      '<td style="font-size:.65rem;color:var(--info);">' + m.doc + '</td>' +
    '</tr>';
  }).join('');
}
function invExportStock() {
  invEnsureDB();
  const stock = invGetStock();
  const rows = [
    ['AGROINDUSTRIA AJÚA — STOCK EN TIEMPO REAL'],
    ['Generado: ' + new Date().toLocaleString('es-GT')],
    [],
    ['Producto', 'Lbs Entrada', 'Merma Entrada (lbs)', '% Merma', 'Lbs Salida', 'Stock Actual (lbs)', 'Stock Actual (kg)', 'Stock Mínimo (lbs)', 'Estado'],
    ...Object.values(stock).map(s => {
      const saldo = s.lbsEntrada - s.lbsSalida;
      const pct   = (s.lbsEntrada + s.mermaEntrada) > 0 ? (s.mermaEntrada / (s.lbsEntrada + s.mermaEntrada) * 100).toFixed(1) + '%' : '0%';
      const estado = saldo <= 0 ? 'AGOTADO' : (s.prod.minStock && saldo < s.prod.minStock) ? 'BAJO MÍNIMO' : 'OK';
      return [s.prod.nombre, s.lbsEntrada.toFixed(1), s.mermaEntrada.toFixed(1), pct, s.lbsSalida.toFixed(1), saldo.toFixed(1), (saldo / 2.20462).toFixed(1), s.prod.minStock || '—', estado];
    })
  ];
  invDownloadCSV(rows, 'Stock_AJUA_' + new Date().toISOString().split('T')[0]);
}

function invExportEntradas() {
  invEnsureDB();
  const rows = [
    ['AGROINDUSTRIA AJÚA — ENTRADAS / IMPORTACIONES'],
    [],
    ['Fecha', 'Producto', 'Bultos', 'KG bruto', 'Lbs bruto', 'Merma lbs', '% Merma', 'Lbs NETO', 'KG Neto', 'Precio/kg Q', 'Total Q', 'DUCA', 'Fact. MX', 'Fact. Prod.', 'Docs OK', 'Obs'],
    ...DB.ientradas.map(r => [r.fecha, r.productoNombre, r.bultos || 0, (r.kgBruto || 0).toFixed(2), (r.lbsBruto || 0).toFixed(2), (r.mermaLbs || 0).toFixed(2), (r.pctMerma || 0).toFixed(1) + '%', (r.lbsNeto || 0).toFixed(2), (r.kgNeto || 0).toFixed(2), (r.precioKg || 0).toFixed(2), (r.totalQ || 0).toFixed(2), r.duca || '', r.factMx || '', r.factProd || '', [r.docProd && '①', r.docMx && '②', r.docDuca && '③'].filter(Boolean).join(' ') || 'Incompleto', r.obs || ''])
  ];
  invDownloadCSV(rows, 'Entradas_AJUA_' + new Date().toISOString().split('T')[0]);
}

function invExportSalidas() {
  invEnsureDB();
  const rows = [
    ['AGROINDUSTRIA AJÚA — SALIDAS / VENTAS'],
    [],
    ['Fecha', 'Cliente', 'NIT', 'Tipo', 'Producto', 'Presentación', 'Bultos', 'Lbs', 'Precio U.', 'Total Q', 'Factura', 'OC Walmart', 'Doc. Material', 'Motivo Rechazo', 'Obs'],
  ];
  DB.isalidas.forEach(r => {
    if (r.lineas?.length) {
      r.lineas.forEach(l => rows.push([r.fecha, r.clienteNombre, r.clienteNit, r.tipo, l.productoNombre, l.presentacionNombre || '', l.bultos, (l.totalLbs || 0).toFixed(2), (l.precio || 0).toFixed(2), (l.totalQ || 0).toFixed(2), r.factura || '', r.oc || '', r.docMat || '', '', r.obs || '']));
    } else {
      rows.push([r.fecha, r.clienteNombre, r.clienteNit, r.tipo, '—', '—', 0, 0, 0, 0, r.factura || '', r.oc || '', r.docMat || '', r.motivoRechazo || '', r.obs || '']);
    }
  });
  invDownloadCSV(rows, 'Salidas_AJUA_' + new Date().toISOString().split('T')[0]);
}

function invDownloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const a   = document.createElement('a');
  a.href    = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = filename + '.csv';
  a.click();
  toast('✓ Excel generado');
}


function mkStatCard(label, val, color, bg, border) {
  return '<div style="background:'+bg+';border:1.5px solid '+border+';border-radius:4px;padding:12px;text-align:center;">'+
    '<div style="font-size:.6rem;color:var(--muted2);">'+label+'</div>'+
    '<div style="font-size:1.3rem;font-weight:800;color:'+color+';">'+val+'</div>'+
  '</div>';
}
function buscarTraz() {
  invEnsureDB();
  const prodId = v('traz-producto');
  const desde  = v('traz-desde');
  const hasta  = v('traz-hasta');
  const cont   = document.getElementById('traz-result');

  const resolveIdTraz = (id, nombre) => {
    if (!id && !nombre) return '';
    const p = id ? DB.iproductos?.find(p => p.id === id) : null;
    if (p) return p.id;
    if (nombre) {
      const p2 = DB.iproductos?.find(p => p.nombre?.toUpperCase() === nombre?.toUpperCase());
      if (p2) return p2.id;
    }
    return id || nombre || '';
  };

  // ── Entradas (origen de compra) ────────────────────────────────
  const entradas = (DB.ientradas||[]).filter(r =>
    (!prodId || r.productoId === prodId) &&
    (!desde  || r.fecha >= desde) &&
    (!hasta  || r.fecha <= hasta)
  );

  // ── Salidas (destinos de venta) ────────────────────────────────
  const salidas = [];
  (DB.isalidas||[]).forEach(r => {
    if ((!desde||r.fecha>=desde) && (!hasta||r.fecha<=hasta)) {
      if (!prodId || (r.lineas||[]).some(l=>resolveIdTraz(l.productoId,l.productoNombre)===prodId))
        salidas.push({...r, canal:'\u{1F3EA} Walmart', clienteNombre: r.clienteNombre||'Walmart Guatemala'});
    }
  });
  (DB.vgtVentas||[]).forEach(r => {
    if ((!desde||r.fecha>=desde) && (!hasta||r.fecha<=hasta)) {
      if (!prodId || (r.lineas||[]).some(l=>l.productoId===prodId))
        salidas.push({...r, canal:'\u{1F6D2} Local GT', clienteNombre: r.comprador||r.clienteNombre||'—', factura: r.numFactura||''});
    }
  });
  (DB.vintVentas||[]).forEach(r => {
    if ((!desde||r.fecha>=desde) && (!hasta||r.fecha<=hasta)) {
      if (!prodId || (r.lineas||[]).some(l=>l.productoId===prodId))
        salidas.push({...r, canal:'\u2708\uFE0F Export', clienteNombre: r.comprador||r.pais||'—'});
    }
  });

  if (!entradas.length && !salidas.length) {
    cont.innerHTML = '<div class="card"><div class="empty">Sin registros para los criterios seleccionados</div></div>';
    return;
  }

  let html = '';

  // ── SECCIÓN 1: ORIGEN DE COMPRA ────────────────────────────────
  if (entradas.length) {
    html += '<div class="card" style="margin-bottom:14px;">' +
      '<div class="ct" style="margin-bottom:12px;">📥 Origen de Compra — del campo al inventario (' + entradas.length + ' lote' + (entradas.length>1?'s':'') + ')</div>' +
      '<div style="overflow-x:auto;"><table style="font-size:.72rem;width:100%;">' +
      '<thead><tr>' +
        '<th>Fecha ingreso</th>' +
        '<th>Producto</th>' +
        '<th style="text-align:right;">Bultos</th>' +
        '<th style="text-align:right;">LBS</th>' +
        '<th>Productor</th>' +
        '<th>Vendedor / Proveedor MX</th>' +
        '<th>Precio compra</th>' +
        '<th>DUCA</th>' +
        '<th>Fact. Prod.</th>' +
        '<th>Fact. Prov.</th>' +
        '<th>Cotización</th>' +
      '</tr></thead><tbody>' +
      entradas.map(r => {
        const lbs     = r.lbsNeto||r.lbsBruto||r.lbsTotal||(r.kgTotal?r.kgTotal*2.20462:0)||0;
        const cot     = (DB.cotizaciones||[]).find(c => c.id === r.cotizacionId);
        const costoLb = r.costoLb || (cot && cot.totalCosto && cot.totalLbs ? cot.totalCosto/cot.totalLbs : 0);
        const costoTxt = costoLb > 0 ? 'Q ' + costoLb.toFixed(4) + '/lb' : (cot && cot.totalCosto ? 'Q ' + cot.totalCosto.toFixed(2) + ' total' : '—');
        const prodNom  = r.productorNombre || (cot&&cot.bodegaInfo ? cot.bodegaInfo.productorNombre : '') || '—';
        const provNom  = r.proveedorNombre || (cot&&cot.bodegaInfo ? cot.bodegaInfo.proveedorNombre : '') || '—';
        const ducaOK   = r.duca || (cot&&cot.ducaInfo ? cot.ducaInfo.numero : '') || cot?.duca || '';
        const fProd    = r.factProductor||r.factProd||(cot&&cot.bodegaInfo?cot.bodegaInfo.factProductor:'')||'';
        const fProv    = r.factProveedor||r.factMx||(cot&&cot.bodegaInfo?cot.bodegaInfo.factProveedor:'')||'';
        const cotNom   = r.cotizacionNom || cot?.nombre || '';
        const cotId    = r.cotizacionId  || '';
        const mermaStr = r.mermaLbs > 0 ? '<br><span style="color:var(--warn);font-size:.62rem;">⚠ '+r.mermaLbs.toFixed(0)+' lbs merma</span>' : '';
        const pclr = v => v && v!=='—' ? 'color:var(--acc);' : 'color:var(--muted2);';
        return '<tr>' +
          '<td style="white-space:nowrap;">' + r.fecha + '</td>' +
          '<td style="font-weight:700;color:var(--green-deep);">' + (r.productoNombre||'—') + '</td>' +
          '<td style="text-align:right;">' + (r.bultos||'—') + '</td>' +
          '<td style="text-align:right;color:var(--acc);font-weight:700;">' + lbs.toFixed(1) + ' lbs' + mermaStr + '</td>' +
          '<td style="font-size:.7rem;'+pclr(prodNom)+'">' + prodNom + '</td>' +
          '<td style="font-size:.7rem;'+pclr(provNom)+'">' + provNom + '</td>' +
          '<td style="font-size:.7rem;color:var(--warn);font-weight:600;">' + costoTxt + '</td>' +
          '<td style="font-size:.68rem;">' + (ducaOK ? '<span style="color:var(--acc);">✓ ' + ducaOK + '</span>' : '<span style="color:var(--muted2);">—</span>') + '</td>' +
          '<td style="font-size:.68rem;">' + (fProd  ? '<span style="color:var(--acc);">✓ ' + fProd  + '</span>' : '<span style="color:var(--muted2);">—</span>') + '</td>' +
          '<td style="font-size:.68rem;">' + (fProv  ? '<span style="color:var(--acc);">✓ ' + fProv  + '</span>' : '<span style="color:var(--muted2);">—</span>') + '</td>' +
          '<td style="font-size:.65rem;">' + (cotNom&&cotId ? '<button onclick="cotVerDetalle(\''+cotId+'\');" style="font-size:.62rem;padding:2px 6px;border:1px solid rgba(74,158,255,.4);border-radius:3px;background:rgba(74,158,255,.08);color:var(--info);cursor:pointer;">'+cotNom+'</button>' : '<span style="color:var(--muted2);">—</span>') + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div></div>';
  }

  // ── SECCIÓN 2: DESTINOS DE VENTA ──────────────────────────────
  if (salidas.length) {
    html += '<div class="card">' +
      '<div class="ct" style="margin-bottom:12px;">📤 Destinos de Venta — del inventario al cliente (' + salidas.length + ' despacho' + (salidas.length>1?'s':'') + ')</div>' +
      '<div style="overflow-x:auto;"><table style="font-size:.72rem;width:100%;">' +
      '<thead><tr>' +
        '<th>Fecha</th>' +
        '<th>Canal</th>' +
        '<th>Cliente</th>' +
        '<th>Productos despachados</th>' +
        '<th style="text-align:right;">Bultos / Cajas</th>' +
        '<th style="text-align:right;">LBS</th>' +
        '<th>Referencia / FEL</th>' +
      '</tr></thead><tbody>' +
      salidas.map(r => {
        const fl   = prodId ? (r.lineas||[]).filter(l=>resolveIdTraz(l.productoId,l.productoNombre)===prodId) : (r.lineas||[]);
        const fLbs = fl.reduce((s,l)=>s+(l.totalLbs||l.lbs||0),0);
        const fBul = fl.reduce((s,l)=>s+(l.bultos||l.cant||0),0);
        const prods = fl.length
          ? fl.map(l=>(l.productoNombre||'—')+' ×'+(l.bultos||l.cant||0)).join(' · ')
          : (r.lineas||[]).map(l=>l.productoNombre||'—').join(', ');
        const ref = r.factura||r.oc||r.numFactura||r.porte||'—';
        return '<tr>' +
          '<td style="white-space:nowrap;">' + r.fecha + '</td>' +
          '<td><span style="font-size:.62rem;padding:2px 7px;border-radius:20px;background:rgba(255,56,88,.1);color:var(--danger);font-weight:700;">' + r.canal + '</span></td>' +
          '<td style="font-size:.72rem;font-weight:700;">' + r.clienteNombre + '</td>' +
          '<td style="font-size:.68rem;color:var(--muted2);">' + prods + '</td>' +
          '<td style="text-align:right;font-weight:600;">' + (fBul>0?fBul:'—') + '</td>' +
          '<td style="text-align:right;color:var(--danger);font-weight:700;">' + fLbs.toFixed(1) + ' lbs</td>' +
          '<td style="font-size:.65rem;color:var(--info);">' + ref + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div></div>';
  }

  cont.innerHTML = html;
}

function invViewImg(id, tipo) {
  const rec = tipo === 'entrada' ? DB.ientradas.find(r => r.id === id) : DB.isalidas.find(r => r.id === id);
  const src = rec?.fotoRecepcion || rec?.albaranFoto;
  if (!src) return;
  const w = window.open('', '_blank');
  w.document.write('<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="' + src + '" style="max-width:100%;max-height:100vh;"><\/body><\/html>');
}




