// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — Exportar Excel Profesional (build-104)
// Llamar: rpExportarCompleto()
// ═══════════════════════════════════════════════════════════════════

// ── Helpers ────────────────────────────────────────────────────────
function rpXSemana(fecha) {
  if (!fecha) return '';
  var d = new Date(fecha + 'T00:00:00');
  var day = d.getDay();
  var diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function rpXFiltrar(arr, campo, desde) {
  if (!desde) return arr || [];
  return (arr || []).filter(function(r) {
    var f = r[campo] || r.fecha || r.fechaEntrega || '';
    return f >= desde;
  });
}

// Crea hoja con header corporativo 5-filas + freeze + merges
function rpXSheetPro(nombre, subtitulo, headers, rows, widths) {
  var hoy = new Date().toISOString().slice(0, 16).replace('T', ' ');
  var nc  = headers.length;
  var aoa = [
    ['AJUA \u00B7 AGROINDUSTRIA, S.A. \u2014 SISTEMA BPM'],
    [nombre],
    [subtitulo + '   |   Generado: ' + hoy],
    [],
    headers
  ].concat(rows);

  var ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!merges'] = [
    { s: { r:0, c:0 }, e: { r:0, c:nc-1 } },
    { s: { r:1, c:0 }, e: { r:1, c:nc-1 } },
    { s: { r:2, c:0 }, e: { r:2, c:nc-1 } },
    { s: { r:3, c:0 }, e: { r:3, c:nc-1 } },
  ];

  // Freeze primeras 5 filas (sheetViews)
  if (!ws['!sheetViews']) ws['!sheetViews'] = [{}];
  ws['!sheetViews'][0].state = 'frozen';
  ws['!sheetViews'][0].ySplit = 5;
  ws['!sheetViews'][0].topLeftCell = 'A6';

  if (widths) ws['!cols'] = widths.map(function(w) { return { wch: w }; });
  return ws;
}

// ── 1. Resumen Ejecutivo ───────────────────────────────────────────
function rpXResumen(desde) {
  var filtrar = function(arr, campo) { return rpXFiltrar(arr, campo, desde); };
  var gd      = filtrar(DB.gastosDiarios, 'fecha');
  var modulos = [
    ['Gastos Diarios',   gd.length,
      'Q ' + gd.reduce(function(s,r){ return s + (r.monto||0); }, 0).toFixed(2), 'Gasto operativo diario' ],
    ['Pedidos Walmart',  filtrar(DB.pedidosWalmart,  'fechaEntrega').length, '', 'Control de pedidos' ],
    ['AL Accesos',       filtrar(DB.al,               'fecha').length,        '', 'Lavado de manos' ],
    ['TL Camiones',      filtrar(DB.tl,               'fecha').length,        '', 'Limpieza de furgones' ],
    ['DT Despachos',     filtrar(DB.dt,               'fecha').length,        '', 'Control de despachos' ],
    ['BAS Basculas',     filtrar(DB.bas,              'fecha').length,        '', 'Calibracion de basculas' ],
    ['ROD Roedores',     filtrar(DB.rod,              'fecha').length,        '', 'Control de plagas' ],
    ['GC Concursos',     filtrar(DB.gcConcursos,      'fechaCierre').length,  '', 'Guatecompras' ],
    ['Empleados',        (DB.empleados||[]).length,                           '', 'Nomina' ],
  ];
  return rpXSheetPro(
    'Resumen Ejecutivo',
    desde ? 'Periodo desde: ' + desde : 'Todos los registros',
    ['Modulo', 'Registros', 'Total', 'Descripcion'],
    modulos,
    [28, 12, 20, 30]
  );
}

// ── 2. Gastos Diarios ─────────────────────────────────────────────
function rpXGastosDiarios(desde) {
  var rows = rpXFiltrar(DB.gastosDiarios, 'fecha', desde).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  });
  return rpXSheetPro(
    'Gastos Diarios',
    'Control de gastos operativos diarios',
    ['Semana','Fecha','Categoria','Descripcion','Monto Q','Metodo','Pagado Por','Empleado','Banco Ref'],
    rows.map(function(r) { return [
      rpXSemana(r.fecha), r.fecha||'',
      (typeof rpCatLabel === 'function' ? rpCatLabel(r.cat) : r.cat||''),
      r.desc||'', r.monto||0, r.metodo||'', r.pagadoPor||'',
      r.empleadoNombre||r.empleado||'', r.banco_ref||r.bancoRef||''
    ]; }),
    [12,12,24,40,12,12,16,22,18]
  );
}

// ── 3. Pedidos Walmart ────────────────────────────────────────────
function rpXPedidosWalmart(desde) {
  var data = [];
  rpXFiltrar(DB.pedidosWalmart, 'fechaEntrega', desde).slice().sort(function(a,b) {
    return (a.fechaEntrega||'') < (b.fechaEntrega||'') ? -1 : 1;
  }).forEach(function(p) {
    var semana = rpXSemana(p.fechaEntrega);
    var rubros = p.rubros || [];
    if (rubros.length) {
      rubros.forEach(function(r) {
        data.push([
          semana, p.fechaEntrega||'',
          r.item||'', r.descripcion||r.desc||'',
          r.cajasPedidas||r.cajas||0,
          p.horaEntrega||'', p.rampa||'', p.nota||'', p.estado||''
        ]);
      });
    } else {
      data.push([semana, p.fechaEntrega||'', '', '', 0,
        p.horaEntrega||'', p.rampa||'', p.nota||'', p.estado||'']);
    }
  });
  return rpXSheetPro(
    'Pedidos Walmart',
    'Registro de pedidos Walmart Guatemala',
    ['Semana','Fecha','Item SAP','Descripcion','Cajas','Hora','Rampa','Dia Entrega','Estado'],
    data,
    [12,12,10,38,8,8,8,18,14]
  );
}

// ── 4. AL Accesos y Lavado ────────────────────────────────────────
function rpXAccesosAL(desde) {
  var data = [];
  rpXFiltrar(DB.al, 'fecha', desde).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  }).forEach(function(t) {
    var semana = rpXSemana(t.fecha);
    var lavs   = t.lavados || t.horas || [];
    var lav    = function(h) {
      var found = lavs.find(function(x) { return String(x.hora||'').startsWith(h); });
      return found ? (found.cumplido !== false ? 'OK' : 'NO') : '';
    };
    if (t.empleados && t.empleados.length) {
      t.empleados.forEach(function(e) {
        var ok = (e.lavados||[]).every(function(x) { return x.cumplido !== false; });
        data.push([semana, t.fecha||'', t.turno||'', e.nombre||'',
          lav('10'), lav('12'), lav('14'), lav('16'), ok ? 'Si' : 'No']);
      });
    } else {
      var ok = lavs.every(function(x) { return x.cumplido !== false; });
      data.push([semana, t.fecha||'', t.turno||'', '',
        lav('10'), lav('12'), lav('14'), lav('16'), ok ? 'Si' : 'No']);
    }
  });
  return rpXSheetPro(
    'AL - Accesos y Lavado de Manos',
    'Control de higiene por turno y empleado',
    ['Semana','Fecha','Turno','Empleado','10:00','12:00','14:00','16:00','Completo'],
    data,
    [12,12,10,28,8,8,8,8,10]
  );
}

// ── 5. TL Furgones ────────────────────────────────────────────────
function rpXFurgonesTL(desde) {
  var rows = rpXFiltrar(DB.tl, 'fecha', desde).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  });
  return rpXSheetPro(
    'TL - Limpieza de Camiones',
    'Control de limpieza y desinfeccion de furgones',
    ['Semana','Fecha','Placa','Responsable','Ext.Furgon','Carroceria','Barrido','Desinfeccion','Cabina','Resultado'],
    rows.map(function(r) { return [
      rpXSemana(r.fecha), r.fecha||'', r.placa||'', r.resp||'',
      r.extFurgon||r.exterior||'', r.carroceria||'',
      r.barrido||'', r.desinfeccion||'', r.cabina||'',
      r.resultado||r.res||''
    ]; }),
    [12,12,12,22,12,12,10,12,10,14]
  );
}

// ── 6. DT Despachos ───────────────────────────────────────────────
function rpXDespachosDT(desde) {
  var rows = rpXFiltrar(DB.dt, 'fecha', desde).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  });
  return rpXSheetPro(
    'DT - Despachos',
    'Control de despachos y conformidad de carga',
    ['Semana','Fecha','Placa','Conductor','Carga','Checks OK','Total','%','Resultado'],
    rows.map(function(r) { return [
      rpXSemana(r.fecha), r.fecha||'', r.placa||'',
      r.conductorNombre||r.conductor||'',
      r.clienteNombre||r.cliente||r.carga||'',
      r.checksOk||r.ok||0, r.total||r.checksTotal||0,
      r.pct != null ? r.pct : '',
      r.resultado||r.res||''
    ]; }),
    [12,12,12,24,24,10,8,8,14]
  );
}

// ── 7. BAS Básculas ───────────────────────────────────────────────
function rpXBasculasBAS(desde) {
  var rows = rpXFiltrar(DB.bas, 'fecha', desde).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  });
  return rpXSheetPro(
    'BAS - Basculas',
    'Control y calibracion de basculas industriales',
    ['Semana','Fecha','Responsable','B1','B2','B3','B4','OK','Fallas','Resultado'],
    rows.map(function(r) { return [
      rpXSemana(r.fecha), r.fecha||'', r.resp||'',
      r.b1||r.bas1||'', r.b2||r.bas2||'', r.b3||r.bas3||'', r.b4||r.bas4||'',
      r.ok||0, r.fail||r.fallas||0,
      r.resultado||r.res||''
    ]; }),
    [12,12,22,8,8,8,8,8,8,14]
  );
}

// ── 8. ROD Roedores ───────────────────────────────────────────────
function rpXRoedoresROD(desde) {
  var rows = rpXFiltrar(DB.rod, 'fecha', desde).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  });
  return rpXSheetPro(
    'ROD - Control de Roedores',
    'Revision de trampas y control de plagas',
    ['Semana','Fecha','Responsable','Trampas','Revisadas','Sin Nov.','Con Nov.','Resultado'],
    rows.map(function(r) { return [
      rpXSemana(r.fecha), r.fecha||'', r.resp||'',
      r.totalRev||r.trampas||0,
      r.revisadas||r.totalRev||0,
      r.totalLugar||r.sinNov||0,
      r.totalNov||r.conNov||0,
      r.resultado||r.res||''
    ]; }),
    [12,12,22,10,10,10,10,14]
  );
}

// ── 9. Guatecompras ───────────────────────────────────────────────
function rpXGuatecompras(desde) {
  var data = [];
  rpXFiltrar(DB.gcConcursos, 'fechaCierre', desde).forEach(function(c) {
    var pres = c.sePresento != null
      ? (c.sePresento ? 'Si' : 'No')
      : (c.etapa && /present|adjudic|ganado|cotiz/i.test(c.etapa) ? 'Si' : '');
    data.push([c.nog||'', c.titulo||'', c.entidad||'',
      c.monto||'', c.fechaCierre||'', c.diasRestantes||'',
      c.etapa||'Identificado', pres]);
  });
  (DB.gcDescubiertos||[]).forEach(function(d) {
    var etapa = d.importado ? 'Importado' : d.descartado ? 'Descartado' : 'Pendiente';
    data.push([d.nog||'', d.titulo||'', d.entidad||'',
      d.monto||'', d.fechaCierre||'', '', etapa, '']);
  });
  data.sort(function(a,b) { return (a[4]||'') < (b[4]||'') ? -1 : 1; });
  return rpXSheetPro(
    'Guatecompras',
    'Concursos y descubiertos del Estado de Guatemala',
    ['NOG','Titulo','Entidad','Monto','Fecha Cierre','Dias Rest.','Etapa','Presentado'],
    data,
    [16,45,32,14,14,10,16,12]
  );
}

// ── 10. Empleados ─────────────────────────────────────────────────
function rpXEmpleados() {
  var rows = (DB.empleados||[]).slice().sort(function(a,b) {
    return (a.nombre||'') < (b.nombre||'') ? -1 : 1;
  });
  return rpXSheetPro(
    'Empleados',
    'Registro de personal activo e inactivo',
    ['Nombre','Puesto','Salario Dia Q','Area','Activo'],
    rows.map(function(r) { return [
      r.nombre||'', r.puesto||r.cargo||'',
      r.salarioDia||r.salario||0,
      r.area||'', r.activo === false ? 'No' : 'Si'
    ]; }),
    [28,22,14,18,8]
  );
}

// ── Dialog de período ─────────────────────────────────────────────
function rpPedirPeriodo(callback) {
  var overlay = document.createElement('div');
  overlay.id = 'rp-periodo-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;';

  var hoy  = new Date();
  var mes  = hoy.getFullYear() + '-' + String(hoy.getMonth()+1).padStart(2,'0') + '-01';
  var d3m  = new Date(hoy); d3m.setMonth(d3m.getMonth()-3);
  var yr   = hoy.getFullYear() + '-01-01';

  var opciones = [
    { label: 'Este mes',           desde: mes },
    { label: 'Últimos 3 meses',    desde: d3m.toISOString().slice(0,10) },
    { label: 'Todo el año ' + hoy.getFullYear(), desde: yr },
    { label: 'Todo (sin filtro)',   desde: null },
  ];

  var btns = opciones.map(function(o) {
    return '<button data-desde="' + (o.desde === null ? '__null__' : o.desde) + '" ' +
      'style="display:block;width:100%;padding:11px 14px;margin-bottom:8px;border:1.5px solid #A5D6A7;border-radius:8px;background:#fff;font-size:.93rem;cursor:pointer;text-align:left;" ' +
      'onmouseover="this.style.background=\'#E8F5E9\'" onmouseout="this.style.background=\'#fff\'">' +
      o.label + '</button>';
  }).join('');

  overlay.innerHTML =
    '<div style="background:#fff;border-radius:12px;padding:28px 32px;min-width:300px;max-width:380px;box-shadow:0 12px 40px rgba(0,0,0,.25);">' +
    '<div style="font-size:1rem;font-weight:800;color:#1B5E20;margin-bottom:4px;">📊 Exportar Excel</div>' +
    '<div style="font-size:.82rem;color:#888;margin-bottom:18px;">Seleccioná el período a exportar</div>' +
    btns +
    '<button id="rp-cancel-btn" style="margin-top:4px;padding:7px 18px;border:none;background:#f5f5f5;border-radius:6px;cursor:pointer;font-size:.85rem;color:#666;">Cancelar</button>' +
    '</div>';

  document.body.appendChild(overlay);

  overlay.querySelectorAll('button[data-desde]').forEach(function(btn) {
    btn.onclick = function() {
      var desde = btn.dataset.desde === '__null__' ? null : btn.dataset.desde;
      document.body.removeChild(overlay);
      callback(desde);
    };
  });
  overlay.querySelector('#rp-cancel-btn').onclick = function() {
    document.body.removeChild(overlay);
  };
}

// ── Función principal ─────────────────────────────────────────────
function rpExportarCompleto() {
  rpPedirPeriodo(function(desde) {
    var btn = document.getElementById('btn-exportar-completo');
    if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }

    function _generar() {
      console.log('rpExportarCompleto: generando' + (desde ? ' desde ' + desde : ' (todo)'));
      var wb  = XLSX.utils.book_new();
      var hoy = new Date().toISOString().slice(0, 10);
      var hojas = [
        ['Resumen',       function() { return rpXResumen(desde); }],
        ['Gastos Diarios',function() { return rpXGastosDiarios(desde); }],
        ['Pedidos Walmart',function() { return rpXPedidosWalmart(desde); }],
        ['AL Accesos',    function() { return rpXAccesosAL(desde); }],
        ['TL Camiones',   function() { return rpXFurgonesTL(desde); }],
        ['DT Despachos',  function() { return rpXDespachosDT(desde); }],
        ['BAS Basculas',  function() { return rpXBasculasBAS(desde); }],
        ['ROD Roedores',  function() { return rpXRoedoresROD(desde); }],
        ['Guatecompras',  function() { return rpXGuatecompras(desde); }],
        ['Empleados',     function() { return rpXEmpleados(); }],
      ];

      var errores = [];
      hojas.forEach(function(h) {
        try {
          XLSX.utils.book_append_sheet(wb, h[1](), h[0]);
          console.log('  \u2705 ' + h[0]);
        } catch(e) {
          errores.push(h[0]);
          console.error('  \u274C ' + h[0] + ':', e.message);
        }
      });

      if (!wb.SheetNames.length) {
        toast('\u274C No se genero ninguna hoja. Ver F12.', true);
        if (btn) { btn.disabled = false; btn.textContent = '\ud83d\udcca Exportar Excel'; }
        return;
      }

      var nombre = 'AJUA_BPM_' + hoy + (desde ? '_desde-' + desde : '_completo') + '.xlsx';
      XLSX.writeFile(wb, nombre);
      if (errores.length) {
        console.warn('\u26A0 Hojas con error:', errores);
        toast('\u26A0 Excel parcial (' + wb.SheetNames.length + '/10 hojas). Ver consola.');
      } else {
        toast('\u2705 ' + nombre + ' \u2014 ' + wb.SheetNames.length + ' hojas generadas');
      }
      if (btn) { btn.disabled = false; btn.textContent = '\ud83d\udcca Exportar Excel'; }
    }

    if (window.XLSX) {
      try { _generar(); } catch(e) {
        toast('\u274C ' + e.message, true);
        console.error(e);
        if (btn) { btn.disabled = false; btn.textContent = '\ud83d\udcca Exportar Excel'; }
      }
      return;
    }

    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = function() {
      try { _generar(); } catch(e) {
        toast('\u274C ' + e.message, true);
        console.error(e);
        if (btn) { btn.disabled = false; btn.textContent = '\ud83d\udcca Exportar Excel'; }
      }
    };
    s.onerror = function() {
      toast('\u274C No se pudo cargar libreria Excel', true);
      if (btn) { btn.disabled = false; btn.textContent = '\ud83d\udcca Exportar Excel'; }
    };
    document.head.appendChild(s);
  });
}

window.rpExportarCompleto = rpExportarCompleto;
console.log('\u2705 descarga-excel-completo.js cargado \u2014 build-104');
