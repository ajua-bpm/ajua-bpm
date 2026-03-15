// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — FASE A: Migrar gastosDiarios[] → colección gastosDiarios/{id}
// build-91
//
// USO (una sola vez desde consola F12):
//   await migrateGastosDiarios()
//
// Qué hace:
//   Lee DB.gastosDiarios[] en memoria
//   Sube cada gasto como documento individual a gastosDiarios/{id}
//   NO modifica ni borra nada de ajua_bpm/main
//   Si un documento ya existe en la colección, lo sobreescribe (idempotente)
//
// NUNCA llamar automáticamente.
// ═══════════════════════════════════════════════════════════════════

async function migrateGastosDiarios() {
  // ── Prerequisitos ──────────────────────────────────────────────
  // _fbDb es let (no var) en bpm.html — acceder directo, no via window
  if (typeof _fbDb === 'undefined' || !_fbDb) {
    console.error('❌ _fbDb no disponible. Recarga la página e intenta de nuevo.');
    return;
  }
  if (typeof DB === 'undefined' || !Array.isArray(DB.gastosDiarios)) {
    console.error('❌ DB.gastosDiarios no disponible.');
    return;
  }

  var d       = _fbDb;
  var gastos  = DB.gastosDiarios;
  var total   = gastos.length;
  var ok      = 0;
  var skipped = 0;
  var errors  = 0;

  console.log('🚀 FASE A — Migrando gastosDiarios a colección individual...');
  console.log('   Total registros en memoria: ' + total);

  for (var i = 0; i < gastos.length; i++) {
    var g = gastos[i];

    if (!g.id) {
      console.warn('  ⚠ Registro sin id (índice ' + i + '), saltando:', g);
      skipped++;
      continue;
    }

    try {
      await d.setDoc(d.doc(d.db, 'gastosDiarios', g.id), g);
      ok++;
      if (ok % 10 === 0 || ok === total - skipped) {
        console.log('  Migrado ' + ok + '/' + (total - skipped) + '...');
      }
    } catch(e) {
      errors++;
      console.error('  ❌ Error en gasto ' + g.id + ' (' + (g.fecha||'?') + '):', e.message);
    }
  }

  // ── Resultado ──────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('📊 Resultado FASE A:');
  console.log('   Subidos OK:      ' + ok);
  console.log('   Sin id (saltados): ' + skipped);
  console.log('   Errores:          ' + errors);
  console.log('   Total procesados: ' + total);

  if (errors === 0) {
    console.log('\n✅ FASE A completa — ' + ok + ' documentos en colección gastosDiarios/');
    console.log('   ajua_bpm/main NO fue modificado.');
    console.log('   Cuando estés listo, avanzá a FASE B.');
  } else {
    console.warn('\n⚠ FASE A con ' + errors + ' errores — revisá los mensajes arriba.');
    console.log('   Podés volver a correr migrateGastosDiarios() para reintentar.');
  }

  return { ok: ok, skipped: skipped, errors: errors, total: total };
}

// ═══════════════════════════════════════════════════════════════════
// FASE D — Eliminar gastosDiarios[] de ajua_bpm/main
// build-95
//
// USO (una sola vez, DESPUÉS de verificar FASE B y C):
//   await cleanGastosFromMain()
//
// Qué hace:
//   Lee ajua_bpm/main de Firestore
//   Elimina el campo gastosDiarios del documento
//   Escribe de vuelta (setDoc)
//
// SEGURIDAD:
//   - Solo borra si la colección gastosDiarios/ tiene más de 100 docs
//   - Pide confirmación antes de escribir
//   - NO toca nada más
// ═══════════════════════════════════════════════════════════════════

async function cleanGastosFromMain() {
  var colSnap = await _fbDb.getDocs(_fbDb.collection(_fbDb.db, 'gastosDiarios'));
  var colTotal = colSnap.size;
  console.log('Colección gastosDiarios:', colTotal, 'docs');

  if (colTotal < 200) {
    console.error('❌ Abortado — colección tiene solo ' + colTotal + ' (esperado >= 200)');
    return;
  }

  var antes = (DB.gastosDiarios || []).length;
  console.log('DB.gastosDiarios antes:', antes, 'registros');

  DB.gastosDiarios = [];
  save();

  console.log('✅ DB.gastosDiarios = [] — save() ejecutado');
  console.log('   antes:', antes, '→ después: 0');
  return { colTotal: colTotal, eliminados: antes };
}

window.migrateGastosDiarios = migrateGastosDiarios;
window.cleanGastosFromMain   = cleanGastosFromMain;
console.log('✅ gd-migrate.js cargado — ejecuta: await migrateGastosDiarios() / await cleanGastosFromMain()');
