// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — Gmail → Firestore: Pedidos Walmart (build-83)
// Google Apps Script — pegar en script.google.com
//
// SETUP (hacer una sola vez):
//  1. Pega este código → nuevo proyecto en script.google.com
//  2. Ejecuta "setup" → autoriza Gmail + UrlFetch + Docs + Drive + Mail
//  3. Ejecuta "configurarTrigger" → corre cada 30 min automáticamente
//  4. Ejecuta "testParsear" para verificar parser
//  5. Ejecuta "testEnviarEmail" para verificar PDF + email a gerencia
// ═══════════════════════════════════════════════════════════════════

var FB_API_KEY    = 'AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY';
var FB_PROJECT_ID = 'ajuabmp';
var FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/' + FB_PROJECT_ID + '/databases/(default)/documents';
var MAIL_GERENCIA = 'gerenciaajua@gmail.com';

// Remitentes autorizados de Walmart Guatemala
var WM_SENDERS = [
  { email: 'Willy.Galvez@walmart.com',   nombre: 'Willy Galvez'   },
  { email: 'JORGE.GRANADOS@walmart.com', nombre: 'Jorge Granados'  },
  { email: 'Astrid.Tujab@walmart.com',   nombre: 'Astrid Tujab'   },
];

var WM_SUBJECT = 'PEDIDO AGROINDUSTRIA AJUA';

var MESES = {
  ENERO:1, FEBRERO:2, MARZO:3, ABRIL:4, MAYO:5, JUNIO:6,
  JULIO:7, AGOSTO:8, SEPTIEMBRE:9, OCTUBRE:10, NOVIEMBRE:11, DICIEMBRE:12
};

// ══════════════════════════════════════════════════════════════════
// FUNCION PRINCIPAL — se ejecuta automaticamente cada 30 min
// ══════════════════════════════════════════════════════════════════
function processWalmartEmails() {
  var token        = getFirebaseToken();
  var queueDoc     = getQueueDoc(token);
  var pending      = (queueDoc.queue || []).filter(function(p) { return !p._importado; });
  var nextCorr     = queueDoc.nextCorrelativo || 1;
  var docModificado = false;

  WM_SENDERS.forEach(function(sender) {
    var query   = 'from:' + sender.email + ' subject:"' + WM_SUBJECT + '" is:unread';
    var threads = GmailApp.search(query, 0, 20);

    threads.forEach(function(thread) {
      thread.getMessages().forEach(function(msg) {
        if (!msg.isUnread()) return;
        try {
          var body   = msg.getPlainBody();
          var pedido = parsearCorreoWalmart(body);
          if (pedido) {
            pedido.emailFecha       = Utilities.formatDate(msg.getDate(), 'America/Guatemala', 'yyyy-MM-dd HH:mm');
            pedido.emailAsunto      = msg.getSubject();
            pedido.solicitante      = sender.nombre;
            pedido.solicitanteEmail = sender.email;

            var dup = pending.some(function(q) {
              return q.fechaEntrega === pedido.fechaEntrega &&
                     q.rubros && pedido.rubros &&
                     q.rubros.length === pedido.rubros.length;
            });

            if (!dup) {
              var yr = new Date().getFullYear();
              pedido.correlativo = 'WM-' + yr + '-' + String(nextCorr).padStart(3, '0');
              nextCorr++;

              try {
                var pdfBlob = generarPDFOrden(pedido);
                enviarEmailOrden(pedido, pdfBlob);
                Logger.log('Email enviado: ' + pedido.correlativo);
              } catch(e) {
                Logger.log('Error PDF/email ' + pedido.correlativo + ': ' + e.message);
              }

              pending.push(pedido);
              docModificado = true;
              Logger.log(pedido.correlativo + ' — ' + sender.nombre + ' — ' + pedido.fechaEntrega + ' — ' + pedido.rubros.length + ' rubros');
            } else {
              Logger.log('Duplicado: ' + pedido.fechaEntrega + ' de ' + sender.nombre);
            }
          } else {
            Logger.log('No se pudo parsear email de ' + sender.nombre);
          }
          msg.markRead();
        } catch(e) {
          Logger.log('Error procesando email de ' + sender.nombre + ': ' + e.message);
        }
      });
    });
  });

  if (docModificado) {
    setQueueDoc(token, { queue: pending, nextCorrelativo: nextCorr, lastUpdate: new Date().toISOString() });
    Logger.log('Cola actualizada: ' + pending.length + ' pendientes');
  } else {
    Logger.log('Sin emails nuevos (' + new Date().toLocaleString() + ')');
  }

  // Procesar importaciones manuales desde el BPM
  procesarEmailQueue(token);
}

// ══════════════════════════════════════════════════════════════════
// EMAIL_QUEUE — pedidos importados manualmente desde el BPM
// ══════════════════════════════════════════════════════════════════
function procesarEmailQueue(token) {
  try {
    var url  = FIRESTORE_URL + '/ajua_bpm/email_queue?key=' + FB_API_KEY;
    var opts = { muteHttpExceptions: true };
    if (token) opts.headers = { Authorization: 'Bearer ' + token };

    var resp = UrlFetchApp.fetch(url, opts);
    if (resp.getResponseCode() === 404) return;

    var doc    = JSON.parse(resp.getContentText());
    var qField = doc.fields && doc.fields.queue;
    if (!qField) return;

    var emails  = decodeFS(qField) || [];
    var pending = emails.filter(function(e) { return !e._enviado; });
    if (!pending.length) return;

    var huboEnvios = false;
    pending.forEach(function(p) {
      try {
        var pdfBlob = generarPDFOrden(p);
        enviarEmailOrden(p, pdfBlob);
        p._enviado = true;
        Logger.log('Email manual enviado: ' + (p.correlativo || p.id));
        huboEnvios = true;
      } catch(e) {
        Logger.log('Error email manual: ' + e.message);
      }
    });

    if (huboEnvios) {
      var patchOpts = {
        method: 'PATCH', contentType: 'application/json',
        payload: JSON.stringify({ fields: {
          queue:         encodeFS(emails),
          lastProcessed: encodeFS(new Date().toISOString()),
        }}),
        muteHttpExceptions: true,
      };
      if (token) patchOpts.headers = { Authorization: 'Bearer ' + token };
      UrlFetchApp.fetch(url, patchOpts);
    }
  } catch(e) {
    Logger.log('procesarEmailQueue error: ' + e.message);
  }
}

// ══════════════════════════════════════════════════════════════════
// GENERAR PDF con Google Docs
// ══════════════════════════════════════════════════════════════════
function generarPDFOrden(pedido) {
  var doc  = DocumentApp.create('_TEMP_WM_' + (pedido.correlativo || new Date().getTime()));
  var body = doc.getBody();
  body.setMarginTop(40).setMarginBottom(40).setMarginLeft(54).setMarginRight(54);

  // Encabezado
  var h1 = body.appendParagraph('AGROINDUSTRIA AJUA, S.A.');
  h1.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  h1.editAsText().setFontFamily('Arial').setFontSize(18).setBold(true);

  var sub = body.appendParagraph('Km 54 Carretera al Pacifico, Santa Lucia Cotzumalguapa, Guatemala');
  sub.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  sub.editAsText().setFontFamily('Arial').setFontSize(9).setItalic(true).setForegroundColor('#555555');

  body.appendParagraph('').editAsText().setFontSize(4);
  body.appendHorizontalRule();

  // Titulo y correlativo
  var tit = body.appendParagraph('ORDEN DE PEDIDO WALMART GUATEMALA');
  tit.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  tit.editAsText().setFontFamily('Arial').setFontSize(13).setBold(true).setForegroundColor('#1B5E20');

  var corrPar = body.appendParagraph(pedido.correlativo || '---');
  corrPar.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  corrPar.editAsText().setFontFamily('Arial').setFontSize(28).setBold(true).setForegroundColor('#1B5E20');

  body.appendParagraph('').editAsText().setFontSize(4);
  body.appendHorizontalRule();
  body.appendParagraph('').editAsText().setFontSize(4);

  // Datos del pedido
  var ahora = Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm');
  var datos = [
    ['Fecha de entrega:', pedido.fechaEntrega || '---'],
    ['Hora de llegada:',  pedido.horaEntrega  || '16:00'],
    ['Rampa:',            pedido.rampa        || '---'],
    ['Solicitado por:',   (pedido.solicitante || 'Manual BPM') + (pedido.solicitanteEmail ? ' <' + pedido.solicitanteEmail + '>' : '')],
    ['Fecha del correo:', pedido.emailFecha   || '---'],
    ['Nota del pedido:',  pedido.nota         || '---'],
    ['Registrado:',       ahora + ' (Guatemala)'],
  ];

  var tDatos = body.appendTable();
  datos.forEach(function(row) {
    var tr = tDatos.appendTableRow();
    tr.appendTableCell(row[0]).editAsText().setFontFamily('Arial').setFontSize(10).setBold(true);
    tr.appendTableCell(row[1]).editAsText().setFontFamily('Arial').setFontSize(10);
  });

  body.appendParagraph('').editAsText().setFontSize(8);

  // Detalle rubros
  body.appendParagraph('DETALLE DEL PEDIDO')
      .editAsText().setFontFamily('Arial').setFontSize(11).setBold(true).setForegroundColor('#1B5E20');

  var tDet  = body.appendTable();
  var hRow  = tDet.appendTableRow();
  var hCols = ['# Item', 'Descripcion del producto', 'Cajas'];
  hCols.forEach(function(h) {
    hRow.appendTableCell(h).editAsText()
        .setFontFamily('Arial').setFontSize(10).setBold(true)
        .setForegroundColor('#ffffff').setBackgroundColor('#1B5E20');
  });

  var totalCajas = 0;
  (pedido.rubros || []).forEach(function(r) {
    var dRow = tDet.appendTableRow();
    dRow.appendTableCell(r.n || r.item || '').editAsText().setFontFamily('Arial').setFontSize(10);
    dRow.appendTableCell(r.desc || '').editAsText().setFontFamily('Arial').setFontSize(10);
    dRow.appendTableCell(String(r.cajas || 0)).editAsText().setFontFamily('Arial').setFontSize(10);
    totalCajas += (r.cajas || 0);
  });

  var totRow = tDet.appendTableRow();
  totRow.appendTableCell('').editAsText().setFontSize(10);
  totRow.appendTableCell('TOTAL CAJAS').editAsText().setFontFamily('Arial').setFontSize(10).setBold(true);
  totRow.appendTableCell(String(totalCajas)).editAsText().setFontFamily('Arial').setFontSize(11).setBold(true).setForegroundColor('#1B5E20');

  body.appendParagraph('').editAsText().setFontSize(6);
  body.appendHorizontalRule();

  // Pie
  body.appendParagraph('Documento generado automaticamente por AJUA BPM · ' + ahora + ' (GT) · Para auditorias')
      .editAsText().setFontFamily('Arial').setFontSize(8).setItalic(true).setForegroundColor('#888888');
  body.appendParagraph('Correlativo: ' + (pedido.correlativo || '---') + ' · Confidencial — Agroindustria AJUA, S.A.')
      .editAsText().setFontFamily('Arial').setFontSize(8).setItalic(true).setForegroundColor('#888888');

  doc.saveAndClose();

  var pdfBlob = DriveApp.getFileById(doc.getId()).getAs('application/pdf');
  pdfBlob.setName('Orden_' + (pedido.correlativo || pedido.id) + '.pdf');
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  return pdfBlob;
}

// ══════════════════════════════════════════════════════════════════
// ENVIAR EMAIL con PDF adjunto
// ══════════════════════════════════════════════════════════════════
function enviarEmailOrden(pedido, pdfBlob) {
  var totalCajas = (pedido.rubros || []).reduce(function(s, r) { return s + (r.cajas || 0); }, 0);
  var ahora      = Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM/yyyy HH:mm');

  var rubrosHtml = (pedido.rubros || []).map(function(r, i) {
    var bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
    return '<tr style="background:' + bg + ';">' +
      '<td style="padding:7px 10px;border:1px solid #ddd;font-family:monospace;font-size:13px;">' + (r.n || '') + '</td>' +
      '<td style="padding:7px 10px;border:1px solid #ddd;font-size:13px;">' + (r.desc || '') + '</td>' +
      '<td style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-weight:bold;font-size:13px;">' + (r.cajas || 0) + '</td>' +
      '</tr>';
  }).join('');

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">' +
    '<div style="background:#1B5E20;padding:28px 24px;text-align:center;">' +
    '<h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:1px;">AGROINDUSTRIA AJUA, S.A.</h1>' +
    '<p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Orden de Pedido Walmart Guatemala</p>' +
    '</div>' +
    '<div style="padding:28px 24px;background:#fff;">' +
    '<div style="text-align:center;margin-bottom:24px;">' +
    '<div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:2px;">Correlativo</div>' +
    '<div style="font-size:36px;font-weight:bold;color:#1B5E20;line-height:1.2;">' + (pedido.correlativo || '---') + '</div>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">' +
    '<tr style="background:#f5f5f5;"><td style="padding:9px 12px;font-weight:bold;width:170px;border:1px solid #e0e0e0;">Fecha de entrega</td><td style="padding:9px 12px;border:1px solid #e0e0e0;">' + (pedido.fechaEntrega || '---') + '</td></tr>' +
    '<tr><td style="padding:9px 12px;font-weight:bold;border:1px solid #e0e0e0;">Hora de llegada</td><td style="padding:9px 12px;border:1px solid #e0e0e0;">' + (pedido.horaEntrega || '16:00') + '</td></tr>' +
    '<tr style="background:#f5f5f5;"><td style="padding:9px 12px;font-weight:bold;border:1px solid #e0e0e0;">Rampa</td><td style="padding:9px 12px;border:1px solid #e0e0e0;">' + (pedido.rampa || '---') + '</td></tr>' +
    '<tr><td style="padding:9px 12px;font-weight:bold;border:1px solid #e0e0e0;">Solicitado por</td><td style="padding:9px 12px;border:1px solid #e0e0e0;">' + (pedido.solicitante || 'Manual BPM') + (pedido.solicitanteEmail ? ' &lt;' + pedido.solicitanteEmail + '&gt;' : '') + '</td></tr>' +
    '<tr style="background:#f5f5f5;"><td style="padding:9px 12px;font-weight:bold;border:1px solid #e0e0e0;">Fecha del correo</td><td style="padding:9px 12px;border:1px solid #e0e0e0;">' + (pedido.emailFecha || '---') + '</td></tr>' +
    '<tr><td style="padding:9px 12px;font-weight:bold;border:1px solid #e0e0e0;">Nota</td><td style="padding:9px 12px;border:1px solid #e0e0e0;">' + (pedido.nota || '---') + '</td></tr>' +
    '</table>' +
    '<h3 style="color:#1B5E20;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #1B5E20;font-size:15px;">Detalle del pedido</h3>' +
    '<table style="width:100%;border-collapse:collapse;">' +
    '<thead><tr style="background:#1B5E20;">' +
    '<th style="padding:9px 10px;text-align:left;color:#fff;border:1px solid #1B5E20;font-size:13px;"># Item</th>' +
    '<th style="padding:9px 10px;text-align:left;color:#fff;border:1px solid #1B5E20;font-size:13px;">Descripcion</th>' +
    '<th style="padding:9px 10px;text-align:center;color:#fff;border:1px solid #1B5E20;font-size:13px;">Cajas</th>' +
    '</tr></thead>' +
    '<tbody>' + rubrosHtml + '</tbody>' +
    '<tfoot><tr style="background:#e8f5e9;">' +
    '<td colspan="2" style="padding:9px 10px;font-weight:bold;border:1px solid #ddd;font-size:14px;">TOTAL CAJAS</td>' +
    '<td style="padding:9px 10px;text-align:center;font-weight:bold;font-size:18px;color:#1B5E20;border:1px solid #ddd;">' + totalCajas + '</td>' +
    '</tr></tfoot>' +
    '</table>' +
    '<p style="margin-top:24px;font-size:12px;color:#aaa;border-top:1px solid #eee;padding-top:12px;">' +
    'Generado automaticamente por AJUA BPM &middot; ' + ahora + ' (Guatemala)<br>' +
    'Confidencial &middot; Para auditorias conservar con correlativo <strong>' + (pedido.correlativo || '---') + '</strong>' +
    '</p>' +
    '</div></div>';

  MailApp.sendEmail({
    to:          MAIL_GERENCIA,
    subject:     '[AJUA] Pedido ' + (pedido.correlativo || '') + ' — Entrega ' + (pedido.fechaEntrega || '') + ' — ' + (pedido.solicitante || 'Manual'),
    htmlBody:    html,
    attachments: [pdfBlob],
    name:        'AJUA BPM',
    replyTo:     'agroajua@gmail.com',
  });
}

// ══════════════════════════════════════════════════════════════════
// PARSER — Formato PIPE del email de Walmart Guatemala
// ══════════════════════════════════════════════════════════════════
function parsearCorreoWalmart(body) {
  if (!body) return null;
  var rubros = [];
  var campos = { hora: '', rampa: '', dia: '' };
  var lines  = body.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);

  if (body.indexOf('|') >= 0) {
    lines.forEach(function(line) {
      if (line.indexOf('|') < 0) return;
      var cols = line.split('|').map(function(c) { return c.trim(); });
      if (cols.length < 7) return;
      if (!/^\d+$/.test(cols[4])) return;
      var item  = cols[4] || '';
      var desc  = cols[5] || '';
      var cajas = parseInt(cols[6], 10) || 0;
      var hora  = (cols[7] || '16:00').substring(0, 5);
      var rampa = (cols[8] || '').trim();
      var dia   = (cols[9] || '').replace(/\s*-\s*$/, '').trim();
      if (!item || !desc) return;
      if (!campos.hora  && hora  && hora !== '00:00') campos.hora  = hora;
      if (!campos.rampa && rampa)                     campos.rampa = rampa;
      if (!campos.dia   && dia   && dia !== '-')      campos.dia   = dia;
      rubros.push({ n: item, desc: desc, cajas: cajas, prodId: '', estado: 'pendiente' });
    });
  }

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
// FIRESTORE REST — documento completo de la cola
// ══════════════════════════════════════════════════════════════════
function getQueueDoc(token) {
  try {
    var url     = FIRESTORE_URL + '/ajua_bpm/walmart_queue?key=' + FB_API_KEY;
    var options = { muteHttpExceptions: true };
    if (token) options.headers = { Authorization: 'Bearer ' + token };
    var resp = UrlFetchApp.fetch(url, options);
    if (resp.getResponseCode() === 404) return { queue: [], nextCorrelativo: 1 };
    var doc = JSON.parse(resp.getContentText());
    if (!doc.fields) return { queue: [], nextCorrelativo: 1 };
    return {
      queue:           decodeFS(doc.fields.queue)           || [],
      nextCorrelativo: decodeFS(doc.fields.nextCorrelativo) || 1,
    };
  } catch(e) {
    Logger.log('getQueueDoc error: ' + e.message);
    return { queue: [], nextCorrelativo: 1 };
  }
}

function setQueueDoc(token, data) {
  try {
    var url     = FIRESTORE_URL + '/ajua_bpm/walmart_queue?key=' + FB_API_KEY;
    var options = {
      method: 'PATCH', contentType: 'application/json',
      payload: JSON.stringify({ fields: {
        queue:           encodeFS(data.queue || []),
        nextCorrelativo: encodeFS(data.nextCorrelativo || 1),
        lastUpdate:      encodeFS(data.lastUpdate || new Date().toISOString()),
      }}),
      muteHttpExceptions: true,
    };
    if (token) options.headers = { Authorization: 'Bearer ' + token };
    var resp = UrlFetchApp.fetch(url, options);
    var code = resp.getResponseCode();
    if (code !== 200) Logger.log('setQueueDoc HTTP ' + code + ': ' + resp.getContentText().substring(0, 200));
  } catch(e) {
    Logger.log('setQueueDoc error: ' + e.message);
  }
}

// ══════════════════════════════════════════════════════════════════
// FIREBASE AUTH (opcional)
// ══════════════════════════════════════════════════════════════════
function getFirebaseToken() {
  try {
    var props = PropertiesService.getScriptProperties();
    var email = props.getProperty('FB_EMAIL');
    var pass  = props.getProperty('FB_PASSWORD');
    if (!email || !pass) return null;
    var url  = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + FB_API_KEY;
    var resp = UrlFetchApp.fetch(url, {
      method: 'POST', contentType: 'application/json',
      payload: JSON.stringify({ email: email, password: pass, returnSecureToken: true }),
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
// FIRESTORE CODEC
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
// SETUP
// ══════════════════════════════════════════════════════════════════
function configurarTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'processWalmartEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processWalmartEmails').timeBased().everyMinutes(30).create();
  Logger.log('Trigger activo: processWalmartEmails cada 30 min');
  Logger.log('Remitentes: ' + WM_SENDERS.map(function(s) { return s.nombre; }).join(', '));
}

function configurarCredenciales() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('FB_EMAIL',    'TU_EMAIL_FIREBASE@gmail.com');
  props.setProperty('FB_PASSWORD', 'TU_PASSWORD_FIREBASE');
  Logger.log('Credenciales guardadas (borra los valores del codigo)');
}

function testParsear() {
  var ejemplo = [
    '# ATLAS | # SAP | COD. PROV. | NOM. PROV. | Item | Descrip. Item | Total Cajas | HORA | RAMPA | DIA DE ENTREGA | NOTA IMPORTANTE',
    '0 | 0 | 1599010650 | AGROINDUSTRIA AJUA, S.A. | 9426586 | ZANAHORIA SELE ESP BLS UXC_10 | 25 | 18:00:00 | 5010 | MARTES 17 DE MARZO | -',
    '0 | 0 | 1599010650 | AGROINDUSTRIA AJUA, S.A. | 9425739 | CEBOLLA BLANCA UXC_30 | 98 | 18:00:00 | 5010 | MARTES 17 DE MARZO | -',
  ].join('\n');
  var result = parsearCorreoWalmart(ejemplo);
  if (result) {
    Logger.log('Parser OK');
    Logger.log('  Fecha: '  + result.fechaEntrega);
    Logger.log('  Hora: '   + result.horaEntrega);
    Logger.log('  Rampa: '  + result.rampa);
    Logger.log('  Dia: '    + result.nota);
    Logger.log('  Rubros: ' + result.rubros.length);
    result.rubros.forEach(function(r) {
      Logger.log('  -> ' + r.n + ' | ' + r.desc + ' | ' + r.cajas + ' cajas');
    });
  } else {
    Logger.log('FALLO: Parser no reconocio el formato');
  }
}

// Genera PDF real y envia email de prueba a gerenciaajua@gmail.com
function testEnviarEmail() {
  var ejemplo = parsearCorreoWalmart([
    '# ATLAS | # SAP | COD. PROV. | NOM. PROV. | Item | Descrip. Item | Total Cajas | HORA | RAMPA | DIA DE ENTREGA | NOTA',
    '0 | 0 | 1599010650 | AGROINDUSTRIA AJUA, S.A. | 9426586 | ZANAHORIA SELE ESP BLS UXC_10 | 25 | 18:00:00 | 5010 | MARTES 17 DE MARZO | -',
    '0 | 0 | 1599010650 | AGROINDUSTRIA AJUA, S.A. | 9425739 | CEBOLLA BLANCA UXC_30 | 98 | 18:00:00 | 5010 | MARTES 17 DE MARZO | -',
  ].join('\n'));
  if (!ejemplo) { Logger.log('FALLO: Parser fallo'); return; }
  ejemplo.correlativo      = 'WM-TEST-001';
  ejemplo.solicitante      = 'Willy Galvez (TEST)';
  ejemplo.solicitanteEmail = 'Willy.Galvez@walmart.com';
  ejemplo.emailFecha       = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd HH:mm');
  try {
    var pdfBlob = generarPDFOrden(ejemplo);
    enviarEmailOrden(ejemplo, pdfBlob);
    Logger.log('Email de prueba enviado a ' + MAIL_GERENCIA + ' con PDF adjunto');
  } catch(e) {
    Logger.log('Error: ' + e.message);
  }
}

function testEscribirQueue() {
  var token   = getFirebaseToken();
  var ejemplo = parsearCorreoWalmart([
    '# ATLAS | # SAP | COD. PROV. | NOM. PROV. | Item | Descrip. Item | Total Cajas | HORA | RAMPA | DIA DE ENTREGA | NOTA',
    '0 | 0 | 1599010650 | AGROINDUSTRIA AJUA, S.A. | 9426586 | ZANAHORIA SELE ESP BLS UXC_10 | 25 | 18:00:00 | 5010 | MARTES 17 DE MARZO | -',
  ].join('\n'));
  if (!ejemplo) { Logger.log('FALLO: Parser fallo'); return; }
  ejemplo.correlativo      = 'WM-TEST-001';
  ejemplo.solicitante      = 'Test';
  ejemplo.solicitanteEmail = 'test@walmart.com';
  setQueueDoc(token, { queue: [ejemplo], nextCorrelativo: 2, lastUpdate: new Date().toISOString() });
  Logger.log('Pedido de prueba escrito en ajua_bpm/walmart_queue');
}
