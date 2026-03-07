// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/banco-import/index.js
// Importar movimientos bancarios desde Excel del banco
// ══════════════════════════════════════════════════════════════════

function bancoAutocat(concepto, desc) {
  const t = (concepto + ' ' + (desc || '')).toLowerCase();
  if (/combustible|diesel|diese|gasolina/.test(t))          return 'combustible';
  if (/maga|fito|timbre|bascula|exceso peso|cepo/.test(t))  return 'imp-ministe';
  if (/flete|trasbordo|pipa|renta.*transporte|anticipo flete|termo/.test(t)) return 'flete-local';
  if (/quincena|pago personal|pago semana|pago dia|adelanto|saldo salario|^salario|^salarios|500 maria/.test(t)) return 'per-salario';
  if (/almuerzo|cena|comida|alimento|ceviche|supermercado/.test(t)) return 'alim-almuerzo';
  if (/renta/.test(t))                                       return 'srv-renta';
  if (/agua|utiles|suministro|oficina|app|aluminio/.test(t)) return 'adm-otro';
  if (/cebolla|papa|repollo|zanahoria|arpilla|rollo|etiqueta|abono|trasiego/.test(t)) return 'imp-anticipo';
  if (/servicio|contable/.test(t))                           return 'adm-contabilidad';
  return 'otro';
}

async function bancoImportExcel(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const prog = document.getElementById('banco-import-progress');
  const res  = document.getElementById('banco-import-result');
  if (prog) { prog.style.display='block'; prog.innerHTML='<span style="color:var(--acc)">⏳ Leyendo Excel...</span>'; }
  if (res)  res.style.display='none';

  try {
    if (!window.XLSX) {
      await new Promise((ok,err) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = ok; s.onerror = () => err(new Error('No se pudo cargar SheetJS'));
        document.head.appendChild(s);
      });
    }

    const buf = await file.arrayBuffer();
    const wb  = window.XLSX.read(buf, { type:'array', cellDates:true });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = window.XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });

    // Encontrar fila de headers (buscar "Fecha")
    let headerIdx = -1;
    for (let i = 0; i < Math.min(raw.length, 15); i++) {
      if (raw[i].some(c => String(c).toLowerCase().includes('fecha'))) { headerIdx = i; break; }
    }
    if (headerIdx < 0) { toast('⚠ No se encontró fila de encabezados', true); return; }

    const headers = raw[headerIdx].map(h => String(h||'').toLowerCase());
    const colFecha   = headers.findIndex(h => h.includes('fecha'));
    const colHora    = headers.findIndex(h => h.includes('hora'));
    const colRef     = headers.findIndex(h => h.includes('refer'));
    const colDesc    = headers.findIndex(h => h.includes('descrip'));
    const colConc    = headers.findIndex(h => h.includes('concepto'));
    const colDebito  = headers.findIndex(h => h.includes('debito') || h.includes('débito'));
    const colCredito = headers.findIndex(h => h.includes('credito') || h.includes('crédito'));
    const colSaldo   = headers.findIndex(h => h.includes('saldo'));

    function parseQ(v) { return parseFloat(String(v||'').replace(/Q|,/g,'').trim()) || 0; }
    function fechaISO(f) {
      const p = String(f).split('/');
      return p.length===3 ? `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : String(f);
    }

    if (!DB.gastosDiarios) DB.gastosDiarios = [];
    const existRefs = new Set(DB.gastosDiarios.map(g=>g.ref).filter(Boolean));
    let added=0, skipped=0, credits=0;

    for (let i = headerIdx+1; i < raw.length; i++) {
      const row = raw[i];
      if (!row[colFecha]) continue;
      const fecha   = fechaISO(row[colFecha]);
      const hora    = String(row[colHora]||'00:00');
      const ref     = String(row[colRef]||'');
      const desc    = String(row[colDesc]||'');
      const concepto= String(row[colConc]||'');
      const debito  = parseQ(row[colDebito]);
      const credito = parseQ(row[colCredito]);
      const saldo   = parseQ(row[colSaldo]);

      if (credito > 0) { credits++; continue; } // solo gastos
      if (debito <= 0) continue;

      if (ref && existRefs.has(ref)) { skipped++; continue; }

      const label = (concepto && concepto !== ref) ? concepto : desc.slice(0,50);
      DB.gastosDiarios.unshift({
        id: uid(), fecha, hora,
        desc: label, detalle: desc,
        cat: bancoAutocat(concepto, desc),
        monto: debito, metodo:'transferencia',
        ref, saldo, pagadoPor:'empresa',
        devolucionPendiente:false, devolucionQuien:null, foto:null,
        ts:`${fecha}T${hora}:00.000Z`, fuente:'banco_import'
      });
      added++;
    }

    save();
    try { gdRender(); } catch(e) {}

    if (prog) prog.style.display='none';
    if (res) {
      res.style.display='block';
      res.innerHTML = `
        <div style="background:rgba(0,122,82,.08);border:1.5px solid var(--acc);border-radius:8px;padding:14px;">
          <div style="font-weight:700;color:var(--acc);margin-bottom:8px;">✅ Importación completada</div>
          <div style="font-size:.82rem;">
            <div>✔ ${added} gastos importados</div>
            <div style="color:var(--muted2)">↺ ${skipped} ya existían (por referencia)</div>
            <div style="color:var(--muted2)">⬆ ${credits} créditos ignorados</div>
          </div>
        </div>`;
    }
    toast('✅ ' + added + ' gastos del banco importados');
  } catch(err) {
    if (prog) prog.style.display='none';
    if (res) { res.style.display='block'; res.innerHTML=`<div style="color:var(--danger);font-size:.8rem;">❌ Error: ${err.message}</div>`; }
    toast('⚠ Error al importar', true);
  }
}
