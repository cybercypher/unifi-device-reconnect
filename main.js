const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// Controller details
const controllerUrl = process.env.CONTROLLER_URL;
const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const site = process.env.SITE; // Replace with the site name if different

// Device MAC addresses to reset (can be comma-separated in env or passed as CLI args)
let deviceMacs = [];

// Check for command-line arguments first
if (process.argv.length > 2) {
  deviceMacs = process.argv.slice(2);
} else if (process.env.DEVICE_MAC) {
  // Fall back to environment variable (supports comma-separated values)
  deviceMacs = process.env.DEVICE_MAC.split(',').map(mac => mac.trim()).filter(mac => mac);
}

if (deviceMacs.length === 0) {
  console.error('Error: No device MAC addresses provided.');
  console.error('Usage: node main.js <mac1> [mac2] [mac3] ...');
  console.error('Or set DEVICE_MAC in .env file (comma-separated for multiple devices)');
  process.exit(1);
}

console.log(`Devices to reconnect: ${deviceMacs.join(', ')}`);

// Create an axios instance with necessary settings
const instance = axios.create({
  baseURL: controllerUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  httpsAgent: new (require('https').Agent)({
    rejectUnauthorized: false, // Ignore SSL certificate warnings if using self-signed certificate
  }),
});

// Authenticate and get the session cookie
async function login() {
  try {
    const response = await instance.post('/api/login', {
      username: username,
      password: password,
    });
    // Save the session cookie for subsequent requests
    instance.defaults.headers['Cookie'] = response.headers['set-cookie'];
    console.log('Logged in successfully');
  } catch (error) {
    console.error('Login failed:', error.message);
  }
}

// Reset a single device by MAC address
async function reconnectClient(mac) {
    try {
      const response = await instance.post(`/api/s/${site}/cmd/stamgr`, {
        cmd: 'kick-sta',
        mac: mac, // The MAC address of the client to reconnect
      });
      console.log(`✓ Client ${mac} reconnect command sent:`, response.data);
      return { mac, success: true };
    } catch (error) {
      if (error.response) {
        console.error(`✗ Failed to reconnect client ${mac}:`, error.response.data);
      } else {
        console.error(`✗ Failed to reconnect client ${mac}:`, error.message);
      }
      return { mac, success: false, error: error.message };
    }
  }

// Reconnect all devices
async function reconnectAllClients() {
  console.log(`\nReconnecting ${deviceMacs.length} device(s)...\n`);
  const results = [];

  for (const mac of deviceMacs) {
    const result = await reconnectClient(mac);
    results.push(result);
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n=== Summary ===`);
  console.log(`Total devices: ${deviceMacs.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  return results;
}
  
  

// Logout from the UniFi Controller
async function logout() {
  try {
    await instance.post('/api/auth/logout');
    console.log('Logged out successfully');
  } catch (error) {
    console.error('Logout failed:', error.message);
  }
}

// Main function to execute the workflow
async function main() {
  await login();
  await reconnectAllClients();
  await logout();
}

main();
