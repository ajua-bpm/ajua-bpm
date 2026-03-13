// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — modules/reportes/index.js
// Reporte General — Ingresos · Costos · Gastos · Utilidad
// Build 52 — Marzo 2026
//
// Dependencias externas:
//   - DB, save()            → core/firebase.js
//   - uid(), now(), toast() → core/utils.js
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// REPORTE GENERAL — Ingresos · Costos · Gastos Diarios · Utilidad
// ══════════════════════════════════════════════════════════════════

function repTab(name, el) {
  ['resumen','producto','canal','consolidado','detalle','descargas'].forEach(t => {
    const panel = document.getElementById('rep-panel-'+t);
    const tab   = document.getElementById('rep-tab-'+t);
    if (panel) panel.style.display = t === name ? '' : 'none';
    if (tab)   tab.classList.toggle('active', t === name);
  });
}

function generarReporte() {
  invEnsureDB();
  const desde = document.getElementById('rep-desde')?.value;
  const hasta = document.getElementById('rep-hasta')?.value;
  const filtProd = document.getElementById('rep-prod')?.value || '';

  if (!desde || !hasta) { toast('⚠ Selecciona un período de fechas', true); return; }

  // ── 1. INGRESOS ─────────────────────────────────────────────────
  // Walmart sales (isalidas / vgtVentas)
  let totalIngresos = 0, totalLbsVendidas = 0;
  const ventasPorProd = {};  // productoId/nombre -> { lbs, ingresos }

  // Local GT sales
  (DB.vgtVentas || []).filter(v => v.fecha >= desde && v.fecha <= hasta).forEach(v => {
    (v.lineas || []).forEach(l => {
      const id = l.productoId || l.productoNombre || 'Otros';
      if (filtProd && id !== filtProd && l.productoNombre !== filtProd) return;
      const ingreso = l.neto || (l.total / 1.12) || 0;
      totalIngresos     += ingreso;
      totalLbsVendidas  += l.lbs || 0;
      if (!ventasPorProd[id]) ventasPorProd[id] = { nombre: l.productoNombre || id, lbs: 0, ingresos: 0 };
      ventasPorProd[id].lbs      += l.lbs || 0;
      ventasPorProd[id].ingresos += ingreso;
    });
  });

  // Walmart sales
  (DB.isalidas || []).filter(v => v.fecha >= desde && v.fecha <= hasta).forEach(v => {
    (v.lineas || []).forEach(l => {
      const id = l.productoId || l.productoNombre || 'Otros';
      if (filtProd && id !== filtProd && l.productoNombre !== filtProd) return;
      const ingreso = l.neto || (l.totalConIva ? l.totalConIva / 1.12 : 0) || 0;
      totalIngresos     += ingreso;
      totalLbsVendidas  += l.lbs || 0;
      if (!ventasPorProd[id]) ventasPorProd[id] = { nombre: l.productoNombre || id, lbs: 0, ingresos: 0 };
      ventasPorProd[id].lbs      += l.lbs || 0;
      ventasPorProd[id].ingresos += ingreso;
    });
  });

  // Export sales
  (DB.vintVentas || []).filter(v => v.fecha >= desde && v.fecha <= hasta).forEach(v => {
    (v.lineas || []).forEach(l => {
      const id = l.productoId || l.productoNombre || 'Exportación';
      if (filtProd && id !== filtProd) return;
      const ingreso = v.moneda === 'gtq' ? (l.sub || 0) : (l.sub || 0) * (v.tc || 1);
      totalIngresos     += ingreso;
      totalLbsVendidas  += l.lbs || 0;
      if (!ventasPorProd[id]) ventasPorProd[id] = { nombre: l.productoNombre || id, lbs: 0, ingresos: 0 };
      ventasPorProd[id].lbs      += l.lbs || 0;
      ventasPorProd[id].ingresos += ingreso;
    });
  });

  // ── 2. COSTO DE PRODUCTO (del cotizador — precio real negociado) ──
  // El costo es lo que vale el producto según cotización, independiente de si se pagó.
  // Para costo/kg y costo/lb se usa costoKg y costoLb del cotizador.
  let costoProducto          = 0;  // costo total producto (cotizador)
  let costoLotesManual       = 0;  // lotes manuales con cxlb ingresado
  let totalLbsProducto       = 0;
  let totalKgProducto        = 0;

  // Fuente 1: ientradas desde cotizador (tienen costoTotal = costoUd * qty)
  (DB.ientradas || []).filter(e => e.fecha >= desde && e.fecha <= hasta && e.source === 'cotizador').forEach(e => {
    costoProducto    += e.costoTotal || 0;
    totalLbsProducto += e.lbsTotal  || e.lbsBruto || 0;
    totalKgProducto  += e.kgTotal   || e.kgBruto  || 0;
  });
  // Fuente 2: lotes manuales (ingreso directo con cxlb)
  (DB.ientradas || []).filter(e => e.fecha >= desde && e.fecha <= hasta && e.source !== 'cotizador').forEach(e => {
    costoLotesManual += e.costoTotal || e.totalQ || 0;
    totalLbsProducto += e.lbsBruto  || e.lbsTotal || 0;
    totalKgProducto  += e.kgBruto   || e.kgTotal  || 0;
  });
  const costoImportacion = costoProducto + costoLotesManual;
  const costoKgPromedio  = totalKgProducto  > 0 ? costoImportacion / totalKgProducto  : 0;
  const costoLbPromedio  = totalLbsProducto > 0 ? costoImportacion / totalLbsProducto : 0;

  // ── 2b. PAGOS REALES (flujo de caja — puede diferir del costo) ──
  // Los anticipos son lo que salió de la cuenta. Puede haber crédito o pago posterior.
  let pagadoTotal  = 0;
  let anticiposTotal = 0;
  const anticiposContados = new Set();
  (DB.gastosDiarios || []).filter(g => g.fecha >= desde && g.fecha <= hasta && g.cat === 'imp-anticipo').forEach(g => {
    pagadoTotal    += g.monto || 0;
    anticiposTotal += g.monto || 0;
    if (g.anticipo_ref) anticiposContados.add(g.anticipo_ref);
  });
  (DB.cotizaciones || []).forEach(cot => {
    (cot.anticipos || []).forEach(a => {
      if (!anticiposContados.has(a.id) && a.fecha >= desde && a.fecha <= hasta) {
        pagadoTotal    += a.gtq || 0;
        anticiposTotal += a.gtq || 0;
      }
    });
  });
  const porPagar = Math.max(0, costoImportacion - pagadoTotal);

  // ── 3. GASTOS GENERALES (maquila semanal) ───────────────────────
  let costoMaquila = 0;
  (DB.gastosSemanales || []).filter(s => s.semanaInicio >= desde && s.semanaInicio <= hasta).forEach(s => {
    costoMaquila += s.grandTotal || s.totalGral || 0;
  });

  // ── 4. GASTOS DIARIOS (operativos — sin anticipos de producto) ──
  let gastosDiariosTotal = 0;
  const gdPorCategoria   = {};
  (DB.gastosDiarios || []).filter(g => g.fecha >= desde && g.fecha <= hasta).forEach(g => {
    if (g.cat === 'imp-anticipo') return; // ya contado en pagadoTotal, no en gastos operativos
    const info  = GD_CATS[g.cat] || { label: g.cat, grupo: 'Otros' };
    const grupo = info.grupo || 'Otros';
    gastosDiariosTotal += g.monto || 0;
    gdPorCategoria[grupo] = (gdPorCategoria[grupo] || 0) + (g.monto || 0);
  });

  // ── 5. TOTALES ────────────────────────────────────────────────────
  const costoTotal  = costoImportacion + costoMaquila + gastosDiariosTotal;
  const utilidad    = totalIngresos - costoTotal;
  const margen      = totalIngresos > 0 ? utilidad / totalIngresos * 100 : 0;
  const costoPorLb  = totalLbsVendidas > 0 ? costoTotal / totalLbsVendidas : 0;

  // ── 6. KPIs ───────────────────────────────────────────────────────
  const kpis = [
    // ── Rentabilidad ──
    { l:'Ingresos brutos',         v:'Q '+totalIngresos.toFixed(2),                    c:'var(--acc)',    big:true },
    { l:'Costo total',             v:'Q '+costoTotal.toFixed(2),                       c:'var(--warn)',   big:true },
    { l:'Utilidad bruta',          v:'Q '+utilidad.toFixed(2),                         c:utilidad>=0?'var(--acc)':'var(--danger)', big:true },
    { l:'Margen bruto',            v:margen.toFixed(1)+'%',                            c:margen>=20?'var(--acc)':margen>=10?'var(--warn)':'var(--danger)' },
    // ── Costo por unidad ──
    { l:'📦 Costo producto',       v:'Q '+costoImportacion.toFixed(2),                 c:'var(--warn)' },
    { l:'↳ Costo / kg',            v:'Q '+costoKgPromedio.toFixed(4),                  c:'var(--muted2)' },
    { l:'↳ Costo / lb',            v:'Q '+costoLbPromedio.toFixed(4),                  c:'var(--muted2)' },
    // ── Flujo de caja (pagos reales) ──
    { l:'💸 Pagado a proveedor',   v:'Q '+pagadoTotal.toFixed(2),                      c:'var(--info)' },
    ...(porPagar>0?[{ l:'⏳ Por pagar (crédito)', v:'Q '+porPagar.toFixed(2),          c:'var(--danger)' }]:[]),
    // ── Gastos operativos ──
    { l:'🔧 Gastos operativos',    v:'Q '+gastosDiariosTotal.toFixed(2),               c:'var(--muted2)' },
    { l:'👷 Nómina / Maquila',     v:'Q '+costoMaquila.toFixed(2),                    c:'var(--muted2)' },
    // ── Volumen ──
    { l:'LBS vendidas',            v:totalLbsVendidas.toFixed(0)+' lbs',               c:'var(--txt)' },
    { l:'Costo / lb vendida',      v:'Q '+(totalLbsVendidas>0?costoTotal/totalLbsVendidas:0).toFixed(4), c:'var(--muted2)' },
  ];
  const kpisEl = document.getElementById('rep-kpis');
  if (kpisEl) kpisEl.innerHTML = kpis.map(k =>
    `<div style="background:var(--s1);border:1.5px solid var(--br);border-radius:var(--r2);padding:${k.big?'16px 18px':'12px 14px'};${k.big?'grid-column:span 1;':''}" >
      <div style="font-size:.62rem;color:var(--muted2);letter-spacing:.07em;text-transform:uppercase;">${k.l}</div>
      <div style="font-family:var(--fh);font-size:${k.big?'1.4rem':'.95rem'};font-weight:800;color:${k.c};margin-top:3px;">${k.v}</div>
    </div>`
  ).join('');

  // ── 7. TAB RESUMEN ────────────────────────────────────────────────
  const gdCatRows = Object.entries(gdPorCategoria).sort((a,b)=>b[1]-a[1]).map(([cat, tot]) =>
    `<tr><td style="padding:7px 12px;font-size:.78rem;">📋 ${cat}</td><td style="text-align:right;padding:7px 12px;font-size:.78rem;">Q ${tot.toFixed(2)}</td><td style="text-align:right;padding:7px 12px;font-size:.72rem;color:var(--muted2);">${totalIngresos>0?(tot/totalIngresos*100).toFixed(1)+'%':'—'}</td></tr>`
  ).join('');

  const resHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
      <div>
        <div style="font-weight:700;font-size:.82rem;color:var(--green-deep);margin-bottom:8px;padding-bottom:6px;border-bottom:1.5px solid var(--br);">📥 COSTOS DEL PERÍODO</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:var(--s2);"><td style="padding:7px 12px;font-size:.78rem;font-weight:600;">Importación / Compra</td><td style="text-align:right;padding:7px 12px;font-weight:700;color:var(--warn);">Q ${costoImportacion.toFixed(2)}</td><td style="text-align:right;padding:7px 12px;font-size:.72rem;color:var(--muted2);">${costoTotal>0?(costoImportacion/costoTotal*100).toFixed(1)+'%':'—'}</td></tr>
          <tr><td style="padding:7px 12px;font-size:.78rem;font-weight:600;">Gastos Generales (Maquila)</td><td style="text-align:right;padding:7px 12px;font-weight:700;color:var(--warn);">Q ${costoMaquila.toFixed(2)}</td><td style="text-align:right;padding:7px 12px;font-size:.72rem;color:var(--muted2);">${costoTotal>0?(costoMaquila/costoTotal*100).toFixed(1)+'%':'—'}</td></tr>
          <tr style="background:var(--s2);"><td style="padding:7px 12px;font-size:.78rem;font-weight:600;">💸 Gastos Diarios</td><td style="text-align:right;padding:7px 12px;font-weight:700;color:var(--info);">Q ${gastosDiariosTotal.toFixed(2)}</td><td style="text-align:right;padding:7px 12px;font-size:.72rem;color:var(--muted2);">${costoTotal>0?(gastosDiariosTotal/costoTotal*100).toFixed(1)+'%':'—'}</td></tr>
          ${gdCatRows}
          <tr style="border-top:2px solid var(--green-deep);background:var(--green-pale);"><td style="padding:8px 12px;font-weight:800;font-size:.84rem;">COSTO TOTAL</td><td style="text-align:right;padding:8px 12px;font-weight:800;font-size:.95rem;color:var(--orange-deep);">Q ${costoTotal.toFixed(2)}</td><td></td></tr>
        </table>
      </div>
      <div>
        <div style="font-weight:700;font-size:.82rem;color:var(--green-deep);margin-bottom:8px;padding-bottom:6px;border-bottom:1.5px solid var(--br);">📤 INGRESOS DEL PERÍODO</div>
        <table style="width:100%;border-collapse:collapse;">
          ${Object.values(ventasPorProd).sort((a,b)=>b.ingresos-a.ingresos).slice(0,10).map((p,i) =>
            `<tr style="${i%2?'':'background:var(--s2);'}"><td style="padding:6px 12px;font-size:.78rem;">${p.nombre}</td><td style="text-align:right;padding:6px 12px;font-size:.72rem;color:var(--muted2);">${p.lbs.toFixed(0)} lbs</td><td style="text-align:right;padding:6px 12px;font-weight:600;color:var(--acc);">Q ${p.ingresos.toFixed(2)}</td></tr>`
          ).join('')}
          <tr style="border-top:2px solid var(--green-deep);background:var(--green-pale);"><td style="padding:8px 12px;font-weight:800;font-size:.84rem;">INGRESOS TOTALES</td><td style="text-align:right;padding:8px 12px;font-size:.72rem;color:var(--muted2);">${totalLbsVendidas.toFixed(0)} lbs</td><td style="text-align:right;padding:8px 12px;font-weight:800;font-size:.95rem;color:var(--acc);">Q ${totalIngresos.toFixed(2)}</td></tr>
        </table>
        <div style="margin-top:12px;padding:14px;border-radius:6px;border:2px solid ${utilidad>=0?'var(--acc)':'var(--danger)'};background:${utilidad>=0?'rgba(0,122,82,.06)':'rgba(214,48,48,.06)'};">
          <div style="font-size:.65rem;color:var(--muted2);letter-spacing:.1em;text-transform:uppercase;">UTILIDAD BRUTA DEL PERÍODO</div>
          <div style="font-family:var(--fh);font-size:2rem;font-weight:800;color:${utilidad>=0?'var(--acc)':'var(--danger)'};">${utilidad>=0?'':'−'} Q ${Math.abs(utilidad).toFixed(2)}</div>
          <div style="font-size:.78rem;color:var(--muted2);margin-top:4px;">Margen: <strong style="color:${margen>=20?'var(--acc)':margen>=10?'var(--warn)':'var(--danger)'};">${margen.toFixed(1)}%</strong></div>
        </div>
      </div>
    </div>`;

  const resDiv = document.getElementById('rep-resumen-html');
  if (resDiv) resDiv.innerHTML = resHtml;

  // ── 8. TAB POR PRODUCTO ───────────────────────────────────────────
  const tbProd = document.getElementById('rep-tbody-producto');
  if (tbProd) {
    // Get import cost per product from ientradas
    const importPorProd = {};
    (DB.ientradas || []).filter(e => e.fecha >= desde && e.fecha <= hasta).forEach(e => {
      const id = e.productoId || e.producto || 'Otros';
      if (!importPorProd[id]) importPorProd[id] = { lbsImp: 0, costoImp: 0, nombre: e.productoNombre || id };
      importPorProd[id].lbsImp  += e.lbsTotal || e.kgTotal * 2.20462 || 0;
      importPorProd[id].costoImp += e.costoTotal || e.totalQ || 0;
    });

    const allProds = new Set([...Object.keys(ventasPorProd), ...Object.keys(importPorProd)]);
    tbProd.innerHTML = [...allProds].map(id => {
      const v  = ventasPorProd[id] || { lbs: 0, ingresos: 0, nombre: id };
      const im = importPorProd[id] || { lbsImp: 0, costoImp: 0 };
      const costoLbImp  = im.lbsImp  > 0 ? im.costoImp / im.lbsImp  : 0;
      const costoMaqLb  = im.lbsImp  > 0 ? costoMaquila / totalLbsVendidas || 0 : 0;
      const costoTotLb  = costoLbImp + costoMaqLb;
      const costoVenta  = v.lbs * costoTotLb;
      const util        = v.ingresos - costoVenta;
      const marg        = v.ingresos > 0 ? util / v.ingresos * 100 : 0;
      return `<tr>
        <td style="font-weight:600;">${v.nombre}</td>
        <td style="text-align:right;">${im.lbsImp.toFixed(0)}</td>
        <td style="text-align:right;">Q ${im.costoImp.toFixed(2)}</td>
        <td style="text-align:right;">Q ${(costoMaquila / Math.max(Object.keys(ventasPorProd).length, 1)).toFixed(2)}</td>
        <td style="text-align:right;">Q ${costoTotLb.toFixed(4)}</td>
        <td style="text-align:right;">${v.lbs.toFixed(0)}</td>
        <td style="text-align:right;color:var(--acc);">Q ${v.ingresos.toFixed(2)}</td>
        <td style="text-align:right;color:${util>=0?'var(--acc)':'var(--danger)'};">Q ${util.toFixed(2)}</td>
        <td style="text-align:right;color:${marg>=15?'var(--acc)':marg>=5?'var(--warn)':'var(--danger)'};">${marg.toFixed(1)}%</td>
      </tr>`;
    }).join('');
  }

  // ── 9. TAB POR CANAL ──────────────────────────────────────────────
  const tbCanal = document.getElementById('rep-tbody-canal');
  if (tbCanal) {
    const canales = {};
    const addCanal = (canal, lbs, ing) => {
      if (!canales[canal]) canales[canal] = { despachos: 0, lbs: 0, ingresos: 0 };
      canales[canal].despachos++;
      canales[canal].lbs      += lbs;
      canales[canal].ingresos += ing;
    };
    (DB.vgtVentas||[]).filter(v=>v.fecha>=desde&&v.fecha<=hasta).forEach(v =>
      addCanal('🏪 Local Guatemala', v.lineas?.reduce((s,l)=>s+(l.lbs||0),0)||0,
               v.lineas?.reduce((s,l)=>s+(l.neto||0),0)||0));
    (DB.isalidas||[]).filter(v=>v.fecha>=desde&&v.fecha<=hasta).forEach(v =>
      addCanal('🛒 Walmart', v.lineas?.reduce((s,l)=>s+(l.lbs||0),0)||0,
               v.lineas?.reduce((s,l)=>s+((l.totalConIva||0)/1.12),0)||0));
    (DB.vintVentas||[]).filter(v=>v.fecha>=desde&&v.fecha<=hasta).forEach(v =>
      addCanal('🌎 Exportación', v.totalLbs||0,
               v.moneda==='gtq'?v.totalVal||0:(v.totalVal||0)*(v.tc||1)));

    tbCanal.innerHTML = Object.entries(canales).sort((a,b)=>b[1].ingresos-a[1].ingresos).map(([c,d]) =>
      `<tr>
        <td>${c}</td>
        <td style="text-align:right;">${d.despachos}</td>
        <td style="text-align:right;">${d.lbs.toFixed(0)} lbs</td>
        <td style="text-align:right;color:var(--acc);font-weight:600;">Q ${d.ingresos.toFixed(2)}</td>
        <td style="text-align:right;">${totalIngresos>0?(d.ingresos/totalIngresos*100).toFixed(1)+'%':'—'}</td>
      </tr>`
    ).join('');
  }

  // ── 10. TAB CONSOLIDADO ───────────────────────────────────────────
  const tbCons = document.getElementById('rep-tbody-consolidado');
  if (tbCons) {
    const rows = [];
    (DB.vgtVentas||[]).filter(v=>v.fecha>=desde&&v.fecha<=hasta).forEach(v => {
      const neto = v.lineas?.reduce((s,l)=>s+(l.neto||0),0)||0;
      const lbs  = v.lineas?.reduce((s,l)=>s+(l.lbs||0),0)||0;
      const iva  = neto * 0.12;
      const total = neto + iva;
      rows.push({ fecha:v.fecha, canal:'Local GT', cliente:v.cliente||'—', lbs, neto, iva, total, ref:v.factura||v.serie||'—' });
    });
    (DB.isalidas||[]).filter(v=>v.fecha>=desde&&v.fecha<=hasta).forEach(v => {
      const neto = v.lineas?.reduce((s,l)=>s+((l.totalConIva||0)/1.12),0)||0;
      const lbs  = v.lineas?.reduce((s,l)=>s+(l.lbs||0),0)||0;
      const iva  = neto * 0.12;
      rows.push({ fecha:v.fecha, canal:'Walmart', cliente:'Walmart GT', lbs, neto, iva, total:neto+iva, ref:v.oc||v.factura||'—' });
    });
    (DB.vintVentas||[]).filter(v=>v.fecha>=desde&&v.fecha<=hasta).forEach(v => {
      const neto = v.moneda==='gtq'?v.totalVal||0:(v.totalVal||0)*(v.tc||1);
      rows.push({ fecha:v.fecha, canal:'Exportación', cliente:v.comprador||'—', lbs:v.totalLbs||0, neto, iva:0, total:neto, ref:v.contenedorRef||'—' });
    });
    rows.sort((a,b)=>b.fecha.localeCompare(a.fecha));
    tbCons.innerHTML = rows.map(r => `<tr>
      <td>${r.fecha}</td><td><span class="chip cb" style="font-size:.6rem;">${r.canal}</span></td>
      <td>${r.cliente}</td><td>—</td>
      <td style="text-align:right;">${r.lbs.toFixed(0)}</td>
      <td style="text-align:right;">Q ${r.neto.toFixed(2)}</td>
      <td style="text-align:right;">Q ${r.iva.toFixed(2)}</td>
      <td style="text-align:right;font-weight:700;">Q ${r.total.toFixed(2)}</td>
      <td style="text-align:right;">—</td>
      <td style="text-align:right;">—</td>
      <td style="font-size:.68rem;color:var(--muted2);">${r.ref}</td>
    </tr>`).join('');
    const tfootEl = document.getElementById('rep-tfoot-consolidado');
    if (tfootEl) {
      const totNeto = rows.reduce((s,r)=>s+r.neto,0);
      const totIva  = rows.reduce((s,r)=>s+r.iva,0);
      const totTot  = rows.reduce((s,r)=>s+r.total,0);
      tfootEl.innerHTML = `<tr style="background:var(--green-pale);border-top:2px solid var(--green-deep);">
        <td colspan="5" style="padding:8px 14px;font-weight:800;">TOTALES (${rows.length} registros)</td>
        <td style="text-align:right;font-weight:700;padding:8px 14px;">Q ${totNeto.toFixed(2)}</td>
        <td style="text-align:right;font-weight:700;padding:8px 14px;">Q ${totIva.toFixed(2)}</td>
        <td style="text-align:right;font-weight:800;color:var(--acc);padding:8px 14px;">Q ${totTot.toFixed(2)}</td>
        <td colspan="3"></td>
      </tr>`;
    }
  }

  repTab('resumen', document.getElementById('rep-tab-resumen'));
  toast('✅ Reporte generado — ' + desde + ' al ' + hasta);
}

function repExport() {
  const desde = document.getElementById('rep-desde')?.value;
  const hasta = document.getElementById('rep-hasta')?.value;
  if (!desde || !hasta) { toast('⚠ Genera el reporte primero', true); return; }

  const rows = [];
  (DB.vgtVentas||[]).filter(v=>v.fecha>=desde&&v.fecha<=hasta).forEach(v => {
    (v.lineas||[]).forEach(l => rows.push([v.fecha,'Local GT',v.cliente||'',l.productoNombre||'',l.lbs||0,(l.neto||0).toFixed(2),(l.neto*0.12).toFixed(2),(l.neto*1.12).toFixed(2)]));
  });
  (DB.isalidas||[]).filter(v=>v.fecha>=desde&&v.fecha<=hasta).forEach(v => {
    (v.lineas||[]).forEach(l => {
      const n = (l.totalConIva||0)/1.12;
      rows.push([v.fecha,'Walmart','Walmart GT',l.productoNombre||'',l.lbs||0,n.toFixed(2),(n*0.12).toFixed(2),(l.totalConIva||0).toFixed(2)]);
    });
  });
  // Add gastos diarios summary
  const gdTotal = (DB.gastosDiarios||[]).filter(g=>g.fecha>=desde&&g.fecha<=hasta).reduce((s,g)=>s+(g.monto||0),0);
  let csv = '\uFEFF' + 'Fecha,Canal,Cliente,Producto,LBS,Neto Q,IVA Q,Total Q\n';
  rows.forEach(r => { csv += r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',') + '\n'; });
  csv += `\n"","","","GASTOS DIARIOS DEL PERÍODO","","","","${gdTotal.toFixed(2)}"\n`;
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),
    download: `ReporteGeneral_${desde}_${hasta}.csv`
  });
  a.click();
  toast('✅ Excel descargado');
}

function repExportConsolidado() { repExport(); }

// ═══════════════════════════════════════════════════════════════════
// DESCARGA EXCEL BPM COMPLETO — todos los módulos, por período
// ═══════════════════════════════════════════════════════════════════

function rpGetRango(periodo) {
  const hoy = new Date();
  if (periodo === 'semana') {
    const dow = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1));
    lunes.setHours(0,0,0,0);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    return { desde: lunes.toISOString().slice(0,10), hasta: domingo.toISOString().slice(0,10), label: `Semana_${lunes.toISOString().slice(0,10)}` };
  }
  if (periodo === 'mes') {
    const y = hoy.getFullYear(), m = hoy.getMonth();
    const desde = `${y}-${String(m+1).padStart(2,'0')}-01`;
    const hasta = new Date(y, m+1, 0).toISOString().slice(0,10);
    return { desde, hasta, label: `${y}-${String(m+1).padStart(2,'0')}` };
  }
  if (periodo === 'anio') {
    const y = hoy.getFullYear();
    return { desde: `${y}-01-01`, hasta: `${y}-12-31`, label: `Año_${y}` };
  }
  return { desde: '2020-01-01', hasta: '2099-12-31', label: 'Historico' };
}

function rpFilt(arr, campo, desde, hasta) {
  return (arr || []).filter(r => { const f = String(r[campo]||'').slice(0,10); return f >= desde && f <= hasta; });
}

function rpCatLabel(cat) {
  if (typeof GD_CATS !== 'undefined' && GD_CATS[cat]) return GD_CATS[cat].label;
  return cat || '—';
}

function rpMakeSheet(header, rows, colWidths) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  if (colWidths) ws['!cols'] = colWidths.map(w => ({ wch: w }));
  return ws;
}

function rpSheetGastosDiarios(desde, hasta) {
  const rows = rpFilt(DB.gastosDiarios, 'fecha', desde, hasta);
  return rpMakeSheet(
    ['Fecha','Categoría','Descripción','Monto Q','Método','Pagado Por','Dev. Pendiente','Empleado'],
    rows.map(r => [r.fecha||'', rpCatLabel(r.cat), r.desc||'', r.monto||0,
                   r.metodo||'', r.pagadoPor||'', r.devolucionPendiente?'Sí':'No', r.empleadoNombre||'']),
    [12,28,40,12,12,14,15,22]
  );
}

function rpSheetMaquila(desde, hasta) {
  const semanas = rpFilt(DB.gastosSemanales||[], 'semanaInicio', desde, hasta);
  const data = [['Semana Inicio','Semana Fin','Lbs Procesadas','Total Q']];
  semanas.forEach(s => {
    data.push([s.semanaInicio||'', s.semanaFin||'', s.lbsProc||0, s.grandTotal||0]);
    if (s.cuentas && typeof s.cuentas === 'object') {
      Object.values(s.cuentas).forEach(grp => {
        if (!grp) return;
        const tot = s.totales ? (s.totales[grp.id]||0) : 0;
        data.push(['', `  › ${grp.label||grp.id||''}`, '', tot]);
        (grp.rows||[]).forEach(row => data.push(['', `      ${row.label||row.nombre||''}`, '', row.monto||row.salarioSemanal||0]));
      });
    }
    data.push([]);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:14},{wch:40},{wch:16},{wch:14}];
  return ws;
}

function rpSheetVentasGT(desde, hasta) {
  const rows = rpFilt(DB.vgtVentas||[], 'fecha', desde, hasta);
  const data = [['Fecha','Tipo','Comprador','Total Lbs','Total Q','Forma Pago','# Factura','NIT','Observaciones']];
  rows.forEach(r => {
    data.push([r.fecha||'', r.tipo||'', r.comprador||'', r.totalLbs||0, r.totalQ||0, r.pago||'', r.numFactura||'', r.nitComprador||'', r.obs||'']);
    (r.lineas||[]).forEach(l => data.push(['', `  › ${l.productoNombre||''}`, '', l.lbs||0, l.sub||0, `${l.cant} ${l.unidad} × Q${l.precio}`]));
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:12},{wch:14},{wch:28},{wch:12},{wch:12},{wch:14},{wch:14},{wch:14},{wch:30}];
  return ws;
}

function rpSheetVentasExport(desde, hasta) {
  const rows = rpFilt(DB.vintVentas||[], 'fecha', desde, hasta);
  const data = [['Fecha','País','Comprador','Operación','Total Lbs','Total Bultos','Valor Orig.','Total GTQ','Flete','Papelería','Moneda','Placa','Observaciones']];
  rows.forEach(r => {
    data.push([r.fecha||'', r.pais||'', r.comprador||'', r.op||'', r.totalLbs||0, r.totalBultos||0,
               r.totalVal||0, r.totalGtq||0, r.flete||0, r.pap||0, r.moneda||'GTQ', r.placa||'', r.obs||'']);
    (r.lineas||[]).forEach(l => data.push(['', `  › ${l.productoNombre||''}`, '', '', l.lbs||0, l.cant||0, l.sub||0]));
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:12},{wch:6},{wch:26},{wch:22},{wch:12},{wch:14},{wch:12},{wch:12},{wch:10},{wch:10},{wch:8},{wch:12},{wch:30}];
  return ws;
}

function rpSheetWalmart(desde, hasta) {
  return rpMakeSheet(
    ['Fecha Entrega','Hora','OC','Atlas','Rampa','Estado','# Rubros','Observaciones'],
    rpFilt(DB.pedidosWalmart||[], 'fechaEntrega', desde, hasta).map(r => [r.fechaEntrega||'', r.horaEntrega||'', r.oc||'', r.atlas||'', r.rampa||'', r.estado||'', (r.rubros||[]).length, r.obs||'']),
    [14,8,16,16,8,14,10,30]
  );
}

function rpSheetTL(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Hora','Placa','Tipo','Responsable','Observaciones'],
    rpFilt(DB.tl||[], 'fecha', desde, hasta).map(r => [r.fecha||'', r.hora||'', r.placa||'', r.tipo||'', r.resp||'', r.obs||'']),
    [12,8,12,18,22,35]
  );
}

function rpSheetDT(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Hora','Placa','Conductor','Licencia','Cliente','Destino','Carga','Temp °C','% Cumpl.','Autorizado','Obs. General'],
    rpFilt(DB.dt||[], 'fecha', desde, hasta).map(r => [
      r.fecha||'', r.hora||'', r.placa||'', r.conductorNombre||'', r.conductorLic||'',
      r.clienteNombre||'', r.clienteDir||'', r.carga||'', r.temp||'',
      r.pct != null ? `${r.pct}%` : '', r.autorizado||'', r.obsGen||'']),
    [12,8,12,22,14,22,28,18,8,10,14,35]
  );
}

function rpSheetAL(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Turno','H. Inicio','H. Salida','Total Empleados','Lavados Completos','% Cumplimiento'],
    rpFilt(DB.al||[], 'fecha', desde, hasta).map(r => {
      const pct = r.totalEmp > 0 ? Math.round((r.totalCompletos||0) / r.totalEmp * 100) : 0;
      return [r.fecha||'', r.turno||'', r.hi||'', r.hs||'', r.totalEmp||0, r.totalCompletos||0, `${pct}%`];
    }),
    [12,8,10,10,18,18,16]
  );
}

function rpSheetBAS(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Hora','Responsable','Cumplen','No Cumplen','Resultado','Observaciones'],
    rpFilt(DB.bas||[], 'fecha', desde, hasta).map(r => [r.fecha||'', r.hora||'', r.resp||'', r.ok||0, r.fail||0, r.resultado||'', r.obs||'']),
    [12,8,22,10,12,12,35]
  );
}

function rpSheetROD(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Hora','Responsable','Revisadas','En Lugar','Novedades','Total','Resultado','Observaciones'],
    rpFilt(DB.rod||[], 'fecha', desde, hasta).map(r => [r.fecha||'', r.hora||'', r.resp||'', r.totalRev||0, r.totalLugar||0, r.totalNov||0, r.total||0, r.resultado||'', r.obs||'']),
    [12,8,22,11,10,12,8,12,35]
  );
}

function rpSheetFUM(desde, hasta) {
  return rpMakeSheet(
    ['Fecha','Instalación','Mes','Semana','Tipo','Responsable','Resultado','Observaciones'],
    rpFilt(DB.fum||[], 'fecha', desde, hasta).map(r => [r.fecha||'', r.inst||'', r.mes||'', r.sem||'', r.tipo||'', r.resp||'', r.res||'', r.obs||'']),
    [12,22,10,10,18,22,14,35]
  );
}

function rpSheetResumen(desde, hasta, label) {
  const gd   = rpFilt(DB.gastosDiarios||[], 'fecha', desde, hasta);
  const vgt  = rpFilt(DB.vgtVentas||[], 'fecha', desde, hasta);
  const vint = rpFilt(DB.vintVentas||[], 'fecha', desde, hasta);
  const pw   = rpFilt(DB.pedidosWalmart||[], 'fechaEntrega', desde, hasta);
  const gs   = rpFilt(DB.gastosSemanales||[], 'semanaInicio', desde, hasta);

  const totalGastos    = gd.reduce((s,r) => s + (r.monto||0), 0);
  const totalVentasGT  = vgt.reduce((s,r) => s + (r.totalQ||0), 0);
  const totalVentasExp = vint.reduce((s,r) => s + (r.totalGtq||0), 0);
  const totalMaquila   = gs.reduce((s,r) => s + (r.grandTotal||0), 0);

  const porCat = {};
  gd.forEach(r => { const k = rpCatLabel(r.cat); porCat[k] = (porCat[k]||0) + (r.monto||0); });

  const data = [
    [`REPORTE AJÚA BPM — ${label}`], [`Período: ${desde} al ${hasta}`], [],
    ['FINANCIERO', 'Registros', 'Total Q'],
    ['Gastos Diarios', gd.length, totalGastos],
    ['Ventas GT (Locales)', vgt.length, totalVentasGT],
    ['Ventas Exportación', vint.length, totalVentasExp],
    ['Maquila Semanal', gs.length, totalMaquila],
    ['Pedidos Walmart', pw.length, '—'],
    [],
    ['CONTROLES BPM', 'Registros'],
    ['Limpieza Transporte', rpFilt(DB.tl||[], 'fecha', desde, hasta).length],
    ['Despacho Transporte', rpFilt(DB.dt||[], 'fecha', desde, hasta).length],
    ['Acceso y Lavado', rpFilt(DB.al||[], 'fecha', desde, hasta).length],
    ['Básculas', rpFilt(DB.bas||[], 'fecha', desde, hasta).length],
    ['Roedores', rpFilt(DB.rod||[], 'fecha', desde, hasta).length],
    ['Fumigación', rpFilt(DB.fum||[], 'fecha', desde, hasta).length],
    [],
    ['GASTOS POR CATEGORÍA', 'Total Q'],
    ...Object.entries(porCat).sort((a,b) => b[1]-a[1]).map(([k,v]) => [k, v]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:35},{wch:14},{wch:16}];
  return ws;
}

function rpEnsureXLSX(cb) {
  if (window.XLSX) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = cb;
  s.onerror = () => toast('⚠ No se pudo cargar librería Excel', true);
  document.head.appendChild(s);
}

function rpDescargar(periodo) {
  const btn = document.getElementById(`rp-btn-${periodo}`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando...'; }

  rpEnsureXLSX(() => {
    try {
      const {desde, hasta, label} = rpGetRango(periodo);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, rpSheetResumen(desde, hasta, label),  '📊 Resumen');
      XLSX.utils.book_append_sheet(wb, rpSheetGastosDiarios(desde, hasta),   'Gastos Diarios');
      XLSX.utils.book_append_sheet(wb, rpSheetMaquila(desde, hasta),         'Maquila Semanal');
      XLSX.utils.book_append_sheet(wb, rpSheetVentasGT(desde, hasta),        'Ventas GT');
      XLSX.utils.book_append_sheet(wb, rpSheetVentasExport(desde, hasta),    'Ventas Export');
      XLSX.utils.book_append_sheet(wb, rpSheetWalmart(desde, hasta),         'Pedidos Walmart');
      XLSX.utils.book_append_sheet(wb, rpSheetTL(desde, hasta),              'Control TL');
      XLSX.utils.book_append_sheet(wb, rpSheetDT(desde, hasta),              'Control DT');
      XLSX.utils.book_append_sheet(wb, rpSheetAL(desde, hasta),              'Control AL');
      XLSX.utils.book_append_sheet(wb, rpSheetBAS(desde, hasta),             'Control BAS');
      XLSX.utils.book_append_sheet(wb, rpSheetROD(desde, hasta),             'Control ROD');
      XLSX.utils.book_append_sheet(wb, rpSheetFUM(desde, hasta),             'Control FUM');

      const nombre = `AJUA_BPM_${label}_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, nombre);
      toast(`✅ ${nombre} descargado`);
    } catch(e) {
      toast('⚠ Error generando Excel: ' + e.message, true);
      console.error('rpDescargar error:', e);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📥 Descargar'; }
    }
  });
}
