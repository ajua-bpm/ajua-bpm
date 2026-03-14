// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — Migración base64 → Firebase Storage (build-85)
//
// USO (una sola vez desde consola F12):
//   await migrateDocsToStorage()
//
// Qué migra:
//   DB.pedidosWalmart[].albaranDoc  → pedidos/{id}/albaranDoc.{ext}
//   DB.pedidosWalmart[].rechazoDoc  → pedidos/{id}/rechazoDoc.{ext}
//   DB.pedidosWalmart[].oc          → pedidos/{id}/oc.{ext}  (si es base64)
//   DB.gastosDiarios[].foto         → gastos/{id}/foto.{ext}
//
// Al terminar llama save() UNA sola vez si hubo cambios.
// Los campos ya migrados (URL https://...) se saltan automáticamente.
// ═══════════════════════════════════════════════════════════════════

async function migrateDocsToStorage() {
  // ── Prerequisitos ──────────────────────────────────────────────
  if (!window._fbStorage) {
    console.error('❌ Firebase Storage no inicializado. Recarga la página e intenta de nuevo.');
    return;
  }
  if (!window._fbStorageRef || !window._fbUploadBytes || !window._fbGetDownloadURL) {
    console.error('❌ Funciones Storage no disponibles en window.');
    return;
  }
  if (typeof DB === 'undefined') {
    console.error('❌ DB no disponible.');
    return;
  }

  var storage     = window._fbStorage;
  var storageRef  = window._fbStorageRef;
  var uploadBytes = window._fbUploadBytes;
  var getDownURL  = window._fbGetDownloadURL;

  var total    = 0;
  var migrated = 0;
  var skipped  = 0;
  var errors   = 0;
  var changed  = false;

  console.log('🚀 Iniciando migración base64 → Firebase Storage...');

  // ── Helpers ────────────────────────────────────────────────────
  function isBase64(val) {
    return typeof val === 'string' && val.startsWith('data:');
  }

  function getExt(dataUrl) {
    if (!dataUrl) return 'bin';
    if (dataUrl.indexOf('image/jpeg') >= 0 || dataUrl.indexOf('image/jpg') >= 0) return 'jpg';
    if (dataUrl.indexOf('image/png')  >= 0) return 'png';
    if (dataUrl.indexOf('image/webp') >= 0) return 'webp';
    if (dataUrl.indexOf('application/pdf') >= 0) return 'pdf';
    if (dataUrl.indexOf('image/') >= 0) return 'jpg';
    return 'bin';
  }

  async function uploadBase64(path, dataUrl) {
    // fetch(dataUrl) convierte base64 → Blob sin depender de atob
    var resp = await fetch(dataUrl);
    var blob = await resp.blob();
    var ref  = storageRef(storage, path);
    await uploadBytes(ref, blob);
    return getDownURL(ref);
  }

  async function migrarCampo(obj, campo, pathPrefix) {
    if (!isBase64(obj[campo])) {
      if (obj[campo]) skipped++;
      return;
    }
    total++;
    var ext  = getExt(obj[campo]);
    var path = pathPrefix + '/' + campo + '.' + ext;
    console.log('  ⬆ ' + path + ' (' + Math.round(obj[campo].length / 1024) + ' KB)...');
    try {
      var url   = await uploadBase64(path, obj[campo]);
      obj[campo] = url;
      migrated++;
      changed = true;
      console.log('  ✅ OK → ' + url.substring(0, 80) + '...');
    } catch(e) {
      errors++;
      console.error('  ❌ Error en ' + path + ':', e.message);
    }
  }

  // ── 1. pedidosWalmart ──────────────────────────────────────────
  var pedidos = DB.pedidosWalmart || [];
  console.log('\n📦 pedidosWalmart: ' + pedidos.length + ' registros');
  for (var i = 0; i < pedidos.length; i++) {
    var p = pedidos[i];
    if (!p.id) continue;
    var prefix = 'pedidos/' + p.id;
    await migrarCampo(p, 'albaranDoc', prefix);
    await migrarCampo(p, 'rechazoDoc', prefix);
    // oc: solo si es base64 (también puede ser texto/número de OC)
    await migrarCampo(p, 'oc', prefix);
  }

  // ── 2. gastosDiarios ──────────────────────────────────────────
  var gastos = DB.gastosDiarios || [];
  console.log('\n🧾 gastosDiarios: ' + gastos.length + ' registros');
  for (var j = 0; j < gastos.length; j++) {
    var g = gastos[j];
    if (!g.id) continue;
    await migrarCampo(g, 'foto', 'gastos/' + g.id);
  }

  // ── Resultado ──────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('📊 Resultado migración:');
  console.log('   Subidos:   ' + migrated);
  console.log('   Ya en URL: ' + skipped);
  console.log('   Errores:   ' + errors);
  console.log('   Total b64: ' + total);

  if (changed) {
    console.log('\n💾 Guardando en Firestore (save única vez)...');
    try {
      save();
      console.log('✅ Migración completa — DB actualizada en Firestore');
    } catch(e) {
      console.error('❌ Error en save():', e.message);
      console.warn('⚠ Los cambios están en memoria (DB) pero no se guardaron. Llama save() manualmente.');
    }
  } else {
    console.log('\nℹ Sin archivos base64 encontrados — nada que migrar.');
  }

  return { migrated: migrated, errors: errors, total: total };
}

window.migrateDocsToStorage = migrateDocsToStorage;
console.log('✅ storage-migrate.js cargado — ejecuta: await migrateDocsToStorage()');
