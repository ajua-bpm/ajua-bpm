// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — Importar CSV de Acceso y Lavado de Manos
// Formato: 1 CSV por día, generado por la app o Excel manual
// ══════════════════════════════════════════════════════════════════

function alImportCSV(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text  = e.target.result.replace(/^\uFEFF/, ''); // quitar BOM
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // ── Leer encabezado (fila 3) ────────────────────────────────
      // "Fecha: 2026-03-02","Turno: AM","Hora ingreso: 07:00","Hora salida: 17:00"
      const metaLine = lines[2] || '';
      const metaCols = metaLine.split('","').map(s => s.replace(/^"|"$/g, '').trim());

      const fecha = (metaCols[0] || '').replace('Fecha: ', '').trim();
      const turno = (metaCols[1] || '').replace('Turno: ', '').trim() || 'AM';
      const hi    = (metaCols[2] || '').replace('Hora ingreso: ', '').trim() || '07:00';
      const hs    = (metaCols[3] || '').replace('Hora salida: ', '').trim()  || '17:00';

      if (!fecha || !fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
        toast('⚠ Fecha no válida en CSV — verificá el formato', true); return;
      }

      // ── Detectar columnas de lavado (fila 5, índice 4) ──────────
      const headerLine = lines[4] || '';
      const headers    = headerLine.split('","').map(s => s.replace(/^"|"$/g, '').trim());
      // Cols: No, Nombre, Área, Ingreso, Salida, Lavado 10:00, Lavado 12:00...
      const lavadoCols = headers
        .map((h, i) => ({ i, h }))
        .filter(x => x.h.toLowerCase().startsWith('lavado'));
      const lavHoras = lavadoCols.map(x => x.h.replace(/lavado\s*/i, '').trim());

      // ── Mapa nombre → id real de DB.empleados ───────────────────
      const empMap = {};
      (DB.empleados || []).forEach(e => {
        empMap[e.nombre.trim().toUpperCase()] = { id: e.id, area: e.area || '' };
      });

      // ── Leer empleados (desde fila 6 en adelante) ───────────────
      const empleados = [];
      for (let i = 5; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.startsWith('"Total')) break;

        const cols = line.split('","').map(s => s.replace(/^"|"$/g, '').trim());
        if (cols.length < 5) continue;

        const nombre = (cols[1] || '').trim().toUpperCase();
        if (!nombre) continue;

        const hiEmp = cols[3] || hi;
        const hsEmp = cols[4] || hs;

        // Match con empleado real
        const empReal = empMap[nombre];

        const lavados = lavHoras.map((hora, li) => {
          const val = (cols[5 + li] || '').trim();
          return {
            hora,
            activo: true,
            cumplido: val === '✓' || val === 'si' || val === 'SI' || val === '1',
            valor: val, // ✓, N/A, vacío
          };
        });

        const completo = lavados.filter(l => l.activo).every(l => l.cumplido);

        empleados.push({
          empleadoId: empReal?.id || nombre, // ID real si existe, nombre como fallback
          nombre,
          area: empReal?.area || cols[2] || '',
          hi: hiEmp,
          hs: hsEmp,
          lavados,
          completo,
        });
      }

      if (!empleados.length) { toast('⚠ No se encontraron empleados en el CSV', true); return; }

      // ── Verificar duplicado por fecha+turno ──────────────────────
      const yaExiste = (DB.al || []).find(r => r.fecha === fecha && (r.turno || 'AM') === turno);
      if (yaExiste) {
        if (!confirm(`Ya existe un registro del ${fecha} turno ${turno}.\n¿Sobreescribir?`)) return;
        DB.al = DB.al.filter(r => !(r.fecha === fecha && (r.turno || 'AM') === turno));
      }

      const lavActivos = lavHoras.map(h => ({ hora: h, activo: true }));
      const totalCompletos = empleados.filter(e => e.completo).length;

      DB.al.unshift({
        id: uid(),
        ts: now(),
        fecha, turno, hi, hs,
        empleados,
        totalEmp: empleados.length,
        totalCompletos,
        lavActivos,
        fuente: 'csv_import',
      });

      save();
      renderAL();

      // Feedback
      const noMatch = empleados.filter(e => !empMap[e.nombre]).map(e => e.nombre);
      let msg = `✅ ${fecha} Turno ${turno} — ${empleados.length} empleados importados`;
      if (noMatch.length) {
        msg += `. ⚠ ${noMatch.length} no encontrados en empleados: ${noMatch.join(', ')}`;
        toast(msg, true);
      } else {
        toast(msg);
      }

    } catch(err) {
      toast('⚠ Error al leer CSV: ' + err.message, true);
      console.error(err);
    }
  };
  reader.readAsText(file, 'UTF-8');
}
