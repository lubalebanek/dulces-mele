/* ============================================================
   GESTOR DE PASTELERÍA — storage.js
   Capa de persistencia. Todo el acceso a localStorage pasa por
   aquí. Si en el futuro se migra a una base de datos real, sólo
   hay que reescribir las funciones de este archivo: el resto de
   la aplicación (ventas.js, productos.js, etc.) sigue funcionando
   igual porque llama siempre a Storage.get()/Storage.save().
   ============================================================ */

const Storage = (() => {

  // Claves usadas en localStorage. Mantenerlas centralizadas aquí
  // facilita el día de mañana migrar a una base de datos real.
  const KEYS = {
    productos: 'gp_productos',
    ventas: 'gp_ventas',
    insumos: 'gp_insumos',
    movimientosInventario: 'gp_movimientosInventario',
    gastos: 'gp_gastos',
    pedidos: 'gp_pedidos',
    recetas: 'gp_recetas',
    configuracion: 'gp_configuracion',
    seedApplied: 'gp_seedApplied' // evita volver a insertar datos de ejemplo tras borrarlos
  };

  function generateId(prefix){
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try {
        return crypto.randomUUID();
      } catch(e){}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function get(key){
    try{
      const raw = localStorage.getItem(KEYS[key]);
      let data = raw ? JSON.parse(raw) : (key === 'configuracion' ? defaultConfig() : []);
      if (key === 'configuracion') {
        data = { ...defaultConfig(), ...(raw ? JSON.parse(raw) : {}) };
      }
      
      // Migración suave: asegurar tipoStock y stockActual en productos existentes
      if (key === 'productos' && Array.isArray(data)){
        let changed = false;
        data = data.map(p => {
          let updated = { ...p };
          if (!updated.tipoStock){
            updated.tipoStock = updated.categoria === 'Tortas' ? 'a_pedido' : 'terminado';
            changed = true;
          }
          if (updated.stockActual === undefined){
            updated.stockActual = updated.tipoStock === 'a_pedido' ? 0 : 15;
            changed = true;
          }
          return updated;
        });
        if (changed) save('productos', data);
      }
      return data;
    }catch(e){
      console.error('Error leyendo', key, e);
      return key === 'configuracion' ? defaultConfig() : [];
    }
  }

  function save(key, data){
    try{
      localStorage.setItem(KEYS[key], JSON.stringify(data));
      return true;
    }catch(e){
      console.error('Error guardando', key, e);
      App.toast('No se pudo guardar. Es posible que el almacenamiento esté lleno.', 'error');
      return false;
    }
  }

  function defaultConfig(){
    return {
      permitirStockNegativo: false,
      nombreNegocio: 'Dulces Mele',
      moneda: 'CLP',
      telefonoWhatsApp: '+56964790920',
      datosTransferencia: 'Nombre: Andrea Lebanek / Rut: 14.738.359-2 /Banco Estado / Cuenta RUT',
      cuposDiariosTortas: 5,
      tiendaActiva: true,
      mensajeCierre: 'Por el momento los pedidos online están cerrados. La compra se debe realizar de manera presencial en nuestro local.',
      fechaLimitePedidos: '',
      horarioCorte: '',
      diasEntregaPermitidos: [4], // 4 = Jueves
      direccionLocal: 'Francisco Ramírez 10',
      horarioAtencionLocal: '10:00 a 19:00 hrs',
      supabaseUrl: 'https://mdbftytjmpvakibgdavt.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kYmZ0eXRqbXB2YWtpYmdkYXZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNjAwOTcsImV4cCI6MjEwNzczNjA5N30.k-0H5RZsCHIPT4LUy-D-eRMQ9xQsLyJUtIS-B7nR9H4'
    };
  }

  /* ---------------- Datos de ejemplo (DESACTIVADOS) ----------------
     La aplicación utiliza Supabase como fuente de verdad única.
     No se insertan datos de ejemplo ni semillas locales para evitar
     que se mezclen con la información real de Dulces Mele.
  ----------------------------------------------------------------- */
  function applySeedIfNeeded(){
    try {
      localStorage.setItem(KEYS.seedApplied, '1');
      localStorage.setItem('gp_pasteleriaSeedApplied', '1');
    } catch(e){}
  }

  function todayISO(){
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  function init(){
    if (!localStorage.getItem(KEYS.configuracion)){
      save('configuracion', defaultConfig());
    } else {
      // FORZAR ACTUALIZACIÓN PARA DISPOSITIVOS QUE YA TENÍAN LA APP ABIERTA
      const cfg = get('configuracion');
      const def = defaultConfig();
      cfg.telefonoWhatsApp = def.telefonoWhatsApp;
      cfg.datosTransferencia = def.datosTransferencia;
      cfg.supabaseUrl = def.supabaseUrl;
      cfg.supabaseAnonKey = def.supabaseAnonKey;
      save('configuracion', cfg);
    }

    // Asegurar que las banderas de semilla queden fijadas para evitar cualquier re-inserción
    localStorage.setItem(KEYS.seedApplied, '1');
    localStorage.setItem('gp_pasteleriaSeedApplied', '1');

    // LIMPIEZA ACTIVA INMEDIATA DE DATOS DEMO / EJEMPLO EN ESTE NAVEGADOR
    // 1. Pedidos demo (ej: Camila Rojas DM-101)
    const pedidosActuales = get('pedidos');
    if (Array.isArray(pedidosActuales)) {
      const pedidosLimpios = pedidosActuales.filter(p => !p.demo && p.clienteNombre !== 'Camila Rojas' && p.codigo !== 'DM-101');
      if (pedidosLimpios.length !== pedidosActuales.length) {
        save('pedidos', pedidosLimpios);
      }
    }

    // 2. Ventas demo (ej: "Venta de ejemplo — puedes eliminarla")
    const ventasActuales = get('ventas');
    if (Array.isArray(ventasActuales)) {
      const ventasLimpias = ventasActuales.filter(v => !v.demo && !(v.observaciones || '').includes('Venta de ejemplo') && !(v.observaciones || '').includes('Camila Rojas'));
      if (ventasLimpias.length !== ventasActuales.length) {
        save('ventas', ventasLimpias);
      }
    }

    // 3. Insumos demo o de ejemplo del catálogo base
    const insumosActuales = get('insumos');
    if (Array.isArray(insumosActuales)) {
      const demoInsumoNombres = [
        'harina sin polvos', 'azúcar granulada', 'azucar granulada', 'mantequilla sin sal',
        'huevos de campo', 'manjar repostero casero', 'crema para batir 35%',
        'leche condensada (tarro 395g)', 'leche evaporada (tarro 400g)', 'leche entera',
        'nueces mariposa seleccionadas', 'maicena / almidón de maíz', 'maicena / almidon de maiz',
        'cacao amargo 100%', 'mantequilla de maní natural', 'mantequilla de mani natural',
        'chocolate cobertura blanco', 'polvos de hornear', 'esencia de vainilla pura',
        'caja para torta grande + blonda', 'bolsitas celofán + sticker para galletas',
        'bolsitas celofan + sticker para galletas', 'harina (ejemplo)'
      ];
      const insumosLimpios = insumosActuales.filter(i => 
        !i.demo && !demoInsumoNombres.includes((i.nombre || '').toLowerCase().trim())
      );
      if (insumosLimpios.length !== insumosActuales.length) {
        save('insumos', insumosLimpios);
      }
    }

    // 4. Productos obsoletos o de ejemplo (tortas base de ejemplo)
    const prodsActuales = get('productos');
    if (Array.isArray(prodsActuales)) {
      const demoProdNombres = [
        'torta nogada', 'torta tres leches', 'torta tiramisú', 'torta tiramisu',
        'torta amor', 'torta bariloche', 'torta trasnochada', 'torta manjar nuez'
      ];
      const prodsLimpios = prodsActuales.filter(p => 
        !p.demo && 
        !demoProdNombres.includes((p.nombre || '').toLowerCase().trim()) &&
        !(p.nombre || '').toLowerCase().includes('frambuesa chocolate blanco')
      );
      if (prodsLimpios.length !== prodsActuales.length) {
        save('productos', prodsLimpios);
      }
    }

    // 5. Movimientos demo
    const movsActuales = get('movimientosInventario');
    if (Array.isArray(movsActuales)) {
      const movsLimpios = movsActuales.filter(m => !m.demo && !(m.motivo || '').includes('ejemplo'));
      if (movsLimpios.length !== movsActuales.length) {
        save('movimientosInventario', movsLimpios);
      }
    }
  }

  function exportBackup(){
    const backup = {
      version: 2,
      exportadoEl: new Date().toISOString(),
      productos: get('productos'),
      ventas: get('ventas'),
      insumos: get('insumos'),
      movimientosInventario: get('movimientosInventario'),
      gastos: get('gastos'),
      pedidos: get('pedidos'),
      recetas: get('recetas'),
      configuracion: get('configuracion')
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fecha = todayISO();
    a.href = url;
    a.download = `respaldo-gestor-pasteleria-${fecha}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importBackup(fileContent){
    let data;
    try{
      data = JSON.parse(fileContent);
    }catch(e){
      throw new Error('El archivo no es un JSON válido.');
    }
    const requiredKeys = ['productos','ventas','insumos','movimientosInventario','gastos'];
    for (const k of requiredKeys){
      if (!Array.isArray(data[k])) throw new Error(`El respaldo no tiene el formato esperado (falta "${k}").`);
    }
    save('productos', data.productos);
    save('ventas', data.ventas);
    save('insumos', data.insumos);
    save('movimientosInventario', data.movimientosInventario);
    save('gastos', data.gastos);
    if (Array.isArray(data.pedidos)) save('pedidos', data.pedidos);
    if (Array.isArray(data.recetas)) save('recetas', data.recetas);
    if (data.configuracion) save('configuracion', data.configuracion);
    localStorage.setItem(KEYS.seedApplied, '1');
  }

  function eraseAll(){
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    save('configuracion', defaultConfig());
    save('productos', []);
    save('ventas', []);
    save('insumos', []);
    save('movimientosInventario', []);
    save('gastos', []);
    save('pedidos', []);
    save('recetas', []);
    localStorage.setItem(KEYS.seedApplied, '1'); // no reinsertar demo automáticamente tras un borrado intencional
    localStorage.setItem('gp_pasteleriaSeedApplied', '1');
  }

  function limpiarPedidosYVentas(){
    save('pedidos', []);
    save('ventas', []);
    return true;
  }

  function vaciarInventario(){
    save('insumos', []);
    save('movimientosInventario', []);
    localStorage.setItem('gp_pasteleriaSeedApplied', '1');
    return true;
  }

  /* ---------------- Métodos para Pedidos y Stock ---------------- */
  function descontarStockProducto(productoId, cantidad){
    const productos = get('productos');
    const idx = productos.findIndex(p => p.id === productoId);
    if (idx !== -1 && productos[idx].tipoStock === 'terminado'){
      productos[idx].stockActual = Math.max(0, (Number(productos[idx].stockActual) || 0) - Number(cantidad));
      save('productos', productos);
      if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.actualizarStockProductoNube === 'function') {
        SupabaseBridge.actualizarStockProductoNube(productos[idx].id, productos[idx].stockActual);
      }
      return true;
    }
    return false;
  }

  function restaurarStockProducto(productoId, cantidad){
    const productos = get('productos');
    const idx = productos.findIndex(p => p.id === productoId);
    if (idx !== -1 && productos[idx].tipoStock === 'terminado'){
      productos[idx].stockActual = (Number(productos[idx].stockActual) || 0) + Number(cantidad);
      save('productos', productos);
      if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.actualizarStockProductoNube === 'function') {
        SupabaseBridge.actualizarStockProductoNube(productos[idx].id, productos[idx].stockActual);
      }
      return true;
    }
    return false;
  }

  function eliminarProducto(id){
    const productos = get('productos');
    const prod = productos.find(p => p.id === id);
    const nombre = prod ? prod.nombre : null;

    save('productos', productos.filter(p => p.id !== id));
    eliminarReceta(id);

    if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.eliminarProductoNube === 'function') {
      SupabaseBridge.eliminarProductoNube(id, nombre);
    }
  }

function crearPedido({
    clienteNombre, clienteTelefono, clienteEmail = '', tipoEntrega = 'retiro',
    direccionDespacho = '', fechaEntrega, horaEntrega = '', notas = '',
    total, abono = 0, medioPago = 'Transferencia', origen = 'manual',
    items = []
  }){
    const pedidos = get('pedidos');
    
    // 👇 SOLUCIÓN: Generar un código aleatorio de 4 dígitos para que nunca choquen
    const codigo = `DM-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const abonoNum = Number(abono) || 0;
    const totalNum = Number(total) || 0;
    const saldoPendiente = Math.max(0, totalNum - abonoNum);

    const nuevoPedido = {
      id: generateId('ped'),
      codigo,
      clienteNombre,
      clienteTelefono,
      clienteEmail,
      tipoEntrega,
      direccionDespacho,
      fechaEntrega,
      horaEntrega,
      notas,
      total: totalNum,
      abono: abonoNum,
      saldoPendiente,
      medioPago,
      estado: 'pendiente',
      origen,
      items,
      creadoEn: Date.now()
    };

    // Descontar stock de productos terminados
    items.forEach(item => {
      if (item.tipoStock === 'terminado' && item.productoId){
        descontarStockProducto(item.productoId, item.cantidad);
      }
    });

    pedidos.unshift(nuevoPedido);
    save('pedidos', pedidos);
    return nuevoPedido;
  }

  function registrarPedidoEnVentas(pedido){
    if (!pedido || !pedido.items || pedido.items.length === 0) return false;
    const ventas = get('ventas');
    
    // Evitar duplicados revisando pedidoId o pedidoCodigo
    const yaExiste = ventas.some(v => v.pedidoId === pedido.id || (v.pedidoCodigo && pedido.codigo && v.pedidoCodigo === pedido.codigo));
    if (yaExiste) return true;

    const nuevasVentas = [];
    pedido.items.forEach(item => {
      const v = {
        id: generateId('venta'),
        fecha: pedido.fechaEntrega || todayISO(),
        productoId: item.productoId || null,
        productoNombre: item.nombre || 'Producto sin nombre',
        categoria: item.categoria || (pedido.tipoEntrega === 'despacho' ? 'Despacho' : 'Encargos'),
        cantidad: Number(item.cantidad) || 1,
        precioUnitario: Number(item.precioUnitario) || 0,
        total: Number(item.subtotal) || (Number(item.cantidad) * Number(item.precioUnitario)),
        medioPago: pedido.medioPago || 'Transferencia',
        observaciones: `Pedido #${pedido.codigo || ''} — Cliente: ${pedido.clienteNombre || ''}`,
        pedidoId: pedido.id,
        pedidoCodigo: pedido.codigo || '',
        origen: 'pedido_web',
        creadoEn: Date.now()
      };
      ventas.push(v);
      nuevasVentas.push(v);
    });

    save('ventas', ventas);

    // Marcar en memoria del pedido
    const pedidos = get('pedidos');
    const idx = pedidos.findIndex(p => p.id === pedido.id);
    if (idx !== -1) {
      pedidos[idx].registradoEnVentas = true;
      save('pedidos', pedidos);
    }

    // Sincronizar con Supabase si está disponible
    if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.guardarVentasNube === 'function') {
      SupabaseBridge.guardarVentasNube(nuevasVentas);
    }

    return true;
  }

  function removerPedidoDeVentas(pedidoId){
    if (!pedidoId) return;
    const ventas = get('ventas');
    const filtradas = ventas.filter(v => v.pedidoId !== pedidoId);
    save('ventas', filtradas);

    const pedidos = get('pedidos');
    const idx = pedidos.findIndex(p => p.id === pedidoId);
    if (idx !== -1) {
      pedidos[idx].registradoEnVentas = false;
      save('pedidos', pedidos);
    }

    if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.eliminarVentasPedidoNube === 'function') {
      SupabaseBridge.eliminarVentasPedidoNube(pedidoId);
    }
  }

  function marcarPedidoPagado(id, medioPago = null){
    const pedidos = get('pedidos');
    const p = pedidos.find(item => item.id === id);
    if (!p) return null;

    const cambios = {
      abono: Number(p.total) || 0,
      saldoPendiente: 0,
      pagado: true,
      registrarComoVenta: true
    };
    if (medioPago) cambios.medioPago = medioPago;

    return actualizarPedido(id, cambios);
  }

  function marcarPedidoPorPagar(id){
    const pedidos = get('pedidos');
    const p = pedidos.find(item => item.id === id);
    if (!p) return null;

    removerPedidoDeVentas(id);

    const cambios = {
      abono: 0,
      saldoPendiente: Number(p.total) || 0,
      pagado: false,
      registradoEnVentas: false
    };

    return actualizarPedido(id, cambios);
  }

  function actualizarPedido(id, cambios){
    const pedidos = get('pedidos');
    const idx = pedidos.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const anterior = pedidos[idx];
    const actualizado = { ...anterior, ...cambios };

    // Si cambió abono o total, recalcular saldo y estado pagado
    if ('abono' in cambios || 'total' in cambios){
      const totalNum = Number(actualizado.total) || 0;
      const abonoNum = Number(actualizado.abono) || 0;
      actualizado.saldoPendiente = Math.max(0, totalNum - abonoNum);
      actualizado.pagado = actualizado.saldoPendiente === 0;
    }

    // Si se cancela el pedido, restaurar stock de productos terminados y remover ventas
    if (cambios.estado === 'cancelado' && anterior.estado !== 'cancelado'){
      actualizado.items.forEach(item => {
        if (item.tipoStock === 'terminado' && item.productoId){
          restaurarStockProducto(item.productoId, item.cantidad);
        }
      });
      removerPedidoDeVentas(id);
      actualizado.registradoEnVentas = false;
    }

    // Si se marca para registrar en ventas o si pasa a pagado/entregado con registrarComoVenta
    if (cambios.registrarComoVenta || (cambios.pagado && cambios.registrarComoVenta !== false)){
      registrarPedidoEnVentas(actualizado);
      actualizado.registradoEnVentas = true;
    }

    pedidos[idx] = actualizado;
    save('pedidos', pedidos);

    // Sincronizar en la nube si está conectado
    if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.actualizarPedidoNube === 'function') {
      SupabaseBridge.actualizarPedidoNube(actualizado);
    }

    return actualizado;
  }

  function eliminarPedido(id){
    const pedidos = get('pedidos');
    const p = pedidos.find(item => item.id === id);
    const codigo = p ? p.codigo : null;

    removerPedidoDeVentas(id);
    const filtrados = pedidos.filter(p => p.id !== id);
    save('pedidos', filtrados);

    if (typeof SupabaseBridge !== 'undefined') {
      if (typeof SupabaseBridge.eliminarPedidoNube === 'function') {
        SupabaseBridge.eliminarPedidoNube(id, codigo);
      } else if (typeof SupabaseBridge.eliminarPedido === 'function') {
        SupabaseBridge.eliminarPedido(id, codigo);
      }
    }
  }

  /* ---------------- Escandallo, Recetas y Costeo ---------------- */
  function seedPasteleriaSiCorresponde(forzar = false){
    // Desactivado: los insumos y recetas se leen y sincronizan directamente desde Supabase.
    try {
      localStorage.setItem('gp_pasteleriaSeedApplied', '1');
    } catch(e){}
    return;
  }

  function convertirUnidad(cantidad, unidadOrigen, unidadDestino){
    if (!cantidad || isNaN(cantidad)) return 0;
    cantidad = Number(cantidad);
    if (!unidadOrigen || !unidadDestino) return cantidad;
    
    const uOrg = String(unidadOrigen).toLowerCase().trim();
    const uDst = String(unidadDestino).toLowerCase().trim();
    if (uOrg === uDst) return cantidad;

    // Masa / Peso
    if (uOrg === 'g' && uDst === 'kg') return cantidad / 1000;
    if (uOrg === 'kg' && uDst === 'g') return cantidad * 1000;
    if (uOrg === 'mg' && uDst === 'g') return cantidad / 1000;
    if (uOrg === 'mg' && uDst === 'kg') return cantidad / 1000000;
    
    // Volumen
    if ((uOrg === 'ml' || uOrg === 'cc') && (uDst === 'litro' || uDst === 'l' || uDst === 'lt')) return cantidad / 1000;
    if ((uOrg === 'litro' || uOrg === 'l' || uOrg === 'lt') && (uDst === 'ml' || uDst === 'cc')) return cantidad * 1000;

    // Directo
    return cantidad;
  }

  function getReceta(productoId){
    const recetas = get('recetas');
    return recetas.find(r => r.productoId === productoId) || null;
  }

  function saveReceta(productoId, datosReceta){
    const recetas = get('recetas');
    const idx = recetas.findIndex(r => r.productoId === productoId);
    const receta = {
      id: idx !== -1 ? recetas[idx].id : generateId('rec'),
      productoId,
      rendimiento: Math.max(1, Number(datosReceta.rendimiento) || 1),
      unidadRendimiento: datosReceta.unidadRendimiento || 'unidad',
      costoEmpaque: Number(datosReceta.costoEmpaque) || 0,
      otrosCostos: Number(datosReceta.otrosCostos) || 0,
      margenDeseado: Number(datosReceta.margenDeseado) || 60,
      instrucciones: datosReceta.instrucciones || '',
      ingredientes: Array.isArray(datosReceta.ingredientes) ? datosReceta.ingredientes : [],
      actualizadoEn: Date.now()
    };
    if (idx !== -1){
      recetas[idx] = receta;
    } else {
      recetas.push(receta);
    }
    save('recetas', recetas);

    if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.guardarRecetaNube === 'function') {
      SupabaseBridge.guardarRecetaNube(receta);
    }

    return receta;
  }

  function eliminarReceta(productoId){
    const recetas = get('recetas');
    save('recetas', recetas.filter(r => r.productoId !== productoId));
    if (typeof SupabaseBridge !== 'undefined' && typeof SupabaseBridge.eliminarRecetaNube === 'function') {
      SupabaseBridge.eliminarRecetaNube(productoId);
    }
  }

  function calcularCostoReceta(productoId){
    const productos = get('productos');
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return null;

    const recetas = get('recetas');
    const receta = recetas.find(r => r.productoId === productoId);
    const insumos = get('insumos');

    if (!receta || !Array.isArray(receta.ingredientes) || receta.ingredientes.length === 0){
      return {
        tieneReceta: false,
        receta: null,
        producto,
        rendimiento: 1,
        unidadRendimiento: producto.unidadVenta || 'unidad',
        items: [],
        costoIngredientesTotal: 0,
        costoIngredientesPorUnidad: 0,
        costoEmpaque: 0,
        otrosCostos: 0,
        otrosCostosPorUnidad: 0,
        costoTotalPorUnidad: 0,
        costoTotalLote: 0,
        precioVenta: Number(producto.precioVenta) || 0,
        gananciaPorUnidad: Number(producto.precioVenta) || 0,
        margenPorcentaje: 0,
        margenDeseado: 60,
        precioSugerido: 0,
        maxLotesPosibles: 0,
        maxUnidadesPosibles: 0
      };
    }

    const rendimiento = Math.max(1, Number(receta.rendimiento) || 1);
    const costoEmpaque = Number(receta.costoEmpaque) || 0;
    const otrosCostos = Number(receta.otrosCostos) || 0;
    const margenDeseado = Number(receta.margenDeseado) || 60;

    let costoIngredientesTotal = 0;
    let maxLotesPosibles = Infinity;

    const items = receta.ingredientes.map(ing => {
      const insumo = insumos.find(i => i.id === ing.insumoId);
      if (!insumo){
        return {
          insumoId: ing.insumoId,
          nombre: 'Insumo no encontrado o eliminado',
          categoria: '—',
          cantidad: Number(ing.cantidad) || 0,
          unidad: ing.unidad || 'unidad',
          unidadInsumo: 'unidad',
          cantidadEnUnidadInsumo: 0,
          costoUnitarioInsumo: 0,
          costoItemTotal: 0,
          costoItemPorUnidad: 0,
          stockActual: 0,
          stockSuficiente: false
        };
      }

      const cantidadReceta = Number(ing.cantidad) || 0;
      const cantidadEnUnidadInsumo = convertirUnidad(cantidadReceta, ing.unidad, insumo.unidadMedida);
      const costoUnitarioInsumo = Number(insumo.costoUnitario) || 0;
      const costoItemTotal = Math.round(cantidadEnUnidadInsumo * costoUnitarioInsumo);
      const costoItemPorUnidad = Math.round(costoItemTotal / rendimiento);

      costoIngredientesTotal += costoItemTotal;

      const stockActual = Number(insumo.stockActual) || 0;
      const lotesConStock = cantidadEnUnidadInsumo > 0 ? (stockActual / cantidadEnUnidadInsumo) : Infinity;
      if (lotesConStock < maxLotesPosibles) maxLotesPosibles = lotesConStock;

      return {
        insumoId: insumo.id,
        nombre: insumo.nombre,
        categoria: insumo.categoria,
        cantidad: cantidadReceta,
        unidad: ing.unidad,
        unidadInsumo: insumo.unidadMedida,
        cantidadEnUnidadInsumo,
        costoUnitarioInsumo,
        costoItemTotal,
        costoItemPorUnidad,
        stockActual,
        stockSuficiente: stockActual >= cantidadEnUnidadInsumo
      };
    });

    const costoIngredientesPorUnidad = Math.round(costoIngredientesTotal / rendimiento);
    const otrosCostosPorUnidad = Math.round(otrosCostos / rendimiento);
    const costoTotalPorUnidad = Math.round(costoIngredientesPorUnidad + costoEmpaque + otrosCostosPorUnidad);
    const costoTotalLote = Math.round(costoIngredientesTotal + (costoEmpaque * rendimiento) + otrosCostos);

    const precioVenta = Number(producto.precioVenta) || 0;
    const gananciaPorUnidad = precioVenta - costoTotalPorUnidad;
    const margenPorcentaje = precioVenta > 0 ? Math.round(((precioVenta - costoTotalPorUnidad) / precioVenta) * 100) : 0;

    const factor = (100 - margenDeseado) / 100;
    const precioSugerido = factor > 0 ? Math.round(costoTotalPorUnidad / factor) : 0;

    const lotesCalculados = maxLotesPosibles === Infinity ? 0 : Math.floor(Math.max(0, maxLotesPosibles));
    const unidadesCalculadas = lotesCalculados * rendimiento;

    return {
      tieneReceta: true,
      receta,
      producto,
      rendimiento,
      unidadRendimiento: receta.unidadRendimiento || 'unidad',
      costoEmpaque,
      otrosCostos,
      otrosCostosPorUnidad,
      margenDeseado,
      instrucciones: receta.instrucciones || '',
      items,
      costoIngredientesTotal,
      costoIngredientesPorUnidad,
      costoTotalPorUnidad,
      costoTotalLote,
      precioVenta,
      gananciaPorUnidad,
      margenPorcentaje,
      precioSugerido,
      maxLotesPosibles: lotesCalculados,
      maxUnidadesPosibles: unidadesCalculadas
    };
  }

  function producirLote({ productoId, cantidadAProducir, motivo = '' }){
    const productos = get('productos');
    const prodIdx = productos.findIndex(p => p.id === productoId);
    if (prodIdx === -1) throw new Error('Producto no encontrado');
    const producto = productos[prodIdx];

    const recetas = get('recetas');
    const receta = recetas.find(r => r.productoId === productoId);
    if (!receta || !Array.isArray(receta.ingredientes) || receta.ingredientes.length === 0){
      throw new Error('El producto no tiene una receta con ingredientes configurada');
    }

    const cantidad = Number(cantidadAProducir);
    if (!cantidad || cantidad <= 0) throw new Error('La cantidad a producir debe ser mayor a 0');

    const rendimiento = Math.max(1, Number(receta.rendimiento) || 1);
    const factor = cantidad / rendimiento;

    const insumos = get('insumos');
    const config = get('configuracion');

    // Comprobar stock de insumos
    const faltantes = [];
    receta.ingredientes.forEach(ing => {
      const insumo = insumos.find(i => i.id === ing.insumoId);
      if (!insumo) return;
      const cantNecesaria = convertirUnidad((Number(ing.cantidad) || 0) * factor, ing.unidad, insumo.unidadMedida);
      if (insumo.stockActual < cantNecesaria && !config.permitirStockNegativo){
        faltantes.push(`${insumo.nombre}: requieres ${cantNecesaria.toFixed(2)} ${insumo.unidadMedida}, pero sólo hay ${insumo.stockActual} en bodega`);
      }
    });

    if (faltantes.length > 0){
      throw new Error(`Stock insuficiente en bodega:\n• ${faltantes.join('\n• ')}`);
    }

    // Descontar cada ingrediente y registrar movimiento
    const movimientos = get('movimientosInventario');
    const fechaHoy = todayISO();
    const detalleMovimientos = [];

    receta.ingredientes.forEach(ing => {
      const idx = insumos.findIndex(i => i.id === ing.insumoId);
      if (idx === -1) return;
      const insumo = insumos[idx];
      const cantADescontar = convertirUnidad((Number(ing.cantidad) || 0) * factor, ing.unidad, insumo.unidadMedida);
      const costoUnit = Number(insumo.costoUnitario) || 0;
      const costoTotalIng = Math.round(cantADescontar * costoUnit);

      insumo.stockActual = Math.max(0, Number((insumo.stockActual - cantADescontar).toFixed(4)));

      const nuevoMov = {
        id: generateId('mov'),
        fecha: fechaHoy,
        insumoId: insumo.id,
        insumoNombre: insumo.nombre,
        tipo: 'salida',
        cantidad: Number(cantADescontar.toFixed(3)),
        costo: costoTotalIng,
        motivo: motivo || `Hornada/Producción: ${cantidad} ${producto.nombre}`,
        creadoEn: Date.now()
      };
      movimientos.push(nuevoMov);
      detalleMovimientos.push(nuevoMov);
    });

    save('insumos', insumos);
    save('movimientosInventario', movimientos);

    // Si el producto es de vitrina / stock terminado, sumar las unidades producidas
    const stockAnterior = Number(producto.stockActual) || 0;
    const esTerminado = producto.tipoStock === 'terminado';
    if (esTerminado){
      producto.stockActual = stockAnterior + cantidad;
      productos[prodIdx] = producto;
      save('productos', productos);
    }

    if (typeof SupabaseBridge !== 'undefined') {
      try {
        receta.ingredientes.forEach(ing => {
          const ins = insumos.find(i => i.id === ing.insumoId);
          if (ins && typeof SupabaseBridge.guardarInsumoNube === 'function') {
            SupabaseBridge.guardarInsumoNube(ins);
          }
        });
        detalleMovimientos.forEach(m => {
          if (typeof SupabaseBridge.guardarMovimientoNube === 'function') {
            SupabaseBridge.guardarMovimientoNube(m);
          }
        });
        if (esTerminado && typeof SupabaseBridge.actualizarStockProductoNube === 'function') {
          SupabaseBridge.actualizarStockProductoNube(producto.id, producto.stockActual);
        }
      } catch(e) {
        console.warn('Error sincronizando hornada con Supabase:', e);
      }
    }

    return {
      producto,
      cantidadProducida: cantidad,
      stockAnterior,
      stockNuevo: producto.stockActual,
      esTerminado,
      movimientos: detalleMovimientos
    };
  }

  return {
    get, save, generateId, init, exportBackup, importBackup, eraseAll, todayISO,
    crearPedido, actualizarPedido, eliminarPedido,
    marcarPedidoPagado, marcarPedidoPorPagar, registrarPedidoEnVentas, removerPedidoDeVentas,
    limpiarPedidosYVentas, vaciarInventario,
    descontarStockProducto, restaurarStockProducto, eliminarProducto,
    seedPasteleriaSiCorresponde, convertirUnidad, getReceta, saveReceta, eliminarReceta,
    calcularCostoReceta, producirLote
  };
})();
