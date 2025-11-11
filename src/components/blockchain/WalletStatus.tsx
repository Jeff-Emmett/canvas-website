// Component to display wallet connection status and linked account info

import React from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { useAuth } from '../../context/AuthContext';

export const WalletStatus: React.FC = () => {
  const { wallet, linkedAccount } = useBlockchain();
  const { session } = useAuth();

  if (!session.authed) {
    return null;
  }

  return (
    <div className="wallet-status">
      <h4>Blockchain Status</h4>
      
      {wallet ? (
        <div className="wallet-connected">
          <p className="status-indicator connected">● Wallet Connected</p>
          <div className="wallet-details">
            <p><strong>Address:</strong> <code>{wallet.address}</code></p>
            <p><strong>Chain ID:</strong> {wallet.chainId}</p>
          </div>
        </div>
      ) : (
        <div className="wallet-disconnected">
          <p className="status-indicator disconnected">○ Wallet Not Connected</p>
          <p>Connect a wallet to enable blockchain transactions.</p>
        </div>
      )}

      {linkedAccount && (
        <div className="linked-account-info">
          <p className="status-indicator linked">✓ Account Linked</p>
          <p><strong>Web Crypto:</strong> {session.username}</p>
          <p><strong>Ethereum:</strong> {linkedAccount.ethereumAddress}</p>
        </div>
      )}
    </div>
  );
};

