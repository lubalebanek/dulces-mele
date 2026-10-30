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
      let huboCambios = false;

      (pedidosNube || []).forEach(pNube => {
        const itemsDelPedido = (itemsNube || []).filter(i => i.pedido_id === pNube.id).map(i => ({
          productoId: i.producto_id,
          nombre: i.nombre || 'Producto sin nombre',
          precioUnitario: Number(i.precio_unitario) || 0,
          cantidad: Number(i.cantidad) || 1,
          subtotal: Number(i.subtotal) || 0,
          tipoStock: i.tipo_stock || 'terminado'
        }));

        const idx = pedidosLocal.findIndex(p => p.id === pNube.id || (p.codigo && pNube.codigo && p.codigo === pNube.codigo));

        if (idx === -1) {
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
          huboCambios = true;
        } else {
          // Ya existe en local: sincronizar los datos de la nube
          const p = pedidosLocal[idx];
          if (
            p.estado !== pNube.estado ||
            Number(p.abono) !== Number(pNube.abono) ||
            Number(p.saldoPendiente) !== Number(pNube.saldo_pendiente) ||
            p.clienteNombre !== pNube.cliente_nombre ||
            p.fechaEntrega !== pNube.fecha_entrega ||
            p.horaEntrega !== (pNube.hora_entrega || '') ||
            p.medioPago !== pNube.medio_pago ||
            Number(p.total) !== Number(pNube.total) ||
            p.tipoEntrega !== pNube.tipo_entrega ||
            p.direccionDespacho !== (pNube.direccion_despacho || '') ||
            p.notas !== (pNube.notas || '')
          ) {
            p.id = pNube.id; // asegurar UUID de la nube
            p.estado = pNube.estado;
            p.abono = Number(pNube.abono) || 0;
            p.saldoPendiente = Number(pNube.saldo_pendiente) || 0;
            p.clienteNombre = pNube.cliente_nombre || p.clienteNombre;
            p.clienteTelefono = pNube.cliente_telefono || p.clienteTelefono;
            p.clienteEmail = pNube.cliente_email || p.clienteEmail;
            p.tipoEntrega = pNube.tipo_entrega || p.tipoEntrega;
            p.direccionDespacho = pNube.direccion_despacho || p.direccionDespacho;
            p.fechaEntrega = pNube.fecha_entrega || p.fechaEntrega;
            p.horaEntrega = pNube.hora_entrega || p.horaEntrega;
            p.notas = pNube.notas || p.notas;
            p.total = Number(pNube.total) || p.total;
            p.medioPago = pNube.medio_pago || p.medioPago;
            if (itemsDelPedido.length > 0) p.items = itemsDelPedido;
            huboCambios = true;
          }
        }
      });

      if (huboCambios) {
        console.log("✅ Sincronización completada. Actualizando almacenamiento local...");
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
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      
      // Nota 1: Re5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Nota 2: La5 (880 Hz) - efecto 'Ding-Dong'
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.4, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.75);
    } catch(e) {
      console.warn('Audio no disponible:', e);
    }
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
      // 1. Asegurar un UUID válido para el pedido
      const esValidoUUID = pedidoData.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pedidoData.id);
      const pedidoId = esValidoUUID ? pedidoData.id : crypto.randomUUID();

      // 2. Guardar en tabla 'pedidos' sin .select() (para no requerir permiso de lectura en clientes anónimos)
      const payloadPedido = {
        id: pedidoId,
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

      console.log('⏳ Enviando pedido a Supabase...', payloadPedido);
      const { error: errPedido } = await client
        .from('pedidos')
        .insert([payloadPedido]);

      if (errPedido) {
        console.error('Error insertando en tabla pedidos:', errPedido);
        return null;
      }

      // 3. Guardar items en 'pedido_items'
      if (pedidoData.items && pedidoData.items.length > 0) {
        const itemsPayload = pedidoData.items.map(item => {
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

      console.log('✅ ¡Pedido guardado exitosamente en Supabase! ID:', pedidoId);
      return pedidoId;
    } catch (e){
      console.error('Error general subiendo pedido a Supabase:', e);
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

  async function actualizarPedidoNube(pedido){
    if (!client || !pedido) return false;
    try {
      const payload = {
        cliente_nombre: pedido.clienteNombre || 'Cliente',
        cliente_telefono: pedido.clienteTelefono || '',
        cliente_email: pedido.clienteEmail || '',
        tipo_entrega: pedido.tipoEntrega || 'retiro',
        direccion_despacho: pedido.direccionDespacho || '',
        fecha_entrega: pedido.fechaEntrega,
        hora_entrega: pedido.horaEntrega || '',
        notas: pedido.notas || '',
        total: Number(pedido.total) || 0,
        abono: Number(pedido.abono) || 0,
        saldo_pendiente: Number(pedido.saldoPendiente) || 0,
        estado: pedido.estado || 'pendiente',
        medio_pago: pedido.medioPago || 'Transferencia'
      };

      const esUUID = pedido.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pedido.id);
      
      let query;
      if (esUUID) {
        query = client.from('pedidos').update(payload).eq('id', pedido.id);
      } else if (pedido.codigo) {
        query = client.from('pedidos').update(payload).eq('codigo', pedido.codigo);
      } else {
        return false;
      }

      const { error } = await query;
      if (error) {
        console.error('Error actualizando pedido en Supabase:', error);
        return false;
      }

      // Si se actualizaron items y el id es UUID válido, refrescar pedido_items
      if (esUUID && Array.isArray(pedido.items) && pedido.items.length > 0) {
        try {
          await client.from('pedido_items').delete().eq('pedido_id', pedido.id);
          const itemsPayload = pedido.items.map(item => {
            const esItemUUID = item.productoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.productoId);
            return {
              pedido_id: pedido.id,
              producto_id: esItemUUID ? item.productoId : null,
              nombre: item.nombre,
              precio_unitario: Number(item.precioUnitario) || 0,
              cantidad: Number(item.cantidad) || 1,
              subtotal: Number(item.subtotal) || 0,
              tipo_stock: item.tipoStock || 'terminado'
            };
          });
          await client.from('pedido_items').insert(itemsPayload);
        } catch(errItems) {
          console.warn('Aviso actualizando items en Supabase:', errItems);
        }
      }

      console.log('✓ Pedido actualizado en Supabase:', pedido.codigo || pedido.id);
      return true;
    } catch(e) {
      console.warn('Aviso: error actualizando pedido en Supabase:', e);
      return false;
    }
  }

  async function eliminarPedidoNube(pedidoId, codigo = null){
    if (!client || (!pedidoId && !codigo)) return false;
    try {
      const esUUID = pedidoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pedidoId);
      
      // 1. Eliminar ventas asociadas en Supabase
      if (esUUID) {
        await client.from('ventas').delete().eq('pedido_id', pedidoId);
      }

      // 2. Eliminar items del pedido en Supabase
      if (esUUID) {
        await client.from('pedido_items').delete().eq('pedido_id', pedidoId);
      }

      // 3. Eliminar pedido
      let query;
      if (esUUID) {
        query = client.from('pedidos').delete().eq('id', pedidoId);
      } else if (codigo) {
        query = client.from('pedidos').delete().eq('codigo', codigo);
      } else {
        query = client.from('pedidos').delete().eq('id', pedidoId);
      }

      const { error } = await query;
      if (error) {
        console.error('Error eliminando pedido en Supabase:', error);
        return false;
      }
      console.log('✓ Pedido eliminado de Supabase:', pedidoId || codigo);
      return true;
    } catch(e) {
      console.warn('Aviso: error eliminando pedido en Supabase:', e);
      return false;
    }
  }

  async function guardarVentasNube(ventasArray){
    if (!client || !Array.isArray(ventasArray) || ventasArray.length === 0) return;
    try {
      const payload = ventasArray.map(v => ({
        id: v.id,
        fecha: v.fecha,
        producto_id: (v.productoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.productoId)) ? v.productoId : null,
        producto_nombre: v.productoNombre,
        categoria: v.categoria || 'Encargos',
        cantidad: Number(v.cantidad) || 1,
        precio_unitario: Number(v.precioUnitario) || 0,
        total: Number(v.total) || 0,
        medio_pago: v.medioPago || 'Transferencia',
        pedido_id: (v.pedidoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.pedidoId)) ? v.pedidoId : null
      }));
      const { error } = await client.from('ventas').insert(payload);
      if (error) {
        console.error('Error guardando ventas en Supabase:', error);
      } else {
        console.log('✓ Ventas sincronizadas en Supabase:', payload.length);
      }
    } catch(e) {
      console.warn('Aviso: no se pudo sincronizar ventas en Supabase:', e);
    }
  }

  async function eliminarVentasPedidoNube(pedidoId){
    if (!client || !pedidoId) return;
    try {
      const { error } = await client.from('ventas').delete().eq('pedido_id', pedidoId);
      if (error) {
        console.error('Error eliminando ventas vinculadas en Supabase:', error);
      } else {
        console.log('✓ Ventas de pedido eliminadas de Supabase:', pedidoId);
      }
    } catch(e) {
      console.warn('Aviso: error eliminando ventas vinculadas en Supabase:', e);
    }
  }

  async function limpiarPedidosYVentasNube(){
    if (!client) return;
    try {
      await client.from('pedido_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await client.from('pedidos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await client.from('ventas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('✓ Pedidos y ventas de prueba limpiados en Supabase');
    } catch(e) {
      console.warn('Aviso limpiando pedidos en Supabase:', e);
    }
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
    actualizarPedidoNube,
    actualizarPedido: actualizarPedidoNube,
    eliminarPedidoNube,
    eliminarPedido: eliminarPedidoNube,
    guardarVentasNube,
    eliminarVentasPedidoNube,
    limpiarPedidosYVentasNube,
    sincronizarPedidos,
    reproducirCampana,
    get isConnected(){ return isConnected; },
    get client(){ return client; }
  };
})();

document.addEventListener('DOMContentLoaded', SupabaseBridge.init);
