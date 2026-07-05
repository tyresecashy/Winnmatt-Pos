import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PRODUCT_NAMES = [
  'Milk 1L', 'Bread White', 'Sugar 2kg', 'Rice 5kg', 'Cooking Oil 1L',
  'Eggs 12pk', 'Chicken 1kg', 'Beef 1kg', 'Fish 1kg', 'Tomatoes 1kg',
  'Onions 1kg', 'Potatoes 2kg', 'Carrots 1kg', 'Cabbage 1pc', 'Lettuce 1pc',
  'Bananas 1kg', 'Apples 1kg', 'Oranges 1kg', 'Mangoes 1kg', 'Grapes 500g',
  'Coca-Cola 500ml', 'Fanta 500ml', 'Sprite 500ml', 'Water 1.5L', 'Juice 1L',
  'Yogurt 500g', 'Cheese 200g', 'Butter 250g', 'Cream 200ml', 'Milk Powder 400g',
  'Tea 250g', 'Coffee 200g', 'Biscuits 200g', 'Chips 100g', 'Chocolate 100g',
  'Candy 50g', 'Gum 10pk', 'Noodles 5pk', 'Pasta 500g', 'Sauce 500ml',
  'Salt 1kg', 'Pepper 100g', 'Spices Mix', 'Baking Powder', 'Yeast 500g',
  'Flour 2kg', 'Cornmeal 1kg', 'Beans 1kg', 'Lentils 1kg', 'Split Peas 1kg',
  'Toilet Paper 4pk', 'Tissue 10pk', 'Soap 3pk', 'Shampoo 400ml', 'Toothpaste 100ml',
  'Detergent 1kg', 'Bleach 1L', 'Sponge 3pk', 'Trash Bags 20pk', 'Aluminum Foil',
  'Plastic Wrap', 'Food Container', 'Paper Plates 10pk', 'Cups 10pk', 'Napkins 100pk',
  'Diapers 24pk', 'Wipes 80pk', 'Baby Food 200g', 'Formula 400g', 'Baby Lotion',
  'Dog Food 2kg', 'Cat Food 1kg', 'Pet Treats 200g', 'Bird Seed 500g', 'Fish Food 100g',
  'Light Bulb 4pk', 'Batteries 4pk', 'Candles 4pk', 'Matches 10pk', 'Torch',
  'First Aid Kit', 'Bandages 10pk', 'Pain Relief', 'Cough Syrup', 'Vitamins 30pk',
  'Ice Cream 500ml', 'Frozen Veg 500g', 'Frozen Fries 1kg', 'Frozen Pizza', 'Frozen Meat 1kg',
  'Canned Beans 400g', 'Canned Tomatoes 400g', 'Canned Tuna 150g', 'Canned Fruit 500g', 'Canned Soup 400g',
  'Peanut Butter 500g', 'Jam 500g', 'Honey 500g', 'Syrup 500ml', 'Vinegar 500ml',
];

const CUSTOMER_NAMES = [
  'James Mwangi', 'Mary Wanjiku', 'Peter Ochieng', 'Grace Nyambura', 'John Kamau',
  'Sarah Akinyi', 'David Kipchoge', 'Faith Njeri', 'Michael Otieno', 'Agnes Wairimu',
  'Joseph Maina', 'Elizabeth Adhiambo', 'Daniel Muthomi', 'Patricia Auma', 'Robert Wekesa',
  'Hannah Chebet', 'William Kiptoo', 'Catherine Atieno', 'Patrick Omondi', 'Joyce Moraa',
  'Charles Njoroge', 'Margaret Achieng', 'Francis Kibet', 'Beatrice Wambui', 'Stephen Onyango',
  'Diana Nyokabi', 'Brian Koech', 'Esther Waceke', 'Samuel Mbugua', 'Ruth Adhiambo',
];

const EMPLOYEE_FIRST_NAMES = [
  'Kevin', 'Brian', 'Alex', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Quinn',
  'Avery', 'Riley', 'Jamie', 'Drew', 'Sam', 'Pat', 'Chris', 'Lee',
];

const EMPLOYEE_LAST_NAMES = [
  'Odhiambo', 'Mwangi', 'Kipchoge', 'Wanjiku', 'Nyambura', 'Kamau',
  'Akinyi', 'Njeri', 'Otieno', 'Wairimu', 'Maina', 'Auma', 'Wekesa',
];

const SUPPLIER_NAMES = [
  'Fresh Produce Ltd', 'Dairy Direct', 'Bakery Supplies Co', 'Meat Packers Ltd',
  'Beverage Distributors', 'Household Goods Ltd', 'Canned Foods Ltd', 'Frozen Foods Co',
  'Personal Care Ltd', 'Pet Supplies Co', 'Hardware Supplies', 'Cleaning Products Ltd',
];

const CATEGORIES = [
  'Dairy', 'Bakery', 'Grains', 'Meat', 'Produce', 'Beverages', 'Snacks',
  'Household', 'Personal Care', 'Baby', 'Pet', 'Frozen', 'Canned', 'Condiments',
];

export interface GenerateOptions {
  products?: number;
  customers?: number;
  employees?: number;
  branches?: number;
  sales?: number;
  suppliers?: number;
  purchase_orders?: number;
  returns?: number;
  promotions?: number;
  loyalty_transactions?: number;
}

export interface GenerationResult {
  products: number;
  customers: number;
  employees: number;
  branches: number;
  sales: number;
  suppliers: number;
  purchase_orders: number;
  returns: number;
  promotions: number;
  loyalty_transactions: number;
  total_records: number;
  duration_ms: number;
}

export class TestDataGeneratorService {
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomFloat(min: number, max: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round((Math.random() * (max - min) + min) * factor) / factor;
  }

  private randomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private randomDate(start: Date, end: Date): string {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
  }

  private generateSKU(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = Array(3).fill(0).map(() => letters[Math.floor(Math.random() * letters.length)]).join('');
    const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${suffix}`;
  }

  private generatePhone(): string {
    return `+254${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
  }

  private generateEmail(name: string): string {
    const cleanName = name.toLowerCase().replace(/\s+/g, '.');
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
    return `${cleanName}${Math.floor(Math.random() * 100)}@${this.randomItem(domains)}`;
  }

  async generateProducts(count: number): Promise<any[]> {
    const products = [];
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    for (let i = 0; i < count; i++) {
      const name = i < PRODUCT_NAMES.length ? PRODUCT_NAMES[i] : `Product ${i + 1}`;
      const category = this.randomItem(CATEGORIES);
      const costPrice = this.randomFloat(50, 5000);
      const markup = this.randomFloat(1.2, 2.5);
      const price = Math.round(costPrice * markup);

      products.push({
        name,
        sku: this.generateSKU(),
        category_id: category,
        description: `High quality ${name.toLowerCase()} for your daily needs`,
        purchase_price: Math.round(costPrice),
        selling_price: Math.round(price),
        reorder_level: this.randomInt(10, 50),
        status: Math.random() > 0.1 ? 'active' : 'inactive',
        created_at: this.randomDate(oneYearAgo, now),
        updated_at: now.toISOString(),
      });
    }

    const { data, error } = await supabase.from('products').insert(products).select();
    if (error) throw error;
    return data || [];
  }

  async generateCustomers(count: number): Promise<any[]> {
    const customers = [];
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

    for (let i = 0; i < count; i++) {
      const name = i < CUSTOMER_NAMES.length ? CUSTOMER_NAMES[i] : `Customer ${i + 1}`;
      
      customers.push({
        name,
        email: this.generateEmail(name),
        phone: this.generatePhone(),
        address: `${this.randomInt(1, 500)} ${this.randomItem(['Main', 'Park', 'Hill', 'Lake', 'River'])} Street`,
        city: this.randomItem(['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret']),
        loyalty_points: this.randomInt(0, 5000),
        total_spent_cents: this.randomInt(0, 500000) * 100,
        is_active: Math.random() > 0.05,
        created_at: this.randomDate(twoYearsAgo, now),
        updated_at: now.toISOString(),
      });
    }

    const { data, error } = await supabase.from('customers').insert(customers).select();
    if (error) throw error;
    return data || [];
  }

  async generateEmployees(count: number, branchId: string): Promise<any[]> {
    const employees = [];
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const positions = ['Cashier', 'Shelf Stocker', 'Floor Cleaner', 'Inventory Handler', 'Supervisor', 'Manager'];

    for (let i = 0; i < count; i++) {
      const firstName = this.randomItem(EMPLOYEE_FIRST_NAMES);
      const lastName = this.randomItem(EMPLOYEE_LAST_NAMES);

      employees.push({
        first_name: firstName,
        last_name: lastName,
        email: this.generateEmail(`${firstName} ${lastName}`),
        phone: this.generatePhone(),
        position: this.randomItem(positions),
        department: this.randomItem(['Sales', 'Inventory', 'Operations', 'Finance']),
        branch_id: branchId,
        basic_salary_cents: this.randomInt(25000, 150000) * 100,
        status: this.randomItem(['active', 'active', 'active', 'inactive']),
        hire_date: this.randomDate(oneYearAgo, now).split('T')[0],
        created_at: this.randomDate(oneYearAgo, now),
        updated_at: now.toISOString(),
      });
    }

    const { data, error } = await supabase.from('employee_profiles').insert(employees).select();
    if (error) throw error;
    return data || [];
  }

  async generateBranches(count: number): Promise<any[]> {
    const branches = [];
    const now = new Date();

    const branchNames = [
      'Main Branch', 'Westlands', 'Karen', 'Kilimani', 'Lavington',
      'CBD', 'Eastleigh', 'Langata', 'Kasarani', 'Roysambu',
    ];

    for (let i = 0; i < count; i++) {
      const name = i < branchNames.length ? branchNames[i] : `Branch ${i + 1}`;

      branches.push({
        name: `WinnMatt ${name}`,
        code: `WM${(i + 1).toString().padStart(3, '0')}`,
        address: `${this.randomInt(1, 500)} ${this.randomItem(['Moi', 'Kenyatta', 'Uhuru', 'Oginga', 'Tom'])} Avenue`,
        city: this.randomItem(['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru']),
        phone: this.generatePhone(),
        email: `branch${i + 1}@winnmatt.com`,
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
    }

    const { data, error } = await supabase.from('branches').insert(branches).select();
    if (error) throw error;
    return data || [];
  }

  async generateSales(count: number, branchId: string, customerIds: string[]): Promise<any[]> {
    const sales = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < count; i++) {
      const totalAmount = this.randomInt(100, 50000);
      const taxRate = 0.16;
      const subtotal = Math.round(totalAmount / (1 + taxRate));
      const tax = totalAmount - subtotal;

      sales.push({
        receipt_number: `RCP-${(i + 1).toString().padStart(6, '0')}`,
        branch_id: branchId,
        customer_id: Math.random() > 0.3 ? this.randomItem(customerIds) : null,
        cashier_id: `cashier-${this.randomInt(1, 5)}`,
        subtotal_cents: subtotal * 100,
        tax_cents: tax * 100,
        total_amount_cents: totalAmount * 100,
        payment_method: this.randomItem(['cash', 'mpesa', 'card', 'card', 'cash']),
        status: this.randomItem(['completed', 'completed', 'completed', 'refunded']),
        created_at: this.randomDate(thirtyDaysAgo, now),
        updated_at: now.toISOString(),
      });
    }

    const { data, error } = await supabase.from('sales').insert(sales).select();
    if (error) throw error;
    return data || [];
  }

  async generateSuppliers(count: number): Promise<any[]> {
    const suppliers = [];
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    for (let i = 0; i < count; i++) {
      const name = i < SUPPLIER_NAMES.length ? SUPPLIER_NAMES[i] : `Supplier ${i + 1}`;

      suppliers.push({
        name,
        contact_person: this.randomItem(EMPLOYEE_FIRST_NAMES) + ' ' + this.randomItem(EMPLOYEE_LAST_NAMES),
        email: this.generateEmail(name),
        phone: this.generatePhone(),
        address: `${this.randomInt(1, 200)} Industrial Area`,
        city: this.randomItem(['Nairobi', 'Mombasa', 'Kisumu']),
        payment_terms: this.randomItem(['Net 30', 'Net 60', 'Net 90']),
        rating: this.randomFloat(3.0, 5.0),
        is_active: true,
        created_at: this.randomDate(oneYearAgo, now),
        updated_at: now.toISOString(),
      });
    }

    const { data, error } = await supabase.from('suppliers').insert(suppliers).select();
    if (error) throw error;
    return data || [];
  }

  async generateAll(options: GenerateOptions): Promise<GenerationResult> {
    const startTime = Date.now();
    const result: GenerationResult = {
      products: 0,
      customers: 0,
      employees: 0,
      branches: 0,
      sales: 0,
      suppliers: 0,
      purchase_orders: 0,
      returns: 0,
      promotions: 0,
      loyalty_transactions: 0,
      total_records: 0,
      duration_ms: 0,
    };

    try {
      // Generate branches first
      if (options.branches && options.branches > 0) {
        const branches = await this.generateBranches(options.branches);
        result.branches = branches.length;

        // Generate employees for first branch
        if (options.employees && options.employees > 0 && branches[0]) {
          const employees = await this.generateEmployees(options.employees, branches[0].id);
          result.employees = employees.length;
        }
      }

      // Generate products
      if (options.products && options.products > 0) {
        const products = await this.generateProducts(options.products);
        result.products = products.length;
      }

      // Generate customers
      if (options.customers && options.customers > 0) {
        const customers = await this.generateCustomers(options.customers);
        result.customers = customers.length;

        // Generate sales
        if (options.sales && options.sales > 0) {
          const branches = await supabase.from('branches').select('id').limit(1);
          const branchId = branches.data?.[0]?.id;
          if (branchId) {
            const customerIds = customers.map(c => c.id);
            const sales = await this.generateSales(options.sales, branchId, customerIds);
            result.sales = sales.length;
          }
        }
      }

      // Generate suppliers
      if (options.suppliers && options.suppliers > 0) {
        const suppliers = await this.generateSuppliers(options.suppliers);
        result.suppliers = suppliers.length;
      }

    } catch (error) {
      console.error('Error generating test data:', error);
      throw error;
    }

    result.total_records = result.products + result.customers + result.employees +
      result.branches + result.sales + result.suppliers;
    result.duration_ms = Date.now() - startTime;

    return result;
  }

  async clearTestData(): Promise<void> {
    // Clear in reverse order of dependencies
    await supabase.from('sale_items').delete().neq('id', '');
    await supabase.from('sales').delete().neq('id', '');
    await supabase.from('employee_profiles').delete().neq('id', '');
    await supabase.from('customers').delete().neq('id', '');
    await supabase.from('products').delete().neq('id', '');
    await supabase.from('suppliers').delete().neq('id', '');
    await supabase.from('branches').delete().neq('id', '');
  }

  async getGenerationStats(): Promise<any> {
    const [products, customers, employees, sales, suppliers, branches] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('employee_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('sales').select('id', { count: 'exact', head: true }),
      supabase.from('suppliers').select('id', { count: 'exact', head: true }),
      supabase.from('branches').select('id', { count: 'exact', head: true }),
    ]);

    return {
      products: products.count || 0,
      customers: customers.count || 0,
      employees: employees.count || 0,
      sales: sales.count || 0,
      suppliers: suppliers.count || 0,
      branches: branches.count || 0,
    };
  }
}

export const testDataGeneratorService = new TestDataGeneratorService();
