// Component for building and authorizing blockchain transactions using Web Crypto API

import React, { useState } from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { signTransactionAuthorization, createEIP712Domain, type TransactionAuthorization } from '../../lib/auth/cryptoBlockchain';
import { buildProxyExecuteTransaction, sendTransaction, type ProxyContractConfig } from '../../lib/blockchain/ethereum';
import { submitToRelayer, getRelayerConfig, type RelayerTransactionRequest } from '../../lib/blockchain/relayer';
import * as crypto from '../../lib/auth/crypto';
import { getUserPrivateKey } from '../../lib/auth/cryptoBlockchain';

export const TransactionBuilder: React.FC = () => {
  const { wallet, linkedAccount } = useBlockchain();
  const { session } = useAuth();
  const { addNotification } = useNotifications();

  const [to, setTo] = useState('');
  const [value, setValue] = useState('');
  const [data, setData] = useState('');
  const [useGasless, setUseGasless] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const handleBuildTransaction = async () => {
    if (!wallet || !linkedAccount) {
      addNotification('Please connect and link your wallet first', 'error');
      return;
    }

    if (!session.username) {
      addNotification('Please log in first', 'error');
      return;
    }

    if (!to || !to.match(/^0x[a-fA-F0-9]{40}$/)) {
      addNotification('Invalid recipient address', 'error');
      return;
    }

    setIsBuilding(true);
    try {
      // Get user's private key (in production, use secure key storage)
      const privateKey = await getUserPrivateKey(session.username);
      if (!privateKey) {
        addNotification('Unable to access Web Crypto private key. Please re-authenticate.', 'error');
        setIsBuilding(false);
        return;
      }

      // Create transaction authorization
      const authorization: TransactionAuthorization = {
        to: to as `0x${string}`,
        value: value ? BigInt(value).toString(16) : '0',
        data: data || '0x',
        nonce: Date.now(), // In production, use a proper nonce from the contract
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      // Create EIP-712 domain
      const domain = createEIP712Domain(
        wallet.chainId,
        linkedAccount.proxyContractAddress || '0x0000000000000000000000000000000000000000'
      );

      // Sign with Web Crypto API
      const signed = await signTransactionAuthorization(privateKey, authorization, domain);
      if (!signed) {
        addNotification('Failed to sign transaction', 'error');
        setIsBuilding(false);
        return;
      }

      // Build transaction for proxy contract
      // Note: You'll need the proxy contract ABI
      const proxyConfig: ProxyContractConfig = {
        address: linkedAccount.proxyContractAddress as `0x${string}` || '0x0000000000000000000000000000000000000000',
        chainId: wallet.chainId,
        abi: [
          {
            name: 'execute',
            type: 'function',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'data', type: 'bytes' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
              { name: 'signature', type: 'bytes' },
            ],
          },
        ],
      };

      // Check if gasless transactions are available
      const relayerConfig = getRelayerConfig(wallet.chainId);
      const shouldUseGasless = useGasless && relayerConfig;

      if (shouldUseGasless && relayerConfig) {
        // Submit to relayer for gasless transaction
        setIsAuthorizing(true);
        const relayerRequest: RelayerTransactionRequest = {
          authorization,
          signature: signed.signature,
          proxyContractAddress: linkedAccount.proxyContractAddress as `0x${string}` || '0x0000000000000000000000000000000000000000',
          chainId: wallet.chainId,
        };

        const result = await submitToRelayer(relayerConfig, relayerRequest);
        if (result.success && result.transactionHash) {
          addNotification(`Gasless transaction submitted: ${result.transactionHash}`, 'success');
        } else {
          addNotification(result.error || 'Failed to submit gasless transaction', 'error');
        }
      } else {
        // Submit through wallet (user pays gas)
        const transaction = buildProxyExecuteTransaction(
          proxyConfig,
          authorization.to as `0x${string}`,
          BigInt(authorization.value),
          authorization.data as `0x${string}`,
          BigInt(authorization.nonce),
          BigInt(authorization.deadline),
          signed.signature
        );

        setIsAuthorizing(true);
        const hash = await sendTransaction(wallet.chainId, transaction);
        addNotification(`Transaction submitted: ${hash}`, 'success');
      }
      
      // Reset form
      setTo('');
      setValue('');
      setData('');
    } catch (error: any) {
      console.error('Error building transaction:', error);
      addNotification(error.message || 'Failed to build transaction', 'error');
    } finally {
      setIsBuilding(false);
      setIsAuthorizing(false);
    }
  };

  if (!wallet || !linkedAccount) {
    return (
      <div className="transaction-builder">
        <p>Please connect and link your wallet to build transactions.</p>
      </div>
    );
  }

  return (
    <div className="transaction-builder">
      <h3>Build Transaction</h3>
      <p>Create a transaction authorized by your Web Crypto account.</p>

      <div className="form-group">
        <label>
          To Address:
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x..."
            className="form-control"
          />
        </label>
      </div>

      <div className="form-group">
        <label>
          Value (ETH):
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.0"
            className="form-control"
          />
        </label>
      </div>

      <div className="form-group">
        <label>
          Data (hex, optional):
          <input
            type="text"
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder="0x..."
            className="form-control"
          />
        </label>
      </div>

      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={useGasless}
            onChange={(e) => setUseGasless(e.target.checked)}
          />
          <span>Use gasless transaction (if relayer available)</span>
        </label>
        {useGasless && !getRelayerConfig(wallet.chainId) && (
          <p style={{ fontSize: '12px', color: '#dc3545', marginTop: '4px' }}>
            ⚠️ Relayer not configured for this chain. Transaction will use wallet.
          </p>
        )}
      </div>

      <button
        onClick={handleBuildTransaction}
        disabled={isBuilding || isAuthorizing}
        className="btn btn-primary"
      >
        {isBuilding ? 'Building...' : isAuthorizing ? 'Authorizing...' : 'Build & Sign Transaction'}
      </button>
    </div>
  );
};

