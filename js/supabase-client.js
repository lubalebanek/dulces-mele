/* ============================================================
   GESTOR DE PASTELERÍA — supabase-client.js
   ============================================================ */

const SupabaseBridge = (() => {
  let client = null;
  let isConnected = false;

  function init(){
    Storage.init(); 
    const config = Storage.get('configuracion') || {};
    if (config.supabaseUrl && config.supabaseAnonKey && window.supabase){
      try {
        client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        isConnected = true;
        console.log('✓ Conectado exitosamente a Supabase');
        
        // 1. Sincronizar pedidos de la nube al abrir el panel
        if (window.App) {
          sincronizarPedidos();
        }

        // 2. Escuchar nuevos pedidos en tiempo real
        subscribirCambiosEnTiempoReal();
      } catch (err){
        console.error('Error inicializando Supabase:', err);
      }
    }
  }

  async function sincronizarPedidos() {
    if (!client) return;
    try {
      const { data: pedidosNube, error: errPed } = await client.from('pedidos').select('*');
      const { data: itemsNube, error: errItems } = await client.from('pedido_items').select('*');
      
      if (errPed || errItems) return;

      const pedidosLocal = Storage.get('pedidos') || [];
      let hayNuevos = false;

      pedidosNube.forEach(pNube => {
        // Si el pedido no está en la computadora, lo descargamos
        if (!pedidosLocal.find(p => p.codigo === pNube.codigo)) {
          const itemsDelPedido = itemsNube.filter(i => i.pedido_id === pNube.id).map(i => ({
            productoId: i.producto_id,
            nombre: i.nombre,
            precioUnitario: Number(i.precio_unitario),
            cantidad: Number(i.cantidad),
            subtotal: Number(i.subtotal),
            tipoStock: i.tipo_stock
          }));

          pedidosLocal.push({
            id: pNube.id,
            codigo: pNube.codigo,
            clienteNombre: pNube.cliente_nombre,
            clienteTelefono: pNube.cliente_telefono,
            clienteEmail: pNube.cliente_email,
            tipoEntrega: pNube.tipo_entrega,
            direccionDespacho: pNube.direccion_despacho,
            fechaEntrega: pNube.fecha_entrega,
            horaEntrega: pNube.hora_entrega,
            notas: pNube.notas,
            total: Number(pNube.total),
            abono: Number(pNube.abono),
            saldoPendiente: Number(pNube.saldo_pendiente),
            medioPago: pNube.medio_pago,
            estado: pNube.estado,
            origen: pNube.origen,
            items: itemsDelPedido,
            creadoEn: new Date(pNube.created_at).getTime()
          });
          hayNuevos = true;
        }
      });

      if (hayNuevos) {
        Storage.save('pedidos', pedidosLocal);
        // Refrescar la pantalla si estamos viéndola
        if (window.App && (App.currentSection === 'pedidos' || App.currentSection === 'dashboard')) {
          App.goTo(App.currentSection);
        }
      }
    } catch(e) {
      console.error('Error sincronizando pedidos:', e);
    }
  }

  function subscribirCambiosEnTiempoReal(){
    if (!client) return;

    client
      .channel('pedidos-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, payload => {
        const nuevo = payload.new;
        
        // Cuando entra un pedido nuevo, jalamos los datos inmediatamente
        sincronizarPedidos();

        if (window.App && typeof App.toast === 'function'){
          App.toast(`🧁 ¡Nuevo pedido recibido #${nuevo.codigo || ''} de ${nuevo.cliente_nombre}!`, 'success');
        }
      })
      .subscribe();
  }

  async function fetchProductos(){
    if (!client) return null;
    try {
      const { data, error } = await client.from('productos').select('*').eq('estado', 'activo');
      if (error) throw error;
      return data;
    } catch (e){
      console.error('Error trayendo productos de Supabase:', e);
      return null;
    }
  }

  async function enviarPedido(pedidoData){
    if (!client) return null;
    try {
      const { data, error } = await client.rpc('crear_pedido_con_descuento', {
        p_cliente_nombre: pedidoData.clienteNombre,
        p_cliente_telefono: pedidoData.clienteTelefono,
        p_cliente_email: pedidoData.clienteEmail || '',
        p_tipo_entrega: pedidoData.tipoEntrega,
        p_direccion_despacho: pedidoData.direccionDespacho || '',
        p_fecha_entrega: pedidoData.fechaEntrega,
        p_hora_entrega: pedidoData.horaEntrega || '',
        p_notas: pedidoData.notas || '',
        p_total: pedidoData.total,
        p_abono: pedidoData.abono || 0,
        p_medio_pago: pedidoData.medioPago || 'Transferencia',
        p_origen: pedidoData.origen || 'web_cliente',
        p_items: pedidoData.items
      });

      if (error) throw error;
      return data; 
    } catch (e){
      console.error('Error creando pedido en Supabase:', e);
      return null;
    }
  }

  return {
    init,
    fetchProductos,
    enviarPedido,
    sincronizarPedidos,
    get isConnected(){ return isConnected; },
    get client(){ return client; }
  };
})();

document.addEventListener('DOMContentLoaded', SupabaseBridge.init);
