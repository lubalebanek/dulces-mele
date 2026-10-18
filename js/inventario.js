/* ============================================================
   GESTOR DE PASTELERÍA — inventario.js
   Control de insumos y materias primas. Las entradas/salidas
   quedan registradas en movimientosInventario y actualizan el
   stockActual del insumo automáticamente.
   ============================================================ */

const Inventario = (() => {

  const CATEGORIAS = ['Materias primas','Ingredientes','Decoración','Embalaje','Limpieza','Otros'];
  const UNIDADES = ['kg','g','litro','ml','unidad','caja','paquete','otro'];
  let vista = 'insumos'; // 'insumos' | 'historial'

  function render(container){
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Inventario</h1>
          <div class="subtitle">Materias primas, insumos y materiales</div>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" id="btn-salida">Salida de inventario</button>
          <button class="btn btn-secondary" id="btn-entrada">Entrada de inventario</button>
          <button class="btn btn-primary" id="btn-nuevo-insumo">${App.svgIcon('plus')} Nuevo insumo</button>
        </div>
      </div>

      <div class="flex gap-8" style="margin-bottom:16px;">
        <button class="btn ${vista === 'insumos' ? 'btn-berry' : 'btn-secondary'} btn-sm" id="tab-insumos">Insumos</button>
        <button class="btn ${vista === 'historial' ? 'btn-berry' : 'btn-secondary'} btn-sm" id="tab-historial">Historial de movimientos</button>
      </div>

      <div id="inventario-content"></div>
    `;

    document.getElementById('btn-nuevo-insumo').addEventListener('click', () => openInsumoForm());
    document.getElementById('btn-entrada').addEventListener('click', () => openMovimientoForm('entrada'));
    document.getElementById('btn-salida').addEventListener('click', () => openMovimientoForm('salida'));
    document.getElementById('tab-insumos').addEventListener('click', () => { vista = 'insumos'; render(container); });
    document.getElementById('tab-historial').addEventListener('click', () => { vista = 'historial'; render(container); });

    if (vista === 'insumos') renderInsumos(); else renderHistorial();

    function renderInsumos(){
      const insumos = Storage.get('insumos').sort((a,b) => a.nombre.localeCompare(b.nombre));
      const content = document.getElementById('inventario-content');
      if (insumos.length === 0){
        content.innerHTML = `<div class="card"><div class="empty-state"><h3>Aún no hay insumos</h3><p>Agrega tu primer insumo para controlar el stock.</p></div></div>`;
        return;
      }
      content.innerHTML = `
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Insumo</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Costo unit.</th><th>Proveedor</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                ${insumos.map(i => {
                  const bajo = i.stockActual <= i.stockMinimo;
                  return `
                  <tr>
                    <td>${Productos.escapeHtml(i.nombre)} ${i.demo ? '<span class="tag-demo">EJEMPLO</span>' : ''}</td>
                    <td>${i.categoria}</td>
                    <td>${i.stockActual} ${i.unidadMedida}</td>
                    <td>${i.stockMinimo} ${i.unidadMedida}</td>
                    <td>${App.formatCLP(i.costoUnitario)}</td>
                    <td>${Productos.escapeHtml(i.proveedor || '—')}</td>
                    <td>${bajo ? '<span class="badge badge-amber">Stock bajo</span>' : '<span class="badge badge-sage">OK</span>'}</td>
                    <td class="cell-actions">
                      <button class="btn btn-secondary btn-sm" data-edit="${i.id}">Editar</button>
                      <button class="btn btn-danger btn-sm" data-del="${i.id}">Eliminar</button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      content.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openInsumoForm(b.dataset.edit)));
      content.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => handleDeleteInsumo(b.dataset.del)));
    }

    function renderHistorial(){
      const movs = Storage.get('movimientosInventario').sort((a,b) => b.fecha.localeCompare(a.fecha) || (b.creadoEn||0)-(a.creadoEn||0));
      const content = document.getElementById('inventario-content');
      if (movs.length === 0){
        content.innerHTML = `<div class="card"><div class="empty-state"><h3>Sin movimientos aún</h3><p>Las entradas y salidas de inventario aparecerán aquí.</p></div></div>`;
        return;
      }
      content.innerHTML = `
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Insumo</th><th>Tipo</th><th>Cantidad</th><th>Costo</th><th>Motivo</th></tr></thead>
              <tbody>
                ${movs.map(m => `
                  <tr>
                    <td>${App.formatDate(m.fecha)}</td>
                    <td>${Productos.escapeHtml(m.insumoNombre)}</td>
                    <td><span class="badge ${m.tipo === 'entrada' ? 'badge-sage' : m.tipo === 'salida' ? 'badge-danger' : 'badge-neutral'}">${m.tipo}</span></td>
                    <td>${m.cantidad}</td>
                    <td>${m.costo ? App.formatCLP(m.costo) : '—'}</td>
                    <td>${Productos.escapeHtml(m.motivo || '—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function openInsumoForm(id){
      const insumos = Storage.get('insumos');
      const editing = id ? insumos.find(i => i.id === id) : null;
      const overlay = App.openModal(`
        <div class="modal-header">
          <h3>${editing ? 'Editar insumo' : 'Nuevo insumo'}</h3>
          <button class="modal-close" data-close>${App.svgIcon('close')}</button>
        </div>
        <form id="form-insumo">
          <div class="form-grid">
            <div class="field full">
              <label>Nombre *</label>
              <input type="text" id="i-nombre" value="${editing ? Productos.escapeHtml(editing.nombre) : ''}" required />
            </div>
            <div class="field">
              <label>Categoría</label>
              <select id="i-categoria">${CATEGORIAS.map(c => `<option value="${c}" ${editing && editing.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
            </div>
            <div class="field">
              <label>Unidad de medida</label>
              <select id="i-unidad">${UNIDADES.map(u => `<option value="${u}" ${editing && editing.unidadMedida === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
            </div>
            <div class="field">
              <label>Stock actual *</label>
              <input type="number" id="i-stock" min="0" step="0.01" value="${editing ? editing.stockActual : 0}" required />
            </div>
            <div class="field">
              <label>Stock mínimo *</label>
              <input type="number" id="i-stockmin" min="0" step="0.01" value="${editing ? editing.stockMinimo : 0}" required />
            </div>
            <div class="field">
              <label>Costo unitario (CLP)</label>
              <input type="number" id="i-costo" min="0" step="1" value="${editing ? editing.costoUnitario : 0}" />
            </div>
            <div class="field">
              <label>Proveedor</label>
              <input type="text" id="i-proveedor" value="${editing ? Productos.escapeHtml(editing.proveedor || '') : ''}" />
            </div>
            <div class="field full">
              <label>Estado</label>
              <select id="i-estado">
                <option value="activo" ${!editing || editing.estado === 'activo' ? 'selected' : ''}>Activo</option>
                <option value="inactivo" ${editing && editing.estado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar insumo</button>
          </div>
        </form>
      `);
      overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));
      overlay.querySelector('#form-insumo').addEventListener('submit', (e) => {
        e.preventDefault();
        const nombre = document.getElementById('i-nombre').value.trim();
        const stock = document.getElementById('i-stock').value;
        const stockMin = document.getElementById('i-stockmin').value;
        const costo = document.getElementById('i-costo').value || 0;

        if (!nombre){ App.toast('Ingresa un nombre para el insumo.', 'error'); return; }
        if (!App.isPositiveNumber(stock)){ App.toast('El stock actual no puede ser negativo.', 'error'); return; }
        if (!App.isPositiveNumber(stockMin)){ App.toast('El stock mínimo no puede ser negativo.', 'error'); return; }

        const insumosActuales = Storage.get('insumos');
        const registro = {
          id: editing ? editing.id : Storage.generateId('ins'),
          nombre, categoria: document.getElementById('i-categoria').value,
          unidadMedida: document.getElementById('i-unidad').value,
          stockActual: Number(stock), stockMinimo: Number(stockMin),
          costoUnitario: Number(costo),
          proveedor: document.getElementById('i-proveedor').value.trim(),
          fechaUltimaCompra: editing ? editing.fechaUltimaCompra : Storage.todayISO(),
          estado: document.getElementById('i-estado').value,
          demo: editing ? !!editing.demo : false
        };
        if (editing){
          const idx = insumosActuales.findIndex(i => i.id === editing.id);
          insumosActuales[idx] = registro;
        }else{
          insumosActuales.push(registro);
        }
        Storage.save('insumos', insumosActuales);
        App.closeModal();
        App.toast('Insumo agregado correctamente');
        vista = 'insumos';
        render(container);
      });
    }

    function handleDeleteInsumo(id){
      const insumos = Storage.get('insumos');
      const insumo = insumos.find(i => i.id === id);
      App.confirmAction({
        title: 'Eliminar insumo',
        message: `¿Eliminar "${insumo.nombre}"? El historial de movimientos asociado se conservará.`,
        onConfirm: () => {
          Storage.save('insumos', insumos.filter(i => i.id !== id));
          App.toast('Insumo eliminado');
          render(container);
        }
      });
    }

    function openMovimientoForm(tipo){
      const insumos = Storage.get('insumos').filter(i => i.estado === 'activo');
      if (insumos.length === 0){
        App.toast('Primero agrega al menos un insumo activo.', 'error');
        return;
      }
      const config = Storage.get('configuracion');
      const overlay = App.openModal(`
        <div class="modal-header">
          <h3>${tipo === 'entrada' ? 'Entrada de inventario' : 'Salida de inventario'}</h3>
          <button class="modal-close" data-close>${App.svgIcon('close')}</button>
        </div>
        <form id="form-movimiento">
          <div class="form-grid">
            <div class="field full">
              <label>Insumo *</label>
              <select id="m-insumo" required>
                ${insumos.map(i => `<option value="${i.id}" data-stock="${i.stockActual}" data-unidad="${i.unidadMedida}" data-costo="${i.costoUnitario}">${i.nombre} (stock: ${i.stockActual} ${i.unidadMedida})</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Cantidad *</label>
              <input type="number" id="m-cantidad" min="0.01" step="0.01" required />
            </div>
            ${tipo === 'entrada' ? `
            <div class="field">
              <label>Costo total (CLP)</label>
              <input type="number" id="m-costo" min="0" step="1" value="0" />
            </div>` : ''}
            <div class="field full">
              <label>Motivo / observación</label>
              <input type="text" id="m-motivo" placeholder="${tipo === 'entrada' ? 'Ej: compra a proveedor' : 'Ej: usado en producción'}" />
            </div>
            ${tipo === 'entrada' ? `
            <div class="field full">
              <label class="flex gap-8" style="align-items:center; font-weight:600; font-size:0.85rem;">
                <input type="checkbox" id="m-tambien-gasto" style="width:auto;" checked />
                Registrar también como gasto (evita duplicar si ya lo registraste en Gastos)
              </label>
            </div>` : ''}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar ${tipo === 'entrada' ? 'entrada' : 'salida'}</button>
          </div>
        </form>
      `);
      overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

      overlay.querySelector('#form-movimiento').addEventListener('submit', (e) => {
        e.preventDefault();
        const insumoSel = document.getElementById('m-insumo');
        const opt = insumoSel.options[insumoSel.selectedIndex];
        const cantidad = document.getElementById('m-cantidad').value;

        if (!App.isPositiveNumber(cantidad) || Number(cantidad) <= 0){ App.toast('La cantidad debe ser mayor a 0.', 'error'); return; }

        const insumosActuales = Storage.get('insumos');
        const idx = insumosActuales.findIndex(i => i.id === opt.value);
        const insumo = insumosActuales[idx];
        const config = Storage.get('configuracion');

        let nuevoStock;
        if (tipo === 'entrada'){
          nuevoStock = insumo.stockActual + Number(cantidad);
        }else{
          nuevoStock = insumo.stockActual - Number(cantidad);
          if (nuevoStock < 0 && !config.permitirStockNegativo){
            App.toast('No hay stock suficiente. Actívalo en Configuración si deseas permitir stock negativo.', 'error');
            return;
          }
        }
        insumo.stockActual = nuevoStock;
        if (tipo === 'entrada') insumo.fechaUltimaCompra = Storage.todayISO();
        insumosActuales[idx] = insumo;
        Storage.save('insumos', insumosActuales);

        const costo = tipo === 'entrada' ? Number(document.getElementById('m-costo').value || 0) : 0;
        const motivo = document.getElementById('m-motivo').value.trim();

        const movimientos = Storage.get('movimientosInventario');
        movimientos.push({
          id: Storage.generateId('mov'), fecha: Storage.todayISO(), insumoId: insumo.id,
          insumoNombre: insumo.nombre, tipo, cantidad: Number(cantidad), costo, motivo,
          creadoEn: Date.now()
        });
        Storage.save('movimientosInventario', movimientos);

        // Registrar también como gasto si corresponde (evitando duplicar)
        const tambienGasto = tipo === 'entrada' && document.getElementById('m-tambien-gasto') && document.getElementById('m-tambien-gasto').checked;
        if (tambienGasto && costo > 0){
          const gastos = Storage.get('gastos');
          gastos.push({
            id: Storage.generateId('gasto'), fecha: Storage.todayISO(), tipo: 'Materias primas',
            descripcion: `Compra de ${cantidad} ${insumo.unidadMedida} de ${insumo.nombre}`,
            proveedor: insumo.proveedor || '', monto: costo, medioPago: 'Otro',
            observaciones: 'Generado automáticamente desde Inventario', origenInventario: true, demo: false
          });
          Storage.save('gastos', gastos);
        }

        App.closeModal();
        App.toast(tipo === 'entrada' ? 'Entrada registrada correctamente' : 'Salida registrada correctamente');
        vista = 'historial';
        render(container);
      });
    }
  }

  return { render };
})();
