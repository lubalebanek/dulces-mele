/* ============================================================
   GESTOR DE PASTELERÍA — supabase-client.js
   Sincronización en la nube con Supabase para Dulces Mele.
   ============================================================ */

const SupabaseBridge = (() => {
  let client = null;
  let isConnected = false;

  function esUUID(str){
    return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  function generarUUIDSeguro(){
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
    await sincronizarTodo();
    subscribirCambiosEnTiempoReal();
    return true;
  }

  async function sincronizarTodo(mostrarToast = false){
    if (!client) return null;
    try {
      console.log('🔄 Iniciando sincronización integral con Supabase...');
      const rCfg = await sincronizarConfiguracion();
      const rProd = await sincronizarProductos();
      const rIns = await sincronizarInsumos();
      const rRec = await sincronizarRecetas();
      const rGas = await sincronizarGastos();
      const rMov = await sincronizarMovimientosInventario();
      const rPed = await sincronizarPedidos();
      const rVen = await sincronizarVentas();

      console.log('✅ Sincronización integral con Supabase completada con éxito.');
      if (mostrarToast && window.App && typeof App.toast === 'function'){
        App.toast('☁️ Sincronización con la nube completada.');
      }
      return { config: rCfg, productos: rProd, insumos: rIns, recetas: rRec, gastos: rGas, movimientos: rMov, pedidos: rPed, ventas: rVen };
    } catch(err) {
      console.error('Error durante sincronización integral:', err);
      if (mostrarToast && window.App && typeof App.toast === 'function'){
        App.toast('Error sincronizando con la nube: ' + (err.message || 'revisa tu conexión'), 'error');
      }
      return null;
    }
  }

  async function fetchConfiguracion(){
    if (!client) return null;
    try {
      const { data, error } = await client.from('configuracion').select('*').eq('id', 'general').maybeSingle();
      if (error) {
        console.warn('Aviso leyendo configuración de Supabase:', error);
        return null;
      }
      return data;
    } catch(e) {
      console.warn('Error leyendo configuración de Supabase:', e);
      return null;
    }
  }

  async function guardarConfiguracionNube(configData){
    if (!client || !configData) return false;
    try {
      const payload = {
        id: 'general',
        nombre_negocio: configData.nombreNegocio || 'Dulces Mele',
        telefono_whatsapp: configData.telefonoWhatsApp || '+56964790920',
        datos_transferencia: configData.datosTransferencia || '',
        cupos_diarios_tortas: Number(configData.cuposDiariosTortas) || 5,
        permitir_stock_negativo: !!configData.permitirStockNegativo,
        tienda_activa: configData.tiendaActiva !== false,
        mensaje_cierre: configData.mensajeCierre || 'Por el momento los pedidos online están cerrados. La compra se debe realizar de manera presencial en nuestro local.',
        fecha_limite_pedidos: configData.fechaLimitePedidos || '',
        horario_corte: configData.horarioCorte || '',
        dias_entrega_permitidos: Array.isArray(configData.diasEntregaPermitidos) ? configData.diasEntregaPermitidos : [4],
        direccion_local: configData.direccionLocal || 'Francisco Ramírez 10',
        horario_atencion_local: configData.horarioAtencionLocal || '10:00 a 19:00 hrs',
        actualizado_en: new Date().toISOString()
      };
      const { error } = await client.from('configuracion').upsert([payload], { onConflict: 'id' });
      if (error) {
        console.warn('Aviso guardando configuración en Supabase:', error);
        return false;
      }
      console.log('✓ Configuración guardada en Supabase');
      return true;
    } catch(e) {
      console.warn('Error guardando configuración en Supabase:', e);
      return false;
    }
  }

  async function sincronizarConfiguracion(){
    if (!client) return null;
    try {
      const confNube = await fetchConfiguracion();
      const confLocal = Storage.get('configuracion') || {};

      if (confNube) {
        const merge = {
          ...confLocal,
          nombreNegocio: confNube.nombre_negocio || confLocal.nombreNegocio,
          telefonoWhatsApp: confNube.telefono_whatsapp || confLocal.telefonoWhatsApp,
          datosTransferencia: confNube.datos_transferencia || confLocal.datosTransferencia,
          cuposDiariosTortas: confNube.cupos_diarios_tortas ?? confLocal.cuposDiariosTortas,
          permitirStockNegativo: confNube.permitir_stock_negativo ?? confLocal.permitirStockNegativo,
          tiendaActiva: confNube.tienda_activa ?? confLocal.tiendaActiva ?? true,
          mensajeCierre: confNube.mensaje_cierre || confLocal.mensajeCierre || '',
          fechaLimitePedidos: confNube.fecha_limite_pedidos ?? confLocal.fechaLimitePedidos ?? '',
          horarioCorte: confNube.horario_corte ?? confLocal.horarioCorte ?? '',
          diasEntregaPermitidos: confNube.dias_entrega_permitidos || confLocal.diasEntregaPermitidos || [4],
          direccionLocal: confNube.direccion_local || confLocal.direccionLocal || 'Francisco Ramírez 10',
          horarioAtencionLocal: confNube.horario_atencion_local || confLocal.horarioAtencionLocal || '10:00 a 19:00 hrs'
        };
        Storage.save('configuracion', merge);
        return merge;
      } else if (confLocal) {
        await guardarConfiguracionNube(confLocal);
        return confLocal;
      }
      return null;
    } catch(e) {
      console.warn('Error sincronizando configuración:', e);
      return null;
    }
  }

  async function sincronizarProductos(){
    if (!client) return 0;
    try {
      const { data: productosNube, error } = await client.from('productos').select('*');
      if (error) {
        console.warn('Aviso sincronizando productos:', error);
        return 0;
      }
      const productosLocal = Storage.get('productos') || [];

      // 1. Limpiar de inmediato en Supabase productos no deseados como 'frambuesa chocolate blanco'
      if (productosNube && productosNube.length > 0) {
        const noDeseados = productosNube.filter(p => (p.nombre || '').toLowerCase().includes('frambuesa chocolate blanco'));
        for (const nd of noDeseados) {
          try {
            await client.from('recetas').delete().eq('producto_id', nd.id);
            await client.from('productos').delete().eq('id', nd.id);
          } catch(e) {}
        }
      }

      const productosValidosNube = (productosNube || []).filter(p => !(p.nombre || '').toLowerCase().includes('frambuesa chocolate blanco'));

      if (productosValidosNube.length > 0) {
        const idMap = new Map();
        const recetasLocal = Storage.get('recetas') || [];
        let recetasCambiaron = false;

        const nubeIds = new Set(productosValidosNube.map(p => p.id));
        const nubeNombres = new Set(productosValidosNube.map(p => (p.nombre || '').trim().toLowerCase()));

        // Mapear el catálogo maestro de la nube
        const productosSincronizados = productosValidosNube.map(pNube => {
          const normNombre = (pNube.nombre || '').trim().toLowerCase();
          const pLocal = productosLocal.find(p => p.id === pNube.id || (p.nombre || '').trim().toLowerCase() === normNombre);
          if (pLocal && pLocal.id !== pNube.id) {
            idMap.set(pLocal.id, pNube.id);
          }
          return {
            id: pNube.id,
            nombre: pNube.nombre,
            categoria: pNube.categoria,
            precioVenta: Number(pNube.precio_venta) || 0,
            unidadVenta: pNube.unidad_venta || 'unidad',
            tipoStock: pNube.tipo_stock || 'terminado',
            stockActual: Number(pNube.stock_actual) || 0,
            stockMinimo: Number(pNube.stock_minimo) || 0,
            descripcion: pNube.descripcion || '',
            imagenUrl: pNube.imagen_url || '',
            estado: pNube.estado || 'activo',
            demo: false
          };
        });

        // Catálogo maestro sincronizado desde Supabase
        Storage.save('productos', productosSincronizados);
        return productosSincronizados.length;
      } else if (productosLocal.length > 0) {
        console.log('⬆️ Subiendo catálogo local de productos a Supabase...');
        const validosLocal = productosLocal.filter(p => !p.demo && !(p.nombre || '').toLowerCase().includes('frambuesa chocolate blanco'));
        for (const p of validosLocal) {
          try {
            await guardarProducto(p);
          } catch(e) {}
        }
        Storage.save('productos', validosLocal);
        return validosLocal.length;
      }
      return 0;
    } catch(e) {
      console.warn('Error sincronizando productos:', e);
      return 0;
    }
  }

  async function sincronizarInsumos(){
    if (!client) return 0;
    try {
      let { data: insumosNube, error } = await client.from('insumos').select('*').order('nombre', { ascending: true });
      if (error) {
        console.warn('Aviso sincronizando insumos:', error);
        return 0;
      }

      const insumosLocal = Storage.get('insumos') || [];

      if (insumosNube && insumosNube.length > 0) {
        const sincronizados = insumosNube.map(r => ({
          id: r.id,
          nombre: r.nombre || '',
          categoria: r.categoria || 'Materias primas',
          unidadMedida: r.unidad_medida || 'kg',
          stockActual: Number(r.stock_actual) || 0,
          stockMinimo: Number(r.stock_minimo) || 0,
          costoUnitario: Number(r.costo_unitario) || 0,
          proveedor: r.proveedor || '',
          fechaUltimaCompra: r.fecha_ultima_compra || '',
          estado: r.estado || 'activo',
          demo: false
        }));

        Storage.save('insumos', sincronizados);
        localStorage.setItem('gp_pasteleriaSeedApplied', '1');
        console.log(`✓ ${sincronizados.length} insumos sincronizados desde Supabase`);
        return sincronizados.length;
      } else if (insumosLocal.length > 0) {
        console.log(`⬆️ Subiendo insumos válidos a Supabase...`);
        const validos = insumosLocal.filter(i => !i.demo);
        for (const ins of validos) {
          await guardarInsumoNube(ins);
        }
        Storage.save('insumos', validos);
        localStorage.setItem('gp_pasteleriaSeedApplied', '1');
        return validos.length;
      }
      return 0;
    } catch(e) {
      console.warn('Error sincronizando insumos:', e);
      return 0;
    }
  }

  async function guardarInsumoNube(insumo){
    if (!client || !insumo) return false;
    try {
      const idValido = esUUID(insumo.id) ? insumo.id : generarUUIDSeguro();
      insumo.id = idValido;
      const payload = {
        id: idValido,
        nombre: insumo.nombre || 'Insumo',
        categoria: insumo.categoria || 'Materias primas',
        unidad_medida: insumo.unidadMedida || 'kg',
        stock_actual: Number(insumo.stockActual) || 0,
        stock_minimo: Number(insumo.stockMinimo) || 0,
        costo_unitario: Number(insumo.costoUnitario) || 0,
        proveedor: insumo.proveedor || '',
        fecha_ultima_compra: insumo.fechaUltimaCompra || null,
        estado: insumo.estado || 'activo'
      };
      const { error } = await client.from('insumos').upsert([payload]);
      if (error) {
        console.warn('Aviso guardando insumo en Supabase:', error);
        return false;
      }
      return true;
    } catch(e) {
      console.warn('Error guardando insumo en Supabase:', e);
      return false;
    }
  }

  async function eliminarInsumoNube(id){
    if (!client || !id) return false;
    try {
      const { error } = await client.from('insumos').delete().eq('id', id);
      return !error;
    } catch(e) {
      console.warn('Error eliminando insumo en Supabase:', e);
      return false;
    }
  }

  async function vaciarInsumosNube(){
    if (!client) return false;
    try {
      await client.from('insumos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await client.from('movimientos_inventario').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return true;
    } catch(e) {
      console.warn('Error vaciando inventario en Supabase:', e);
      return false;
    }
  }

  async function sincronizarRecetas(){
    if (!client) return 0;
    try {
      let { data: recetasNube, error } = await client.from('recetas').select('*');
      if (error) {
        console.warn('Aviso sincronizando recetas:', error);
        return 0;
      }

      const recetasLocal = Storage.get('recetas') || [];

      if (recetasNube && recetasNube.length > 0) {
        const sincronizadas = recetasNube.map(r => ({
          id: r.id,
          productoId: r.producto_id,
          rendimiento: Number(r.rendimiento) || 1,
          unidadRendimiento: r.unidad_rendimiento || 'unidad',
          costoEmpaque: Number(r.costo_empaque) || 0,
          otrosCostos: Number(r.otros_costos) || 0,
          margenDeseado: Number(r.margen_deseado) || 60,
          instrucciones: r.instrucciones || '',
          ingredientes: Array.isArray(r.ingredientes) ? r.ingredientes : [],
          actualizadoEn: r.actualizado_en ? new Date(r.actualizado_en).getTime() : Date.now()
        }));

        Storage.save('recetas', sincronizadas);
        console.log(`✓ ${sincronizadas.length} recetas sincronizadas desde Supabase`);
        return sincronizadas.length;
      } else if (recetasLocal.length > 0) {
        console.log(`⬆️ Subiendo ${recetasLocal.length} recetas locales a Supabase...`);
        for (const r of recetasLocal) {
          await guardarRecetaNube(r);
        }
        return recetasLocal.length;
      }
      return 0;
    } catch(e) {
      console.warn('Error sincronizando recetas:', e);
      return 0;
    }
  }

  async function guardarRecetaNube(receta){
    if (!client || !receta || !receta.productoId) return false;
    try {
      const idValido = esUUID(receta.id) ? receta.id : generarUUIDSeguro();
      receta.id = idValido;
      const payload = {
        id: idValido,
        producto_id: receta.productoId,
        rendimiento: Number(receta.rendimiento) || 1,
        unidad_rendimiento: receta.unidadRendimiento || 'unidad',
        costo_empaque: Number(receta.costoEmpaque) || 0,
        otros_costos: Number(receta.otrosCostos) || 0,
        margen_deseado: Number(receta.margenDeseado) || 60,
        instrucciones: receta.instrucciones || '',
        ingredientes: Array.isArray(receta.ingredientes) ? receta.ingredientes : [],
        actualizado_en: new Date().toISOString()
      };
      const { error } = await client.from('recetas').upsert([payload], { onConflict: 'producto_id' });
      if (error) {
        console.warn('Aviso guardando receta en Supabase:', error);
        return false;
      }
      return true;
    } catch(e) {
      console.warn('Error guardando receta en Supabase:', e);
      return false;
    }
  }

  async function eliminarRecetaNube(productoId){
    if (!client || !productoId) return false;
    try {
      const { error } = await client.from('recetas').delete().eq('producto_id', productoId);
      return !error;
    } catch(e) {
      console.warn('Error eliminando receta en Supabase:', e);
      return false;
    }
  }

  async function sincronizarGastos(){
    if (!client) return 0;
    try {
      let { data: gastosNube, error } = await client.from('gastos').select('*').order('fecha', { ascending: false });
      if (error) {
        console.warn('Aviso sincronizando gastos:', error);
        return 0;
      }

      const gastosLocal = Storage.get('gastos') || [];

      if (gastosNube && gastosNube.length > 0) {
        const nubeIds = new Set(gastosNube.map(g => g.id));
        const faltantes = gastosLocal.filter(loc => !nubeIds.has(loc.id) && !loc.demo);

        if (faltantes.length > 0) {
          console.log(`⬆️ Subiendo ${faltantes.length} gastos locales a Supabase...`);
          for (const g of faltantes) {
            await guardarGastoNube(g);
          }
          const { data: refreshed } = await client.from('gastos').select('*').order('fecha', { ascending: false });
          if (refreshed) gastosNube = refreshed;
        }

        const sincronizados = gastosNube.map(g => ({
          id: g.id,
          fecha: g.fecha || '',
          tipo: g.categoria || 'Otros',
          descripcion: g.descripcion || '',
          proveedor: g.proveedor || '',
          monto: Number(g.monto) || 0,
          medioPago: g.medio_pago || 'Efectivo',
          observaciones: g.observaciones || '',
          origenInventario: !!g.origen_inventario,
          demo: false
        }));

        Storage.save('gastos', sincronizados);
        console.log(`✓ ${sincronizados.length} gastos sincronizados desde Supabase`);
        return sincronizados.length;
      } else if (gastosLocal.length > 0) {
        console.log(`⬆️ Subiendo ${gastosLocal.length} gastos locales a Supabase...`);
        for (const g of gastosLocal) {
          await guardarGastoNube(g);
        }
        return gastosLocal.length;
      }
      return 0;
    } catch(e) {
      console.warn('Error sincronizando gastos:', e);
      return 0;
    }
  }

  async function guardarGastoNube(gasto){
    if (!client || !gasto) return false;
    try {
      const idValido = esUUID(gasto.id) ? gasto.id : generarUUIDSeguro();
      gasto.id = idValido;
      const payload = {
        id: idValido,
        fecha: gasto.fecha || new Date().toISOString().slice(0,10),
        categoria: gasto.tipo || gasto.categoria || 'Otros',
        descripcion: gasto.descripcion || 'Gasto',
        proveedor: gasto.proveedor || '',
        monto: Number(gasto.monto) || 0,
        medio_pago: gasto.medioPago || gasto.medio_pago || 'Efectivo',
        observaciones: gasto.observaciones || '',
        origen_inventario: !!gasto.origenInventario
      };
      const { error } = await client.from('gastos').upsert([payload]);
      if (error) {
        console.warn('Aviso guardando gasto en Supabase:', error);
        return false;
      }
      return true;
    } catch(e) {
      console.warn('Error guardando gasto en Supabase:', e);
      return false;
    }
  }

  async function eliminarGastoNube(id){
    if (!client || !id) return false;
    try {
      const { error } = await client.from('gastos').delete().eq('id', id);
      return !error;
    } catch(e) {
      console.warn('Error eliminando gasto en Supabase:', e);
      return false;
    }
  }

  async function sincronizarMovimientosInventario(){
    if (!client) return 0;
    try {
      const { data: movsNube, error } = await client.from('movimientos_inventario').select('*').order('creado_en', { ascending: false });
      if (error) return 0;

      const movsLocal = Storage.get('movimientosInventario') || [];

      if (movsNube && movsNube.length > 0) {
        const nubeIds = new Set(movsNube.map(m => m.id));
        const faltantes = movsLocal.filter(loc => !nubeIds.has(loc.id));
        if (faltantes.length > 0) {
          for (const m of faltantes) {
            await guardarMovimientoNube(m);
          }
        }
        const sincronizados = movsNube.map(m => ({
          id: m.id,
          fecha: m.fecha,
          insumoId: m.insumo_id,
          insumoNombre: m.insumo_nombre,
          tipo: m.tipo,
          cantidad: Number(m.cantidad) || 0,
          costo: Number(m.costo) || 0,
          motivo: m.motivo || '',
          creadoEn: m.creado_en ? new Date(m.creado_en).getTime() : Date.now()
        }));
        Storage.save('movimientosInventario', sincronizados);
        return sincronizados.length;
      } else if (movsLocal.length > 0) {
        for (const m of movsLocal) {
          await guardarMovimientoNube(m);
        }
        return movsLocal.length;
      }
      return 0;
    } catch(e) {
      console.warn('Error sincronizando movimientos:', e);
      return 0;
    }
  }

  async function guardarMovimientoNube(mov){
    if (!client || !mov) return false;
    try {
      const idValido = esUUID(mov.id) ? mov.id : generarUUIDSeguro();
      const payload = {
        id: idValido,
        fecha: mov.fecha || new Date().toISOString().slice(0,10),
        insumo_id: esUUID(mov.insumoId) ? mov.insumoId : null,
        insumo_nombre: mov.insumoNombre || '',
        tipo: mov.tipo || 'entrada',
        cantidad: Number(mov.cantidad) || 0,
        costo: Number(mov.costo) || 0,
        motivo: mov.motivo || ''
      };
      await client.from('movimientos_inventario').insert([payload]);
      return true;
    } catch(e) {
      return false;
    }
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

      const pedidosSincronizados = (pedidosNube || []).map(pNube => {
        const rawItems = (itemsNube || []).filter(i => i.pedido_id === pNube.id);
        const seenItemKeys = new Set();
        const itemsDelPedido = [];
        let huboDuplicados = false;

        rawItems.forEach(i => {
          // Filtrar filas duplicadas si fueron insertadas múltiples veces
          const itemKey = (i.producto_id || '') + '__' + (i.nombre || '').trim() + '__' + Number(i.precio_unitario);
          if (!seenItemKeys.has(itemKey)) {
            seenItemKeys.add(itemKey);
            itemsDelPedido.push({
              productoId: i.producto_id,
              nombre: i.nombre || 'Producto sin nombre',
              precioUnitario: Number(i.precio_unitario) || 0,
              cantidad: Number(i.cantidad) || 1,
              subtotal: Number(i.subtotal) || 0,
              tipoStock: i.tipo_stock || 'terminado'
            });
          } else {
            huboDuplicados = true;
          }
        });

        // Si se encontraron items duplicados en la base de datos, auto-reparar en segundo plano
        if (huboDuplicados && itemsDelPedido.length > 0) {
          repararItemsDuplicadosEnNube(pNube.id, itemsDelPedido);
        }

        return {
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
        };
      });

      // Filtrar de manera estricta cualquier pedido demo de ejemplo (ej: Camila Rojas DM-101)
      const limpios = pedidosSincronizados.filter(p => !p.demo && p.clienteNombre !== 'Camila Rojas' && p.codigo !== 'DM-101');

      Storage.save('pedidos', limpios);
      console.log(`✅ Sincronización completada. ${limpios.length} pedidos reales guardados localmente.`);
      
      // Refrescar vista actual si el usuario está en pedidos o dashboard
      if (window.App && typeof App.goTo === 'function' && (App.currentSection === 'pedidos' || App.currentSection === 'dashboard')) {
        App.goTo(App.currentSection);
      }
    } catch(e) {
      console.error('❌ Error sincronizando pedidos:', e);
    }
  }

  async function sincronizarVentas(){
    if (!client) return 0;
    try {
      const user = await getCurrentUser();
      if (!user) return 0;

      let { data: ventasNube, error } = await client.from('ventas').select('*').order('fecha', { ascending: false });
      if (error) {
        console.warn('Aviso sincronizando ventas:', error);
        return 0;
      }

      let ventasLocal = Storage.get('ventas') || [];
      const pedidosLocal = Storage.get('pedidos') || [];

      // 1. Auto-recuperar ventas de pedidos pagados que aún no se hayan registrado
      const nuevasDesdePedidos = [];
      pedidosLocal.forEach(p => {
        const estaPagado = p.pagado || (Number(p.saldoPendiente) === 0 && Number(p.total) > 0) || p.estado === 'entregado';
        if (estaPagado && Array.isArray(p.items) && p.items.length > 0) {
          const yaEnLocal = ventasLocal.some(v => v.pedidoId === p.id || (v.pedidoCodigo && p.codigo && v.pedidoCodigo === p.codigo));
          const yaEnNube = (ventasNube || []).some(v => v.pedido_id === p.id);

          if (!yaEnLocal && !yaEnNube) {
            p.items.forEach(item => {
              const idVenta = generarUUIDSeguro();
              const nuevaVenta = {
                id: idVenta,
                fecha: p.fechaEntrega || Storage.todayISO(),
                productoId: (item.productoId && esUUID(item.productoId)) ? item.productoId : null,
                productoNombre: item.nombre || 'Producto sin nombre',
                categoria: item.categoria || (p.tipoEntrega === 'despacho' ? 'Despacho' : 'Encargos'),
                cantidad: Number(item.cantidad) || 1,
                precioUnitario: Number(item.precioUnitario) || 0,
                total: Number(item.subtotal) || (Number(item.cantidad) * Number(item.precioUnitario)),
                medioPago: p.medioPago || 'Transferencia',
                observaciones: `Pedido #${p.codigo || ''} — Cliente: ${p.clienteNombre || ''}`,
                pedidoId: p.id,
                pedidoCodigo: p.codigo || '',
                origen: 'pedido_web',
                creadoEn: p.creadoEn || Date.now()
              };
              ventasLocal.push(nuevaVenta);
              nuevasDesdePedidos.push(nuevaVenta);
            });
            p.registradoEnVentas = true;
          }
        }
      });

      if (nuevasDesdePedidos.length > 0) {
        console.log(`📦 Auto-generadas ${nuevasDesdePedidos.length} ventas desde pedidos pagados.`);
        Storage.save('ventas', ventasLocal);
        Storage.save('pedidos', pedidosLocal);
        await guardarVentasNube(nuevasDesdePedidos);
        const { data: refreshed } = await client.from('ventas').select('*').order('fecha', { ascending: false });
        if (refreshed) ventasNube = refreshed;
      }

      // 2. Mapear ventas descargadas desde Supabase a almacenamiento local
      if (ventasNube && ventasNube.length > 0) {
        const nubeIds = new Set(ventasNube.map(v => v.id));

        // Subir ventas locales legítimas pendientes que no existan aún en la nube
        const faltantes = ventasLocal.filter(loc => !nubeIds.has(loc.id) && !loc.demo && !(loc.observaciones || '').includes('Venta de ejemplo') && !(loc.observaciones || '').includes('Camila Rojas'));
        if (faltantes.length > 0) {
          console.log(`⬆️ Subiendo ${faltantes.length} ventas locales a Supabase...`);
          await guardarVentasNube(faltantes);
          const { data: refreshed } = await client.from('ventas').select('*').order('fecha', { ascending: false });
          if (refreshed) ventasNube = refreshed;
        }

        const sincronizadas = ventasNube.map(v => ({
          id: v.id,
          fecha: v.fecha || Storage.todayISO(),
          productoId: v.producto_id || null,
          productoNombre: v.producto_nombre || 'Producto',
          categoria: v.categoria || 'Encargos',
          cantidad: Number(v.cantidad) || 1,
          precioUnitario: Number(v.precio_unitario) || 0,
          total: Number(v.total) || 0,
          medioPago: v.medio_pago || 'Transferencia',
          observaciones: v.observaciones || '',
          pedidoId: v.pedido_id || null,
          pedidoCodigo: v.pedido_codigo || '',
          origen: v.pedido_id ? 'pedido_web' : 'directa',
          creadoEn: v.creado_en ? new Date(v.creado_en).getTime() : Date.now()
        }));

        const limpios = sincronizadas.filter(v => !v.demo && !(v.observaciones || '').includes('Venta de ejemplo') && !(v.observaciones || '').includes('Camila Rojas'));
        Storage.save('ventas', limpios);
        return limpios.length;
      } else if (ventasLocal.length > 0) {
        const paraSubir = ventasLocal.filter(v => !v.demo && !(v.observaciones || '').includes('Venta de ejemplo') && !(v.observaciones || '').includes('Camila Rojas'));
        if (paraSubir.length > 0) {
          await guardarVentasNube(paraSubir);
        } else {
          Storage.save('ventas', []);
        }
        return paraSubir.length;
      } else {
        Storage.save('ventas', []);
      }
      return 0;
    } catch(e) {
      console.warn('Error sincronizando ventas:', e);
      return 0;
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, payload => {
          sincronizarPedidos();
          if (payload.eventType === 'INSERT' && payload.new) {
            reproducirCampana();
            if (window.App && typeof App.toast === 'function'){
              App.toast(`🧁 ¡Nuevo pedido recibido #${payload.new.codigo || ''} de ${payload.new.cliente_nombre}!`, 'success');
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, () => {
          sincronizarVentas();
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
      const pedidoId = esValidoUUID ? pedidoData.id : generarUUIDSeguro();

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

  async function actualizarStockProductoNube(productoId, nuevoStock){
    if (!client || !productoId) return false;
    try {
      const stockNum = Math.max(0, Number(nuevoStock) || 0);
      let res = null;

      if (esUUID(productoId)) {
        res = await client.from('productos').update({ stock_actual: stockNum }).eq('id', productoId);
      }

      if (!res || res.error) {
        const productosLocal = (typeof Storage !== 'undefined' && typeof Storage.get === 'function')
          ? Storage.get('productos') || []
          : [];
        const prod = productosLocal.find(p => p.id === productoId);
        if (prod && prod.nombre) {
          res = await client.from('productos').update({ stock_actual: stockNum }).eq('nombre', prod.nombre);
        }
      }

      if (res && res.error) {
        console.warn('Aviso actualizando stock en Supabase:', res.error);
        return false;
      }
      console.log(`✓ Stock actualizado en Supabase para producto (${productoId}): ${stockNum}`);
      return true;
    } catch(e) {
      console.warn('Error actualizando stock de producto en Supabase:', e);
      return false;
    }
  }

  async function guardarProducto(producto, existente = null){
    if (!client) throw new Error('No hay conexión con Supabase.');
    const user = await getCurrentUser();
    if (!user) throw new Error('Inicia sesión en el panel de administración para guardar productos en la nube.');

    const targetId = (existente && existente.id) || producto.id;
    const esTargetUUID = esUUID(targetId);

    const payload = {
      nombre: producto.nombre || 'Producto',
      categoria: producto.categoria || 'Pastelería',
      precio_venta: Number(producto.precioVenta) || 0,
      unidad_venta: producto.unidadVenta || 'unidad',
      tipo_stock: producto.tipoStock || 'terminado',
      stock_actual: Number(producto.stockActual) || 0,
      stock_minimo: Number(producto.stockMinimo) || 5,
      descripcion: producto.descripcion || '',
      imagen_url: producto.imagenUrl || '',
      estado: producto.estado || 'activo'
    };

    if (targetId && esTargetUUID) {
      const { data, error } = await client.from('productos').update(payload).eq('id', targetId).select('id').single();
      if (!error && data) return data;
      if (error && error.code !== 'PGRST116') {
        console.warn('Aviso actualizando producto por ID:', error);
      }
    }

    const targetNombre = (existente && existente.nombre) || producto.nombre;
    if (targetNombre) {
      const { data: coincidencias } = await client.from('productos').select('id').eq('nombre', targetNombre);
      if (coincidencias && coincidencias.length === 1) {
        const { data, error } = await client.from('productos').update(payload).eq('id', coincidencias[0].id).select('id').single();
        if (!error && data) return data;
      }
    }

    const { data: nuevo, error: errInsert } = await client.from('productos').insert(payload).select('id').single();
    if (errInsert) throw errInsert;
    return nuevo;
  }

  async function eliminarProductoNube(productoId, nombre = null){
    if (!client || (!productoId && !nombre)) return false;
    try {
      const esIdUUID = esUUID(productoId);

      // 1. Eliminar recetas vinculadas al producto en Supabase
      if (esIdUUID) {
        await client.from('recetas').delete().eq('producto_id', productoId);
      }

      // 2. Intentar eliminar por UUID
      let eliminado = false;
      if (esIdUUID) {
        const { error } = await client.from('productos').delete().eq('id', productoId);
        if (!error) {
          eliminado = true;
          console.log('✓ Producto eliminado de Supabase por UUID:', productoId);
        } else {
          console.warn('Aviso al eliminar producto por UUID en Supabase:', error);
        }
      }

      // 3. Si no se pudo por UUID o si viene nombre, eliminar por nombre
      if (!eliminado && nombre) {
        const { data: prods } = await client.from('productos').select('id').eq('nombre', nombre);
        if (prods && prods.length > 0) {
          for (const p of prods) {
            await client.from('recetas').delete().eq('producto_id', p.id);
          }
        }
        const { error: errNom } = await client.from('productos').delete().eq('nombre', nombre);
        if (!errNom) {
          eliminado = true;
          console.log('✓ Producto eliminado de Supabase por nombre:', nombre);
        } else {
          console.warn('Aviso al eliminar producto por nombre en Supabase:', errNom);
        }
      }

      // 4. Si las restricciones de ventas históricas impiden el borrado duro, marcar como inactivo
      if (!eliminado) {
        console.log('Marcando producto como inactivo en Supabase para proteger ventas históricas...');
        if (esIdUUID) {
          await client.from('productos').update({ estado: 'inactivo' }).eq('id', productoId);
        } else if (nombre) {
          await client.from('productos').update({ estado: 'inactivo' }).eq('nombre', nombre);
        }
      }

      return true;
    } catch(e) {
      console.warn('Error eliminando producto en Supabase:', e);
      return false;
    }
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

      console.log('✓ Pedido actualizado en Supabase:', pedido.codigo || pedido.id, '->', pedido.estado);
      return true;
    } catch(e) {
      console.warn('Aviso: error actualizando pedido en Supabase:', e);
      return false;
    }
  }

  async function repararItemsDuplicadosEnNube(pedidoId, itemsLimpios){
    if (!client || !pedidoId || !Array.isArray(itemsLimpios) || itemsLimpios.length === 0) return false;
    try {
      const esUUID = pedidoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pedidoId);
      if (!esUUID) return false;

      console.log('🧹 Limpiando y deduplicando items en Supabase para el pedido:', pedidoId);
      const { error: errDel } = await client.from('pedido_items').delete().eq('pedido_id', pedidoId);
      if (errDel) {
        console.warn('Aviso borrando items duplicados en Supabase:', errDel);
        return false;
      }
      
      const payload = itemsLimpios.map(item => {
        const esItemUUID = item.productoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.productoId);
        return {
          pedido_id: pedidoId,
          producto_id: esItemUUID ? item.productoId : null,
          nombre: item.nombre,
          precio_unitario: Number(item.precioUnitario) || 0,
          cantidad: Number(item.cantidad) || 1,
          subtotal: Number(item.subtotal) || 0,
          tipo_stock: item.tipoStock || 'terminado'
        };
      });

      const { error: errIns } = await client.from('pedido_items').insert(payload);
      if (errIns) {
        console.warn('Aviso insertando items deduplicados en Supabase:', errIns);
        return false;
      }
      console.log('✓ Items reparados y deduplicados con éxito en Supabase:', itemsLimpios.length);
      return true;
    } catch(e) {
      console.warn('Aviso reparando items duplicados:', e);
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
      const payload = ventasArray.map(v => {
        const idValido = (v.id && esUUID(v.id)) ? v.id : generarUUIDSeguro();
        v.id = idValido;
        return {
          id: idValido,
          fecha: v.fecha || new Date().toISOString().slice(0, 10),
          producto_id: (v.productoId && esUUID(v.productoId)) ? v.productoId : null,
          producto_nombre: v.productoNombre || 'Producto',
          categoria: v.categoria || 'Encargos',
          cantidad: Number(v.cantidad) || 1,
          precio_unitario: Number(v.precioUnitario) || 0,
          total: Number(v.total) || 0,
          medio_pago: v.medioPago || 'Transferencia',
          observaciones: v.observaciones || '',
          pedido_id: (v.pedidoId && esUUID(v.pedidoId)) ? v.pedidoId : null,
          pedido_codigo: v.pedidoCodigo || ''
        };
      });
      const { error } = await client.from('ventas').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error('Error guardando ventas en Supabase:', error);
      } else {
        console.log('✓ Ventas sincronizadas en Supabase:', payload.length);
      }
    } catch(e) {
      console.warn('Aviso: no se pudo sincronizar ventas en Supabase:', e);
    }
  }

  async function eliminarVentaNube(ventaId){
    if (!client || !ventaId) return false;
    try {
      const { error } = await client.from('ventas').delete().eq('id', ventaId);
      if (error) {
        console.warn('Aviso eliminando venta en Supabase:', error);
        return false;
      }
      return true;
    } catch(e) {
      console.warn('Error eliminando venta en Supabase:', e);
      return false;
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
    sincronizarTodo,
    sincronizarProductos,
    sincronizarInsumos,
    guardarInsumoNube,
    eliminarInsumoNube,
    vaciarInsumosNube,
    sincronizarRecetas,
    guardarRecetaNube,
    eliminarRecetaNube,
    sincronizarGastos,
    guardarGastoNube,
    eliminarGastoNube,
    sincronizarMovimientosInventario,
    guardarMovimientoNube,
    fetchConfiguracion,
    guardarConfiguracionNube,
    sincronizarConfiguracion,
    fetchProductos,
    guardarProducto,
    eliminarProductoNube,
    eliminarProducto: eliminarProductoNube,
    actualizarStockProductoNube,
    enviarPedido,
    actualizarPedidoNube,
    actualizarPedido: actualizarPedidoNube,
    repararItemsDuplicadosEnNube,
    eliminarPedidoNube,
    eliminarPedido: eliminarPedidoNube,
    guardarVentasNube,
    eliminarVentaNube,
    eliminarVentasPedidoNube,
    limpiarPedidosYVentasNube,
    sincronizarPedidos,
    sincronizarVentas,
    reproducirCampana,
    get isConnected(){ return isConnected; },
    get client(){ return client; }
  };
})();

document.addEventListener('DOMContentLoaded', SupabaseBridge.init);
