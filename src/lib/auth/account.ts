import * as odd from '@oddjs/odd';
import type FileSystem from '@oddjs/odd/fs/index';
import { asyncDebounce } from '../utils/asyncDebounce';
import * as browser from '../utils/browser';
import { DIRECTORIES } from '../../context/FileSystemContext';

/**
 * Constants for filesystem paths
 */
export const ACCOUNT_SETTINGS_DIR = ['private', 'settings'];
export const GALLERY_DIRS = {
  PUBLIC: ['public', 'gallery'],
  PRIVATE: ['private', 'gallery']
};
export const AREAS = {
  PUBLIC: 'public',
  PRIVATE: 'private'
};

/**
 * Checks if a username is valid according to ODD's rules
 * @param username The username to check
 * @returns A boolean indicating if the username is valid
 */
export const isUsernameValid = async (username: string): Promise<boolean> => {
  console.log('Checking if username is valid:', username);
  try {
    // Fallback if ODD account functions are not available
    if (odd.account && odd.account.isUsernameValid) {
      const isValid = await odd.account.isUsernameValid(username);
      console.log('Username validity check result:', isValid);
      return Boolean(isValid);
    }
    // Default validation if ODD is not available
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    const isValid = usernameRegex.test(username);
    console.log('Username validity check result (fallback):', isValid);
    return isValid;
  } catch (error) {
    console.error('Error checking username validity:', error);
    return false;
  }
};

/**
 * Debounced function to check if a username is available
 */
const debouncedIsUsernameAvailable = asyncDebounce(
  (username: string) => {
    // Fallback if ODD account functions are not available
    if (odd.account && odd.account.isUsernameAvailable) {
      return odd.account.isUsernameAvailable(username);
    }
    // Default to true if ODD is not available
    return Promise.resolve(true);
  },
  300
);

/**
 * Checks if a username is available
 * @param username The username to check
 * @returns A boolean indicating if the username is available
 */
export const isUsernameAvailable = async (
  username: string
): Promise<boolean> => {
  console.log('Checking if username is available:', username);
  try {
    // In a local development environment, simulate the availability check
    // by checking if the username exists in localStorage
    if (browser.isBrowser()) {
      const isAvailable = await browser.isUsernameAvailable(username);
      console.log('Username availability check result:', isAvailable);
      return isAvailable;
    } else {
      // If not in a browser (SSR), use the ODD API
      const isAvailable = await debouncedIsUsernameAvailable(username);
      console.log('Username availability check result:', isAvailable);
      return Boolean(isAvailable);
    }
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false;
  }
};

/**
 * Create additional directories and files needed by the app
 * @param fs FileSystem
 */
export const initializeFilesystem = async (fs: FileSystem): Promise<void> => {
  try {
    // Create required directories
    console.log('Creating required directories...');
    
    // Fallback if ODD path is not available
    if (!odd.path || !odd.path.directory) {
      console.log('ODD path not available, skipping filesystem initialization');
      return;
    }
    
    // Public directories
    await fs.mkdir(odd.path.directory(...DIRECTORIES.PUBLIC.ROOT));
    await fs.mkdir(odd.path.directory(...DIRECTORIES.PUBLIC.GALLERY));
    await fs.mkdir(odd.path.directory(...DIRECTORIES.PUBLIC.DOCUMENTS));
    
    // Private directories
    await fs.mkdir(odd.path.directory(...DIRECTORIES.PRIVATE.ROOT));
    await fs.mkdir(odd.path.directory(...DIRECTORIES.PRIVATE.GALLERY));
    await fs.mkdir(odd.path.directory(...DIRECTORIES.PRIVATE.SETTINGS));
    await fs.mkdir(odd.path.directory(...DIRECTORIES.PRIVATE.DOCUMENTS));
    
    console.log('Filesystem initialized successfully');
  } catch (error) {
    console.error('Error during filesystem initialization:', error);
    throw error;
  }
};

/**
 * Checks data root for a username with retries
 * @param username The username to check
 */
export const checkDataRoot = async (username: string): Promise<void> => {
  console.log('Looking up data root for username:', username);
  
  // Fallback if ODD dataRoot is not available
  if (!odd.dataRoot || !odd.dataRoot.lookup) {
    console.log('ODD dataRoot not available, skipping data root lookup');
    return;
  }
  
  let dataRoot = await odd.dataRoot.lookup(username);
  console.log('Initial data root lookup result:', dataRoot ? 'found' : 'not found');

  if (dataRoot) return;

  console.log('Data root not found, starting retry process...');
  return new Promise((resolve, reject) => {
    const maxRetries = 20;
    let attempt = 0;

    const dataRootInterval = setInterval(async () => {
      console.warn(`Could not fetch filesystem data root. Retrying (${attempt + 1}/${maxRetries})`);

      dataRoot = await odd.dataRoot.lookup(username);
      console.log(`Retry ${attempt + 1} result:`, dataRoot ? 'found' : 'not found');

      if (!dataRoot && attempt < maxRetries) {
        attempt++;
        return;
      }

      console.log(`Retry process completed. Data root ${dataRoot ? 'found' : 'not found'} after ${attempt + 1} attempts`);
      clearInterval(dataRootInterval);
      
      if (dataRoot) {
        resolve();
      } else {
        reject(new Error(`Data root not found after ${maxRetries} attempts`));
      }
    }, 500);
  });
};

/**
 * Generate a cryptographic key pair and store in localStorage during registration
 * @param username The username being registered
 */
export const generateUserCredentials = async (username: string): Promise<boolean> => {
  if (!browser.isBrowser()) return false;
  
  try {
    console.log('Generating cryptographic keys for user...');
    // Generate a key pair using Web Crypto API
    const keyPair = await browser.generateKeyPair();
    
    if (!keyPair) {
      console.error('Failed to generate key pair');
      return false;
    }
    
    // Export the public key
    const publicKeyBase64 = await browser.exportPublicKey(keyPair.publicKey);
    
    if (!publicKeyBase64) {
      console.error('Failed to export public key');
      return false;
    }
    
    console.log('Keys generated successfully');
    
    // Store the username and public key
    browser.addRegisteredUser(username);
    browser.storePublicKey(username, publicKeyBase64);
    
    return true;
  } catch (error) {
    console.error('Error generating user credentials:', error);
    return false;
  }
};

/**
 * Validate a user's stored credentials (for development mode)
 * @param username The username to validate
 */
export const validateStoredCredentials = (username: string): boolean => {
  if (!browser.isBrowser()) return false;
  
  try {
    const users = browser.getRegisteredUsers();
    const publicKey = browser.getPublicKey(username);
    
    return users.includes(username) && Boolean(publicKey);
  } catch (error) {
    console.error('Error validating stored credentials:', error);
    return false;
  }
};

/**
 * Register a new user with the specified username
 * @param username The username to register
 * @returns A boolean indicating if registration was successful
 */
export const register = async (username: string): Promise<boolean> => {
  try {
    console.log('Registering user:', username);
    
    // Check if username is valid
    const isValid = await isUsernameValid(username);
    if (!isValid) {
      console.error('Invalid username format');
      return false;
    }
    
    // Check if username is available
    const isAvailable = await isUsernameAvailable(username);
    if (!isAvailable) {
      console.error('Username is not available');
      return false;
    }
    
    // Generate user credentials
    const credentialsGenerated = await generateUserCredentials(username);
    if (!credentialsGenerated) {
      console.error('Failed to generate user credentials');
      return false;
    }
    
    console.log('User registration successful');
    return true;
  } catch (error) {
    console.error('Error during user registration:', error);
    return false;
  }
};