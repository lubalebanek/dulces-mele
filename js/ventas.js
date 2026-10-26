/* ============================================================
   GESTOR DE PASTELERÍA — ventas.js
   Registro de ventas. IMPORTANTE: al guardar una venta se copia
   el precio del producto en ese momento (precioUnitario). Si el
   precio del producto cambia después, esta venta no se altera.
   ============================================================ */

const Ventas = (() => {

  const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Otro'];
  let filtros = { fecha: '', producto: '', categoria: '', medioPago: '', origen: '' };

  function render(container){
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Ventas</h1>
          <div class="subtitle">Registra y controla cada venta</div>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" id="btn-nueva-venta">${App.svgIcon('plus')} Nueva venta directa</button>
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
        <div id="ventas-table"></div>
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
      if (filtros.producto) ventas = ventas.filter(v => v.productoNombre.toLowerCase().includes(filtros.producto.toLowerCase()));
      if (filtros.categoria) ventas = ventas.filter(v => v.categoria === filtros.categoria);
      if (filtros.medioPago) ventas = ventas.filter(v => v.medioPago === filtros.medioPago);
      if (filtros.origen === 'pedido') ventas = ventas.filter(v => v.pedidoId || v.pedidoCodigo);
      if (filtros.origen === 'directa') ventas = ventas.filter(v => !v.pedidoId && !v.pedidoCodigo);

      const tableEl = document.getElementById('ventas-table');
      if (ventas.length === 0){
        tableEl.innerHTML = `<div class="empty-state"><h3>No hay ventas para mostrar</h3><p>Ajusta los filtros o registra una nueva venta.</p></div>`;
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
                  <td><span class="badge badge-neutral">${v.medioPago}</span></td>
                  <td class="cell-actions">
                    <button class="btn btn-secondary btn-sm" data-edit="${v.id}">Editar</button>
                    <button class="btn btn-danger btn-sm" data-del="${v.id}">Eliminar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      tableEl.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.edit)));
      tableEl.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => handleDelete(b.dataset.del)));
    }

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
          <h3>${editing ? 'Editar venta' : 'Nueva venta'}</h3>
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
                ${productos.map(p => `<option value="${p.id}" data-precio="${p.precioVenta}" data-cat="${p.categoria}" ${editing && editing.productoId === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('')}
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
        if (!editing){ // sólo autocompletar precio si es venta nueva o el usuario cambió de producto
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
        const cantidad = inputCantidad.value;
        const precio = inputPrecio.value;
        const opt = selProducto.options[selProducto.selectedIndex];

        if (!App.isValidDate(fecha)){ App.toast('Ingresa una fecha válida.', 'error'); return; }
        if (!App.isPositiveNumber(cantidad) || Number(cantidad) <= 0){ App.toast('La cantidad debe ser mayor a 0.', 'error'); return; }
        if (!App.isPositiveNumber(precio)){ App.toast('El precio no puede ser negativo.', 'error'); return; }

        const ventasActuales = Storage.get('ventas');
        const registro = {
          id: editing ? editing.id : Storage.generateId('venta'),
          fecha,
          productoId: opt.value,
          productoNombre: opt.textContent,
          categoria: opt.dataset.cat,
          cantidad: Number(cantidad),
          precioUnitario: Number(precio),
          total: Number(cantidad) * Number(precio),
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
        }
        Storage.save('ventas', ventasActuales);
        App.closeModal();
        App.toast('Venta registrada correctamente');
        renderTable();
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
          renderTable();
        }
      });
    }
  }

  function escapeHtmlLocal(str){
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  return { render };
})();
