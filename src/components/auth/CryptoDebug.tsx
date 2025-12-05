import React, { useState } from 'react';
import { CryptoAuthService } from '../../lib/auth/cryptoAuthService';
import * as crypto from '../../lib/auth/crypto';

const CryptoDebug: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [testUsername, setTestUsername] = useState('testuser123');
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runCryptoTest = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      addResult('Starting cryptographic authentication test...');
      
      // Test 1: Key Generation
      addResult('Testing key pair generation...');
      const keyPair = await crypto.generateKeyPair();
      if (keyPair) {
        addResult('✓ Key pair generated successfully');
      } else {
        addResult('❌ Key pair generation failed');
        return;
      }
      
      // Test 2: Public Key Export
      addResult('Testing public key export...');
      const publicKeyBase64 = await crypto.exportPublicKey(keyPair.publicKey);
      if (publicKeyBase64) {
        addResult('✓ Public key exported successfully');
      } else {
        addResult('❌ Public key export failed');
        return;
      }
      
      // Test 3: Public Key Import
      addResult('Testing public key import...');
      const importedPublicKey = await crypto.importPublicKey(publicKeyBase64);
      if (importedPublicKey) {
        addResult('✓ Public key imported successfully');
      } else {
        addResult('❌ Public key import failed');
        return;
      }
      
      // Test 4: Data Signing
      addResult('Testing data signing...');
      const testData = 'Hello, WebCryptoAPI!';
      const signature = await crypto.signData(keyPair.privateKey, testData);
      if (signature) {
        addResult('✓ Data signed successfully');
      } else {
        addResult('❌ Data signing failed');
        return;
      }
      
      // Test 5: Signature Verification
      addResult('Testing signature verification...');
      const isValid = await crypto.verifySignature(importedPublicKey, signature, testData);
      if (isValid) {
        addResult('✓ Signature verified successfully');
      } else {
        addResult('❌ Signature verification failed');
        return;
      }
      
      // Test 6: User Registration
      addResult(`Testing user registration for: ${testUsername}`);
      const registerResult = await CryptoAuthService.register(testUsername);
      if (registerResult.success) {
        addResult('✓ User registration successful');
      } else {
        addResult(`❌ User registration failed: ${registerResult.error}`);
        return;
      }
      
             // Test 7: User Login
       addResult(`Testing user login for: ${testUsername}`);
       const loginResult = await CryptoAuthService.login(testUsername);
       if (loginResult.success) {
         addResult('✓ User login successful');
       } else {
         addResult(`❌ User login failed: ${loginResult.error}`);
         return;
       }
       
       // Test 8: Verify stored data integrity
       addResult('Testing stored data integrity...');
       const storedData = localStorage.getItem(`${testUsername}_authData`);
       if (storedData) {
         try {
           const parsed = JSON.parse(storedData);
           addResult(`  - Challenge length: ${parsed.challenge?.length || 0}`);
           addResult(`  - Signature length: ${parsed.signature?.length || 0}`);
           addResult(`  - Timestamp: ${parsed.timestamp || 'missing'}`);
         } catch (e) {
           addResult(`  - Data parse error: ${e}`);
         }
       } else {
         addResult('  - No stored auth data found');
       }
      
      addResult('🎉 All cryptographic tests passed!');
      
    } catch (error) {
      addResult(`❌ Test error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const checkStoredUsers = () => {
    const users = crypto.getRegisteredUsers();
    addResult(`Stored users: ${JSON.stringify(users)}`);
    
    users.forEach(user => {
      const publicKey = crypto.getPublicKey(user);
      const authData = localStorage.getItem(`${user}_authData`);
      addResult(`User: ${user}, Public Key: ${publicKey ? '✓' : '✗'}, Auth Data: ${authData ? '✓' : '✗'}`);
      
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          addResult(`  - Challenge: ${parsed.challenge ? '✓' : '✗'}`);
          addResult(`  - Signature: ${parsed.signature ? '✓' : '✗'}`);
          addResult(`  - Timestamp: ${parsed.timestamp || '✗'}`);
        } catch (e) {
          addResult(`  - Auth data parse error: ${e}`);
        }
      }
    });
    
    // Test the login popup functionality
    addResult('Testing login popup user detection...');
    try {
      const storedUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      addResult(`All registered users: ${JSON.stringify(storedUsers)}`);
      
      // Filter for users with valid keys (same logic as CryptID)
      const validUsers = storedUsers.filter((user: string) => {
        const publicKey = localStorage.getItem(`${user}_publicKey`);
        if (!publicKey) return false;
        
        const authData = localStorage.getItem(`${user}_authData`);
        if (!authData) return false;
        
        try {
          const parsed = JSON.parse(authData);
          return parsed.challenge && parsed.signature && parsed.timestamp;
        } catch (e) {
          return false;
        }
      });
      
      addResult(`Users with valid keys: ${JSON.stringify(validUsers)}`);
      addResult(`Valid users count: ${validUsers.length}/${storedUsers.length}`);
      
      if (validUsers.length > 0) {
        addResult(`Login popup would suggest: ${validUsers[0]}`);
      } else {
        addResult('No valid users found - would default to registration mode');
      }
    } catch (e) {
      addResult(`Error reading stored users: ${e}`);
    }
  };

  const cleanupInvalidUsers = () => {
    try {
      const storedUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      const validUsers = storedUsers.filter((user: string) => {
        const publicKey = localStorage.getItem(`${user}_publicKey`);
        const authData = localStorage.getItem(`${user}_authData`);
        
        if (!publicKey || !authData) return false;
        
        try {
          const parsed = JSON.parse(authData);
          return parsed.challenge && parsed.signature && parsed.timestamp;
        } catch (e) {
          return false;
        }
      });
      
      // Update the registered users list to only include valid users
      localStorage.setItem('registeredUsers', JSON.stringify(validUsers));
      
      addResult(`Cleaned up invalid users. Removed ${storedUsers.length - validUsers.length} invalid entries.`);
      addResult(`Remaining valid users: ${JSON.stringify(validUsers)}`);
    } catch (e) {
      addResult(`Error cleaning up users: ${e}`);
    }
  };

  return (
    <div className="crypto-debug-container">
      <h2>Cryptographic Authentication Debug</h2>
      
      <div className="debug-controls">
        <input
          type="text"
          value={testUsername}
          onChange={(e) => setTestUsername(e.target.value)}
          placeholder="Test username"
          className="debug-input"
        />
        <button 
          onClick={runCryptoTest} 
          disabled={isRunning}
          className="debug-button"
        >
          {isRunning ? 'Running Tests...' : 'Run Crypto Test'}
        </button>
        
        <button 
          onClick={checkStoredUsers}
          className="debug-button"
        >
          Check Stored Users
        </button>
        
        <button 
          onClick={cleanupInvalidUsers}
          className="debug-button"
        >
          Cleanup Invalid Users
        </button>
        
        <button 
          onClick={clearResults}
          disabled={isRunning}
          className="debug-button"
        >
          Clear Results
        </button>
      </div>
      
      <div className="debug-results">
        <h3>Debug Results:</h3>
        {testResults.length === 0 ? (
          <p>No test results yet. Click "Run Crypto Test" to start.</p>
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
    </div>
  );
};

export default CryptoDebug; 