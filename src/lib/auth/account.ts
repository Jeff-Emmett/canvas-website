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
    const isValid = await odd.account.isUsernameValid(username);
    console.log('Username validity check result:', isValid);
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
  odd.account.isUsernameAvailable,
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
      const isAvailable = browser.isUsernameAvailable(username);
      console.log('Username availability check result:', isAvailable);
      return isAvailable;
    } else {
      // If not in a browser (SSR), use the ODD API
      const isAvailable = await debouncedIsUsernameAvailable(username);
      console.log('Username availability check result:', isAvailable);
      return isAvailable;
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
    
    return users.includes(username) && !!publicKey;
  } catch (error) {
    console.error('Error validating stored credentials:', error);
    return false;
  }
};