#!/usr/bin/env node

/**
 * Test script to verify video chat network access
 * This script helps test if the video chat works on network IPs
 */

import { exec } from 'child_process';
import os from 'os';

// Get network interfaces
function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({
          name,
          address: iface.address,
          isWSL: name.includes('eth0') || name.includes('wsl')
        });
      }
    }
  }
  
  return ips;
}

// Test if ports are accessible
function testPort(host, port) {
  return new Promise((resolve) => {
    import('net').then(net => {
      const socket = new net.Socket();
      
      socket.setTimeout(3000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, host);
    }).catch(() => resolve(false));
  });
}

async function main() {
  console.log('🧪 Video Chat Network Access Test');
  console.log('==================================\n');
  
  const ips = getNetworkIPs();
  console.log('📍 Available network IPs:');
  ips.forEach(ip => {
    console.log(`   ${ip.name}: ${ip.address} ${ip.isWSL ? '(WSL)' : ''}`);
  });
  
  console.log('\n🔍 Testing port accessibility:');
  
  for (const ip of ips) {
    console.log(`\n   Testing ${ip.address}:`);
    
    // Test client port (5173)
    const clientAccessible = await testPort(ip.address, 5173);
    console.log(`     Client (5173): ${clientAccessible ? '✅ Accessible' : '❌ Not accessible'}`);
    
    // Test worker port (5172)
    const workerAccessible = await testPort(ip.address, 5172);
    console.log(`     Worker (5172): ${workerAccessible ? '✅ Accessible' : '❌ Not accessible'}`);
    
    if (clientAccessible && workerAccessible) {
      console.log(`\n🎯 Video chat should work at: http://${ip.address}:5173`);
      console.log(`   Worker URL: http://${ip.address}:5172`);
    }
  }
  
  console.log('\n📋 Instructions:');
  console.log('1. Start the development server: npm run dev');
  console.log('2. Access the app from a network device using one of the IPs above');
  console.log('3. Create a video chat shape and test if it loads');
  console.log('4. Check browser console for any CORS or WebRTC errors');
  
  console.log('\n🔧 Troubleshooting:');
  console.log('- If video chat fails to load, try the "Open in New Tab" button');
  console.log('- Check browser console for CORS errors');
  console.log('- Ensure both client and worker are accessible on the same IP');
  console.log('- Some browsers may require HTTPS for WebRTC on non-localhost domains');
  
  console.log('\n🌐 WSL2 Port Forwarding (if needed):');
  console.log('Run these commands in Windows PowerShell as Administrator:');
  ips.forEach(ip => {
    if (ip.isWSL) {
      console.log(`   netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=${ip.address}`);
      console.log(`   netsh interface portproxy add v4tov4 listenport=5172 listenaddress=0.0.0.0 connectport=5172 connectaddress=${ip.address}`);
    }
  });
}

main().catch(console.error);
