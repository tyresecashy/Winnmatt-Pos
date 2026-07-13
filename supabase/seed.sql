-- WINNMATT POS Database Seed Data
-- Run this after creating the schema

-- Insert Branches
INSERT INTO branches (name, code, location, is_main) VALUES
  ('Main Store', 'MAIN-001', 'Nairobi CBD', true),
  ('Westlands Branch', 'WEST-001', 'Westlands', false),
  ('Karen Branch', 'KAREN-001', 'Karen', false)
ON CONFLICT DO NOTHING;

-- Insert Categories
INSERT INTO categories (name, description, icon) VALUES
  ('Beverages', 'All drinks including soft drinks, juice, water', '🥤'),
  ('Dairy', 'Milk, cheese, yogurt and other dairy products', '🥛'),
  ('Snacks', 'Chips, biscuits, and packaged snacks', '🍿'),
  ('Confectionery', 'Candy, chocolate, and sweets', '🍬'),
  ('Bakery', 'Bread, cakes, and baked goods', '🍞'),
  ('Frozen', 'Ice cream and frozen foods', '🧊'),
  ('Grains & Cereals', 'Rice, flour, pasta, and cereals', '🌾'),
  ('Oils & Condiments', 'Cooking oils, spices, and sauces', '🫙'),
  ('Cleaning', 'Detergent, soap, and cleaning supplies', '🧹'),
  ('Personal Care', 'Soap, toothpaste, shampoo, and hygiene', '🧴')
ON CONFLICT DO NOTHING;

-- Insert Products
INSERT INTO products (sku, name, description, category_id, purchase_price, selling_price, reorder_level) VALUES
  ('BEV001', 'Coca Cola 500ml', 'Carbonated soft drink', (SELECT id FROM categories WHERE name = 'Beverages'), 4000, 6000, 20),
  ('BEV002', 'Sprite 500ml', 'Lemon-lime flavor soft drink', (SELECT id FROM categories WHERE name = 'Beverages'), 4000, 6000, 20),
  ('BEV003', 'Fanta Orange 500ml', 'Orange flavor soft drink', (SELECT id FROM categories WHERE name = 'Beverages'), 3500, 5500, 25),
  ('BEV004', 'Water 500ml', 'Purified drinking water', (SELECT id FROM categories WHERE name = 'Beverages'), 2000, 3500, 30),
  ('DAI001', 'Milk 1L', 'Fresh whole milk', (SELECT id FROM categories WHERE name = 'Dairy'), 10000, 14500, 15),
  ('DAI002', 'Yogurt 500ml', 'Plain yogurt', (SELECT id FROM categories WHERE name = 'Dairy'), 8000, 12000, 20),
  ('SNK001', 'Lay''s Classic 50g', 'Potato chips classic flavor', (SELECT id FROM categories WHERE name = 'Snacks'), 3500, 5500, 30),
  ('SNK002', 'Doritos 50g', 'Nacho cheese flavor chips', (SELECT id FROM categories WHERE name = 'Snacks'), 3500, 5500, 25),
  ('CON001', 'Mentos 25g', 'Mint candies', (SELECT id FROM categories WHERE name = 'Confectionery'), 1500, 2500, 40),
  ('CON002', 'Cadbury Dairy Milk 45g', 'Chocolate bar', (SELECT id FROM categories WHERE name = 'Confectionery'), 5000, 7500, 20),
  ('BAK001', 'Bread White 700g', 'Sliced white bread', (SELECT id FROM categories WHERE name = 'Bakery'), 8000, 12000, 10),
  ('BAK002', 'Bread Brown 700g', 'Sliced brown bread', (SELECT id FROM categories WHERE name = 'Bakery'), 9000, 13500, 8),
  ('FRZ001', 'Ice Cream 500ml', 'Vanilla ice cream', (SELECT id FROM categories WHERE name = 'Frozen'), 15000, 22000, 10),
  ('GRA001', 'Rice 10kg', 'Long grain white rice', (SELECT id FROM categories WHERE name = 'Grains & Cereals'), 80000, 110000, 5),
  ('OIL001', 'Cooking Oil 2L', 'Vegetable cooking oil', (SELECT id FROM categories WHERE name = 'Oils & Condiments'), 25000, 35000, 8),
  ('CLE001', 'Detergent Powder 1kg', 'Washing powder', (SELECT id FROM categories WHERE name = 'Cleaning'), 12000, 17500, 10),
  ('PER001', 'Soap Bar 150g', 'Bathing soap', (SELECT id FROM categories WHERE name = 'Personal Care'), 3000, 4500, 30),
  ('PER002', 'Toothpaste 120g', 'Fluoride toothpaste', (SELECT id FROM categories WHERE name = 'Personal Care'), 5000, 7500, 15)
ON CONFLICT DO NOTHING;

-- Insert Inventory for Main Store
INSERT INTO inventory (product_id, branch_id, quantity) 
SELECT p.id, b.id, FLOOR(RANDOM() * 100 + 20)::INT
FROM products p
CROSS JOIN branches b
WHERE b.code = 'MAIN-001'
ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Insert Inventory for Westlands Branch
INSERT INTO inventory (product_id, branch_id, quantity)
SELECT p.id, b.id, FLOOR(RANDOM() * 80 + 15)::INT
FROM products p
CROSS JOIN branches b
WHERE b.code = 'WEST-001'
ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Insert Inventory for Karen Branch
INSERT INTO inventory (product_id, branch_id, quantity)
SELECT p.id, b.id, FLOOR(RANDOM() * 60 + 10)::INT
FROM products p
CROSS JOIN branches b
WHERE b.code = 'KAREN-001'
ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Insert Customers
INSERT INTO customers (name, phone, email, type, loyalty_points, credit_limit, credit_balance) VALUES
  ('John Mwangi', '0712345678', 'john@email.com', 'retail', 5000, 0, 0),
  ('Mary Kipchoge', '0798765432', 'mary@email.com', 'retail', 12000, 0, 0),
  ('ABC Supermarket', '0714567890', 'abc@supermarket.co.ke', 'wholesale', 0, 500000, 250000),
  ('XYZ Restaurant', '0723456789', 'xyz@restaurant.co.ke', 'business', 0, 1000000, 450000),
  ('Sarah Kariuki', '0734567890', 'sarah@email.com', 'retail', 3500, 0, 0),
  ('Tech Solutions Ltd', '0745678901', 'tech@company.co.ke', 'business', 0, 750000, 600000)
ON CONFLICT DO NOTHING;

-- Insert Suppliers
INSERT INTO suppliers (name, contact_person, phone, email, payment_terms, balance) VALUES
  ('Fresh Beverages Ltd', 'Mr. Kiprop', '0701234567', 'sales@freshbevs.co.ke', 'Net 30', 150000),
  ('Dairy Farms Kenya', 'Ms. Wanjiru', '0712345678', 'orders@dairyfarms.co.ke', 'Net 15', 200000),
  ('Snacks Wholesale', 'Mr. Ochieng', '0723456789', 'sales@snackswhale.co.ke', 'Net 45', 350000),
  ('Bakery Supplies', 'Ms. Nyambura', '0734567890', 'supply@bakery.co.ke', 'COD', 0),
  ('Commodity Trading', 'Mr. Kamau', '0745678901', 'trade@commodity.co.ke', 'Net 30', 500000)
ON CONFLICT DO NOTHING;
