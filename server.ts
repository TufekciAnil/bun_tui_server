// ===== INTERFACES =====
interface Customer {
  id: string;
  CustomerName: string;
  CustomerPhone: string;
  CustomerAddress: string;
  CustomerTCKN: string;
  CustomerVD: string;
  CustomerDebt: number;
  CustomerBalance: number;
  CustomerPayments?: string[];
  CustomerOrders?: string[];
  CustomerShipments?: string[];
}

interface CustomerInfo {
  id: string;
  CustomerName: string;
  CustomerPhone: string;
  CustomerAddress: string;
  CustomerTCKN: string;
  CustomerVD: string;
}

interface Product {
  id: string;
  ProductCode: string;
  Details: string;
  Barcode: string;
  Price: number;
  Category: string;
  ActualInventory: number;
  ReservedInventory: number;
  AwaitingInventory: number;
}

interface OrderItem {
  ProductCode: string;
  Category: string;
  Quantity: number;
}

interface Order {
  id: string;
  OrderDate: string;
  CustomerId: string;
  CustomerInfo: CustomerInfo;
  OrderItems: OrderItem[];
  TotalCost: number;
  Discount: number;
  GeneralSum: number;
  PaymentType: string;
  OrderNotes: string;
}

interface Payment {
  id: string;
  IncomeOrExpense: boolean; // income:true expense:false
  ResponsibleId: string;
  PaymentDate: string;
  PaymentCost: number;
  IsDone: boolean;
}

// ===== LOGGING =====
const logger = {
  info: (message: string, data?: any) => {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      data
    };
    if(!shouldStartTui) console.log(JSON.stringify(log));
    Bun.write('app.log', JSON.stringify(log) + '\n', { createPath: true });
  },
  error: (message: string, error?: any) => {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      error: error?.message || error
    };
    if(!shouldStartTui) console.error(JSON.stringify(log));
    Bun.write('error.log', JSON.stringify(log) + '\n', { createPath: true });
  },
  request: (method: string, url: string, body?: any) => {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'REQUEST',
      method,
      url,
      body
    };
    if(!shouldStartTui) console.log(JSON.stringify(log));
    Bun.write('requests.log', JSON.stringify(log) + '\n', { createPath: true });
  }
};

// ===== DATABASE =====
import { Database } from "bun:sqlite";

const db = new Database("business.sqlite");

// Initialize tables
const initDB = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      CustomerName TEXT NOT NULL,
      CustomerPhone TEXT,
      CustomerAddress TEXT,
      CustomerTCKN TEXT,
      CustomerVD TEXT,
      CustomerDebt REAL DEFAULT 0,
      CustomerBalance REAL DEFAULT 0,
      CustomerPayments TEXT,
      CustomerOrders TEXT,
      CustomerShipments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      ProductCode TEXT UNIQUE NOT NULL,
      Details TEXT,
      Barcode TEXT,
      Price REAL NOT NULL,
      Category TEXT,
      ActualInventory INTEGER DEFAULT 0,
      ReservedInventory INTEGER DEFAULT 0,
      AwaitingInventory INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      OrderDate TEXT NOT NULL,
      CustomerId TEXT NOT NULL,
      CustomerInfo TEXT NOT NULL,
      OrderItems TEXT NOT NULL,
      TotalCost REAL NOT NULL,
      Discount REAL DEFAULT 0,
      GeneralSum REAL NOT NULL,
      PaymentType TEXT,
      OrderNotes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (CustomerId) REFERENCES customers (id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      IncomeOrExpense BOOLEAN NOT NULL,
      ResponsibleId TEXT NOT NULL,
      PaymentDate TEXT NOT NULL,
      PaymentCost REAL NOT NULL,
      IsDone BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  logger.info('Database initialized');
};

// ===== DATABASE OPERATIONS =====
const customerOps = {
  create: (customer: Omit<Customer, 'id'>) => {
    const id = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO customers (id, CustomerName, CustomerPhone, CustomerAddress, CustomerTCKN, CustomerVD, CustomerDebt, CustomerBalance, CustomerPayments, CustomerOrders, CustomerShipments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      customer.CustomerName,
      customer.CustomerPhone,
      customer.CustomerAddress,
      customer.CustomerTCKN,
      customer.CustomerVD,
      customer.CustomerDebt,
      customer.CustomerBalance,
      JSON.stringify(customer.CustomerPayments || []),
      JSON.stringify(customer.CustomerOrders || []),
      JSON.stringify(customer.CustomerShipments || [])
    );
    
    return { id, ...customer };
  },

  getAll: () => {
    const stmt = db.prepare('SELECT * FROM customers');
    return stmt.all().map(row => ({
      ...row,
      CustomerPayments: JSON.parse(row.CustomerPayments || '[]'),
      CustomerOrders: JSON.parse(row.CustomerOrders || '[]'),
      CustomerShipments: JSON.parse(row.CustomerShipments || '[]')
    }));
  },

  getById: (id: string) => {
    const stmt = db.prepare('SELECT * FROM customers WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    
    return {
      ...row,
      CustomerPayments: JSON.parse(row.CustomerPayments || '[]'),
      CustomerOrders: JSON.parse(row.CustomerOrders || '[]'),
      CustomerShipments: JSON.parse(row.CustomerShipments || '[]')
    };
  },

  update: (id: string, updates: Partial<Customer>) => {
    const current = customerOps.getById(id);
    if (!current) return null;

    const stmt = db.prepare(`
      UPDATE customers 
      SET CustomerName = ?, CustomerPhone = ?, CustomerAddress = ?, CustomerTCKN = ?, CustomerVD = ?, CustomerDebt = ?, CustomerBalance = ?
      WHERE id = ?
    `);
    
    stmt.run(
      updates.CustomerName || current.CustomerName,
      updates.CustomerPhone || current.CustomerPhone,
      updates.CustomerAddress || current.CustomerAddress,
      updates.CustomerTCKN || current.CustomerTCKN,
      updates.CustomerVD || current.CustomerVD,
      updates.CustomerDebt || current.CustomerDebt,
      updates.CustomerBalance || current.CustomerBalance,
      id
    );
    
    return customerOps.getById(id);
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM customers WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
};

const productOps = {
  create: (product: Omit<Product, 'id'>) => {
    const id = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO products (id, ProductCode, Details, Barcode, Price, Category, ActualInventory, ReservedInventory, AwaitingInventory)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      product.ProductCode,
      product.Details,
      product.Barcode,
      product.Price,
      product.Category,
      product.ActualInventory,
      product.ReservedInventory,
      product.AwaitingInventory
    );
    
    return { id, ...product };
  },

  getAll: () => {
    const stmt = db.prepare('SELECT * FROM products');
    return stmt.all();
  },

  getById: (id: string) => {
    const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
    return stmt.get(id);
  },

  getByCode: (code: string) => {
    const stmt = db.prepare('SELECT * FROM products WHERE ProductCode = ?');
    return stmt.get(code);
  },

  update: (id: string, updates: Partial<Product>) => {
    const current = productOps.getById(id);
    if (!current) return null;

    const stmt = db.prepare(`
      UPDATE products 
      SET ProductCode = ?, Details = ?, Barcode = ?, Price = ?, Category = ?, ActualInventory = ?, ReservedInventory = ?, AwaitingInventory = ?
      WHERE id = ?
    `);
    
    stmt.run(
      updates.ProductCode || current.ProductCode,
      updates.Details || current.Details,
      updates.Barcode || current.Barcode,
      updates.Price || current.Price,
      updates.Category || current.Category,
      updates.ActualInventory || current.ActualInventory,
      updates.ReservedInventory || current.ReservedInventory,
      updates.AwaitingInventory || current.AwaitingInventory,
      id
    );
    
    return productOps.getById(id);
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM products WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
};

// ===== API HANDLERS =====
const apiResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
};

const handleCustomers = async (req: Request, pathParts: string[]) => {
  const method = req.method;
  const id = pathParts[3]; // /api/customers/{id}

  try {
    switch (method) {
      case 'GET':
        if (id) {
          const customer = customerOps.getById(id);
          return customer ? apiResponse(customer) : apiResponse({ error: 'Customer not found' }, 404);
        }
        return apiResponse(customerOps.getAll());

      case 'POST':
        const newCustomer = await req.json();
        const created = customerOps.create(newCustomer);
        logger.info('Customer created', { id: created.id });
        return apiResponse(created, 201);

      case 'PUT':
        if (!id) return apiResponse({ error: 'ID required' }, 400);
        const updates = await req.json();
        const updated = customerOps.update(id, updates);
        return updated ? apiResponse(updated) : apiResponse({ error: 'Customer not found' }, 404);

      case 'DELETE':
        if (!id) return apiResponse({ error: 'ID required' }, 400);
        const deleted = customerOps.delete(id);
        return deleted ? apiResponse({ success: true }) : apiResponse({ error: 'Customer not found' }, 404);

      default:
        return apiResponse({ error: 'Method not allowed' }, 405);
    }
  } catch (error) {
    logger.error('Customer operation failed', error);
    return apiResponse({ error: 'Internal server error' }, 500);
  }
};

const handleProducts = async (req: Request, pathParts: string[]) => {
  const method = req.method;
  const id = pathParts[3]; // /api/products/{id}

  try {
    switch (method) {
      case 'GET':
        if (id) {
          const product = productOps.getById(id);
          return product ? apiResponse(product) : apiResponse({ error: 'Product not found' }, 404);
        }
        return apiResponse(productOps.getAll());

      case 'POST':
        const newProduct = await req.json();
        const created = productOps.create(newProduct);
        logger.info('Product created', { id: created.id });
        return apiResponse(created, 201);

      case 'PUT':
        if (!id) return apiResponse({ error: 'ID required' }, 400);
        const updates = await req.json();
        const updated = productOps.update(id, updates);
        return updated ? apiResponse(updated) : apiResponse({ error: 'Product not found' }, 404);

      case 'DELETE':
        if (!id) return apiResponse({ error: 'ID required' }, 400);
        const deleted = productOps.delete(id);
        return deleted ? apiResponse({ success: true }) : apiResponse({ error: 'Product not found' }, 404);

      default:
        return apiResponse({ error: 'Method not allowed' }, 405);
    }
  } catch (error) {
    logger.error('Product operation failed', error);
    return apiResponse({ error: 'Internal server error' }, 500);
  }
};

// ===== DOCUMENTATION =====
const getDocumentationHTML = () => `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Business API Documentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #f5f5f5;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        header { background: #2c3e50; color: white; padding: 2rem 0; margin-bottom: 2rem; }
        h1 { text-align: center; font-size: 2.5rem; }
        .subtitle { text-align: center; opacity: 0.8; margin-top: 0.5rem; }
        .endpoint { 
            background: white; 
            margin: 1rem 0; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .method { 
            padding: 1rem; 
            font-weight: bold; 
            color: white; 
        }
        .get { background: #27ae60; }
        .post { background: #3498db; }
        .put { background: #f39c12; }
        .delete { background: #e74c3c; }
        .content { padding: 1.5rem; }
        .url { font-family: monospace; font-size: 1.1rem; margin: 0.5rem 0; }
        .description { color: #666; margin: 1rem 0; }
        .example { 
            background: #f8f9fa; 
            border: 1px solid #e9ecef; 
            border-radius: 4px; 
            padding: 1rem; 
            margin: 1rem 0;
        }
        .example h4 { margin-bottom: 0.5rem; color: #495057; }
        pre { 
            background: #2c3e50; 
            color: #ecf0f1; 
            padding: 1rem; 
            border-radius: 4px; 
            overflow-x: auto;
            font-size: 0.9rem;
        }
        .try-btn { 
            background: #27ae60; 
            color: white; 
            border: none; 
            padding: 0.5rem 1rem; 
            border-radius: 4px; 
            cursor: pointer; 
            margin-top: 1rem;
            transition: background 0.3s;
        }
        .try-btn:hover { background: #229954; }
        .result { 
            margin-top: 1rem; 
            padding: 1rem; 
            background: #f8f9fa; 
            border-radius: 4px; 
            display: none;
        }
        .success { border-left: 4px solid #27ae60; }
        .error { border-left: 4px solid #e74c3c; }
        .nav { 
            background: white; 
            padding: 1rem; 
            border-radius: 8px; 
            margin-bottom: 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .nav a { 
            color: #3498db; 
            text-decoration: none; 
            margin-right: 1rem; 
            padding: 0.5rem 1rem;
            border-radius: 4px;
            transition: background 0.3s;
        }
        .nav a:hover { background: #ecf0f1; }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <h1>🚀 Business API</h1>
            <p class="subtitle">RESTful API for Customer & Product Management</p>
        </div>
    </header>

    <div class="container">
        <nav class="nav">
            <a href="#customers">👥 Customers</a>
            <a href="#products">📦 Products</a>
            <a href="#health">💚 Health Check</a>
        </nav>

        <div id="health" class="endpoint">
            <div class="method get">GET</div>
            <div class="content">
                <div class="url">/health</div>
                <div class="description">Sistemin sağlık durumunu kontrol eder</div>
                <button class="try-btn" onclick="tryRequest('GET', '/health')">Dene</button>
                <div id="result-health" class="result"></div>
            </div>
        </div>

        <h2 id="customers">👥 Customer Endpoints</h2>
        
        <div class="endpoint">
            <div class="method get">GET</div>
            <div class="content">
                <div class="url">/api/customers</div>
                <div class="description">Tüm müşterileri listeler</div>
                <button class="try-btn" onclick="tryRequest('GET', '/api/customers')">Dene</button>
                <div id="result-get-customers" class="result"></div>
            </div>
        </div>

        <div class="endpoint">
            <div class="method get">GET</div>
            <div class="content">
                <div class="url">/api/customers/{id}</div>
                <div class="description">Belirli bir müşteriyi getirir</div>
                <div class="example">
                    <h4>Örnek:</h4>
                    <pre>GET /api/customers/123e4567-e89b-12d3-a456-426614174000</pre>
                </div>
            </div>
        </div>

        <div class="endpoint">
            <div class="method post">POST</div>
            <div class="content">
                <div class="url">/api/customers</div>
                <div class="description">Yeni müşteri oluşturur</div>
                <div class="example">
                    <h4>Request Body:</h4>
                    <pre>{
  "CustomerName": "Ahmet Yılmaz",
  "CustomerPhone": "555-1234",
  "CustomerAddress": "İstanbul",
  "CustomerTCKN": "12345678901",
  "CustomerVD": "1234567890",
  "CustomerDebt": 0,
  "CustomerBalance": 1000
}</pre>
                </div>
                <button class="try-btn" onclick="tryCustomerPost()">Dene</button>
                <div id="result-post-customer" class="result"></div>
            </div>
        </div>

        <div class="endpoint">
            <div class="method put">PUT</div>
            <div class="content">
                <div class="url">/api/customers/{id}</div>
                <div class="description">Müşteri bilgilerini günceller</div>
                <div class="example">
                    <h4>Request Body:</h4>
                    <pre>{
  "CustomerName": "Mehmet Demir",
  "CustomerPhone": "555-5678"
}</pre>
                </div>
            </div>
        </div>

        <div class="endpoint">
            <div class="method delete">DELETE</div>
            <div class="content">
                <div class="url">/api/customers/{id}</div>
                <div class="description">Müşteriyi siler</div>
            </div>
        </div>

        <h2 id="products">📦 Product Endpoints</h2>

        <div class="endpoint">
            <div class="method get">GET</div>
            <div class="content">
                <div class="url">/api/products</div>
                <div class="description">Tüm ürünleri listeler</div>
                <button class="try-btn" onclick="tryRequest('GET', '/api/products')">Dene</button>
                <div id="result-get-products" class="result"></div>
            </div>
        </div>

        <div class="endpoint">
            <div class="method post">POST</div>
            <div class="content">
                <div class="url">/api/products</div>
                <div class="description">Yeni ürün oluşturur</div>
                <div class="example">
                    <h4>Request Body:</h4>
                    <pre>{
  "ProductCode": "PR001",
  "Details": "Yüksek kaliteli ürün",
  "Barcode": "1234567890123",
  "Price": 99.99,
  "Category": "Elektronik",
  "ActualInventory": 100,
  "ReservedInventory": 10,
  "AwaitingInventory": 5
}</pre>
                </div>
                <button class="try-btn" onclick="tryProductPost()">Dene</button>
                <div id="result-post-product" class="result"></div>
            </div>
        </div>

    </div>

    <script>
        async function tryRequest(method, url, body = null) {
            const resultId = 'result-' + method.toLowerCase() + '-' + url.replace(/\//g, '').replace(/[{}]/g, '');
            const resultDiv = document.getElementById(resultId);
            
            try {
                const options = {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                
                if (body) {
                    options.body = JSON.stringify(body);
                }
                
                const response = await fetch(url, options);
                const data = await response.json();
                
                resultDiv.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                resultDiv.className = 'result ' + (response.ok ? 'success' : 'error');
                resultDiv.style.display = 'block';
                
            } catch (error) {
                resultDiv.innerHTML = '<pre>Error: ' + error.message + '</pre>';
                resultDiv.className = 'result error';
                resultDiv.style.display = 'block';
            }
        }

        function tryCustomerPost() {
            const customerData = {
                CustomerName: "Test Müşteri",
                CustomerPhone: "555-0000",
                CustomerAddress: "Test Adres",
                CustomerTCKN: "12345678901",
                CustomerVD: "1234567890",
                CustomerDebt: 0,
                CustomerBalance: 500
            };
            tryRequest('POST', '/api/customers', customerData);
        }

        function tryProductPost() {
            const productData = {
                ProductCode: "TEST001",
                Details: "Test ürünü",
                Barcode: "1234567890123",
                Price: 29.99,
                Category: "Test",
                ActualInventory: 50,
                ReservedInventory: 5,
                AwaitingInventory: 0
            };
            tryRequest('POST', '/api/products', productData);
        }
    </script>
</body>
</html>
`;

// ===== MODERN LIST-BASED TUI =====
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m'
};

// Terminal control functions
const clearScreen = () => process.stdout.write('\x1b[2J\x1b[H');
const hideCursor = () => process.stdout.write('\x1b[?25l');
const showCursor = () => process.stdout.write('\x1b[?25h');
const moveCursor = (x: number, y: number) => process.stdout.write(`\x1b[${y};${x}H`);

// TUI State
interface TuiState {
  currentView: 'main' | 'customer-list' | 'product-list' | 'customer-form' | 'product-form' | 'confirm-action';
  selectedIndex: number;
  searchFilter: string;
  isSearching: boolean;
  formData: any;
  formStep: number;
  editingId?: string;
  inputBuffer: string;
  confirmIndex: number;
  previousView?: string;
  confirmAction?: 'save' | 'delete';
  confirmMessage?: string;
}

let tuiState: TuiState = {
  currentView: 'main',
  selectedIndex: 0,
  searchFilter: '',
  isSearching: false,
  formData: {},
  formStep: 0,
  inputBuffer: '',
  confirmIndex: 0
};

// Form definitions
const customerFormSteps = [
  { field: 'CustomerName', label: 'Müşteri Adı', required: true },
  { field: 'CustomerPhone', label: 'Telefon', required: false },
  { field: 'CustomerAddress', label: 'Adres', required: false },
  { field: 'CustomerTCKN', label: 'TC Kimlik No', required: false },
  { field: 'CustomerVD', label: 'Vergi Dairesi', required: false },
  { field: 'CustomerDebt', label: 'Borç (₺)', required: false, type: 'number' },
  { field: 'CustomerBalance', label: 'Bakiye (₺)', required: false, type: 'number' }
];

const productFormSteps = [
  { field: 'ProductCode', label: 'Ürün Kodu', required: true },
  { field: 'Details', label: 'Ürün Detayları', required: false },
  { field: 'Barcode', label: 'Barkod', required: false },
  { field: 'Price', label: 'Fiyat (₺)', required: true, type: 'number' },
  { field: 'Category', label: 'Kategori', required: false },
  { field: 'ActualInventory', label: 'Mevcut Stok', required: false, type: 'number' },
  { field: 'ReservedInventory', label: 'Rezerve Stok', required: false, type: 'number' },
  { field: 'AwaitingInventory', label: 'Bekleyen Stok', required: false, type: 'number' }
];

// Draw functions
const drawBox = (x: number, y: number, width: number, height: number) => {
  moveCursor(x, y);
  process.stdout.write('┌' + '─'.repeat(width - 2) + '┐');
  
  for (let i = 1; i < height - 1; i++) {
    moveCursor(x, y + i);
    process.stdout.write('│' + ' '.repeat(width - 2) + '│');
  }

  moveCursor(x, y + height - 1);
  process.stdout.write('└' + '─'.repeat(width - 2) + '┘');
};

const drawMainMenu = () => {
  clearScreen();
  
  const width = 60;
  const height = 10;
  const startX = Math.floor((process.stdout.columns - width) / 2);
  const startY = Math.floor((process.stdout.rows - height) / 2);

  drawBox(startX, startY, width, height);

  // Title
  moveCursor(startX + 2, startY + 1);
  process.stdout.write(`${colors.cyan}🗄️  Database Manager${colors.reset}`);
  
  moveCursor(startX + 2, startY + 2);
  process.stdout.write(`${colors.dim}Server: http://localhost:3000${colors.reset}`);

  // Menu items
  const menuItems = [
    '👥 Müşteri Yönetimi',
    '📦 Ürün Yönetimi',
    '📊 İstatistikler',
    '🚪 Çıkış'
  ];

  menuItems.forEach((item, index) => {
    const y = startY + 4 + index;
    moveCursor(startX + 2, y);
    
    if (index === tuiState.selectedIndex) {
      process.stdout.write(`${colors.bgBlue}${colors.white} > ${item}${' '.repeat(width - item.length - 6)} ${colors.reset}`);
    } else {
      process.stdout.write(`   ${item}`);
    }
  });

  // Controls
  moveCursor(startX + 2, startY + height - 1);
  process.stdout.write(`${colors.dim}↑↓=Gezin Enter=Seç Ctrl+C=Çıkış${colors.reset}`);
};

const filterRecords = (records: any[], searchTerm: string, isCustomer: boolean) => {
  if (!searchTerm) return records;
  
  const term = searchTerm.toLowerCase();
  return records.filter(record => {
    if (isCustomer) {
      return (record.CustomerName || '').toLowerCase().includes(term) ||
             (record.CustomerPhone || '').toLowerCase().includes(term) ||
             (record.CustomerTCKN || '').toLowerCase().includes(term);
    } else {
      return (record.ProductCode || '').toLowerCase().includes(term) ||
             (record.Details || '').toLowerCase().includes(term) ||
             (record.Barcode || '').toLowerCase().includes(term);
    }
  });
};

const drawListView = (title: string, records: any[], isCustomer: boolean) => {
  clearScreen();
  
  const filteredRecords = filterRecords(records, tuiState.searchFilter, isCustomer);
  const startY = 1;
  const maxRows = process.stdout.rows - 6;

  // Header
  moveCursor(1, startY);
  process.stdout.write(`${colors.cyan}${title} (${filteredRecords.length}/${records.length} kayıt)${colors.reset}`);

  // Search box
  moveCursor(1, startY + 1);
  const searchLabel = '🔍 Arama: ';
  process.stdout.write(searchLabel);
  
  if (tuiState.isSearching) {
    const searchText = tuiState.inputBuffer || '';
    process.stdout.write(`${colors.bgYellow}${colors.bright}${searchText}█${colors.reset}`);
  } else {
    const displayText = tuiState.searchFilter || '(yazarak ara)';
    process.stdout.write(`${colors.dim}${displayText}${colors.reset}`);
  }

  // Separator
  moveCursor(1, startY + 2);
  process.stdout.write('─'.repeat(process.stdout.columns - 2));

  // Records list
  if (filteredRecords.length === 0) {
    moveCursor(1, startY + 4);
    if (tuiState.searchFilter) {
      process.stdout.write(`${colors.yellow}📭 "${tuiState.searchFilter}" için sonuç bulunamadı${colors.reset}`);
    } else {
      process.stdout.write(`${colors.yellow}📭 Henüz kayıt eklenmemiş${colors.reset}`);
    }
  } else {
    const startIndex = Math.max(0, tuiState.selectedIndex - Math.floor(maxRows / 2));
    const visibleRecords = filteredRecords.slice(startIndex, startIndex + maxRows);

    visibleRecords.forEach((record, index) => {
      const actualIndex = startIndex + index;
      const y = startY + 3 + index;
      const isSelected = actualIndex === tuiState.selectedIndex && !tuiState.isSearching;
      
      moveCursor(1, y);
      
      if (isCustomer) {
        const name = record.CustomerName || 'İsimsiz';
        const phone = record.CustomerPhone || '';
        const balance = record.CustomerBalance || 0;
        const displayText = `${name.padEnd(25)} ${phone.padEnd(15)} ${balance.toFixed(2).padStart(10)}₺`;
        
        if (isSelected) {
          process.stdout.write(`${colors.bgBlue}${colors.white} > ${displayText}${colors.reset}`);
        } else {
          process.stdout.write(`   ${displayText}`);
        }
      } else {
        const code = record.ProductCode || 'Kod Yok';
        const details = (record.Details || '').substring(0, 30);
        const price = record.Price || 0;
        const stock = record.ActualInventory || 0;
        const displayText = `${code.padEnd(15)} ${details.padEnd(32)} ${price.toFixed(2).padStart(8)}₺ ${String(stock).padStart(5)}`;
        
        if (isSelected) {
          process.stdout.write(`${colors.bgBlue}${colors.white} > ${displayText}${colors.reset}`);
        } else {
          process.stdout.write(`   ${displayText}`);
        }
      }
    });
  }

  // Controls
  moveCursor(1, process.stdout.rows - 2);
  if (tuiState.isSearching) {
    process.stdout.write(`${colors.yellow}Arama: Enter=Uygula ESC=İptal${colors.reset}`);
  } else {
    process.stdout.write(`${colors.dim}↑↓=Gezin Enter=Düzenle Ctrl+N=Yeni [Yazarak Ara] ESC=Ana Menü${colors.reset}`);
  }
};

const drawForm = (title: string, steps: any[], isEdit: boolean) => {
  clearScreen();
  
  const width = 70;
  const height = steps.length + 8;
  const startX = Math.floor((process.stdout.columns - width) / 2);
  const startY = 2;

  drawBox(startX, startY, width, height);

  // Title
  moveCursor(startX + 2, startY + 1);
  process.stdout.write(`${colors.cyan}${title}${colors.reset}`);

  // Current step indicator
  moveCursor(startX + width - 15, startY + 1);
  process.stdout.write(`${colors.dim}${tuiState.formStep + 1}/${steps.length}${colors.reset}`);

  // Separator
  moveCursor(startX, startY + 2);
  process.stdout.write('├' + '─'.repeat(width - 2) + '┤');

  // Form fields
  steps.forEach((step, index) => {
    const y = startY + 3 + index;
    const isCurrentStep = index === tuiState.formStep;
    const value = tuiState.formData[step.field] || '';
    const requiredMarker = step.required ? `${colors.red}*${colors.reset}` : ' ';
    
    moveCursor(startX + 2, y);
    
    if (isCurrentStep) {
      // Current field with input
      const displayValue = tuiState.inputBuffer || '';
      process.stdout.write(`${colors.bgBlue}${colors.white}${requiredMarker}${step.label}: ${displayValue}█${' '.repeat(Math.max(0, 25 - displayValue.length))}${colors.reset}`);
    } else {
      // Other fields
      const displayValue = value || (index < tuiState.formStep ? '(boş)' : '...');
      process.stdout.write(`${requiredMarker}${step.label}: ${colors.dim}${displayValue}${colors.reset}`);
    }
  });

  // Controls
  moveCursor(startX + 2, startY + height - 2);
  process.stdout.write(`${colors.dim}↑↓=Alan Tab/Enter=Sonraki Ctrl+S=Kaydet ESC=Geri${colors.reset}`);
  
  if (isEdit) {
    moveCursor(startX + 2, startY + height - 1);
    process.stdout.write(`${colors.red}Ctrl+D=Sil${colors.reset}`);
  }
};

const drawConfirmation = (message: string, action: string) => {
  clearScreen();
  
  const width = 60;
  const height = 8;
  const startX = Math.floor((process.stdout.columns - width) / 2);
  const startY = Math.floor((process.stdout.rows - height) / 2);

  drawBox(startX, startY, width, height);

  // Icon based on action
  const icon = action === 'delete' ? '🗑️' : action === 'save' ? '💾' : '❓';
  const color = action === 'delete' ? colors.red : action === 'save' ? colors.green : colors.yellow;

  // Title
  moveCursor(startX + 2, startY + 1);
  process.stdout.write(`${color}${icon} ${action === 'delete' ? 'Silme' : action === 'save' ? 'Kaydetme' : ''} Onayı${colors.reset}`);

  // Message
  moveCursor(startX + 2, startY + 3);
  process.stdout.write(`${message}`);

  // Options
  const options = ['🚫 Hayır', '✅ Evet'];
  options.forEach((option, index) => {
    const y = startY + 5;
    const x = startX + 10 + (index * 20);
    moveCursor(x, y);
    
    if (index === tuiState.confirmIndex) {
      const bgColor = action === 'delete' ? colors.bgRed : colors.bgGreen;
      process.stdout.write(`${bgColor}${colors.white} ${option} ${colors.reset}`);
    } else {
      process.stdout.write(`  ${option}  `);
    }
  });

  // Controls
  moveCursor(startX + 2, startY + height - 1);
  process.stdout.write(`${colors.dim}←→=Seç Enter=Onayla ESC=İptal${colors.reset}`);
};

const showMessage = (message: string, isError = false) => {
  clearScreen();
  
  const width = 60;
  const height = 6;
  const startX = Math.floor((process.stdout.columns - width) / 2);
  const startY = Math.floor((process.stdout.rows - height) / 2);

  drawBox(startX, startY, width, height);

  moveCursor(startX + 2, startY + 2);
  const color = isError ? colors.red : colors.green;
  process.stdout.write(`${color}${message}${colors.reset}`);

  moveCursor(startX + 2, startY + height - 1);
  process.stdout.write(`${colors.dim}Otomatik olarak geri dönülüyor...${colors.reset}`);
  
  // Auto return after 2 seconds
  setTimeout(() => {
    // Determine correct return path based on previous operation
    const wasCustomerOperation = tuiState.previousView === 'customer-form';
    
    if (wasCustomerOperation) {
      tuiState.currentView = 'customer-list';
      tuiState.selectedIndex = 0;
      tuiState.isSearching = false;
      tuiState.searchFilter = '';
      tuiState.inputBuffer = '';
      tuiState.editingId = undefined;
      tuiState.formData = {};
      drawListView('👥 Müşteri Yönetimi', customerOps.getAll(), true);
    } else {
      tuiState.currentView = 'product-list';
      tuiState.selectedIndex = 0;
      tuiState.isSearching = false;
      tuiState.searchFilter = '';
      tuiState.inputBuffer = '';
      tuiState.editingId = undefined;
      tuiState.formData = {};
      drawListView('📦 Ürün Yönetimi', productOps.getAll(), false);
    }
  }, 2000);
};

// Removed old saveForm and deleteRecord functions - now using executeFormSave and executeFormDelete

const moveToNextField = () => {
  // Save current field
  const steps = tuiState.currentView === 'customer-form' ? customerFormSteps : productFormSteps;
  const currentStep = steps[tuiState.formStep];
  
  if (currentStep.type === 'number' && tuiState.inputBuffer) {
    tuiState.formData[currentStep.field] = parseFloat(tuiState.inputBuffer) || 0;
  } else {
    tuiState.formData[currentStep.field] = tuiState.inputBuffer || '';
  }

  // Move to next field
  if (tuiState.formStep < steps.length - 1) {
    tuiState.formStep++;
    const nextStep = steps[tuiState.formStep];
    tuiState.inputBuffer = String(tuiState.formData[nextStep.field] || '');
  }
};

const moveToPrevField = () => {
  // Save current field  
  const steps = tuiState.currentView === 'customer-form' ? customerFormSteps : productFormSteps;
  const currentStep = steps[tuiState.formStep];
  
  if (currentStep.type === 'number' && tuiState.inputBuffer) {
    tuiState.formData[currentStep.field] = parseFloat(tuiState.inputBuffer) || 0;
  } else {
    tuiState.formData[currentStep.field] = tuiState.inputBuffer || '';
  }

  // Move to previous field
  if (tuiState.formStep > 0) {
    tuiState.formStep--;
    const prevStep = steps[tuiState.formStep];
    tuiState.inputBuffer = String(tuiState.formData[prevStep.field] || '');
  }
};

// Keyboard handling
const handleKeyPress = (data: Buffer) => {
  const key = data.toString();
  
  // Global shortcuts
  if (key === '\x03') { // Ctrl+C
    cleanup();
    process.exit(0);
    return;
  }

  if (key === '\x13') { // Ctrl+S
    if (tuiState.currentView.endsWith('-form')) {
      // Show save confirmation
      const recordName = tuiState.currentView === 'customer-form' 
        ? tuiState.formData.CustomerName || 'Bu müşteriyi'
        : tuiState.formData.ProductCode || 'Bu ürünü';
      
      const action = tuiState.editingId ? 'güncelleme' : 'kaydetme';
      tuiState.previousView = tuiState.currentView;
      tuiState.currentView = 'confirm-action';
      tuiState.confirmAction = 'save';
      tuiState.confirmMessage = `${recordName} ${action} işlemini onaylıyor musunuz?`;
      tuiState.confirmIndex = 1; // Default to "Yes"
      drawConfirmation(tuiState.confirmMessage, 'save');
      return;
    }
  }

  if (key === '\x04') { // Ctrl+D
    if (tuiState.currentView.endsWith('-form') && tuiState.editingId) {
      const recordName = tuiState.currentView === 'customer-form' 
        ? tuiState.formData.CustomerName || 'Bu müşteriyi'
        : tuiState.formData.ProductCode || 'Bu ürünü';
      
      tuiState.previousView = tuiState.currentView;
      tuiState.currentView = 'confirm-action';
      tuiState.confirmAction = 'delete';
      tuiState.confirmMessage = `${recordName} silmek istediğinizden emin misiniz?`;
      tuiState.confirmIndex = 0; // Default to "No" for delete
      drawConfirmation(tuiState.confirmMessage, 'delete');
      return;
    }
  }

  if (key === '\x0e') { // Ctrl+N
    if (tuiState.currentView.endsWith('-list')) {
      if (tuiState.currentView === 'customer-list') {
        tuiState.currentView = 'customer-form';
        tuiState.formData = {};
        tuiState.formStep = 0;
        tuiState.editingId = undefined;
        tuiState.inputBuffer = '';
        drawForm('📝 Yeni Müşteri', customerFormSteps, false);
      } else {
        tuiState.currentView = 'product-form';
        tuiState.formData = {};
        tuiState.formStep = 0;
        tuiState.editingId = undefined;
        tuiState.inputBuffer = '';
        drawForm('📝 Yeni Ürün', productFormSteps, false);
      }
      return;
    }
  }

  // ESC key
  if (key === '\x1b') {
    if (tuiState.currentView === 'main') {
      cleanup();
      process.exit(0);
    } else if (tuiState.currentView.endsWith('-form')) {
      // Return to appropriate list view
      if (tuiState.currentView === 'customer-form') {
        tuiState.currentView = 'customer-list';
        tuiState.selectedIndex = 0;
        tuiState.isSearching = false;
        tuiState.searchFilter = '';
        tuiState.inputBuffer = '';
        tuiState.editingId = undefined;
        tuiState.formData = {};
        drawListView('👥 Müşteri Yönetimi', customerOps.getAll(), true);
      } else {
        tuiState.currentView = 'product-list';
        tuiState.selectedIndex = 0;
        tuiState.isSearching = false;
        tuiState.searchFilter = '';
        tuiState.inputBuffer = '';
        tuiState.editingId = undefined;
        tuiState.formData = {};
        drawListView('📦 Ürün Yönetimi', productOps.getAll(), false);
      }
    } else if (tuiState.currentView === 'confirm-action') {
      // Return to form
      if (tuiState.previousView === 'customer-form') {
        tuiState.currentView = 'customer-form';
        const steps = customerFormSteps;
        tuiState.inputBuffer = String(tuiState.formData[steps[tuiState.formStep].field] || '');
        drawForm('✏️ Müşteri Düzenle', steps, true);
      } else if (tuiState.previousView === 'product-form') {
        tuiState.currentView = 'product-form';
        const steps = productFormSteps;
        tuiState.inputBuffer = String(tuiState.formData[steps[tuiState.formStep].field] || '');
        drawForm('✏️ Ürün Düzenle', steps, true);
      }
    } else if (tuiState.currentView.endsWith('-list')) {
      if (tuiState.isSearching) {
        // Exit search mode, clear filter
        tuiState.isSearching = false;
        tuiState.inputBuffer = '';
        tuiState.searchFilter = '';
        tuiState.selectedIndex = 0;
        if (tuiState.currentView === 'customer-list') {
          drawListView('👥 Müşteri Yönetimi', customerOps.getAll(), true);
        } else {
          drawListView('📦 Ürün Yönetimi', productOps.getAll(), false);
        }
      } else {
        // Return to main menu
        tuiState.currentView = 'main';
        tuiState.selectedIndex = 0;
        tuiState.inputBuffer = '';
        tuiState.searchFilter = '';
        tuiState.editingId = undefined;
        tuiState.formData = {};
        drawMainMenu();
      }
    } else {
      tuiState.currentView = 'main';
      tuiState.selectedIndex = 0;
      drawMainMenu();
    }
    return;
  }

  // Handle different views
  switch (tuiState.currentView) {
    case 'main':
      handleMainMenu(key);
      break;
    case 'customer-list':
    case 'product-list':
      handleListView(key);
      break;
    case 'customer-form':
    case 'product-form':
      handleFormView(key);
      break;
    case 'confirm-action':
      handleConfirmation(key);
      break;
  }
};

const handleMainMenu = (key: string) => {
  if (key === '\x1b[A') { // Up arrow
    tuiState.selectedIndex = Math.max(0, tuiState.selectedIndex - 1);
    drawMainMenu();
  } else if (key === '\x1b[B') { // Down arrow
    tuiState.selectedIndex = Math.min(3, tuiState.selectedIndex + 1);
    drawMainMenu();
  } else if (key === '\r' || key === '\n') { // Enter
    switch (tuiState.selectedIndex) {
      case 0: // Customer Management
        tuiState.currentView = 'customer-list';
        tuiState.selectedIndex = 0;
        tuiState.searchFilter = '';
        tuiState.isSearching = false;
        tuiState.inputBuffer = '';
        tuiState.editingId = undefined;
        tuiState.formData = {};
        drawListView('👥 Müşteri Yönetimi', customerOps.getAll(), true);
        break;
      case 1: // Product Management
        tuiState.currentView = 'product-list';
        tuiState.selectedIndex = 0;
        tuiState.searchFilter = '';
        tuiState.isSearching = false;
        tuiState.inputBuffer = '';
        tuiState.editingId = undefined;
        tuiState.formData = {};
        drawListView('📦 Ürün Yönetimi', productOps.getAll(), false);
        break;
      case 2: // Stats
        showStats();
        break;
      case 3: // Exit
        cleanup();
        process.exit(0);
        break;
    }
  }
};

const handleListView = (key: string) => {
  const isCustomer = tuiState.currentView === 'customer-list';
  const records = isCustomer ? customerOps.getAll() : productOps.getAll();
  const filteredRecords = filterRecords(records, tuiState.searchFilter, isCustomer);

  if (tuiState.isSearching) {
    // Search mode
    if (key === '\r' || key === '\n') {
      // Apply search and exit search mode
      tuiState.isSearching = false;
      tuiState.searchFilter = tuiState.inputBuffer || '';
      tuiState.selectedIndex = 0;
      tuiState.inputBuffer = ''; // Clear input buffer
      drawListView(isCustomer ? '👥 Müşteri Yönetimi' : '📦 Ürün Yönetimi', records, isCustomer);
    } else if (key === '\x7f' || key === '\b') {
      // Backspace
      if (tuiState.inputBuffer && tuiState.inputBuffer.length > 0) {
        tuiState.inputBuffer = tuiState.inputBuffer.slice(0, -1);
        // Real-time filtering
        tuiState.searchFilter = tuiState.inputBuffer;
        tuiState.selectedIndex = 0;
        drawListView(isCustomer ? '👥 Müşteri Yönetimi' : '📦 Ürün Yönetimi', records, isCustomer);
      }
    } else if (key.length === 1 && key >= ' ') {
      // Regular character
      tuiState.inputBuffer = (tuiState.inputBuffer || '') + key;
      // Real-time filtering
      tuiState.searchFilter = tuiState.inputBuffer;
      tuiState.selectedIndex = 0;
      drawListView(isCustomer ? '👥 Müşteri Yönetimi' : '📦 Ürün Yönetimi', records, isCustomer);
    }
  } else {
    // Navigation mode
    if (key === '\x1b[A' && filteredRecords.length > 0) { // Up arrow
      tuiState.selectedIndex = Math.max(0, tuiState.selectedIndex - 1);
      drawListView(isCustomer ? '👥 Müşteri Yönetimi' : '📦 Ürün Yönetimi', records, isCustomer);
    } else if (key === '\x1b[B' && filteredRecords.length > 0) { // Down arrow
      tuiState.selectedIndex = Math.min(filteredRecords.length - 1, tuiState.selectedIndex + 1);
      drawListView(isCustomer ? '👥 Müşteri Yönetimi' : '📦 Ürün Yönetimi', records, isCustomer);
    } else if (key === '\r' || key === '\n') { // Enter - Edit
      if (filteredRecords.length > 0) {
        const selectedRecord = filteredRecords[tuiState.selectedIndex];
        tuiState.editingId = selectedRecord.id;
        tuiState.formData = { ...selectedRecord };
        tuiState.formStep = 0;
        
        if (isCustomer) {
          tuiState.currentView = 'customer-form';
          tuiState.inputBuffer = String(tuiState.formData[customerFormSteps[0].field] || '');
          drawForm('✏️ Müşteri Düzenle', customerFormSteps, true);
        } else {
          tuiState.currentView = 'product-form';
          tuiState.inputBuffer = String(tuiState.formData[productFormSteps[0].field] || '');
          drawForm('✏️ Ürün Düzenle', productFormSteps, true);
        }
      }
    } else if (key.length === 1 && key >= ' ') { 
      // Start searching with any character (not just /)
      tuiState.isSearching = true;
      tuiState.inputBuffer = key;
      tuiState.searchFilter = key;
      tuiState.selectedIndex = 0;
      drawListView(isCustomer ? '👥 Müşteri Yönetimi' : '📦 Ürün Yönetimi', records, isCustomer);
    }
  }
};

const handleFormView = (key: string) => {
  const steps = tuiState.currentView === 'customer-form' ? customerFormSteps : productFormSteps;
  
  // Initialize input buffer if needed
  if (tuiState.inputBuffer === undefined || tuiState.inputBuffer === null) {
    const currentStep = steps[tuiState.formStep];
    tuiState.inputBuffer = String(tuiState.formData[currentStep.field] || '');
  }
  
  if (key === '\x1b[A') { // Up arrow
    moveToPrevField();
    const title = tuiState.currentView === 'customer-form' ? 
      (tuiState.editingId ? '✏️ Müşteri Düzenle' : '📝 Yeni Müşteri') :
      (tuiState.editingId ? '✏️ Ürün Düzenle' : '📝 Yeni Ürün');
    drawForm(title, steps, !!tuiState.editingId);
  } else if (key === '\x1b[B') { // Down arrow
    moveToNextField();
    const title = tuiState.currentView === 'customer-form' ? 
      (tuiState.editingId ? '✏️ Müşteri Düzenle' : '📝 Yeni Müşteri') :
      (tuiState.editingId ? '✏️ Ürün Düzenle' : '📝 Yeni Ürün');
    drawForm(title, steps, !!tuiState.editingId);
  } else if (key === '\t' || key === '\r' || key === '\n') { // Tab or Enter
    moveToNextField();
    const title = tuiState.currentView === 'customer-form' ? 
      (tuiState.editingId ? '✏️ Müşteri Düzenle' : '📝 Yeni Müşteri') :
      (tuiState.editingId ? '✏️ Ürün Düzenle' : '📝 Yeni Ürün');
    drawForm(title, steps, !!tuiState.editingId);
  } else if (key === '\x7f' || key === '\b') { // Backspace
    if (tuiState.inputBuffer.length > 0) {
      tuiState.inputBuffer = tuiState.inputBuffer.slice(0, -1);
      const title = tuiState.currentView === 'customer-form' ? 
        (tuiState.editingId ? '✏️ Müşteri Düzenle' : '📝 Yeni Müşteri') :
        (tuiState.editingId ? '✏️ Ürün Düzenle' : '📝 Yeni Ürün');
      drawForm(title, steps, !!tuiState.editingId);
    }
  } else if (key.length === 1 && key >= ' ') { // Regular character
    tuiState.inputBuffer += key;
    const title = tuiState.currentView === 'customer-form' ? 
      (tuiState.editingId ? '✏️ Müşteri Düzenle' : '📝 Yeni Müşteri') :
      (tuiState.editingId ? '✏️ Ürün Düzenle' : '📝 Yeni Ürün');
    drawForm(title, steps, !!tuiState.editingId);
  }
};

const handleConfirmation = (key: string) => {
  if (key === '\x1b[D') { // Left arrow
    tuiState.confirmIndex = 0;
    drawConfirmation(tuiState.confirmMessage || '', tuiState.confirmAction || 'save');
  } else if (key === '\x1b[C') { // Right arrow
    tuiState.confirmIndex = 1;
    drawConfirmation(tuiState.confirmMessage || '', tuiState.confirmAction || 'save');
  } else if (key === '\r' || key === '\n') { // Enter
    if (tuiState.confirmIndex === 1) {
      // Action confirmed
      if (tuiState.confirmAction === 'save') {
        executeFormSave();
      } else if (tuiState.confirmAction === 'delete') {
        executeFormDelete();
      }
    } else {
      // Cancel - return to form
      returnToForm();
    }
  }
};

const executeFormSave = () => {
  try {
    // Save current field
    if (tuiState.inputBuffer !== undefined) {
      const steps = tuiState.previousView === 'customer-form' ? customerFormSteps : productFormSteps;
      const currentStep = steps[tuiState.formStep];
      
      if (currentStep.type === 'number' && tuiState.inputBuffer) {
        tuiState.formData[currentStep.field] = parseFloat(tuiState.inputBuffer) || 0;
      } else {
        tuiState.formData[currentStep.field] = tuiState.inputBuffer || '';
      }
    }

    if (tuiState.previousView === 'customer-form') {
      if (tuiState.editingId) {
        customerOps.update(tuiState.editingId, tuiState.formData);
        showMessage('✅ Müşteri başarıyla güncellendi');
      } else {
        const created = customerOps.create(tuiState.formData);
        showMessage(`✅ Müşteri başarıyla oluşturuldu`);
      }
    } else if (tuiState.previousView === 'product-form') {
      if (tuiState.editingId) {
        productOps.update(tuiState.editingId, tuiState.formData);
        showMessage('✅ Ürün başarıyla güncellendi');
      } else {
        const created = productOps.create(tuiState.formData);
        showMessage(`✅ Ürün başarıyla oluşturuldu`);
      }
    }
  } catch (error) {
    showMessage(`❌ Hata: ${error.message}`, true);
  }
};

const executeFormDelete = () => {
  try {
    if (tuiState.previousView === 'customer-form') {
      customerOps.delete(tuiState.editingId!);
      showMessage('✅ Müşteri başarıyla silindi');
    } else if (tuiState.previousView === 'product-form') {
      productOps.delete(tuiState.editingId!);
      showMessage('✅ Ürün başarıyla silindi');
    }
  } catch (error) {
    showMessage(`❌ Silme hatası: ${error.message}`, true);
  }
};

const returnToForm = () => {
  if (tuiState.previousView === 'customer-form') {
    tuiState.currentView = 'customer-form';
    const steps = customerFormSteps;
    const title = tuiState.editingId ? '✏️ Müşteri Düzenle' : '📝 Yeni Müşteri';
    tuiState.inputBuffer = String(tuiState.formData[steps[tuiState.formStep].field] || '');
    drawForm(title, steps, !!tuiState.editingId);
  } else if (tuiState.previousView === 'product-form') {
    tuiState.currentView = 'product-form';
    const steps = productFormSteps;
    const title = tuiState.editingId ? '✏️ Ürün Düzenle' : '📝 Yeni Ürün';
    tuiState.inputBuffer = String(tuiState.formData[steps[tuiState.formStep].field] || '');
    drawForm(title, steps, !!tuiState.editingId);
  }
};

const showStats = () => {
  clearScreen();
  
  moveCursor(1, 2);
  process.stdout.write(`${colors.cyan}📊 Veritabanı İstatistikleri${colors.reset}\n\n`);
  
  const tables = [
    { name: 'customers', label: 'Müşteriler' },
    { name: 'products', label: 'Ürünler' },
    { name: 'orders', label: 'Siparişler' },
    { name: 'payments', label: 'Ödemeler' }
  ];
  
  tables.forEach((table, index) => {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
      moveCursor(3, 4 + index);
      process.stdout.write(`${colors.green}${table.label}:${colors.reset} ${count.count} kayıt`);
    } catch (e) {
      moveCursor(3, 4 + index);
      process.stdout.write(`${colors.red}${table.label}: Tablo bulunamadı${colors.reset}`);
    }
  });
  
  moveCursor(1, 10);
  process.stdout.write(`${colors.dim}ESC: Ana menüye dön${colors.reset}`);
  
  // Auto return after 3 seconds
  setTimeout(() => {
    tuiState.currentView = 'main';
    tuiState.selectedIndex = 0;
    drawMainMenu();
  }, 3000);
};

const cleanup = () => {
  showCursor();
  clearScreen();
  process.stdin.setRawMode(false);
  process.stdin.removeAllListeners('data');
};

const startRawTui = () => {
  // Setup terminal
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  hideCursor();

  // Handle resize
  process.stdout.on('resize', () => {
    switch (tuiState.currentView) {
      case 'main':
        drawMainMenu();
        break;
      case 'customer-list':
        drawListView('👥 Müşteri Yönetimi', customerOps.getAll(), true);
        break;
      case 'product-list':
        drawListView('📦 Ürün Yönetimi', productOps.getAll(), false);
        break;
    }
  });

  // Handle keyboard input
  process.stdin.on('data', handleKeyPress);

  // Handle exit
  process.on('SIGINT', cleanup);
  process.on('exit', cleanup);

  // Initial draw
  drawMainMenu();
};

// ===== COMMAND LINE ARGUMENTS =====
const args = process.argv.slice(2);
const shouldStartTui = args.includes('--tui') || args.includes('-t');

// ===== SERVER =====
initDB();

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    
    // Log all requests
    logger.request(req.method, url.pathname, req.method === 'POST' || req.method === 'PUT' ? await req.clone().text() : undefined);

    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Documentation page
    if (url.pathname === '/' || url.pathname === '/docs') {
      return new Response(getDocumentationHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return apiResponse({ status: 'healthy', timestamp: new Date().toISOString() });
    }

    // API routes
    if (pathParts[1] === 'api') {
      const resource = pathParts[2];

      switch (resource) {
        case 'customers':
          return handleCustomers(req, pathParts);
        case 'products':
          return handleProducts(req, pathParts);
        default:
          return apiResponse({ error: 'Resource not found' }, 404);
      }
    }

    return apiResponse({ error: 'Not found' }, 404);
  },
});

logger.info(`🚀 Server running on http://localhost:${server.port}`);
logger.info('📖 Documentation: http://localhost:3000/docs');

// Start TUI if requested
if (shouldStartTui) {
  logger.info('🎯 Modern List-Based TUI açılıyor...');
  setTimeout(() => {
    startRawTui();
  }, 500);
} else {
  logger.info('🗄️  TUI Mode: bun run index.ts --tui');
  logger.info('Available endpoints:');
  logger.info('  GET / or /docs - Interactive API documentation');
  logger.info('  GET /health - Health check');
  logger.info('  GET /api/customers - List all customers');
  logger.info('  POST /api/customers - Create customer');
  logger.info('  GET /api/customers/{id} - Get customer by ID');
  logger.info('  PUT /api/customers/{id} - Update customer');
  logger.info('  DELETE /api/customers/{id} - Delete customer');
  logger.info('  GET /api/products - List all products');
  logger.info('  POST /api/products - Create product');
  logger.info('  GET /api/products/{id} - Get product by ID');
  logger.info('  PUT /api/products/{id} - Update product');
  logger.info('  DELETE /api/products/{id} - Delete product');
}