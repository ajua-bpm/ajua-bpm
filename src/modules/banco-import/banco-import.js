// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — Módulo Banco Import
// Importa movimientos bancarios (Excel BAC/Banrural) a Gastos Diarios
// ═══════════════════════════════════════════════════════════════════

// ── Auto-categorización por keywords del concepto ────────────────
const BI_CAT_RULES = [
  { keys:['combustible','comb','gasolina','diesel'],      cat:'combustible'       },
  { keys:['salario','jornal','sueldo','quincena'],         cat:'per-salario'       },
  { keys:['anticipo bodega','anticipo proveedor'],         cat:'imp-anticipo'      },
  { keys:['anticipo'],                                     cat:'per-anticipo'      },
  { keys:['almuerzo','comida','alimento','desayuno','cafe','refaccion'], cat:'alim-almuerzo' },
  { keys:['flete','transporte'],                           cat:'flete-local'       },
  { keys:['maga','sanidad','ministerio'],                  cat:'imp-ministe'       },
  { keys:['aduana','agente aduanal','servicios aduana'],   cat:'imp-agente'        },
  { keys:['arancel','dai'],                                cat:'imp-aranceles'     },
  { keys:['basura','recoleccion'],                         cat:'limp-basura'       },
  { keys:['cambio','cambista','disol','gabriel hernandez'],'cat':'fin-cambio'      },
  { keys:['limpieza','quimicos','cloro'],                  cat:'limp-productos'    },
  { keys:['colegio','escuela','educacion'],                cat:'adm-otro'          },
  { keys:['tarjeta salud','manipulacion alimentos','carnet'],cat:'adm-otro'        },
  { keys:['fumig'],                                        cat:'limp-fumig'        },
  { keys:['seguro','seguros'],                             cat:'adm-seguros'       },
  { keys:['renta','alquiler'],                             cat:'srv-renta'         },
  { keys:['agua'],                                         cat:'srv-agua'          },
  { keys:['luz','electricidad','energia'],                 cat:'srv-luz'           },
  { keys:['mantenimiento','reparacion'],                   cat:'mant-reparaciones' },
  { keys:['devolucion'],                                   cat:'gastos-varios'     },
  { keys:['pago dia','jornalero'],                         cat:'per-salario'       },
  { keys:['stretch','film','etiqueta','caja','bolsa','zuncho','pallet'], cat:'emp-otro' },
  { keys:['herramienta'],                                  cat:'mant-herramientas' },
  { keys:['legal','legales','notarial'],                   cat:'adm-contabilidad'  },
  { keys:['publicidad'],                                   cat:'com-publicidad'    },
];

function biAutocat(concepto, descripcion) {
  const txt = ((concepto || '') + ' ' + (descripcion || '')).toLowerCase();
  for (const rule of BI_CAT_RULES) {
    if (rule.keys.some(k => txt.includes(k))) return rule.cat;
  }
  return 'gastos-varios';
}

// ── Parsear monto "Q 200.00" → 200 ───────────────────────────────
function biParseMonto(s) {
  if (!s) return 0;
  return parseFloat(String(s).replace(/Q\s*/,'').replace(/,/g,'').trim()) || 0;
}

// ── Parsear fecha "12/03/2026" → "2026-03-12" ────────────────────
function biParseDate(s) {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = String(s).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return '';
}

// ── Estado local del módulo ───────────────────────────────────────
var _biMovimientos = [];   // rows parseados del Excel
var _biSeleccionados = {}; // id → true/false

// ── Cargar SheetJS si no está ─────────────────────────────────────
function biEnsureXLSX(cb) {
  if (window.XLSX) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = cb;
  s.onerror = () => toast('⚠ No se pudo cargar lector Excel', true);
  document.head.appendChild(s);
}

// ── Abrir panel de importación ────────────────────────────────────
function biAbrir() {
  let modal = document.getElementById('bi-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bi-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9100;display:flex;align-items:center;justify-content:center;padding:12px;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:14px;width:min(900px,98vw);max-height:92vh;overflow-y:auto;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.3);">
        <div style="background:var(--forest,#1B5E20);color:#fff;padding:16px 20px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:800;font-size:1rem;">🏦 Importar Movimientos Bancarios</div>
            <div style="font-size:.72rem;opacity:.8;">Cargá el Excel del banco y asigná categorías — se agregan a Gastos Diarios</div>
          </div>
          <button onclick="biCerrar()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1.1rem;line-height:1;">✕</button>
        </div>
        <div id="bi-cuerpo" style="padding:20px;"></div>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  biRenderCuerpo();
}

function biCerrar() {
  const m = document.getElementById('bi-modal');
  if (m) m.style.display = 'none';
}

// ── Render principal del panel ────────────────────────────────────
function biRenderCuerpo() {
  const c = document.getElementById('bi-cuerpo');
  if (!c) return;

  if (!_biMovimientos.length) {
    // Pantalla de carga de archivo
    c.innerHTML = `
      <div style="text-align:center;padding:30px 20px;">
        <div style="font-size:3rem;margin-bottom:12px;">📂</div>
        <div style="font-weight:700;font-size:1rem;color:var(--forest,#1B5E20);margin-bottom:8px;">Cargá el Excel del banco</div>
        <div style="font-size:.78rem;color:#666;margin-bottom:20px;max-width:400px;margin-left:auto;margin-right:auto;">
          Exportá los movimientos desde la banca en línea en formato <strong>.xlsx</strong><br>
          Soporta BAC Guatemala (formato estándar con encabezados en fila 9)
        </div>
        <label style="display:inline-block;background:var(--forest,#1B5E20);color:#fff;padding:10px 24px;border-radius:8px;cursor:pointer;font-weight:700;font-size:.88rem;">
          📂 Seleccionar archivo Excel
          <input type="file" accept=".xlsx,.xls" style="display:none;" onchange="biCargarExcel(this)">
        </label>
        <div style="margin-top:16px;font-size:.72rem;color:#999;">Solo se leen los débitos (egresos). Los créditos (ingresos) se omiten.</div>
      </div>`;
    return;
  }

  // Pantalla de revisión/asignación
  const pend = _biMovimientos.filter(m => !m._importado);
  const selCount = Object.values(_biSeleccionados).filter(Boolean).length;
  const totalSel = _biMovimientos
    .filter(m => _biSeleccionados[m._id] && !m._importado)
    .reduce((s,m) => s + m.monto, 0);

  c.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
      <div style="font-size:.82rem;color:#555;">
        <strong>${_biMovimientos.length}</strong> movimientos detectados &nbsp;·&nbsp;
        <strong style="color:var(--forest,#1B5E20);">${pend.length}</strong> sin importar
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <label style="background:#F5F5F5;border:1px solid #DDD;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:.78rem;font-weight:600;">
          📂 Cargar otro Excel
          <input type="file" accept=".xlsx,.xls" style="display:none;" onchange="biCargarExcel(this)">
        </label>
        <button onclick="biSelAll(true)" style="border:1px solid #1565C0;background:#fff;color:#1565C0;padding:6px 12px;border-radius:6px;font-size:.78rem;cursor:pointer;">☑ Todos</button>
        <button onclick="biSelAll(false)" style="border:1px solid #999;background:#fff;color:#555;padding:6px 12px;border-radius:6px;font-size:.78rem;cursor:pointer;">☐ Ninguno</button>
        <button onclick="biImportarSeleccionados()" ${selCount===0?'disabled':''} style="background:${selCount===0?'#CCC':'var(--forest,#1B5E20)'};color:#fff;border:none;padding:6px 16px;border-radius:6px;font-size:.82rem;font-weight:700;cursor:${selCount===0?'default':'pointer'};">
          ⬇ Importar ${selCount} seleccionados (Q ${totalSel.toFixed(2)})
        </button>
      </div>
    </div>

    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:.78rem;">
        <thead>
          <tr style="background:var(--forest,#1B5E20);color:#fff;">
            <th style="padding:8px 6px;text-align:center;width:32px;"><input type="checkbox" onchange="biSelAll(this.checked)" id="bi-chk-all"></th>
            <th style="padding:8px 6px;text-align:left;">Fecha</th>
            <th style="padding:8px 6px;text-align:left;">Concepto (banco)</th>
            <th style="padding:8px 6px;text-align:right;">Débito Q</th>
            <th style="padding:8px 6px;text-align:left;min-width:180px;">Categoría BPM</th>
            <th style="padding:8px 6px;text-align:left;min-width:140px;">Descripción</th>
            <th style="padding:8px 6px;text-align:center;width:60px;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${_biMovimientos.map(m => biRowHtml(m)).join('')}
        </tbody>
      </table>
    </div>

    <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;">
      <button onclick="biCerrar()" style="border:1px solid #DDD;background:#fff;color:#555;padding:8px 18px;border-radius:6px;font-size:.82rem;cursor:pointer;">Cerrar</button>
      <button onclick="biImportarSeleccionados()" ${selCount===0?'disabled':''} style="background:${selCount===0?'#CCC':'var(--forest,#1B5E20)'};color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:.85rem;font-weight:700;cursor:${selCount===0?'default':'pointer'};">
        ⬇ Importar ${selCount} a Gastos Diarios
      </button>
    </div>`;

  // Actualizar checkbox "todos"
  const chkAll = document.getElementById('bi-chk-all');
  if (chkAll) chkAll.checked = selCount > 0 && selCount === pend.length;
}

function biRowHtml(m) {
  const catLabel = (GD_CATS && GD_CATS[m.cat]) ? `${GD_CATS[m.cat].ico} ${GD_CATS[m.cat].label}` : m.cat;
  const importado = m._importado;
  const bg = importado ? '#F0FFF4' : (_biSeleccionados[m._id] ? '#EFF6FF' : '#fff');
  const catOpts = buildCatOptions(m.cat);

  return `<tr style="background:${bg};border-bottom:1px solid #EEF2F7;" id="bi-row-${m._id}">
    <td style="padding:7px 6px;text-align:center;">
      ${importado
        ? '<span style="color:#2E7D32;font-size:1rem;">✅</span>'
        : `<input type="checkbox" ${_biSeleccionados[m._id]?'checked':''} onchange="biToggleSel('${m._id}',this.checked)">`}
    </td>
    <td style="padding:7px 6px;white-space:nowrap;color:#37474F;">${m.fecha}</td>
    <td style="padding:7px 6px;max-width:220px;">
      <div style="font-weight:600;color:#1A237E;">${m.concepto||'—'}</div>
      <div style="font-size:.68rem;color:#888;margin-top:2px;">${(m.descripcion||'').slice(0,60)}</div>
    </td>
    <td style="padding:7px 6px;text-align:right;font-weight:700;color:#C62828;">Q ${m.monto.toFixed(2)}</td>
    <td style="padding:7px 6px;">
      ${importado
        ? `<span style="font-size:.75rem;color:#555;">${catLabel}</span>`
        : `<select onchange="biCambiarCat('${m._id}',this.value)" style="width:100%;padding:4px 6px;border:1px solid #DDD;border-radius:4px;font-size:.72rem;">${catOpts}</select>`}
    </td>
    <td style="padding:7px 6px;">
      ${importado
        ? `<span style="font-size:.72rem;color:#555;">${m.desc||''}</span>`
        : `<input type="text" value="${(m.desc||'').replace(/"/g,'&quot;')}" oninput="biCambiarDesc('${m._id}',this.value)" style="width:100%;padding:4px 6px;border:1px solid #DDD;border-radius:4px;font-size:.72rem;" placeholder="Descripción...">`}
    </td>
    <td style="padding:7px 6px;text-align:center;">
      ${importado
        ? '<span style="font-size:.68rem;color:#2E7D32;font-weight:700;">Importado</span>'
        : '<span style="font-size:.68rem;color:#999;">Pendiente</span>'}
    </td>
  </tr>`;
}

function buildCatOptions(selected) {
  if (typeof GD_CATS === 'undefined') return `<option value="${selected}">${selected}</option>`;
  const grupos = {};
  for (const [k,v] of Object.entries(GD_CATS)) {
    if (!grupos[v.grupo]) grupos[v.grupo] = [];
    grupos[v.grupo].push({k, label:`${v.ico} ${v.label}`});
  }
  let html = '';
  for (const [g, items] of Object.entries(grupos)) {
    html += `<optgroup label="${g}">`;
    for (const {k, label} of items) {
      html += `<option value="${k}" ${k===selected?'selected':''}>${label}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

// ── Interacción de tabla ──────────────────────────────────────────
function biToggleSel(id, checked) {
  _biSeleccionados[id] = checked;
  biRenderCuerpo();
}

function biSelAll(checked) {
  _biMovimientos.forEach(m => {
    if (!m._importado) _biSeleccionados[m._id] = checked;
  });
  biRenderCuerpo();
}

function biCambiarCat(id, val) {
  const m = _biMovimientos.find(x => x._id === id);
  if (m) m.cat = val;
}

function biCambiarDesc(id, val) {
  const m = _biMovimientos.find(x => x._id === id);
  if (m) m.desc = val;
}

// ── Parsear Excel del banco ───────────────────────────────────────
function biCargarExcel(input) {
  const file = input.files[0];
  if (!file) return;

  const c = document.getElementById('bi-cuerpo');
  if (c) c.innerHTML = `<div style="text-align:center;padding:40px;color:#666;">⏳ Leyendo Excel...</div>`;

  biEnsureXLSX(() => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

        // Detectar fila de headers (busca "Fecha" o "Descripcion")
        let headerRow = -1;
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const r = rows[i].map(v => String(v||'').toLowerCase());
          if (r.some(v => v.includes('fecha')) && r.some(v => v.includes('debito') || v.includes('débito') || v.includes('descripci'))) {
            headerRow = i;
            break;
          }
        }
        if (headerRow < 0) { toast('⚠ No se encontró la fila de encabezados', true); biRenderCuerpo(); return; }

        const headers = rows[headerRow].map(v => String(v||'').toLowerCase().trim());
        const iDate   = headers.findIndex(h => h.includes('fecha'));
        const iDesc   = headers.findIndex(h => h.includes('descripci'));
        const iConc   = headers.findIndex(h => h.includes('concepto'));
        const iDebit  = headers.findIndex(h => h.includes('debito') || h.includes('débito'));
        const iRef    = headers.findIndex(h => h.includes('referenci'));

        const movs = [];
        for (let i = headerRow + 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r.some(v => v !== '')) continue;
          const debit = biParseMonto(iDebit >= 0 ? r[iDebit] : '');
          if (!debit || debit <= 0) continue; // Solo débitos (egresos)

          const concepto = iConc >= 0 ? String(r[iConc]||'').trim() : '';
          const desc_raw = iDesc >= 0 ? String(r[iDesc]||'').trim() : '';
          const fecha    = biParseDate(iDate >= 0 ? String(r[iDate]||'') : '');
          const ref      = iRef >= 0 ? String(r[iRef]||'').trim() : '';

          const _id = `bi_${fecha}_${ref||i}_${debit}`.replace(/\s/g,'_');

          // Verificar si ya fue importado antes (por referencia)
          const yaImportado = ref && DB.gastosDiarios && DB.gastosDiarios.some(g => g.banco_ref === ref);

          movs.push({
            _id,
            fecha,
            descripcion: desc_raw,
            concepto,
            monto: debit,
            ref,
            cat:  biAutocat(concepto, desc_raw),
            desc: concepto || desc_raw.slice(0,40),
            _importado: yaImportado,
          });
        }

        if (!movs.length) { toast('⚠ No se encontraron débitos en el archivo', true); biRenderCuerpo(); return; }

        _biMovimientos = movs;
        // Pre-seleccionar los no importados
        _biSeleccionados = {};
        movs.forEach(m => { if (!m._importado) _biSeleccionados[m._id] = true; });

        toast(`✓ ${movs.length} movimientos detectados`);
        biRenderCuerpo();
      } catch(err) {
        toast('⚠ Error leyendo Excel: ' + err.message, true);
        console.error('biCargarExcel error:', err);
        biRenderCuerpo();
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ── Importar seleccionados a Gastos Diarios ───────────────────────
function biImportarSeleccionados() {
  if (!DB.gastosDiarios) DB.gastosDiarios = [];

  const aImportar = _biMovimientos.filter(m => _biSeleccionados[m._id] && !m._importado);
  if (!aImportar.length) { toast('⚠ No hay movimientos seleccionados', true); return; }

  let importados = 0;
  for (const m of aImportar) {
    if (!m.fecha) { continue; } // Omitir si no hay fecha

    DB.gastosDiarios.unshift({
      id:         uid(),
      ts:         now(),
      fecha:      m.fecha,
      cat:        m.cat,
      monto:      m.monto,
      desc:       m.desc || m.concepto || 'Movimiento bancario',
      metodo:     'banco',
      pagadoPor:  'empresa',
      devolucionPendiente: false,
      banco_ref:  m.ref,   // Referencia del banco para deduplicación
      fuente:     'banco-import',
    });
    m._importado = true;
    importados++;
  }

  save();
  gdRender && gdRender();
  toast(`✓ ${importados} gastos importados desde banco`);
  biRenderCuerpo();
}

// ── Exponer globales ──────────────────────────────────────────────
window.biAbrir               = biAbrir;
window.biCerrar              = biCerrar;
window.biCargarExcel         = biCargarExcel;
window.biToggleSel           = biToggleSel;
window.biSelAll              = biSelAll;
window.biCambiarCat          = biCambiarCat;
window.biCambiarDesc         = biCambiarDesc;
window.biImportarSeleccionados = biImportarSeleccionados;
