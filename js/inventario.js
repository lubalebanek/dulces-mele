/* ============================================================
   GESTOR DE PASTELERÍA — inventario.js
   Control de insumos y materias primas. Las entradas/salidas
   quedan registradas en movimientosInventario y actualizan el
   stockActual del insumo automáticamente.
   ============================================================ */

const Inventario = (() => {

  const CATEGORIAS = ['Materias primas','Ingredientes','Decoración','Embalaje','Limpieza','Otros'];
  const UNIDADES = ['kg','g','litro','ml','unidad','caja','paquete','otro'];
  let vista = 'insumos'; // 'insumos' | 'historial' | 'estimador'
  let estimadorPeriodo = 'mes_actual';
  let estimadorFactor = 1.0;
  let estimadorMostrarDesglose = false;

  function render(container){
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Inventario</h1>
          <div class="subtitle">Materias primas, insumos y materiales</div>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" id="btn-sync-inventario" title="Sincronizar inventario con la nube Supabase">☁️ Sincronizar Nube</button>
          <button class="btn btn-secondary" id="btn-vaciar-inventario" style="color: var(--danger); border-color: var(--line);" title="Eliminar todos los insumos de ejemplo">🗑️ Vaciar todo</button>
          <button class="btn btn-secondary" id="btn-salida">Salida de inventario</button>
          <button class="btn btn-secondary" id="btn-entrada">Entrada de inventario</button>
          <button class="btn btn-primary" id="btn-nuevo-insumo">${App.svgIcon('plus')} Nuevo insumo</button>
        </div>
      </div>

      <div class="flex gap-8" style="margin-bottom:16px; flex-wrap:wrap;">
        <button class="btn ${vista === 'insumos' ? 'btn-berry' : 'btn-secondary'} btn-sm" id="tab-insumos">Insumos</button>
        <button class="btn ${vista === 'historial' ? 'btn-berry' : 'btn-secondary'} btn-sm" id="tab-historial">Historial de movimientos</button>
        <button class="btn ${vista === 'estimador' ? 'btn-berry' : 'btn-secondary'} btn-sm" id="tab-estimador" style="font-weight:700;">🛒 Estimador de Compras</button>
      </div>

      <div id="inventario-content"></div>
    `;

    document.getElementById('btn-nuevo-insumo').addEventListener('click', () => openInsumoForm());
    document.getElementById('btn-entrada').addEventListener('click', () => openMovimientoForm('entrada'));
    document.getElementById('btn-salida').addEventListener('click', () => openMovimientoForm('salida'));
    document.getElementById('btn-sync-inventario')?.addEventListener('click', async () => {
      if (typeof SupabaseBridge !== 'undefined') {
        App.toast('Sincronizando inventario con la nube...');
        await SupabaseBridge.sincronizarTodo(true);
        render(container);
      }
    });
    document.getElementById('btn-vaciar-inventario')?.addEventListener('click', () => {
      const insumos = Storage.get('insumos');
      if (insumos.length === 0){
        App.toast('El inventario ya está vacío.');
        return;
      }
      App.confirmAction({
        title: '¿Vaciar todo el inventario?',
        message: `Se eliminarán los ${insumos.length} insumos de ejemplo para que puedas registrar tus materias primas e ingredientes reales desde cero.`,
        confirmLabel: 'Vaciar inventario',
        danger: true,
        onConfirm: () => {
          Storage.vaciarInventario();
          if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.vaciarInsumosNube === 'function') {
            SupabaseBridge.vaciarInsumosNube();
          }
          App.toast('✓ Inventario vaciado. Listo para cargar tus materias primas.');
          render(container);
        }
      });
    });
    document.getElementById('tab-insumos').addEventListener('click', () => { vista = 'insumos'; render(container); });
    document.getElementById('tab-historial').addEventListener('click', () => { vista = 'historial'; render(container); });
    document.getElementById('tab-estimador').addEventListener('click', () => { vista = 'estimador'; render(container); });

    if (vista === 'insumos') renderInsumos();
    else if (vista === 'historial') renderHistorial();
    else if (vista === 'estimador') renderEstimadorCompras();

    function renderInsumos(){
      const insumos = Storage.get('insumos').sort((a,b) => a.nombre.localeCompare(b.nombre));
      const content = document.getElementById('inventario-content');
      if (insumos.length === 0){
        content.innerHTML = `
          <div class="card">
            <div class="empty-state" style="padding: 40px 20px;">
              <h3>Aún no hay insumos</h3>
              <p class="text-soft">El inventario está limpio. Ya puedes cargar tus materias primas e ingredientes reales.</p>
              <div style="display:flex; gap:10px; justify-content:center; margin-top:16px; flex-wrap:wrap;">
                <button class="btn btn-primary" id="btn-empty-nuevo">${App.svgIcon('plus')} Agregar mi primer insumo</button>
              </div>
            </div>
          </div>
        `;
        content.querySelector('#btn-empty-nuevo')?.addEventListener('click', () => openInsumoForm());
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
        if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.guardarInsumoNube === 'function') {
          SupabaseBridge.guardarInsumoNube(registro);
        }
        App.closeModal();
        App.toast(editing ? 'Insumo actualizado' : 'Insumo agregado');
        vista = 'insumos';
        render(container);
      });
    }

    function handleDeleteInsumo(id){
      const insumos = Storage.get('insumos');
      const insumo = insumos.find(i => i.id === id);
      if (!insumo) return;
      App.confirmAction({
        title: 'Eliminar insumo',
        message: `¿Eliminar "${insumo.nombre}"? El historial de movimientos asociado se conservará.`,
        onConfirm: () => {
          localStorage.setItem('gp_pasteleriaSeedApplied', '1');
          Storage.save('insumos', insumos.filter(i => i.id !== id));
          if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.eliminarInsumoNube === 'function') {
            SupabaseBridge.eliminarInsumoNube(id);
          }
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
        if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.guardarInsumoNube === 'function') {
          SupabaseBridge.guardarInsumoNube(insumo);
        }

        const costo = tipo === 'entrada' ? Number(document.getElementById('m-costo').value || 0) : 0;
        const motivo = document.getElementById('m-motivo').value.trim();

        const movimientos = Storage.get('movimientosInventario');
        const nuevoMov = {
          id: Storage.generateId('mov'), fecha: Storage.todayISO(), insumoId: insumo.id,
          insumoNombre: insumo.nombre, tipo, cantidad: Number(cantidad), costo, motivo,
          creadoEn: Date.now()
        };
        movimientos.push(nuevoMov);
        Storage.save('movimientosInventario', movimientos);

        if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.guardarMovimientoNube === 'function') {
          SupabaseBridge.guardarMovimientoNube(nuevoMov);
        }

        // Registrar también como gasto si corresponde (evitando duplicar)
        const tambienGasto = tipo === 'entrada' && document.getElementById('m-tambien-gasto') && document.getElementById('m-tambien-gasto').checked;
        if (tambienGasto && costo > 0){
          const gastos = Storage.get('gastos');
          const nuevoGasto = {
            id: Storage.generateId('gasto'), fecha: Storage.todayISO(), tipo: 'Materias primas',
            descripcion: `Compra de ${cantidad} ${insumo.unidadMedida} de ${insumo.nombre}`,
            proveedor: insumo.proveedor || '', monto: costo, medioPago: 'Otro',
            observaciones: 'Generado automáticamente desde Inventario', origenInventario: true, demo: false
          };
          gastos.push(nuevoGasto);
          Storage.save('gastos', gastos);
          if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.guardarGastoNube === 'function') {
            SupabaseBridge.guardarGastoNube(nuevoGasto);
          }
        }

        App.closeModal();
        App.toast(tipo === 'entrada' ? 'Entrada registrada correctamente' : 'Salida registrada correctamente');
        vista = 'historial';
        render(container);
      });
    }

    /* ---------------- VISTA 3: ESTIMADOR DE COMPRAS MENSUAL ---------------- */
    function renderEstimadorCompras(){
      const content = document.getElementById('inventario-content');
      const datos = Storage.estimarConsumoInsumos({
        periodo: estimadorPeriodo,
        factorProyeccion: estimadorFactor
      });

      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const ahora = new Date();
      const mesActualNom = meses[ahora.getMonth()];
      const mesAntNom = meses[(ahora.getMonth() + 11) % 12];

      const totalProdsVendidos = datos.desgloseProductos.reduce((acc, p) => acc + p.cantidadVendida, 0);
      const totalUnidadesVendidas = datos.desgloseProductos.reduce((acc, p) => acc + p.unidadesTotales, 0);

      content.innerHTML = `
        <div class="card" style="margin-bottom: 24px;">
          <!-- Encabezado y controles del Estimador -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:20px; border-bottom:1px solid var(--line); padding-bottom:16px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h2 style="margin:0; font-size:20px;">🛒 Estimador y Plan de Compras Mensual</h2>
                <span class="badge badge-berry" style="font-size:11px;">Exclusivo Dulces Mele</span>
              </div>
              <div class="text-soft" style="font-size:13.5px; margin-top:4px; max-width:650px; line-height:1.4;">
                Calcula exactamente qué materias primas e insumos debes comprar para el mes según las recetas de tu producción y ventas reales, comparado en vivo contra tu bodega.
              </div>
            </div>

            <!-- Filtros interactivos -->
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <div>
                <label style="display:block; font-size:11px; font-weight:700; color:var(--ink-soft); margin-bottom:3px;">PERIODO BASE</label>
                <select id="sel-estimador-periodo" class="btn btn-secondary btn-sm" style="font-size:13px; font-weight:600; padding:6px 12px; cursor:pointer;">
                  <option value="mes_actual" ${estimadorPeriodo === 'mes_actual' ? 'selected' : ''}>📅 Mes actual (${mesActualNom})</option>
                  <option value="mes_anterior" ${estimadorPeriodo === 'mes_anterior' ? 'selected' : ''}>📅 Mes anterior (${mesAntNom})</option>
                  <option value="ultimos_30" ${estimadorPeriodo === 'ultimos_30' ? 'selected' : ''}>📅 Últimos 30 días</option>
                  <option value="todo" ${estimadorPeriodo === 'todo' ? 'selected' : ''}>📅 Histórico completo</option>
                </select>
              </div>

              <div>
                <label style="display:block; font-size:11px; font-weight:700; color:var(--ink-soft); margin-bottom:3px;">PROYECCIÓN DE VENTAS</label>
                <div style="display:inline-flex; border:1px solid var(--line); border-radius:var(--radius-sm); overflow:hidden; background:var(--surface);">
                  <button type="button" class="btn btn-sm ${estimadorFactor === 1.0 ? 'btn-primary' : 'btn-ghost'}" data-factor="1.0" style="border-radius:0; padding:6px 10px; font-size:12px;">100% (Normal)</button>
                  <button type="button" class="btn btn-sm ${estimadorFactor === 1.2 ? 'btn-primary' : 'btn-ghost'}" data-factor="1.2" style="border-radius:0; padding:6px 10px; font-size:12px;" title="Temporada alta o fiestas (+20%)">+20%</button>
                  <button type="button" class="btn btn-sm ${estimadorFactor === 1.5 ? 'btn-primary' : 'btn-ghost'}" data-factor="1.5" style="border-radius:0; padding:6px 10px; font-size:12px;" title="Día especial / Navidad (+50%)">+50%</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Métricas Resumen -->
          <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap:14px; margin-bottom:20px;">
            <div class="card" style="background: linear-gradient(135deg, #FFF6F0 0%, #FFFFFF 100%); border-left: 4px solid var(--berry); padding:16px;">
              <div class="text-soft" style="font-size:11.5px; font-weight:700; letter-spacing:0.5px;">PRESUPUESTO A INVERTIR</div>
              <div style="font-size:26px; font-weight:800; color:var(--berry); margin:6px 0;">
                ${App.formatCLP(datos.costoTotalEstimado)}
              </div>
              <div class="text-soft" style="font-size:12px;">Para comprar los insumos faltantes</div>
            </div>

            <div class="card" style="padding:16px;">
              <div class="text-soft" style="font-size:11.5px; font-weight:700; letter-spacing:0.5px;">INSUMOS A COMPRAR</div>
              <div style="font-size:26px; font-weight:800; color:${datos.totalItemsAComprar > 0 ? 'var(--danger)' : 'var(--sage)'}; margin:6px 0;">
                ${datos.totalItemsAComprar} <span style="font-size:14px; font-weight:normal; color:var(--ink-soft);">de ${datos.totalInsumosRequeridos}</span>
              </div>
              <div class="text-soft" style="font-size:12px;">Insumos con stock insuficiente en bodega</div>
            </div>

            <div class="card" style="padding:16px;">
              <div class="text-soft" style="font-size:11.5px; font-weight:700; letter-spacing:0.5px;">STOCK BODEGA CUBIERTO</div>
              <div style="font-size:26px; font-weight:800; color:var(--sage); margin:6px 0;">
                ${Math.max(0, datos.totalInsumosRequeridos - datos.totalItemsAComprar)} insumos
              </div>
              <div class="text-soft" style="font-size:12px;">Ya tienes suficiente stock en tu despensa</div>
            </div>

            <div class="card" style="padding:16px;">
              <div class="text-soft" style="font-size:11.5px; font-weight:700; letter-spacing:0.5px;">PRODUCCIÓN BASE</div>
              <div style="font-size:26px; font-weight:800; color:var(--accent-dark); margin:6px 0;">
                ${totalProdsVendidos} <span style="font-size:13px; font-weight:normal; color:var(--ink-soft);">packs/items</span>
              </div>
              <div class="text-soft" style="font-size:12px;">Equivale a ${totalUnidadesVendidas} galletas y unidades</div>
            </div>
          </div>

          <!-- Barra de Acciones -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button type="button" class="btn btn-primary" id="btn-copiar-estimador-wsp" style="background:#25D366; border-color:#25D366; font-weight:600; font-size:13.5px; display:inline-flex; align-items:center; gap:8px;">
                <span>📲 Copiar Lista para WhatsApp / Proveedor</span>
              </button>
              <button type="button" class="btn btn-secondary" id="btn-imprimir-estimador" style="font-size:13.5px; display:inline-flex; align-items:center; gap:8px;">
                <span>🖨️ Imprimir Lista de Compras</span>
              </button>
            </div>

            <button type="button" class="btn btn-ghost btn-sm" id="btn-toggle-desglose" style="font-size:13px; font-weight:600; color:var(--accent-dark);">
              ${estimadorMostrarDesglose ? '▲ Ocultar desglose de productos' : '▼ Ver productos que componen este cálculo'}
            </button>
          </div>

          <!-- Acordeón Desglose de Productos Analizados -->
          ${estimadorMostrarDesglose ? `
            <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:var(--radius-sm); padding:14px 16px; margin-bottom:20px;">
              <div style="font-weight:700; font-size:13.5px; margin-bottom:8px; color:var(--ink);">
                🧁 Productos analizados en el periodo (${datos.desgloseProductos.length}):
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:10px;">
                ${datos.desgloseProductos.map(p => `
                  <div style="background:var(--surface); border:1px solid var(--line); padding:8px 12px; border-radius:var(--radius-sm); font-size:13px;">
                    <strong>${escapeHtml(p.producto.nombre)}</strong>
                    <div class="text-soft" style="font-size:12px; margin-top:2px;">
                      ${p.cantidadVendida} ${p.producto.unidadVenta || 'paquetes'} 
                      ${p.unidadesPorPack > 1 ? `(×${p.unidadesPorPack} un = <strong>${p.unidadesTotales} unidades</strong>)` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Tabla de Lista de Compras -->
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="min-width:180px;">Materia Prima / Insumo</th>
                  <th>Categoría</th>
                  <th style="text-align:right;">Consumo Necesario</th>
                  <th style="text-align:right;">Stock en Bodega</th>
                  <th style="text-align:right; min-width:130px;">A Comprar (Faltante)</th>
                  <th style="text-align:right;">Costo Unit.</th>
                  <th style="text-align:right;">Total Inversión</th>
                </tr>
              </thead>
              <tbody>
                ${datos.listaCompras.length === 0 ? `
                  <tr>
                    <td colspan="7" style="text-align:center; padding:32px; color:var(--ink-soft);">
                      No se encontraron consumos de insumos en el periodo seleccionado o los productos no tienen recetas asociadas.
                    </td>
                  </tr>
                ` : datos.listaCompras.map(item => {
                  const necesitaCompra = item.faltaComprar > 0;
                  return `
                    <tr style="${necesitaCompra ? 'background:#FFFDFB;' : ''}">
                      <td>
                        <strong>${escapeHtml(item.nombre)}</strong>
                      </td>
                      <td>
                        <span class="badge badge-neutral" style="font-size:11px;">${escapeHtml(item.categoria)}</span>
                      </td>
                      <td style="text-align:right; font-weight:600;">
                        ${item.requerido} ${escapeHtml(item.unidadMedida)}
                      </td>
                      <td style="text-align:right; color:var(--ink-soft);">
                        ${item.stockActual} ${escapeHtml(item.unidadMedida)}
                      </td>
                      <td style="text-align:right;">
                        ${necesitaCompra ? `
                          <span style="display:inline-block; font-weight:800; color:var(--danger); background:#FDF2F2; padding:3px 8px; border-radius:var(--radius-sm); border:1px solid #F5C6CB;">
                            Comprar ${item.faltaComprar} ${escapeHtml(item.unidadMedida)}
                          </span>
                        ` : `
                          <span class="stock-pill-ok" style="font-size:11.5px;">✅ Stock OK</span>
                        `}
                      </td>
                      <td style="text-align:right; font-size:12.5px; color:var(--ink-soft);">
                        ${App.formatCLP(item.costoUnitario)} / ${escapeHtml(item.unidadMedida)}
                      </td>
                      <td style="text-align:right; font-weight:700; color:${necesitaCompra ? 'var(--berry)' : 'var(--ink-soft)'};">
                        ${necesitaCompra ? App.formatCLP(item.costoEstimado) : '—'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Event listeners del estimador
      content.querySelector('#sel-estimador-periodo')?.addEventListener('change', (e) => {
        estimadorPeriodo = e.target.value;
        renderEstimadorCompras();
      });

      content.querySelectorAll('[data-factor]').forEach(btn => {
        btn.addEventListener('click', () => {
          estimadorFactor = Number(btn.dataset.factor) || 1.0;
          renderEstimadorCompras();
        });
      });

      content.querySelector('#btn-toggle-desglose')?.addEventListener('click', () => {
        estimadorMostrarDesglose = !estimadorMostrarDesglose;
        renderEstimadorCompras();
      });

      content.querySelector('#btn-imprimir-estimador')?.addEventListener('click', () => {
        window.print();
      });

      content.querySelector('#btn-copiar-estimador-wsp')?.addEventListener('click', () => {
        const faltantes = datos.listaCompras.filter(i => i.faltaComprar > 0);
        if (faltantes.length === 0){
          App.toast('¡Tu bodega tiene stock suficiente para cubrir toda la producción! No hay compras pendientes.');
          return;
        }

        const lineas = faltantes.map(i => `• *${i.nombre}*: ${i.faltaComprar} ${i.unidadMedida} (~${App.formatCLP(i.costoEstimado)})`).join('\n');
        const txt = `🧁 *LISTA DE COMPRAS — DULCES MELE*\n` +
          `📅 Periodo: ${estimadorPeriodo === 'mes_actual' ? mesActualNom : estimadorPeriodo === 'mes_anterior' ? mesAntNom : 'Últimos 30 días'} ${estimadorFactor > 1.0 ? `(Proyección +${Math.round((estimadorFactor - 1) * 100)}%)` : ''}\n` +
          `----------------------------------------\n` +
          `🛒 *MATERIAS PRIMAS A COMPRAR (${faltantes.length} insumos):*\n${lineas}\n` +
          `----------------------------------------\n` +
          `💰 *PRESUPUESTO TOTAL ESTIMADO: ${App.formatCLP(datos.costoTotalEstimado)}*\n` +
          `_Generado desde Gestor Dulces Mele_`;

        if (navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(txt).then(() => {
            App.toast('✓ ¡Lista de compras copiada al portapapeles! Lista para pegar en WhatsApp.');
          }).catch(() => {
            prompt('Copia tu lista de compras para WhatsApp:', txt);
          });
        } else {
          prompt('Copia tu lista de compras para WhatsApp:', txt);
        }
      });
    }
  }

  return { render };
})();
