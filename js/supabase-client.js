/* ============================================================
   GESTOR DE PASTELERÍA — supabase-client.js
   Sincronización en la nube con Supabase para Dulces Mele.
   ============================================================ */

const SupabaseBridge = (() => {
  let client = null;
  let isConnected = false;

  function init(){
    if (typeof Storage !== 'undefined' && typeof Storage.init === 'function') {
      Storage.init();
    }
    const config = (typeof Storage !== 'undefined' && typeof Storage.get === 'function')
      ? (Storage.get('configuracion') || {})
      : {};

    const supabaseUrl = config.supabaseUrl || 'https://mdbftytjmpvakibgdavt.supabase.co';
    const supabaseAnonKey = config.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kYmZ0eXRqbXB2YWtpYmdkYXZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNjAwOTcsImV4cCI6MjEwNzczNjA5N30.k-0H5RZsCHIPT4LUy-D-eRMQ9xQsLyJUtIS-B7nR9H4';

    if (supabaseUrl && supabaseAnonKey && window.supabase){
      try {
        client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        isConnected = true;
        console.log('✓ Conectado exitosamente a Supabase (Dulces Mele)');
      } catch (err){
        console.error('Error inicializando Supabase:', err);
      }
    }
  }

  async function getCurrentUser(){
    if (!client) return null;
    try {
      const { data, error } = await client.auth.getUser();
      if (error) return null;
      return data.user || null;
    } catch (e) {
      return null;
    }
  }

  async function signIn(email, password){
    if (!client) throw new Error('No se pudo conectar con Supabase.');
    return client.auth.signInWithPassword({ email, password });
  }

  async function signOut(){
    if (!client) return;
    return client.auth.signOut();
  }

  async function iniciarSincronizacionAdmin(){
    const user = await getCurrentUser();
    if (!user) return false;
    await sincronizarPedidos();
    subscribirCambiosEnTiempoReal();
    return true;
  }

  async function sincronizarPedidos() {
    if (!client) return;
    try {
      const user = await getCurrentUser();
      if (!user) return;
      console.log("⏳ Buscando pedidos en la nube...");
      const { data: pedidosNube, error: errPed } = await client.from('pedidos').select('*').order('created_at', { ascending: false });
      const { data: itemsNube, error: errItems } = await client.from('pedido_items').select('*');
      
      if (errPed || errItems) {
        console.warn("Aviso al descargar de Supabase:", errPed || errItems);
        return;
      }

      console.log("📦 Pedidos encontrados en la nube:", pedidosNube?.length || 0);
      
      const pedidosLocal = Storage.get('pedidos') || [];
      let hayNuevos = false;

      (pedidosNube || []).forEach(pNube => {
        // Evitar duplicados por id o por código correlativo
        const yaExiste = pedidosLocal.find(p => p.id === pNube.id || (p.codigo && pNube.codigo && p.codigo === pNube.codigo));
        if (!yaExiste) {
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
        console.log("✅ Se encontraron pedidos nuevos. Guardando en memoria local...");
        Storage.save('pedidos', pedidosLocal);
        
        // Refrescar vista actual
        if (window.App && typeof App.goTo === 'function') {
          App.goTo(App.currentSection || 'pedidos');
        }
      }
    } catch(e) {
      console.error('❌ Error sincronizando pedidos:', e);
    }
  }

  function reproducirCampana(){
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18); // A5
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch(e) {}
  }

  function subscribirCambiosEnTiempoReal(){
    if (!client) return;
    try {
      client
        .channel('pedidos-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, payload => {
          sincronizarPedidos();
          reproducirCampana();
          if (window.App && typeof App.toast === 'function'){
            App.toast(`🧁 ¡Nuevo pedido recibido #${payload.new.codigo || ''} de ${payload.new.cliente_nombre}!`, 'success');
          }
        })
        .subscribe();
    } catch(e) {
      console.warn('No se pudo activar tiempo real:', e);
    }
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
      console.warn('Supabase no está conectado.');
      return null;
    }
    try {
      // 1. Guardar en tabla 'pedidos'
      const payloadPedido = {
        codigo: pedidoData.codigo,
        cliente_nombre: pedidoData.clienteNombre,
        cliente_telefono: pedidoData.clienteTelefono,
        cliente_email: pedidoData.clienteEmail || '',
        tipo_entrega: pedidoData.tipoEntrega || 'retiro',
        direccion_despacho: pedidoData.direccionDespacho || '',
        fecha_entrega: pedidoData.fechaEntrega,
        hora_entrega: pedidoData.horaEntrega || '',
        notas: pedidoData.notas || '',
        total: Number(pedidoData.total) || 0,
        abono: Number(pedidoData.abono) || 0,
        saldo_pendiente: Number(pedidoData.saldoPendiente ?? (pedidoData.total - (pedidoData.abono || 0))) || 0,
        medio_pago: pedidoData.medioPago || 'Transferencia',
        estado: pedidoData.estado || 'pendiente',
        origen: pedidoData.origen || 'web_cliente'
      };

      const { data: pedidoInsertado, error: errPedido } = await client
        .from('pedidos')
        .insert([payloadPedido])
        .select()
        .single();

      if (errPedido) {
        console.warn('Inserción directa en pedidos no autorizada o fallida:', errPedido);
        // Intentar fallback si existe la función RPC
        try {
          const { data: rpcData, error: errRpc } = await client.rpc('crear_pedido_con_descuento', {
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
            p_items: pedidoData.items || []
          });
          if (!errRpc && rpcData) return rpcData;
        } catch(e) {}
        return null;
      }

      const pedidoId = pedidoInsertado.id;

      // 2. Guardar items en 'pedido_items'
      if (pedidoData.items && pedidoData.items.length > 0) {
        const itemsPayload = pedidoData.items.map(item => {
          // Asegurar que producto_id sea UUID válido o null
          const esUUID = item.productoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.productoId);
          return {
            pedido_id: pedidoId,
            producto_id: esUUID ? item.productoId : null,
            nombre: item.nombre,
            precio_unitario: Number(item.precioUnitario) || 0,
            cantidad: Number(item.cantidad) || 1,
            subtotal: Number(item.subtotal) || 0,
            tipo_stock: item.tipoStock || 'terminado'
          };
        });

        const { error: errItems } = await client
          .from('pedido_items')
          .insert(itemsPayload);

        if (errItems) {
          console.warn('Aviso al insertar items en Supabase:', errItems);
        }
      }

      return pedidoId;
    } catch (e){
      console.error('Error subiendo pedido a Supabase:', e);
      return null;
    }
  }

  async function guardarProducto(producto, existente = null){
    if (!client) throw new Error('No hay conexión con Supabase.');
    const user = await getCurrentUser();
    if (!user) throw new Error('Inicia sesión en el panel de administración para guardar productos en la nube.');

    const columnas = {
      nombre: 'nombre', categoria: 'categoria', precioVenta: 'precio_venta',
      unidadVenta: 'unidad_venta', tipoStock: 'tipo_stock', stockActual: 'stock_actual',
      descripcion: 'descripcion', imagenUrl: 'imagen_url', estado: 'estado'
    };
    const normalizar = (clave, valor) => ['precioVenta', 'stockActual', 'stockMinimo'].includes(clave) ? Number(valor) || 0 : (valor ?? '');
    let payload = {};

    if (existente){
      const { data: coincidencias, error: buscarError } = await client.from('productos').select('id').eq('nombre', existente.nombre);
      if (buscarError) throw buscarError;
      if (!coincidencias || coincidencias.length !== 1){
        throw new Error(coincidencias?.length > 1 ? 'Hay más de un producto con ese nombre en Supabase; no se guardó para evitar modificar el incorrecto.' : 'No encontré este producto en Supabase. No se guardaron cambios locales.');
      }
      for (const clave of Object.keys(columnas)){
        if (normalizar(clave, producto[clave]) !== normalizar(clave, existente[clave])) payload[columnas[clave]] = normalizar(clave, producto[clave]);
      }
      if (Object.keys(payload).length === 0) return { id: coincidencias[0].id };
      const { data, error } = await client.from('productos').update(payload).eq('id', coincidencias[0].id).select('id').single();
      if (error) throw error;
      return data;
    }

    for (const clave of Object.keys(columnas)) payload[columnas[clave]] = normalizar(clave, producto[clave]);
    payload.stock_minimo = Number(producto.stockMinimo) || 5;
    const { data, error } = await client.from('productos').insert(payload).select('id').single();
    if (error) throw error;
    return data;
  }

  return {
    init,
    getCurrentUser,
    signIn,
    signOut,
    iniciarSincronizacionAdmin,
    fetchProductos,
    guardarProducto,
    enviarPedido,
    sincronizarPedidos,
    get isConnected(){ return isConnected; },
    get client(){ return client; }
  };
})();

document.addEventListener('DOMContentLoaded', SupabaseBridge.init);
