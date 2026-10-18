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
        
        if (window.App) {
          sincronizarPedidos();
        }
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
        sincronizarPedidos();
        if (window.App && typeof App.toast === 'function'){
          App.toast(`🧁 ¡Nuevo pedido recibido #${payload.new.codigo || ''} de ${payload.new.cliente_nombre}!`, 'success');
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
      // Inserción directa a la tabla, sin pasar por la función compleja
      const { data: pedData, error: pedErr } = await client.from('pedidos').insert([{
        codigo: pedidoData.codigo,
        cliente_nombre: pedidoData.clienteNombre,
        cliente_telefono: pedidoData.clienteTelefono,
        cliente_email: pedidoData.clienteEmail || '',
        tipo_entrega: pedidoData.tipoEntrega,
        direccion_despacho: pedidoData.direccionDespacho || '',
        fecha_entrega: pedidoData.fechaEntrega,
        hora_entrega: pedidoData.horaEntrega || '',
        notas: pedidoData.notas || '',
        total: pedidoData.total,
        abono: pedidoData.abono || 0,
        saldo_pendiente: pedidoData.saldoPendiente,
        medio_pago: pedidoData.medioPago || 'Transferencia',
        origen: pedidoData.origen || 'web_cliente',
        estado: 'pendiente'
      }]).select();

      if (pedErr) throw pedErr;
      const nuevoId = pedData[0].id;

      if (pedidoData.items && pedidoData.items.length > 0) {
        const itemsNube = pedidoData.items.map(i => ({
          pedido_id: nuevoId,
          producto_id: i.productoId,
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio_unitario: i.precioUnitario,
          subtotal: i.subtotal,
          tipo_stock: i.tipoStock || 'terminado'
        }));
        
        const { error: itemsErr } = await client.from('pedido_items').insert(itemsNube);
        if (itemsErr) throw itemsErr;
      }
      return nuevoId; 
    } catch (e){
      console.error('Error subiendo pedido a Supabase:', e);
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
