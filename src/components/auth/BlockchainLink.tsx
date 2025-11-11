// Component for linking Web Crypto account with Ethereum wallet

import React, { useState } from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

export const BlockchainLink: React.FC = () => {
  const { wallet, linkedAccount, isConnecting, connect, linkWebCryptoAccount } = useBlockchain();
  const { session } = useAuth();
  const { addNotification } = useNotifications();
  const [isLinking, setIsLinking] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
      addNotification('Wallet connected successfully', 'success');
    } catch (error: any) {
      addNotification(error.message || 'Failed to connect wallet', 'error');
    }
  };

  const handleLink = async () => {
    if (!session.username) {
      addNotification('Please log in first', 'error');
      return;
    }

    if (!wallet) {
      addNotification('Please connect your wallet first', 'error');
      return;
    }

    setIsLinking(true);
    try {
      const result = await linkWebCryptoAccount(session.username);
      if (result.success) {
        addNotification('Account linked successfully!', 'success');
      } else {
        addNotification(result.error || 'Failed to link account', 'error');
      }
    } catch (error: any) {
      addNotification(error.message || 'Failed to link account', 'error');
    } finally {
      setIsLinking(false);
    }
  };

  if (!session.authed) {
    return (
      <div className="blockchain-link">
        <p>Please log in to link your Web Crypto account with a blockchain wallet.</p>
      </div>
    );
  }

  return (
    <div className="blockchain-link">
      <h3>Link Blockchain Wallet</h3>
      
      {!wallet ? (
        <div>
          <p>Connect your Ethereum wallet (MetaMask, etc.) to link it with your Web Crypto account.</p>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="btn btn-primary"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      ) : (
        <div>
          <div className="wallet-info">
            <p><strong>Connected Wallet:</strong> {wallet.address}</p>
            <p><strong>Chain ID:</strong> {wallet.chainId}</p>
          </div>

          {linkedAccount ? (
            <div className="linked-account">
              <p className="success">✓ Account linked successfully!</p>
              <p><strong>Ethereum Address:</strong> {linkedAccount.ethereumAddress}</p>
              {linkedAccount.proxyContractAddress && (
                <p><strong>Proxy Contract:</strong> {linkedAccount.proxyContractAddress}</p>
              )}
            </div>
          ) : (
            <div>
              <p>Link your Web Crypto account ({session.username}) with this wallet.</p>
              <button
                onClick={handleLink}
                disabled={isLinking}
                className="btn btn-primary"
              >
                {isLinking ? 'Linking...' : 'Link Account'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

