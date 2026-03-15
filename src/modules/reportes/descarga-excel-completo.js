// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — Exportar Excel Completo (build-87)
// Genera AJUA_BPM_YYYY-MM-DD.xlsx con todas las hojas del sistema
// Llamar: rpExportarCompleto()
// ═══════════════════════════════════════════════════════════════════

// ── Helper: lunes de la semana de una fecha ISO ────────────────────
function rpXSemana(fecha) {
  if (!fecha) return '';
  var d = new Date(fecha + 'T00:00:00');
  var day = d.getDay();
  var diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function rpXSheet(header, rows, widths) {
  var ws = XLSX.utils.aoa_to_sheet([header].concat(rows));
  if (widths) ws['!cols'] = widths.map(function(w) { return { wch: w }; });
  return ws;
}

// ── 1. Gastos Diarios ─────────────────────────────────────────────
function rpXGastosDiarios() {
  var rows = (DB.gastosDiarios || []).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  });
  return rpXSheet(
    ['Fecha','Categoria','Descripcion','Monto Q','Metodo','Pagado Por','Empleado','Ref. Banco'],
    rows.map(function(r) { return [
      r.fecha||'', (typeof rpCatLabel==='function' ? rpCatLabel(r.cat) : r.cat||''),
      r.desc||'', r.monto||0, r.metodo||'', r.pagadoPor||'',
      r.empleadoNombre||r.empleado||'', r.banco_ref||r.bancoRef||''
    ]; }),
    [12,28,40,12,12,16,22,18]
  );
}

// ── 2. Gastos Semanales (maquila — aplanado por fila) ─────────────
function rpXGastosSemanales() {
  var data = [];
  (DB.gastosSemanales || []).slice().sort(function(a,b) {
    return (a.semanaInicio||'') < (b.semanaInicio||'') ? -1 : 1;
  }).forEach(function(s) {
    var semana = s.semanaInicio || '';
    if (s.cuentas && typeof s.cuentas === 'object') {
      Object.values(s.cuentas).forEach(function(grp) {
        if (!grp) return;
        var cat = grp.label || grp.id || '';
        (grp.rows || []).forEach(function(row) {
          data.push([
            semana, cat,
            row.label || row.nombre || '',
            row.monto || row.salarioSemanal || 0,
            s.semanaFin || ''
          ]);
        });
      });
    } else {
      data.push([semana, '', '', s.grandTotal || s.totalGral || 0, s.semanaFin || '']);
    }
  });
  return rpXSheet(
    ['Semana Inicio','Categoria','Descripcion','Monto Q','Semana Fin'],
    data,
    [14,28,40,12,14]
  );
}

// ── 3. Pedidos Walmart (aplanado por rubro) ───────────────────────
function rpXPedidosWalmart() {
  var data = [];
  (DB.pedidosWalmart || []).slice().sort(function(a,b) {
    return (a.fechaEntrega||a.fecha||'') < (b.fechaEntrega||b.fecha||'') ? -1 : 1;
  }).forEach(function(p) {
    var fecha  = p.fechaEntrega || p.fecha || '';
    var estado = p.estado || '';
    var rubros = p.rubros || [];
    if (rubros.length) {
      rubros.forEach(function(r) {
        data.push([
          fecha, r.item||'', r.desc||r.descripcion||'',
          r.cajas||r.cant||0, r.hora||p.horaEntrega||'',
          r.rampa||p.rampa||'', r.dia||r.diaEntrega||p.diaEntrega||'',
          estado
        ]);
      });
    } else {
      data.push([fecha,'','',0, p.horaEntrega||'', p.rampa||'', p.diaEntrega||'', estado]);
    }
  });
  return rpXSheet(
    ['Fecha Entrega','Item','Descripcion','Cajas','Hora','Rampa','Dia Entrega','Estado'],
    data,
    [14,10,38,8,8,8,12,14]
  );
}

// ── 4. Empleados ─────────────────────────────────────────────────
function rpXEmpleados() {
  var rows = (DB.empleados || []).slice().sort(function(a,b) {
    return (a.nombre||'') < (b.nombre||'') ? -1 : 1;
  });
  return rpXSheet(
    ['Nombre','Puesto','Salario Dia Q','Area','Activo'],
    rows.map(function(r) { return [
      r.nombre||'', r.puesto||r.cargo||'',
      r.salarioDia||r.salario||0,
      r.area||'', r.activo === false ? 'No' : 'Si'
    ]; }),
    [28,22,14,18,8]
  );
}

// ── 5. Accesos AL (aplanado por empleado) ────────────────────────
function rpXAccesosAL() {
  var data = [];
  (DB.al || []).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  }).forEach(function(t) {
    var semana = rpXSemana(t.fecha);
    var completos = (t.lavados || []).every(function(l) { return l.cumplido !== false; });
    if (t.empleados && t.empleados.length) {
      t.empleados.forEach(function(e) {
        var emp_ok = (e.lavados || []).every(function(l) { return l.cumplido !== false; });
        data.push([
          semana, t.fecha||'', t.turno||'',
          e.nombre||'', t.hi||'', t.hs||'',
          emp_ok ? 'Si' : 'No'
        ]);
      });
    } else {
      data.push([semana, t.fecha||'', t.turno||'', '', t.hi||'', t.hs||'',
        completos ? 'Si' : 'No']);
    }
  });
  return rpXSheet(
    ['Semana','Fecha','Turno','Empleado','Entrada','Salida','Completo'],
    data,
    [12,12,8,28,8,8,10]
  );
}

// ── 6. Furgones TL ───────────────────────────────────────────────
function rpXFurgonesTL() {
  var rows = (DB.tl || []).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  });
  return rpXSheet(
    ['Semana','Fecha','Placa','Responsable','Hora','Resultado'],
    rows.map(function(r) { return [
      rpXSemana(r.fecha), r.fecha||'', r.placa||'', r.resp||'',
      r.hora||'', r.resultado||r.res||r.tipo||''
    ]; }),
    [12,12,12,22,8,18]
  );
}

// ── 7. Despachos DT ──────────────────────────────────────────────
function rpXDespachosDT() {
  var rows = (DB.dt || []).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  });
  return rpXSheet(
    ['Semana','Fecha','Placa','Conductor','Cliente','Resultado'],
    rows.map(function(r) { return [
      rpXSemana(r.fecha), r.fecha||'', r.placa||'',
      r.conductorNombre||'', r.clienteNombre||'',
      r.resultado||r.res||(r.pct != null ? r.pct+'%' : '')
    ]; }),
    [12,12,12,24,24,14]
  );
}

// ── 8. Básculas BAS ──────────────────────────────────────────────
function rpXBasculasBAS() {
  var rows = (DB.bas || []).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  });
  return rpXSheet(
    ['Semana','Fecha','Responsable','OK','Fallas','Resultado'],
    rows.map(function(r) { return [
      rpXSemana(r.fecha), r.fecha||'', r.resp||'',
      r.ok||0, r.fail||r.fallas||0, r.resultado||r.res||''
    ]; }),
    [12,12,22,8,8,14]
  );
}

// ── 9. Roedores ROD ──────────────────────────────────────────────
function rpXRoedoresROD() {
  var rows = (DB.rod || []).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  });
  return rpXSheet(
    ['Semana','Fecha','Responsable','Trampas','Sin Novedad','Resultado'],
    rows.map(function(r) { return [
      rpXSemana(r.fecha), r.fecha||'', r.resp||'',
      r.totalRev||r.trampas||0,
      r.totalLugar||r.sinNov||(r.total - r.totalNov)||0,
      r.resultado||r.res||''
    ]; }),
    [12,12,22,10,12,14]
  );
}

// ── 10. Fumigación FUM ───────────────────────────────────────────
function rpXFumigacionFUM() {
  var rows = (DB.fum || []).slice().sort(function(a,b) {
    return (a.fecha||'') < (b.fecha||'') ? -1 : 1;
  });
  return rpXSheet(
    ['Semana','Fecha','Empresa','Area / Instalacion','Resultado'],
    rows.map(function(r) { return [
      rpXSemana(r.fecha), r.fecha||'',
      r.empresa||r.resp||'', r.area||r.inst||'',
      r.resultado||r.res||''
    ]; }),
    [12,12,24,28,16]
  );
}

// ── 11. Guatecompras (Concursos + Descubiertos) ──────────────────
function rpXGuatecompras() {
  var data = [];

  // Concursos
  (DB.gcConcursos || []).forEach(function(c) {
    var presentado = c.sePresento != null
      ? (c.sePresento ? 'Si' : 'No')
      : (c.etapa && /present|adjudic|ganado|cotiz/i.test(c.etapa) ? 'Si' : '');
    data.push([
      c.nog||'', c.titulo||'', c.entidad||'',
      c.monto||'', c.fechaCierre||'', c.etapa||'Identificado',
      presentado, 'Concurso'
    ]);
  });

  // Descubiertos
  (DB.gcDescubiertos || []).forEach(function(d) {
    var etapa = d.importado ? 'Importado' : d.descartado ? 'Descartado' : 'Pendiente';
    data.push([
      d.nog||'', d.titulo||'', d.entidad||'',
      d.monto||'', d.fechaCierre||'', etapa,
      '', 'Descubierto'
    ]);
  });

  // Ordenar por fechaCierre
  data.sort(function(a,b) { return (a[4]||'') < (b[4]||'') ? -1 : 1; });

  return rpXSheet(
    ['NOG','Titulo','Entidad','Monto','Fecha Cierre','Etapa','Se Presento','Tipo'],
    data,
    [16,45,32,14,14,16,12,12]
  );
}

// ── 12. Resumen ──────────────────────────────────────────────────
function rpXResumen() {
  var modulos = [
    ['Gastos Diarios',   (DB.gastosDiarios||[]).length,
      (DB.gastosDiarios||[]).reduce(function(s,r){return s+(r.monto||0);},0)],
    ['Gastos Semanales', (DB.gastosSemanales||[]).length, ''],
    ['Pedidos Walmart',  (DB.pedidosWalmart||[]).length, ''],
    ['Empleados',        (DB.empleados||[]).length, ''],
    ['Accesos AL',       (DB.al||[]).length, ''],
    ['Furgones TL',      (DB.tl||[]).length, ''],
    ['Despachos DT',     (DB.dt||[]).length, ''],
    ['Basculas BAS',     (DB.bas||[]).length, ''],
    ['Roedores ROD',     (DB.rod||[]).length, ''],
    ['Fumigacion FUM',   (DB.fum||[]).length, ''],
    ['GC Concursos',     (DB.gcConcursos||[]).length, ''],
    ['GC Descubiertos',  (DB.gcDescubiertos||[]).length, ''],
  ];
  var totalRecs = modulos.reduce(function(s,r){return s+(r[1]||0);},0);
  modulos.push(['TOTAL', totalRecs, '']);

  var ws = XLSX.utils.aoa_to_sheet(
    [['AJUA BPM — Exportacion Completa'],
     ['Fecha: ' + new Date().toISOString().slice(0,10)],
     [],
     ['Modulo','Registros','Total Q']
    ].concat(modulos)
  );
  ws['!cols'] = [{wch:28},{wch:12},{wch:16}];
  return ws;
}

// ── Función principal ─────────────────────────────────────────────
function rpExportarCompleto() {
  var btn = document.getElementById('btn-exportar-completo');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }

  (typeof rpEnsureXLSX === 'function' ? rpEnsureXLSX : function(cb){
    if (window.XLSX) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  })(function() {
    try {
      var wb   = XLSX.utils.book_new();
      var hoy  = new Date().toISOString().slice(0,10);

      XLSX.utils.book_append_sheet(wb, rpXResumen(),           '📊 Resumen');
      XLSX.utils.book_append_sheet(wb, rpXGastosDiarios(),     '💸 Gastos Diarios');
      XLSX.utils.book_append_sheet(wb, rpXGastosSemanales(),   '📅 Gastos Semanales');
      XLSX.utils.book_append_sheet(wb, rpXPedidosWalmart(),    '🛒 Pedidos Walmart');
      XLSX.utils.book_append_sheet(wb, rpXEmpleados(),         '👷 Empleados');
      XLSX.utils.book_append_sheet(wb, rpXAccesosAL(),         '🙌 Accesos AL');
      XLSX.utils.book_append_sheet(wb, rpXFurgonesTL(),        '🚛 Furgones TL');
      XLSX.utils.book_append_sheet(wb, rpXDespachosDT(),       '📦 Despachos DT');
      XLSX.utils.book_append_sheet(wb, rpXBasculasBAS(),       '⚖️ Basculas BAS');
      XLSX.utils.book_append_sheet(wb, rpXRoedoresROD(),       '🐭 Roedores ROD');
      XLSX.utils.book_append_sheet(wb, rpXFumigacionFUM(),     '🧪 Fumigacion FUM');
      XLSX.utils.book_append_sheet(wb, rpXGuatecompras(),      '📋 Guatecompras');

      XLSX.writeFile(wb, 'AJUA_BPM_' + hoy + '.xlsx');
      toast('✅ AJUA_BPM_' + hoy + '.xlsx descargado');
    } catch(e) {
      toast('❌ Error generando Excel: ' + e.message, true);
      console.error('rpExportarCompleto error:', e);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📊 Exportar Excel'; }
    }
  });
}

window.rpExportarCompleto = rpExportarCompleto;
console.log('✅ descarga-excel-completo.js cargado');
