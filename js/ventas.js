/* ============================================================
   GESTOR DE PASTELERÍA — ventas.js
   Registro de ventas con barra de totales en vivo, punto de venta (POS)
   multiproducto para el mesón con calculadora de vuelto,
   descuento de stock en vitrina y comprobante de venta.
   ============================================================ */

const Ventas = (() => {

  const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Otro'];
  let filtros = { fecha: '', producto: '', categoria: '', medioPago: '', origen: '' };

  function render(container){
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Ventas</h1>
          <div class="subtitle">Registra y controla cada venta de mostrador y pedidos</div>
        </div>
        <div class="header-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-primary" id="btn-pos-multiproducto" style="background:#2D6A4F; border-color:#2D6A4F; font-weight:600;">
            🛒 Venta Rápida Mesón (Carrito)
          </button>
          <button class="btn btn-secondary" id="btn-nueva-venta">
            ${App.svgIcon('plus')} Venta individual
          </button>
        </div>
      </div>

      <div class="card">
        <div class="filters-bar">
          <div class="field">
            <label>Fecha</label>
            <input type="date" id="f-fecha" value="${filtros.fecha}" />
          </div>
          <div class="field">
            <label>Producto</label>
            <input type="text" id="f-producto" placeholder="Buscar…" value="${filtros.producto}" />
          </div>
          <div class="field">
            <label>Categoría</label>
            <select id="f-categoria"><option value="">Todas</option></select>
          </div>
          <div class="field">
            <label>Medio de pago</label>
            <select id="f-medio">
              <option value="">Todos</option>
              ${MEDIOS_PAGO.map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Origen</label>
            <select id="f-origen">
              <option value="">Todos</option>
              <option value="pedido">📦 Solo Pedidos Web</option>
              <option value="directa">🏪 Solo Ventas de Mesón</option>
            </select>
          </div>
          <button class="btn btn-ghost" id="btn-limpiar-filtros" style="align-self: flex-end;">Limpiar</button>
        </div>

        <!-- BARRA RESUMEN DE TOTALES FILTRADOS -->
        <div id="ventas-resumen-bar" style="margin-top:12px; padding:12px 16px; background:var(--surface-2); border-radius:var(--radius-sm); display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between; border-left:4px solid var(--accent);">
          <!-- Se llena dinámicamente en renderTable -->
        </div>

        <div id="ventas-table" style="margin-top:16px;"></div>
      </div>
    `;

    const categorias = [...new Set(Storage.get('productos').map(p => p.categoria))].sort();
    const selCat = document.getElementById('f-categoria');
    categorias.forEach(c => selCat.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`));
    document.getElementById('f-fecha').value = filtros.fecha;
    document.getElementById('f-producto').value = filtros.producto;
    selCat.value = filtros.categoria;
    document.getElementById('f-medio').value = filtros.medioPago;
    document.getElementById('f-origen').value = filtros.origen;

    document.getElementById('btn-pos-multiproducto').addEventListener('click', () => openPosModal());
    document.getElementById('btn-nueva-venta').addEventListener('click', () => openForm());
    document.getElementById('f-fecha').addEventListener('input', (e) => { filtros.fecha = e.target.value; renderTable(); });
    document.getElementById('f-producto').addEventListener('input', (e) => { filtros.producto = e.target.value; renderTable(); });
    selCat.addEventListener('change', (e) => { filtros.categoria = e.target.value; renderTable(); });
    document.getElementById('f-medio').addEventListener('change', (e) => { filtros.medioPago = e.target.value; renderTable(); });
    document.getElementById('f-origen').addEventListener('change', (e) => { filtros.origen = e.target.value; renderTable(); });
    document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
      filtros = { fecha: '', producto: '', categoria: '', medioPago: '', origen: '' };
      render(container);
    });

    renderTable();

    function renderTable(){
      let ventas = Storage.get('ventas').sort((a,b) => b.fecha.localeCompare(a.fecha) || (b.creadoEn||0) - (a.creadoEn||0));
      if (filtros.fecha) ventas = ventas.filter(v => v.fecha === filtros.fecha);
      if (filtros.producto) ventas = ventas.filter(v => (v.productoNombre || '').toLowerCase().includes(filtros.producto.toLowerCase()));
      if (filtros.categoria) ventas = ventas.filter(v => v.categoria === filtros.categoria);
      if (filtros.medioPago) ventas = ventas.filter(v => v.medioPago === filtros.medioPago);
      if (filtros.origen === 'pedido') ventas = ventas.filter(v => v.pedidoId || v.pedidoCodigo);
      if (filtros.origen === 'directa') ventas = ventas.filter(v => !v.pedidoId && !v.pedidoCodigo);

      // Actualizar la Barra Resumen
      const totalFiltrado = Analytics.sum(ventas, 'total');
      const unidadesFiltradas = Analytics.sum(ventas, 'cantidad');
      const efectivo = Analytics.sum(ventas.filter(v => v.medioPago === 'Efectivo'), 'total');
      const transferencia = Analytics.sum(ventas.filter(v => v.medioPago === 'Transferencia'), 'total');
      const otros = totalFiltrado - (efectivo + transferencia);

      const resumenBar = document.getElementById('ventas-resumen-bar');
      if (resumenBar) {
        resumenBar.innerHTML = `
          <div>
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ink-soft); font-weight:700;">Total Filtrado</div>
            <div style="font-size:20px; font-weight:700; color:var(--ink);">${App.formatCLP(totalFiltrado)}</div>
          </div>
          <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:13px;">
            <div>💵 <strong>Efectivo:</strong> ${App.formatCLP(efectivo)}</div>
            <div>💳 <strong>Transferencias:</strong> ${App.formatCLP(transferencia)}</div>
            ${otros > 0 ? `<div>💳 <strong>Débito/Otros:</strong> ${App.formatCLP(otros)}</div>` : ''}
          </div>
          <div style="font-size:12px; color:var(--ink-soft);">
            <strong>${ventas.length}</strong> registro(s) • <strong>${unidadesFiltradas}</strong> unidades
          </div>
        `;
      }

      const tableEl = document.getElementById('ventas-table');
      if (ventas.length === 0){
        tableEl.innerHTML = `<div class="empty-state"><h3>No hay ventas para mostrar</h3><p>Ajusta los filtros o registra una nueva venta en el mostrador.</p></div>`;
        return;
      }

      tableEl.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Producto / Origen</th><th>Cant.</th><th>Precio unit.</th><th>Total</th><th>Medio de pago</th><th></th></tr></thead>
            <tbody>
              ${ventas.map(v => `
                <tr>
                  <td>${App.formatDate(v.fecha)}</td>
                  <td>
                    <strong>${Productos.escapeHtml(v.productoNombre)}</strong>
                    ${v.pedidoCodigo ? `
                      <span class="badge badge-berry" style="font-size:11px; margin-left:6px;" title="Venta originada del pedido #${v.pedidoCodigo}">
                        📦 #${v.pedidoCodigo}
                      </span>
                    ` : '<span class="badge badge-neutral" style="font-size:10px; margin-left:6px;">🏪 Mesón</span>'}
                    ${v.observaciones ? `<div class="text-soft" style="font-size:11px; margin-top:2px;">${Productos.escapeHtml(v.observaciones)}</div>` : ''}
                    ${v.demo ? '<span class="tag-demo">EJEMPLO</span>' : ''}
                  </td>
                  <td>${v.cantidad}</td>
                  <td>${App.formatCLP(v.precioUnitario)}</td>
                  <td><strong>${App.formatCLP(v.total)}</strong></td>
                  <td>
                    <span class="badge ${v.medioPago === 'Efectivo' ? 'badge-sage' : 'badge-neutral'}">
                      ${v.medioPago === 'Efectivo' ? '💵 Efectivo' : `💳 ${v.medioPago}`}
                    </span>
                  </td>
                  <td class="cell-actions" style="text-align:right;">
                    <button class="btn btn-secondary btn-sm" data-ticket="${v.id}" title="Imprimir Comprobante de venta">📄 Recibo</button>
                    <button class="btn btn-secondary btn-sm" data-edit="${v.id}">Editar</button>
                    <button class="btn btn-danger btn-sm" data-del="${v.id}">Eliminar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      tableEl.querySelectorAll('[data-ticket]').forEach(b => b.addEventListener('click', () => openTicketVentaModal(b.dataset.ticket)));
      tableEl.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.edit)));
      tableEl.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => handleDelete(b.dataset.del)));
    }
  }

  /* ---------------- PUNTO DE VENTA (POS) MULTIPRODUCTO ---------------- */
  function openPosModal(){
    const productos = Storage.get('productos').filter(p => p.estado === 'activo');
    if (productos.length === 0){
      App.toast('No hay productos activos en el catálogo.', 'error');
      return;
    }

    let carrito = [];

    const overlay = App.openModal(`
      <div class="modal-header">
        <div>
          <h3 style="margin:0;">🛒 Venta Rápida de Mesón</h3>
          <div class="text-soft" style="font-size:12px;">Agrega varios productos, cobra y calcula el vuelto en un solo paso</div>
        </div>
        <button class="modal-close" data-close>${App.svgIcon('close')}</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Selector rápido de productos -->
        <div style="background:var(--surface-2); padding:12px; border-radius:var(--radius-sm);">
          <div class="form-grid" style="grid-template-columns: 2fr 1fr auto; align-items:flex-end; gap:8px;">
            <div class="field" style="margin:0;">
              <label>Seleccionar Producto</label>
              <select id="pos-select-producto">
                <option value="">-- Elige un producto --</option>
                ${productos.map(p => `
                  <option value="${p.id}" data-precio="${p.precioVenta}" data-nombre="${Productos.escapeHtml(p.nombre)}" data-cat="${p.categoria}" data-stock="${p.stockActual}" data-tipo="${p.tipoStock}">
                    ${p.nombre} — ${App.formatCLP(p.precioVenta)} ${p.tipoStock === 'terminado' ? `(Stock: ${p.stockActual})` : ''}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="field" style="margin:0;">
              <label>Cantidad</label>
              <input type="number" id="pos-cantidad" min="1" step="1" value="1" />
            </div>
            <button type="button" class="btn btn-primary" id="pos-btn-agregar" style="height:42px;">
              + Agregar
            </button>
          </div>
        </div>

        <!-- Tabla del carrito -->
        <div id="pos-carrito-wrap" style="max-height:220px; overflow-y:auto; border:1px solid var(--line); border-radius:var(--radius-sm); padding:8px;">
          <!-- Dinámico -->
        </div>

        <!-- Totales, pago y vuelto -->
        <div style="background:var(--surface-2); padding:14px; border-radius:var(--radius-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-size:16px; font-weight:600;">Total a Cobrar:</span>
            <span id="pos-total-cobrar" style="font-size:24px; font-weight:800; color:var(--ink);">$0</span>
          </div>

          <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:12px;">
            <div class="field" style="margin:0;">
              <label>Medio de Pago</label>
              <select id="pos-medio-pago">
                <option value="Efectivo">💵 Efectivo</option>
                <option value="Transferencia">💳 Transferencia</option>
                <option value="Débito">💳 Débito</option>
                <option value="Crédito">💳 Crédito</option>
              </select>
            </div>
            <div class="field" style="margin:0;" id="pos-wrap-paga-con">
              <label>Paga con (CLP)</label>
              <input type="number" id="pos-paga-con" placeholder="Ej: 10000" min="0" step="100" />
            </div>
          </div>

          <div id="pos-vuelto-box" style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#fff; border-radius:var(--radius-sm); border:1px dashed #2D6A4F;">
            <span style="font-weight:600; color:#2D6A4F;">Vuelto / Cambio a entregar:</span>
            <span id="pos-vuelto-monto" style="font-size:18px; font-weight:800; color:#2D6A4F;">$0</span>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="margin-top:16px;">
        <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
        <button type="button" class="btn btn-primary" id="pos-btn-finalizar" style="background:#2D6A4F; border-color:#2D6A4F; font-size:16px; padding:10px 20px;">
          ✓ Cobrar y Registrar
        </button>
      </div>
    `, { large: true });

    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

    const selProd = overlay.querySelector('#pos-select-producto');
    const inputCant = overlay.querySelector('#pos-cantidad');
    const btnAgregar = overlay.querySelector('#pos-btn-agregar');
    const wrapCarrito = overlay.querySelector('#pos-carrito-wrap');
    const elTotal = overlay.querySelector('#pos-total-cobrar');
    const selMedio = overlay.querySelector('#pos-medio-pago');
    const inputPagaCon = overlay.querySelector('#pos-paga-con');
    const wrapPagaCon = overlay.querySelector('#pos-wrap-paga-con');
    const boxVuelto = overlay.querySelector('#pos-vuelto-box');
    const elVuelto = overlay.querySelector('#pos-vuelto-monto');
    const btnFinalizar = overlay.querySelector('#pos-btn-finalizar');

    function renderCarrito(){
      if (carrito.length === 0){
        wrapCarrito.innerHTML = `<div class="text-soft" style="text-align:center; padding:16px;">El carrito está vacío. Agrega productos arriba.</div>`;
        elTotal.textContent = App.formatCLP(0);
        calcularVuelto();
        return;
      }

      const total = carrito.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
      elTotal.textContent = App.formatCLP(total);

      wrapCarrito.innerHTML = `
        <table style="width:100%; font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid var(--line); text-align:left;">
              <th>Producto</th>
              <th style="text-align:center;">Cant.</th>
              <th style="text-align:right;">P. Unit.</th>
              <th style="text-align:right;">Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${carrito.map((it, idx) => `
              <tr>
                <td><strong>${it.nombre}</strong></td>
                <td style="text-align:center;">
                  <button type="button" class="btn btn-ghost btn-sm" data-mod-cant="${idx}" data-delta="-1" style="padding:1px 6px;">-</button>
                  <span style="font-weight:700; margin:0 4px;">${it.cantidad}</span>
                  <button type="button" class="btn btn-ghost btn-sm" data-mod-cant="${idx}" data-delta="1" style="padding:1px 6px;">+</button>
                </td>
                <td style="text-align:right;">${App.formatCLP(it.precioUnitario)}</td>
                <td style="text-align:right;"><strong>${App.formatCLP(it.cantidad * it.precioUnitario)}</strong></td>
                <td style="text-align:center;">
                  <button type="button" class="btn btn-ghost btn-sm" data-del-item="${idx}" style="color:var(--danger); font-size:16px;">×</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      wrapCarrito.querySelectorAll('[data-mod-cant]').forEach(b => {
        b.addEventListener('click', () => {
          const idx = Number(b.dataset.modCant);
          const delta = Number(b.dataset.delta);
          carrito[idx].cantidad += delta;
          if (carrito[idx].cantidad <= 0) carrito.splice(idx, 1);
          renderCarrito();
        });
      });

      wrapCarrito.querySelectorAll('[data-del-item]').forEach(b => {
        b.addEventListener('click', () => {
          carrito.splice(Number(b.dataset.delItem), 1);
          renderCarrito();
        });
      });

      calcularVuelto();
    }

    function calcularVuelto(){
      const total = carrito.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
      const medio = selMedio.value;

      if (medio !== 'Efectivo'){
        wrapPagaCon.style.display = 'none';
        boxVuelto.style.display = 'none';
        return;
      }

      wrapPagaCon.style.display = 'block';
      boxVuelto.style.display = 'flex';

      const pagaCon = Number(inputPagaCon.value) || 0;
      const vuelto = Math.max(0, pagaCon - total);
      elVuelto.textContent = App.formatCLP(vuelto);
    }

    btnAgregar.addEventListener('click', () => {
      const prodId = selProd.value;
      const cant = Number(inputCant.value) || 1;
      if (!prodId){
        App.toast('Selecciona un producto.', 'error');
        return;
      }
      if (cant <= 0){
        App.toast('La cantidad debe ser al menos 1.', 'error');
        return;
      }

      const opt = selProd.selectedOptions[0];
      const precio = Number(opt.dataset.precio) || 0;
      const nombre = opt.dataset.nombre || opt.textContent.split('—')[0].trim();
      const categoria = opt.dataset.cat || 'Otros';
      const tipoStock = opt.dataset.tipo || 'terminado';

      const existeIdx = carrito.findIndex(i => i.productoId === prodId);
      if (existeIdx !== -1){
        carrito[existeIdx].cantidad += cant;
      } else {
        carrito.push({
          productoId: prodId,
          nombre,
          categoria,
          precioUnitario: precio,
          cantidad: cant,
          tipoStock
        });
      }

      selProd.value = '';
      inputCant.value = 1;
      renderCarrito();
    });

    selMedio.addEventListener('change', calcularVuelto);
    inputPagaCon.addEventListener('input', calcularVuelto);

    btnFinalizar.addEventListener('click', () => {
      if (carrito.length === 0){
        App.toast('Agrega al menos un producto al carrito para cobrar.', 'error');
        return;
      }

      const total = carrito.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
      const medio = selMedio.value;
      const fecha = Storage.todayISO();
      const ticketId = `POS-${Math.floor(1000 + Math.random() * 9000)}`;

      const ventasActuales = Storage.get('ventas');
      const nuevasVentas = [];

      carrito.forEach(it => {
        const v = {
          id: Storage.generateId('venta'),
          fecha,
          productoId: it.productoId,
          productoNombre: it.nombre,
          categoria: it.categoria,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          total: it.cantidad * it.precioUnitario,
          medioPago: medio,
          observaciones: `Venta mesón #${ticketId}`,
          ticketId,
          origen: 'meson',
          creadoEn: Date.now()
        };
        ventasActuales.push(v);
        nuevasVentas.push(v);

        // Descontar de stock de vitrina si es terminado
        if (it.tipoStock === 'terminado' && it.productoId){
          Storage.descontarStockProducto(it.productoId, it.cantidad);
        }
      });

      Storage.save('ventas', ventasActuales);

      // Sincronizar en la nube
      if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.guardarVentasNube === 'function'){
        SupabaseBridge.guardarVentasNube(nuevasVentas);
      }

      App.closeModal();
      App.toast(`✓ Venta #${ticketId} cobrada con éxito (${App.formatCLP(total)})`, 'success');
      App.goTo('ventas');
    });

    renderCarrito();
  }

  /* ---------------- COMPROBANTE / RECIBO DE VENTA ---------------- */
  function openTicketVentaModal(ventaId){
    const ventas = Storage.get('ventas');
    const v = ventas.find(item => item.id === ventaId);
    if (!v) return;

    const overlay = App.openModal(`
      <div class="modal-header no-print">
        <h3>Comprobante de Venta</h3>
        <button class="modal-close" data-close>${App.svgIcon('close')}</button>
      </div>

      <div style="background:#fff; border:1px dashed var(--ink-soft); padding:16px; border-radius:var(--radius-sm); max-width:320px; margin:0 auto; font-family:monospace; font-size:12px; color:#000;">
        <div style="text-align:center; margin-bottom:10px;">
          <strong style="font-size:16px; font-family:var(--font-display);">DULCES MELE</strong><br/>
          <span>Andrea Lebanek</span><br/>
          <span style="font-size:11px;">Pastelería Artesanal</span><br/>
          <span>--------------------------------</span>
        </div>

        <div style="margin-bottom:8px;">
          <div><strong>Fecha:</strong> ${App.formatDate(v.fecha)}</div>
          <div><strong>Origen:</strong> ${v.pedidoCodigo ? `Pedido Web #${v.pedidoCodigo}` : 'Venta Mesón'}</div>
          <div><strong>Pago:</strong> ${v.medioPago}</div>
        </div>

        <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:6px 0; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between;">
            <span>${v.cantidad}x ${v.productoNombre}</span>
            <strong>${App.formatCLP(v.total)}</strong>
          </div>
          <div style="font-size:10px; color:#555;">(P. Unit: ${App.formatCLP(v.precioUnitario)})</div>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:12px;">
          <strong>TOTAL PAGADO:</strong>
          <strong>${App.formatCLP(v.total)}</strong>
        </div>

        <div style="text-align:center; font-size:10px;">
          ¡Gracias por endulzar tu día con nosotros!<br/>
          Instagram / WhatsApp: +56 9 6479 0920
        </div>
      </div>

      <div class="modal-footer no-print" style="margin-top:16px;">
        <button type="button" class="btn btn-secondary" data-close>Cerrar</button>
        <button type="button" class="btn btn-primary" onclick="window.print()">🖨️ Imprimir Recibo</button>
      </div>
    `);

    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));
  }

  /* ---------------- FORMULARIO INDIVIDUAL DE VENTA ---------------- */
  function openForm(id){
    const ventas = Storage.get('ventas');
    const editing = id ? ventas.find(v => v.id === id) : null;
    const productos = Storage.get('productos').filter(p => p.estado === 'activo' || (editing && p.id === editing.productoId));

    if (productos.length === 0 && !editing){
      App.toast('Primero agrega al menos un producto activo.', 'error');
      return;
    }

    const overlay = App.openModal(`
      <div class="modal-header">
        <h3>${editing ? 'Editar venta' : 'Nueva venta individual'}</h3>
        <button class="modal-close" data-close>${App.svgIcon('close')}</button>
      </div>
      <form id="form-venta">
        <div class="form-grid">
          <div class="field">
            <label>Fecha *</label>
            <input type="date" id="v-fecha" value="${editing ? editing.fecha : Storage.todayISO()}" required />
          </div>
          <div class="field">
            <label>Producto *</label>
            <select id="v-producto" required>
              ${productos.map(p => `<option value="${p.id}" data-precio="${p.precioVenta}" data-cat="${p.categoria}" data-stock="${p.stockActual}" data-tipo="${p.tipoStock}" ${editing && editing.productoId === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Cantidad *</label>
            <input type="number" id="v-cantidad" min="1" step="1" value="${editing ? editing.cantidad : 1}" required />
          </div>
          <div class="field">
            <label>Precio unitario (CLP) *</label>
            <input type="number" id="v-precio" min="0" step="1" value="${editing ? editing.precioUnitario : (productos[0] ? productos[0].precioVenta : 0)}" required />
          </div>
          <div class="field">
            <label>Medio de pago</label>
            <select id="v-medio">
              ${MEDIOS_PAGO.map(m => `<option value="${m}" ${editing && editing.medioPago === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Total</label>
            <div class="total-preview"><span>Total</span><span id="v-total-preview">${App.formatCLP(editing ? editing.total : (productos[0]?.precioVenta || 0))}</span></div>
          </div>
          <div class="field full">
            <label>Observaciones</label>
            <textarea id="v-obs" rows="2">${editing ? escapeHtmlLocal(editing.observaciones || '') : ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar venta</button>
        </div>
      </form>
    `);
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

    const selProducto = document.getElementById('v-producto');
    const inputCantidad = document.getElementById('v-cantidad');
    const inputPrecio = document.getElementById('v-precio');
    const totalPreview = document.getElementById('v-total-preview');

    function updateTotal(){
      const total = (Number(inputCantidad.value) || 0) * (Number(inputPrecio.value) || 0);
      totalPreview.textContent = App.formatCLP(total);
    }
    selProducto.addEventListener('change', () => {
      if (!editing){
        const opt = selProducto.options[selProducto.selectedIndex];
        inputPrecio.value = opt.dataset.precio;
      }
      updateTotal();
    });
    inputCantidad.addEventListener('input', updateTotal);
    inputPrecio.addEventListener('input', updateTotal);

    overlay.querySelector('#form-venta').addEventListener('submit', (e) => {
      e.preventDefault();
      const fecha = document.getElementById('v-fecha').value;
      const cantidad = Number(inputCantidad.value) || 1;
      const precio = Number(inputPrecio.value) || 0;
      const opt = selProducto.options[selProducto.selectedIndex];

      if (!App.isValidDate(fecha)){ App.toast('Ingresa una fecha válida.', 'error'); return; }
      if (cantidad <= 0){ App.toast('La cantidad debe ser mayor a 0.', 'error'); return; }
      if (precio < 0){ App.toast('El precio no puede ser negativo.', 'error'); return; }

      const ventasActuales = Storage.get('ventas');
      const registro = {
        id: editing ? editing.id : Storage.generateId('venta'),
        fecha,
        productoId: opt.value,
        productoNombre: opt.textContent.split('—')[0].trim(),
        categoria: opt.dataset.cat,
        cantidad,
        precioUnitario: precio,
        total: cantidad * precio,
        medioPago: document.getElementById('v-medio').value,
        observaciones: document.getElementById('v-obs').value.trim(),
        demo: editing ? !!editing.demo : false,
        creadoEn: editing ? editing.creadoEn : Date.now()
      };

      if (editing){
        const idx = ventasActuales.findIndex(v => v.id === editing.id);
        ventasActuales[idx] = registro;
      }else{
        ventasActuales.push(registro);
        // Si es venta directa de un producto terminado, descontar stock
        if (opt.dataset.tipo === 'terminado'){
          Storage.descontarStockProducto(opt.value, cantidad);
        }
      }
      Storage.save('ventas', ventasActuales);
      App.closeModal();
      App.toast('Venta registrada correctamente');
      App.goTo('ventas');
    });
  }

  function handleDelete(id){
    App.confirmAction({
      title: 'Eliminar venta',
      message: '¿Eliminar esta venta? Esta acción no se puede deshacer.',
      onConfirm: () => {
        const ventas = Storage.get('ventas').filter(v => v.id !== id);
        Storage.save('ventas', ventas);
        App.toast('Venta eliminada');
        App.goTo('ventas');
      }
    });
  }

  function escapeHtmlLocal(str){
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  return { render, openPosModal, openForm, openTicketVentaModal };
})();
