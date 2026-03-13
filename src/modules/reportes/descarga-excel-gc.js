// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — Descarga Excel: hojas Guatecompras (build-82)
// Módulo separado — no afecta el reporte base si no está cargado
// ═══════════════════════════════════════════════════════════════════

function rpSheetGCConcursos() {
  var rows = DB.gcConcursos || [];
  // Ordenar por fechaCierre desc
  rows = rows.slice().sort(function(a, b) {
    return (b.fechaCierre || '') < (a.fechaCierre || '') ? -1 : 1;
  });
  var data = [['NOG', 'Etapa', 'Titulo', 'Entidad', 'Monto', 'Modalidad', 'F. Publicacion', 'F. Cierre', 'Responsable', 'Renglones', 'Notas']];
  rows.forEach(function(c) {
    var rengs = (c.renglones || []).map(function(r) {
      return (r._desc || r.desc || r.nombre || '') + (r._cant ? ' x' + r._cant : '');
    }).filter(Boolean).join(' | ');
    data.push([
      c.nog || '',
      c.etapa || 'Identificado',
      c.titulo || '',
      c.entidad || '',
      c.monto || '',
      c.modalidad || '',
      c.fechaPub || '',
      c.fechaCierre || '',
      c.resp || '',
      rengs,
      c.notas || ''
    ]);
  });
  var ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:16},{wch:16},{wch:45},{wch:32},{wch:14},{wch:14},{wch:14},{wch:14},{wch:18},{wch:40},{wch:35}];
  return ws;
}

function rpSheetGCDescubiertos() {
  var rows = DB.gcDescubiertos || [];
  // Ordenar: pendientes primero, luego importados, luego descartados; dentro de cada grupo por fechaCierre
  rows = rows.slice().sort(function(a, b) {
    var pa = a.importado ? 2 : a.descartado ? 3 : 1;
    var pb = b.importado ? 2 : b.descartado ? 3 : 1;
    if (pa !== pb) return pa - pb;
    return (a.fechaCierre || '9999') < (b.fechaCierre || '9999') ? -1 : 1;
  });
  var data = [['Estado', 'NOG', 'Titulo', 'Entidad', 'Monto', 'Modalidad', 'F. Publicacion', 'F. Cierre', 'Keyword', 'URL']];
  rows.forEach(function(d) {
    var estado = d.importado ? 'Importado' : d.descartado ? 'Descartado' : 'Pendiente';
    data.push([
      estado,
      d.nog || '',
      d.titulo || '',
      d.entidad || '',
      d.monto || '',
      d.modalidad || '',
      d.fechaPub || '',
      d.fechaCierre || '',
      d.keyword || '',
      d.url || ''
    ]);
  });
  var ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:12},{wch:16},{wch:45},{wch:32},{wch:14},{wch:14},{wch:14},{wch:14},{wch:18},{wch:45}];
  return ws;
}

window.rpSheetGCConcursos   = rpSheetGCConcursos;
window.rpSheetGCDescubiertos = rpSheetGCDescubiertos;
