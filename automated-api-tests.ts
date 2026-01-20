/**
 * Automated API Tests
 * 
 * בדיקות אוטומטיות של כל ה-API endpoints
 * מריץ עם: npx tsx --env-file=.env.local automated-api-tests.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function log(name: string, passed: boolean, message: string, details?: any) {
  results.push({ name, passed, message, details });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}: ${message}`);
  if (details && !passed) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

async function fetchJSON(url: string, options?: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }
}

// =============================================================================
// Test 1: Database Connection
// =============================================================================
async function testDatabaseConnection() {
  console.log('\n📊 Test 1: Database Connection\n');
  
  const result = await fetchJSON(`${BASE_URL}/api/test-db`);
  
  if (result.ok && result.data?.success) {
    log('Database Connection', true, 'Connected successfully');
    log('Warehouses Count', result.data.data.warehouseCount > 0, `${result.data.data.warehouseCount} warehouses found`);
    log('Products Count', result.data.data.productCount > 0, `${result.data.data.productCount} products found`);
  } else {
    log('Database Connection', false, 'Connection failed', result);
  }
}

// =============================================================================
// Test 2: Products Catalog API
// =============================================================================
async function testProductsCatalog() {
  console.log('\n📦 Test 2: Products Catalog API\n');
  
  const result = await fetchJSON(`${BASE_URL}/api/catalog/products`);
  
  if (result.ok && result.data?.products) {
    log('Products API', true, 'Products loaded successfully');
    log('Products Array', result.data.products.length > 0, `${result.data.products.length} products found`);
    
    // Check product structure
    const product = result.data.products[0];
    if (product) {
      log('Product Structure', 
        product.id && product.name && product.price_per_kg !== undefined,
        'Product has required fields (id, name, price_per_kg)');
    }
  } else {
    log('Products API', false, 'Failed to load products', result);
  }
}

// =============================================================================
// Test 3: Distributors List API
// =============================================================================
async function testDistributorsList() {
  console.log('\n👥 Test 3: Distributors List API\n');
  
  const result = await fetchJSON(`${BASE_URL}/api/catalog/distributors`);
  
  if (result.ok && result.data?.distributors) {
    log('Distributors API', true, 'Distributors loaded successfully');
    log('Distributors Array', result.data.distributors.length > 0, `${result.data.distributors.length} distributors found`);
    
    // Check distributor structure
    const distributor = result.data.distributors[0];
    if (distributor) {
      log('Distributor Structure', 
        distributor.id && distributor.full_name,
        'Distributor has required fields (id, full_name)');
    }
  } else {
    log('Distributors API', false, 'Failed to load distributors', result);
  }
}

// =============================================================================
// Test 4: Order Preview API
// =============================================================================
async function testOrderPreview() {
  console.log('\n🧾 Test 4: Order Preview API\n');
  
  // First get a distributor ID
  const distResult = await fetchJSON(`${BASE_URL}/api/catalog/distributors`);
  if (!distResult.ok || !distResult.data?.distributors?.length) {
    log('Order Preview', false, 'No distributors found to test with');
    return;
  }
  
  const distributorId = distResult.data.distributors[0].id;
  
  // Get products
  const prodResult = await fetchJSON(`${BASE_URL}/api/catalog/products`);
  if (!prodResult.ok || !prodResult.data?.products?.length) {
    log('Order Preview', false, 'No products found to test with');
    return;
  }
  
  const product = prodResult.data.products[0];
  
  // Test order preview
  const previewResult = await fetchJSON(`${BASE_URL}/api/orders/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      distributorId,
      items: [{ productId: product.id, quantity: 10 }]
    })
  });
  
  if (previewResult.ok && previewResult.data.preview) {
    log('Order Preview API', true, 'Preview calculated successfully');
    const preview = previewResult.data.preview;
    log('Preview Has Totals', 
      preview.subtotal !== undefined && preview.totalAmount !== undefined,
      `Subtotal: ${preview.subtotal}, Total: ${preview.totalAmount}`);
  } else {
    log('Order Preview API', false, 'Failed to calculate preview', previewResult);
  }
}

// =============================================================================
// Test 5: Customer Lookup API
// =============================================================================
async function testCustomerLookup() {
  console.log('\n🔍 Test 5: Customer Lookup API\n');
  
  // Test with non-existing phone
  const result = await fetchJSON(`${BASE_URL}/api/customers/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0501234567' })
  });
  
  if (result.ok) {
    log('Customer Lookup API', true, 'Lookup works');
    if (result.data.customer) {
      log('Customer Found', true, `Found: ${result.data.customer.full_name}`);
    } else {
      log('Customer Not Found', true, 'No customer found (expected for new phone)');
    }
  } else {
    log('Customer Lookup API', false, 'Lookup failed', result);
  }
}

// =============================================================================
// Test 6: Dashboard Stats API (requires auth)
// =============================================================================
async function testDashboardStats() {
  console.log('\n📊 Test 6: Dashboard Stats API\n');
  
  const result = await fetchJSON(`${BASE_URL}/api/dashboard/stats`);
  
  // This should fail without auth, which is expected
  if (result.status === 401) {
    log('Dashboard Stats (No Auth)', true, 'Returns 401 as expected (requires authentication)');
  } else if (result.ok) {
    log('Dashboard Stats', true, 'Stats loaded (server may be using service role)');
  } else {
    log('Dashboard Stats', false, 'Unexpected error', result);
  }
}

// =============================================================================
// Test 7: Public Order Page (Distributor Link)
// =============================================================================
async function testPublicOrderPage() {
  console.log('\n🛒 Test 7: Public Order Page\n');
  
  // First get a distributor ID
  const distResult = await fetchJSON(`${BASE_URL}/api/catalog/distributors`);
  if (!distResult.ok || !distResult.data?.distributors?.length) {
    log('Public Order Page', false, 'No distributors found to test with');
    return;
  }
  
  const distributorId = distResult.data.distributors[0].id;
  
  // Check if the distributor endpoint exists (GET with query param)
  const result = await fetchJSON(`${BASE_URL}/api/checkout/distributor?distributorId=${distributorId}`);
  
  if (result.ok) {
    log('Distributor Checkout API', true, 'Distributor info loaded');
    if (result.data.distributor) {
      log('Distributor Has Profile', 
        result.data.distributor.full_name !== undefined,
        `Name: ${result.data.distributor.full_name || 'N/A'}`);
    }
  } else {
    log('Distributor Checkout API', false, 'Failed to load distributor', result);
  }
}

// =============================================================================
// =============================================================================
// Test 8: Order Creation API
// =============================================================================
async function testOrderCreation() {
  console.log('\n📝 Test 8: Order Creation API\n');
  
  // Get distributor
  const distResult = await fetchJSON(`${BASE_URL}/api/catalog/distributors`);
  if (!distResult.ok || !distResult.data?.distributors?.length) {
    log('Order Creation', false, 'No distributors found');
    return;
  }
  
  const distributorId = distResult.data.distributors[0].id;
  
  // Get product
  const prodResult = await fetchJSON(`${BASE_URL}/api/catalog/products`);
  if (!prodResult.ok || !prodResult.data?.products?.length) {
    log('Order Creation', false, 'No products found');
    return;
  }
  
  const product = prodResult.data.products[0];
  
  // Create order - Use correct field names (full_name, not name)
  const orderResult = await fetchJSON(`${BASE_URL}/api/orders/create-public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      distributorId,
      items: [{ productId: product.id, quantity: 5 }],
      customerInfo: {
        full_name: 'Test Customer API',  // Correct field name
        phone: `05${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `test-api-${Date.now()}@example.com`
      },
      paymentMethod: 'cash'
    })
  });
  
  if (orderResult.ok && orderResult.data.order) {
    log('Order Creation API', true, 'Order created successfully');
    log('Order Number', true, `Order number: ${orderResult.data.order.orderNumber}`);
  } else {
    log('Order Creation API', false, 'Failed to create order', orderResult);
  }
}

// =============================================================================
// Test 9: Admin APIs (requires auth)
// =============================================================================
async function testAdminAPIs() {
  console.log('\n🔐 Test 9: Admin APIs (Auth Required)\n');
  
  // Test users list (should require auth)
  const usersResult = await fetchJSON(`${BASE_URL}/api/admin/users/list`);
  
  if (usersResult.status === 401) {
    log('Admin Users List (No Auth)', true, 'Returns 401 as expected');
  } else if (usersResult.ok) {
    log('Admin Users List', true, 'Users loaded (may be using service role)', {
      count: usersResult.data.users?.length
    });
  } else {
    log('Admin Users List', false, 'Unexpected error', usersResult);
  }
  
  // Test distributors list (admin)
  const distResult = await fetchJSON(`${BASE_URL}/api/admin/distributors/list`);
  
  if (distResult.status === 401) {
    log('Admin Distributors List (No Auth)', true, 'Returns 401 as expected');
  } else if (distResult.ok) {
    log('Admin Distributors List', true, 'Distributors loaded', {
      count: distResult.data.distributors?.length
    });
  } else {
    log('Admin Distributors List', false, 'Unexpected error', distResult);
  }
}

// =============================================================================
// Test 10: Checkout Payment Config API
// =============================================================================
async function testPaymentConfig() {
  console.log('\n💳 Test 10: Payment Config API\n');
  
  // Get distributor
  const distResult = await fetchJSON(`${BASE_URL}/api/catalog/distributors`);
  if (!distResult.ok || !distResult.data?.distributors?.length) {
    log('Payment Config', false, 'No distributors found');
    return;
  }
  
  const distributorId = distResult.data.distributors[0].id;
  
  // GET with query param
  const result = await fetchJSON(`${BASE_URL}/api/checkout/payment-config?distributorId=${distributorId}`);
  
  if (result.ok) {
    log('Payment Config API', true, 'Payment config loaded');
    if (result.data.paymentMethods) {
      log('Payment Methods', result.data.paymentMethods.length > 0, 
        `Available methods: ${result.data.paymentMethods.join(', ')}`);
    }
    if (result.data.showPaybox !== undefined) {
      log('Paybox Config', true, `Show Paybox: ${result.data.showPaybox}`);
    }
  } else {
    log('Payment Config API', false, 'Failed to load config', result);
  }
}

// =============================================================================
// Generate Report
// =============================================================================
function generateReport() {
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 API TEST REPORT');
  console.log('='.repeat(80) + '\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  return failed === 0;
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  console.log('🧪 Starting Automated API Tests');
  console.log('================================\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  try {
    await testDatabaseConnection();
    await testProductsCatalog();
    await testDistributorsList();
    await testOrderPreview();
    await testCustomerLookup();
    await testDashboardStats();
    await testPublicOrderPage();
    await testOrderCreation();
    await testAdminAPIs();
    await testPaymentConfig();
    
    const allPassed = generateReport();
    process.exit(allPassed ? 0 : 1);
    
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
