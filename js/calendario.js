/* ============================================================
   GESTOR DE PASTELERÍA — calendario.js
   Calendario mensual: muestra qué días hubo ventas y al hacer
   clic en un día se ve el detalle (ventas, gastos, resultado).
   ============================================================ */

const Calendario = (() => {

  const DOW = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  let cursor = new Date();

  function render(container){
    container.innerHTML = `
      <div class="page-header">
        <div><h1>Calendario</h1><div class="subtitle">Ventas por día</div></div>
      </div>
      <div class="card">
        <div class="calendar-nav">
          <button class="btn btn-secondary btn-sm" id="cal-prev">←</button>
          <h3>${MESES[cursor.getMonth()]} ${cursor.getFullYear()}</h3>
          <button class="btn btn-secondary btn-sm" id="cal-next">→</button>
          <button class="btn btn-ghost btn-sm" id="cal-hoy">Hoy</button>
        </div>
        <div class="calendar-grid" id="cal-grid"></div>
      </div>
      <div id="cal-detalle"></div>
    `;
    document.getElementById('cal-prev').addEventListener('click', () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth()-1, 1); render(container); });
    document.getElementById('cal-next').addEventListener('click', () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth()+1, 1); render(container); });
    document.getElementById('cal-hoy').addEventListener('click', () => { cursor = new Date(); render(container); });

    drawGrid();

    function drawGrid(){
      const ventas = Storage.get('ventas');
      const pedidos = Storage.get('pedidos') || [];
      const year = cursor.getFullYear(), month = cursor.getMonth();
      const firstDay = new Date(year, month, 1);
      const startOffset = (firstDay.getDay() + 6) % 7; // lunes=0
      const daysInMonth = new Date(year, month+1, 0).getDate();
      const todayISO = Storage.todayISO();

      const grid = document.getElementById('cal-grid');
      let html = DOW.map(d => `<div class="calendar-dow">${d}</div>`).join('');
      for (let i=0; i<startOffset; i++) html += `<div class="calendar-day empty"></div>`;

      for (let day=1; day<=daysInMonth; day++){
        const iso = `${year}-${Analytics.pad(month+1)}-${Analytics.pad(day)}`;
        const ventasDia = ventas.filter(v => v.fecha === iso);
        const pedidosDia = pedidos.filter(p => p.fechaEntrega === iso && p.estado !== 'cancelado');
        const totalDia = Analytics.sum(ventasDia, 'total');
        html += `
          <div class="calendar-day ${(ventasDia.length > 0 || pedidosDia.length > 0) ? 'has-sales' : ''} ${iso === todayISO ? 'today' : ''}" data-fecha="${iso}">
            <span class="day-num">${day}</span>
            <div style="display:flex; flex-direction:column; gap:2px; margin-top:2px;">
              ${pedidosDia.length > 0 ? `<span style="font-size:10px; background:var(--berry-soft); color:var(--berry); border-radius:4px; padding:1px 4px; font-weight:700;">🎂 ${pedidosDia.length} ${pedidosDia.length===1?'encargo':'encargos'}</span>` : ''}
              ${totalDia > 0 ? `<span class="day-total">${App.formatCLP(totalDia).replace('CLP','$').replace(/\s/g,'')}</span>` : ''}
            </div>
          </div>`;
      }
      grid.innerHTML = html;
      grid.querySelectorAll('[data-fecha]').forEach(el => el.addEventListener('click', () => showDetalle(el.dataset.fecha)));

      // Mostrar el día de hoy por defecto
      if (year === new Date().getFullYear() && month === new Date().getMonth()){
        showDetalle(todayISO);
      }
    }

    function showDetalle(fecha){
      const ventas = Storage.get('ventas').filter(v => v.fecha === fecha);
      const gastos = Storage.get('gastos').filter(g => g.fecha === fecha);
      const pedidos = (Storage.get('pedidos') || []).filter(p => p.fechaEntrega === fecha && p.estado !== 'cancelado');
      const totalVentas = Analytics.sum(ventas, 'total');
      const totalGastos = Analytics.sum(gastos, 'monto');
      const resultado = totalVentas - totalGastos;

      document.getElementById('cal-detalle').innerHTML = `
        <div class="card">
          <h3 class="card-title">${App.formatDateLong(fecha)}</h3>
          
          <!-- Encargos del día -->
          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0; color: var(--berry);">🎂 Encargos y Pedidos para entregar (${pedidos.length})</h4>
            ${pedidos.length > 0 ? `
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Código / Hora</th><th>Cliente</th><th>Modalidad</th><th>Productos</th><th>Saldo p/ cobrar</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody>
                    ${pedidos.map(p => `
                      <tr>
                        <td><strong>${p.codigo || '—'}</strong> ${p.horaEntrega ? `<div class="text-soft" style="font-size:12px;">⏰ ${p.horaEntrega}</div>` : ''}</td>
                        <td><strong>${p.clienteNombre}</strong><div class="text-soft" style="font-size:12px;">📞 ${p.clienteTelefono}</div></td>
                        <td><span class="badge ${p.tipoEntrega==='despacho'?'badge-berry':'badge-neutral'}">${p.tipoEntrega==='despacho'?'🚚 Despacho':'🏪 Retiro'}</span></td>
                        <td><div style="max-width:200px; font-size:13px;">${(p.items||[]).map(i => `${i.cantidad}x ${i.nombre}`).join(', ')}</div></td>
                        <td><strong style="color:${p.saldoPendiente>0?'var(--danger)':'var(--sage)'};">${p.saldoPendiente>0 ? App.formatCLP(p.saldoPendiente) : '✓ Pagado'}</strong></td>
                        <td><span class="badge badge-berry">${p.estado}</span></td>
                        <td>
                          <button class="btn btn-secondary btn-sm" onclick="Pedidos.openTicketModal('${p.id}')">📄 Ticket</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : `<p class="text-soft" style="margin-bottom:0;">No hay pedidos programados para entregar este día.</p>`}
          </div>

          <h4 style="margin: 16px 0 10px 0;">Ventas y Finanzas</h4>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label">Ventas del día</div><div class="kpi-value">${App.formatCLP(totalVentas)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Productos vendidos</div><div class="kpi-value">${Analytics.sum(ventas,'cantidad')}</div></div>
            <div class="kpi-card"><div class="kpi-label">Gastos del día</div><div class="kpi-value">${App.formatCLP(totalGastos)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Resultado estimado</div><div class="kpi-value ${resultado>=0?'positive':'negative'}">${App.formatCLP(resultado)}</div></div>
          </div>
          ${ventas.length > 0 ? `
          <div class="table-wrap section-block">
            <table><thead><tr><th>Producto</th><th>Cantidad</th><th>Total</th><th>Medio de pago</th></tr></thead>
            <tbody>${ventas.map(v => `<tr><td>${v.productoNombre}</td><td>${v.cantidad}</td><td>${App.formatCLP(v.total)}</td><td>${v.medioPago}</td></tr>`).join('')}</tbody></table>
          </div>` : `<p class="text-soft">Sin ventas directas registradas este día.</p>`}
        </div>
      `;
    }
  }

  return { render };
})();
