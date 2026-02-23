/**
 * n8n Credentials Setup Script
 * Automatically creates required credentials in n8n
 * 
 * Usage:
 * 1. Get your n8n API key from Settings → API
 * 2. Set N8N_API_KEY environment variable or edit this file
 * 3. Run: node setup-n8n-credentials.js
 */

const N8N_BASE_URL = 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NzIwMjQ2Yi0yMzU2LTRlYmUtYjRjZS0yOTMwZGU1NDZmZGIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZDU3NWY4YWYtN2I0YS00YjU2LTg0YjEtZmNkYzBmMDFmODZiIiwiaWF0IjoxNzcxODQwMjgxLCJleHAiOjE3NzQ0MTEyMDB9.XahPXxU3u_nhLot71sPRBZ5Gd2d4nwjROhq1sylxrBE';

// Credentials to create
const credentials = [
  {
    name: 'ethiosugar-api',
    type: 'httpHeaderAuth',
    data: {
      authType: 'header',
      header: 'Authorization',
      token: '' // Will be filled with JWT token
    }
  },
  {
    name: 'ethiosugar-telegram',
    type: 'telegramBotApi',
    data: {
      accessToken: '8376747219:AAF9fqRTMf3zPSb4QvH-4kNulERugq2Xe3Q'
    }
  }
];

const BACKEND_URL = 'http://localhost:3001';

async function getJWTToken() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@ethiosugar.local',
        password: 'Admin123!'
      })
    });
    
    const data = await response.json();
    if (data.success && data.data?.token) {
      return data.data.token;
    }
    throw new Error('Failed to get JWT token');
  } catch (error) {
    console.error('❌ Error getting JWT token:', error.message);
    return null;
  }
}

async function checkN8nConnection() {
  try {
    const response = await fetch(`${N8N_BASE_URL}/healthz`);
    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    return false;
  }
}

async function createCredential(cred) {
  try {
    const response = await fetch(`${N8N_BASE_URL}/api/v1/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': N8N_API_KEY
      },
      body: JSON.stringify({
        name: cred.name,
        type: cred.type,
        data: cred.data
      })
    });
    
    const result = await response.json();
    
    if (response.ok || response.status === 409) {
      if (response.status === 409) {
        console.log(`⚠️  Credential '${cred.name}' already exists, updating...`);
        return await updateCredential(cred);
      }
      console.log(`✅ Created credential: ${cred.name}`);
      return true;
    } else {
      console.error(`❌ Failed to create '${cred.name}':`, result.message || result);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error creating '${cred.name}':`, error.message);
    return false;
  }
}

async function updateCredential(cred) {
  try {
    // First, get existing credential ID
    const getResponse = await fetch(`${N8N_BASE_URL}/api/v1/credentials`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const credentials = await getResponse.json();
    const existing = credentials.find(c => c.name === cred.name);
    
    if (!existing) {
      console.error(`❌ Credential '${cred.name}' not found for update`);
      return false;
    }
    
    // Update the credential
    const response = await fetch(`${N8N_BASE_URL}/api/v1/credentials/${existing.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': N8N_API_KEY
      },
      body: JSON.stringify({
        name: cred.name,
        type: cred.type,
        data: cred.data
      })
    });
    
    if (response.ok) {
      console.log(`✅ Updated credential: ${cred.name}`);
      return true;
    } else {
      console.error(`❌ Failed to update '${cred.name}'`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating '${cred.name}':`, error.message);
    return false;
  }
}

async function testTelegramBot() {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot8376747219:AAF9fqRTMf3zPSb4QvH-4kNulERugq2Xe3Q/getMe`
    );
    const data = await response.json();
    
    if (data.ok) {
      console.log(`✅ Telegram bot verified: @${data.result.username}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Telegram bot test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 n8n Credentials Setup\n');
  console.log('==========================================\n');
  
  // Step 1: Check n8n connection
  console.log('📡 Checking n8n connection...');
  const n8nOk = await checkN8nConnection();
  if (!n8nOk) {
    console.error('❌ Cannot connect to n8n at', N8N_BASE_URL);
    console.log('   Make sure n8n is running on port 5678');
    return;
  }
  console.log('✅ n8n is running\n');
  
  // Step 2: Get JWT token for API credential
  console.log('🔑 Getting JWT token from backend...');
  const jwtToken = await getJWTToken();
  if (!jwtToken) {
    console.log('   Make sure backend is running on port 3001');
    return;
  }
  console.log('✅ JWT token obtained\n');
  
  // Update API credential with token
  credentials[0].data.password = jwtToken;
  
  // Step 3: Test Telegram bot
  console.log('🤖 Testing Telegram bot...');
  await testTelegramBot();
  console.log('');
  
  // Step 4: Create credentials
  console.log('📝 Creating credentials in n8n...\n');
  
  let successCount = 0;
  for (const cred of credentials) {
    const success = await createCredential(cred);
    if (success) successCount++;
  }
  
  console.log('\n==========================================');
  console.log(`\n✅ Setup complete: ${successCount}/${credentials.length} credentials configured\n`);
  
  // Next steps
  console.log('📋 Next Steps:');
  console.log('   1. Import workflow JSON files into n8n');
  console.log('   2. Activate workflows in n8n editor');
  console.log('   3. Test workflow executions\n');
}

// Run setup
main().catch(console.error);
