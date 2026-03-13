// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — Gmail → Firestore: Pedidos Walmart automáticos
// Google Apps Script (pegar en script.google.com)
//
// SETUP (hacer una sola vez):
//  1. Pega este código en script.google.com → nuevo proyecto
//  2. Ejecuta "setup" → autoriza Gmail + UrlFetch
//  3. Ejecuta "configurarTrigger" → corre cada 30 min automáticamente
//  4. Ejecuta "testParsear" para verificar que el parser funciona
// ═══════════════════════════════════════════════════════════════════

var FB_API_KEY    = 'AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY';
var FB_PROJECT_ID = 'ajuabmp';
var FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/' + FB_PROJECT_ID + '/databases/(default)/documents';

var WM_FROM    = 'Willy.Galvez@walmart.com';
var WM_SUBJECT = 'PEDIDO AGROINDUSTRIA AJUA';

var MESES = {
  ENERO:1, FEBRERO:2, MARZO:3, ABRIL:4, MAYO:5, JUNIO:6,
  JULIO:7, AGOSTO:8, SEPTIEMBRE:9, OCTUBRE:10, NOVIEMBRE:11, DICIEMBRE:12
};

// ══════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL — se ejecuta automáticamente cada 30 min
// ══════════════════════════════════════════════════════════════════
function processWalmartEmails() {
  var token = getFirebaseToken();
  if (!token) {
    Logger.log('⚠ Sin token Firebase. Verifica FB_EMAIL / FB_PASSWORD en Script Properties.');
    // Intento sin auth (si las reglas Firestore son abiertas)
    token = null;
  }

  var query   = 'from:' + WM_FROM + ' subject:"' + WM_SUBJECT + '" is:unread';
  var threads = GmailApp.search(query, 0, 20);

  if (!threads.length) {
    Logger.log('✓ Sin emails nuevos de Walmart (' + new Date().toLocaleString() + ')');
    return;
  }

  var nuevos = [];

  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(msg) {
      if (!msg.isUnread()) return;
      try {
        var body   = msg.getPlainBody();
        var pedido = parsearCorreoWalmart(body);
        if (pedido) {
          pedido.emailFecha  = Utilities.formatDate(msg.getDate(), 'America/Guatemala', 'yyyy-MM-dd HH:mm');
          pedido.emailAsunto = msg.getSubject();
          nuevos.push(pedido);
          Logger.log('📧 Parseado: ' + pedido.fechaEntrega + ' — ' + pedido.rubros.length + ' rubros');
        } else {
          Logger.log('⚠ No se pudo parsear email: ' + msg.getSubject());
        }
        msg.markRead();
      } catch(e) {
        Logger.log('⚠ Error en email "' + msg.getSubject() + '": ' + e.message);
      }
    });
  });

  if (!nuevos.length) {
    Logger.log('✓ Emails leídos pero sin datos parseables');
    return;
  }

  // Leer cola actual de Firestore
  var queueActual = getQueue(token);
  var pending     = queueActual.filter(function(p) { return !p._importado; });

  // Agregar nuevos sin duplicar (mismo fechaEntrega + cantidad de rubros)
  var agregados = 0;
  nuevos.forEach(function(p) {
    var dup = pending.some(function(q) {
      return q.fechaEntrega === p.fechaEntrega &&
             q.rubros && p.rubros && q.rubros.length === p.rubros.length;
    });
    if (!dup) { pending.push(p); agregados++; }
  });

  if (agregados > 0) {
    setQueue(token, pending);
    Logger.log('✅ ' + agregados + ' pedido(s) nuevos en cola Firestore · Total pendiente: ' + pending.length);
  } else {
    Logger.log('ℹ Pedidos ya estaban en cola (duplicados)');
  }
}

// ══════════════════════════════════════════════════════════════════
// PARSER — Formato PIPE del email de Walmart Guatemala
// ══════════════════════════════════════════════════════════════════
function parsearCorreoWalmart(body) {
  if (!body) return null;

  var rubros = [];
  var campos = { hora: '', rampa: '', dia: '' };
  var lines  = body.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);

  // Formato PIPE: col[4]=Item, col[5]=Descrip, col[6]=Cajas, col[7]=Hora, col[8]=Rampa, col[9]=Dia
  if (body.indexOf('|') >= 0) {
    lines.forEach(function(line) {
      if (line.indexOf('|') < 0) return;
      var cols = line.split('|').map(function(c) { return c.trim(); });
      if (cols.length < 7) return;
      // Saltar encabezado (col 4 no es número)
      if (!/^\d+$/.test(cols[4])) return;
      var item  = cols[4] || '';
      var desc  = cols[5] || '';
      var cajas = parseInt(cols[6], 10) || 0;
      var hora  = (cols[7] || '16:00').substring(0, 5);   // "18:00:00" → "18:00"
      var rampa = (cols[8] || '').trim();
      var dia   = (cols[9] || '').replace(/\s*-\s*$/, '').trim();
      if (!item || !desc) return;
      if (!campos.hora  && hora  && hora !== '00:00') campos.hora  = hora;
      if (!campos.rampa && rampa)                     campos.rampa = rampa;
      if (!campos.dia   && dia   && dia !== '-')      campos.dia   = dia;
      rubros.push({ n: item, desc: desc, cajas: cajas, prodId: '', estado: 'pendiente' });
    });
  }

  // Fallback: formato TAB
  if (!rubros.length && body.indexOf('\t') >= 0) {
    lines.forEach(function(line) {
      var cols = line.split('\t').map(function(c) { return c.trim(); });
      if (cols.length < 7 || !/^\d+$/.test(cols[4])) return;
      var hora  = (cols[7] || '16:00').substring(0, 5);
      var rampa = cols[8] || '';
      var dia   = (cols[9] || '').replace(/\s*-\s*$/, '').trim();
      if (!campos.hora  && hora)  campos.hora  = hora;
      if (!campos.rampa && rampa) campos.rampa = rampa;
      if (!campos.dia   && dia)   campos.dia   = dia;
      rubros.push({ n: cols[4], desc: cols[5], cajas: parseInt(cols[6],10)||0, prodId:'', estado:'pendiente' });
    });
  }

  if (!rubros.length) return null;

  // Convertir "MARTES 17 DE MARZO" → "2026-03-17"
  var fechaEntrega = '';
  var dm = (campos.dia).toUpperCase().match(/(\d{1,2})\s+DE\s+(\w+)/);
  if (dm) {
    var day = parseInt(dm[1], 10);
    var mon = MESES[dm[2]];
    if (mon) {
      var yr = new Date().getFullYear();
      fechaEntrega = yr + '-' + (mon < 10 ? '0' + mon : mon) + '-' + (day < 10 ? '0' + day : day);
    }
  }

  return {
    id:           'wm_' + new Date().getTime() + '_' + Math.floor(Math.random() * 9999),
    ts:           new Date().toISOString(),
    fechaEntrega: fechaEntrega,
    horaEntrega:  campos.hora  || '16:00',
    rampa:        campos.rampa || '',
    nota:         campos.dia   || '',
    rubros:       rubros,
    _importado:   false,
  };
}

// ══════════════════════════════════════════════════════════════════
// FIRESTORE REST — Leer cola (ajua_bpm/walmart_queue)
// ══════════════════════════════════════════════════════════════════
function getQueue(token) {
  try {
    var url     = FIRESTORE_URL + '/ajua_bpm/walmart_queue?key=' + FB_API_KEY;
    var options = { muteHttpExceptions: true };
    if (token) options.headers = { Authorization: 'Bearer ' + token };

    var resp = UrlFetchApp.fetch(url, options);
    if (resp.getResponseCode() === 404) return [];    // documento no existe aún

    var doc    = JSON.parse(resp.getContentText());
    var qField = doc.fields && doc.fields.queue;
    if (!qField) return [];
    return decodeFS(qField) || [];
  } catch(e) {
    Logger.log('getQueue error: ' + e.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════
// FIRESTORE REST — Guardar cola
// ══════════════════════════════════════════════════════════════════
function setQueue(token, queue) {
  try {
    var url     = FIRESTORE_URL + '/ajua_bpm/walmart_queue?key=' + FB_API_KEY;
    var options = {
      method:      'PATCH',
      contentType: 'application/json',
      payload:     JSON.stringify({ fields: {
        queue:      encodeFS(queue),
        lastUpdate: encodeFS(new Date().toISOString()),
      }}),
      muteHttpExceptions: true,
    };
    if (token) options.headers = { Authorization: 'Bearer ' + token };

    var resp = UrlFetchApp.fetch(url, options);
    var code = resp.getResponseCode();
    if (code !== 200) {
      Logger.log('setQueue HTTP ' + code + ': ' + resp.getContentText().substring(0, 200));
    }
  } catch(e) {
    Logger.log('setQueue error: ' + e.message);
  }
}

// ══════════════════════════════════════════════════════════════════
// FIREBASE AUTH — obtener ID token (solo si Firestore requiere auth)
// Guarda FB_EMAIL y FB_PASSWORD en Script Properties (nunca en código)
// ══════════════════════════════════════════════════════════════════
function getFirebaseToken() {
  try {
    var props = PropertiesService.getScriptProperties();
    var email = props.getProperty('FB_EMAIL');
    var pass  = props.getProperty('FB_PASSWORD');
    if (!email || !pass) return null;   // sin credenciales = sin auth

    var url  = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + FB_API_KEY;
    var resp = UrlFetchApp.fetch(url, {
      method:      'POST',
      contentType: 'application/json',
      payload:     JSON.stringify({ email: email, password: pass, returnSecureToken: true }),
      muteHttpExceptions: true,
    });
    var data = JSON.parse(resp.getContentText());
    return data.idToken || null;
  } catch(e) {
    Logger.log('getFirebaseToken error: ' + e.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
// FIRESTORE CODEC — JS ↔ Firestore field format
// ══════════════════════════════════════════════════════════════════
function encodeFS(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')  return { booleanValue: val };
  if (typeof val === 'number')   return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'string')   return { stringValue: val };
  if (Array.isArray(val))        return { arrayValue: { values: val.map(encodeFS) } };
  if (typeof val === 'object') {
    var fields = {};
    Object.keys(val).forEach(function(k) { fields[k] = encodeFS(val[k]); });
    return { mapValue: { fields: fields } };
  }
  return { stringValue: String(val) };
}

function decodeFS(field) {
  if (!field) return null;
  if ('nullValue'    in field) return null;
  if ('booleanValue' in field) return field.booleanValue;
  if ('integerValue' in field) return parseInt(field.integerValue, 10);
  if ('doubleValue'  in field) return field.doubleValue;
  if ('stringValue'  in field) return field.stringValue;
  if ('arrayValue'   in field) return (field.arrayValue.values || []).map(decodeFS);
  if ('mapValue'     in field) {
    var obj = {}, f = field.mapValue.fields || {};
    Object.keys(f).forEach(function(k) { obj[k] = decodeFS(f[k]); });
    return obj;
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════
// SETUP — ejecutar una sola vez
// ══════════════════════════════════════════════════════════════════

// Paso 1: Configurar trigger automático
function configurarTrigger() {
  // Eliminar triggers existentes del mismo handler
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'processWalmartEmails') ScriptApp.deleteTrigger(t);
  });
  // Crear trigger cada 30 minutos
  ScriptApp.newTrigger('processWalmartEmails').timeBased().everyMinutes(30).create();
  Logger.log('✅ Trigger: processWalmartEmails cada 30 min');
}

// Paso 2 (opcional): guardar credenciales Firebase si Firestore requiere auth
// Modifica los valores y ejecuta esta función UNA VEZ, luego bórralos del código
function configurarCredenciales() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('FB_EMAIL',    'TU_EMAIL_FIREBASE@gmail.com'); // ← cambia esto
  props.setProperty('FB_PASSWORD', 'TU_PASSWORD_FIREBASE');        // ← cambia esto
  Logger.log('✅ Credenciales guardadas en Script Properties (borra los valores del código)');
}

// Paso 3: Test del parser con el formato real del email
function testParsear() {
  var ejemplo = [
    '# ATLAS | # SAP | COD. PROV. | NOM. PROV. | Item | Descrip. Item | Total Cajas | HORA | RAMPA | DIA DE ENTREGA | NOTA IMPORTANTE',
    '0 | 0 | 1599010650 | AGROINDUSTRIA AJUA, S.A. | 9426586 | ZANAHORIA SELE ESP BLS UXC_10 | 25 | 18:00:00 | 5010 | MARTES 17 DE MARZO | -',
    '0 | 0 | 1599010650 | AGROINDUSTRIA AJUA, S.A. | 9425739 | CEBOLLA BLANCA UXC_30 | 98 | 18:00:00 | 5010 | MARTES 17 DE MARZO | -',
  ].join('\n');

  var result = parsearCorreoWalmart(ejemplo);
  if (result) {
    Logger.log('✅ Parser OK');
    Logger.log('   Fecha: '    + result.fechaEntrega);
    Logger.log('   Hora: '     + result.horaEntrega);
    Logger.log('   Rampa: '    + result.rampa);
    Logger.log('   Día: '      + result.nota);
    Logger.log('   Rubros: '   + result.rubros.length);
    result.rubros.forEach(function(r) {
      Logger.log('   → ' + r.n + ' | ' + r.desc + ' | ' + r.cajas + ' cajas');
    });
  } else {
    Logger.log('❌ Parser no reconoció el formato');
  }
}

// Test completo: parsear + escribir en Firestore (sin email real)
function testEscribirQueue() {
  var token = getFirebaseToken();  // puede ser null si Firestore es abierto
  var ejemplo = parsearCorreoWalmart([
    '# ATLAS | # SAP | COD. PROV. | NOM. PROV. | Item | Descrip. Item | Total Cajas | HORA | RAMPA | DIA DE ENTREGA | NOTA',
    '0 | 0 | 1599010650 | AGROINDUSTRIA AJUA, S.A. | 9426586 | ZANAHORIA SELE ESP BLS UXC_10 | 25 | 18:00:00 | 5010 | MARTES 17 DE MARZO | -',
  ].join('\n'));
  if (!ejemplo) { Logger.log('❌ Parser falló'); return; }
  setQueue(token, [ejemplo]);
  Logger.log('✅ Pedido de prueba escrito en ajua_bpm/walmart_queue');
  Logger.log('   Abrí el BPM → sección Pedidos Walmart → debería aparecer "📬 1 nuevo"');
}
