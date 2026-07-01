-- WINNMATT POS: Cash Sale Transaction RPC
-- Phase P2
-- Apply this in Supabase SQL Editor before relying on the DB-side cash save path.

BEGIN;

CREATE OR REPLACE FUNCTION save_cash_sale_transaction(
  p_sale_id UUID,
  p_branch_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_subtotal INTEGER,
  p_discount_amount INTEGER,
  p_total_amount INTEGER,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_receipt_number TEXT,
  p_notes TEXT,
  p_written_at TIMESTAMP,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_requested_count INTEGER;
  v_locked_count INTEGER;
  v_missing_product_id UUID;
  v_insufficient_product_name TEXT;
  v_insufficient_available INTEGER;
  v_insufficient_requested INTEGER;
  v_sale JSONB;
  v_items JSONB;
BEGIN
  IF p_payment_method <> 'cash' THEN
    RAISE EXCEPTION 'save_cash_sale_transaction only supports cash sales';
  END IF;

  IF p_payment_status <> 'completed' THEN
    RAISE EXCEPTION 'save_cash_sale_transaction only supports completed cash sales';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Sale must include at least one item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS item(
      id UUID,
      product_id UUID,
      quantity INTEGER,
      unit_price INTEGER,
      discount_percent INTEGER,
      line_total INTEGER,
      created_at TIMESTAMP
    )
    WHERE item.quantity <= 0 OR item.unit_price < 0 OR item.line_total < 0
  ) THEN
    RAISE EXCEPTION 'Sale items contain invalid quantity or pricing values';
  END IF;

  WITH requested AS (
    SELECT item.product_id, SUM(item.quantity)::INTEGER AS requested_quantity
    FROM jsonb_to_recordset(p_items) AS item(
      id UUID,
      product_id UUID,
      quantity INTEGER,
      unit_price INTEGER,
      discount_percent INTEGER,
      line_total INTEGER,
      created_at TIMESTAMP
    )
    GROUP BY item.product_id
  ),
  locked_inventory AS (
    SELECT i.id, i.product_id, i.quantity
    FROM inventory i
    JOIN requested r ON r.product_id = i.product_id
    WHERE i.branch_id = p_branch_id
    FOR UPDATE
  )
  SELECT
    (SELECT COUNT(*) FROM requested),
    (SELECT COUNT(*) FROM locked_inventory)
  INTO v_requested_count, v_locked_count;

  IF v_requested_count <> v_locked_count THEN
    WITH requested AS (
      SELECT item.product_id, SUM(item.quantity)::INTEGER AS requested_quantity
      FROM jsonb_to_recordset(p_items) AS item(
        id UUID,
        product_id UUID,
        quantity INTEGER,
        unit_price INTEGER,
        discount_percent INTEGER,
        line_total INTEGER,
        created_at TIMESTAMP
      )
      GROUP BY item.product_id
    ),
    locked_inventory AS (
      SELECT i.product_id
      FROM inventory i
      JOIN requested r ON r.product_id = i.product_id
      WHERE i.branch_id = p_branch_id
      FOR UPDATE
    )
    SELECT r.product_id
    INTO v_missing_product_id
    FROM requested r
    LEFT JOIN locked_inventory li ON li.product_id = r.product_id
    WHERE li.product_id IS NULL
    LIMIT 1;

    RAISE EXCEPTION 'Inventory not found for product % at branch %', v_missing_product_id, p_branch_id;
  END IF;

  WITH requested AS (
    SELECT item.product_id, SUM(item.quantity)::INTEGER AS requested_quantity
    FROM jsonb_to_recordset(p_items) AS item(
      id UUID,
      product_id UUID,
      quantity INTEGER,
      unit_price INTEGER,
      discount_percent INTEGER,
      line_total INTEGER,
      created_at TIMESTAMP
    )
    GROUP BY item.product_id
  )
  SELECT
    p.name,
    i.quantity,
    r.requested_quantity
  INTO
    v_insufficient_product_name,
    v_insufficient_available,
    v_insufficient_requested
  FROM requested r
  JOIN inventory i
    ON i.product_id = r.product_id
   AND i.branch_id = p_branch_id
  JOIN products p
    ON p.id = r.product_id
  WHERE i.quantity < r.requested_quantity
  LIMIT 1;

  IF v_insufficient_product_name IS NOT NULL THEN
    RAISE EXCEPTION
      'Insufficient stock for %: only % available for requested quantity %',
      v_insufficient_product_name,
      v_insufficient_available,
      v_insufficient_requested;
  END IF;

  INSERT INTO sales (
    id,
    branch_id,
    cashier_id,
    customer_id,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    payment_method,
    payment_status,
    receipt_number,
    notes,
    created_at,
    updated_at
  ) VALUES (
    p_sale_id,
    p_branch_id,
    p_cashier_id,
    p_customer_id,
    p_subtotal,
    p_discount_amount,
    0,
    p_total_amount,
    p_payment_method,
    p_payment_status,
    p_receipt_number,
    p_notes,
    p_written_at,
    p_written_at
  );

  INSERT INTO sale_items (
    id,
    sale_id,
    product_id,
    quantity,
    unit_price,
    discount_percent,
    line_total,
    created_at
  )
  SELECT
    item.id,
    p_sale_id,
    item.product_id,
    item.quantity,
    item.unit_price,
    item.discount_percent,
    item.line_total,
    COALESCE(item.created_at, p_written_at)
  FROM jsonb_to_recordset(p_items) AS item(
    id UUID,
    product_id UUID,
    quantity INTEGER,
    unit_price INTEGER,
    discount_percent INTEGER,
    line_total INTEGER,
    created_at TIMESTAMP
  );

  WITH requested AS (
    SELECT item.product_id, SUM(item.quantity)::INTEGER AS requested_quantity
    FROM jsonb_to_recordset(p_items) AS item(
      id UUID,
      product_id UUID,
      quantity INTEGER,
      unit_price INTEGER,
      discount_percent INTEGER,
      line_total INTEGER,
      created_at TIMESTAMP
    )
    GROUP BY item.product_id
  )
  UPDATE inventory AS i
  SET
    quantity = i.quantity - requested.requested_quantity,
    updated_at = p_written_at
  FROM requested
  WHERE i.branch_id = p_branch_id
    AND i.product_id = requested.product_id;

  INSERT INTO stock_movements (
    product_id,
    branch_id,
    type,
    quantity,
    reference_id,
    notes,
    created_at
  )
  SELECT
    item.product_id,
    p_branch_id,
    'sale',
    -item.quantity,
    p_sale_id::TEXT,
    NULL,
    COALESCE(item.created_at, p_written_at)
  FROM jsonb_to_recordset(p_items) AS item(
    id UUID,
    product_id UUID,
    quantity INTEGER,
    unit_price INTEGER,
    discount_percent INTEGER,
    line_total INTEGER,
    created_at TIMESTAMP
  );

  SELECT jsonb_build_object(
    'id', p_sale_id,
    'branch_id', p_branch_id,
    'cashier_id', p_cashier_id,
    'customer_id', p_customer_id,
    'subtotal', p_subtotal,
    'discount_amount', p_discount_amount,
    'tax_amount', 0,
    'total_amount', p_total_amount,
    'payment_method', p_payment_method,
    'payment_status', p_payment_status,
    'receipt_number', p_receipt_number,
    'notes', p_notes,
    'created_at', p_written_at,
    'updated_at', p_written_at
  )
  INTO v_sale;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'sale_id', p_sale_id,
        'product_id', item.product_id,
        'quantity', item.quantity,
        'unit_price', item.unit_price,
        'discount_percent', item.discount_percent,
        'line_total', item.line_total,
        'created_at', COALESCE(item.created_at, p_written_at),
        'product', jsonb_build_object(
          'id', p.id,
          'sku', p.sku,
          'name', p.name
        )
      )
    ),
    '[]'::JSONB
  )
  INTO v_items
  FROM jsonb_to_recordset(p_items) AS item(
    id UUID,
    product_id UUID,
    quantity INTEGER,
    unit_price INTEGER,
    discount_percent INTEGER,
    line_total INTEGER,
    created_at TIMESTAMP
  )
  JOIN products p
    ON p.id = item.product_id;

  RETURN jsonb_build_object(
    'sale', v_sale,
    'items', v_items
  );
END;
$$;

COMMENT ON FUNCTION save_cash_sale_transaction(
  UUID,
  UUID,
  UUID,
  UUID,
  INTEGER,
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMP,
  JSONB
) IS 'Atomically persists a completed cash sale, sale_items, inventory decrements, and stock movements in one transaction.';

COMMIT;
