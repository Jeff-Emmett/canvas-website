# WebCryptoAPI Authentication Implementation

This document describes the complete WebCryptoAPI authentication system implemented in this project.

## Overview

The WebCryptoAPI authentication system provides cryptographic authentication using ECDSA P-256 key pairs, challenge-response authentication, and secure key storage. This is the primary authentication mechanism for the application.

## Architecture

### Core Components

1. **Crypto Module** (`src/lib/auth/crypto.ts`)
   - WebCryptoAPI wrapper functions
   - Key pair generation (ECDSA P-256)
   - Public key export/import
   - Data signing and verification
   - User credential storage

2. **CryptoAuthService** (`src/lib/auth/cryptoAuthService.ts`)
   - High-level authentication service
   - Challenge-response authentication
   - User registration and login
   - Credential verification

3. **AuthService** (`src/lib/auth/authService.ts`)
   - Simplified authentication service
   - Session management
   - Integration with CryptoAuthService

4. **UI Components**
   - `CryptID.tsx` - Cryptographic authentication UI
   - `CryptoDebug.tsx` - Debug component for verification
   - `CryptoTest.tsx` - Test component for verification

## Features

### ✅ Implemented

- **ECDSA P-256 Key Pairs**: Secure cryptographic key generation
- **Challenge-Response Authentication**: Prevents replay attacks
- **Public Key Infrastructure**: Store and verify public keys
- **Browser Support Detection**: Checks for WebCryptoAPI availability
- **Secure Context Validation**: Ensures HTTPS requirement
- **Modern UI**: Responsive design with dark mode support
- **Comprehensive Testing**: Test component for verification

### 🔧 Technical Details

#### Key Generation
```typescript
const keyPair = await crypto.generateKeyPair();
// Returns CryptoKeyPair with public and private keys
```

#### Public Key Export/Import
```typescript
const publicKeyBase64 = await crypto.exportPublicKey(keyPair.publicKey);
const importedKey = await crypto.importPublicKey(publicKeyBase64);
```

#### Data Signing and Verification
```typescript
const signature = await crypto.signData(privateKey, data);
const isValid = await crypto.verifySignature(publicKey, signature, data);
```

#### Challenge-Response Authentication
```typescript
// Generate challenge
const challenge = `${username}:${timestamp}:${random}`;

// Sign challenge during registration
const signature = await crypto.signData(privateKey, challenge);

// Verify during login
const isValid = await crypto.verifySignature(publicKey, signature, challenge);
```

## Browser Requirements

### Minimum Requirements
- **WebCryptoAPI Support**: `window.crypto.subtle`
- **Secure Context**: HTTPS or localhost
- **Modern Browser**: Chrome 37+, Firefox 34+, Safari 11+, Edge 12+

### Feature Detection
```typescript
const hasWebCrypto = typeof window.crypto !== 'undefined' &&
                    typeof window.crypto.subtle !== 'undefined';
const isSecure = window.isSecureContext;
```

## Security Considerations

### ✅ Implemented Security Measures

1. **Secure Context Requirement**: Only works over HTTPS
2. **ECDSA P-256**: Industry-standard elliptic curve
3. **Challenge-Response**: Prevents replay attacks
4. **Key Storage**: Public keys stored securely in localStorage
5. **Input Validation**: Username format validation
6. **Error Handling**: Comprehensive error management

### ⚠️ Security Notes

1. **Private Key Storage**: Currently uses localStorage for demo purposes
   - In production, consider using Web Crypto API's non-extractable keys
   - Consider hardware security modules (HSM)
   - Implement proper key derivation

2. **Session Management**:
   - Uses localStorage for session persistence
   - Consider implementing JWT tokens for server-side verification
   - Add session expiration and refresh logic

3. **Network Security**:
   - All crypto operations happen client-side
   - No private keys transmitted over network
   - Consider adding server-side signature verification

## Usage

### Basic Authentication Flow

```typescript
import { CryptoAuthService } from './lib/auth/cryptoAuthService';

// Register a new user
const registerResult = await CryptoAuthService.register('username');
if (registerResult.success) {
  console.log('User registered successfully');
}

// Login with existing user
const loginResult = await CryptoAuthService.login('username');
if (loginResult.success) {
  console.log('User authenticated successfully');
}
```

### Integration with React Context

```typescript
import { useAuth } from './context/AuthContext';

const { login, register } = useAuth();

// AuthService automatically uses crypto auth
const success = await login('username');
```

### Using the CryptID Component

```typescript
import CryptID from './components/auth/CryptID';

// Render the authentication component
<CryptID
  onSuccess={() => console.log('Login successful')}
  onCancel={() => console.log('Login cancelled')}
/>
```

### Testing the Implementation

```typescript
import CryptoTest from './components/auth/CryptoTest';

// Render the test component to verify functionality
<CryptoTest />
```

## File Structure

```
src/
├── lib/
│   ├── auth/
│   │   ├── crypto.ts                 # WebCryptoAPI wrapper
│   │   ├── cryptoAuthService.ts      # High-level auth service
│   │   ├── authService.ts            # Simplified auth service
│   │   ├── sessionPersistence.ts     # Session storage utilities
│   │   └── types.ts                  # TypeScript types
│   └── utils/
│       └── browser.ts                # Browser support detection
├── components/
│   └── auth/
│       ├── CryptID.tsx               # Main crypto auth UI
│       ├── CryptoDebug.tsx           # Debug component
│       └── CryptoTest.tsx            # Test component
├── context/
│   └── AuthContext.tsx               # React context for auth state
└── css/
    └── crypto-auth.css               # Styles for crypto components
```

## Dependencies

### Required Packages
- `one-webcrypto`: WebCryptoAPI polyfill (^1.0.3)

### Browser APIs Used
- `window.crypto.subtle`: WebCryptoAPI
- `window.localStorage`: Key and session storage
- `window.isSecureContext`: Security context check

## Storage

### localStorage Keys Used
- `registeredUsers`: Array of registered usernames
- `${username}_publicKey`: User's public key (Base64)
- `${username}_authData`: Authentication data (challenge, signature, timestamp)
- `session`: Current user session data

## Testing

### Manual Testing
1. Navigate to the application
2. Use the `CryptoTest` component to run automated tests
3. Verify all test cases pass
4. Test on different browsers and devices

### Test Cases
- [x] Browser support detection
- [x] Secure context validation
- [x] Key pair generation
- [x] Public key export/import
- [x] Data signing and verification
- [x] User registration
- [x] User login
- [x] Credential verification
- [x] Session persistence

## Troubleshooting

### Common Issues

1. **"Browser not supported"**
   - Ensure you're using a modern browser
   - Check if WebCryptoAPI is available
   - Verify HTTPS or localhost

2. **"Secure context required"**
   - Access the application over HTTPS
   - For development, use localhost

3. **"Key generation failed"**
   - Check browser console for errors
   - Verify WebCryptoAPI permissions
   - Try refreshing the page

4. **"Authentication failed"**
   - Verify user exists in localStorage
   - Check stored credentials
   - Clear browser data and retry

### Debug Mode

Enable debug logging by opening the browser console:
```typescript
localStorage.setItem('debug_crypto', 'true');
```

## Future Enhancements

### Planned Improvements
1. **Enhanced Key Storage**: Use Web Crypto API's non-extractable keys
2. **Server-Side Verification**: Add server-side signature verification
3. **Multi-Factor Authentication**: Add additional authentication factors
4. **Key Rotation**: Implement automatic key rotation
5. **Hardware Security**: Support for hardware security modules

### Advanced Features
1. **Zero-Knowledge Proofs**: Implement ZKP for enhanced privacy
2. **Threshold Cryptography**: Distributed key management
3. **Post-Quantum Cryptography**: Prepare for quantum threats
4. **Biometric Integration**: Add biometric authentication

## Integration with Automerge Sync

The authentication system works seamlessly with the Automerge-based real-time collaboration:

- **User Identification**: Each user is identified by their username in Automerge
- **Session Management**: Sessions persist across page reloads via localStorage
- **Collaboration**: Authenticated users can join shared canvas rooms
- **Privacy**: Only authenticated users can access canvas data

## Contributing

When contributing to the WebCryptoAPI authentication system:

1. **Security First**: All changes must maintain security standards
2. **Test Thoroughly**: Run the test suite before submitting
3. **Document Changes**: Update this documentation
4. **Browser Compatibility**: Test on multiple browsers
5. **Performance**: Ensure crypto operations don't block UI

## References

- [WebCryptoAPI Specification](https://www.w3.org/TR/WebCryptoAPI/)
- [ECDSA Algorithm](https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm)
- [P-256 Curve](https://en.wikipedia.org/wiki/NIST_Curve_P-256)
- [Challenge-Response Authentication](https://en.wikipedia.org/wiki/Challenge%E2%80%93response_authentication)
