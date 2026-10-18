/* ============================================================
   GESTOR DE PASTELERÍA — productos.js
   Administración del catálogo de productos y Módulo de
   Escandallo, Recetas y Costeo Real.
   ============================================================ */

const Productos = (() => {

  let currentTab = 'catalogo'; // 'catalogo' | 'escandallo'
  let filtroCategoria = 'todas';
  let filtroBusqueda = '';

  function render(container){
    const productos = Storage.get('productos');
    const categorias = [...new Set(productos.map(p => p.categoria))].sort();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Productos y Escandallo</h1>
          <div class="subtitle">Catálogo de venta, recetas, costeo de insumos y hornadas</div>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" id="btn-seed-pasteleria" title="Cargar insumos y recetas sugeridas de pastelería">
            ✨ Cargar Recetas Base
          </button>
          <button class="btn btn-primary" id="btn-nuevo-producto">
            ${App.svgIcon('plus')} Nuevo producto
          </button>
        </div>
      </div>

      <div class="escandallo-tabs">
        <button class="tab-btn ${currentTab === 'catalogo' ? 'active' : ''}" id="tab-cat-prod">📋 Catálogo de Productos</button>
        <button class="tab-btn ${currentTab === 'escandallo' ? 'active' : ''}" id="tab-esc-prod">👩‍🍳 Escandallo y Costeo Real</button>
      </div>

      <div id="productos-main-view"></div>
    `;

    document.getElementById('btn-nuevo-producto').addEventListener('click', () => openForm());
    document.getElementById('btn-seed-pasteleria').addEventListener('click', () => {
      App.confirmAction({
        title: 'Cargar recetas e insumos base',
        message: '¿Deseas cargar la lista de insumos de pastelería (mantequilla, manjar, harinas, huevos, cajas) y las recetas de ejemplo (Torta tres leches y Alfajores)? No se borrarán tus productos actuales.',
        confirmLabel: 'Cargar recetas',
        danger: false,
        onConfirm: () => {
          Storage.seedPasteleriaSiCorresponde(true);
          App.toast('Insumos y recetas base cargadas con éxito');
          render(container);
        }
      });
    });

    document.getElementById('tab-cat-prod').addEventListener('click', () => {
      currentTab = 'catalogo';
      render(container);
    });

    document.getElementById('tab-esc-prod').addEventListener('click', () => {
      currentTab = 'escandallo';
      render(container);
    });

    const mainView = document.getElementById('productos-main-view');
    if (currentTab === 'catalogo'){
      renderCatalogo(mainView);
    } else {
      renderEscandallo(mainView);
    }
  }

  /* ---------------- VISTA 1: CATÁLOGO DE PRODUCTOS ---------------- */
  function renderCatalogo(container){
    const productos = Storage.get('productos');
    if (productos.length === 0){
      container.innerHTML = `<div class="card"><div class="empty-state"><h3>Aún no hay productos</h3><p>Agrega tu primer producto para empezar a vender.</p></div></div>`;
      return;
    }

    const categorias = [...new Set(productos.map(p => p.categoria))].sort();

    container.innerHTML = categorias.map(cat => {
      const items = productos.filter(p => p.categoria === cat).sort((a,b) => a.nombre.localeCompare(b.nombre));
      return `
        <h2 class="category-heading">${cat}</h2>
        <div class="table-wrap section-block">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Stock actual</th>
                <th>Precio Venta</th>
                <th>Costo Unit.</th>
                <th>Margen Real</th>
                <th>Unidad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(p => {
                const esTerminado = p.tipoStock === 'terminado';
                const stock = Number(p.stockActual) || 0;
                const stockBajo = esTerminado && stock <= (Number(p.stockMinimo) || 5);
                const costeo = Storage.calcularCostoReceta(p.id);
                const tieneReceta = costeo && costeo.tieneReceta;

                let margenClass = 'badge-neutral';
                if (tieneReceta){
                  if (costeo.margenPorcentaje >= 50) margenClass = 'badge-margin-high';
                  else if (costeo.margenPorcentaje >= 30) margenClass = 'badge-margin-mid';
                  else margenClass = 'badge-margin-low';
                }

                return `
                <tr>
                  <td>
                    <strong>${escapeHtml(p.nombre)}</strong>
                    ${p.demo ? '<span class="tag-demo">EJEMPLO</span>' : ''}
                    ${p.descripcion ? `<div class="text-soft" style="font-size:12px;">${escapeHtml(p.descripcion)}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge ${esTerminado ? 'badge-neutral' : 'badge-berry'}">
                      ${esTerminado ? 'Vitrina / Stock' : 'A pedido'}
                    </span>
                  </td>
                  <td>
                    ${esTerminado ? `
                      <span class="badge ${stockBajo ? 'badge-amber' : 'badge-sage'}">
                        ${stock} ${p.unidadVenta}s
                      </span>
                    ` : '<span class="text-soft" style="font-size:13px;">Bajo encargo</span>'}
                  </td>
                  <td><strong>${App.formatCLP(p.precioVenta)}</strong></td>
                  <td>
                    ${tieneReceta ? `
                      <span title="Costo insumos: ${App.formatCLP(costeo.costoIngredientesPorUnidad)} + Empaque/Otros: ${App.formatCLP(costeo.costoEmpaque + costeo.otrosCostosPorUnidad)}">
                        ${App.formatCLP(costeo.costoTotalPorUnidad)}
                      </span>
                    ` : '<span class="text-soft" style="font-size:12px;">Sin receta</span>'}
                  </td>
                  <td>
                    ${tieneReceta ? `
                      <span class="badge ${margenClass}" title="Ganancia neta: ${App.formatCLP(costeo.gananciaPorUnidad)} por unidad">
                        ${costeo.margenPorcentaje}%
                      </span>
                    ` : '<span class="text-soft">—</span>'}
                  </td>
                  <td>${p.unidadVenta}</td>
                  <td><span class="badge ${p.estado === 'activo' ? 'badge-sage' : 'badge-neutral'}">${p.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td>
                  <td class="cell-actions" style="white-space:nowrap;">
                    <button class="btn btn-secondary btn-sm" data-receta="${p.id}" title="Ver o editar receta y escandallo">👩‍🍳 Receta</button>
                    ${tieneReceta ? `<button class="btn btn-primary btn-sm" data-hornear="${p.id}" title="Registrar hornada y descontar insumos de bodega">🍳 Hornear</button>` : ''}
                    <button class="btn btn-secondary btn-sm" data-edit="${p.id}">Editar</button>
                    <button class="btn btn-danger btn-sm" data-del="${p.id}">Eliminar</button>
                  </td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-receta]').forEach(b => b.addEventListener('click', () => openRecetaModal(b.dataset.receta)));
    container.querySelectorAll('[data-hornear]').forEach(b => b.addEventListener('click', () => openProduccionModal(b.dataset.hornear)));
    container.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.edit)));
    container.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => handleDelete(b.dataset.del)));
  }

  /* ---------------- VISTA 2: ESCANDALLO Y COSTEO REAL ---------------- */
  function renderEscandallo(container){
    const productos = Storage.get('productos');
    const costeados = productos.map(p => ({
      producto: p,
      costeo: Storage.calcularCostoReceta(p.id)
    }));

    const conReceta = costeados.filter(c => c.costeo && c.costeo.tieneReceta);
    const margenPromedio = conReceta.length > 0
      ? Math.round(conReceta.reduce((acc, c) => acc + c.costeo.margenPorcentaje, 0) / conReceta.length)
      : 0;
    const costoPromedio = conReceta.length > 0
      ? Math.round(conReceta.reduce((acc, c) => acc + c.costeo.costoTotalPorUnidad, 0) / conReceta.length)
      : 0;
    const listosParaHornear = conReceta.filter(c => c.costeo.maxUnidadesPosibles > 0).length;

    const categorias = ['todas', ...new Set(productos.map(p => p.categoria))];

    container.innerHTML = `
      <div class="kpi-grid-escandallo">
        <div class="kpi-card-escandallo">
          <div class="kpi-label">Productos con Receta</div>
          <div class="kpi-num">${conReceta.length} / ${productos.length}</div>
          <div class="kpi-sub">${productos.length ? Math.round((conReceta.length / productos.length) * 100) : 0}% del catálogo con costeo real</div>
        </div>
        <div class="kpi-card-escandallo">
          <div class="kpi-label">Margen Bruto Promedio</div>
          <div class="kpi-num" style="color:var(--sage);">${conReceta.length ? margenPromedio + '%' : '—'}</div>
          <div class="kpi-sub">Objetivo estándar pastelería: 60% - 70%</div>
        </div>
        <div class="kpi-card-escandallo">
          <div class="kpi-label">Costo Directo Promedio</div>
          <div class="kpi-num">${conReceta.length ? App.formatCLP(costoPromedio) : '—'}</div>
          <div class="kpi-sub">Insumos + empaque por unidad</div>
        </div>
        <div class="kpi-card-escandallo">
          <div class="kpi-label">Listos para Hornear</div>
          <div class="kpi-num" style="color:var(--accent-dark);">${listosParaHornear}</div>
          <div class="kpi-sub">Con stock suficiente de insumos en bodega</div>
        </div>
      </div>

      <div class="filters-bar" style="margin-bottom:16px;">
        <div class="field" style="flex:1; min-width:200px;">
          <label>Buscar producto</label>
          <input type="text" id="filtro-busqueda-esc" placeholder="Escribe para buscar..." value="${escapeHtml(filtroBusqueda)}" />
        </div>
        <div class="field">
          <label>Categoría</label>
          <select id="filtro-categoria-esc">
            ${categorias.map(cat => `<option value="${cat}" ${filtroCategoria === cat ? 'selected' : ''}>${cat === 'todas' ? 'Todas las categorías' : cat}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Precio Venta</th>
                <th>Costo Insumos</th>
                <th>Empaque + Fijo</th>
                <th>Costo Total Unit.</th>
                <th>Ganancia Neta</th>
                <th>Margen Real</th>
                <th>Precio Sugerido</th>
                <th>Stock en Bodega</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-escandallo-body"></tbody>
          </table>
        </div>
      </div>
    `;

    const searchInput = document.getElementById('filtro-busqueda-esc');
    const catSelect = document.getElementById('filtro-categoria-esc');

    searchInput.addEventListener('input', (e) => {
      filtroBusqueda = e.target.value.toLowerCase().trim();
      renderTablaEscandalloBody();
    });

    catSelect.addEventListener('change', (e) => {
      filtroCategoria = e.target.value;
      renderTablaEscandalloBody();
    });

    renderTablaEscandalloBody();

    function renderTablaEscandalloBody(){
      const tbody = document.getElementById('tabla-escandallo-body');
      let filtrados = costeados;

      if (filtroCategoria !== 'todas'){
        filtrados = filtrados.filter(c => c.producto.categoria === filtroCategoria);
      }
      if (filtroBusqueda){
        filtrados = filtrados.filter(c => c.producto.nombre.toLowerCase().includes(filtroBusqueda));
      }

      if (filtrados.length === 0){
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--ink-soft);">No se encontraron productos con los filtros seleccionados.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtrados.map(({ producto: p, costeo: c }) => {
        const tieneReceta = c && c.tieneReceta;
        let margenBadge = '<span class="text-soft">—</span>';
        if (tieneReceta){
          let cl = c.margenPorcentaje >= 50 ? 'badge-margin-high' : c.margenPorcentaje >= 30 ? 'badge-margin-mid' : 'badge-margin-low';
          margenBadge = `<span class="badge ${cl}">${c.margenPorcentaje}%</span>`;
        }

        let capacidadBadge = '<span class="text-soft" style="font-size:12px;">Sin receta</span>';
        if (tieneReceta){
          if (c.maxUnidadesPosibles > 0){
            capacidadBadge = `<span class="stock-pill-ok">✅ Rinde ${c.maxUnidadesPosibles} ${p.unidadVenta}s</span>`;
          } else {
            capacidadBadge = `<span class="stock-pill-low">⚠️ Faltan insumos</span>`;
          }
        }

        return `
          <tr>
            <td>
              <strong>${escapeHtml(p.nombre)}</strong>
              <div class="text-soft" style="font-size:11.5px;">${escapeHtml(p.categoria)} • ${p.unidadVenta}</div>
            </td>
            <td><strong>${App.formatCLP(p.precioVenta)}</strong></td>
            <td>${tieneReceta ? App.formatCLP(c.costoIngredientesPorUnidad) : '—'}</td>
            <td>${tieneReceta ? App.formatCLP(c.costoEmpaque + c.otrosCostosPorUnidad) : '—'}</td>
            <td>
              ${tieneReceta ? `<strong>${App.formatCLP(c.costoTotalPorUnidad)}</strong>` : '<span class="text-soft" style="font-size:12px;">Sin costeo</span>'}
            </td>
            <td>
              ${tieneReceta ? `<span style="font-weight:700; color:var(--sage);">${App.formatCLP(c.gananciaPorUnidad)}</span>` : '—'}
            </td>
            <td>${margenBadge}</td>
            <td>
              ${tieneReceta ? `
                <div style="font-size:13px; font-weight:600;">${App.formatCLP(c.precioSugerido)}</div>
                <div class="text-soft" style="font-size:10.5px;">al ${c.margenDeseado}% margen</div>
              ` : '—'}
            </td>
            <td>${capacidadBadge}</td>
            <td class="cell-actions" style="white-space:nowrap;">
              <button class="btn btn-secondary btn-sm" data-receta="${p.id}">👩‍🍳 ${tieneReceta ? 'Editar' : 'Crear'} Receta</button>
              ${tieneReceta ? `<button class="btn btn-primary btn-sm" data-hornear="${p.id}">🍳 Hornear</button>` : ''}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('[data-receta]').forEach(b => b.addEventListener('click', () => openRecetaModal(b.dataset.receta)));
      tbody.querySelectorAll('[data-hornear]').forEach(b => b.addEventListener('click', () => openProduccionModal(b.dataset.hornear)));
    }
  }

  /* ---------------- MODAL DE ESCANDALLO Y RECETA ---------------- */
  function openRecetaModal(productoId){
    const productos = Storage.get('productos');
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    const insumosDisponibles = Storage.get('insumos').filter(i => i.estado === 'activo');
    const recetaExistente = Storage.getReceta(productoId);

    // Estado de trabajo local en el modal
    let rendimiento = recetaExistente ? (Number(recetaExistente.rendimiento) || 1) : (producto.categoria === 'Tortas' ? 1 : 20);
    let unidadRendimiento = recetaExistente ? (recetaExistente.unidadRendimiento || 'unidad') : (producto.categoria === 'Tortas' ? 'torta' : 'unidades');
    let costoEmpaque = recetaExistente ? (Number(recetaExistente.costoEmpaque) || 0) : (producto.categoria === 'Tortas' ? 1200 : 50);
    let otrosCostos = recetaExistente ? (Number(recetaExistente.otrosCostos) || 0) : 500;
    let margenDeseado = recetaExistente ? (Number(recetaExistente.margenDeseado) || 65) : 65;
    let instrucciones = recetaExistente ? (recetaExistente.instrucciones || '') : '';
    let ingredientes = recetaExistente && Array.isArray(recetaExistente.ingredientes)
      ? JSON.parse(JSON.stringify(recetaExistente.ingredientes))
      : [];

    const overlay = App.openModal(`
      <div class="modal-header">
        <div>
          <h3>👩‍🍳 Escandallo y Receta: ${escapeHtml(producto.nombre)}</h3>
          <div class="subtitle" style="font-size:12px;">Precio actual de venta: ${App.formatCLP(producto.precioVenta)} por ${producto.unidadVenta}</div>
        </div>
        <button class="modal-close" data-close>${App.svgIcon('close')}</button>
      </div>

      <div id="receta-modal-body"></div>
    `, { large: true });

    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

    function renderRecetaModalBody(){
      const bodyEl = overlay.querySelector('#receta-modal-body');
      
      // Recalcular métricas en vivo con el estado actual
      const insumosMap = new Map(insumosDisponibles.map(i => [i.id, i]));
      let subtotalIngredientesLote = 0;

      const itemsCalculados = ingredientes.map((ing, idx) => {
        const insumo = insumosMap.get(ing.insumoId);
        const cant = Number(ing.cantidad) || 0;
        const cantEnUnidadInsumo = insumo ? Storage.convertirUnidad(cant, ing.unidad, insumo.unidadMedida) : 0;
        const costoUnit = insumo ? (Number(insumo.costoUnitario) || 0) : 0;
        const subtotal = Math.round(cantEnUnidadInsumo * costoUnit);
        subtotalIngredientesLote += subtotal;

        return {
          idx,
          insumoId: ing.insumoId,
          nombreInsumo: insumo ? insumo.nombre : 'Seleccionar insumo...',
          unidadInsumo: insumo ? insumo.unidadMedida : 'kg',
          costoUnitarioInsumo: costoUnit,
          stockActual: insumo ? insumo.stockActual : 0,
          cantidad: cant,
          unidad: ing.unidad || 'g',
          subtotal
        };
      });

      const rendNum = Math.max(1, Number(rendimiento) || 1);
      const empaqueNum = Number(costoEmpaque) || 0;
      const otrosNum = Number(otrosCostos) || 0;

      const costoIngredientesPorUnidad = Math.round(subtotalIngredientesLote / rendNum);
      const otrosPorUnidad = Math.round(otrosNum / rendNum);
      const costoTotalUnitario = costoIngredientesPorUnidad + empaqueNum + otrosPorUnidad;
      const gananciaUnidad = producto.precioVenta - costoTotalUnitario;
      const margenReal = producto.precioVenta > 0 ? Math.round((gananciaUnidad / producto.precioVenta) * 100) : 0;
      
      const factorMargen = (100 - (Number(margenDeseado) || 60)) / 100;
      const precioSugerido = factorMargen > 0 ? Math.round(costoTotalUnitario / factorMargen) : 0;

      bodyEl.innerHTML = `
        <!-- KPI Strip en vivo -->
        <div class="modal-escandallo-kpi-bar">
          <div class="modal-kpi-item">
            <span class="lbl">Insumos (Unit.)</span>
            <span class="val" id="kpi-insumos-unit">${App.formatCLP(costoIngredientesPorUnidad)}</span>
          </div>
          <div class="modal-kpi-item">
            <span class="lbl">Empaque + Otros</span>
            <span class="val" id="kpi-empaque-unit">${App.formatCLP(empaqueNum + otrosPorUnidad)}</span>
          </div>
          <div class="modal-kpi-item">
            <span class="lbl">Costo Total Unit.</span>
            <span class="val" style="color:var(--accent-dark);">${App.formatCLP(costoTotalUnitario)}</span>
          </div>
          <div class="modal-kpi-item highlight-gain">
            <span class="lbl">Ganancia Neta</span>
            <span class="val">${App.formatCLP(gananciaUnidad)}</span>
          </div>
          <div class="modal-kpi-item">
            <span class="lbl">Margen Real</span>
            <span class="val" style="color:${margenReal >= 50 ? '#385624' : margenReal >= 30 ? '#8C4E10' : '#942B34'};">${margenReal}%</span>
          </div>
          <div class="modal-kpi-item">
            <span class="lbl">Precio Sugerido</span>
            <span class="val" style="color:var(--ink);">${App.formatCLP(precioSugerido)}</span>
          </div>
        </div>

        <!-- Configuración de la Receta -->
        <div class="form-grid" style="margin-bottom:14px;">
          <div class="field">
            <label>Rendimiento de esta receta (¿cuántas unidades salen?) *</label>
            <input type="number" id="rec-rendimiento" min="1" step="1" value="${rendNum}" required />
            <div class="form-hint">Ej: 1 para torta completa, 20 para una tanda de galletas.</div>
          </div>
          <div class="field">
            <label>Unidad de rendimiento</label>
            <input type="text" id="rec-unidad-rend" value="${escapeHtml(unidadRendimiento)}" placeholder="ej: torta, galletas, porciones" />
          </div>
          <div class="field">
            <label>Costo de empaque por unidad (CLP)</label>
            <input type="number" id="rec-empaque" min="0" step="10" value="${empaqueNum}" />
            <div class="form-hint">Caja, blonda, cinta, bolsa celofán, sticker</div>
          </div>
          <div class="field">
            <label>Otros costos directos por lote (CLP)</label>
            <input type="number" id="rec-otros" min="0" step="50" value="${otrosNum}" />
            <div class="form-hint">Gas de horno, electricidad, decoración especial</div>
          </div>
          <div class="field full">
            <label>Margen de ganancia deseado objetivo (%): <strong id="lbl-margen-deseado">${margenDeseado}%</strong></label>
            <input type="range" id="rec-margen" min="20" max="85" step="1" value="${margenDeseado}" style="width:100%;" />
          </div>
        </div>

        <!-- Tabla de Ingredientes -->
        <div class="receta-ingredientes-header">
          <label style="font-weight:700; font-size:14px;">Ingredientes de la receta (${itemsCalculados.length})</label>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-add-ingrediente">
            ${App.svgIcon('plus')} Agregar ingrediente
          </button>
        </div>

        <div class="receta-table-wrap">
          <table>
            <thead>
              <tr>
                <th style="min-width:180px;">Insumo de bodega</th>
                <th style="width:90px;">Cantidad</th>
                <th style="width:100px;">Unidad</th>
                <th style="min-width:100px;">Costo Insumo</th>
                <th style="min-width:90px;">Subtotal</th>
                <th style="min-width:110px;">Stock Bodega</th>
                <th style="width:40px;"></th>
              </tr>
            </thead>
            <tbody id="receta-tbody">
              ${itemsCalculados.length === 0 ? `
                <tr><td colspan="7" style="text-align:center; padding:16px; color:var(--ink-soft);">Aún no agregas ingredientes a esta receta. Haz click en "+ Agregar ingrediente".</td></tr>
              ` : itemsCalculados.map(item => `
                <tr data-row="${item.idx}">
                  <td>
                    <select class="receta-select-insumo" data-field="insumoId">
                      <option value="">-- Seleccionar insumo --</option>
                      ${insumosDisponibles.map(ins => `
                        <option value="${ins.id}" ${ins.id === item.insumoId ? 'selected' : ''}>
                          ${escapeHtml(ins.nombre)} (${App.formatCLP(ins.costoUnitario)} / ${ins.unidadMedida})
                        </option>
                      `).join('')}
                    </select>
                  </td>
                  <td>
                    <input type="number" class="receta-input-qty" data-field="cantidad" min="0.001" step="any" value="${item.cantidad}" />
                  </td>
                  <td>
                    <select class="receta-select-unit" data-field="unidad">
                      ${['g','kg','ml','litro','unidad'].map(u => `
                        <option value="${u}" ${u === item.unidad ? 'selected' : ''}>${u}</option>
                      `).join('')}
                    </select>
                  </td>
                  <td style="font-size:12px; color:var(--ink-soft);">
                    ${item.costoUnitarioInsumo ? App.formatCLP(item.costoUnitarioInsumo) + ' / ' + item.unidadInsumo : '—'}
                  </td>
                  <td>
                    <strong>${App.formatCLP(item.subtotal)}</strong>
                  </td>
                  <td style="font-size:11.5px;">
                    ${item.stockActual !== undefined ? `${item.stockActual} ${item.unidadInsumo}` : '—'}
                  </td>
                  <td style="text-align:center;">
                    <button type="button" class="btn-del-row" data-remove="${item.idx}" title="Eliminar ingrediente">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Instrucciones y notas -->
        <div class="field full" style="margin-top:14px;">
          <label>Instrucciones de preparación / Horneado (opcional)</label>
          <textarea id="rec-instrucciones" rows="3" placeholder="Paso a paso, temperaturas de horneado, tiempos y secretos de la receta">${escapeHtml(instrucciones)}</textarea>
        </div>

        <div class="modal-footer" style="justify-content:space-between; align-items:center;">
          <div>
            ${recetaExistente ? `<button type="button" class="btn btn-secondary" id="btn-hornear-modal">🍳 Producir Hornada</button>` : ''}
          </div>
          <div class="flex gap-8">
            <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
            <button type="button" class="btn btn-primary" id="btn-guardar-receta">Guardar Receta y Costeo</button>
          </div>
        </div>
      `;

      // Event Listeners
      bodyEl.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

      // Config inputs changes
      bodyEl.querySelector('#rec-rendimiento').addEventListener('input', (e) => {
        rendimiento = Number(e.target.value) || 1;
        renderRecetaModalBody();
      });
      bodyEl.querySelector('#rec-unidad-rend').addEventListener('input', (e) => {
        unidadRendimiento = e.target.value;
      });
      bodyEl.querySelector('#rec-empaque').addEventListener('input', (e) => {
        costoEmpaque = Number(e.target.value) || 0;
        renderRecetaModalBody();
      });
      bodyEl.querySelector('#rec-otros').addEventListener('input', (e) => {
        otrosCostos = Number(e.target.value) || 0;
        renderRecetaModalBody();
      });
      bodyEl.querySelector('#rec-margen').addEventListener('input', (e) => {
        margenDeseado = Number(e.target.value) || 60;
        bodyEl.querySelector('#lbl-margen-deseado').textContent = `${margenDeseado}%`;
        renderRecetaModalBody();
      });
      bodyEl.querySelector('#rec-instrucciones').addEventListener('input', (e) => {
        instrucciones = e.target.value;
      });

      // Add ingredient button
      bodyEl.querySelector('#btn-add-ingrediente').addEventListener('click', () => {
        const primerInsumo = insumosDisponibles[0];
        ingredientes.push({
          insumoId: primerInsumo ? primerInsumo.id : '',
          cantidad: 100,
          unidad: primerInsumo && primerInsumo.unidadMedida === 'kg' ? 'g' : primerInsumo && primerInsumo.unidadMedida === 'litro' ? 'ml' : 'unidad'
        });
        renderRecetaModalBody();
      });

      // Rows changes
      bodyEl.querySelectorAll('#receta-tbody tr').forEach(tr => {
        const idx = Number(tr.dataset.row);
        if (isNaN(idx)) return;

        const selInsumo = tr.querySelector('[data-field="insumoId"]');
        const inQty = tr.querySelector('[data-field="cantidad"]');
        const selUnit = tr.querySelector('[data-field="unidad"]');

        selInsumo.addEventListener('change', () => {
          ingredientes[idx].insumoId = selInsumo.value;
          const ins = insumosMap.get(selInsumo.value);
          if (ins){
            if (ins.unidadMedida === 'kg' && !['g','kg'].includes(ingredientes[idx].unidad)){
              ingredientes[idx].unidad = 'g';
            } else if (ins.unidadMedida === 'litro' && !['ml','litro'].includes(ingredientes[idx].unidad)){
              ingredientes[idx].unidad = 'ml';
            } else if (ins.unidadMedida === 'unidad'){
              ingredientes[idx].unidad = 'unidad';
            }
          }
          renderRecetaModalBody();
        });

        inQty.addEventListener('change', () => {
          ingredientes[idx].cantidad = Number(inQty.value) || 0;
          renderRecetaModalBody();
        });

        selUnit.addEventListener('change', () => {
          ingredientes[idx].unidad = selUnit.value;
          renderRecetaModalBody();
        });
      });

      // Delete row
      bodyEl.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.remove);
          ingredientes.splice(idx, 1);
          renderRecetaModalBody();
        });
      });

      // Save button
      bodyEl.querySelector('#btn-guardar-receta').addEventListener('click', () => {
        const ingredientesValidos = ingredientes.filter(i => i.insumoId && Number(i.cantidad) > 0);
        if (ingredientesValidos.length === 0){
          App.toast('Agrega al menos un ingrediente válido a la receta.', 'error');
          return;
        }

        Storage.saveReceta(productoId, {
          rendimiento: Math.max(1, Number(rendimiento) || 1),
          unidadRendimiento: unidadRendimiento || 'unidad',
          costoEmpaque: Number(costoEmpaque) || 0,
          otrosCostos: Number(otrosCostos) || 0,
          margenDeseado: Number(margenDeseado) || 60,
          instrucciones,
          ingredientes: ingredientesValidos
        });

        App.closeModal();
        App.toast('¡Receta y escandallo guardados con éxito!');
        const main = document.getElementById('main-content');
        Productos.render(main);
      });

      // Direct bake button from modal
      const btnHornear = bodyEl.querySelector('#btn-hornear-modal');
      if (btnHornear){
        btnHornear.addEventListener('click', () => {
          App.closeModal();
          openProduccionModal(productoId);
        });
      }
    }

    renderRecetaModalBody();
  }

  /* ---------------- MODAL DE PRODUCCIÓN / HORNADA ---------------- */
  function openProduccionModal(productoId){
    const costeo = Storage.calcularCostoReceta(productoId);
    if (!costeo || !costeo.tieneReceta){
      App.toast('Primero debes configurar la receta de este producto para poder registrar una hornada.', 'error');
      openRecetaModal(productoId);
      return;
    }

    const { producto, receta, rendimiento, items } = costeo;
    let cantidadAProducir = rendimiento;

    const overlay = App.openModal(`
      <div class="modal-header">
        <div>
          <h3>🍳 Hornear / Registrar Producción: ${escapeHtml(producto.nombre)}</h3>
          <div class="subtitle" style="font-size:12px;">Descuenta insumos de bodega automáticamente y suma unidades al stock</div>
        </div>
        <button class="modal-close" data-close>${App.svgIcon('close')}</button>
      </div>

      <div id="produccion-modal-body"></div>
    `);

    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

    function renderProduccionBody(){
      const bodyEl = overlay.querySelector('#produccion-modal-body');
      const cantNum = Math.max(0.1, Number(cantidadAProducir) || 1);
      const factorLote = cantNum / rendimiento;

      const insumosRequeridos = items.map(item => {
        const cantReqEnUnidadReceta = item.cantidad * factorLote;
        const cantReqEnUnidadInsumo = item.cantidadEnUnidadInsumo * factorLote;
        const tieneStock = item.stockActual >= cantReqEnUnidadInsumo;
        const faltante = cantReqEnUnidadInsumo - item.stockActual;

        return {
          nombre: item.nombre,
          cantReqEnUnidadReceta,
          unidadReceta: item.unidad,
          cantReqEnUnidadInsumo,
          unidadInsumo: item.unidadInsumo,
          stockActual: item.stockActual,
          tieneStock,
          faltante
        };
      });

      const algunFaltante = insumosRequeridos.some(i => !i.tieneStock);

      bodyEl.innerHTML = `
        <div class="form-grid" style="margin-bottom:14px;">
          <div class="field full">
            <label>Cantidad de unidades a producir *</label>
            <input type="number" id="prod-cantidad" min="1" step="1" value="${cantNum}" required />
            <div class="form-hint">Rendimiento estándar de la receta: ${rendimiento} ${escapeHtml(receta.unidadRendimiento || 'unidad')}</div>
          </div>
          <div class="field full">
            <label>Motivo u observación</label>
            <input type="text" id="prod-motivo" value="Hornada: ${cantNum} ${escapeHtml(producto.nombre)} (${Storage.todayISO()})" />
          </div>
        </div>

        <div style="font-weight:700; font-size:13px; margin: 12px 0 6px 0;">Insumos que se descontarán de Bodega:</div>
        <div class="receta-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Requerido</th>
                <th>Stock en Bodega</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${insumosRequeridos.map(i => `
                <tr>
                  <td><strong>${escapeHtml(i.nombre)}</strong></td>
                  <td>${i.cantReqEnUnidadReceta.toFixed(1)} ${i.unidadReceta}</td>
                  <td>${i.stockActual} ${i.unidadInsumo}</td>
                  <td>
                    ${i.tieneStock ? `
                      <span class="stock-pill-ok">✅ Stock OK</span>
                    ` : `
                      <span class="stock-pill-low">❌ Faltan ${i.faltante.toFixed(2)} ${i.unidadInsumo}</span>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${producto.tipoStock === 'terminado' ? `
          <div class="production-card-box">
            <strong>✨ Producto para vitrina / entrega inmediata:</strong>
            <p style="margin:4px 0 0 0; font-size:13px;">
              Al confirmar, el stock actual de <strong>${escapeHtml(producto.nombre)}</strong> pasará de 
              <strong>${producto.stockActual || 0}</strong> a <strong>${(producto.stockActual || 0) + cantNum} unidades</strong> disponibles para pedidos.
            </p>
          </div>
        ` : `
          <div class="production-card-box">
            <strong>🍰 Producto a pedido / por encargo:</strong>
            <p style="margin:4px 0 0 0; font-size:13px;">
              Se descontarán los insumos de bodega correspondientes a esta producción.
            </p>
          </div>
        `}

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
          <button type="button" class="btn btn-primary" id="btn-confirmar-produccion" ${algunFaltante ? 'style="opacity:0.85;"' : ''}>
            🍳 Confirmar Hornada y Descontar Bodega
          </button>
        </div>
      `;

      bodyEl.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

      const inCant = bodyEl.querySelector('#prod-cantidad');
      inCant.addEventListener('input', (e) => {
        cantidadAProducir = Number(e.target.value) || 1;
        renderProduccionBody();
      });

      bodyEl.querySelector('#btn-confirmar-produccion').addEventListener('click', () => {
        const motivo = bodyEl.querySelector('#prod-motivo').value.trim();
        try {
          const res = Storage.producirLote({
            productoId,
            cantidadAProducir: cantNum,
            motivo
          });

          App.closeModal();
          App.toast(`¡Hornada registrada! Se descontaron los insumos${res.esTerminado ? ` y se sumaron ${cantNum} unidades a vitrina.` : '.'}`);
          const main = document.getElementById('main-content');
          Productos.render(main);
        } catch(err) {
          App.toast(err.message, 'error');
        }
      });
    }

    renderProduccionBody();
  }

  /* ---------------- FORMULARIO DE PRODUCTO (NUEVO/EDITAR) ---------------- */
  function openForm(id){
    const productos = Storage.get('productos');
    const editing = id ? productos.find(p => p.id === id) : null;
    const categoriasExistentes = [...new Set(productos.map(p => p.categoria))].sort();

    const overlay = App.openModal(`
      <div class="modal-header">
        <h3>${editing ? 'Editar producto' : 'Nuevo producto'}</h3>
        <button class="modal-close" data-close>${App.svgIcon('close')}</button>
      </div>
      <form id="form-producto">
        <div class="form-grid">
          <div class="field full">
            <label>Nombre *</label>
            <input type="text" id="p-nombre" value="${editing ? escapeHtml(editing.nombre) : ''}" required />
          </div>
          <div class="field">
            <label>Categoría *</label>
            <input type="text" id="p-categoria" list="categorias-existentes" value="${editing ? escapeHtml(editing.categoria) : ''}" required />
            <datalist id="categorias-existentes">${categoriasExistentes.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
          </div>
          <div class="field">
            <label>Precio de venta (CLP) *</label>
            <input type="number" id="p-precio" min="0" step="1" value="${editing ? editing.precioVenta : ''}" required />
          </div>
          <div class="field">
            <label>Tipo de disponibilidad / Stock</label>
            <select id="p-tipo-stock">
              <option value="terminado" ${!editing || editing.tipoStock === 'terminado' ? 'selected' : ''}>Producto terminado (Galletas, vitrina)</option>
              <option value="a_pedido" ${editing && editing.tipoStock === 'a_pedido' ? 'selected' : ''}>A pedido / Tortas (Bajo encargo)</option>
            </select>
          </div>
          <div class="field" id="box-stock-actual">
            <label>Stock actual disponible (unidades)</label>
            <input type="number" id="p-stock-actual" min="0" step="1" value="${editing ? (editing.stockActual !== undefined ? editing.stockActual : 10) : 10}" />
          </div>
          <div class="field">
            <label>Unidad de venta</label>
            <select id="p-unidad">
              ${['unidad','kg','caja','paquete','porción'].map(u => `<option value="${u}" ${editing && editing.unidadVenta === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Estado</label>
            <select id="p-estado">
              <option value="activo" ${!editing || editing.estado === 'activo' ? 'selected' : ''}>Activo (Visible)</option>
              <option value="inactivo" ${editing && editing.estado === 'inactivo' ? 'selected' : ''}>Inactivo (Oculto)</option>
            </select>
          </div>
          <div class="field full">
            <label>Foto / URL de Imagen (opcional para el catálogo público)</label>
            <input type="url" id="p-imagen" placeholder="https://ejemplo.com/torta.jpg" value="${editing ? escapeHtml(editing.imagenUrl || '') : ''}" />
          </div>
          <div class="field full">
            <label>Descripción para los clientes (opcional)</label>
            <textarea id="p-desc" rows="2" placeholder="Ej: Rellena con manjar casero y nueces seleccionadas">${editing ? escapeHtml(editing.descripcion || '') : ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar producto</button>
        </div>
      </form>
    `);
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', App.closeModal));

    const selTipo = overlay.querySelector('#p-tipo-stock');
    const boxStock = overlay.querySelector('#box-stock-actual');
    function toggleStockField(){
      boxStock.style.opacity = selTipo.value === 'terminado' ? '1' : '0.4';
    }
    selTipo.addEventListener('change', toggleStockField);
    toggleStockField();

    overlay.querySelector('#form-producto').addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = document.getElementById('p-nombre').value.trim();
      const categoria = document.getElementById('p-categoria').value.trim();
      const precio = document.getElementById('p-precio').value;
      const tipoStock = document.getElementById('p-tipo-stock').value;
      const stockActual = Number(document.getElementById('p-stock-actual').value) || 0;
      const imagenUrl = document.getElementById('p-imagen').value.trim();

      if (!nombre){ App.toast('Ingresa un nombre para el producto.', 'error'); return; }
      if (!categoria){ App.toast('Ingresa una categoría.', 'error'); return; }
      if (!App.isPositiveNumber(precio)){ App.toast('El precio debe ser un número mayor o igual a 0.', 'error'); return; }

      const productos = Storage.get('productos');
      const prodData = {
        nombre,
        categoria,
        precioVenta: Number(precio),
        unidadVenta: document.getElementById('p-unidad').value,
        tipoStock,
        stockActual: tipoStock === 'terminado' ? stockActual : 0,
        imagenUrl,
        estado: document.getElementById('p-estado').value,
        descripcion: document.getElementById('p-desc').value.trim()
      };

      if (editing){
        const idx = productos.findIndex(p => p.id === editing.id);
        productos[idx] = { ...editing, ...prodData };
      }else{
        productos.push({
          id: Storage.generateId('prod'),
          ...prodData,
          stockMinimo: 5,
          demo: false
        });
      }
      Storage.save('productos', productos);
      App.closeModal();
      App.toast(editing ? 'Producto actualizado correctamente' : 'Producto agregado correctamente');
      const main = document.getElementById('main-content');
      render(main);
    });
  }

  function handleDelete(id){
    const productos = Storage.get('productos');
    const prod = productos.find(p => p.id === id);
    const ventas = Storage.get('ventas');
    const tieneVentas = ventas.some(v => v.productoId === id);
    App.confirmAction({
      title: 'Eliminar producto',
      message: tieneVentas
        ? `"${prod.nombre}" tiene ventas registradas. Las ventas históricas se conservarán con su precio original, pero el producto ya no aparecerá disponible para nuevas ventas.`
        : `¿Eliminar "${prod.nombre}"? Esta acción no se puede deshacer.`,
      onConfirm: () => {
        Storage.save('productos', productos.filter(p => p.id !== id));
        Storage.eliminarReceta(id);
        App.toast('Producto eliminado');
        const main = document.getElementById('main-content');
        render(main);
      }
    });
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  return { render, escapeHtml, openRecetaModal, openProduccionModal };
})();
