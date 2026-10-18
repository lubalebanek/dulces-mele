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

      <!-- Conexión a Supabase (Nube) -->
      <div class="card">
        <h3 class="card-title mt-0">Conexión a la Nube (Supabase)</h3>
        <p class="text-soft">Conecta tu base de datos en la nube para sincronizar pedidos en vivo entre el teléfono de tu mamá y el link que envías a los clientes.</p>
        
        <div style="background: var(--surface-2); padding: 12px; border-radius: var(--radius-sm); margin: 12px 0; font-size: 13px;">
          <strong>Estado de conexión:</strong> 
          <span class="badge ${config.supabaseUrl ? 'badge-sage' : 'badge-amber'}">
            ${config.supabaseUrl ? '🟢 Conexión Nube configurada' : '🟡 Modo Local (Navegador)'}
          </span>
          <div style="margin-top: 6px;">
            El script SQL para tus tablas está listo en: <code>supabase_schema.sql</code>
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

      <div class="card">
        <h3 class="card-title mt-0" style="color:var(--danger);">Zona de riesgo</h3>
        <p class="text-soft">Esto eliminará permanentemente productos, ventas, insumos, pedidos y gastos guardados en este navegador.</p>
        <button class="btn btn-danger" id="btn-eliminar-todo">Eliminar todos los datos</button>
      </div>
    `;

    // Eventos para guardar datos del negocio
    document.getElementById('form-config-negocio').addEventListener('submit', (e) => {
      e.preventDefault();
      const cfg = Storage.get('configuracion') || {};
      cfg.nombreNegocio = document.getElementById('cfg-nombre').value.trim();
      cfg.telefonoWhatsApp = document.getElementById('cfg-whatsapp').value.trim();
      cfg.datosTransferencia = document.getElementById('cfg-transferencia').value.trim();
      cfg.cuposDiariosTortas = Number(document.getElementById('cfg-cupos').value) || 5;
      Storage.save('configuracion', cfg);
      App.toast('Datos del negocio guardados correctamente');
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
