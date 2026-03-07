// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/bulk/index.js
// Carga Masiva por Excel — importación de empleados, usuarios,
// conductores, clientes, productos y presentaciones
// Build 50 — Marzo 2026
//
// Dependencias externas:
//   - DB, save()              → core/firebase.js
//   - uid(), now(), toast()   → core/utils.js
//   - renderAll(), renderEmpleados(), renderUsuarios()
//   - renderConductores(), renderIprod(), renderIpres(), renderIcli()
//   - populateAllRespSelects()
//   - AUTH_ALL_MODULES, AUTH_ROLE_DEFAULTS → core/auth.js
//   - window.XLSX (SheetJS) cargado dinámicamente desde CDN
// ══════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// 📊 CARGA MASIVA POR EXCEL
// ════════════════════════════════════════════════════════════════════

function bulkDownloadTemplate(e) {
  e.preventDefault();
  // El archivo Excel está embebido como base64 — se genera dinámicamente
  // redirige a la URL de descarga del archivo subido a GitHub
  const url = '/AJUA_CargaMasiva.xlsx';
  const a = document.createElement('a');
  a.href = url;
  a.download = 'AJUA_CargaMasiva.xlsx';
  a.click();
}

function bulkShowProgress(msg, pct) {
  const el = document.getElementById('bulk-progress');
  el.style.display = 'block';
  el.innerHTML = `
    <div style="font-size:.8rem;margin-bottom:6px;color:var(--acc);">${msg}</div>
    <div style="background:var(--br);border-radius:4px;height:8px;overflow:hidden;">
      <div style="background:var(--acc);height:100%;width:${pct}%;transition:width .3s;"></div>
    </div>`;
}

function bulkShowResult(stats, errors) {
  const el = document.getElementById('bulk-result');
  el.style.display = 'block';
  document.getElementById('bulk-progress').style.display = 'none';

  const rows = Object.entries(stats)
    .map(([k,v]) => `<tr>
      <td style="padding:4px 10px;">${k}</td>
      <td style="padding:4px 10px;text-align:center;font-weight:700;color:var(--acc);">${v.added}</td>
      <td style="padding:4px 10px;text-align:center;color:var(--warn);">${v.updated}</td>
      <td style="padding:4px 10px;text-align:center;color:var(--muted);">${v.skipped}</td>
    </tr>`).join('');

  const errHtml = errors.length
    ? `<div style="margin-top:10px;padding:8px 12px;background:rgba(255,56,88,.08);border:1px solid rgba(255,56,88,.3);border-radius:4px;font-size:.75rem;color:var(--danger);">
        ⚠️ ${errors.length} advertencia(s):<br>${errors.slice(0,10).join('<br>')}
       </div>`
    : '';

  el.innerHTML = `
    <div style="font-weight:700;font-size:.84rem;margin-bottom:8px;color:var(--acc);">✅ Carga completada</div>
    <table style="width:100%;font-size:.78rem;border-collapse:collapse;border:1px solid var(--br);">
      <thead>
        <tr style="background:var(--s1);">
          <th style="padding:5px 10px;text-align:left;">Entidad</th>
          <th style="padding:5px 10px;">Nuevos</th>
          <th style="padding:5px 10px;">Actualizados</th>
          <th style="padding:5px 10px;">Omitidos</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${errHtml}`;
}

async function bulkImportExcel(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const progressEl = document.getElementById('bulk-progress');
  const resultEl   = document.getElementById('bulk-result');
  progressEl.style.display = 'block';
  resultEl.style.display   = 'none';

  bulkShowProgress('📖 Leyendo archivo Excel...', 10);

  try {
    // ── Leer Excel con SheetJS (incluido en la app via CDN) ──────
    if (!window.XLSX) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('No se pudo cargar SheetJS'));
        document.head.appendChild(s);
      });
    }

    bulkShowProgress('🔍 Analizando hojas...', 25);

    const buf  = await file.arrayBuffer();
    const wb   = window.XLSX.read(buf, { type: 'array', cellDates: true });

    const stats = {};
    const errors = [];

    // Guardar snapshot antes de modificar nada
    // ── HELPER: leer hoja como array de objetos ──────────────────
    function readSheet(sheetName) {
      // Buscar hoja por nombre parcial (sin emojis)
      const found = wb.SheetNames.find(n =>
        n.toLowerCase().includes(sheetName.toLowerCase())
      );
      if (!found) return null;
      const ws = wb.Sheets[found];
      // Encontrar la fila de headers (buscar fila con '*' — las obligatorias)
      const range = window.XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      let headerRow = 0;
      for (let r = range.s.r; r <= Math.min(range.e.r, 15); r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[window.XLSX.utils.encode_cell({r, c})];
          if (cell && cell.v && String(cell.v).includes('*')) {
            headerRow = r;
            break;
          }
        }
        if (headerRow) break;
      }
      // Leer desde la fila de headers
      const data = window.XLSX.utils.sheet_to_json(ws, {
        range: headerRow,
        defval: '',
        raw: false,
      });
      // Filtrar fila de ejemplo y filas vacías
      return data.filter(row => {
        const vals = Object.values(row).map(v => String(v||'').trim());
        const isEmpty = vals.every(v => !v);
        const isExample = vals.some(v =>
          v.toLowerCase().includes('ejemplo') ||
          v === 'María García López' ||
          v === 'Juan Pérez Morales' ||
          v === 'Distribuidora El Éxito' ||
          v === 'María García' ||
          v === 'Cebolla Blanca'
        );
        return !isEmpty && !isExample;
      });
    }

    function cleanKey(str) {
      // Normaliza header key: quita *, espacios, tildes
      return String(str||'').toLowerCase()
        .replace(/[*\/()áéíóúüñ]/g, m => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u','ñ':'n','*':''}[m]||''))
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .trim().replace(/^_|_$/g, '');
    }

    function getVal(row, ...keys) {
      for (const rawKey of Object.keys(row)) {
        const k = cleanKey(rawKey);
        for (const search of keys) {
          if (k.includes(search)) return String(row[rawKey]||'').trim();
        }
      }
      return '';
    }

    // ── 1. EMPLEADOS ────────────────────────────────────────────
    bulkShowProgress('👥 Cargando empleados...', 35);
    const empRows = readSheet('Empleados');
    if (empRows) {
      const ROLES_MAP = {
        'piloto':'piloto','conductor':'piloto',
        'operaciones':'operaciones','bodega':'operaciones','operador':'operaciones',
        'maquila':'maquila',
        'resp-limpieza':'resp-limpieza','limpieza':'resp-limpieza',
        'calidad':'calidad','inspeccion':'calidad',
        'supervisor':'supervisor','encargado':'supervisor',
        'admin':'admin','administracion':'admin','administración':'admin',
        'ventas':'ventas','despacho':'ventas',
      };
      let added = 0, updated = 0, skipped = 0;
      for (const row of empRows) {
        const nombre = getVal(row, 'nombre');
        if (!nombre) { skipped++; continue; }
        const rolesRaw = getVal(row, 'roles', 'rol');
        const roles = rolesRaw ? rolesRaw.split(/[,;|]/).map(r => {
          const rk = cleanKey(r.trim());
          return ROLES_MAP[rk] || rk;
        }).filter(r => r) : [];
        const empData = {
          nombre: nombre.toUpperCase(),
          dpi:      getVal(row, 'dpi'),
          tel:      getVal(row, 'telefono', 'tel'),
          cargo:    getVal(row, 'cargo', 'puesto'),
          roles,
          estado:   getVal(row, 'estado') || 'activo',
          lic_num:  getVal(row, 'licencia', 'lic_num', 'no_licencia'),
          lic_tipo: getVal(row, 'tipo_lic', 'tipo_licencia'),
          lic_venc: getVal(row, 'venc', 'vencimiento'),
        };
        const existing = DB.empleados.findIndex(e =>
          e.nombre.toLowerCase() === empData.nombre.toLowerCase()
        );
        if (existing >= 0) {
          Object.assign(DB.empleados[existing], empData);
          updated++;
        } else {
          DB.empleados.push({ id: uid(), ts: now(), ...empData });
          added++;
        }
      }
      stats['👥 Empleados'] = { added, updated, skipped };
    }

    // ── 2. USUARIOS ─────────────────────────────────────────────
    bulkShowProgress('🔑 Cargando usuarios...', 50);
    const usrRows = readSheet('Usuarios');
    if (usrRows) {
      const ROLES_VALID = ['superadmin','admin','supervisor','operador'];
      let added = 0, updated = 0, skipped = 0;
      for (const row of usrRows) {
        const nombre = getVal(row, 'nombre', 'usuario');
        const clave  = getVal(row, 'clave', 'contraseña', 'password');
        const rolRaw = getVal(row, 'rol').toLowerCase();
        if (!nombre || !clave) { skipped++; continue; }
        const rol = ROLES_VALID.includes(rolRaw) ? rolRaw : 'operador';
        const modulosRaw = getVal(row, 'modulos', 'módulos');
        const modulos = modulosRaw
          ? modulosRaw.split(/[,;]/).map(m => m.trim()).filter(Boolean)
          : (rol === 'superadmin' || rol === 'admin' ? AUTH_ALL_MODULES : AUTH_ROLE_DEFAULTS[rol] || []);
        const existing = DB.usuarios.findIndex(u =>
          u.nombre.toLowerCase() === nombre.toLowerCase()
        );
        if (existing >= 0) {
          DB.usuarios[existing].rol     = rol;
          DB.usuarios[existing].modulos = modulos;
          if (clave) { DB.usuarios[existing].clave = clave; DB.usuarios[existing].claveHash = clave; }
          updated++;
        } else {
          DB.usuarios.push({ id: uid(), nombre, clave, claveHash: clave, rol, modulos, activo: true, ts: new Date().toISOString() });
          added++;
        }
      }
      stats['🔑 Usuarios'] = { added, updated, skipped };
    }

    // ── 3. CONDUCTORES ──────────────────────────────────────────
    bulkShowProgress('🚛 Cargando conductores...', 62);
    const condRows = readSheet('Conductores');
    if (condRows) {
      let added = 0, updated = 0, skipped = 0;
      for (const row of condRows) {
        const nombre = getVal(row, 'nombre');
        const lic    = getVal(row, 'licencia', 'no_licencia', 'num_licencia');
        if (!nombre || !lic) { skipped++; continue; }
        const rec = {
          nombre: nombre.toUpperCase(),
          lic,
          tipoLic: getVal(row, 'tipo_lic', 'tipo_licencia'),
          tel:     getVal(row, 'telefono', 'tel'),
          dpi:     getVal(row, 'dpi'),
          venc:    getVal(row, 'venc', 'vencimiento'),
          foto: null, licFoto: null,
        };
        const existing = DB.conductores.findIndex(c =>
          c.nombre.toLowerCase() === rec.nombre.toLowerCase()
        );
        if (existing >= 0) {
          Object.assign(DB.conductores[existing], rec);
          updated++;
        } else {
          DB.conductores.push({ id: uid(), ts: now(), ...rec });
          added++;
        }
      }
      stats['🚛 Conductores'] = { added, updated, skipped };
    }

    // ── 4. CLIENTES ─────────────────────────────────────────────
    bulkShowProgress('🏢 Cargando clientes...', 72);
    const cliRows = readSheet('Clientes');
    if (cliRows) {
      let added = 0, updated = 0, skipped = 0;
      for (const row of cliRows) {
        const nombre = getVal(row, 'nombre', 'razon_social');
        if (!nombre) { skipped++; continue; }
        const rec = {
          nombre,
          nit:      getVal(row, 'nit', 'rfc'),
          tipo:     getVal(row, 'tipo').toLowerCase() || 'otro',
          pais:     getVal(row, 'pais', 'país').toUpperCase() || 'GT',
          contacto: getVal(row, 'contacto'),
          tel:      getVal(row, 'telefono', 'tel'),
          dir:      getVal(row, 'direccion', 'dir', 'dirección'),
        };
        const existing = DB.iclientes.findIndex(c =>
          c.nombre.toLowerCase() === nombre.toLowerCase()
        );
        if (existing >= 0) {
          Object.assign(DB.iclientes[existing], rec);
          updated++;
        } else {
          DB.iclientes.push({ id: uid(), ...rec });
          added++;
        }
      }
      stats['🏢 Clientes'] = { added, updated, skipped };
    }

    // ── 5. PRODUCTOS ────────────────────────────────────────────
    bulkShowProgress('🥬 Cargando productos...', 82);
    const prodRows = readSheet('Productos');
    if (prodRows) {
      let added = 0, updated = 0, skipped = 0;
      for (const row of prodRows) {
        const nombre = getVal(row, 'nombre', 'producto');
        if (!nombre) { skipped++; continue; }
        const rec = {
          nombre: nombre.toUpperCase(),
          codigo:        getVal(row, 'codigo', 'sap'),
          categoria:     getVal(row, 'categoria', 'categoría') || 'Hortalizas',
          unidadCompra:  getVal(row, 'unidad_compra', 'unidad') || 'bulto',
          kgBulto:       parseFloat(getVal(row, 'kg_bulto', 'kg_por_bulto')) || 0,
          empaqueCompra: getVal(row, 'empaque') || 'costal',
          pctMerma:      parseFloat(getVal(row, 'merma', 'pct_merma')) || 0,
          diasMax:       parseInt(getVal(row, 'dias', 'dias_max')) || 14,
          minStock:      parseFloat(getVal(row, 'stock_minimo', 'min_stock')) || 0,
        };
        if (!DB.iproductos) DB.iproductos = [];
        const existing = DB.iproductos.findIndex(p =>
          p.nombre.toLowerCase() === rec.nombre.toLowerCase()
        );
        if (existing >= 0) {
          Object.assign(DB.iproductos[existing], rec);
          updated++;
        } else {
          DB.iproductos.push({ id: uid(), ...rec });
          added++;
        }
      }
      stats['🥬 Productos'] = { added, updated, skipped };
    }

    // ── 6. PRESENTACIONES ───────────────────────────────────────
    bulkShowProgress('📦 Cargando presentaciones...', 92);
    const presRows = readSheet('Presentaciones');
    if (presRows) {
      let added = 0, updated = 0, skipped = 0;
      for (const row of presRows) {
        const prodNombre = getVal(row, 'producto');
        const nombre     = getVal(row, 'nombre_presentacion', 'presentacion', 'nombre');
        if (!prodNombre || !nombre) { skipped++; continue; }
        // Buscar el producto
        const prod = (DB.iproductos||[]).find(p =>
          p.nombre.toLowerCase() === prodNombre.toLowerCase() ||
          prodNombre.toLowerCase().includes(p.nombre.toLowerCase())
        );
        if (!prod) {
          errors.push(`⚠ Presentación "${nombre}": producto "${prodNombre}" no encontrado`);
          skipped++; continue;
        }
        const lbs = parseFloat(getVal(row, 'lbs_por_unidad', 'lbs')) || 0;
        const rec = {
          productoId:  prod.id,
          nombre,
          canal:       getVal(row, 'canal') || 'local',
          isWalmart:   ['walmart','walmart_mx'].includes(getVal(row,'canal')),
          codigo:      getVal(row, 'codigo', 'sap', 'material'),
          tipoEmpaque: getVal(row, 'tipo_empaque', 'empaque') || 'caja',
          lbsBulto:    lbs,
          kgBulto:     parseFloat(getVal(row, 'kg_por_unidad', 'kg')) || lbs / 2.20462,
        };
        if (!DB.ipresentaciones) DB.ipresentaciones = [];
        const existing = DB.ipresentaciones.findIndex(p =>
          p.nombre.toLowerCase() === nombre.toLowerCase() && p.productoId === prod.id
        );
        if (existing >= 0) {
          Object.assign(DB.ipresentaciones[existing], rec);
          updated++;
        } else {
          DB.ipresentaciones.push({ id: uid(), ...rec });
          added++;
        }
      }
      stats['📦 Presentaciones'] = { added, updated, skipped };
    }

    // ── Guardar todo ─────────────────────────────────────────────
    bulkShowProgress('💾 Guardando en Firebase...', 97);
    save();
    // snapshot post-carga
    try { renderAll(); } catch(e) {}
    try { populateAllRespSelects(); } catch(e) {}
    try { renderEmpleados(); } catch(e) {}
    try { renderUsuarios(); } catch(e) {}
    try { renderConductores(); } catch(e) {}
    try { renderIprod(); renderIpres(); renderIcli(); } catch(e) {}
    bulkShowResult(stats, errors);
    toast('✅ Carga masiva completada');

  } catch(err) {
    document.getElementById('bulk-progress').style.display = 'none';
    document.getElementById('bulk-result').style.display = 'block';
    document.getElementById('bulk-result').innerHTML = `
      <div style="padding:10px;background:rgba(255,56,88,.1);border:1px solid rgba(255,56,88,.4);border-radius:4px;color:var(--danger);font-size:.8rem;">
        ❌ Error al leer el archivo: ${err.message}<br>
        <small>Asegúrate de cargar el archivo .xlsx de la plantilla AJÚA</small>
      </div>`;
    toast('⚠ Error en carga masiva', true);
  }
}


