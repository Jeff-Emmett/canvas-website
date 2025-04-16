import * as crypto from './crypto';

/**
 * Validates if a username meets the required format
 * @param username The username to validate
 * @returns A boolean indicating if the username is valid
 */
export const isUsernameValid = async (username: string): Promise<boolean> => {
  console.log('Checking if username is valid:', username);
  try {
    // Basic validation - can be expanded as needed
    const isValid = crypto.isUsernameValid(username);
    console.log('Username validity check result:', isValid);
    return isValid;
  } catch (error) {
    console.error('Error checking username validity:', error);
    return false;
  }
};

/**
 * Checks if a username is available for registration
 * @param username The username to check
 * @returns A boolean indicating if the username is available
 */
export const isUsernameAvailable = async (
  username: string
): Promise<boolean> => {
  console.log('Checking if username is available:', username);
  try {
    const isAvailable = crypto.isUsernameAvailable(username);
    console.log('Username availability check result:', isAvailable);
    return isAvailable;
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false;
  }
};

/**
 * Registers a new user by generating cryptographic keys
 * @param username The username to register
 * @returns A boolean indicating if the registration was successful
 */
export const register = async (username: string): Promise<boolean> => {
  console.log('Starting registration process for username:', username);
  
  try {
    // Check if we're in a browser environment
    if (crypto.isBrowser()) {
      console.log('Generating cryptographic keys for user...');
      // Generate a key pair using Web Crypto API
      const keyPair = await crypto.generateKeyPair();
      
      if (keyPair) {
        // Export the public key
        const publicKeyBase64 = await crypto.exportPublicKey(keyPair.publicKey);
        
        if (publicKeyBase64) {
          console.log('Keys generated successfully');
          
          // Store the username and public key
          crypto.addRegisteredUser(username);
          crypto.storePublicKey(username, publicKeyBase64);
          
          // In a production scenario, you would send the public key to a server
          // and establish session management, etc.
          
          return true;
        } else {
          console.error('Failed to export public key');
          return false;
        }
      } else {
        console.error('Failed to generate key pair');
        return false;
      }
    } else {
      console.log('Not in browser environment, skipping key generation');
      return false;
    }
  } catch (error) {
    console.error('Error during registration process:', error);
    return false;
  }
};

/**
 * Loads a user account
 * @param username The username to load
 * @returns A Promise that resolves when the account is loaded
 */
export const loadAccount = async (username: string): Promise<boolean> => {
  console.log('Loading account for username:', username);
  
  try {
    // Check if the user exists in our local storage
    const users = crypto.getRegisteredUsers();
    if (!users.includes(username)) {
      console.error('User not found:', username);
      return false;
    }
    
    // Get the user's public key
    const publicKey = crypto.getPublicKey(username);
    if (!publicKey) {
      console.error('Public key not found for user:', username);
      return false;
    }
    
    // In a production scenario, you would verify the user's identity,
    // load their data from a server, etc.
    
    console.log('User account loaded successfully');
    return true;
  } catch (error) {
    console.error('Error during account loading:', error);
    return false;
  }
};