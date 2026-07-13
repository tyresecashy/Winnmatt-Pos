-- Migration: Atomic stock transfer receive
-- Wraps the entire "receive" workflow in a single PostgreSQL transaction so that
-- inventory debits, credits, status updates, and audit records either all succeed
-- or all roll back together.

CREATE OR REPLACE FUNCTION receive_stock_transfer(
  p_transfer_id UUID,
  p_items JSONB,                         -- [{product_id, quantity}]
  p_received_by UUID,
  p_received_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer        RECORD;
  v_item            JSONB;
  v_product_id      UUID;
  v_quantity        INTEGER;
  v_errors          JSONB := '[]'::JSONB;
  v_source_inv_id   UUID;
  v_source_qty      INTEGER;
BEGIN
  -- 1. Fetch the transfer (must be in_transit)
  SELECT * INTO v_transfer
  FROM stock_transfers
  WHERE id = p_transfer_id AND status = 'in_transit'
  FOR UPDATE;  -- lock row for atomicity

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transfer not found or not in transit'
    );
  END IF;

  -- 2. Process each item: debit source, credit destination
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := (v_item->>'quantity')::INTEGER;

    IF v_quantity <= 0 THEN
      v_errors := v_errors || jsonb_build_object(
        'product_id', v_product_id,
        'error', 'Quantity must be positive'
      );
      CONTINUE;
    END IF;

    -- 2a. Debit source branch inventory (lock row)
    SELECT id, quantity INTO v_source_inv_id, v_source_qty
    FROM inventory
    WHERE branch_id = v_transfer.from_branch_id AND product_id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_errors := v_errors || jsonb_build_object(
        'product_id', v_product_id,
        'error', 'Source branch inventory record not found'
      );
      CONTINUE;
    END IF;

    IF v_source_qty < v_quantity THEN
      v_errors := v_errors || jsonb_build_object(
        'product_id', v_product_id,
        'error', format('Insufficient stock at source: have %s, need %s', v_source_qty, v_quantity)
      );
      CONTINUE;
    END IF;

    UPDATE inventory
    SET quantity = quantity - v_quantity,
        updated_at = p_received_at
    WHERE id = v_source_inv_id;

    -- 2b. Credit destination branch inventory (upsert)
    INSERT INTO inventory (branch_id, product_id, quantity, updated_at)
    VALUES (v_transfer.to_branch_id, v_product_id, v_quantity, p_received_at)
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET quantity = inventory.quantity + v_quantity,
                  updated_at = p_received_at;

    -- 2c. Record stock movements for audit
    INSERT INTO stock_movements (product_id, branch_id, type, quantity, reference_id, notes)
    VALUES (v_product_id, v_transfer.from_branch_id, 'transfer', -v_quantity, p_transfer_id,
            format('Transfer out to %s', v_transfer.to_branch_id));

    INSERT INTO stock_movements (product_id, branch_id, type, quantity, reference_id, notes)
    VALUES (v_product_id, v_transfer.to_branch_id, 'transfer', v_quantity, p_transfer_id,
            format('Transfer in from %s', v_transfer.from_branch_id));

    -- 2d. Update received quantity in transfer items
    UPDATE stock_transfer_items
    SET quantity_received = v_quantity,
        received_quantity = v_quantity
    WHERE stock_transfer_id = p_transfer_id
      AND product_id = v_product_id;
  END LOOP;

  -- 3. If any items had errors, roll back entirely
  IF jsonb_array_length(v_errors) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'One or more items could not be processed',
      'itemErrors', v_errors
    );
  END IF;

  -- 4. Update transfer status
  UPDATE stock_transfers
  SET status = 'received',
      received_by = p_received_by,
      received_at = p_received_at
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
