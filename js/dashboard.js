/* ============================================================
   GESTOR DE PASTELERÍA — dashboard.js
   Pantalla de inicio: agenda de entregas del día, arqueo rápido de caja,
   indicadores clave (KPIs) y gráficos de ventas/gastos.
   ============================================================ */

const Dashboard = (() => {

  let periodoGraficos = 'mes';
  let charts = [];

  function destroyCharts(){
    charts.forEach(c => c.destroy());
    charts = [];
  }

  function render(container){
    const ventas = Storage.get('ventas') || [];
    const gastos = Storage.get('gastos') || [];
    const productos = Storage.get('productos') || [];
    const insumos = Storage.get('insumos') || [];
    const pedidos = Storage.get('pedidos') || [];
    const hoy = Storage.todayISO();

    // Fecha de mañana en formato YYYY-MM-DD
    const mananaDate = new Date();
    mananaDate.setDate(mananaDate.getDate() + 1);
    const manana = mananaDate.toISOString().slice(0, 10);

    const rangoSemana = Analytics.getRange('semana');
    const rangoMes = Analytics.getRange('mes');

    // Cálculos de ventas
    const ventasHoy = ventas.filter(v => v.fecha === hoy);
    const totalVentasHoy = Analytics.sum(ventasHoy, 'total');
    const efectivoHoy = Analytics.sum(ventasHoy.filter(v => v.medioPago === 'Efectivo'), 'total');
    const bancosHoy = Analytics.sum(ventasHoy.filter(v => v.medioPago !== 'Efectivo'), 'total');

    // Gastos de hoy
    const gastosHoy = gastos.filter(g => g.fecha === hoy);
    const gastosEfectivoHoy = Analytics.sum(gastosHoy.filter(g => g.medioPago === 'Efectivo'), 'monto');
    const efectivoCajaEstimado = Math.max(0, efectivoHoy - gastosEfectivoHoy);

    const ventasMes = Analytics.filterByRange(ventas, rangoMes.start, rangoMes.end);
    const gastosMes = Analytics.filterByRange(gastos, rangoMes.start, rangoMes.end);
    const totalVentasMes = Analytics.sum(ventasMes, 'total');
    const totalGastosMes = Analytics.sum(gastosMes, 'monto');
    const resultadoMes = totalVentasMes - totalGastosMes;

    // Pedidos
    const pedidosPendientes = pedidos.filter(p => ['pendiente', 'confirmado', 'en_preparacion'].includes(p.estado));
    const pedidosHoy = pedidos.filter(p => p.fechaEntrega === hoy && p.estado !== 'cancelado');
    const pedidosManana = pedidos.filter(p => p.fechaEntrega === manana && p.estado !== 'cancelado');
    const pedidosProximos = pedidos
      .filter(p => (p.fechaEntrega === hoy || p.fechaEntrega === manana) && p.estado !== 'cancelado')
      .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega) || (a.horaEntrega || '').localeCompare(b.horaEntrega || ''));

    const saldosPendientesTotal = pedidos
      .filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado')
      .reduce((sum, p) => sum + (Number(p.saldoPendiente) || 0), 0);

    const insumosBajos = insumos.filter(i => (Number(i.stockActual) || 0) <= (Number(i.stockMinimo) || 0));

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Inicio</h1>
          <div class="subtitle">Panel de control de Andrea Lebanek — Dulces Mele</div>
        </div>
        <div class="header-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-primary" id="btn-dash-pos" style="background:#2D6A4F; border-color:#2D6A4F;">
            🛒 Venta de Mesón
          </button>
          <button class="btn btn-secondary" id="btn-dash-pedido">
            ${App.svgIcon('clipboard')} + Nuevo Encargo
          </button>
          <a href="pedir.html" target="_blank" class="btn btn-secondary">
            ${App.svgIcon('external')} Tienda Clientes
          </a>
        </div>
      </div>

      <!-- KPIs PRINCIPALES -->
      <div class="kpi-grid">
        <div class="kpi-card" style="border-left: 4px solid var(--berry);">
          <div class="kpi-label">Encargos para hoy</div>
          <div class="kpi-value" style="color: var(--berry);">${pedidosHoy.length}</div>
          <div class="kpi-hint">${pedidosPendientes.length} encargo(s) pendientes en total</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Ventas del día (Hoy)</div>
          <div class="kpi-value">${App.formatCLP(totalVentasHoy)}</div>
          <div class="kpi-hint">💵 ${App.formatCLP(efectivoHoy)} efvo. | 💳 ${App.formatCLP(bancosHoy)} transf.</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Saldos por cobrar</div>
          <div class="kpi-value" style="color: var(--danger);">${App.formatCLP(saldosPendientesTotal)}</div>
          <div class="kpi-hint">De clientes con pedidos reservados</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Ventas del mes</div>
          <div class="kpi-value">${App.formatCLP(totalVentasMes)}</div>
          <div class="kpi-hint">${ventasMes.length} venta(s) registradas</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Resultado estimado del mes</div>
          <div class="kpi-value ${resultadoMes >= 0 ? 'positive' : 'negative'}">${App.formatCLP(resultadoMes)}</div>
          <div class="kpi-hint">Ventas menos gastos del mes</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Insumos bajo mínimo</div>
          <div class="kpi-value ${insumosBajos.length > 0 ? 'negative' : ''}">${insumosBajos.length}</div>
          <div class="kpi-hint">${insumosBajos.length > 0 ? insumosBajos.slice(0,2).map(i=>i.nombre).join(', ') : 'Todo con buen stock ✓'}</div>
        </div>
      </div>

      <!-- SECCIÓN: AGENDA DE ENTREGAS INMEDIATAS (HOY Y MAÑANA) -->
      <div class="card" style="margin-top: 20px; border-top: 4px solid var(--berry);">
        <div class="flex" style="justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <div>
            <h2 class="card-title mt-0" style="display:flex; align-items:center; gap:8px;">
              <span>🎂</span> Entregas Programadas (Hoy y Mañana)
            </h2>
            <div class="text-soft" style="font-size:13px;">Revisa las tortas y encargos que deben salir del taller</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="App.goTo('pedidos')">Ver todos los pedidos →</button>
        </div>

        ${pedidosProximos.length === 0 ? `
          <div class="empty-state" style="padding: 24px 12px; background: var(--surface-2); border-radius: var(--radius-sm);">
            <div style="font-size: 28px; margin-bottom: 6px;">✨</div>
            <h4 style="margin:0 0 4px 0;">¡Todo al día en el taller!</h4>
            <p class="text-soft" style="margin:0; font-size:13px;">No hay encargos agendados para hoy ni mañana. ¡Buen momento para preparar vitrina o adelantar masas!</p>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${pedidosProximos.map(p => {
              const esHoy = p.fechaEntrega === hoy;
              const esPagado = (Number(p.saldoPendiente) <= 0) || p.pagado;
              const phoneClean = (p.clienteTelefono || '').replace(/[^\d]/g, '');
              const itemsResumen = (p.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(' • ');

              return `
                <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; background:var(--surface-2); border-radius:var(--radius-sm); border-left: 5px solid ${esHoy ? 'var(--berry)' : '#D9A25C'};">
                  <div style="flex:1; min-width:240px;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                      <span class="badge ${esHoy ? 'badge-berry' : 'badge-amber'}" style="font-weight:700;">
                        ${esHoy ? '🔥 HOY' : '📅 MAÑANA'}
                      </span>
                      <strong style="font-size:15px;">#${p.codigo || '—'}</strong>
                      <span style="font-size:13px; font-weight:600; color:var(--ink);">
                        ${p.horaEntrega ? `🕒 ${p.horaEntrega} hrs` : '🕒 Hora sin fijar'}
                      </span>
                      <span class="badge badge-neutral" style="font-size:11px;">
                        ${p.tipoEntrega === 'despacho' ? '🛵 Despacho' : '🏪 Retiro en local'}
                      </span>
                    </div>

                    <div style="font-size:14px; margin-bottom:2px;">
                      <strong>${escapeHtml(p.clienteNombre)}</strong>
                      ${p.clienteTelefono ? `
                        <a href="${typeof Pedidos.generarLinkWhatsApp === 'function' ? Pedidos.generarLinkWhatsApp(p) : `https://wa.me/${phoneClean}`}" target="_blank" style="margin-left:6px; color:#25D366; text-decoration:none; font-weight:600; font-size:12px;">
                          ${App.svgIcon('whatsapp')} WhatsApp
                        </a>
                      ` : ''}
                    </div>

                    <div class="text-soft" style="font-size:13px; margin-bottom:4px;">
                      🧁 <strong>Pedido:</strong> ${escapeHtml(itemsResumen || 'Sin detalle de productos')}
                    </div>

                    ${p.tipoEntrega === 'despacho' && p.direccionDespacho ? `
                      <div class="text-soft" style="font-size:12px; color:var(--ink-soft);">
                        📍 Dirección: ${escapeHtml(p.direccionDespacho)}
                      </div>
                    ` : ''}
                  </div>

                  <!-- Pago y Estado -->
                  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <div style="text-align:right;">
                      <div style="font-weight:700; font-size:14px;">${App.formatCLP(p.total)}</div>
                      <div>
                        ${esPagado ? `
                          <span class="badge badge-sage" style="font-size:10px; font-weight:700;">🟢 Pagado</span>
                        ` : `
                          <span class="badge badge-danger" style="font-size:10px; font-weight:700;">🔴 Saldo: ${App.formatCLP(p.saldoPendiente)}</span>
                        `}
                      </div>
                    </div>

                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-secondary btn-sm" data-cambiar-estado="${p.id}" title="Cambiar estado o pago">
                        ${getEstadoLabel(p.estado)} ▾
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- ARQUEO RÁPIDO DE CAJA DE HOY -->
      <div class="card" style="margin-top: 20px;">
        <div class="flex" style="justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <div>
            <h2 class="card-title mt-0" style="display:flex; align-items:center; gap:8px;">
              <span>💵</span> Arqueo Rápido de Caja (Hoy)
            </h2>
            <div class="text-soft" style="font-size:13px;">Estimación de dinero físico vs transferencias del día</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="App.goTo('reportes')">Ver Cierre Diario completo →</button>
        </div>

        <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
          <div class="kpi-card" style="background:var(--surface-2);">
            <div class="kpi-label">Efectivo recibido en ventas</div>
            <div class="kpi-value" style="font-size:1.3rem; color:var(--sage);">${App.formatCLP(efectivoHoy)}</div>
            <div class="kpi-hint">Mesón + pagos en efectivo</div>
          </div>
          <div class="kpi-card" style="background:var(--surface-2);">
            <div class="kpi-label">Gastos pagados en efectivo</div>
            <div class="kpi-value" style="font-size:1.3rem; color:var(--danger);">${App.formatCLP(gastosEfectivoHoy)}</div>
            <div class="kpi-hint">Salidas del cajón de dinero</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid var(--accent); background:var(--surface-2);">
            <div class="kpi-label">Efectivo estimado en cajón</div>
            <div class="kpi-value" style="font-size:1.4rem; font-weight:700;">${App.formatCLP(efectivoCajaEstimado)}</div>
            <div class="kpi-hint">Efectivo en mano al momento</div>
          </div>
          <div class="kpi-card" style="background:var(--surface-2);">
            <div class="kpi-label">Transferencias / Bancos</div>
            <div class="kpi-value" style="font-size:1.3rem; color:var(--berry);">${App.formatCLP(bancosHoy)}</div>
            <div class="kpi-hint">Directo en tu cuenta bancaria</div>
          </div>
        </div>
      </div>

      <!-- SECCIÓN: GRÁFICOS -->
      <div class="card" style="margin-top:20px;">
        <div class="flex" style="justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
          <h2 class="card-title mt-0">Gráficos y Tendencias</h2>
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

    // Event listeners de botones rápidos
    document.getElementById('btn-dash-pos')?.addEventListener('click', () => {
      App.goTo('ventas');
      setTimeout(() => {
        if (typeof Ventas.openPosModal === 'function') Ventas.openPosModal();
        else if (typeof Ventas.openForm === 'function') Ventas.openForm();
      }, 50);
    });

    document.getElementById('btn-dash-pedido')?.addEventListener('click', () => {
      App.goTo('pedidos');
      setTimeout(() => {
        if (typeof Pedidos.openPedidoModal === 'function') Pedidos.openPedidoModal();
      }, 50);
    });

    // Cambiar estado desde la agenda de entregas
    container.querySelectorAll('[data-cambiar-estado]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.cambiarEstado;
        if (typeof Pedidos.openCambiarEstadoModal === 'function') {
          Pedidos.openCambiarEstadoModal(id);
        } else {
          App.goTo('pedidos');
        }
      });
    });

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

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function getEstadoLabel(estado){
    const mapa = {
      'pendiente': '⏳ Pendiente',
      'confirmado': '✓ Confirmado',
      'en_preparacion': '🥣 En preparación',
      'listo': '📦 Listo p/ entrega',
      'entregado': '✓ Entregado',
      'cancelado': '✕ Cancelado'
    };
    return mapa[estado] || estado;
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
