// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — Módulo Walmart Import (build-82)
// Importa pedidos desde correo de Willy.Galvez@walmart.com
// Soporta formato PIPE |, TAB y línea por línea
// Cola automática via Google Apps Script → Firestore → BPM
// ═══════════════════════════════════════════════════════════════════

var _wiParsed        = null;  // datos parseados pendientes de confirmar
var _wiQueuePending  = [];    // pedidos en cola desde Apps Script / Gmail

var WI_MESES = {
  ENERO:1, FEBRERO:2, MARZO:3,    ABRIL:4,    MAYO:5,     JUNIO:6,
  JULIO:7, AGOSTO:8, SEPTIEMBRE:9, OCTUBRE:10, NOVIEMBRE:11, DICIEMBRE:12
};

// ── Parsear "MARTES 17 DE MARZO" → "2026-03-17" ──────────────────
function wiParseFecha(dia) {
  var m = (dia || '').toUpperCase().match(/(\d{1,2})\s+DE\s+(\w+)/);
  if (!m) return '';
  var day = parseInt(m[1], 10);
  var mon = WI_MESES[m[2]];
  if (!mon) return '';
  var yr = new Date().getFullYear();
  return yr + '-' + String(mon).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

// ── Auto-match producto en inventario ─────────────────────────────
function wiMatchProd(desc) {
  var dn = (desc || '').toUpperCase().replace(/\s+/g, '').replace(/UXC_\d+/, '').replace(/LB$/, '');
  return (DB.iproductos || []).find(function(p) {
    var pn = (p.nombre || '').toUpperCase().replace(/\s+/g, '');
    return pn.length > 3 && dn.length > 3 &&
           (pn.indexOf(dn.slice(0, 5)) >= 0 || dn.indexOf(pn.slice(0, 5)) >= 0);
  });
}

// ── PARSER PRINCIPAL — PIPE | → TAB → línea por línea ────────────
// Formato email Walmart GT:
// # ATLAS | # SAP | COD. PROV. | NOM. PROV. | Item | Descrip. Item | Total Cajas | HORA | RAMPA | DIA DE ENTREGA | NOTA
// 0       | 0     | 1599010650 | AGRO AJUA  | 9426586 | ZANAHORIA... | 25 | 18:00:00 | 5010 | MARTES 17 DE MARZO | -
function wiParsear(raw) {
  if (!raw) return null;
  raw = raw.trim();
  var lines  = raw.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
  var parsed = [];
  var campos = { hora: '', rampa: '', dia: '' };

  // ── FORMAT A: PIPE SEPARADO (texto plano del email Walmart) ──────
  if (raw.indexOf('|') >= 0) {
    lines.forEach(function(line) {
      if (line.indexOf('|') < 0) return;
      var cols = line.split('|').map(function(c) { return c.trim(); });
      if (cols.length < 7) return;
      // Skip header (contiene texto no numérico en col 4 = Item)
      if (!/^\d+$/.test(cols[4]) && !/^\d{5,}/.test(cols[4])) return;
      var item  = cols[4] || '';
      var desc  = cols[5] || '';
      var cajas = parseInt(cols[6], 10) || 0;
      var hora  = (cols[7] || '16:00').slice(0, 5);   // "18:00:00" → "18:00"
      var rampa = (cols[8] || '').trim();
      var dia   = (cols[9] || '').replace(/\s*-\s*$/, '').trim();
      if (!desc) return;
      if (!campos.hora  && hora  && hora !== '00:00') campos.hora  = hora;
      if (!campos.rampa && rampa)                     campos.rampa = rampa;
      if (!campos.dia   && dia   && dia !== '-')      campos.dia   = dia;
      var prod = wiMatchProd(desc);
      parsed.push({ item: item, desc: desc, cajas: cajas, hora: hora, rampa: rampa, dia: dia,
                    prodId: prod ? prod.id : '' });
    });
  }

  // ── FORMAT B: TAB SEPARADO (copia tabla HTML del correo) ─────────
  if (!parsed.length && raw.indexOf('\t') >= 0) {
    lines.forEach(function(line) {
      var cols = line.split('\t').map(function(c) { return c.trim(); });
      if (/ATLAS|^#/.test(cols[0]) || cols[4] === 'Item') return;
      if (cols.length < 6) return;
      var item  = cols[4] || '';
      var desc  = cols[5] || '';
      var cajas = parseInt(cols[6], 10) || 0;
      var hora  = (cols[7] || '16:00').slice(0, 5);
      var rampa = cols[8] || '';
      var dia   = (cols[9] || '').replace(/\s*-\s*$/, '').trim();
      if (!desc) return;
      if (!campos.hora  && hora)  campos.hora  = hora;
      if (!campos.rampa && rampa) campos.rampa = rampa;
      if (!campos.dia   && dia)   campos.dia   = dia;
      var prod = wiMatchProd(desc);
      parsed.push({ item: item, desc: desc, cajas: cajas, hora: hora, rampa: rampa, dia: dia,
                    prodId: prod ? prod.id : '' });
    });
  }

  // ── FORMAT C: LÍNEA POR LÍNEA con ancla de hora (HH:MM) ──────────
  if (!parsed.length) {
    lines.forEach(function(line) {
      var tmM = line.match(/(\d{2}:\d{2})/);
      if (!tmM) return;
      var before = line.slice(0, tmM.index).trim();
      var afterT = line.slice(tmM.index + tmM[1].length).trim();
      var raM   = afterT.match(/^(\d{4,})\s*(.*)/);
      var rampa = raM ? raM[1] : '';
      var dia   = raM ? raM[2].replace(/\s*-\s*$/, '').trim() : '';
      var itemM = before.match(/(\d{5,8})\s+/);
      if (!itemM) return;
      var item  = itemM[1];
      var rest  = before.slice(itemM.index + itemM[0].length);
      var descM = rest.match(/^(.*\D)\s+(\d+)\s*$/);
      var desc  = descM ? descM[1].trim() : rest.trim();
      var cajas = descM ? parseInt(descM[2], 10) : 0;
      if (!desc) return;
      if (!campos.hora)  campos.hora  = tmM[1];
      if (!campos.rampa && rampa) campos.rampa = rampa;
      if (!campos.dia   && dia)   campos.dia   = dia;
      var prod = wiMatchProd(desc);
      parsed.push({ item: item, desc: desc, cajas: cajas, hora: tmM[1], rampa: rampa, dia: dia,
                    prodId: prod ? prod.id : '' });
    });
  }

  if (!parsed.length) return null;

  // Completar campos comunes desde primera fila si no se detectaron
  var first = parsed[0];
  campos.hora  = campos.hora  || first.hora  || '16:00';
  campos.rampa = campos.rampa || first.rampa || '';
  campos.dia   = campos.dia   || first.dia   || '';

  return { rubros: parsed, campos: campos };
}

// ── Abrir modal de importación ────────────────────────────────────
function wiAbrir() {
  _wiParsed = null;
  var modal = document.getElementById('wi-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wi-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9200;display:flex;align-items:center;justify-content:center;padding:12px;';
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  modal.innerHTML = '<div style="background:var(--s1,#fff);border-radius:12px;width:100%;max-width:740px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);">' +
    '<div style="padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;">' +
      '<div>' +
        '<div style="font-family:var(--fh,Georgia);font-size:1.05rem;font-weight:700;color:var(--forest,#1B5E20);">📧 Importar pedido desde correo</div>' +
        '<div style="font-size:.72rem;color:var(--muted,#888);margin-top:2px;">Copia y pega el texto del email de <strong>Willy.Galvez@walmart.com</strong></div>' +
      '</div>' +
      '<button onclick="wiCerrar()" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--muted,#aaa);line-height:1;">✕</button>' +
    '</div>' +
    '<div style="padding:16px 20px;" id="wi-paso-1">' +
      '<div style="font-size:.7rem;color:var(--muted,#888);margin-bottom:6px;">Funciona con: texto plano separado por <code>|</code>, copia de tabla con TAB, o línea por línea.</div>' +
      '<textarea id="wi-raw" rows="8" placeholder="Pega aquí el texto del correo de Walmart...\n\nEjemplo:\n# ATLAS | # SAP | COD. PROV. | NOM. PROV. | Item | Descrip. Item | Total Cajas | HORA | RAMPA | DIA DE ENTREGA | NOTA\n0 | 0 | 1599010650 | AGROINDUSTRIA AJUA | 9426586 | ZANAHORIA SELE ESP BLS UXC_10 | 25 | 18:00:00 | 5010 | MARTES 17 DE MARZO | -"' +
        ' style="width:100%;box-sizing:border-box;background:var(--s2,#f5f5f5);border:1.5px solid var(--br,#ddd);border-radius:6px;color:var(--txt,#333);padding:10px 12px;font-family:monospace;font-size:.75rem;resize:vertical;"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end;">' +
        '<button onclick="wiCerrar()" class="btn bo bsm">Cancelar</button>' +
        '<button onclick="wiParsearYMostrar()" style="background:var(--orange,#f26822);color:#fff;border:none;padding:9px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:.82rem;">⚡ Parsear</button>' +
      '</div>' +
    '</div>' +
    '<div style="padding:0 20px 16px;display:none;" id="wi-paso-2"></div>' +
  '</div>';
}

// ── Parsear y mostrar tabla de revisión ──────────────────────────
function wiParsearYMostrar() {
  var raw = (document.getElementById('wi-raw') ? document.getElementById('wi-raw').value : '').trim();
  if (!raw) { toast('⚠ Pega el texto del correo primero', true); return; }

  var result = wiParsear(raw);
  if (!result) {
    toast('⚠ No se reconoció el formato. Intenta copiar toda la tabla del correo (Ctrl+A en el correo → Ctrl+C).', true);
    return;
  }
  _wiParsed = result;

  var f             = result.campos;
  var fechaSugerida = wiParseFecha(f.dia);
  var totalCajas    = result.rubros.reduce(function(s, r) { return s + (r.cajas || 0); }, 0);
  var paso2         = document.getElementById('wi-paso-2');
  paso2.style.display = '';

  var filas = result.rubros.map(function(r) {
    var prodNombre = r.prodId
      ? (function() { var p = (DB.iproductos||[]).find(function(x){return x.id===r.prodId;}); return p ? p.nombre : r.prodId; })()
      : '<span style="color:#bbb;font-size:.7rem;">— sin vincular —</span>';
    var matchIcon = r.prodId ? '✅' : '⚠️';
    return '<tr>' +
      '<td style="padding:6px 10px;border:1px solid var(--br,#ddd);font-family:monospace;font-size:.75rem;">' + (r.item || '') + '</td>' +
      '<td style="padding:6px 10px;border:1px solid var(--br,#ddd);">' + (r.desc || '') + '</td>' +
      '<td style="padding:6px 10px;border:1px solid var(--br,#ddd);text-align:center;font-weight:700;">' + (r.cajas || 0) + '</td>' +
      '<td style="padding:6px 10px;border:1px solid var(--br,#ddd);font-size:.72rem;">' + matchIcon + ' ' + prodNombre + '</td>' +
      '</tr>';
  }).join('');

  paso2.innerHTML =
    '<div style="background:var(--green-pale,#f1f8e9);border:1.5px solid var(--br,#ddd);border-radius:8px;padding:12px 14px;margin-bottom:12px;">' +
      '<div style="font-size:.65rem;font-weight:700;color:var(--forest,#1B5E20);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">📋 Datos detectados — confirma antes de guardar</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
        '<div><label style="font-size:.65rem;display:block;color:var(--muted,#888);margin-bottom:3px;">Fecha entrega</label>' +
          '<input id="wi-fecha" type="date" value="' + fechaSugerida + '" style="width:100%;box-sizing:border-box;background:#fff;border:1.5px solid var(--br,#ddd);border-radius:4px;color:var(--txt,#333);padding:6px 8px;font-size:.82rem;"></div>' +
        '<div><label style="font-size:.65rem;display:block;color:var(--muted,#888);margin-bottom:3px;">Hora</label>' +
          '<input id="wi-hora" value="' + (f.hora || '16:00') + '" style="width:100%;box-sizing:border-box;background:#fff;border:1.5px solid var(--br,#ddd);border-radius:4px;color:var(--txt,#333);padding:6px 8px;font-size:.82rem;"></div>' +
        '<div><label style="font-size:.65rem;display:block;color:var(--muted,#888);margin-bottom:3px;">Rampa</label>' +
          '<input id="wi-rampa" value="' + (f.rampa || '') + '" style="width:100%;box-sizing:border-box;background:#fff;border:1.5px solid var(--br,#ddd);border-radius:4px;color:var(--txt,#333);padding:6px 8px;font-size:.82rem;"></div>' +
      '</div>' +
      (f.dia ? '<div style="margin-top:6px;font-size:.72rem;color:var(--muted,#888);">Día del correo: <strong>' + f.dia + '</strong></div>' : '') +
    '</div>' +
    '<div style="overflow-x:auto;margin-bottom:12px;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:.8rem;">' +
        '<thead><tr style="background:var(--green-pale,#f1f8e9);">' +
          '<th style="padding:7px 10px;text-align:left;border:1px solid var(--br,#ddd);font-size:.65rem;color:var(--forest,#1B5E20);"># Item</th>' +
          '<th style="padding:7px 10px;text-align:left;border:1px solid var(--br,#ddd);font-size:.65rem;color:var(--forest,#1B5E20);">Descripción</th>' +
          '<th style="padding:7px 10px;text-align:center;border:1px solid var(--br,#ddd);font-size:.65rem;color:var(--forest,#1B5E20);">Cajas</th>' +
          '<th style="padding:7px 10px;text-align:left;border:1px solid var(--br,#ddd);font-size:.65rem;color:var(--forest,#1B5E20);">Producto inventario</th>' +
        '</tr></thead>' +
        '<tbody>' + filas + '</tbody>' +
        '<tfoot><tr style="background:var(--s2,#f5f5f5);">' +
          '<td colspan="2" style="padding:7px 10px;border:1px solid var(--br,#ddd);font-weight:700;">Total</td>' +
          '<td style="padding:7px 10px;border:1px solid var(--br,#ddd);text-align:center;font-weight:800;color:var(--forest,#1B5E20);">' + totalCajas + '</td>' +
          '<td style="border:1px solid var(--br,#ddd);"></td>' +
        '</tr></tfoot>' +
      '</table>' +
    '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
      '<button onclick="document.getElementById(\'wi-paso-2\').style.display=\'none\'" class="btn bo bsm">← Volver</button>' +
      '<button onclick="wiConfirmar()" style="background:var(--forest,#1B5E20);color:#fff;border:none;padding:9px 22px;border-radius:6px;font-weight:700;cursor:pointer;font-size:.85rem;">💾 Guardar pedido</button>' +
    '</div>';
}

// ── Confirmar y guardar en DB.pedidosWalmart ──────────────────────
function wiConfirmar() {
  if (!_wiParsed) return;
  if (!DB.pedidosWalmart) DB.pedidosWalmart = [];

  var fechaEl = document.getElementById('wi-fecha');
  var horaEl  = document.getElementById('wi-hora');
  var rampaEl = document.getElementById('wi-rampa');

  var fechaEntrega = fechaEl ? fechaEl.value : '';
  if (!fechaEntrega) { toast('⚠ Ingresa la fecha de entrega', true); return; }

  var c = _wiParsed.campos;
  var rec = {
    id:           uid(),
    ts:           now(),
    fechaEntrega: fechaEntrega,
    horaEntrega:  horaEl  ? horaEl.value  : (c.hora  || '16:00'),
    rampa:        rampaEl ? rampaEl.value : (c.rampa || ''),
    oc:           '',
    atlas:        '',
    nota:         c.dia || '',
    obs:          'Importado desde correo',
    rubros:       _wiParsed.rubros.map(function(r, i) {
      return { n: r.item || String(i + 1), desc: r.desc, cajas: r.cajas,
               prodId: r.prodId || '', estado: 'pendiente' };
    }),
    estado:     'pendiente',
    esAgregado: false,
    baseId:     null,
    albaranDoc: null,
    rechazoDoc: null,
    cierreTs:   null,
  };

  DB.pedidosWalmart.unshift(rec);
  save();
  wiCerrar();
  try { pwRenderLista(); }      catch(e) {}
  try { pwRenderCalendario(); } catch(e) {}

  var total = rec.rubros.reduce(function(s, r) { return s + r.cajas; }, 0);
  toast('✅ Pedido ' + fechaEntrega + ' guardado — ' + rec.rubros.length + ' rubros · ' + total + ' cajas');
}

// ── Cerrar modal ──────────────────────────────────────────────────
function wiCerrar() {
  var modal = document.getElementById('wi-modal');
  if (modal) modal.style.display = 'none';
  _wiParsed = null;
}

// ══ COLA AUTOMÁTICA — Apps Script → Firestore → BPM ══════════════
// Los pedidos detectados por Gmail Apps Script se guardan en
// ajua_bpm/walmart_queue. Esta función los importa al confirmar.

function wiCheckQueue() {
  if (typeof _fbDb === 'undefined' || !_fbDb || !_fbDb.db) return;
  try {
    var qRef = _fbDb.doc(_fbDb.db, 'ajua_bpm', 'walmart_queue');
    _fbDb.getDoc(qRef).then(function(snap) {
      if (!snap.exists()) return;
      var data    = snap.data();
      var queue   = (data.queue || []).filter(function(p) { return !p._importado; });
      if (!queue.length) return;
      _wiQueuePending = queue;
      var btn = document.getElementById('wi-btn-queue');
      if (btn) { btn.style.display = ''; btn.textContent = '📬 ' + queue.length + ' nuevo' + (queue.length > 1 ? 's' : ''); }
    }).catch(function(e) { console.log('wiCheckQueue:', e.message); });
  } catch(e) { console.log('wiCheckQueue err:', e.message); }
}

function wiImportarQueue() {
  if (!_wiQueuePending.length) { wiCheckQueue(); return; }
  if (!confirm('¿Importar ' + _wiQueuePending.length + ' pedido(s) recibidos por Gmail automático?')) return;
  if (!DB.pedidosWalmart) DB.pedidosWalmart = [];

  var importados = 0;
  _wiQueuePending.forEach(function(p) {
    var dup = DB.pedidosWalmart.some(function(x) {
      return x.fechaEntrega === p.fechaEntrega &&
             x.rubros && p.rubros && x.rubros.length === p.rubros.length;
    });
    if (dup) return;
    DB.pedidosWalmart.unshift({
      id: p.id || uid(), ts: p.ts || now(),
      fechaEntrega: p.fechaEntrega || '',
      horaEntrega:  p.horaEntrega  || '16:00',
      rampa:        p.rampa        || '',
      oc: '', atlas: '',
      nota:         p.nota || '',
      obs:          'Auto-importado desde Gmail',
      rubros:       (p.rubros || []).map(function(r) {
        return { n: r.n||r.item||'', desc: r.desc||'', cajas: r.cajas||0,
                 prodId: r.prodId||'', estado: 'pendiente' };
      }),
      estado: 'pendiente', esAgregado: false, baseId: null,
      albaranDoc: null, rechazoDoc: null, cierreTs: null,
    });
    importados++;
  });

  if (!importados) { toast('Ya estaban importados'); return; }

  save();
  try { pwRenderLista(); }      catch(e) {}
  try { pwRenderCalendario(); } catch(e) {}

  // Limpiar cola en Firestore
  try {
    if (typeof _fbDb !== 'undefined' && _fbDb && _fbDb.db) {
      var qRef = _fbDb.doc(_fbDb.db, 'ajua_bpm', 'walmart_queue');
      _fbDb.setDoc(qRef, { queue: [], lastCleared: now() });
    }
  } catch(e) {}

  var btn = document.getElementById('wi-btn-queue');
  if (btn) btn.style.display = 'none';
  _wiQueuePending = [];
  toast('✅ ' + importados + ' pedido(s) importados desde Gmail');
}

// Verificar cola 8 segundos después de que Firebase cargue
var _wiInitCheck = setInterval(function() {
  if (typeof _fbLoaded !== 'undefined' && _fbLoaded) {
    clearInterval(_wiInitCheck);
    setTimeout(wiCheckQueue, 8000);
  }
}, 2000);

window.wiAbrir           = wiAbrir;
window.wiCerrar          = wiCerrar;
window.wiParsearYMostrar = wiParsearYMostrar;
window.wiConfirmar       = wiConfirmar;
window.wiImportarQueue   = wiImportarQueue;

console.log('✅ walmart-import.js cargado');
