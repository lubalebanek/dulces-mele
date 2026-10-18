/* ============================================================
   GESTOR DE PASTELERÍA — gastos.js
   Registro de compras y gastos generales del negocio.
   ============================================================ */

const Gastos = (() => {

  const CATEGORIAS = ['Materias primas','Ingredientes','Embalaje','Transporte','Gas','Electricidad','Publicidad','Equipamiento','Otros'];
  const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Otro'];

  function render(container){
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Gastos</h1>
          <div class="subtitle">Compras y gastos del negocio</div>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" id="btn-nuevo-gasto">${App.svgIcon('plus')} Nuevo gasto</button>
        </div>
      </div>
      <div class="card"><div id="gastos-table"></div></div>
    `;
    document.getElementById('btn-nuevo-gasto').addEventListener('click', () => openForm());
    renderTable();

    function renderTable(){
      const gastos = Storage.get('gastos').sort((a,b) => b.fecha.localeCompare(a.fecha));
      const tableEl = document.getElementById('gastos-table');
      if (gastos.length === 0){
        tableEl.innerHTML = `<div class="empty-state"><h3>No hay gastos registrados</h3><p>Registra tu primer gasto o compra.</p></div>`;
        return;
      }
      tableEl.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Proveedor</th><th>Monto</th><th>Medio de pago</th><th></th></tr></thead>
            <tbody>
              ${gastos.map(g => `
                <tr>
                  <td>${App.formatDate(g.fecha)}</td>
                  <td><span class="badge badge-neutral">${g.tipo}</span></td>
                  <td>${Productos.escapeHtml(g.descripcion)} ${g.origenInventario ? '<span class="badge badge-berry" style="margin-left:6px;">desde inventario</span>' : ''}</td>
                  <td>${Productos.escapeHtml(g.proveedor || '—')}</td>
                  <td><strong>${App.formatCLP(g.monto)}</strong></td>
                  <td>${g.medioPago}</td>
                  <td class="cell-actions">
                    <button class="btn btn-secondary btn-sm" data-edit="${g.id}">Editar</button>
                    <button class="btn btn-danger btn-sm" data-del="${g.id}">Eliminar</button>
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
      const gastos = Storage.get('gastos');
      const editing = id ? gastos.find(g => g.id === id) : null;
      const overlay = App.openModal(`
        <div class="modal-header">
          <h3>${editing ? 'Editar gasto' : 'Nuevo gasto'}</h3>
          <button class="modal-close" data-close>${App.svgIcon('close')}</button>
        </div>
        <form id="form-gasto">
          <div class="form-grid">
            <div class="field">
              <label>Fecha *</label>
              <input type="date" id="g-fecha" value="${editing ? editing.fecha : Storage.todayISO()}" required />
            </div>
            <div class="field">
              <label>Tipo de gasto</label>
              <select id="g-tipo">${CATEGORIAS.map(c => `<option value="${c}" ${editing && editing.tipo === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
            </div>
            <div class="field full">
              <label>Descripción *</label>
              <input type="text" id="g-desc" value="${editing ? Productos.escapeHtml(editing.descripcion) : ''}" required />
            </div>
            <div class="field">
              <label>Proveedor</label>
              <input type="text" id="g-proveedor" value="${editing ? Productos.escapeHtml(editing.proveedor || '') : ''}" />
            </div>
            <div class="field">
              <label>Monto (CLP) *</label>
              <input type="number" id="g-monto" min="0" step="1" value="${editing ? editing.monto : ''}" required />
            </div>
            <div class="field full">
              <label>Medio de pago</label>
              <select id="g-medio">${MEDIOS_PAGO.map(m => `<option value="${m}" ${editing && editing.medioPago === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
            </div>
            <div class="field full">
              <label>Observaciones</label>
              <textarea id="g-obs" rows="2">${editing ? Productos.escapeHtml(editing.observaciones || '') : ''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar gasto</button>
          </div>
        </form>
      `);
      overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));
      overlay.querySelector('#form-gasto').addEventListener('submit', (e) => {
        e.preventDefault();
        const fecha = document.getElementById('g-fecha').value;
        const desc = document.getElementById('g-desc').value.trim();
        const monto = document.getElementById('g-monto').value;

        if (!App.isValidDate(fecha)){ App.toast('Ingresa una fecha válida.', 'error'); return; }
        if (!desc){ App.toast('Ingresa una descripción.', 'error'); return; }
        if (!App.isPositiveNumber(monto)){ App.toast('El monto no puede ser negativo.', 'error'); return; }

        const gastosActuales = Storage.get('gastos');
        const registro = {
          id: editing ? editing.id : Storage.generateId('gasto'),
          fecha, tipo: document.getElementById('g-tipo').value, descripcion: desc,
          proveedor: document.getElementById('g-proveedor').value.trim(),
          monto: Number(monto), medioPago: document.getElementById('g-medio').value,
          observaciones: document.getElementById('g-obs').value.trim(),
          origenInventario: editing ? !!editing.origenInventario : false,
          demo: editing ? !!editing.demo : false
        };
        if (editing){
          const idx = gastosActuales.findIndex(g => g.id === editing.id);
          gastosActuales[idx] = registro;
        }else{
          gastosActuales.push(registro);
        }
        Storage.save('gastos', gastosActuales);
        App.closeModal();
        App.toast('Gasto registrado correctamente');
        renderTable();
      });
    }

    function handleDelete(id){
      App.confirmAction({
        title: 'Eliminar gasto',
        message: '¿Eliminar este gasto? Esta acción no se puede deshacer.',
        onConfirm: () => {
          Storage.save('gastos', Storage.get('gastos').filter(g => g.id !== id));
          App.toast('Gasto eliminado');
          renderTable();
        }
      });
    }
  }

  return { render };
})();
