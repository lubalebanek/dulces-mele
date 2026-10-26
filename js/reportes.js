/* ============================================================
   GESTOR DE PASTELERÍA — reportes.js
   Resumen de ventas, gastos, rentabilidad por producto,
   cuadratura / cierre diario de caja y exportación a PDF y CSV.
   ============================================================ */

const Reportes = (() => {

  let subTabActivo = 'periodo'; // 'periodo' | 'cierre_caja'
  let periodo = 'mes';
  let fechaCierre = Storage.todayISO();
  let jsPDFLoaded = false;

  function loadJsPDF(){
    return new Promise((resolve, reject) => {
      if (jsPDFLoaded && window.jspdf){ resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = () => { jsPDFLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('No se pudo cargar la librería de PDF. Verifica tu conexión a internet.'));
      document.head.appendChild(script);
    });
  }

  function render(container){
    const hoy = Storage.todayISO();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Reportes y Finanzas</h1>
          <div class="subtitle">Análisis de ingresos, margen de productos y cierre diario de caja</div>
        </div>
        <div class="header-actions" style="display:flex; gap:8px;">
          <button class="btn btn-secondary" id="btn-export-csv">Exportar CSV</button>
          <button class="btn btn-secondary" id="btn-export-pdf">Exportar PDF</button>
        </div>
      </div>

      <!-- PESTAÑAS PRINCIPALES -->
      <div style="display:flex; gap:8px; margin-bottom:16px; border-bottom:1px solid var(--line); padding-bottom:8px;">
        <button class="btn ${subTabActivo === 'periodo' ? 'btn-primary' : 'btn-ghost'}" id="tab-btn-periodo" style="font-weight:600;">
          📊 Resumen y Rentabilidad
        </button>
        <button class="btn ${subTabActivo === 'cierre_caja' ? 'btn-primary' : 'btn-ghost'}" id="tab-btn-cierre" style="font-weight:600;">
          🔒 Cierre Diario de Caja (Cuadratura)
        </button>
      </div>

      <div id="subtab-contenido"></div>
    `;

    document.getElementById('tab-btn-periodo').addEventListener('click', () => {
      subTabActivo = 'periodo';
      render(container);
    });
    document.getElementById('tab-btn-cierre').addEventListener('click', () => {
      subTabActivo = 'cierre_caja';
      render(container);
    });
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);

    const wrapContenido = document.getElementById('subtab-contenido');
    if (subTabActivo === 'cierre_caja') {
      renderCierreCaja(wrapContenido);
    } else {
      renderReportePeriodo(wrapContenido);
    }
  }

  /* ---------------- SUBTAB: CIERRE DIARIO DE CAJA ---------------- */
  function renderCierreCaja(container){
    const ventas = Storage.get('ventas') || [];
    const gastos = Storage.get('gastos') || [];
    const pedidos = Storage.get('pedidos') || [];

    // Filtrar por la fecha de cierre elegida
    const ventasDia = ventas.filter(v => v.fecha === fechaCierre);
    const gastosDia = gastos.filter(g => g.fecha === fechaCierre);
    const pedidosEntregadosDia = pedidos.filter(p => p.fechaEntrega === fechaCierre && p.estado === 'entregado');

    // Desglose de Ventas del día
    const ventasMeson = ventasDia.filter(v => !v.pedidoId && !v.pedidoCodigo);
    const ventasWeb = ventasDia.filter(v => v.pedidoId || v.pedidoCodigo);

    const efvoMeson = Analytics.sum(ventasMeson.filter(v => v.medioPago === 'Efectivo'), 'total');
    const efvoWeb = Analytics.sum(ventasWeb.filter(v => v.medioPago === 'Efectivo'), 'total');
    const totalEfectivoEntrante = efvoMeson + efvoWeb;

    const transfMeson = Analytics.sum(ventasMeson.filter(v => v.medioPago !== 'Efectivo'), 'total');
    const transfWeb = Analytics.sum(ventasWeb.filter(v => v.medioPago !== 'Efectivo'), 'total');
    const totalBancos = transfMeson + transfWeb;

    // Gastos en efectivo pagados desde la caja
    const gastosEfectivo = gastosDia.filter(g => g.medioPago === 'Efectivo');
    const totalGastosEfectivo = Analytics.sum(gastosEfectivo, 'monto');

    // Gastos pagados con transferencia/banco
    const gastosBancos = gastosDia.filter(g => g.medioPago !== 'Efectivo');
    const totalGastosBancos = Analytics.sum(gastosBancos, 'monto');

    // Efectivo Neto en Cajón
    const efectivoNetoCajon = Math.max(0, totalEfectivoEntrante - totalGastosEfectivo);
    const totalVendidoDia = totalEfectivoEntrante + totalBancos;

    container.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="flex" style="justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div class="field" style="margin:0;">
            <label style="font-weight:700;">Fecha de Cierre de Caja</label>
            <input type="date" id="cierre-fecha-input" value="${fechaCierre}" style="font-weight:600;" />
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary" id="btn-cierre-wsp" style="background:#25D366; border-color:#25D366; font-weight:600;">
              ${App.svgIcon('whatsapp')} Enviar Cierre por WhatsApp
            </button>
            <button class="btn btn-secondary" onclick="window.print()">🖨️ Imprimir</button>
          </div>
        </div>
      </div>

      <!-- GRAN CAJA DE EFECTIVO -->
      <div class="card" style="border-left:5px solid var(--accent); margin-bottom:16px;">
        <h3 class="category-heading" style="margin-top:0;">💵 Cuadratura de Efectivo Físico (Cajón de Dinero)</h3>
        <p class="text-soft" style="font-size:13px; margin-bottom:16px;">Dinero en billetes y monedas que debe haber en la pastelería para la fecha ${App.formatDate(fechaCierre)}:</p>

        <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
          <div class="kpi-card" style="background:var(--surface-2);">
            <div class="kpi-label">(+) Efectivo Ventas Mesón</div>
            <div class="kpi-value" style="color:var(--sage); font-size:1.4rem;">${App.formatCLP(efvoMeson)}</div>
            <div class="kpi-hint">${ventasMeson.filter(v => v.medioPago === 'Efectivo').length} venta(s) mostrador</div>
          </div>
          <div class="kpi-card" style="background:var(--surface-2);">
            <div class="kpi-label">(+) Efectivo Pedidos Web</div>
            <div class="kpi-value" style="color:var(--sage); font-size:1.4rem;">${App.formatCLP(efvoWeb)}</div>
            <div class="kpi-hint">${ventasWeb.filter(v => v.medioPago === 'Efectivo').length} cobro(s) de pedidos</div>
          </div>
          <div class="kpi-card" style="background:var(--surface-2);">
            <div class="kpi-label">(-) Gastos Pagados en Efectivo</div>
            <div class="kpi-value" style="color:var(--danger); font-size:1.4rem;">- ${App.formatCLP(totalGastosEfectivo)}</div>
            <div class="kpi-hint">${gastosEfectivo.length} salida(s) de caja</div>
          </div>
          <div class="kpi-card" style="background:var(--berry-soft); border:2px solid var(--berry);">
            <div class="kpi-label" style="font-weight:700; color:var(--berry);">(=) EFECTIVO EN CAJÓN</div>
            <div class="kpi-value" style="font-size:1.8rem; font-weight:800; color:var(--berry);">${App.formatCLP(efectivoNetoCajon)}</div>
            <div class="kpi-hint" style="color:var(--ink);">Billetes y monedas físicos</div>
          </div>
        </div>

        ${gastosEfectivo.length > 0 ? `
          <div style="margin-top:14px; padding:10px 14px; background:var(--surface-2); border-radius:var(--radius-sm); font-size:13px;">
            <strong>Salidas en efectivo registradas hoy:</strong>
            <ul style="margin:4px 0 0 16px; padding:0;">
              ${gastosEfectivo.map(g => `<li>${escapeHtml(g.descripcion)}: <strong>${App.formatCLP(g.monto)}</strong> (${g.tipo || 'Gasto'})</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      <!-- RESUMEN BANCARIO Y TOTAL GENERAL -->
      <div class="card">
        <h3 class="category-heading" style="margin-top:0;">💳 Dinero en Bancos y Ventas Totales del Día</h3>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Transferencias / Tarjetas recibidas</div>
            <div class="kpi-value" style="color:var(--accent-dark);">${App.formatCLP(totalBancos)}</div>
            <div class="kpi-hint">Mesón: ${App.formatCLP(transfMeson)} | Web: ${App.formatCLP(transfWeb)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Ventas Totales del Día</div>
            <div class="kpi-value" style="font-weight:700;">${App.formatCLP(totalVendidoDia)}</div>
            <div class="kpi-hint">${ventasDia.length} transacción(es) en total</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Gastos Totales del Día</div>
            <div class="kpi-value" style="color:var(--danger);">${App.formatCLP(totalGastosEfectivo + totalGastosBancos)}</div>
            <div class="kpi-hint">Efectivo + transferencias</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Resultado Neto del Día</div>
            <div class="kpi-value ${(totalVendidoDia - (totalGastosEfectivo + totalGastosBancos)) >= 0 ? 'positive' : 'negative'}">
              ${App.formatCLP(totalVendidoDia - (totalGastosEfectivo + totalGastosBancos))}
            </div>
            <div class="kpi-hint">Ganancia bruta diaria</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('cierre-fecha-input')?.addEventListener('change', (e) => {
      fechaCierre = e.target.value;
      renderCierreCaja(container);
    });

    document.getElementById('btn-cierre-wsp')?.addEventListener('click', () => {
      const msg = `*🍰 CIERRE DE CAJA — DULCES MELE*%0A` +
        `🗓 *Fecha:* ${App.formatDate(fechaCierre)}%0A%0A` +
        `💵 *Efectivo en cajón físico:* ${App.formatCLP(efectivoNetoCajon)}%0A` +
        `  • Ventas en efvo: ${App.formatCLP(totalEfectivoEntrante)}%0A` +
        `  • Gastos en efvo: -${App.formatCLP(totalGastosEfectivo)}%0A%0A` +
        `💳 *Banco / Transferencias:* ${App.formatCLP(totalBancos)}%0A` +
        `💰 *TOTAL VENTAS DEL DÍA:* ${App.formatCLP(totalVendidoDia)}%0A` +
        `📦 *Pedidos entregados:* ${pedidosEntregadosDia.length}%0A%0A` +
        `_Caja verificada con éxito por Andrea Lebanek._`;

      window.open(`https://wa.me/?text=${msg}`, '_blank');
    });
  }

  /* ---------------- SUBTAB: RESUMEN Y RENTABILIDAD POR PERÍODO ---------------- */
  function renderReportePeriodo(container){
    const hoy = Storage.todayISO();

    container.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="filters-bar" style="margin:0;">
          <div class="field">
            <label>Período de análisis</label>
            <select id="rep-periodo">
              <option value="semana" ${periodo==='semana'?'selected':''}>Semana actual</option>
              <option value="mes" ${periodo==='mes'?'selected':''}>Mes actual</option>
              <option value="mesAnterior" ${periodo==='mesAnterior'?'selected':''}>Mes anterior</option>
              <option value="personalizado" ${periodo==='personalizado'?'selected':''}>Rango personalizado</option>
            </select>
          </div>
          <div class="field" id="rep-desde-wrap" style="display:${periodo==='personalizado'?'flex':'none'};">
            <label>Desde</label><input type="date" id="rep-desde" value="${hoy}" />
          </div>
          <div class="field" id="rep-hasta-wrap" style="display:${periodo==='personalizado'?'flex':'none'};">
            <label>Hasta</label><input type="date" id="rep-hasta" value="${hoy}" />
          </div>
        </div>
      </div>

      <div id="reporte-periodo-contenido"></div>
    `;

    const sel = document.getElementById('rep-periodo');
    sel.addEventListener('change', () => {
      periodo = sel.value;
      const mostrar = periodo === 'personalizado' ? 'flex' : 'none';
      document.getElementById('rep-desde-wrap').style.display = mostrar;
      document.getElementById('rep-hasta-wrap').style.display = mostrar;
      renderDetallePeriodo();
    });
    document.getElementById('rep-desde').addEventListener('change', renderDetallePeriodo);
    document.getElementById('rep-hasta').addEventListener('change', renderDetallePeriodo);

    renderDetallePeriodo();

    function renderDetallePeriodo(){
      const desde = document.getElementById('rep-desde')?.value;
      const hasta = document.getElementById('rep-hasta')?.value;
      const rango = Analytics.getRange(periodo, desde, hasta);
      const ventas = Analytics.filterByRange(Storage.get('ventas'), rango.start, rango.end);
      const gastos = Analytics.filterByRange(Storage.get('gastos'), rango.start, rango.end);

      const totalVentas = Analytics.sum(ventas, 'total');
      const totalGastos = Analytics.sum(gastos, 'monto');
      const resultado = totalVentas - totalGastos;
      const margen = totalVentas > 0 ? (resultado / totalVentas * 100) : 0;
      const numVentas = ventas.length;
      const ticketPromedio = numVentas > 0 ? totalVentas / numVentas : 0;
      const unidadesVendidas = Analytics.sum(ventas, 'cantidad');

      // Canales: Web vs Mesón
      const ventasWeb = ventas.filter(v => v.pedidoId || v.pedidoCodigo);
      const ventasMeson = ventas.filter(v => !v.pedidoId && !v.pedidoCodigo);
      const totalWeb = Analytics.sum(ventasWeb, 'total');
      const totalMeson = Analytics.sum(ventasMeson, 'total');
      const pctWeb = totalVentas > 0 ? Math.round((totalWeb / totalVentas) * 100) : 0;
      const pctMeson = totalVentas > 0 ? Math.round((totalMeson / totalVentas) * 100) : 0;

      // Ranking de productos por Ingresos ($ CLP)
      const porProducto = Analytics.groupBy(ventas, v => v.productoNombre);
      const rankingIngresos = Object.entries(porProducto)
        .map(([nombre, arr]) => ({
          nombre,
          total: Analytics.sum(arr, 'total'),
          cantidad: Analytics.sum(arr, 'cantidad')
        }))
        .sort((a,b) => b.total - a.total);

      const gastosPorCat = Analytics.groupBy(gastos, g => g.tipo || 'Otros');
      const gastosPrincipales = [...gastos].sort((a,b) => b.monto - a.monto).slice(0,5);

      document.getElementById('reporte-periodo-contenido').innerHTML = `
        <div class="card">
          <p class="text-soft" style="margin-bottom:16px;">
            Período analizado: <strong>${App.formatDate(rango.start)}</strong> al <strong>${App.formatDate(rango.end)}</strong>
          </p>

          <h3 class="category-heading" style="margin-top:0;">Resumen Financiero</h3>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label">Total vendido</div><div class="kpi-value">${App.formatCLP(totalVentas)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Total de gastos</div><div class="kpi-value" style="color:var(--danger);">${App.formatCLP(totalGastos)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Resultado estimado</div><div class="kpi-value ${resultado>=0?'positive':'negative'}">${App.formatCLP(resultado)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Margen comercial</div><div class="kpi-value ${margen>=0?'positive':'negative'}">${margen.toFixed(1)}%</div></div>
            <div class="kpi-card"><div class="kpi-label">Ticket promedio</div><div class="kpi-value">${App.formatCLP(ticketPromedio)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Unidades vendidas</div><div class="kpi-value">${unidadesVendidas} un.</div></div>
          </div>

          <!-- COMPARATIVA DE CANALES: WEB VS MESÓN -->
          <h3 class="category-heading" style="margin-top:20px;">Ventas por Canal: Tienda Web vs Mesón Físico</h3>
          <div class="kpi-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="kpi-card" style="border-left:4px solid var(--berry); background:var(--surface-2);">
              <div class="kpi-label">📦 Encargos y Pedidos Web</div>
              <div class="kpi-value" style="color:var(--berry);">${App.formatCLP(totalWeb)}</div>
              <div class="kpi-hint"><strong>${pctWeb}%</strong> del total (${ventasWeb.length} ventas)</div>
            </div>
            <div class="kpi-card" style="border-left:4px solid var(--sage); background:var(--surface-2);">
              <div class="kpi-label">🏪 Ventas de Mesón / Vitrina</div>
              <div class="kpi-value" style="color:var(--sage);">${App.formatCLP(totalMeson)}</div>
              <div class="kpi-hint"><strong>${pctMeson}%</strong> del total (${ventasMeson.length} ventas)</div>
            </div>
          </div>

          <!-- RANKING PRODUCTOS MÁS RENTABLES -->
          <h3 class="category-heading" style="margin-top:20px;">🏆 Productos que Generaron Más Dinero ($ CLP)</h3>
          ${rankingIngresos.length === 0 ? `
            <p class="text-soft">No hay ventas registradas en este período.</p>
          ` : `
            <div class="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Producto</th><th style="text-align:center;">Unidades</th><th style="text-align:right;">Ingreso Total ($)</th><th style="text-align:right;">% del Total</th></tr></thead>
                <tbody>
                  ${rankingIngresos.slice(0, 6).map((p, idx) => `
                    <tr>
                      <td><strong>#${idx + 1}</strong></td>
                      <td><strong>${escapeHtml(p.nombre)}</strong></td>
                      <td style="text-align:center;">${p.cantidad} un.</td>
                      <td style="text-align:right; font-weight:700;">${App.formatCLP(p.total)}</td>
                      <td style="text-align:right;">${totalVentas > 0 ? Math.round((p.total / totalVentas) * 100) : 0}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}

          <!-- GASTOS PRINCIPALES -->
          <h3 class="category-heading" style="margin-top:20px;">Gastos Principales</h3>
          <div class="kpi-grid">
            ${Object.keys(gastosPorCat).slice(0, 4).map(cat => `
              <div class="kpi-card">
                <div class="kpi-label">${cat}</div>
                <div class="kpi-value" style="font-size:1.2rem;">${App.formatCLP(Analytics.sum(gastosPorCat[cat],'monto'))}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  function getDatosReporte(){
    const desde = document.getElementById('rep-desde')?.value;
    const hasta = document.getElementById('rep-hasta')?.value;
    const rango = Analytics.getRange(periodo, desde, hasta);
    const ventas = Analytics.filterByRange(Storage.get('ventas'), rango.start, rango.end);
    const gastos = Analytics.filterByRange(Storage.get('gastos'), rango.start, rango.end);
    return { rango, ventas, gastos };
  }

  async function exportPDF(){
    try{
      App.toast('Generando PDF…');
      await loadJsPDF();
      const { rango, ventas, gastos } = getDatosReporte();
      const totalVentas = Analytics.sum(ventas, 'total');
      const totalGastos = Analytics.sum(gastos, 'monto');
      const resultado = totalVentas - totalGastos;

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      let y = 18;
      doc.setFontSize(16);
      doc.text('Dulces Mele — Reporte Financiero', 14, y); y += 8;
      doc.setFontSize(10);
      doc.text(`Pastelería Artesanal Andrea Lebanek`, 14, y); y += 6;
      doc.text(`Período: ${App.formatDate(rango.start)} al ${App.formatDate(rango.end)}`, 14, y); y += 10;

      doc.setFontSize(12);
      doc.text('Resumen General', 14, y); y += 7;
      doc.setFontSize(10);
      [
        ['Ventas totales', App.formatCLP(totalVentas)],
        ['Gastos totales', App.formatCLP(totalGastos)],
        ['Resultado estimado', App.formatCLP(resultado)],
        ['Número de ventas', String(ventas.length)],
        ['Unidades vendidas', String(Analytics.sum(ventas,'cantidad'))]
      ].forEach(([k,v]) => { doc.text(`${k}: ${v}`, 14, y); y += 6; });

      y += 6;
      doc.setFontSize(12);
      doc.text('Detalle de ventas', 14, y); y += 7;
      doc.setFontSize(8);
      ventas.slice(0, 40).forEach(v => {
        if (y > 280){ doc.addPage(); y = 18; }
        doc.text(`${App.formatDate(v.fecha)} | ${v.productoNombre} | x${v.cantidad} | ${App.formatCLP(v.total)} (${v.medioPago})`, 14, y);
        y += 5;
      });
      if (ventas.length > 40){ doc.text(`… y ${ventas.length - 40} venta(s) más. Ver CSV para lista completa.`, 14, y); }

      doc.save(`reporte-dulces-mele-${rango.start}-a-${rango.end}.pdf`);
      App.toast('PDF descargado con éxito');
    }catch(err){
      App.toast(err.message || 'No se pudo generar el PDF.', 'error');
    }
  }

  function exportCSV(){
    const { rango, ventas, gastos } = getDatosReporte();
    const rows = [];
    rows.push(['Dulces Mele — Reporte']);
    rows.push([`Período: ${rango.start} a ${rango.end}`]);
    rows.push([]);
    rows.push(['VENTAS']);
    rows.push(['Fecha','Producto','Categoría','Cantidad','Precio unitario','Total','Medio de pago','Origen']);
    ventas.forEach(v => rows.push([v.fecha, v.productoNombre, v.categoria, v.cantidad, v.precioUnitario, v.total, v.medioPago, v.pedidoCodigo ? `Pedido #${v.pedidoCodigo}` : 'Mesón']));
    rows.push([]);
    rows.push(['GASTOS']);
    rows.push(['Fecha','Tipo','Descripción','Proveedor','Monto','Medio de pago']);
    gastos.forEach(g => rows.push([g.fecha, g.tipo, g.descripcion, g.proveedor, g.monto, g.medioPago]));

    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-dulces-mele-${rango.start}-a-${rango.end}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    App.toast('CSV descargado con éxito');
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function csvEscape(val){
    const s = String(val ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }

  return { render };
})();
