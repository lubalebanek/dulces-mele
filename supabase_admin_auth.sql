-- Ejecutar una sola vez en Supabase SQL Editor.
-- Restringe el panel a la cuenta administradora y mantiene la tienda pública.
BEGIN;

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- Limpia políticas anteriores en las tablas de la aplicación para que una
-- política permisiva vieja no siga exponiendo filas por la regla OR de RLS.
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'productos', 'insumos', 'recetas', 'pedidos',
        'pedido_items', 'ventas', 'gastos', 'configuracion'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname, v_policy.schemaname, v_policy.tablename
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Admin acceso total productos" ON public.productos;
DROP POLICY IF EXISTS "Admin acceso total pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Admin acceso total pedido_items" ON public.pedido_items;
DROP POLICY IF EXISTS "Admin acceso total config" ON public.configuracion;
DROP POLICY IF EXISTS "Admin cuenta autorizada productos" ON public.productos;
DROP POLICY IF EXISTS "Admin cuenta autorizada insumos" ON public.insumos;
DROP POLICY IF EXISTS "Admin cuenta autorizada recetas" ON public.recetas;
DROP POLICY IF EXISTS "Admin cuenta autorizada pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Admin cuenta autorizada items" ON public.pedido_items;
DROP POLICY IF EXISTS "Admin cuenta autorizada ventas" ON public.ventas;
DROP POLICY IF EXISTS "Admin cuenta autorizada gastos" ON public.gastos;
DROP POLICY IF EXISTS "Admin cuenta autorizada configuracion" ON public.configuracion;

DROP POLICY IF EXISTS "Publico puede crear pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Publico puede insertar items del pedido" ON public.pedido_items;

CREATE POLICY "Publico puede ver productos activos" ON public.productos
  FOR SELECT TO anon, authenticated
  USING (estado = 'activo');
CREATE POLICY "Publico puede ver datos basicos negocio" ON public.configuracion
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin cuenta autorizada productos" ON public.productos
  FOR ALL TO authenticated
  USING (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid)
  WITH CHECK (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid);
CREATE POLICY "Admin cuenta autorizada insumos" ON public.insumos
  FOR ALL TO authenticated
  USING (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid)
  WITH CHECK (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid);
CREATE POLICY "Admin cuenta autorizada recetas" ON public.recetas
  FOR ALL TO authenticated
  USING (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid)
  WITH CHECK (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid);
CREATE POLICY "Admin cuenta autorizada pedidos" ON public.pedidos
  FOR ALL TO authenticated
  USING (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid)
  WITH CHECK (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid);
CREATE POLICY "Admin cuenta autorizada items" ON public.pedido_items
  FOR ALL TO authenticated
  USING (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid)
  WITH CHECK (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid);
CREATE POLICY "Admin cuenta autorizada ventas" ON public.ventas
  FOR ALL TO authenticated
  USING (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid)
  WITH CHECK (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid);
CREATE POLICY "Admin cuenta autorizada gastos" ON public.gastos
  FOR ALL TO authenticated
  USING (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid)
  WITH CHECK (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid);
CREATE POLICY "Admin cuenta autorizada configuracion" ON public.configuracion
  FOR ALL TO authenticated
  USING (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid)
  WITH CHECK (auth.uid() = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2'::uuid);

CREATE OR REPLACE FUNCTION public.crear_pedido_web(p_order jsonb, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_price numeric;
  v_name text;
  v_stock_type text;
  v_total numeric := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe incluir al menos un producto';
  END IF;
  IF length(trim(coalesce(p_order->>'cliente_nombre', ''))) = 0
     OR length(trim(coalesce(p_order->>'cliente_telefono', ''))) = 0 THEN
    RAISE EXCEPTION 'Faltan los datos del cliente';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'producto_id', '')::uuid;
    v_quantity := (v_item->>'cantidad')::numeric;
    IF v_product_id IS NULL OR v_quantity <= 0 OR v_quantity > 1000 THEN
      RAISE EXCEPTION 'Producto o cantidad inválidos';
    END IF;
    SELECT precio_venta INTO v_price
      FROM public.productos
      WHERE id = v_product_id AND estado = 'activo';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Uno de los productos ya no está disponible';
    END IF;
    v_total := v_total + v_price * v_quantity;
  END LOOP;

  INSERT INTO public.pedidos (
    codigo, cliente_nombre, cliente_telefono, cliente_email, tipo_entrega,
    direccion_despacho, fecha_entrega, hora_entrega, notas, total, abono,
    saldo_pendiente, medio_pago, estado, origen
  ) VALUES (
    p_order->>'codigo', trim(p_order->>'cliente_nombre'), trim(p_order->>'cliente_telefono'),
    coalesce(p_order->>'cliente_email', ''), coalesce(p_order->>'tipo_entrega', 'retiro'),
    coalesce(p_order->>'direccion_despacho', ''), (p_order->>'fecha_entrega')::date,
    coalesce(p_order->>'hora_entrega', ''), coalesce(p_order->>'notas', ''),
    v_total, 0, v_total, 'Transferencia', 'pendiente', 'web_cliente'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'producto_id', '')::uuid;
    v_quantity := (v_item->>'cantidad')::numeric;
    SELECT nombre, precio_venta, tipo_stock
      INTO v_name, v_price, v_stock_type
      FROM public.productos WHERE id = v_product_id AND estado = 'activo';
    INSERT INTO public.pedido_items (
      pedido_id, producto_id, nombre, precio_unitario, cantidad, subtotal, tipo_stock
    ) VALUES (
      v_order_id, v_product_id, v_name, v_price, v_quantity,
      v_price * v_quantity, v_stock_type
    );
    IF v_stock_type = 'terminado' THEN
      UPDATE public.productos
        SET stock_actual = GREATEST(0, stock_actual - v_quantity)
        WHERE id = v_product_id;
    END IF;
  END LOOP;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_pedido_web(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_pedido_web(jsonb, jsonb) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crear_pedido_con_descuento(text, text, text, text, text, date, text, text, numeric, numeric, text, text, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;
