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
      console.log("⏳ Buscando pedidos en la nube...");
      const { data: pedidosNube, error: errPed } = await client.from('pedidos').select('*');
      const { data: itemsNube, error: errItems } = await client.from('pedido_items').select('*');
      
      if (errPed || errItems) {
        console.error("❌ Supabase no dejó descargar:", errPed || errItems);
        return;
      }

      console.log("📦 Pedidos encontrados en la nube:", pedidosNube);
      
      const pedidosLocal = Storage.get('pedidos') || [];
      let hayNuevos = false;

      pedidosNube.forEach(pNube => {
        // Evitar duplicados revisando el ID
        if (!pedidosLocal.find(p => p.id === pNube.id)) {
          
          const itemsDelPedido = (itemsNube || []).filter(i => i.pedido_id === pNube.id).map(i => ({
            productoId: i.producto_id,
            nombre: i.nombre || 'Producto sin nombre',
            precioUnitario: Number(i.precio_unitario) || 0,
            cantidad: Number(i.cantidad) || 1,
            subtotal: Number(i.subtotal) || 0,
            tipoStock: i.tipo_stock || 'terminado'
          }));

          pedidosLocal.push({
            id: pNube.id,
            codigo: pNube.codigo || 'Sin Código',
            clienteNombre: pNube.cliente_nombre || 'Cliente web',
            clienteTelefono: pNube.cliente_telefono || '',
            clienteEmail: pNube.cliente_email || '',
            tipoEntrega: pNube.tipo_entrega || 'retiro',
            direccionDespacho: pNube.direccion_despacho || '',
            fechaEntrega: pNube.fecha_entrega || '',
            horaEntrega: pNube.hora_entrega || '',
            notas: pNube.notas || '',
            total: Number(pNube.total) || 0,
            abono: Number(pNube.abono) || 0,
            saldoPendiente: Number(pNube.saldo_pendiente) || 0,
            medioPago: pNube.medio_pago || 'Transferencia',
            estado: pNube.estado || 'pendiente',
            origen: pNube.origen || 'web_cliente',
            items: itemsDelPedido,
            creadoEn: pNube.created_at ? new Date(pNube.created_at).getTime() : Date.now()
          });
          hayNuevos = true;
        }
      });

      if (hayNuevos) {
        console.log("✅ Se encontraron pedidos nuevos. Guardando en memoria...");
        Storage.save('pedidos', pedidosLocal);
        
        // Forzar actualización de la pantalla
        if (window.App && typeof App.goTo === 'function') {
          App.goTo(App.currentSection || 'pedidos');
        } else {
           window.location.reload(); 
        }
      } else {
        console.log("🤷‍♀️ No hay pedidos nuevos por descargar.");
      }
    } catch(e) {
      console.error('❌ Error general sincronizando:', e);
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
    if (!client) {
      alert("Error: El teléfono no tiene conexión a Supabase.");
      return null;
    }
    try {
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

      // ESTO HARÁ QUE EL TELÉFONO GRITE EL ERROR
      if (pedErr) {
        alert("Supabase rechazó el pedido: " + pedErr.message);
        throw pedErr;
      }
      
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
        if (itemsErr) {
          alert("Supabase rechazó los productos: " + itemsErr.message);
          throw itemsErr;
        }
      }
      return nuevoId; 
    } catch (e){
      console.error('Error subiendo pedido:', e);
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

// Ejecutar la descarga de pedidos automáticamente al abrir la página
setTimeout(() => {
  if (typeof sincronizarPedidos === 'function') {
    sincronizarPedidos();
  }
}, 1000);
