/* ============================================================
   GESTOR DE PASTELERÍA — pedidos.js
   Módulo de Pedidos y Encargos futuros:
   - Control de anticipos/abonos y saldo pendiente
   - Fechas y horas de entrega (retiro en local o despacho)
   - Estados: Pendiente, Confirmado, En preparación, Listo, Entregado, Cancelado
   - Enlace directo a WhatsApp para notificar al cliente
   - Descuento automático de stock de productos terminados
   ============================================================ */

const Pedidos = (() => {

  const ESTADOS = [
    { id: 'todos',          label: 'Todos' },
    { id: 'pendiente',      label: 'Pendientes',      color: 'badge-amber' },
    { id: 'confirmado',     label: 'Confirmados',     color: 'badge-berry' },
    { id: 'en_preparacion', label: 'En preparación',  color: 'badge-berry' },
    { id: 'listo',          label: 'Listos p/ entrega', color: 'badge-sage' },
    { id: 'entregado',      label: 'Entregados',      color: 'badge-neutral' },
    { id: 'cancelado',      label: 'Cancelados',      color: 'badge-danger' },
  ];

  let filtroEstado = 'todos';
  let filtroFecha = 'todas'; // 'todas' | 'hoy' | 'manana' | 'semana'
  let filtroBusqueda = '';
  let openPedidoModalRef = null;
  let openCambiarEstadoModalRef = null;
  let seleccionadosParaImprimir = new Set();

  function render(container){
    try {
      openPedidoModalRef = openPedidoModal;
      openCambiarEstadoModalRef = openCambiarEstadoModal;
      const pedidos = Storage.get('pedidos') || [];
    const today = Storage.todayISO();

    // Contadores para métricas
    const pendientes = pedidos.filter(p => p.estado === 'pendiente').length;
    const enPrep = pedidos.filter(p => p.estado === 'en_preparacion').length;
    const listos = pedidos.filter(p => p.estado === 'listo').length;
    const entregadosHoy = pedidos.filter(p => p.estado === 'entregado' && p.fechaEntrega === today).length;
    const saldoTotalPendiente = pedidos
      .filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado')
      .reduce((sum, p) => sum + (Number(p.saldoPendiente) || 0), 0);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Pedidos y Encargos</h1>
          <div class="subtitle">Control de anticipos, entregas y pedidos web</div>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" id="btn-hoja-tickets" title="Imprimir hoja carta con 9 tickets para recortar">
            🖨️ Hoja de Tickets (Carta 3x3)
          </button>
          <a href="pedir.html" target="_blank" class="btn btn-secondary">
            ${App.svgIcon('external')} Ver Tienda Clientes
          </a>
          <button class="btn btn-primary" id="btn-nuevo-pedido">
            ${App.svgIcon('plus')} Nuevo pedido manual
          </button>
        </div>
      </div>

      <!-- Métricas rápidas -->
      <div class="dashboard-kpis" style="margin-bottom: 20px;">
        <div class="kpi-card">
          <div class="kpi-label">Pendientes</div>
          <div class="kpi-value" style="color: var(--amber);">${pendientes}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">En preparación</div>
          <div class="kpi-value" style="color: var(--berry);">${enPrep}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Listos p/ entrega</div>
          <div class="kpi-value" style="color: var(--sage);">${listos}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Entregados hoy</div>
          <div class="kpi-value">${entregadosHoy}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Saldo total por cobrar</div>
          <div class="kpi-value" style="font-size: 20px; color: var(--danger);">${App.formatCLP(saldoTotalPendiente)}</div>
        </div>
      </div>

      <div class="card">
        <!-- Filtros -->
        <div class="filters-bar">
          <div class="field">
            <label>Estado</label>
            <select id="filtro-estado">
              ${ESTADOS.map(e => `<option value="${e.id}" ${filtroEstado === e.id ? 'selected' : ''}>${e.label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Fecha de entrega</label>
            <select id="filtro-fecha">
              <option value="todas" ${filtroFecha === 'todas' ? 'selected' : ''}>Todas</option>
              <option value="hoy" ${filtroFecha === 'hoy' ? 'selected' : ''}>Para hoy</option>
              <option value="manana" ${filtroFecha === 'manana' ? 'selected' : ''}>Para mañana</option>
              <option value="semana" ${filtroFecha === 'semana' ? 'selected' : ''}>Próximos 7 días</option>
            </select>
          </div>
          <div class="field" style="flex: 2;">
            <label>Buscar cliente, código o teléfono</label>
            <input type="text" id="filtro-busqueda" placeholder="Buscar…" value="${escapeHtml(filtroBusqueda)}" />
          </div>
          <button class="btn btn-ghost" id="btn-limpiar-filtros" style="align-self: flex-end;">Limpiar</button>
        </div>

        <div id="pedidos-lista"></div>
      </div>
    `;

    document.getElementById('btn-nuevo-pedido').addEventListener('click', () => openPedidoModal());
    document.getElementById('btn-hoja-tickets').addEventListener('click', () => openHojaTicketsModal(Array.from(seleccionadosParaImprimir)));
    document.getElementById('filtro-estado').addEventListener('change', (e) => { filtroEstado = e.target.value; renderLista(); });
    document.getElementById('filtro-fecha').addEventListener('change', (e) => { filtroFecha = e.target.value; renderLista(); });
    document.getElementById('filtro-busqueda').addEventListener('input', (e) => { filtroBusqueda = e.target.value; renderLista(); });
    document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
      filtroEstado = 'todos';
      filtroFecha = 'todas';
      filtroBusqueda = '';
      render(container);
    });

    renderLista();

    function renderLista(){
      let lista = Storage.get('pedidos') || [];
      const todayISO = Storage.todayISO();

      // Ordenar por fecha de entrega más próxima y luego hora
      lista.sort((a,b) => (a.fechaEntrega || '').localeCompare(b.fechaEntrega || '') || (b.creadoEn || 0) - (a.creadoEn || 0));

      // Filtrar estado
      if (filtroEstado !== 'todos'){
        lista = lista.filter(p => p.estado === filtroEstado);
      }

      // Filtrar fecha
      if (filtroFecha === 'hoy'){
        lista = lista.filter(p => p.fechaEntrega === todayISO);
      } else if (filtroFecha === 'manana'){
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        const mananaISO = manana.toISOString().slice(0,10);
        lista = lista.filter(p => p.fechaEntrega === mananaISO);
      } else if (filtroFecha === 'semana'){
        const en7Dias = new Date();
        en7Dias.setDate(en7Dias.getDate() + 7);
        const limiteISO = en7Dias.toISOString().slice(0,10);
        lista = lista.filter(p => p.fechaEntrega >= todayISO && p.fechaEntrega <= limiteISO);
      }

      // Filtrar búsqueda
      if (filtroBusqueda.trim()){
        const q = filtroBusqueda.toLowerCase().trim();
        lista = lista.filter(p =>
          (p.codigo || '').toLowerCase().includes(q) ||
          (p.clienteNombre || '').toLowerCase().includes(q) ||
          (p.clienteTelefono || '').toLowerCase().includes(q) ||
          (p.notas || '').toLowerCase().includes(q)
        );
      }

      const listEl = document.getElementById('pedidos-lista');
      if (lista.length === 0){
        listEl.innerHTML = `
          <div class="empty-state" style="padding: 40px 20px;">
            <h3>No hay pedidos con estos filtros</h3>
            <p class="text-soft">Prueba cambiando los filtros o registra un nuevo pedido.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width: 38px; text-align: center;">
                  <input type="checkbox" id="check-todos-pedidos" title="Seleccionar todos para imprimir tickets" style="cursor:pointer;" />
                </th>
                <th>Código / Fecha</th>
                <th>Cliente y Entrega</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Estado de Pago / Saldo</th>
                <th>Estado</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(p => {
                const esHoy = p.fechaEntrega === today;
                const esPagado = (Number(p.saldoPendiente) <= 0) || p.pagado;
                const tieneAbono = Number(p.abono) > 0 && !esPagado;
                const itemsTexto = (p.items || []).map(i => `${i.cantidad}x ${escapeHtml(i.nombre)}`).join(', ');
                const estadoBadge = getEstadoBadge(p.estado);
                const estaSeleccionado = seleccionadosParaImprimir.has(p.id);

                return `
                  <tr style="${esHoy ? 'background: #FFFDF9;' : ''}">
                    <td style="text-align: center; vertical-align: middle;">
                      <input type="checkbox" class="check-pedido-item" data-id="${p.id}" ${estaSeleccionado ? 'checked' : ''} style="cursor:pointer;" title="Seleccionar para imprimir ticket" />
                    </td>
                    <td>
                      <div><strong>${escapeHtml(p.codigo || '—')}</strong> ${p.demo ? '<span class="tag-demo">EJEMPLO</span>' : ''}</div>
                      <div class="text-soft" style="font-size:13px; font-weight: 600; color: ${esHoy ? 'var(--amber)' : 'inherit'};">
                        ${esHoy ? '¡HOY! ' : ''}${App.formatDate(p.fechaEntrega)} ${p.horaEntrega ? `(${escapeHtml(p.horaEntrega)})` : ''}
                      </div>
                      <div class="text-soft" style="font-size:11px;">Origen: ${p.origen === 'web_cliente' ? '🌐 Web Cliente' : '👤 Manual'}</div>
                    </td>
                    <td>
                      <div><strong>${escapeHtml(p.clienteNombre)}</strong></div>
                      <div class="text-soft" style="font-size:12px;">📞 ${escapeHtml(p.clienteTelefono)}</div>
                      <div style="font-size:12px; margin-top:2px;">
                        <span class="badge ${p.tipoEntrega === 'despacho' ? 'badge-berry' : 'badge-neutral'}" style="font-size:11px;">
                          ${p.tipoEntrega === 'despacho' ? '🚚 Despacho' : '🏪 Retiro en local'}
                        </span>
                        ${p.direccionDespacho ? `<div class="text-soft" style="font-size:11px;">${escapeHtml(p.direccionDespacho)}</div>` : ''}
                      </div>
                    </td>
                    <td>
                      <div style="max-width: 220px; font-size:13px;" title="${escapeHtml(itemsTexto)}">
                        ${escapeHtml(itemsTexto) || '<span class="text-soft">Sin items</span>'}
                      </div>
                      ${p.notas ? `<div class="text-soft" style="font-size:11px; margin-top:4px; font-style:italic;">📝 ${escapeHtml(p.notas)}</div>` : ''}
                    </td>
                    <td>
                      <div><strong style="font-size: 15px;">${App.formatCLP(p.total)}</strong></div>
                      ${tieneAbono ? `<div class="text-soft" style="font-size:11px;">Abono: ${App.formatCLP(p.abono)}</div>` : ''}
                    </td>
                    <td>
                      ${esPagado ? `
                        <div>
                          <span class="badge badge-sage" style="font-weight: 700; font-size: 12px;">🟢 Pagado</span>
                          <div style="font-size: 11px; margin-top: 4px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                            <span class="badge badge-neutral" style="font-size: 10px;">${p.registradoEnVentas ? '✓ En Ventas' : 'Sin venta'}</span>
                            <button class="btn btn-ghost btn-sm" data-pago-toggle="${p.id}" data-action="por_pagar" style="font-size: 10px; padding: 2px 6px;" title="Marcar como por pagar">↩ Por pagar</button>
                          </div>
                        </div>
                      ` : tieneAbono ? `
                        <div>
                          <span class="badge badge-amber" style="font-weight: 700; font-size: 12px;">🟡 Abono: ${App.formatCLP(p.abono)}</span>
                          <div style="color: var(--danger); font-size: 12px; font-weight: 600; margin-top: 2px;">Saldo: ${App.formatCLP(p.saldoPendiente)}</div>
                          <div style="margin-top: 4px;">
                            <button class="btn btn-primary btn-sm" data-pago-toggle="${p.id}" data-action="completar_pago" style="font-size: 11px; padding: 3px 8px; background: #2D6A4F; border-color: #2D6A4F;">
                              ✓ Completar Pago
                            </button>
                          </div>
                        </div>
                      ` : `
                        <div>
                          <span class="badge badge-danger" style="font-weight: 700; font-size: 12px;">🔴 Por pagar</span>
                          <div style="margin-top: 5px;">
                            <button class="btn btn-primary btn-sm" data-pago-toggle="${p.id}" data-action="marcar_pagado" style="font-size: 11px; padding: 4px 10px; background: #2D6A4F; border-color: #2D6A4F; font-weight: 600;">
                              ✓ Marcar Pagado
                            </button>
                          </div>
                        </div>
                      `}
                      <div class="text-soft" style="font-size: 11px; margin-top: 4px;">${p.medioPago === 'Efectivo' ? '💵 Efectivo' : '💳 Transferencia'}</div>
                    </td>
                    <td>
                      <span class="badge ${estadoBadge.color}">${estadoBadge.label}</span>
                    </td>
                    <td class="cell-actions" style="text-align: right;">
                      <button class="btn btn-secondary btn-sm" data-ticket="${p.id}" title="Ver e Imprimir Ticket para la caja">
                        📄 Ticket
                      </button>
                      <a href="${generarLinkWhatsApp(p)}" target="_blank" class="btn btn-secondary btn-sm" title="Contactar por WhatsApp" style="background:#25D366; color:#fff; border-color:#25D366;">
                        ${App.svgIcon('whatsapp')} WhatsApp
                      </a>
                      <button class="btn btn-secondary btn-sm" data-estado="${p.id}">Estado</button>
                      <button class="btn btn-secondary btn-sm" data-edit="${p.id}">Editar</button>
                      <button class="btn btn-danger btn-sm" data-del="${p.id}">Eliminar</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      listEl.querySelectorAll('[data-ticket]').forEach(b => b.addEventListener('click', () => openTicketModal(b.dataset.ticket)));
      listEl.querySelectorAll('[data-estado]').forEach(b => b.addEventListener('click', () => openCambiarEstadoModal(b.dataset.estado)));
      listEl.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openPedidoModal(b.dataset.edit)));
      listEl.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => handleEliminarPedido(b.dataset.del)));
      listEl.querySelectorAll('[data-pago-toggle]').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.dataset.pagoToggle;
          const action = b.dataset.action;
          if (action === 'marcar_pagado' || action === 'completar_pago') {
            Storage.marcarPedidoPagado(id);
            App.toast('✓ Pedido marcado como Pagado y registrado en Ventas', 'success');
          } else if (action === 'por_pagar') {
            Storage.marcarPedidoPorPagar(id);
            App.toast('Pedido marcado como pendiente de pago');
          }
          render(container);
        });
      });

      // Manejo de casillas de selección para imprimir tickets
      const updateBotonTickets = () => {
        const btn = document.getElementById('btn-hoja-tickets');
        if (!btn) return;
        const totalSel = seleccionadosParaImprimir.size;
        if (totalSel > 0) {
          btn.innerHTML = `🖨️ Imprimir Seleccionados (${totalSel})`;
          btn.className = 'btn btn-primary';
          btn.style.background = 'var(--berry)';
          btn.style.borderColor = 'var(--berry)';
        } else {
          btn.innerHTML = `🖨️ Hoja de Tickets (Personalizada)`;
          btn.className = 'btn btn-secondary';
          btn.style.background = '';
          btn.style.borderColor = '';
        }
      };

      const checkAll = listEl.querySelector('#check-todos-pedidos');
      if (checkAll) {
        checkAll.addEventListener('change', () => {
          lista.forEach(p => {
            if (checkAll.checked) seleccionadosParaImprimir.add(p.id);
            else seleccionadosParaImprimir.delete(p.id);
          });
          listEl.querySelectorAll('.check-pedido-item').forEach(cb => { cb.checked = checkAll.checked; });
          updateBotonTickets();
        });
      }

      listEl.querySelectorAll('.check-pedido-item').forEach(cb => {
        cb.addEventListener('change', () => {
          const id = cb.dataset.id;
          if (cb.checked) seleccionadosParaImprimir.add(id);
          else seleccionadosParaImprimir.delete(id);
          updateBotonTickets();
        });
      });

      updateBotonTickets();
    }

    function getEstadoBadge(estado){
      const found = ESTADOS.find(e => e.id === estado);
      return found || { label: estado, color: 'badge-neutral' };
    }

    function generarLinkWhatsApp(pedido){
      const phoneClean = (pedido.clienteTelefono || '').replace(/[^\d]/g, '');
      const itemsList = (pedido.items || []).map(i => `• ${i.cantidad}x ${i.nombre}`).join('%0A');
      const saldoTxt = pedido.saldoPendiente > 0 
        ? `Saldo pendiente: *${App.formatCLP(pedido.saldoPendiente)}*` 
        : `*Totalmente pagado* ✓`;

      const msg = `¡Hola *${encodeURIComponent(pedido.clienteNombre)}*! Te saludamos de *Dulces Mele* 🧁%0A%0A` +
        `Te escribimos respecto a tu pedido *#${pedido.codigo || ''}*%0A` +
        `🗓 *Fecha de entrega:* ${App.formatDate(pedido.fechaEntrega)} ${pedido.horaEntrega ? `a las ${pedido.horaEntrega}` : ''}%0A` +
        `📦 *Modalidad:* ${pedido.tipoEntrega === 'despacho' ? 'Despacho a domicilio' : 'Retiro en local'}%0A%0A` +
        `*Detalle:*%0A${itemsList}%0A%0A` +
        `💰 *Total:* ${App.formatCLP(pedido.total)}%0A` +
        `💳 *Abono:* ${App.formatCLP(pedido.abono)}%0A` +
        `${saldoTxt}%0A%0A` +
        `Estado actual: *${getEstadoBadge(pedido.estado).label}*. ¡Quedamos atentos a cualquier duda!`;

      return `https://wa.me/${phoneClean}?text=${msg}`;
    }

    /* Modal rápido para cambiar estado y pago */
    function openCambiarEstadoModal(id){
      const pedidos = Storage.get('pedidos');
      const p = pedidos.find(item => item.id === id);
      if (!p) return;

      const esPagado = (Number(p.saldoPendiente) <= 0) || p.pagado;
      const tieneAbono = Number(p.abono) > 0 && !esPagado;

      const overlay = App.openModal(`
        <div class="modal-header">
          <h3>Actualizar estado — ${escapeHtml(p.codigo)} (${escapeHtml(p.clienteNombre)})</h3>
          <button class="modal-close" data-close>${App.svgIcon('close')}</button>
        </div>
        <form id="form-estado">
          <div class="form-grid">
            <div class="field full">
              <label>Estado del pedido</label>
              <select id="p-nuevo-estado">
                ${ESTADOS.filter(e => e.id !== 'todos').map(e => `
                  <option value="${e.id}" ${p.estado === e.id ? 'selected' : ''}>${e.label}</option>
                `).join('')}
              </select>
            </div>

            <div class="field full">
              <label>Estado del Pago</label>
              <select id="p-estado-pago">
                <option value="por_pagar" ${!esPagado && !tieneAbono ? 'selected' : ''}>🔴 Por pagar (Saldo: ${App.formatCLP(p.total)})</option>
                <option value="pagado" ${esPagado ? 'selected' : ''}>🟢 Pagado en su totalidad (${App.formatCLP(p.total)})</option>
                <option value="abono" ${tieneAbono ? 'selected' : ''}>🟡 Abono parcial...</option>
              </select>
            </div>

            <div class="field full" id="box-abono-input" style="display: ${tieneAbono ? 'block' : 'none'};">
              <label>Monto del Abono recibido (CLP)</label>
              <input type="number" id="p-nuevo-abono" min="0" max="${p.total}" value="${p.abono || 0}" />
              <div class="text-soft" style="font-size:12px; margin-top:4px;">
                Total del pedido: ${App.formatCLP(p.total)}.
              </div>
            </div>

            <div class="field full">
              <label>Medio de Pago</label>
              <select id="p-nuevo-medio">
                <option value="Transferencia" ${p.medioPago === 'Transferencia' ? 'selected' : ''}>💳 Transferencia Bancaria</option>
                <option value="Efectivo" ${p.medioPago === 'Efectivo' ? 'selected' : ''}>💵 Efectivo</option>
                <option value="Débito" ${p.medioPago === 'Débito' ? 'selected' : ''}>💳 Débito</option>
                <option value="Crédito" ${p.medioPago === 'Crédito' ? 'selected' : ''}>💳 Crédito</option>
              </select>
            </div>

            <div class="field full" style="background: var(--surface-2); padding: 12px; border-radius: var(--radius-sm); margin-top: 6px;">
              <label style="font-weight: 600; display: flex; align-items: center; gap: 8px; cursor: pointer; margin: 0;">
                <input type="checkbox" id="check-registrar-venta" ${p.registradoEnVentas || esPagado ? 'checked' : ''} />
                <span>Registrar en el módulo de <strong>Ventas</strong> (ingresos, métricas y reportes)</span>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar cambios</button>
          </div>
        </form>
      `);

      overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

      const selEstado = overlay.querySelector('#p-nuevo-estado');
      const selPago = overlay.querySelector('#p-estado-pago');
      const boxAbono = overlay.querySelector('#box-abono-input');
      const inputAbono = overlay.querySelector('#p-nuevo-abono');
      const checkVenta = overlay.querySelector('#check-registrar-venta');

      selPago.addEventListener('change', () => {
        boxAbono.style.display = selPago.value === 'abono' ? 'block' : 'none';
        if (selPago.value === 'pagado') {
          inputAbono.value = p.total;
          checkVenta.checked = true;
        } else if (selPago.value === 'por_pagar') {
          inputAbono.value = 0;
          checkVenta.checked = false;
        }
      });

      overlay.querySelector('#form-estado').addEventListener('submit', (e) => {
        e.preventDefault();
        const nuevoEstado = selEstado.value;
        const modoPago = selPago.value;
        const nuevoMedio = overlay.querySelector('#p-nuevo-medio').value;
        const registrarVenta = checkVenta.checked;

        if (modoPago === 'pagado') {
          Storage.marcarPedidoPagado(p.id, nuevoMedio);
          Storage.actualizarPedido(p.id, { estado: nuevoEstado, registrarComoVenta: registrarVenta });
        } else if (modoPago === 'por_pagar') {
          Storage.marcarPedidoPorPagar(p.id);
          Storage.actualizarPedido(p.id, { estado: nuevoEstado, medioPago: nuevoMedio });
        } else {
          // Abono parcial
          const montoAbono = Number(inputAbono.value) || 0;
          Storage.actualizarPedido(p.id, {
            estado: nuevoEstado,
            abono: montoAbono,
            medioPago: nuevoMedio,
            registrarComoVenta: registrarVenta
          });
        }

        App.closeModal();
        App.toast('Pedido actualizado correctamente', 'success');
        render(container);
      });
    }

    /* Formulario completo para Nuevo Pedido o Edición */
    function openPedidoModal(id = null){
      const pedidos = Storage.get('pedidos') || [];
      const productos = Storage.get('productos') || [];
      const editing = id ? pedidos.find(p => p.id === id) : null;
      let currentItems = editing ? JSON.parse(JSON.stringify(editing.items || [])) : [];

      const overlay = App.openModal(`
        <div class="modal-header">
          <h3>${editing ? `Editar pedido ${escapeHtml(editing.codigo)}` : 'Nuevo Pedido / Encargo'}</h3>
          <button class="modal-close" data-close>${App.svgIcon('close')}</button>
        </div>
        <form id="form-pedido" style="max-height: 80vh; overflow-y: auto; padding-right: 4px;">
          <h4 style="margin-top:0;">1. Datos del Cliente</h4>
          <div class="form-grid">
            <div class="field">
              <label>Nombre del cliente *</label>
              <input type="text" id="ped-nombre" value="${editing ? escapeHtml(editing.clienteNombre) : ''}" required />
            </div>
            <div class="field">
              <label>WhatsApp / Teléfono *</label>
              <input type="tel" id="ped-telefono" placeholder="+569..." value="${editing ? escapeHtml(editing.clienteTelefono) : '+569'}" required />
            </div>
            <div class="field">
              <label>Correo electrónico (opcional)</label>
              <input type="email" id="ped-email" value="${editing ? escapeHtml(editing.clienteEmail || '') : ''}" />
            </div>
            <div class="field">
              <label>Tipo de entrega</label>
              <select id="ped-tipo-entrega">
                <option value="retiro" ${!editing || editing.tipoEntrega === 'retiro' ? 'selected' : ''}>Retiro en local</option>
                <option value="despacho" ${editing && editing.tipoEntrega === 'despacho' ? 'selected' : ''}>Despacho a domicilio</option>
              </select>
            </div>
            <div class="field full" id="box-direccion" style="display: ${editing && editing.tipoEntrega === 'despacho' ? 'block' : 'none'};">
              <label>Dirección de despacho *</label>
              <input type="text" id="ped-direccion" placeholder="Calle, número, depto, comuna" value="${editing ? escapeHtml(editing.direccionDespacho || '') : ''}" />
            </div>
            <div class="field">
              <label>Fecha de entrega *</label>
              <input type="date" id="ped-fecha" value="${editing ? editing.fechaEntrega : Storage.todayISO()}" required />
            </div>
            <div class="field">
              <label>Hora preferida</label>
              <input type="time" id="ped-hora" value="${editing ? escapeHtml(editing.horaEntrega || '') : '16:00'}" />
            </div>
          </div>

          <h4 style="margin-top: 16px;">2. Productos a Encargar</h4>
          <div class="form-grid" style="align-items: flex-end; margin-bottom: 12px; background: var(--surface-2); padding: 12px; border-radius: var(--radius-sm);">
            <div class="field" style="flex:2;">
              <label>Seleccionar producto</label>
              <select id="sel-producto">
                <option value="">-- Elige un producto --</option>
                ${productos.filter(p => p.estado === 'activo').map(p => `
                  <option value="${p.id}" data-precio="${p.precioVenta}" data-tipo="${p.tipoStock || 'terminado'}" data-stock="${p.stockActual || 0}">
                    ${escapeHtml(p.nombre)} — ${App.formatCLP(p.precioVenta)} ${p.tipoStock === 'terminado' ? `(Stock: ${p.stockActual})` : '(A pedido)'}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="field" style="max-width: 100px;">
              <label>Cantidad</label>
              <input type="number" id="sel-cantidad" min="1" step="1" value="1" />
            </div>
            <button type="button" class="btn btn-secondary" id="btn-agregar-item" style="height: 42px;">+ Agregar</button>
          </div>

          <div id="items-agregados-wrap" style="margin-bottom: 16px;"></div>

          <h4 style="margin-top: 16px;">3. Pago y Estado</h4>
          <div class="form-grid">
            <div class="field">
              <label>Total del pedido</label>
              <input type="text" id="ped-total" readonly style="font-weight: 700; background: var(--surface-2);" />
            </div>
            <div class="field">
              <label>Abono / Anticipo recibido</label>
              <input type="number" id="ped-abono" min="0" step="500" value="${editing ? editing.abono : 0}" />
            </div>
            <div class="field">
              <label>Saldo pendiente</label>
              <input type="text" id="ped-saldo" readonly style="font-weight: 700; color: var(--danger); background: var(--surface-2);" />
            </div>
            <div class="field">
              <label>Medio de pago</label>
              <select id="ped-medio">
                ${['Transferencia', 'Efectivo', 'Débito', 'Crédito', 'Otro'].map(m => `
                  <option value="${m}" ${editing && editing.medioPago === m ? 'selected' : ''}>${m}</option>
                `).join('')}
              </select>
            </div>
            <div class="field">
              <label>Estado inicial</label>
              <select id="ped-estado">
                ${ESTADOS.filter(e => e.id !== 'todos').map(e => `
                  <option value="${e.id}" ${editing && editing.estado === e.id ? 'selected' : ''}>${e.label}</option>
                `).join('')}
              </select>
            </div>
            <div class="field full">
              <label>Dedicatoria / Notas especiales</label>
              <textarea id="ped-notas" rows="2" placeholder="Ej: Escribir en la torta 'Feliz día', velitas incluidas...">${editing ? escapeHtml(editing.notas || '') : ''}</textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">${editing ? 'Guardar Cambios' : 'Crear Pedido'}</button>
          </div>
        </form>
      `, { large: true });

      overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

      // Toggle despacho
      const selTipoEntrega = overlay.querySelector('#ped-tipo-entrega');
      const boxDireccion = overlay.querySelector('#box-direccion');
      selTipoEntrega.addEventListener('change', () => {
        boxDireccion.style.display = selTipoEntrega.value === 'despacho' ? 'block' : 'none';
      });

      // Render items agregados
      function renderItemsTabla(){
        const wrap = overlay.querySelector('#items-agregados-wrap');
        if (currentItems.length === 0){
          wrap.innerHTML = `<div class="text-soft" style="padding:10px; text-align:center; border: 1px dashed var(--line); border-radius: var(--radius-sm);">Aún no has agregado productos al pedido.</div>`;
          calcularTotales();
          return;
        }

        wrap.innerHTML = `
          <table style="width:100%; font-size:14px;">
            <thead>
              <tr style="border-bottom: 1px solid var(--line);">
                <th style="text-align:left;">Producto</th>
                <th>Cant.</th>
                <th>Precio Unit.</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${currentItems.map((item, idx) => `
                <tr>
                  <td><strong>${escapeHtml(item.nombre)}</strong></td>
                  <td style="text-align:center;">${item.cantidad}</td>
                  <td style="text-align:right;">${App.formatCLP(item.precioUnitario)}</td>
                  <td style="text-align:right;"><strong>${App.formatCLP(item.subtotal)}</strong></td>
                  <td style="text-align:center;">
                    <button type="button" class="btn btn-ghost btn-sm" data-remove-item="${idx}" style="color:var(--danger);">×</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        wrap.querySelectorAll('[data-remove-item]').forEach(btn => {
          btn.addEventListener('click', () => {
            currentItems.splice(Number(btn.dataset.removeItem), 1);
            renderItemsTabla();
          });
        });

        calcularTotales();
      }

      function calcularTotales(){
        const total = currentItems.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
        const abono = Number(overlay.querySelector('#ped-abono').value) || 0;
        const saldo = Math.max(0, total - abono);

        overlay.querySelector('#ped-total').value = App.formatCLP(total);
        overlay.querySelector('#ped-saldo').value = App.formatCLP(saldo);
      }

      overlay.querySelector('#ped-abono').addEventListener('input', calcularTotales);

      // Agregar item
      overlay.querySelector('#btn-agregar-item').addEventListener('click', () => {
        const sel = overlay.querySelector('#sel-producto');
        const cantInput = overlay.querySelector('#sel-cantidad');
        const prodId = sel.value;
        const cant = Number(cantInput.value) || 1;

        if (!prodId){
          App.toast('Selecciona un producto primero.', 'error');
          return;
        }
        if (cant <= 0){
          App.toast('La cantidad debe ser al menos 1.', 'error');
          return;
        }

        const opt = sel.selectedOptions[0];
        const precio = Number(opt.dataset.precio) || 0;
        const tipoStock = opt.dataset.tipo || 'terminado';
        const prodObj = productos.find(p => p.id === prodId);

        currentItems.push({
          productoId: prodId,
          nombre: prodObj ? prodObj.nombre : opt.textContent.split('—')[0].trim(),
          precioUnitario: precio,
          cantidad: cant,
          subtotal: precio * cant,
          tipoStock
        });

        cantInput.value = 1;
        sel.value = '';
        renderItemsTabla();
      });

      renderItemsTabla();

      // Submit
      overlay.querySelector('#form-pedido').addEventListener('submit', (e) => {
        e.preventDefault();

        if (currentItems.length === 0){
          App.toast('Debes agregar al menos un producto al pedido.', 'error');
          return;
        }

        const nombre = overlay.querySelector('#ped-nombre').value.trim();
        const telefono = overlay.querySelector('#ped-telefono').value.trim();
        const fecha = overlay.querySelector('#ped-fecha').value;

        if (!nombre || !telefono || !fecha){
          App.toast('Completa los campos obligatorios (*).', 'error');
          return;
        }

        const total = currentItems.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
        const abono = Number(overlay.querySelector('#ped-abono').value) || 0;

        const datos = {
          clienteNombre: nombre,
          clienteTelefono: telefono,
          clienteEmail: overlay.querySelector('#ped-email').value.trim(),
          tipoEntrega: overlay.querySelector('#ped-tipo-entrega').value,
          direccionDespacho: overlay.querySelector('#ped-direccion').value.trim(),
          fechaEntrega: fecha,
          horaEntrega: overlay.querySelector('#ped-hora').value,
          notas: overlay.querySelector('#ped-notas').value.trim(),
          total,
          abono,
          medioPago: overlay.querySelector('#ped-medio').value,
          estado: overlay.querySelector('#ped-estado').value,
          items: currentItems
        };

        if (editing){
          Storage.actualizarPedido(editing.id, datos);
          App.toast('Pedido modificado con éxito');
        } else {
          Storage.crearPedido({ ...datos, origen: 'manual' });
          App.toast('¡Pedido creado con éxito! Se descontó el stock de productos terminados.');
        }

        App.closeModal();
        render(container);
      });
    }

    function handleEliminarPedido(id){
      App.confirmAction({
        title: '¿Eliminar pedido?',
        message: 'Esta acción no se puede deshacer. Si el pedido tenía stock descontado, puedes cambiar su estado a "Cancelado" para restaurar el stock.',
        confirmLabel: 'Eliminar pedido',
        danger: true,
       onConfirm: async () => {
  try {
    await SupabaseBridge.eliminarPedido(id);
    Storage.eliminarPedido(id);
    App.toast('Pedido eliminado');
    render(container);
  } catch (error) {
    console.error('Error eliminando pedido:', error);
    App.toast('No se pudo eliminar el pedido: ' + error.message, 'error');
  }
}
      });
    }
    } catch(err){
      console.error('Error renderizando Pedidos:', err);
      container.innerHTML = `
        <div class="empty-state" style="padding:40px 20px;">
          <h3>Aviso al cargar Pedidos</h3>
          <p class="text-soft">${err.message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Reintentar</button>
        </div>
      `;
    }
  }

  function escapeHtml(str){
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Función reutilizable para renderizar el contenido de un ticket de 1/9 de carta */
  function generarTicketHTML(p, { isSingle = true } = {}){
    const config = Storage.get('configuracion') || {};
    const nombreNegocio = config.nombreNegocio || 'Dulces Mele';
    const tieneSaldo = Number(p.saldoPendiente) > 0;
    const fechaFmt = App.formatDate(p.fechaEntrega);

    return `
      <div class="ticket-paper ${isSingle ? 'ticket-paper-single' : ''}">
        <!-- Encabezado -->
        <div class="ticket-header">
          <div class="ticket-brand">🧁 ${escapeHtml(nombreNegocio)}</div>
          <div class="ticket-code">#${escapeHtml(p.codigo || '—')}</div>
        </div>

        <!-- Solo Nombre del cliente (sin telefono ni correo) -->
        <div class="ticket-client-name">👤 ${escapeHtml(p.clienteNombre)}</div>

        <!-- Fecha, hora y entrega -->
        <div class="ticket-meta">
          <span>📅 ${escapeHtml(fechaFmt)}${p.horaEntrega ? ` (${escapeHtml(p.horaEntrega)} hrs)` : ''}</span>
          <span class="badge ${p.tipoEntrega === 'despacho' ? 'badge-berry' : 'badge-neutral'}" style="font-size:10px; padding:1px 6px;">
            ${p.tipoEntrega === 'despacho' ? '🚚 Despacho' : '🏪 Retiro'}
          </span>
        </div>
        ${p.direccionDespacho ? `
          <div class="ticket-address">📍 ${escapeHtml(p.direccionDespacho)}</div>
        ` : ''}

        <!-- Detalle de productos -->
        <div class="ticket-items-list">
          ${(p.items || []).map(i => `
            <div class="ticket-item-row">
              <span class="ticket-item-qty">${i.cantidad}x</span>
              <span class="ticket-item-name">${escapeHtml(i.nombre)}</span>
              <span class="ticket-item-price">${App.formatCLP(i.subtotal)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Dedicatoria si existe -->
        ${p.notas ? `
          <div class="ticket-dedication">
            🎂 "${escapeHtml(p.notas)}"
          </div>
        ` : ''}

        <!-- Saldo total a pagar (único valor financiero) -->
        <div class="ticket-balance-box ${tieneSaldo ? '' : 'ticket-balance-paid'}">
          <div>
            <div class="ticket-balance-label">
              ${tieneSaldo ? 'SALDO A PAGAR:' : 'ESTADO:'}
            </div>
            <div class="ticket-balance-amount" style="color: ${tieneSaldo ? 'var(--danger)' : 'var(--sage)'};">
              ${tieneSaldo ? App.formatCLP(p.saldoPendiente) : '✓ TOTALMENTE PAGADO'}
            </div>
          </div>
          <div class="ticket-balance-method">
            ${escapeHtml(p.medioPago || 'Transferencia')}
          </div>
        </div>

        <!-- Pie -->
        <div class="ticket-footer">
          ¡Gracias por tu preferencia! ❤️ Conservar refrigerado
        </div>
      </div>
    `;
  }

  /* Modal de Ticket Individual */
  function openTicketModal(id){
    const pedidos = Storage.get('pedidos') || [];
    const p = pedidos.find(item => item.id === id);
    if (!p) return;

    const config = Storage.get('configuracion') || {};
    const nombreNegocio = config.nombreNegocio || 'Dulces Mele';
    const tieneSaldo = Number(p.saldoPendiente) > 0;

    const overlay = App.openModal(`
      <div class="modal-header no-print">
        <h3>Ticket de Entrega — #${escapeHtml(p.codigo || '')}</h3>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-sm" id="btn-imprimir-ticket">🖨️ Imprimir Ticket (1/9 Carta)</button>
          <button class="btn btn-secondary btn-sm" id="btn-copiar-ticket">📋 Copiar Texto</button>
          <button class="modal-close" data-close>${App.svgIcon('close')}</button>
        </div>
      </div>

      <div style="padding: 10px; background: var(--surface-2); border-radius: var(--radius-sm); margin-bottom: 12px; font-size: 13px;" class="no-print">
        💡 <strong>Formato 1/9 de hoja carta:</strong> Ajustado para recortar y pegar en la caja del pedido. Muestra solo el nombre del cliente y el saldo final a pagar.
      </div>

      <!-- Area imprimible del ticket -->
      <div id="ticket-print-area" style="padding: 10px 0; display:flex; justify-content:center;">
        ${generarTicketHTML(p, { isSingle: true })}
      </div>

      <div class="modal-footer no-print">
        <button class="btn btn-secondary" data-close>Cerrar</button>
        <button class="btn btn-primary" id="btn-imprimir-ticket-footer">🖨️ Imprimir Ticket</button>
      </div>
    `, { large: false });

    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

    const triggerPrint = () => {
      const modal = overlay.querySelector('.modal');
      if (modal) modal.scrollTop = 0;
      window.scrollTo(0, 0);
      window.print();
    };
    overlay.querySelector('#btn-imprimir-ticket').addEventListener('click', triggerPrint);
    overlay.querySelector('#btn-imprimir-ticket-footer').addEventListener('click', triggerPrint);

    overlay.querySelector('#btn-copiar-ticket').addEventListener('click', () => {
      const itemsTxt = (p.items || []).map(i => `• ${i.cantidad}x ${i.nombre} - ${App.formatCLP(i.subtotal)}`).join('\n');
      const textoResumen = 
`🧁 ${nombreNegocio.toUpperCase()} — TICKET #${p.codigo || ''}
----------------------------------------
Cliente: ${p.clienteNombre}
Entrega: ${App.formatDate(p.fechaEntrega)} ${p.horaEntrega ? `(${p.horaEntrega} hrs)` : ''}
Modalidad: ${p.tipoEntrega === 'despacho' ? `Despacho a ${p.direccionDespacho}` : 'Retiro en local'}
----------------------------------------
PRODUCTOS:
${itemsTxt}
${p.notas ? `\nDedicatoria: "${p.notas}"\n` : ''}
----------------------------------------
${tieneSaldo ? `SALDO TOTAL A PAGAR: ${App.formatCLP(p.saldoPendiente)}` : 'ESTADO: TOTALMENTE PAGADO ✓'}
Medio: ${p.medioPago || 'Transferencia'}
----------------------------------------
¡Gracias! ❤️ Conservar refrigerado`;

      navigator.clipboard.writeText(textoResumen).then(() => {
        App.toast('Texto del ticket copiado al portapapeles');
      }).catch(() => {
        App.toast('No se pudo copiar automáticamente', 'error');
      });
    });
  }

  /* Modal para imprimir Hoja Carta con Selección Personalizada de Tickets */
  function openHojaTicketsModal(preseleccionadosIds = []){
    const pedidos = Storage.get('pedidos') || [];
    const hoyISO = Storage.todayISO();

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const mananaISO = manana.toISOString().slice(0, 10);

    const en7 = new Date();
    en7.setDate(en7.getDate() + 7);
    const en7ISO = en7.toISOString().slice(0, 10);

    let activos = pedidos.filter(p => p.estado !== 'cancelado');
    activos.sort((a,b) => {
      if (a.fechaEntrega === hoyISO && b.fechaEntrega !== hoyISO) return -1;
      if (b.fechaEntrega === hoyISO && a.fechaEntrega !== hoyISO) return 1;
      return (a.fechaEntrega || '').localeCompare(b.fechaEntrega || '');
    });

    if (activos.length === 0){
      App.toast('No hay pedidos activos para imprimir tickets', 'error');
      return;
    }

    // Mapa de selección: id -> copias (1, 2, 3...)
    const seleccionMap = new Map();

    if (Array.isArray(preseleccionadosIds) && preseleccionadosIds.length > 0){
      preseleccionadosIds.forEach(id => {
        if (activos.some(p => p.id === id)) seleccionMap.set(id, 1);
      });
    } else {
      // Por defecto preseleccionar los de hoy y mañana (hasta 9)
      const porDefecto = activos.filter(p => p.fechaEntrega === hoyISO || p.fechaEntrega === mananaISO);
      if (porDefecto.length > 0) {
        porDefecto.slice(0, 9).forEach(p => seleccionMap.set(p.id, 1));
      } else {
        activos.slice(0, 9).forEach(p => seleccionMap.set(p.id, 1));
      }
    }

    const overlay = App.openModal(`
      <div class="modal-header no-print">
        <div>
          <h3 style="margin:0;">🖨️ Hoja de Tickets (Personalizada)</h3>
          <div class="text-soft" style="font-size:12px;">Escoge qué pedidos imprimir y cuántas copias necesitas (3×3 por hoja carta)</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-sm" id="btn-imprimir-hoja">🖨️ Imprimir Tickets</button>
          <button class="modal-close" data-close>${App.svgIcon('close')}</button>
        </div>
      </div>

      <!-- PANEL DE CONTROL Y SELECCIÓN (no-print) -->
      <div class="no-print" style="background:var(--surface-2); padding:12px 14px; border-radius:var(--radius-sm); margin-bottom:14px; border:1px solid var(--line);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-sel-hoy">🔥 Solo Hoy</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-sel-manana">📅 Solo Mañana</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-sel-hoy-manana">🗓️ Hoy y Mañana</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-sel-semana">Próximos 7 días</button>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-sel-todos">✓ Todos</button>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-sel-ninguno">✕ Desmarcar</button>
          </div>
          <div id="tickets-contador-badge" style="font-size:13px; font-weight:700; color:var(--berry);">
            <!-- Se actualiza dinámicamente -->
          </div>
        </div>

        <div style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--ink-soft); margin-bottom:6px;">
          Selecciona los pedidos para esta impresión:
        </div>

        <!-- LISTA CON CHECKBOXES -->
        <div id="tickets-check-list" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:6px; max-height:160px; overflow-y:auto; padding:4px;">
          <!-- Items generados dinámicamente -->
        </div>
      </div>

      <div class="no-print" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:12px; color:var(--ink-soft);">
        <span>✂️ <strong>Vista previa de hoja carta:</strong> Organizados con líneas punteadas para recortar y pegar en las cajas.</span>
      </div>

      <!-- AREA IMPRIMIBLE -->
      <div id="ticket-print-area">
        <!-- Grilla generada dinámicamente -->
      </div>

      <div class="modal-footer no-print" style="margin-top:16px;">
        <button class="btn btn-secondary" data-close>Cerrar</button>
        <button class="btn btn-primary" id="btn-imprimir-hoja-footer">🖨️ Imprimir Tickets</button>
      </div>
    `, { large: true });

    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

    const containerPrint = overlay.querySelector('#ticket-print-area');
    const badgeContador = overlay.querySelector('#tickets-contador-badge');
    const listCheckWrap = overlay.querySelector('#tickets-check-list');

    function actualizarVistaTickets(){
      // 1. Renderizar checklist
      listCheckWrap.innerHTML = activos.map(p => {
        const checked = seleccionMap.has(p.id);
        const copias = seleccionMap.get(p.id) || 1;
        const esHoy = p.fechaEntrega === hoyISO;
        const esManana = p.fechaEntrega === mananaISO;
        const tagDia = esHoy ? '<span class="badge badge-berry" style="font-size:10px; padding:1px 4px;">HOY</span>' : (esManana ? '<span class="badge badge-amber" style="font-size:10px; padding:1px 4px;">MAÑANA</span>' : '');

        return `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; padding:6px 8px; background:${checked ? 'var(--berry-soft)' : 'var(--surface)'}; border:1px solid ${checked ? 'var(--berry)' : 'var(--line)'}; border-radius:var(--radius-sm); font-size:12px;">
            <label style="display:flex; align-items:center; gap:6px; margin:0; cursor:pointer; flex:1; overflow:hidden;">
              <input type="checkbox" data-check-pedido="${p.id}" ${checked ? 'checked' : ''} style="cursor:pointer;" />
              <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                <strong>#${escapeHtml(p.codigo || '')}</strong> ${tagDia}
                <span>${escapeHtml(p.clienteNombre)}</span>
                <span class="text-soft" style="font-size:11px;">(${App.formatDate(p.fechaEntrega)})</span>
              </div>
            </label>
            ${checked ? `
              <div style="display:flex; align-items:center; gap:2px;">
                <button type="button" class="btn btn-ghost btn-sm" data-mod-copia="${p.id}" data-delta="-1" style="padding:0 5px; font-size:11px;" title="Menos copias">-</button>
                <span style="font-weight:700; font-size:11px;">${copias}x</span>
                <button type="button" class="btn btn-ghost btn-sm" data-mod-copia="${p.id}" data-delta="1" style="padding:0 5px; font-size:11px;" title="Más copias">+</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      // Event listeners del checklist
      listCheckWrap.querySelectorAll('[data-check-pedido]').forEach(chk => {
        chk.addEventListener('change', () => {
          const id = chk.dataset.checkPedido;
          if (chk.checked) seleccionMap.set(id, 1);
          else seleccionMap.delete(id);
          actualizarVistaTickets();
        });
      });

      listCheckWrap.querySelectorAll('[data-mod-copia]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.modCopia;
          const delta = Number(btn.dataset.delta);
          const act = seleccionMap.get(id) || 1;
          const nuevo = Math.max(1, act + delta);
          seleccionMap.set(id, nuevo);
          actualizarVistaTickets();
        });
      });

      // 2. Construir lista plana de tickets a imprimir
      const ticketsAImprimir = [];
      activos.forEach(p => {
        if (seleccionMap.has(p.id)){
          const copias = seleccionMap.get(p.id) || 1;
          for (let i = 0; i < copias; i++){
            ticketsAImprimir.push(p);
          }
        }
      });

      // 3. Actualizar contador
      const totalTickets = ticketsAImprimir.length;
      const numHojas = Math.max(1, Math.ceil(totalTickets / 9));
      badgeContador.innerHTML = totalTickets === 0 
        ? `<span style="color:var(--danger);">⚠️ Ningún ticket seleccionado</span>`
        : `<span>📌 ${totalTickets} ticket(s) seleccionados • ${numHojas} hoja(s) carta</span>`;

      // 4. Renderizar preview por hojas de 9
      if (totalTickets === 0){
        containerPrint.innerHTML = `
          <div class="empty-state no-print" style="padding:30px 10px; background:var(--surface-2); border-radius:var(--radius-sm);">
            <h4>No has seleccionado ningún ticket</h4>
            <p class="text-soft">Marca los pedidos que deseas imprimir usando las casillas de arriba.</p>
          </div>
        `;
        return;
      }

      const chunks = [];
      for (let i = 0; i < ticketsAImprimir.length; i += 9){
        chunks.push(ticketsAImprimir.slice(i, i + 9));
      }

      containerPrint.innerHTML = chunks.map((chunk, sheetIdx) => `
        <div style="margin-bottom: ${sheetIdx < chunks.length - 1 ? '24px' : '0'};">
          ${chunks.length > 1 ? `
            <div class="no-print" style="font-size:12px; font-weight:700; color:var(--ink-soft); margin-bottom:6px;">
              📄 Hoja ${sheetIdx + 1} de ${chunks.length} (${chunk.length} tickets):
            </div>
          ` : ''}
          <div class="tickets-sheet-grid">
            ${chunk.map(p => generarTicketHTML(p, { isSingle: false })).join('')}
          </div>
        </div>
      `).join('');
    }

    // Botones rápidos de selección
    overlay.querySelector('#btn-sel-hoy').addEventListener('click', () => {
      seleccionMap.clear();
      activos.filter(p => p.fechaEntrega === hoyISO).forEach(p => seleccionMap.set(p.id, 1));
      actualizarVistaTickets();
    });

    overlay.querySelector('#btn-sel-manana').addEventListener('click', () => {
      seleccionMap.clear();
      activos.filter(p => p.fechaEntrega === mananaISO).forEach(p => seleccionMap.set(p.id, 1));
      actualizarVistaTickets();
    });

    overlay.querySelector('#btn-sel-hoy-manana').addEventListener('click', () => {
      seleccionMap.clear();
      activos.filter(p => p.fechaEntrega === hoyISO || p.fechaEntrega === mananaISO).forEach(p => seleccionMap.set(p.id, 1));
      actualizarVistaTickets();
    });

    overlay.querySelector('#btn-sel-semana').addEventListener('click', () => {
      seleccionMap.clear();
      activos.filter(p => p.fechaEntrega >= hoyISO && p.fechaEntrega <= en7ISO).forEach(p => seleccionMap.set(p.id, 1));
      actualizarVistaTickets();
    });

    overlay.querySelector('#btn-sel-todos').addEventListener('click', () => {
      seleccionMap.clear();
      activos.forEach(p => seleccionMap.set(p.id, 1));
      actualizarVistaTickets();
    });

    overlay.querySelector('#btn-sel-ninguno').addEventListener('click', () => {
      seleccionMap.clear();
      actualizarVistaTickets();
    });

    actualizarVistaTickets();

    const triggerPrint = () => {
      if (seleccionMap.size === 0){
        App.toast('Selecciona al menos un pedido para imprimir.', 'error');
        return;
      }
      const modal = overlay.querySelector('.modal');
      if (modal) modal.scrollTop = 0;
      window.scrollTo(0, 0);
      window.print();
    };

    overlay.querySelector('#btn-imprimir-hoja').addEventListener('click', triggerPrint);
    overlay.querySelector('#btn-imprimir-hoja-footer').addEventListener('click', triggerPrint);
  }

  return {
    render,
    openTicketModal,
    openHojaTicketsModal,
    escapeHtml,
    openPedidoModal: (id = null) => {
      if (openPedidoModalRef) {
        openPedidoModalRef(id);
      } else {
        App.goTo('pedidos');
        setTimeout(() => { if (openPedidoModalRef) openPedidoModalRef(id); }, 120);
      }
    },
    openCambiarEstadoModal: (id) => {
      if (openCambiarEstadoModalRef) {
        openCambiarEstadoModalRef(id);
      } else {
        App.goTo('pedidos');
        setTimeout(() => { if (openCambiarEstadoModalRef) openCambiarEstadoModalRef(id); }, 120);
      }
    }
  };
})();
