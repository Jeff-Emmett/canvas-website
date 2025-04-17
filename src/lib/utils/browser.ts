/**
 * Browser-specific utility functions
 * 
 * This module contains browser-specific functionality for environment detection
 * and other browser-related operations.
 */

/**
 * Check if we're in a browser environment
 */
export const isBrowser = (): boolean => typeof window !== 'undefined';

/**
 * Check if the browser supports the required features for the application
 */
export const checkBrowserSupport = (): boolean => {
  if (!isBrowser()) return false;
  
  // Check for IndexedDB support
  const hasIndexedDB = typeof window.indexedDB !== 'undefined';
  
  // Check for WebCrypto API support
  const hasWebCrypto = typeof window.crypto !== 'undefined' && 
                      typeof window.crypto.subtle !== 'undefined';
  
  // Check for other required browser features
  const hasLocalStorage = typeof window.localStorage !== 'undefined';
  const hasServiceWorker = 'serviceWorker' in navigator;
  
  return hasIndexedDB && hasWebCrypto && hasLocalStorage && hasServiceWorker;
};

/**
 * Check if we're in a secure context (HTTPS)
 */
export const isSecureContext = (): boolean => {
  if (!isBrowser()) return false;
  return window.isSecureContext;
};

/**
 * Get a URL parameter value
 * @param name The parameter name
 * @returns The parameter value or null if not found
 */
export const getUrlParameter = (name: string): string | null => {
  if (!isBrowser()) return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
};

/**
 * Set a cookie
 * @param name The cookie name
 * @param value The cookie value
 * @param days Number of days until expiration
 */
export const setCookie = (name: string, value: string, days: number = 7): void => {
  if (!isBrowser()) return;
  
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
};

/**
 * Get a cookie value
 * @param name The cookie name
 * @returns The cookie value or null if not found
 */
export const getCookie = (name: string): string | null => {
  if (!isBrowser()) return null;
  
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  
  return null;
};

/**
 * Delete a cookie
 * @param name The cookie name
 */
export const deleteCookie = (name: string): void => {
  if (!isBrowser()) return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Strict`;
};

/**
 * Check if the device is mobile
 */
export const isMobileDevice = (): boolean => {
  if (!isBrowser()) return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Get the browser name
 */
export const getBrowserName = (): string => {
  if (!isBrowser()) return 'unknown';
  
  const userAgent = navigator.userAgent;
  
  if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
  if (userAgent.indexOf('Chrome') > -1) return 'Chrome';
  if (userAgent.indexOf('Safari') > -1) return 'Safari';
  if (userAgent.indexOf('Edge') > -1) return 'Edge';
  if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident') > -1) return 'Internet Explorer';
  
  return 'unknown';
};

/**
 * Check if local storage is available
 */
export const isLocalStorageAvailable = (): boolean => {
  if (!isBrowser()) return false;
  
  try {
    const test = '__test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Safely get an item from local storage
 * @param key The storage key
 * @returns The stored value or null if not found
 */
export const getLocalStorageItem = (key: string): string | null => {
  if (!isBrowser() || !isLocalStorageAvailable()) return null;
  
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error('Error getting item from localStorage:', error);
    return null;
  }
};

/**
 * Safely set an item in local storage
 * @param key The storage key
 * @param value The value to store
 * @returns True if successful, false otherwise
 */
export const setLocalStorageItem = (key: string, value: string): boolean => {
  if (!isBrowser() || !isLocalStorageAvailable()) return false;
  
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error('Error setting item in localStorage:', error);
    return false;
  }
};

/**
 * Safely remove an item from local storage
 * @param key The storage key
 * @returns True if successful, false otherwise
 */
export const removeLocalStorageItem = (key: string): boolean => {
  if (!isBrowser() || !isLocalStorageAvailable()) return false;
  
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error removing item from localStorage:', error);
    return false;
  }
};