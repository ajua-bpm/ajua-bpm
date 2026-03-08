// ═══════════════════════════════════════════════════════
// AJÚA BPM — Backup local desde Firebase
// Uso: node backup-local.js
// Guarda JSON en: backups/ajua_backup_YYYY-MM-DD_HH-MM.json
// ═══════════════════════════════════════════════════════

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── CONFIG FIREBASE ──────────────────────────────────
const API_KEY    = 'AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY';
const PROJECT_ID = 'ajuabmp';
const COLLECTION = 'ajua_bpm';
const DOC_ID     = 'main';
// ────────────────────────────────────────────────────

const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

const today = new Date().toISOString().slice(0, 10);
const hora  = new Date().toLocaleTimeString('es-GT', {hour:'2-digit', minute:'2-digit'}).replace(':', '-').replace(' ', '');
const outFile = path.join(BACKUP_DIR, `ajua_backup_${today}_${hora}.json`);

// Firestore REST API con API Key
const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${DOC_ID}?key=${API_KEY}`;

console.log('\n╔═══════════════════════════════════════╗');
console.log('║   AJÚA BPM — Backup Local Firebase   ║');
console.log('╚═══════════════════════════════════════╝\n');
console.log(`🔄 Conectando a Firebase (${PROJECT_ID})...`);

https.get(url, (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`❌ Error HTTP ${res.statusCode}`);
      try { console.error(JSON.parse(raw).error?.message || raw.slice(0,200)); } catch(e) { console.error(raw.slice(0,200)); }
      process.exit(1);
    }

    const firestoreDoc = JSON.parse(raw);
    const db = parseFirestore(firestoreDoc.fields || {});

    const total = Object.values(db).filter(v => Array.isArray(v)).reduce((s, arr) => s + arr.length, 0);
    const summary = Object.entries(db)
      .filter(([,v]) => Array.isArray(v) && v.length > 0)
      .map(([k,v]) => `${k}:${v.length}`)
      .join(' · ');

    fs.writeFileSync(outFile, JSON.stringify(db, null, 2), 'utf-8');

    console.log(`✅ BACKUP EXITOSO`);
    console.log(`   📁 ${outFile}`);
    console.log(`   📊 Total: ${total} registros`);
    console.log(`   📋 ${summary}\n`);

    // Mantener solo últimos 30
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('ajua_backup_') && f.endsWith('.json'))
      .sort();
    if (files.length > 30) {
      files.slice(0, files.length - 30).forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
        console.log(`🗑️  Eliminado: ${f}`);
      });
    }
  });
}).on('error', err => {
  console.error('❌ Error de red:', err.message);
  process.exit(1);
});

function parseValue(val) {
  if ('stringValue'    in val) return val.stringValue;
  if ('integerValue'   in val) return parseInt(val.integerValue);
  if ('doubleValue'    in val) return val.doubleValue;
  if ('booleanValue'   in val) return val.booleanValue;
  if ('nullValue'      in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue'     in val) return (val.arrayValue.values || []).map(parseValue);
  if ('mapValue'       in val) {
    const out = {};
    Object.entries(val.mapValue.fields || {}).forEach(([k,v]) => out[k] = parseValue(v));
    return out;
  }
  return null;
}

function parseFirestore(fields) {
  const out = {};
  Object.entries(fields).forEach(([k,v]) => out[k] = parseValue(v));
  return out;
}
