// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — Descarga Excel BPM completo
// Exporta todos los módulos a un .xlsx con hojas separadas
// ═══════════════════════════════════════════════════════════════════

function rpGetRango(periodo) {
  var hoy = new Date();
  if (periodo === 'semana') {
    var dow = hoy.getDay();
    var lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1));
    lunes.setHours(0,0,0,0);
    var domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    return { desde: lunes.toISOString().slice(0,10), hasta: domingo.toISOString().slice(0,10), label: 'Semana_' + lunes.toISOString().slice(0,10) };
  }
  if (periodo === 'mes') {
    var y = hoy.getFullYear(), m = hoy.getMonth();
    var desde = y + '-' + String(m+1).padStart(2,'0') + '-01';
    var hasta = new Date(y, m+1, 0).toISOString().slice(0,10);
    return { desde: desde, hasta: hasta, label: y + '-' + String(m+1).padStart(2,'0') };
  }
  if (periodo === 'anio') {
    var ya = hoy.getFullYear();
    return { desde: ya + '-01-01', hasta: ya + '-12-31', label: 'Ano_' + ya };
  }
  return { desde: '2020-01-01', hasta: '2099-12-31', label: 'Historico' };
}

function rpFilt(arr, campo, desde, hasta) {
  return (arr || []).filter(function(r) {
    var f = String(r[campo] || '').slice(0, 10);
    return f >= desde && f <= hasta;
  });
}

function rpCatLabel(cat) {
  if (typeof GD_CATS !== 'undefined' && GD_CATS[cat]) return GD_CATS[cat].label;
  return cat || '-';
}

function rpMakeSheet(header, rows, colWidths) {
  var ws = XLSX.utils.aoa_to_sheet([header].concat(rows));
  if (colWidths) ws['!cols'] = colWidths.map(function(w) { return { wch: w }; });
  return ws;
}

function rpSheetResumen(desde, hasta, label) {
  var gd   = rpFilt(DB.gastosDiarios || [], 'fecha', desde, hasta);
  var vgt  = rpFilt(DB.vgtVentas || [], 'fecha', desde, hasta);
  var vint = rpFilt(DB.vintVentas || [], 'fecha', desde, hasta);
  var pw   = rpFilt(DB.pedidosWalmart || [], 'fechaEntrega', desde, hasta);
  var gs   = rpFilt(DB.gastosSemanales || [], 'semanaInicio', desde, hasta);
  var ien  = rpFilt(DB.ientradas || [], 'fecha', desde, hasta);
  var isal = rpFilt(DB.isalidas || [], 'fecha', desde, hasta);

  var totalGastos    = gd.reduce(function(s,r) { return s + (r.monto||0); }, 0);
  var totalVentasGT  = vgt.reduce(function(s,r) { return s + (r.totalQ||0); }, 0);
  var totalVentasExp = vint.reduce(function(s,r) { return s + (r.totalGtq||0); }, 0);
  var totalMaquila   = gs.reduce(function(s,r) { return s + (r.grandTotal||0); }, 0);
  var totalEntradas  = ien.reduce(function(s,r) { return s + (r.costoTotal||r.totalQ||0); }, 0);
  var totalSalidas   = isal.reduce(function(s,r) { return s + (r.totalConIVA||r.totalQ||0); }, 0);

  var porCat = {};
  gd.forEach(function(r) { var k = rpCatLabel(r.cat); porCat[k] = (porCat[k]||0) + (r.monto||0); });

  var catRows = Object.keys(porCat).map(function(k) { return [k, porCat[k]]; })
                .sort(function(a,b) { return b[1]-a[1]; });

  var data = [
    ['REPORTE AJUA BPM -- ' + label],
    ['Periodo: ' + desde + ' al ' + hasta],
    [],
    ['FINANCIERO', 'Registros', 'Total Q'],
    ['Gastos Diarios', gd.length, totalGastos],
    ['Ventas GT (Locales)', vgt.length, totalVentasGT],
    ['Ventas Exportacion', vint.length, totalVentasExp],
    ['Maquila Semanal', gs.length, totalMaquila],
    ['Pedidos Walmart', pw.length, '---'],
    ['Entradas Inventario', ien.length, totalEntradas],
    ['Salidas Inventario (Walmart)', isal.length, totalSalidas],
    [],
    ['CONTROLES BPM', 'Registros'],
    ['Limpieza Transporte', rpFilt(DB.tl||[], 'fecha', desde, hasta).length],
    ['Despacho Transporte', rpFilt(DB.dt||[], 'fecha', desde, hasta).length],
    ['Acceso y Lavado', rpFilt(DB.al||[], 'fecha', desde, hasta).length],
    ['Basculas', rpFilt(DB.bas||[], 'fecha', desde, hasta).length],
    ['Roedores', rpFilt(DB.rod||[], 'fecha', desde, hasta).length],
    ['Fumigacion', rpFilt(DB.fum||[], 'fecha', desde, hasta).length],
    [],
    ['GASTOS POR CATEGORIA', 'Total Q']
  ].concat(catRows);

  var ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:35},{wch:14},{wch:16}];
  return ws;
}

function rpSheetGastosDiarios(desde, hasta) {
  var rows = rpFilt(DB.gastosDiarios, 'fecha', desde, hasta);
  return rpMakeSheet(
    ['Fecha','Categoria','Descripcion','Monto Q','Metodo','Pagado Por','Dev. Pendiente','Empleado'],
    rows.map(function(r) { return [
      r.fecha||'', rpCatLabel(r.cat), r.desc||'', r.monto||0,
      r.metodo||'', r.pagadoPor||'', r.devolucionPendiente ? 'Si' : 'No', r.empleadoNombre||''
    ]; }),
    [12,28,40,12,12,14,15,22]
  );
}

function rpSheetMaquila(desde, hasta) {
  var semanas = rpFilt(DB.gastosSemanales||[], 'semanaInicio', desde, hasta);
  var data = [['Semana Inicio','Semana Fin','Lbs Procesadas','Total Q']];
  semanas.forEach(function(s) {
    data.push([s.semanaInicio||'', s.semanaFin||'', s.lbsProc||0, s.grandTotal||0]);
    if (s.cuentas && typeof s.cuentas === 'object') {
      Object.values(s.cuentas).forEach(function(grp) {
        if (!grp) return;
        var tot = s.totales ? (s.totales[grp.id]||0) : 0;
        data.push(['', '  > ' + (grp.label||grp.id||''), '', tot]);
        (grp.rows||[]).forEach(function(row) {
          data.push(['', '      ' + (row.label||row.nombre||''), '', row.monto||row.salarioSemanal||0]);
        });
      });
    }
    data.push([]);
  });
  var ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:14},{wch:40},{wch:16},{wch:14}];
  return ws;
}

function rpSheetVentasGT(desde, hasta) {
  var rows = rpFilt(DB.vgtVentas||[], 'fecha', desde, hasta);
  var data = [['Fecha','Tipo','Comprador','Total Lbs','Total Q','Forma Pago','Factura','NIT','Observaciones']];
  rows.forEach(function(r) {
    data.push([r.fecha||'', r.tipo||'', r.comprador||'', r.totalLbs||0, r.totalQ||0,
               r.pago||'', r.numFactura||'', r.nitComprador||'', r.obs||'']);
    (r.lineas||[]).forEach(function(l) {
      data.push(['', '  > ' + (l.productoNombre||''), '', l.lbs||0, l.sub||0,
                 l.cant + ' ' + l.unidad + ' x Q' + l.precio]);
    });
  });
  var ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:12},{wch:14},{wch:28},{wch:12},{wch:12},{wch:14},{wch:14},{wch:14},{wch:30}];
  return ws;
}

function rpSheetVentasExport(desde, hasta) {
  var rows = rpFilt(DB.vintVentas||[], 'fecha', desde, hasta);
  var data = [['Fecha','Pais','Comprador','Operacion','Total Lbs','Total Bultos','Valor Orig.','Total GTQ','Flete','Papeleria','Moneda','Placa','Observaciones']];
  rows.forEach(function(r) {
    data.push([r.fecha||'', r.pais||'', r.comprador||'', r.op||'', r.totalLbs||0, r.totalBultos||0,
               r.totalVal||0, r.totalGtq||0, r.flete||0, r.pap||0, r.moneda||'GTQ', r.placa||'', r.obs||'']);
    (r.lineas||[]).forEach(function(l) {
      data.push(['', '  > ' + (l.productoNombre||''), '', '', l.lbs||0, l.cant||0, l.sub||0]);
    });
  });
  var ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:12},{wch:6},{wch:26},{wch:22},{wch:12},{wch:14},{wch:12},{wch:12},{wch:10},{wch:10},{wch:8},{wch:12},{wch:30}];
  return ws;
}

function rpSheetWalmart(desde, hasta) {
  return rpMakeSheet(
    ['Fecha Entrega','Hora','OC','Atlas','Rampa','Estado','# Rubros','Observaciones'],
    rpFilt(DB.pedidosWalmart||[], 'fechaEntrega', desde, hasta).map(function(r) {
      return [r.fechaEntrega||'', r.horaEntrega||'', r.oc||'', r.atlas||'',
              r.rampa||'', r.estado||'', (r.rubros||[]).length, r.obs||''];
    }),
    [14,8,16,16,8,14,10,30]
  );
}

function rpSheetTL(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Hora','Placa','Tipo','Responsable','Observaciones'],
    rpFilt(DB.tl||[], 'fecha', desde, hasta).map(function(r) {
      return [r.fecha||'', r.hora||'', r.placa||'', r.tipo||'', r.resp||'', r.obs||''];
    }),
    [12,8,12,18,22,35]
  );
}

function rpSheetDT(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Hora','Placa','Conductor','Licencia','Cliente','Destino','Carga','Temp C','% Cumpl.','Autorizado','Obs. General'],
    rpFilt(DB.dt||[], 'fecha', desde, hasta).map(function(r) {
      return [r.fecha||'', r.hora||'', r.placa||'', r.conductorNombre||'', r.conductorLic||'',
              r.clienteNombre||'', r.clienteDir||'', r.carga||'', r.temp||'',
              r.pct != null ? r.pct + '%' : '', r.autorizado||'', r.obsGen||''];
    }),
    [12,8,12,22,14,22,28,18,8,10,14,35]
  );
}

function rpSheetAL(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Turno','H. Inicio','H. Salida','Total Empleados','Lavados Completos','% Cumplimiento'],
    rpFilt(DB.al||[], 'fecha', desde, hasta).map(function(r) {
      var pct = r.totalEmp > 0 ? Math.round((r.totalCompletos||0) / r.totalEmp * 100) : 0;
      return [r.fecha||'', r.turno||'', r.hi||'', r.hs||'', r.totalEmp||0, r.totalCompletos||0, pct + '%'];
    }),
    [12,8,10,10,18,18,16]
  );
}

function rpSheetBAS(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Hora','Responsable','Cumplen','No Cumplen','Resultado','Observaciones'],
    rpFilt(DB.bas||[], 'fecha', desde, hasta).map(function(r) {
      return [r.fecha||'', r.hora||'', r.resp||'', r.ok||0, r.fail||0, r.resultado||'', r.obs||''];
    }),
    [12,8,22,10,12,12,35]
  );
}

function rpSheetROD(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Hora','Responsable','Revisadas','En Lugar','Novedades','Total','Resultado','Observaciones'],
    rpFilt(DB.rod||[], 'fecha', desde, hasta).map(function(r) {
      return [r.fecha||'', r.hora||'', r.resp||'', r.totalRev||0, r.totalLugar||0,
              r.totalNov||0, r.total||0, r.resultado||'', r.obs||''];
    }),
    [12,8,22,11,10,12,8,12,35]
  );
}

function rpSheetFUM(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Instalacion','Mes','Semana','Tipo','Responsable','Resultado','Observaciones'],
    rpFilt(DB.fum||[], 'fecha', desde, hasta).map(function(r) {
      return [r.fecha||'', r.inst||'', r.mes||'', r.sem||'', r.tipo||'', r.resp||'', r.res||'', r.obs||''];
    }),
    [12,22,10,10,18,22,14,35]
  );
}

function rpSheetIentradas(desde, hasta) {
  var rows = rpFilt(DB.ientradas || [], 'fecha', desde, hasta);
  return rpMakeSheet(
    ['Fecha','Producto','Origen','Productor','Proveedor','Bultos','Lbs','Kg','Q/lb','Total Q','DUCA','Cotizacion','F.Productor','F.Proveedor','Fuente','Obs'],
    rows.map(function(r) { return [
      r.fecha||'', r.productoNombre||'', r.origen||'',
      r.productorNombre||'', r.proveedorNombre||'',
      r.bultos||0,
      r.lbsTotal||r.lbsBruto||0,
      r.kgTotal||r.kgBruto||0,
      r.costoLb||r.cxlb||0,
      r.costoTotal||r.totalQ||0,
      r.duca||'', r.cotizacionNom||r.cotRef||'',
      r.factProductor||'', r.factProveedor||'',
      r.source||'', r.obs||''
    ]; }),
    [12,28,16,22,22,8,10,10,10,12,14,22,16,16,10,30]
  );
}

function rpSheetIsalidas(desde, hasta) {
  var rows = rpFilt(DB.isalidas || [], 'fecha', desde, hasta);
  var data = [['Fecha','Cliente','Total Lbs','Neto Q','IVA Q','Total c/IVA','Retencion','A Cobrar','Factura','OC','Obs']];
  rows.forEach(function(r) {
    data.push([
      r.fecha||'', r.clienteNombre||'',
      r.totalLbs||0, r.totalNeto||0, r.totalIVA||0,
      r.totalConIVA||r.totalQ||0, r.totalRetencion||0, r.totalACobrar||0,
      r.factura||'', r.oc||'', r.obs||''
    ]);
    (r.lineas||[]).forEach(function(l) {
      data.push(['', '  > '+(l.productoNombre||''), l.totalLbs||l.lbs||0,
                 l.totalNeto||l.neto||0, '', l.totalConIva||l.totalConIVA||0,
                 '', '', '', '', '']);
    });
  });
  var ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:12},{wch:28},{wch:10},{wch:12},{wch:10},{wch:14},{wch:12},{wch:12},{wch:16},{wch:14},{wch:30}];
  return ws;
}

function rpEnsureXLSX(cb) {
  if (window.XLSX) { cb(); return; }
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = cb;
  s.onerror = function() { toast('No se pudo cargar libreria Excel', true); };
  document.head.appendChild(s);
}

function rpDescargar(periodo) {
  var btn = document.getElementById('rp-btn-' + periodo);
  if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }

  rpEnsureXLSX(function() {
    try {
      var rango = rpGetRango(periodo);
      var desde = rango.desde, hasta = rango.hasta, label = rango.label;
      var wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, rpSheetResumen(desde, hasta, label),  'Resumen');
      XLSX.utils.book_append_sheet(wb, rpSheetGastosDiarios(desde, hasta),   'Gastos Diarios');
      XLSX.utils.book_append_sheet(wb, rpSheetMaquila(desde, hasta),         'Maquila Semanal');
      XLSX.utils.book_append_sheet(wb, rpSheetVentasGT(desde, hasta),        'Ventas GT');
      XLSX.utils.book_append_sheet(wb, rpSheetVentasExport(desde, hasta),    'Ventas Export');
      XLSX.utils.book_append_sheet(wb, rpSheetWalmart(desde, hasta),         'Pedidos Walmart');
      XLSX.utils.book_append_sheet(wb, rpSheetTL(desde, hasta),              'Control TL');
      XLSX.utils.book_append_sheet(wb, rpSheetDT(desde, hasta),              'Control DT');
      XLSX.utils.book_append_sheet(wb, rpSheetAL(desde, hasta),              'Control AL');
      XLSX.utils.book_append_sheet(wb, rpSheetBAS(desde, hasta),             'Control BAS');
      XLSX.utils.book_append_sheet(wb, rpSheetROD(desde, hasta),             'Control ROD');
      XLSX.utils.book_append_sheet(wb, rpSheetFUM(desde, hasta),             'Control FUM');
      XLSX.utils.book_append_sheet(wb, rpSheetIentradas(desde, hasta),       'Inv Entradas');
      XLSX.utils.book_append_sheet(wb, rpSheetIsalidas(desde, hasta),        'Inv Salidas');

      if (typeof rpSheetGCConcursos    === 'function') XLSX.utils.book_append_sheet(wb, rpSheetGCConcursos(),    'GC Concursos');
      if (typeof rpSheetGCDescubiertos === 'function') XLSX.utils.book_append_sheet(wb, rpSheetGCDescubiertos(), 'GC Descubiertos');

      var nombre = 'AJUA_BPM_' + label + '_' + new Date().toISOString().slice(0,10) + '.xlsx';
      XLSX.writeFile(wb, nombre);
      toast(nombre + ' descargado');
    } catch(e) {
      toast('Error generando Excel: ' + e.message, true);
      console.error('rpDescargar error:', e);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Descargar'; }
    }
  });
}

window.rpDescargar = rpDescargar;
