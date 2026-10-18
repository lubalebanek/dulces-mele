/* ============================================================
   GESTOR DE PASTELERÍA — supabase-client.js
   Capa de integración con Supabase en la nube:
   - Si no hay credenciales configuradas, la app funciona en modo Local
   - Si se configuran URL y Anon Key, sincroniza pedidos y productos
   - Soporte para Realtime (notifica a tu mamá cuando entra un pedido nuevo)
   ============================================================ */

const SupabaseBridge = (() => {
  let client = null;
  let isConnected = false;

  function init(){
    const config = Storage.get('configuracion') || {};
    if (config.supabaseUrl && config.supabaseAnonKey && window.supabase){
      try {
        client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        isConnected = true;
        console.log('✓ Conectado exitosamente a Supabase');
        subscribirCambiosEnTiempoReal();
      } catch (err){
        console.error('Error inicializando Supabase:', err);
      }
    }
  }

  /* Subscripción a nuevos pedidos en tiempo real */
  function subscribirCambiosEnTiempoReal(){
    if (!client) return;

    client
      .channel('pedidos-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, payload => {
        const nuevo = payload.new;
        if (window.App && typeof App.toast === 'function'){
          App.toast(`🧁 ¡Nuevo pedido recibido #${nuevo.codigo || ''} de ${nuevo.cliente_nombre}!`, 'success');
          // Si estamos en la sección de pedidos o inicio, refrescar
          if (App.currentSection === 'pedidos' || App.currentSection === 'dashboard'){
            App.goTo(App.currentSection);
          }
        }
      })
      .subscribe();
  }

  /* Obtener productos desde Supabase */
  async function fetchProductos(){
    if (!client) return null;
    try {
      const { data, error } = await client
        .from('productos')
        .select('*')
        .eq('estado', 'activo');
      if (error) throw error;
      return data;
    } catch (e){
      console.error('Error trayendo productos de Supabase:', e);
      return null;
    }
  }

  /* Enviar un pedido a Supabase */
  async function enviarPedido(pedidoData){
    if (!client) return null;
    try {
      // Usar la función almacenada para descuento atómico de stock
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
      return data; // Retorna UUID del pedido creado
    } catch (e){
      console.error('Error creando pedido en Supabase:', e);
      return null;
    }
  }

  return {
    init,
    fetchProductos,
    enviarPedido,
    get isConnected(){ return isConnected; },
    get client(){ return client; }
  };
})();

document.addEventListener('DOMContentLoaded', SupabaseBridge.init);
