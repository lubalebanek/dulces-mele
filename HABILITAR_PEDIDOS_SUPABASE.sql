-- ============================================================
-- DULCES MELE — HABILITAR PERMISOS TOTALES Y SINCRONIZACIÓN EN VIVO
-- ============================================================
-- Copia y pega TODO este contenido en el "SQL Editor" de tu Supabase
-- y presiona el botón verde "RUN".
-- ============================================================

-- 1. TABLA PARA EL MÓDULO DE VENTAS (si no existe aún)
CREATE TABLE IF NOT EXISTS ventas (
    id TEXT PRIMARY KEY,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
    producto_nombre TEXT NOT NULL,
    categoria TEXT,
    cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    medio_pago TEXT DEFAULT 'Transferencia',
    pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS ventas ADD COLUMN IF NOT EXISTS pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL;

-- 2. TABLA PARA INSUMOS / MATERIAS PRIMAS (si no existe o le faltan columnas)
CREATE TABLE IF NOT EXISTS insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'Materias primas',
    unidad_medida TEXT NOT NULL DEFAULT 'kg',
    stock_actual NUMERIC(10,2) NOT NULL DEFAULT 0,
    stock_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,
    costo_unitario NUMERIC(10,0) NOT NULL DEFAULT 0,
    proveedor TEXT DEFAULT '',
    fecha_ultima_compra TEXT,
    estado TEXT NOT NULL DEFAULT 'activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE IF EXISTS insumos ADD COLUMN IF NOT EXISTS fecha_ultima_compra TEXT;
ALTER TABLE IF EXISTS insumos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';

-- 3. TABLA PARA RECETAS Y ESCANDALLO (Con ingredientes JSONB y métricas de margen)
CREATE TABLE IF NOT EXISTS recetas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL,
    rendimiento NUMERIC(10,2) DEFAULT 1,
    unidad_rendimiento TEXT DEFAULT 'unidad',
    costo_empaque NUMERIC(10,2) DEFAULT 0,
    otros_costos NUMERIC(10,2) DEFAULT 0,
    margen_deseado NUMERIC(10,2) DEFAULT 60,
    instrucciones TEXT DEFAULT '',
    ingredientes JSONB DEFAULT '[]'::jsonb,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
-- Si la tabla recetas ya existía previamente con esquema relacional, adaptarla sin perder compatibilidad
ALTER TABLE IF EXISTS recetas ALTER COLUMN insumo_id DROP NOT NULL;
ALTER TABLE IF EXISTS recetas ALTER COLUMN cantidad DROP NOT NULL;
ALTER TABLE IF EXISTS recetas DROP CONSTRAINT IF EXISTS recetas_producto_id_insumo_id_key;
ALTER TABLE IF EXISTS recetas ADD COLUMN IF NOT EXISTS rendimiento NUMERIC(10,2) DEFAULT 1;
ALTER TABLE IF EXISTS recetas ADD COLUMN IF NOT EXISTS unidad_rendimiento TEXT DEFAULT 'unidad';
ALTER TABLE IF EXISTS recetas ADD COLUMN IF NOT EXISTS costo_empaque NUMERIC(10,2) DEFAULT 0;
ALTER TABLE IF EXISTS recetas ADD COLUMN IF NOT EXISTS otros_costos NUMERIC(10,2) DEFAULT 0;
ALTER TABLE IF EXISTS recetas ADD COLUMN IF NOT EXISTS margen_deseado NUMERIC(10,2) DEFAULT 60;
ALTER TABLE IF EXISTS recetas ADD COLUMN IF NOT EXISTS instrucciones TEXT DEFAULT '';
ALTER TABLE IF EXISTS recetas ADD COLUMN IF NOT EXISTS ingredientes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS recetas ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT NOW();
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'recetas_producto_id_unique'
    ) THEN
        ALTER TABLE recetas ADD CONSTRAINT recetas_producto_id_unique UNIQUE (producto_id);
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 4. TABLA PARA GASTOS DEL NEGOCIO (si no existe o le faltan columnas)
CREATE TABLE IF NOT EXISTS gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    categoria TEXT NOT NULL DEFAULT 'Otros',
    descripcion TEXT NOT NULL,
    proveedor TEXT DEFAULT '',
    monto NUMERIC(10,0) NOT NULL DEFAULT 0,
    medio_pago TEXT NOT NULL DEFAULT 'Efectivo',
    observaciones TEXT DEFAULT '',
    origen_inventario BOOLEAN DEFAULT false,
    comprobante_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE IF EXISTS gastos ADD COLUMN IF NOT EXISTS proveedor TEXT DEFAULT '';
ALTER TABLE IF EXISTS gastos ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT '';
ALTER TABLE IF EXISTS gastos ADD COLUMN IF NOT EXISTS origen_inventario BOOLEAN DEFAULT false;

-- 5. TABLA PARA MOVIMIENTOS DE INVENTARIO (Entradas y Salidas)
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    insumo_id UUID,
    insumo_nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'entrada',
    cantidad NUMERIC(10,3) NOT NULL DEFAULT 0,
    costo NUMERIC(10,0) DEFAULT 0,
    motivo TEXT DEFAULT '',
    creado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 6. TABLA PARA CONFIGURACIÓN (Horarios de corte, días de entrega y cierre)
CREATE TABLE IF NOT EXISTS configuracion (
    id TEXT PRIMARY KEY DEFAULT 'general',
    nombre_negocio TEXT DEFAULT 'Dulces Mele',
    telefono_whatsapp TEXT DEFAULT '+56964790920',
    datos_transferencia TEXT DEFAULT 'Nombre: Andrea Lebanek / Rut: 14.738.359-2 / Banco Estado / Cuenta RUT',
    cupos_diarios_tortas INT DEFAULT 5,
    permitir_stock_negativo BOOLEAN DEFAULT FALSE,
    tienda_activa BOOLEAN DEFAULT TRUE,
    mensaje_cierre TEXT DEFAULT 'Por el momento los pedidos online están cerrados. La compra se debe realizar de manera presencial en nuestro local.',
    fecha_limite_pedidos TEXT DEFAULT '',
    horario_corte TEXT DEFAULT '',
    dias_entrega_permitidos JSONB DEFAULT '[4]'::jsonb,
    direccion_local TEXT DEFAULT 'Francisco Ramírez 10',
    horario_atencion_local TEXT DEFAULT '10:00 a 19:00 hrs',
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS configuracion ADD COLUMN IF NOT EXISTS tienda_activa BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS configuracion ADD COLUMN IF NOT EXISTS mensaje_cierre TEXT DEFAULT 'Por el momento los pedidos online están cerrados. La compra se debe realizar de manera presencial en nuestro local.';
ALTER TABLE IF EXISTS configuracion ADD COLUMN IF NOT EXISTS fecha_limite_pedidos TEXT DEFAULT '';
ALTER TABLE IF EXISTS configuracion ADD COLUMN IF NOT EXISTS horario_corte TEXT DEFAULT '';
ALTER TABLE IF EXISTS configuracion ADD COLUMN IF NOT EXISTS dias_entrega_permitidos JSONB DEFAULT '[4]'::jsonb;
ALTER TABLE IF EXISTS configuracion ADD COLUMN IF NOT EXISTS direccion_local TEXT DEFAULT 'Francisco Ramírez 10';
ALTER TABLE IF EXISTS configuracion ADD COLUMN IF NOT EXISTS horario_atencion_local TEXT DEFAULT '10:00 a 19:00 hrs';
ALTER TABLE IF EXISTS configuracion ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT NOW();

INSERT INTO configuracion (id, nombre_negocio, telefono_whatsapp, tienda_activa, dias_entrega_permitidos)
VALUES ('general', 'Dulces Mele', '+56964790920', TRUE, '[4]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 7. PRIVILEGIOS DE TABLA (GRANT) PARA anon, authenticated Y service_role
-- Permite guardar pedidos, ventas, inventario, recetas, gastos y configuración sin errores 403 Forbidden
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON TABLE pedidos TO anon, authenticated, service_role;
GRANT ALL ON TABLE pedido_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE productos TO anon, authenticated, service_role;
GRANT ALL ON TABLE ventas TO anon, authenticated, service_role;
GRANT ALL ON TABLE insumos TO anon, authenticated, service_role;
GRANT ALL ON TABLE recetas TO anon, authenticated, service_role;
GRANT ALL ON TABLE gastos TO anon, authenticated, service_role;
GRANT ALL ON TABLE movimientos_inventario TO anon, authenticated, service_role;
GRANT ALL ON TABLE configuracion TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 8. Habilitar seguridad por fila (RLS)
ALTER TABLE IF EXISTS pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS configuracion ENABLE ROW LEVEL SECURITY;

-- 9. Políticas de acceso total para la pastelería
DROP POLICY IF EXISTS "Admin acceso total pedidos" ON pedidos;
CREATE POLICY "Admin acceso total pedidos" ON pedidos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin acceso total pedido_items" ON pedido_items;
CREATE POLICY "Admin acceso total pedido_items" ON pedido_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin acceso total productos" ON productos;
CREATE POLICY "Admin acceso total productos" ON productos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin acceso total ventas" ON ventas;
CREATE POLICY "Admin acceso total ventas" ON ventas FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin acceso total insumos" ON insumos;
CREATE POLICY "Admin acceso total insumos" ON insumos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin acceso total recetas" ON recetas;
CREATE POLICY "Admin acceso total recetas" ON recetas FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin acceso total gastos" ON gastos;
CREATE POLICY "Admin acceso total gastos" ON gastos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin acceso total movimientos_inventario" ON movimientos_inventario;
CREATE POLICY "Admin acceso total movimientos_inventario" ON movimientos_inventario FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total config" ON configuracion;
DROP POLICY IF EXISTS "Admin acceso total config" ON configuracion;
CREATE POLICY "Admin acceso total config" ON configuracion FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 9. ⚡ DESCUENTO AUTOMÁTICO DE STOCK EN PRODUCTOS TERMINADOS (GALLETAS / ALFAJORES)
CREATE OR REPLACE FUNCTION descontar_stock_pedido()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo_stock = 'terminado' AND NEW.producto_id IS NOT NULL THEN
        UPDATE productos
        SET stock_actual = GREATEST(0, stock_actual - NEW.cantidad)
        WHERE id = NEW.producto_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_descontar_stock ON pedido_items;
CREATE TRIGGER trigger_descontar_stock
AFTER INSERT ON pedido_items
FOR EACH ROW
EXECUTE FUNCTION descontar_stock_pedido();

-- 10. 🔔 ACTIVAR TIEMPO REAL (WEBSOCKET) PARA CAMPANA EN EL PANEL DE GESTIÓN
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pedidos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
  END IF;
END $$;

-- 11. 🧹 LIMPIEZA INMEDIATA DE ITEMS DUPLICADOS EN PEDIDOS EXISTENTES
DELETE FROM pedido_items a
USING pedido_items b
WHERE a.ctid > b.ctid
  AND a.pedido_id = b.pedido_id
  AND a.nombre = b.nombre;
