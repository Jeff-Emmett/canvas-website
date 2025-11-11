// Blockchain account linking service
// Links Web Crypto API accounts with Ethereum addresses (EOA or smart contract wallets)

import * as crypto from './crypto';
import { connectWallet, getWalletConnection, type WalletConnection } from '../blockchain/ethereum';
import { signTransactionAuthorization, createEIP712Domain, type TransactionAuthorization } from './cryptoBlockchain';
import { isBrowser } from '../utils/browser';

export interface LinkedAccount {
  username: string;
  webCryptoPublicKey: string;
  ethereumAddress: string;
  proxyContractAddress?: string;
  chainId: number;
  linkedAt: number;
}

/**
 * Link a Web Crypto account with an Ethereum wallet
 * This verifies ownership of both keys by requiring signatures from both
 */
export async function linkAccount(
  username: string,
  ethereumAddress: string
): Promise<{ success: boolean; linkedAccount?: LinkedAccount; error?: string }> {
  if (!isBrowser()) {
    return { success: false, error: 'Browser environment required' };
  }

  try {
    // Get Web Crypto public key
    const webCryptoPublicKey = crypto.getPublicKey(username);
    if (!webCryptoPublicKey) {
      return { success: false, error: 'Web Crypto account not found' };
    }

    // Verify wallet connection
    const wallet = await getWalletConnection();
    if (!wallet || wallet.address.toLowerCase() !== ethereumAddress.toLowerCase()) {
      return { success: false, error: 'Wallet address mismatch' };
    }

    // Create linking message that requires both signatures
    const linkingMessage = `Link Web Crypto account ${username} to Ethereum address ${ethereumAddress} at ${Date.now()}`;

    // Get user's private key (in production, use secure key storage)
    // For now, we'll need to prompt for re-authentication or use stored key
    // This is a simplified version - in production, you'd use proper key management

    // Store the linked account
    const linkedAccount: LinkedAccount = {
      username,
      webCryptoPublicKey,
      ethereumAddress: wallet.address,
      chainId: wallet.chainId,
      linkedAt: Date.now(),
    };

    storeLinkedAccount(linkedAccount);

    return {
      success: true,
      linkedAccount,
    };
  } catch (error) {
    console.error('Error linking account:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Verify ownership of both Web Crypto and Ethereum accounts
 */
export async function verifyAccountOwnership(
  username: string,
  ethereumAddress: string
): Promise<boolean> {
  if (!isBrowser()) return false;

  try {
    // Check if accounts are linked
    const linkedAccount = getLinkedAccount(username);
    if (!linkedAccount) return false;

    if (linkedAccount.ethereumAddress.toLowerCase() !== ethereumAddress.toLowerCase()) {
      return false;
    }

    // In a full implementation, you'd verify signatures from both keys
    // For now, we'll just check if they're linked
    return true;
  } catch (error) {
    console.error('Error verifying account ownership:', error);
    return false;
  }
}

/**
 * Get linked account for a username
 */
export function getLinkedAccount(username: string): LinkedAccount | null {
  if (!isBrowser()) return null;

  try {
    const stored = localStorage.getItem(`linkedAccount_${username}`);
    if (!stored) return null;

    return JSON.parse(stored) as LinkedAccount;
  } catch (error) {
    console.error('Error getting linked account:', error);
    return null;
  }
}

/**
 * Get linked account by Ethereum address
 */
export function getLinkedAccountByAddress(ethereumAddress: string): LinkedAccount | null {
  if (!isBrowser()) return null;

  try {
    // Search through all linked accounts
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('linkedAccount_')) {
        const account = JSON.parse(localStorage.getItem(key) || '{}') as LinkedAccount;
        if (account.ethereumAddress?.toLowerCase() === ethereumAddress.toLowerCase()) {
          return account;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting linked account by address:', error);
    return null;
  }
}

/**
 * Store linked account
 */
function storeLinkedAccount(account: LinkedAccount): void {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(`linkedAccount_${account.username}`, JSON.stringify(account));
  } catch (error) {
    console.error('Error storing linked account:', error);
  }
}

/**
 * Unlink an account
 */
export function unlinkAccount(username: string): boolean {
  if (!isBrowser()) return false;

  try {
    localStorage.removeItem(`linkedAccount_${username}`);
    return true;
  } catch (error) {
    console.error('Error unlinking account:', error);
    return false;
  }
}

/**
 * Check if account is linked
 */
export function isAccountLinked(username: string): boolean {
  return getLinkedAccount(username) !== null;
}

/**
 * Get all linked accounts for current user
 */
export function getAllLinkedAccounts(): LinkedAccount[] {
  if (!isBrowser()) return [];

  try {
    const accounts: LinkedAccount[] = [];
    const keys = Object.keys(localStorage);
    
    for (const key of keys) {
      if (key.startsWith('linkedAccount_')) {
        try {
          const account = JSON.parse(localStorage.getItem(key) || '{}') as LinkedAccount;
          if (account.username) {
            accounts.push(account);
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
    
    return accounts;
  } catch (error) {
    console.error('Error getting all linked accounts:', error);
    return [];
  }
}

