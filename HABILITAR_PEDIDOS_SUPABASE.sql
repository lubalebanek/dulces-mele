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

-- 2. PRIVILEGIOS DE TABLA (GRANT) PARA anon, authenticated Y service_role
-- Esto soluciona el error 42501 "permission denied for table pedidos / ventas" (403 Forbidden)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON TABLE pedidos TO anon, authenticated, service_role;
GRANT ALL ON TABLE pedido_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE productos TO anon, authenticated, service_role;
GRANT ALL ON TABLE ventas TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 3. Habilitar seguridad por fila (RLS)
ALTER TABLE IF EXISTS pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ventas ENABLE ROW LEVEL SECURITY;

-- 4. Permisos y políticas para pedidos y sus items (crear, ver, actualizar y eliminar)
DROP POLICY IF EXISTS "Publico puede crear pedidos" ON pedidos;
DROP POLICY IF EXISTS "Admin acceso total pedidos" ON pedidos;
DROP POLICY IF EXISTS "Acceso total pedidos" ON pedidos;
CREATE POLICY "Admin acceso total pedidos" ON pedidos
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Publico puede insertar items del pedido" ON pedido_items;
DROP POLICY IF EXISTS "Admin acceso total pedido_items" ON pedido_items;
DROP POLICY IF EXISTS "Acceso total pedido_items" ON pedido_items;
CREATE POLICY "Admin acceso total pedido_items" ON pedido_items
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- 5. Permisos para productos (catálogo y stock)
DROP POLICY IF EXISTS "Publico puede ver productos activos" ON productos;
DROP POLICY IF EXISTS "Admin acceso total productos" ON productos;
DROP POLICY IF EXISTS "Acceso total productos" ON productos;
CREATE POLICY "Admin acceso total productos" ON productos
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- 6. Permisos para ventas
DROP POLICY IF EXISTS "Admin acceso total ventas" ON ventas;
DROP POLICY IF EXISTS "Acceso total ventas" ON ventas;
CREATE POLICY "Admin acceso total ventas" ON ventas
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- 7. ⚡ DESCUENTO AUTOMÁTICO DE STOCK EN PRODUCTOS TERMINADOS (GALLETAS / ALFAJORES)
-- Se activa solo en la base de datos cada vez que un cliente encarga productos
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

-- 8. 🔔 ACTIVAR TIEMPO REAL (WEBSOCKET) PARA CAMPANA EN EL PANEL DE GESTIÓN
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pedidos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
  END IF;
END $$;

-- 9. 🧹 LIMPIEZA INMEDIATA DE ITEMS DUPLICADOS EN PEDIDOS EXISTENTES
-- Elimina cualquier fila duplicada accidental en pedido_items manteniendo solo 1 de cada producto por pedido
DELETE FROM pedido_items a
USING pedido_items b
WHERE a.ctid > b.ctid
  AND a.pedido_id = b.pedido_id
  AND a.nombre = b.nombre;
