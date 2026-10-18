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
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function get(key){
    try{
      const raw = localStorage.getItem(KEYS[key]);
      let data = raw ? JSON.parse(raw) : (key === 'configuracion' ? defaultConfig() : []);
      
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
      supabaseUrl: 'https://mdbftytjmpvakibgdavt.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kYmZ0eXRqbXB2YWtpYmdkYXZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNjAwOTcsImV4cCI6MjEwNzczNjA5N30.k-0H5RZsCHIPT4LUy-D-eRMQ9xQsLyJUtIS-B7nR9H4'
    };
  }

  /* ---------------- Datos de ejemplo ----------------
     Se insertan SOLO la primera vez que se abre la app (si no hay
     nada guardado) y quedan claramente marcados con demo:true para
     que el usuario pueda identificarlos y eliminarlos con confianza.
  --------------------------------------------------- */
  function applySeedIfNeeded(){
    const alreadyApplied = localStorage.getItem(KEYS.seedApplied);
    if (alreadyApplied) return;

    const productos = get('productos');
    if (productos.length === 0){
      const seedProductos = [
        { id: generateId('prod'), nombre: 'Torta tres leches', categoria: 'Tortas', precioVenta: 28000, unidadVenta: 'unidad', estado: 'activo', descripcion: '', demo: true },
        { id: generateId('prod'), nombre: 'Galletas de mantequilla de maní', categoria: 'Galletas', precioVenta: 800, unidadVenta: 'unidad', estado: 'activo', descripcion: '', demo: true }
      ];
      // Catálogo completo indicado por el usuario, sin marcar demo (son los productos reales del negocio)
      const catalogo = [
        ['Galletas de café','Galletas'], ['Galletas de membrillo','Galletas'],
        ['Galletas de mantequilla de maní','Galletas'], ['Galletas de coco','Galletas'],
        ['Galletas de frambuesa','Galletas'], ['Galletas de frambuesa chocolate blanco','Galletas'],
        ['Galletas de jengibre','Galletas'], ['Galletas de naranja','Galletas'],
        ['Galletas de limón','Galletas'], ['Galletas Chocomani','Galletas'],
        ['Galletas de nuez','Galletas'], ['Alfajores de maicena','Galletas'],
        ['Torta trasnochada','Tortas'], ['Torta manjar nuez','Tortas'],
        ['Torta nogada','Tortas'], ['Torta tres leches','Tortas'],
        ['Torta tiramisú','Tortas'], ['Torta amor','Tortas'],
        ['Torta Bariloche','Tortas']
      ];
      const productosReales = catalogo.map(([nombre, categoria]) => ({
        id: generateId('prod'),
        nombre, categoria,
        precioVenta: categoria === 'Tortas' ? 25000 : 800,
        unidadVenta: 'unidad',
        tipoStock: categoria === 'Tortas' ? 'a_pedido' : 'terminado',
        stockActual: categoria === 'Tortas' ? 0 : 20,
        stockMinimo: categoria === 'Tortas' ? 0 : 5,
        estado: 'activo',
        descripcion: '',
        demo: false
      }));
      save('productos', productosReales);

      // Un par de insumos y una venta de ejemplo, marcados demo:true
      const insumoDemo = { id: generateId('ins'), nombre: 'Harina (ejemplo)', categoria: 'Materias primas', unidadMedida: 'kg', stockActual: 5, stockMinimo: 3, costoUnitario: 1500, proveedor: 'Proveedor ejemplo', fechaUltimaCompra: todayISO(), estado: 'activo', demo: true };
      save('insumos', [insumoDemo]);

      const primerProducto = productosReales.find(p => p.nombre === 'Torta tres leches');
      const primerGalleta = productosReales.find(p => p.nombre === 'Alfajores de maicena');
      
      const ventaDemo = {
        id: generateId('venta'), fecha: todayISO(), productoId: primerProducto.id,
        productoNombre: primerProducto.nombre, categoria: primerProducto.categoria,
        cantidad: 1, precioUnitario: primerProducto.precioVenta, total: primerProducto.precioVenta,
        medioPago: 'Efectivo', observaciones: 'Venta de ejemplo — puedes eliminarla', demo: true
      };
      save('ventas', [ventaDemo]);

      // Pedido de ejemplo
      const pedidoDemo = {
        id: generateId('ped'),
        codigo: 'DM-101',
        clienteNombre: 'Camila Rojas',
        clienteTelefono: '+56987654321',
        clienteEmail: 'camila@ejemplo.cl',
        tipoEntrega: 'retiro',
        direccionDespacho: '',
        fechaEntrega: todayISO(),
        horaEntrega: '16:00',
        notas: 'Dedicatoria: ¡Feliz Cumpleaños Mamá!',
        items: [
          {
            productoId: primerProducto.id,
            nombre: primerProducto.nombre,
            precioUnitario: primerProducto.precioVenta,
            cantidad: 1,
            subtotal: primerProducto.precioVenta,
            tipoStock: 'a_pedido'
          },
          {
            productoId: primerGalleta.id,
            nombre: primerGalleta.nombre,
            precioUnitario: primerGalleta.precioVenta,
            cantidad: 6,
            subtotal: primerGalleta.precioVenta * 6,
            tipoStock: 'terminado'
          }
        ],
        total: primerProducto.precioVenta + (primerGalleta.precioVenta * 6),
        abono: 15000,
        saldoPendiente: (primerProducto.precioVenta + (primerGalleta.precioVenta * 6)) - 15000,
        medioPago: 'Transferencia',
        estado: 'en_preparacion',
        origen: 'web_cliente',
        creadoEn: Date.now(),
        demo: true
      };
      save('pedidos', [pedidoDemo]);
      save('recetas', []);
      save('gastos', []);
      save('movimientosInventario', []);
    }
    localStorage.setItem(KEYS.seedApplied, '1');
  }

  function todayISO(){
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  function init(){
    if (!localStorage.getItem(KEYS.configuracion)){
      save('configuracion', defaultConfig());
    }
    applySeedIfNeeded();
    seedPasteleriaSiCorresponde();
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
  }

  /* ---------------- Métodos para Pedidos y Stock ---------------- */
  function descontarStockProducto(productoId, cantidad){
    const productos = get('productos');
    const idx = productos.findIndex(p => p.id === productoId);
    if (idx !== -1 && productos[idx].tipoStock === 'terminado'){
      productos[idx].stockActual = Math.max(0, (Number(productos[idx].stockActual) || 0) - Number(cantidad));
      save('productos', productos);
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
      return true;
    }
    return false;
  }

  function crearPedido({
    clienteNombre, clienteTelefono, clienteEmail = '', tipoEntrega = 'retiro',
    direccionDespacho = '', fechaEntrega, horaEntrega = '', notas = '',
    total, abono = 0, medioPago = 'Transferencia', origen = 'manual',
    items = []
  }){
    const pedidos = get('pedidos');
    const correlativo = pedidos.length + 101;
    const codigo = `DM-${correlativo}`;
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

  function actualizarPedido(id, cambios){
    const pedidos = get('pedidos');
    const idx = pedidos.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const anterior = pedidos[idx];
    const actualizado = { ...anterior, ...cambios };

    // Si cambió abono o total, recalcular saldo
    if ('abono' in cambios || 'total' in cambios){
      actualizado.saldoPendiente = Math.max(0, (Number(actualizado.total) || 0) - (Number(actualizado.abono) || 0));
    }

    // Si se cancela el pedido, restaurar stock de productos terminados
    if (cambios.estado === 'cancelado' && anterior.estado !== 'cancelado'){
      actualizado.items.forEach(item => {
        if (item.tipoStock === 'terminado' && item.productoId){
          restaurarStockProducto(item.productoId, item.cantidad);
        }
      });
    }

    // Si pasa a entregado y no se había registrado como venta, registrar venta opcional
    if (cambios.estado === 'entregado' && anterior.estado !== 'entregado' && cambios.registrarComoVenta){
      const ventas = get('ventas');
      actualizado.items.forEach(item => {
        ventas.push({
          id: generateId('venta'),
          fecha: actualizado.fechaEntrega || todayISO(),
          productoId: item.productoId,
          productoNombre: item.nombre,
          categoria: 'Encargos',
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          total: item.subtotal,
          medioPago: actualizado.medioPago,
          observaciones: `Pedido ${actualizado.codigo} — Cliente: ${actualizado.clienteNombre}`,
          pedidoId: actualizado.id
        });
      });
      save('ventas', ventas);
    }

    pedidos[idx] = actualizado;
    save('pedidos', pedidos);
    return actualizado;
  }

  function eliminarPedido(id){
    const pedidos = get('pedidos');
    const filtrados = pedidos.filter(p => p.id !== id);
    save('pedidos', filtrados);
  }

  /* ---------------- Escandallo, Recetas y Costeo ---------------- */
  function seedPasteleriaSiCorresponde(forzar = false){
    try {
      let insumos = get('insumos');
      let recetas = get('recetas');
      const productos = get('productos');

      const catalogoInsumos = [
        { nombre: 'Harina sin polvos', categoria: 'Materias primas', unidadMedida: 'kg', stockActual: 15, stockMinimo: 5, costoUnitario: 1200, proveedor: 'Molino local' },
        { nombre: 'Azúcar granulada', categoria: 'Materias primas', unidadMedida: 'kg', stockActual: 12, stockMinimo: 4, costoUnitario: 1100, proveedor: 'Distribuidora Mayorista' },
        { nombre: 'Mantequilla sin sal', categoria: 'Materias primas', unidadMedida: 'kg', stockActual: 6, stockMinimo: 2, costoUnitario: 7800, proveedor: 'Lácteos del Sur' },
        { nombre: 'Huevos de campo', categoria: 'Materias primas', unidadMedida: 'unidad', stockActual: 60, stockMinimo: 20, costoUnitario: 220, proveedor: 'Granja Avícola' },
        { nombre: 'Manjar repostero casero', categoria: 'Ingredientes', unidadMedida: 'kg', stockActual: 8, stockMinimo: 3, costoUnitario: 4200, proveedor: 'Distribuidora Repostería' },
        { nombre: 'Crema para batir 35%', categoria: 'Materias primas', unidadMedida: 'litro', stockActual: 6, stockMinimo: 2, costoUnitario: 4500, proveedor: 'Lácteos del Sur' },
        { nombre: 'Leche condensada (tarro 395g)', categoria: 'Ingredientes', unidadMedida: 'unidad', stockActual: 12, stockMinimo: 4, costoUnitario: 1650, proveedor: 'Distribuidora Mayorista' },
        { nombre: 'Leche evaporada (tarro 400g)', categoria: 'Ingredientes', unidadMedida: 'unidad', stockActual: 12, stockMinimo: 4, costoUnitario: 1500, proveedor: 'Distribuidora Mayorista' },
        { nombre: 'Leche entera', categoria: 'Materias primas', unidadMedida: 'litro', stockActual: 10, stockMinimo: 4, costoUnitario: 1150, proveedor: 'Lácteos del Sur' },
        { nombre: 'Nueces mariposa seleccionadas', categoria: 'Ingredientes', unidadMedida: 'kg', stockActual: 3, stockMinimo: 1, costoUnitario: 9500, proveedor: 'Tostaduría' },
        { nombre: 'Maicena / Almidón de maíz', categoria: 'Materias primas', unidadMedida: 'kg', stockActual: 5, stockMinimo: 2, costoUnitario: 2400, proveedor: 'Distribuidora Repostería' },
        { nombre: 'Cacao amargo 100%', categoria: 'Ingredientes', unidadMedida: 'kg', stockActual: 2, stockMinimo: 1, costoUnitario: 8500, proveedor: 'Distribuidora Repostería' },
        { nombre: 'Mantequilla de maní natural', categoria: 'Ingredientes', unidadMedida: 'kg', stockActual: 3, stockMinimo: 1, costoUnitario: 5800, proveedor: 'Tostaduría' },
        { nombre: 'Chocolate cobertura blanco', categoria: 'Decoración', unidadMedida: 'kg', stockActual: 3, stockMinimo: 1, costoUnitario: 6900, proveedor: 'Distribuidora Repostería' },
        { nombre: 'Polvos de hornear', categoria: 'Materias primas', unidadMedida: 'kg', stockActual: 1, stockMinimo: 0.5, costoUnitario: 4000, proveedor: 'Distribuidora Repostería' },
        { nombre: 'Esencia de vainilla pura', categoria: 'Ingredientes', unidadMedida: 'litro', stockActual: 1, stockMinimo: 0.2, costoUnitario: 6000, proveedor: 'Distribuidora Repostería' },
        { nombre: 'Caja para torta grande + blonda', categoria: 'Embalaje', unidadMedida: 'unidad', stockActual: 30, stockMinimo: 10, costoUnitario: 1200, proveedor: 'Envases y Cartones' },
        { nombre: 'Bolsitas celofán + sticker para galletas', categoria: 'Embalaje', unidadMedida: 'unidad', stockActual: 120, stockMinimo: 30, costoUnitario: 50, proveedor: 'Envases y Cartones' }
      ];

      let insumosActualizados = false;
      if (forzar || insumos.length <= 1){
        catalogoInsumos.forEach(item => {
          const existe = insumos.find(i => i.nombre.toLowerCase().trim() === item.nombre.toLowerCase().trim());
          if (!existe){
            insumos.push({
              id: generateId('ins'),
              nombre: item.nombre,
              categoria: item.categoria,
              unidadMedida: item.unidadMedida,
              stockActual: item.stockActual,
              stockMinimo: item.stockMinimo,
              costoUnitario: item.costoUnitario,
              proveedor: item.proveedor,
              fechaUltimaCompra: todayISO(),
              estado: 'activo',
              demo: false
            });
            insumosActualizados = true;
          }
        });
        if (insumosActualizados){
          save('insumos', insumos);
        }
      }

      if (forzar || recetas.length === 0){
        const mapInsumo = (nombreParcial) => {
          const found = insumos.find(i => i.nombre.toLowerCase().includes(nombreParcial.toLowerCase()));
          return found ? found.id : null;
        };

        const tortaTresLeches = productos.find(p => p.nombre.toLowerCase().includes('tres leches'));
        if (tortaTresLeches && !recetas.some(r => r.productoId === tortaTresLeches.id)){
          recetas.push({
            id: generateId('rec'),
            productoId: tortaTresLeches.id,
            rendimiento: 1,
            unidadRendimiento: 'torta (20-22 cm / 15 porciones)',
            costoEmpaque: 1200,
            otrosCostos: 600,
            margenDeseado: 65,
            instrucciones: '1. Batir 5 claras a punto de nieve con la mitad del azúcar. En otro bowl, batir las 5 yemas con el resto del azúcar y vainilla.\n2. Incorporar con movimientos envolventes la harina cernida con los polvos de hornear.\n3. Hornear a 180°C por 30 minutos.\n4. Para el remojo de 3 leches: mezclar leche condensada, leche evaporada y crema de leche líquida.\n5. Bañar el bizcocho tibio lentamente con la mezcla de tres leches hasta que absorba todo.\n6. Refrigerar mínimo 6 horas antes de decorar con merengue o crema chantilly.',
            ingredientes: [
              { insumoId: mapInsumo('harina'), cantidad: 250, unidad: 'g' },
              { insumoId: mapInsumo('azúcar'), cantidad: 200, unidad: 'g' },
              { insumoId: mapInsumo('huevos'), cantidad: 5, unidad: 'unidad' },
              { insumoId: mapInsumo('polvos'), cantidad: 10, unidad: 'g' },
              { insumoId: mapInsumo('vainilla'), cantidad: 15, unidad: 'ml' },
              { insumoId: mapInsumo('condensada'), cantidad: 1, unidad: 'unidad' },
              { insumoId: mapInsumo('evaporada'), cantidad: 1, unidad: 'unidad' },
              { insumoId: mapInsumo('crema'), cantidad: 300, unidad: 'ml' }
            ].filter(i => i.insumoId),
            actualizadoEn: Date.now()
          });
        }

        const alfajores = productos.find(p => p.nombre.toLowerCase().includes('alfajores'));
        if (alfajores && !recetas.some(r => r.productoId === alfajores.id)){
          recetas.push({
            id: generateId('rec'),
            productoId: alfajores.id,
            rendimiento: 20,
            unidadRendimiento: 'alfajores',
            costoEmpaque: 50,
            otrosCostos: 400,
            margenDeseado: 65,
            instrucciones: '1. Batir 150g de mantequilla pomada con 100g de azúcar y vainilla.\n2. Agregar 2 yemas e incorporar suavemente.\n3. Tamizar 200g de maicena y 100g de harina con 5g de polvos de hornear.\n4. Formar una masa suave sin amasar en exceso. Dejar reposar en frío 20 min.\n5. Estirar a 5mm de grosor y cortar discos de 5cm.\n6. Hornear a 170°C por 10 a 12 min (deben quedar blancos en la superficie).\n7. Una vez fríos, rellenar generosamente con manjar repostero y pasar los bordes por coco rallado.',
            ingredientes: [
              { insumoId: mapInsumo('mantequilla'), cantidad: 150, unidad: 'g' },
              { insumoId: mapInsumo('azúcar'), cantidad: 100, unidad: 'g' },
              { insumoId: mapInsumo('huevos'), cantidad: 2, unidad: 'unidad' },
              { insumoId: mapInsumo('maicena'), cantidad: 200, unidad: 'g' },
              { insumoId: mapInsumo('harina'), cantidad: 100, unidad: 'g' },
              { insumoId: mapInsumo('polvos'), cantidad: 5, unidad: 'g' },
              { insumoId: mapInsumo('vainilla'), cantidad: 5, unidad: 'ml' },
              { insumoId: mapInsumo('manjar'), cantidad: 350, unidad: 'g' }
            ].filter(i => i.insumoId),
            actualizadoEn: Date.now()
          });
        }

        save('recetas', recetas);
      }
    } catch(err) {
      console.warn('Error en seedPasteleriaSiCorresponde:', err);
    }
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
    return receta;
  }

  function eliminarReceta(productoId){
    const recetas = get('recetas');
    save('recetas', recetas.filter(r => r.productoId !== productoId));
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
    if (producto.tipoStock === 'terminado'){
      producto.stockActual = stockAnterior + cantidad;
      productos[prodIdx] = producto;
      save('productos', productos);
    }

    return {
      producto,
      cantidadProducida: cantidad,
      stockAnterior,
      stockNuevo: producto.stockActual,
      esTerminado: producto.tipoStock === 'terminado',
      movimientos: detalleMovimientos
    };
  }

  return {
    get, save, generateId, init, exportBackup, importBackup, eraseAll, todayISO,
    crearPedido, actualizarPedido, eliminarPedido,
    descontarStockProducto, restaurarStockProducto,
    seedPasteleriaSiCorresponde, convertirUnidad, getReceta, saveReceta, eliminarReceta,
    calcularCostoReceta, producirLote
  };
})();
