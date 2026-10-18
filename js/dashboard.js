/* ============================================================
   GESTOR DE PASTELERÍA — dashboard.js
   Pantalla de inicio: indicadores clave y gráficos.
   ============================================================ */

const Dashboard = (() => {

  let periodoGraficos = 'mes';
  let charts = [];

  function destroyCharts(){
    charts.forEach(c => c.destroy());
    charts = [];
  }

  function render(container){
    const ventas = Storage.get('ventas');
    const gastos = Storage.get('gastos');
    const productos = Storage.get('productos');
    const insumos = Storage.get('insumos');
    const pedidos = Storage.get('pedidos') || [];
    const hoy = Storage.todayISO();

    const rangoSemana = Analytics.getRange('semana');
    const rangoMes = Analytics.getRange('mes');

    const ventasHoy = ventas.filter(v => v.fecha === hoy);
    const ventasSemana = Analytics.filterByRange(ventas, rangoSemana.start, rangoSemana.end);
    const ventasMes = Analytics.filterByRange(ventas, rangoMes.start, rangoMes.end);
    const gastosMes = Analytics.filterByRange(gastos, rangoMes.start, rangoMes.end);

    const pedidosHoy = pedidos.filter(p => p.fechaEntrega === hoy && p.estado !== 'cancelado');
    const pedidosPendientes = pedidos.filter(p => ['pendiente', 'confirmado', 'en_preparacion'].includes(p.estado));

    const totalVentasHoy = Analytics.sum(ventasHoy, 'total');
    const totalVentasSemana = Analytics.sum(ventasSemana, 'total');
    const totalVentasMes = Analytics.sum(ventasMes, 'total');
    const totalGastosMes = Analytics.sum(gastosMes, 'monto');
    const resultadoMes = totalVentasMes - totalGastosMes;
    const productosVendidosMes = Analytics.sum(ventasMes, 'cantidad');
    const insumosBajos = insumos.filter(i => i.stockActual <= i.stockMinimo);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Inicio</h1>
          <div class="subtitle">Resumen general del negocio</div>
        </div>
        <div class="header-actions">
          <a href="pedir.html" target="_blank" class="btn btn-secondary">
            ${App.svgIcon('external')} Link Pedidos Clientes
          </a>
          <button class="btn btn-primary" onclick="App.goTo('pedidos')">
            ${App.svgIcon('clipboard')} Ver Pedidos (${pedidosPendientes.length})
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card" style="border-left: 4px solid var(--berry);">
          <div class="kpi-label">Encargos para hoy</div>
          <div class="kpi-value" style="color: var(--berry);">${pedidosHoy.length}</div>
          <div class="kpi-hint">${pedidosPendientes.length} encargo(s) en total por preparar</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Ventas de hoy</div>
          <div class="kpi-value">${App.formatCLP(totalVentasHoy)}</div>
          <div class="kpi-hint">${ventasHoy.length} venta(s) directa(s)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Ventas del mes</div>
          <div class="kpi-value">${App.formatCLP(totalVentasMes)}</div>
          <div class="kpi-hint">${ventasMes.length} venta(s)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Resultado estimado del mes</div>
          <div class="kpi-value ${resultadoMes >= 0 ? 'positive' : 'negative'}">${App.formatCLP(resultadoMes)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Productos terminados en vitrina</div>
          <div class="kpi-value">${productos.filter(p => p.tipoStock === 'terminado').length}</div>
          <div class="kpi-hint">${productos.filter(p => p.tipoStock === 'a_pedido').length} tortas a pedido</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Insumos con stock bajo</div>
          <div class="kpi-value ${insumosBajos.length > 0 ? 'negative' : ''}">${insumosBajos.length}</div>
          ${insumosBajos.length > 0 ? `<div class="kpi-hint">${insumosBajos.slice(0,3).map(i => i.nombre).join(', ')}</div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="flex" style="justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
          <h2 class="card-title mt-0">Gráficos</h2>
          <div class="filters-bar" style="margin:0;">
            <div class="field">
              <label>Período</label>
              <select id="periodo-select">
                <option value="semana" ${periodoGraficos==='semana'?'selected':''}>Esta semana</option>
                <option value="mes" ${periodoGraficos==='mes'?'selected':''}>Este mes</option>
                <option value="mesAnterior" ${periodoGraficos==='mesAnterior'?'selected':''}>Mes anterior</option>
                <option value="personalizado" ${periodoGraficos==='personalizado'?'selected':''}>Rango personalizado</option>
              </select>
            </div>
            <div class="field" id="rango-personalizado-wrap" style="display:${periodoGraficos==='personalizado'?'flex':'none'}">
              <label>Desde</label><input type="date" id="rango-desde" value="${hoy}" />
            </div>
            <div class="field" id="rango-personalizado-wrap2" style="display:${periodoGraficos==='personalizado'?'flex':'none'}">
              <label>Hasta</label><input type="date" id="rango-hasta" value="${hoy}" />
            </div>
          </div>
        </div>
        <div class="chart-grid">
          <div><h3 class="category-heading" style="margin-top:0;">Ventas por día</h3><div class="chart-wrap"><canvas id="chart-ventas-dia"></canvas></div></div>
          <div><h3 class="category-heading" style="margin-top:0;">Ventas por categoría</h3><div class="chart-wrap"><canvas id="chart-ventas-categoria"></canvas></div></div>
          <div><h3 class="category-heading" style="margin-top:0;">Productos más vendidos</h3><div class="chart-wrap"><canvas id="chart-top-productos"></canvas></div></div>
          <div><h3 class="category-heading" style="margin-top:0;">Gastos por categoría</h3><div class="chart-wrap"><canvas id="chart-gastos-categoria"></canvas></div></div>
        </div>
      </div>
    `;

    const selPeriodo = document.getElementById('periodo-select');
    selPeriodo.addEventListener('change', () => {
      periodoGraficos = selPeriodo.value;
      document.getElementById('rango-personalizado-wrap').style.display = periodoGraficos === 'personalizado' ? 'flex' : 'none';
      document.getElementById('rango-personalizado-wrap2').style.display = periodoGraficos === 'personalizado' ? 'flex' : 'none';
      if (periodoGraficos !== 'personalizado') drawCharts();
    });
    document.getElementById('rango-desde').addEventListener('change', drawCharts);
    document.getElementById('rango-hasta').addEventListener('change', drawCharts);

    drawCharts();

    function drawCharts(){
      destroyCharts();
      const desde = document.getElementById('rango-desde')?.value;
      const hasta = document.getElementById('rango-hasta')?.value;
      const rango = Analytics.getRange(periodoGraficos, desde, hasta);
      const ventasRango = Analytics.filterByRange(Storage.get('ventas'), rango.start, rango.end);
      const gastosRango = Analytics.filterByRange(Storage.get('gastos'), rango.start, rango.end);

      // Ventas por día
      const porDia = Analytics.groupBy(ventasRango, v => v.fecha);
      const dias = Object.keys(porDia).sort();
      charts.push(new Chart(document.getElementById('chart-ventas-dia'), {
        type: 'line',
        data: {
          labels: dias.map(App.formatDate),
          datasets: [{ label: 'Ventas', data: dias.map(d => Analytics.sum(porDia[d], 'total')), borderColor: '#B5754A', backgroundColor: 'rgba(181,117,74,0.15)', fill: true, tension: 0.3 }]
        },
        options: chartOptions(dias.length === 0)
      }));

      // Ventas por categoría
      const porCategoria = Analytics.groupBy(ventasRango, v => v.categoria || 'Sin categoría');
      const categorias = Object.keys(porCategoria);
      charts.push(new Chart(document.getElementById('chart-ventas-categoria'), {
        type: 'doughnut',
        data: {
          labels: categorias,
          datasets: [{ data: categorias.map(c => Analytics.sum(porCategoria[c], 'total')), backgroundColor: ['#B5754A','#8C4B5C','#6B7F5E','#B9772E','#7A6A5D'] }]
        },
        options: chartOptions(categorias.length === 0)
      }));

      // Productos más vendidos (por cantidad)
      const porProducto = Analytics.groupBy(ventasRango, v => v.productoNombre);
      const topProductos = Object.keys(porProducto)
        .map(nombre => ({ nombre, cantidad: Analytics.sum(porProducto[nombre], 'cantidad') }))
        .sort((a,b) => b.cantidad - a.cantidad)
        .slice(0, 6);
      charts.push(new Chart(document.getElementById('chart-top-productos'), {
        type: 'bar',
        data: { labels: topProductos.map(p => p.nombre), datasets: [{ label: 'Unidades vendidas', data: topProductos.map(p => p.cantidad), backgroundColor: '#8C4B5C' }] },
        options: { ...chartOptions(topProductos.length === 0), indexAxis: 'y' }
      }));

      // Gastos por categoría
      const gastosPorCat = Analytics.groupBy(gastosRango, g => g.tipo || 'Otros');
      const catsGasto = Object.keys(gastosPorCat);
      charts.push(new Chart(document.getElementById('chart-gastos-categoria'), {
        type: 'pie',
        data: { labels: catsGasto, datasets: [{ data: catsGasto.map(c => Analytics.sum(gastosPorCat[c], 'monto')), backgroundColor: ['#B9772E','#8C4B5C','#6B7F5E','#B5754A','#A8434B','#7A6A5D','#3B2A22','#D9A25C'] } ] },
        options: chartOptions(catsGasto.length === 0)
      }));
    }
  }

  function chartOptions(vacio){
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: '#3B2A22', font: { family: 'Karla' } } },
        title: vacio ? { display: true, text: 'Sin datos en este período', color: '#7A6A5D' } : { display: false }
      },
      scales: { }
    };
  }

  return { render };
})();
