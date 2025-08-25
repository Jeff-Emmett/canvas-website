import React, { useState } from 'react';
import { CryptoAuthService } from '../../lib/auth/cryptoAuthService';
import { checkBrowserSupport, isSecureContext } from '../../lib/utils/browser';
import * as crypto from '../../lib/auth/crypto';

/**
 * Test component to verify WebCryptoAPI authentication
 */
const CryptoTest: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      addResult('Starting WebCryptoAPI authentication tests...');
      
      // Test 1: Browser Support
      addResult('Testing browser support...');
      const browserSupported = checkBrowserSupport();
      const secureContext = isSecureContext();
      const webcryptoAvailable = typeof window !== 'undefined' && 
                                typeof window.crypto !== 'undefined' && 
                                typeof window.crypto.subtle !== 'undefined';
      
      addResult(`Browser support: ${browserSupported ? '✓' : '✗'}`);
      addResult(`Secure context: ${secureContext ? '✓' : '✗'}`);
      addResult(`WebCryptoAPI available: ${webcryptoAvailable ? '✓' : '✗'}`);
      
      if (!browserSupported || !secureContext || !webcryptoAvailable) {
        addResult('❌ Browser does not meet requirements for cryptographic authentication');
        return;
      }
      
      // Test 2: Key Generation
      addResult('Testing key pair generation...');
      const keyPair = await crypto.generateKeyPair();
      if (keyPair) {
        addResult('✓ Key pair generated successfully');
      } else {
        addResult('❌ Key pair generation failed');
        return;
      }
      
      // Test 3: Public Key Export
      addResult('Testing public key export...');
      const publicKeyBase64 = await crypto.exportPublicKey(keyPair.publicKey);
      if (publicKeyBase64) {
        addResult('✓ Public key exported successfully');
      } else {
        addResult('❌ Public key export failed');
        return;
      }
      
      // Test 4: Public Key Import
      addResult('Testing public key import...');
      const importedPublicKey = await crypto.importPublicKey(publicKeyBase64);
      if (importedPublicKey) {
        addResult('✓ Public key imported successfully');
      } else {
        addResult('❌ Public key import failed');
        return;
      }
      
      // Test 5: Data Signing
      addResult('Testing data signing...');
      const testData = 'Hello, WebCryptoAPI!';
      const signature = await crypto.signData(keyPair.privateKey, testData);
      if (signature) {
        addResult('✓ Data signed successfully');
      } else {
        addResult('❌ Data signing failed');
        return;
      }
      
      // Test 6: Signature Verification
      addResult('Testing signature verification...');
      const isValid = await crypto.verifySignature(importedPublicKey, signature, testData);
      if (isValid) {
        addResult('✓ Signature verified successfully');
      } else {
        addResult('❌ Signature verification failed');
        return;
      }
      
      // Test 7: User Registration
      addResult('Testing user registration...');
      const testUsername = `testuser_${Date.now()}`;
      const registerResult = await CryptoAuthService.register(testUsername);
      if (registerResult.success) {
        addResult('✓ User registration successful');
      } else {
        addResult(`❌ User registration failed: ${registerResult.error}`);
        return;
      }
      
      // Test 8: User Login
      addResult('Testing user login...');
      const loginResult = await CryptoAuthService.login(testUsername);
      if (loginResult.success) {
        addResult('✓ User login successful');
      } else {
        addResult(`❌ User login failed: ${loginResult.error}`);
        return;
      }
      
      // Test 9: Credential Verification
      addResult('Testing credential verification...');
      const credentialsValid = await CryptoAuthService.verifyCredentials(testUsername);
      if (credentialsValid) {
        addResult('✓ Credential verification successful');
      } else {
        addResult('❌ Credential verification failed');
        return;
      }
      
      addResult('🎉 All WebCryptoAPI authentication tests passed!');
      
    } catch (error) {
      addResult(`❌ Test error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="crypto-test-container">
      <h2>WebCryptoAPI Authentication Test</h2>
      
      <div className="test-controls">
        <button 
          onClick={runTests} 
          disabled={isRunning}
          className="test-button"
        >
          {isRunning ? 'Running Tests...' : 'Run Tests'}
        </button>
        
        <button 
          onClick={clearResults}
          disabled={isRunning}
          className="clear-button"
        >
          Clear Results
        </button>
      </div>
      
      <div className="test-results">
        <h3>Test Results:</h3>
        {testResults.length === 0 ? (
          <p>No test results yet. Click "Run Tests" to start.</p>
        ) : (
          <div className="results-list">
            {testResults.map((result, index) => (
              <div key={index} className="result-item">
                {result}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="test-info">
        <h3>What's Being Tested:</h3>
        <ul>
          <li>Browser WebCryptoAPI support</li>
          <li>Secure context (HTTPS)</li>
          <li>ECDSA P-256 key pair generation</li>
          <li>Public key export/import</li>
          <li>Data signing and verification</li>
          <li>User registration with cryptographic keys</li>
          <li>User login with challenge-response</li>
          <li>Credential verification</li>
        </ul>
      </div>
    </div>
  );
};

export default CryptoTest; 