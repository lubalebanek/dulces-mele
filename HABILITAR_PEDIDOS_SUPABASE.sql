-- ============================================================
-- DULCES MELE — HABILITAR DESCUENTO DE STOCK Y CAMPANA EN VIVO
-- ============================================================
-- Copia y pega TODO este contenido en el "SQL Editor" de tu Supabase
-- y presiona el botón verde "RUN".
-- ============================================================

-- 1. Habilitar seguridad por fila (RLS)
ALTER TABLE IF EXISTS pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS productos ENABLE ROW LEVEL SECURITY;

-- 2. Permisos y políticas para pedidos y sus items (crear, ver, actualizar y eliminar)
DROP POLICY IF EXISTS "Publico puede crear pedidos" ON pedidos;
DROP POLICY IF EXISTS "Admin acceso total pedidos" ON pedidos;
CREATE POLICY "Admin acceso total pedidos" ON pedidos
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Publico puede insertar items del pedido" ON pedido_items;
DROP POLICY IF EXISTS "Admin acceso total pedido_items" ON pedido_items;
CREATE POLICY "Admin acceso total pedido_items" ON pedido_items
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- 3. Permisos para productos (catálogo y stock)
DROP POLICY IF EXISTS "Publico puede ver productos activos" ON productos;
DROP POLICY IF EXISTS "Admin acceso total productos" ON productos;
CREATE POLICY "Admin acceso total productos" ON productos
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- 4. ⚡ DESCUENTO AUTOMÁTICO DE STOCK EN PRODUCTOS TERMINADOS (GALLETAS / ALFAJORES)
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

-- 5. 🔔 ACTIVAR TIEMPO REAL (WEBSOCKET) PARA CAMPANA EN EL PANEL DE GESTIÓN
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pedidos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
  END IF;
END $$;

-- 6. TABLA Y PERMISOS PARA EL MÓDULO DE VENTAS
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
ALTER TABLE IF EXISTS ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin acceso total ventas" ON ventas;
CREATE POLICY "Admin acceso total ventas" ON ventas
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

