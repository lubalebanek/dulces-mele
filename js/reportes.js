/* ============================================================
   GESTOR DE PASTELERÍA — reportes.js
   Resumen de ventas, gastos y resultado estimado por período,
   además del reporte mensual con exportación a PDF y CSV.
   Las librerías de exportación (jsPDF) se cargan sólo cuando se
   necesitan, para no penalizar la carga inicial de la app.
   ============================================================ */

const Reportes = (() => {

  let periodo = 'mes';
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
          <h1>Reportes</h1>
          <div class="subtitle">Resumen de ventas, gastos y resultado</div>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" id="btn-export-csv">Exportar CSV</button>
          <button class="btn btn-secondary" id="btn-export-pdf">Exportar PDF</button>
        </div>
      </div>

      <div class="card">
        <div class="filters-bar">
          <div class="field">
            <label>Período</label>
            <select id="rep-periodo">
              <option value="semana">Semana</option>
              <option value="mes" selected>Mes</option>
              <option value="mesAnterior">Mes anterior</option>
              <option value="personalizado">Rango personalizado</option>
            </select>
          </div>
          <div class="field" id="rep-desde-wrap" style="display:none;"><label>Desde</label><input type="date" id="rep-desde" value="${hoy}" /></div>
          <div class="field" id="rep-hasta-wrap" style="display:none;"><label>Hasta</label><input type="date" id="rep-hasta" value="${hoy}" /></div>
        </div>
      </div>

      <div id="reporte-contenido"></div>
    `;

    const sel = document.getElementById('rep-periodo');
    sel.addEventListener('change', () => {
      periodo = sel.value;
      const mostrar = periodo === 'personalizado' ? 'flex' : 'none';
      document.getElementById('rep-desde-wrap').style.display = mostrar;
      document.getElementById('rep-hasta-wrap').style.display = mostrar;
      renderReporte();
    });
    document.getElementById('rep-desde').addEventListener('change', renderReporte);
    document.getElementById('rep-hasta').addEventListener('change', renderReporte);
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);

    renderReporte();

    function getDatos(){
      const desde = document.getElementById('rep-desde')?.value;
      const hasta = document.getElementById('rep-hasta')?.value;
      const rango = Analytics.getRange(periodo, desde, hasta);
      const ventas = Analytics.filterByRange(Storage.get('ventas'), rango.start, rango.end);
      const gastos = Analytics.filterByRange(Storage.get('gastos'), rango.start, rango.end);
      return { rango, ventas, gastos };
    }

    function renderReporte(){
      const { rango, ventas, gastos } = getDatos();
      const totalVentas = Analytics.sum(ventas, 'total');
      const totalGastos = Analytics.sum(gastos, 'monto');
      const resultado = totalVentas - totalGastos;
      const margen = totalVentas > 0 ? (resultado / totalVentas * 100) : 0;
      const numVentas = ventas.length;
      const ticketPromedio = numVentas > 0 ? totalVentas / numVentas : 0;
      const unidadesVendidas = Analytics.sum(ventas, 'cantidad');

      const porProducto = Analytics.groupBy(ventas, v => v.productoNombre);
      const productoTop = Object.entries(porProducto).map(([n, arr]) => ({ nombre: n, cantidad: Analytics.sum(arr, 'cantidad') })).sort((a,b)=>b.cantidad-a.cantidad)[0];

      const porCategoria = Analytics.groupBy(ventas, v => v.categoria || 'Sin categoría');
      const categoriaTop = Object.entries(porCategoria).map(([n, arr]) => ({ nombre: n, total: Analytics.sum(arr, 'total') })).sort((a,b)=>b.total-a.total)[0];

      const gastosPorCat = Analytics.groupBy(gastos, g => g.tipo || 'Otros');
      const gastosPrincipales = [...gastos].sort((a,b) => b.monto - a.monto).slice(0,5);

      document.getElementById('reporte-contenido').innerHTML = `
        <div class="card">
          <p class="text-soft" style="margin-bottom:16px;">Período: ${App.formatDate(rango.start)} al ${App.formatDate(rango.end)}</p>

          <h3 class="category-heading" style="margin-top:0;">Resumen de ventas</h3>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label">Total vendido</div><div class="kpi-value">${App.formatCLP(totalVentas)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Número de ventas</div><div class="kpi-value">${numVentas}</div></div>
            <div class="kpi-card"><div class="kpi-label">Productos vendidos</div><div class="kpi-value">${unidadesVendidas}</div></div>
            <div class="kpi-card"><div class="kpi-label">Ticket promedio</div><div class="kpi-value">${App.formatCLP(ticketPromedio)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Producto más vendido</div><div class="kpi-value" style="font-size:1.1rem;">${productoTop ? productoTop.nombre : '—'}</div></div>
            <div class="kpi-card"><div class="kpi-label">Categoría con mayores ventas</div><div class="kpi-value" style="font-size:1.1rem;">${categoriaTop ? categoriaTop.nombre : '—'}</div></div>
          </div>

          <h3 class="category-heading">Resumen de gastos</h3>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label">Total de gastos</div><div class="kpi-value">${App.formatCLP(totalGastos)}</div></div>
            ${Object.keys(gastosPorCat).slice(0,3).map(cat => `<div class="kpi-card"><div class="kpi-label">${cat}</div><div class="kpi-value" style="font-size:1.2rem;">${App.formatCLP(Analytics.sum(gastosPorCat[cat],'monto'))}</div></div>`).join('')}
          </div>
          ${gastosPrincipales.length > 0 ? `
          <div class="table-wrap section-block">
            <table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th></tr></thead>
            <tbody>${gastosPrincipales.map(g => `<tr><td>${App.formatDate(g.fecha)}</td><td>${Productos.escapeHtml(g.descripcion)}</td><td>${g.tipo}</td><td>${App.formatCLP(g.monto)}</td></tr>`).join('')}</tbody></table>
          </div>` : ''}

          <h3 class="category-heading">Resultado</h3>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label">Resultado estimado</div><div class="kpi-value ${resultado>=0?'positive':'negative'}">${App.formatCLP(resultado)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Margen estimado</div><div class="kpi-value ${margen>=0?'positive':'negative'}">${margen.toFixed(1)}%</div></div>
          </div>
          <p class="form-hint">"Resultado estimado" y "Margen estimado" porque este cálculo aún no considera todos los costos indirectos ni depreciaciones.</p>
        </div>

        <div class="card">
          <h3 class="category-heading" style="margin-top:0;">Reporte mensual — ${new Date(rango.start+'T00:00:00').toLocaleDateString('es-CL',{month:'long', year:'numeric'})}</h3>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label">Ventas</div><div class="kpi-value">${App.formatCLP(totalVentas)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Gastos</div><div class="kpi-value">${App.formatCLP(totalGastos)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Resultado estimado</div><div class="kpi-value ${resultado>=0?'positive':'negative'}">${App.formatCLP(resultado)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Productos vendidos</div><div class="kpi-value">${unidadesVendidas} unidades</div></div>
            ${Object.entries(porCategoria).map(([cat, arr]) => `<div class="kpi-card"><div class="kpi-label">${cat}</div><div class="kpi-value" style="font-size:1.2rem;">${Analytics.sum(arr,'cantidad')} unidades</div></div>`).join('')}
          </div>
        </div>
      `;
    }

    async function exportPDF(){
      try{
        App.toast('Generando PDF…');
        await loadJsPDF();
        const { rango, ventas, gastos } = getDatos();
        const totalVentas = Analytics.sum(ventas, 'total');
        const totalGastos = Analytics.sum(gastos, 'monto');
        const resultado = totalVentas - totalGastos;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 18;
        doc.setFontSize(16);
        doc.text('Dulces Mele — Reporte', 14, y); y += 8;
        doc.setFontSize(10);
        doc.text(`Período: ${App.formatDate(rango.start)} al ${App.formatDate(rango.end)}`, 14, y); y += 10;

        doc.setFontSize(12);
        doc.text('Resumen', 14, y); y += 7;
        doc.setFontSize(10);
        [
          ['Ventas totales', App.formatCLP(totalVentas)],
          ['Gastos totales', App.formatCLP(totalGastos)],
          ['Resultado estimado', App.formatCLP(resultado)],
          ['Número de ventas', String(ventas.length)],
          ['Unidades vendidas', String(Analytics.sum(ventas,'cantidad'))]
        ].forEach(([k,v]) => { doc.text(`${k}: ${v}`, 14, y); y += 6; });

        y += 4;
        doc.setFontSize(12);
        doc.text('Detalle de ventas', 14, y); y += 7;
        doc.setFontSize(8);
        ventas.slice(0, 45).forEach(v => {
          if (y > 280){ doc.addPage(); y = 18; }
          doc.text(`${App.formatDate(v.fecha)}  ${v.productoNombre}  x${v.cantidad}  ${App.formatCLP(v.total)}`, 14, y);
          y += 5;
        });
        if (ventas.length > 45){ doc.text(`… y ${ventas.length - 45} venta(s) más (ver CSV para el detalle completo)`, 14, y); }

        doc.save(`reporte-pasteleria-${rango.start}-a-${rango.end}.pdf`);
        App.toast('PDF descargado correctamente');
      }catch(err){
        App.toast(err.message || 'No se pudo generar el PDF.', 'error');
      }
    }

    function exportCSV(){
      const { rango, ventas, gastos } = getDatos();
      const rows = [];
      rows.push(['Reporte Dulces Mele']);
      rows.push([`Período: ${rango.start} a ${rango.end}`]);
      rows.push([]);
      rows.push(['VENTAS']);
      rows.push(['Fecha','Producto','Categoría','Cantidad','Precio unitario','Total','Medio de pago']);
      ventas.forEach(v => rows.push([v.fecha, v.productoNombre, v.categoria, v.cantidad, v.precioUnitario, v.total, v.medioPago]));
      rows.push([]);
      rows.push(['GASTOS']);
      rows.push(['Fecha','Tipo','Descripción','Proveedor','Monto','Medio de pago']);
      gastos.forEach(g => rows.push([g.fecha, g.tipo, g.descripcion, g.proveedor, g.monto, g.medioPago]));

      const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-pasteleria-${rango.start}-a-${rango.end}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      App.toast('CSV descargado correctamente');
    }

    function csvEscape(val){
      const s = String(val ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    }
  }

  return { render };
})();
