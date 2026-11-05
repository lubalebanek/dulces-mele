/* ============================================================
   GESTOR DE PASTELERÍA — config.js
   Configuración y gestión de datos: respaldo, restauración y
   borrado total. También deja la puerta abierta para, en el
   futuro, migrar de localStorage a una base de datos real
   (ver explicación en el mensaje de entrega / README).
   ============================================================ */

const Config = (() => {

  function escapeHtml(str){
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render(container){
    const config = Storage.get('configuracion');
    const productos = Storage.get('productos');
    const ventas = Storage.get('ventas');
    const insumos = Storage.get('insumos');
    const gastos = Storage.get('gastos');

    container.innerHTML = `
      <div class="page-header">
        <div><h1>Configuración / Datos</h1><div class="subtitle">Respaldo, restauración y ajustes</div></div>
      </div>

      <div class="card">
        <h3 class="card-title mt-0">Estado actual de tus datos</h3>
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-label">Pedidos</div><div class="kpi-value">${(Storage.get('pedidos')||[]).length}</div></div>
          <div class="kpi-card"><div class="kpi-label">Productos</div><div class="kpi-value">${productos.length}</div></div>
          <div class="kpi-card"><div class="kpi-label">Ventas</div><div class="kpi-value">${ventas.length}</div></div>
          <div class="kpi-card"><div class="kpi-label">Insumos</div><div class="kpi-value">${insumos.length}</div></div>
        </div>
      </div>

      <!-- Configuración del Negocio y Pedidos Online -->
      <div class="card">
        <h3 class="card-title mt-0">Datos del Negocio y Pedidos Online</h3>
        <p class="text-soft">Estos datos se usan para la página web pública de pedidos (<code>pedir.html</code>) y las confirmaciones automáticas de WhatsApp.</p>
        
        <form id="form-config-negocio" class="form-grid" style="margin-top: 14px;">
          <div class="field">
            <label>Nombre del Negocio</label>
            <input type="text" id="cfg-nombre" value="${escapeHtml(config.nombreNegocio || 'Dulces Mele')}" required />
          </div>
          <div class="field">
            <label>WhatsApp para recibir pedidos (con código de país)</label>
            <input type="tel" id="cfg-whatsapp" placeholder="+56912345678" value="${escapeHtml(config.telefonoWhatsApp || '+569')}" required />
          </div>
          <div class="field full">
            <label>Datos para Transferencia Bancaria (se muestran a los clientes al encargar)</label>
            <textarea id="cfg-transferencia" rows="2" placeholder="Banco Estado / Cuenta RUT / Rut / Correo">${escapeHtml(config.datosTransferencia || '')}</textarea>
          </div>
          <div class="field">
            <label>Cupos diarios máximos para Tortas a pedido</label>
            <input type="number" id="cfg-cupos" min="1" max="50" value="${config.cuposDiariosTortas || 5}" />
          </div>
          <div class="field full" style="display:flex; justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Guardar Datos del Negocio</button>
          </div>
        </form>
      </div>

      <!-- Control de Horarios de Pedidos y Días de Entrega (Tienda Online) -->
      <div class="card" style="border-left: 4px solid var(--berry);">
        <h3 class="card-title mt-0">🕒 Horarios de Pedidos Online y Días de Entrega</h3>
        <p class="text-soft">Configura cuándo está habilitada la página de pedidos (<code>pedir.html</code>), límites de horario y qué días de la semana realizas entregas y despachos.</p>
        
        <form id="form-config-horarios" class="form-grid" style="margin-top: 14px;">
          <!-- Estado de la tienda -->
          <div class="field full">
            <label style="font-weight:700;">Estado de la Tienda Online</label>
            <div style="display:flex; gap:16px; margin-top:6px; flex-wrap:wrap;">
              <label class="flex gap-8" style="align-items:center; cursor:pointer;">
                <input type="radio" name="cfg-tienda-estado" value="abierta" ${config.tiendaActiva !== false ? 'checked' : ''} style="width:auto;" />
                <span class="badge badge-sage">🟢 Abierta (Recibiendo pedidos online)</span>
              </label>
              <label class="flex gap-8" style="align-items:center; cursor:pointer;">
                <input type="radio" name="cfg-tienda-estado" value="cerrada" ${config.tiendaActiva === false ? 'checked' : ''} style="width:auto;" />
                <span class="badge badge-amber">🔴 Cerrada / Solo venta presencial</span>
              </label>
            </div>
          </div>

          <!-- Límite de horario / Fecha de corte -->
          <div class="field">
            <label>Fecha y hora límite de pedidos (Opcional)</label>
            <input type="datetime-local" id="cfg-fecha-limite" value="${escapeHtml(config.fechaLimitePedidos || '')}" />
            <div class="form-hint">Ej: Configura el día hasta las 12:00. Al llegar esa hora, la web se inhabilitará automáticamente.</div>
          </div>

          <div class="field">
            <label>Hora límite de corte diario (Opcional)</label>
            <input type="time" id="cfg-horario-corte" value="${escapeHtml(config.horarioCorte || '')}" />
            <div class="form-hint">Ej: 12:00. Si está configurado, no se recibirán pedidos después de esta hora cada día.</div>
          </div>

          <!-- Días de entrega permitidos -->
          <div class="field full">
            <label style="font-weight:700;">Días de la semana permitidos para Entrega / Despacho</label>
            <p class="form-hint" style="margin-top:2px;">Los clientes solo podrán seleccionar estos días en el calendario de entrega de la tienda (por defecto: solo Jueves).</p>
            <div style="display:flex; gap:12px; margin-top:8px; flex-wrap:wrap;" id="box-dias-semana">
              ${[
                { num: 1, nom: 'Lunes' },
                { num: 2, nom: 'Martes' },
                { num: 3, nom: 'Miércoles' },
                { num: 4, nom: 'Jueves' },
                { num: 5, nom: 'Viernes' },
                { num: 6, nom: 'Sábado' },
                { num: 0, nom: 'Domingo' }
              ].map(d => {
                const checked = (config.diasEntregaPermitidos || [4]).includes(d.num);
                return `
                  <label class="flex gap-8" style="align-items:center; background:var(--surface-2); padding:6px 12px; border-radius:var(--radius-sm); border:1px solid var(--line); font-size:13px; font-weight:600; cursor:pointer;">
                    <input type="checkbox" class="chk-dia-entrega" value="${d.num}" ${checked ? 'checked' : ''} style="width:auto;" />
                    ${d.nom}
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Mensaje para cuando la tienda está inhabilitada -->
          <div class="field full">
            <label>Mensaje mostrado a los clientes cuando la tienda esté cerrada</label>
            <textarea id="cfg-mensaje-cierre" rows="2">${escapeHtml(config.mensajeCierre || 'Por el momento los pedidos online están cerrados. La compra se debe realizar de manera presencial en nuestro local.')}</textarea>
          </div>

          <!-- Datos de atención presencial -->
          <div class="field">
            <label>Dirección para compra presencial</label>
            <input type="text" id="cfg-dir-local" value="${escapeHtml(config.direccionLocal || 'Francisco Ramírez 10')}" placeholder="Ej: Francisco Ramírez 10" />
          </div>

          <div class="field">
            <label>Horario de atención presencial en local</label>
            <input type="text" id="cfg-horario-local" value="${escapeHtml(config.horarioAtencionLocal || '10:00 a 19:00 hrs')}" placeholder="Ej: 10:00 a 19:00 hrs" />
          </div>

          <div class="field full" style="display:flex; justify-content:flex-end;">
            <button type="submit" class="btn btn-primary" style="font-weight:700;">💾 Guardar Horarios y Restricciones</button>
          </div>
        </form>
      </div>

      <!-- Conexión a Supabase (Nube) -->
      <div class="card">
        <h3 class="card-title mt-0">Conexión a la Nube (Supabase)</h3>
        <p class="text-soft">Conecta tu base de datos en la nube para sincronizar pedidos en vivo entre el teléfono de tu mamá y el link que envías a los clientes.</p>
        
        <div style="background: var(--surface-2); padding: 12px; border-radius: var(--radius-sm); margin: 12px 0; font-size: 13px;">
          <strong>Estado de conexión:</strong> 
          <span class="badge ${config.supabaseUrl ? 'badge-sage' : 'badge-amber'}">
            ${config.supabaseUrl ? '🟢 Conexión Nube configurada' : '🟡 Modo Local (Navegador)'}
          </span>
          <div style="margin-top: 6px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span>El script SQL para tus tablas está listo en: <code>HABILITAR_PEDIDOS_SUPABASE.sql</code></span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="if(typeof SupabaseBridge !== 'undefined') SupabaseBridge.reproducirCampana()">🔔 Probar timbre de pedidos</button>
          </div>
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" id="btn-sync-all-config" style="font-weight:600;">☁️ Sincronizar Todo con la Nube Ahora</button>
          </div>
        </div>

        <form id="form-config-supabase" class="form-grid">
          <div class="field full">
            <label>Supabase Project URL</label>
            <input type="url" id="cfg-sb-url" placeholder="https://xyzcompany.supabase.co" value="${escapeHtml(config.supabaseUrl || '')}" />
          </div>
          <div class="field full">
            <label>Supabase Anon Public Key</label>
            <input type="text" id="cfg-sb-key" placeholder="eyJhbGciOi..." value="${escapeHtml(config.supabaseAnonKey || '')}" />
          </div>
          <div class="field full" style="display:flex; justify-content:flex-end; gap: 8px;">
            <button type="submit" class="btn btn-primary">Guardar Credenciales Supabase</button>
          </div>
        </form>
      </div>

      <div class="card">
        <h3 class="card-title mt-0">Respaldo de datos</h3>
        <p class="text-soft">Descarga un respaldo periódicamente en formato JSON con todos tus productos, pedidos, ventas e inventario.</p>
        <div class="flex gap-8" style="flex-wrap:wrap; margin-top:12px;">
          <button class="btn btn-primary" id="btn-exportar">Exportar respaldo completo (JSON)</button>
          <button class="btn btn-secondary" id="btn-importar">Importar respaldo</button>
          <input type="file" id="input-importar" accept="application/json" style="display:none;" />
        </div>
      </div>

      <div class="card">
        <h3 class="card-title mt-0">Ajustes generales</h3>
        <label class="flex gap-8" style="align-items:center; font-weight:600;">
          <input type="checkbox" id="chk-stock-negativo" style="width:auto;" ${config.permitirStockNegativo ? 'checked' : ''} />
          Permitir que el stock de insumos quede en negativo
        </label>
        <p class="form-hint">Por defecto la app no permite registrar una salida de inventario si no hay stock suficiente.</p>
      </div>

      <!-- REINICIO OPERATIVO: LIMPIAR PRUEBAS -->
      <div class="card" style="border-left: 4px solid var(--accent);">
        <h3 class="card-title mt-0">🧹 Reinicio Operativo (Comenzar de Cero)</h3>
        <p class="text-soft">Limpia todos los <strong>pedidos y ventas de prueba</strong> para dejar la pastelería lista para operar en el día a día.</p>
        <div style="background:var(--surface-2); padding:10px 14px; border-radius:var(--radius-sm); font-size:13px; margin:10px 0;">
          ✓ <strong>Se eliminan:</strong> Los pedidos de prueba y el historial de ventas.<br/>
          ✓ <strong>Se conservan:</strong> Tus productos (con sus fotos, precios y recetas), insumos y tus datos bancarios y de WhatsApp.
        </div>
        <button class="btn btn-primary" id="btn-limpiar-pruebas" style="background:var(--accent); border-color:var(--accent); font-weight:600;">
          🧹 Limpiar solo Pedidos y Ventas de prueba
        </button>
      </div>

      <div class="card">
        <h3 class="card-title mt-0" style="color:var(--danger);">Zona de riesgo (Borrado total)</h3>
        <p class="text-soft">Esto eliminará permanentemente productos, ventas, insumos, pedidos y gastos guardados en este navegador.</p>
        <button class="btn btn-danger" id="btn-eliminar-todo">Eliminar todos los datos</button>
      </div>
    `;

    // Eventos para guardar datos del negocio
    document.getElementById('form-config-negocio').addEventListener('submit', async (e) => {
      e.preventDefault();
      const cfg = Storage.get('configuracion') || {};
      cfg.nombreNegocio = document.getElementById('cfg-nombre').value.trim();
      cfg.telefonoWhatsApp = document.getElementById('cfg-whatsapp').value.trim();
      cfg.datosTransferencia = document.getElementById('cfg-transferencia').value.trim();
      cfg.cuposDiariosTortas = Number(document.getElementById('cfg-cupos').value) || 5;
      Storage.save('configuracion', cfg);
      if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.guardarConfiguracionNube === 'function') {
        await SupabaseBridge.guardarConfiguracionNube(cfg);
      }
      App.toast('Datos del negocio guardados y sincronizados');
    });

    // Eventos para guardar Horarios y Días de Entrega
    document.getElementById('form-config-horarios')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cfg = Storage.get('configuracion') || {};

      const tiendaEstado = document.querySelector('input[name="cfg-tienda-estado"]:checked')?.value;
      cfg.tiendaActiva = tiendaEstado !== 'cerrada';
      cfg.fechaLimitePedidos = document.getElementById('cfg-fecha-limite').value;
      cfg.horarioCorte = document.getElementById('cfg-horario-corte').value;
      cfg.mensajeCierre = document.getElementById('cfg-mensaje-cierre').value.trim();
      cfg.direccionLocal = document.getElementById('cfg-dir-local').value.trim();
      cfg.horarioAtencionLocal = document.getElementById('cfg-horario-local').value.trim();

      const checkboxes = document.querySelectorAll('.chk-dia-entrega:checked');
      const diasSeleccionados = Array.from(checkboxes).map(c => Number(c.value));
      if (diasSeleccionados.length === 0) {
        App.toast('Debes seleccionar al menos un día permitido para entregas (ej: Jueves).', 'error');
        return;
      }
      cfg.diasEntregaPermitidos = diasSeleccionados;

      Storage.save('configuracion', cfg);

      if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.guardarConfiguracionNube === 'function') {
        await SupabaseBridge.guardarConfiguracionNube(cfg);
      }

      App.toast('✓ Horarios de pedidos y días de entrega guardados en la nube');
      render(container);
    });

    // Eventos para guardar Supabase
    document.getElementById('form-config-supabase').addEventListener('submit', (e) => {
      e.preventDefault();
      const cfg = Storage.get('configuracion') || {};
      cfg.supabaseUrl = document.getElementById('cfg-sb-url').value.trim();
      cfg.supabaseAnonKey = document.getElementById('cfg-sb-key').value.trim();
      Storage.save('configuracion', cfg);
      App.toast('Credenciales de Supabase guardadas');
      render(container);
    });

    document.getElementById('btn-sync-all-config')?.addEventListener('click', async () => {
      if (typeof SupabaseBridge !== 'undefined') {
        App.toast('Sincronizando inventario, recetas y gastos con Supabase...');
        await SupabaseBridge.sincronizarTodo(true);
        render(container);
      }
    });

    document.getElementById('btn-exportar').addEventListener('click', () => {
      Storage.exportBackup();
      App.toast('Respaldo descargado correctamente');
    });

    document.getElementById('btn-importar').addEventListener('click', () => {
      document.getElementById('input-importar').click();
    });
    document.getElementById('input-importar').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        App.confirmAction({
          title: 'Importar respaldo',
          message: `Esto reemplazará todos los datos actuales por los del archivo "${file.name}". ¿Continuar?`,
          confirmLabel: 'Importar',
          onConfirm: () => {
            try{
              Storage.importBackup(reader.result);
              App.toast('Respaldo importado correctamente');
              App.goTo('dashboard');
            }catch(err){
              App.toast(err.message, 'error');
            }
          }
        });
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('chk-stock-negativo').addEventListener('change', (e) => {
      const cfg = Storage.get('configuracion');
      cfg.permitirStockNegativo = e.target.checked;
      Storage.save('configuracion', cfg);
      App.toast('Configuración actualizada');
    });

    // Limpiar solo pedidos y ventas de prueba
    document.getElementById('btn-limpiar-pruebas')?.addEventListener('click', () => {
      App.confirmAction({
        title: '¿Limpiar pedidos y ventas de prueba?',
        message: 'Esto vaciará la lista de pedidos y ventas para comenzar a operar en limpio. Tus productos, fotos, recetas y datos de WhatsApp NO se borrarán.',
        confirmLabel: 'Limpiar para empezar de cero',
        danger: false,
        onConfirm: async () => {
          Storage.limpiarPedidosYVentas();
          if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.limpiarPedidosYVentasNube === 'function') {
            await SupabaseBridge.limpiarPedidosYVentasNube();
          }
          App.toast('✓ Pedidos y ventas de prueba eliminados. ¡Lista para operar!');
          App.goTo('dashboard');
        }
      });
    });

    document.getElementById('btn-eliminar-todo').addEventListener('click', () => {
      App.confirmAction({
        title: 'Eliminar todos los datos',
        message: 'Esta acción es irreversible y eliminará todos tus productos, ventas, insumos y gastos guardados en este navegador.',
        confirmLabel: 'Eliminar todo',
        requireTyping: 'ELIMINAR',
        onConfirm: () => {
          Storage.eraseAll();
          App.toast('Todos los datos fueron eliminados');
          App.goTo('dashboard');
        }
      });
    });
  }

  return { render };
})();
