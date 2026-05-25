// ═══════════════════════════════════════════════════════
// AJÚA BPM — Restaurar Firebase desde backup local
// Uso: node restore.js
// ═══════════════════════════════════════════════════════

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── CONFIG FIREBASE ──────────────────────────────────
const API_KEY    = 'AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY';
const PROJECT_ID = 'ajuabmp';
const COLLECTION = 'ajua_bpm';
// ────────────────────────────────────────────────────

// ── ARCHIVO BACKUP ───────────────────────────────────
const BACKUP_FILE = 'C:/Users/PC/Downloads/AJUA_BACKUP_COMPLETO_2026-03-17 (1).json';
// ────────────────────────────────────────────────────

console.log('\n╔═══════════════════════════════════════╗');
console.log('║  AJÚA BPM — Restaurar desde Backup   ║');
console.log('╚═══════════════════════════════════════╝\n');

// Leer backup
console.log(`📂 Leyendo: ${BACKUP_FILE}`);
if (!fs.existsSync(BACKUP_FILE)) {
  console.error('❌ Archivo no encontrado:', BACKUP_FILE);
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));

const total = Object.values(db).filter(v => Array.isArray(v)).reduce((s, arr) => s + arr.length, 0);
const summary = Object.entries(db)
  .filter(([,v]) => Array.isArray(v) && v.length > 0)
  .map(([k,v]) => `${k}:${v.length}`)
  .join(' · ');

console.log(`✅ Backup leído: ${total} registros`);
console.log(`   ${summary}\n`);

// Convertir JS → formato Firestore
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean')        return { booleanValue: v };
  if (typeof v === 'number') {
    if (Number.isInteger(v))         return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (typeof v === 'string')         return { stringValue: v };
  if (Array.isArray(v))              return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') {
    const fields = {};
    Object.entries(v).forEach(([k, val]) => fields[k] = toValue(val));
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function toFirestore(obj) {
  const fields = {};
  Object.entries(obj).forEach(([k, v]) => fields[k] = toValue(v));
  return { fields };
}

const body = JSON.stringify(toFirestore(db));

// PATCH a Firestore via REST
function patchDoc(docId) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${docId}?key=${API_KEY}`;

    const options = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    // Parse URL for https.request
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(reqOptions, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(res.statusCode);
        } else {
          let msg = raw.slice(0, 300);
          try { msg = JSON.parse(raw).error?.message || msg; } catch(e) {}
          reject(new Error(`HTTP ${res.statusCode}: ${msg}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('🔄 Escribiendo en ajua_bpm/main ...');
  try {
    await patchDoc('main');
    console.log('✅ ajua_bpm/main restaurado exitosamente');
  } catch(e) {
    console.error('❌ Error escribiendo main:', e.message);
    process.exit(1);
  }

  console.log('🔄 Escribiendo en ajua_bpm/backup2 ...');
  try {
    await patchDoc('backup2');
    console.log('✅ ajua_bpm/backup2 guardado exitosamente');
  } catch(e) {
    console.error('⚠️  Error escribiendo backup2:', e.message);
    // No fatal
  }

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║         RESTAURACIÓN COMPLETA         ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`   📊 Total restaurado: ${total} registros`);
  console.log(`   📋 ${summary}\n`);
}

run().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
