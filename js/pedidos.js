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

  function render(container){
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
    document.getElementById('btn-hoja-tickets').addEventListener('click', () => openHojaTicketsModal());
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
                <th>Código / Fecha</th>
                <th>Cliente y Entrega</th>
                <th>Productos</th>
                <th>Total / Abono</th>
                <th>Saldo Pendiente</th>
                <th>Estado</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(p => {
                const esHoy = p.fechaEntrega === todayISO;
                const tieneSaldo = Number(p.saldoPendiente) > 0;
                const itemsTexto = (p.items || []).map(i => `${i.cantidad}x ${escapeHtml(i.nombre)}`).join(', ');
                const estadoBadge = getEstadoBadge(p.estado);

                return `
                  <tr style="${esHoy ? 'background: #FFFDF9;' : ''}">
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
                      <div><strong>${App.formatCLP(p.total)}</strong></div>
                      <div class="text-soft" style="font-size:12px;">Abono: ${App.formatCLP(p.abono)}</div>
                    </td>
                    <td>
                      <strong style="color: ${tieneSaldo ? 'var(--danger)' : 'var(--sage)'}; font-size:15px;">
                        ${tieneSaldo ? App.formatCLP(p.saldoPendiente) : '✓ Pagado'}
                      </strong>
                      <div class="text-soft" style="font-size:11px;">${escapeHtml(p.medioPago || '')}</div>
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

    /* Modal rápido para cambiar estado */
    function openCambiarEstadoModal(id){
      const pedidos = Storage.get('pedidos');
      const p = pedidos.find(item => item.id === id);
      if (!p) return;

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
              <label>Abono actual (CLP)</label>
              <input type="number" id="p-nuevo-abono" min="0" max="${p.total}" value="${p.abono || 0}" />
              <div class="text-soft" style="font-size:12px; margin-top:4px;">
                Total del pedido: ${App.formatCLP(p.total)}. Si pagó la totalidad, pon ${p.total}.
              </div>
            </div>
            <div class="field full" id="box-venta-auto" style="display:none; background: var(--surface-2); padding:10px; border-radius: var(--radius-sm);">
              <label style="font-weight: 600;">
                <input type="checkbox" id="check-registrar-venta" checked />
                Registrar automáticamente en el módulo de Ventas al marcar como Entregado
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Actualizar estado</button>
          </div>
        </form>
      `);

      overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

      const selEstado = overlay.querySelector('#p-nuevo-estado');
      const boxVenta = overlay.querySelector('#box-venta-auto');
      selEstado.addEventListener('change', () => {
        boxVenta.style.display = selEstado.value === 'entregado' ? 'block' : 'none';
      });
      if (selEstado.value === 'entregado') boxVenta.style.display = 'block';

      overlay.querySelector('#form-estado').addEventListener('submit', (e) => {
        e.preventDefault();
        const nuevoEstado = selEstado.value;
        const nuevoAbono = Number(document.getElementById('p-nuevo-abono').value) || 0;
        const registrarVenta = document.getElementById('check-registrar-venta') ? document.getElementById('check-registrar-venta').checked : false;

        Storage.actualizarPedido(p.id, {
          estado: nuevoEstado,
          abono: nuevoAbono,
          registrarComoVenta: nuevoEstado === 'entregado' && registrarVenta
        });

        App.closeModal();
        App.toast('Estado de pedido actualizado correctamente');
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
        onConfirm: () => {
          Storage.eliminarPedido(id);
          App.toast('Pedido eliminado');
          render(container);
        }
      });
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

  /* Modal para imprimir Hoja Carta Completa con 9 tickets (3 columnas x 3 filas) */
  function openHojaTicketsModal(){
    const pedidos = Storage.get('pedidos') || [];
    const hoyISO = Storage.todayISO();

    // Priorizar pedidos activos para hoy y pendientes
    let activos = pedidos.filter(p => p.estado !== 'cancelado');
    activos.sort((a,b) => {
      if (a.fechaEntrega === hoyISO && b.fechaEntrega !== hoyISO) return -1;
      if (b.fechaEntrega === hoyISO && a.fechaEntrega !== hoyISO) return 1;
      return (a.fechaEntrega || '').localeCompare(b.fechaEntrega || '');
    });

    if (activos.length === 0){
      App.toast('No hay pedidos activos para imprimir en la hoja', 'error');
      return;
    }

    // Tomar los primeros 9 (o repetir si hay menos de 9 para aprovechar la hoja)
    const ticketsPagina = activos.slice(0, 9);

    const overlay = App.openModal(`
      <div class="modal-header no-print">
        <h3>Hoja de Tickets (Carta 3x3 — 9 tickets para recortar)</h3>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-sm" id="btn-imprimir-hoja">🖨️ Imprimir Hoja Carta</button>
          <button class="modal-close" data-close>${App.svgIcon('close')}</button>
        </div>
      </div>

      <div style="background: var(--surface-2); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 12px; font-size: 13px;" class="no-print">
        ✂️ <strong>Aprovecha tu hoja carta:</strong> Organiza hasta 9 tickets en una sola página (3 columnas × 3 filas) con líneas punteadas para recortar con tijera y pegar a las cajas de entrega.
      </div>

      <!-- Area imprimible en grilla 3x3 -->
      <div id="ticket-print-area">
        <div class="tickets-sheet-grid">
          ${ticketsPagina.map(p => generarTicketHTML(p, { isSingle: false })).join('')}
        </div>
      </div>

      <div class="modal-footer no-print">
        <button class="btn btn-secondary" data-close>Cerrar</button>
        <button class="btn btn-primary" id="btn-imprimir-hoja-footer">🖨️ Imprimir Hoja Carta</button>
      </div>
    `, { large: true });

    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

    const triggerPrint = () => {
      const modal = overlay.querySelector('.modal');
      if (modal) modal.scrollTop = 0;
      window.scrollTo(0, 0);
      window.print();
    };
    overlay.querySelector('#btn-imprimir-hoja').addEventListener('click', triggerPrint);
    overlay.querySelector('#btn-imprimir-hoja-footer').addEventListener('click', triggerPrint);
  }

  return { render, openTicketModal, openHojaTicketsModal, escapeHtml };
})();
