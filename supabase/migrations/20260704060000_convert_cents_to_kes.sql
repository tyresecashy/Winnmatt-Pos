-- Migration: Convert all monetary values from cents to KES
-- Divides all monetary column values by 100. Only values > 100 are updated.

-- 1. Products
UPDATE products SET selling_price = ROUND(selling_price / 100) WHERE selling_price > 100;
UPDATE products SET purchase_price = ROUND(purchase_price / 100) WHERE purchase_price > 100;
UPDATE products SET wholesale_price = ROUND(wholesale_price / 100) WHERE wholesale_price IS NOT NULL AND wholesale_price > 100;
UPDATE products SET promotion_price = ROUND(promotion_price / 100) WHERE promotion_price IS NOT NULL AND promotion_price > 100;
UPDATE products SET staff_price = ROUND(staff_price / 100) WHERE staff_price IS NOT NULL AND staff_price > 100;
UPDATE products SET vip_price = ROUND(vip_price / 100) WHERE vip_price IS NOT NULL AND vip_price > 100;

-- 2. Sales
UPDATE sales SET subtotal = ROUND(subtotal / 100) WHERE subtotal > 100;
UPDATE sales SET discount_amount = ROUND(discount_amount / 100) WHERE discount_amount > 100;
UPDATE sales SET tax_amount = ROUND(tax_amount / 100) WHERE tax_amount > 100;
UPDATE sales SET total_amount = ROUND(total_amount / 100) WHERE total_amount > 100;

-- 3. Sale items
UPDATE sale_items SET unit_price = ROUND(unit_price / 100) WHERE unit_price > 100;
UPDATE sale_items SET line_total = ROUND(line_total / 100) WHERE line_total > 100;

-- 4. Customers
UPDATE customers SET credit_limit = ROUND(credit_limit / 100) WHERE credit_limit > 100;
UPDATE customers SET credit_balance = ROUND(credit_balance / 100) WHERE credit_balance > 100;
UPDATE customers SET total_lifetime_spend_cents = ROUND(total_lifetime_spend_cents / 100) WHERE total_lifetime_spend_cents > 100;

-- 5. Suppliers
UPDATE suppliers SET balance = ROUND(balance / 100) WHERE balance > 100;
UPDATE suppliers SET credit_limit = ROUND(credit_limit / 100) WHERE credit_limit > 100;
UPDATE suppliers SET total_purchase_amount = ROUND(total_purchase_amount / 100) WHERE total_purchase_amount > 100;

-- 6. Credit payments
UPDATE credit_payments SET amount_cents = ROUND(amount_cents / 100) WHERE amount_cents > 100;

-- 7. Invoices
UPDATE invoices SET total_amount_cents = ROUND(total_amount_cents / 100) WHERE total_amount_cents > 100;
UPDATE invoices SET paid_amount_cents = ROUND(paid_amount_cents / 100) WHERE paid_amount_cents > 100;

-- 8. Invoice items
UPDATE invoice_items SET unit_price_cents = ROUND(unit_price_cents / 100) WHERE unit_price_cents > 100;
UPDATE invoice_items SET total_cents = ROUND(total_cents / 100) WHERE total_cents > 100;
UPDATE invoice_items SET tax_cents = ROUND(tax_cents / 100) WHERE tax_cents > 100;

-- 9. Expenses
UPDATE expenses SET amount_cents = ROUND(amount_cents / 100) WHERE amount_cents > 100;

-- 10. Recurring expenses
UPDATE recurring_expenses SET amount_cents = ROUND(amount_cents / 100) WHERE amount_cents > 100;

-- 11. Cash drawers (skip if table doesn't have these columns)
-- UPDATE cash_drawers SET opening_float = ROUND(opening_float / 100) WHERE opening_float > 100;
-- UPDATE cash_drawers SET current_balance = ROUND(current_balance / 100) WHERE current_balance > 100;
-- UPDATE cash_drawers SET counted_cash = ROUND(counted_cash / 100) WHERE counted_cash IS NOT NULL AND counted_cash > 100;

-- 12. Promotions
UPDATE promotions SET min_purchase_cents = ROUND(min_purchase_cents / 100) WHERE min_purchase_cents > 100;
UPDATE promotions SET max_discount_cents = ROUND(max_discount_cents / 100) WHERE max_discount_cents > 100;
UPDATE promotions SET value = ROUND(value / 100) WHERE type = 'fixed_amount' AND value > 100;

-- 13. Purchase orders
UPDATE purchase_orders SET subtotal = ROUND(subtotal / 100) WHERE subtotal > 100;
UPDATE purchase_orders SET total_amount = ROUND(total_amount / 100) WHERE total_amount > 100;
UPDATE purchase_order_items SET unit_price = ROUND(unit_price / 100) WHERE unit_price > 100;
UPDATE purchase_order_items SET line_total = ROUND(line_total / 100) WHERE line_total > 100;
