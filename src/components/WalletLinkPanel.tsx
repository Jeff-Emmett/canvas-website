/**
 * WalletLinkPanel - UI for connecting and linking Web3 wallets to enCryptID
 *
 * Features:
 * - Connect wallet (MetaMask, WalletConnect, etc.)
 * - Link wallet to enCryptID account via signature
 * - View and manage linked wallets
 * - Set primary wallet
 * - Unlink wallets
 */

import React, { useState } from 'react';
import {
  useWalletConnection,
  useWalletLink,
  useLinkedWallets,
  formatAddress,
  LinkedWallet,
} from '../hooks/useWallet';
import { useAuth } from '../context/AuthContext';

// =============================================================================
// Styles (inline for simplicity - can be moved to CSS/Tailwind)
// =============================================================================

const styles = {
  container: {
    padding: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
  section: {
    marginBottom: '24px',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#374151',
  } as React.CSSProperties,
  card: {
    background: '#f9fafb',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '8px',
  } as React.CSSProperties,
  button: {
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  } as React.CSSProperties,
  buttonSecondary: {
    background: '#e5e7eb',
    color: '#374151',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  } as React.CSSProperties,
  buttonDanger: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  } as React.CSSProperties,
  buttonSmall: {
    padding: '4px 8px',
    fontSize: '12px',
  } as React.CSSProperties,
  flexRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,
  address: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#6b7280',
  } as React.CSSProperties,
  badge: {
    background: '#dbeafe',
    color: '#1d4ed8',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
  } as React.CSSProperties,
  badgePrimary: {
    background: '#dcfce7',
    color: '#166534',
  } as React.CSSProperties,
  error: {
    color: '#ef4444',
    fontSize: '13px',
    marginTop: '8px',
  } as React.CSSProperties,
  success: {
    color: '#22c55e',
    fontSize: '13px',
    marginTop: '8px',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    marginBottom: '8px',
  } as React.CSSProperties,
  connectorButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '8px',
    transition: 'border-color 0.2s',
  } as React.CSSProperties,
  walletIcon: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    background: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
  } as React.CSSProperties,
};

// =============================================================================
// Sub-components
// =============================================================================

interface ConnectWalletSectionProps {
  onConnect: (connectorId?: string) => void;
  connectors: Array<{ id: string; name: string; type: string }>;
  isConnecting: boolean;
}

function ConnectWalletSection({ onConnect, connectors, isConnecting }: ConnectWalletSectionProps) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Connect Wallet</div>
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => onConnect(connector.id)}
          disabled={isConnecting}
          style={styles.connectorButton}
        >
          <div style={styles.walletIcon}>
            {connector.name === 'MetaMask' ? '🦊' :
             connector.name === 'WalletConnect' ? '🔗' :
             connector.name === 'Coinbase Wallet' ? '🔵' : '👛'}
          </div>
          <span>{connector.name}</span>
          {isConnecting && <span style={{ marginLeft: 'auto', color: '#9ca3af' }}>Connecting...</span>}
        </button>
      ))}
    </div>
  );
}

interface ConnectedWalletSectionProps {
  address: string;
  ensName: string | null;
  chainId: number;
  connectorName: string | undefined;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}

function ConnectedWalletSection({
  address,
  ensName,
  chainId,
  connectorName,
  onDisconnect,
  isDisconnecting,
}: ConnectedWalletSectionProps) {
  const chainNames: Record<number, string> = {
    1: 'Ethereum',
    10: 'Optimism',
    137: 'Polygon',
    42161: 'Arbitrum',
    8453: 'Base',
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Connected Wallet</div>
      <div style={styles.card}>
        <div style={styles.flexBetween}>
          <div>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>
              {ensName || formatAddress(address)}
            </div>
            <div style={styles.address}>{formatAddress(address, 6)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={styles.badge}>{chainNames[chainId] || `Chain ${chainId}`}</div>
            {connectorName && (
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                via {connectorName}
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          <button
            onClick={onDisconnect}
            disabled={isDisconnecting}
            style={styles.buttonSecondary}
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface LinkWalletSectionProps {
  address: string;
  isLinking: boolean;
  linkError: string | null;
  onLink: (label?: string) => Promise<{ success: boolean; error?: string }>;
  isAuthenticated: boolean;
}

function LinkWalletSection({
  address: _address,
  isLinking,
  linkError,
  onLink,
  isAuthenticated,
}: LinkWalletSectionProps) {
  const [label, setLabel] = useState('');
  const [success, setSuccess] = useState(false);

  const handleLink = async () => {
    setSuccess(false);
    const result = await onLink(label || undefined);
    if (result.success) {
      setSuccess(true);
      setLabel('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Link to enCryptID</div>
        <div style={{ ...styles.card, color: '#6b7280' }}>
          Please sign in with enCryptID to link your wallet.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Link to enCryptID</div>
      <div style={styles.card}>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
          Link this wallet to your enCryptID account. You'll be asked to sign a message
          to prove ownership.
        </p>
        <input
          type="text"
          placeholder="Label (optional, e.g., 'Main Wallet')"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={styles.input}
        />
        <button
          onClick={handleLink}
          disabled={isLinking}
          style={styles.button}
        >
          {isLinking ? 'Signing...' : 'Link Wallet'}
        </button>
        {linkError && <div style={styles.error}>{linkError}</div>}
        {success && <div style={styles.success}>Wallet linked successfully!</div>}
      </div>
    </div>
  );
}

interface LinkedWalletItemProps {
  wallet: LinkedWallet;
  onSetPrimary: () => Promise<boolean>;
  onUnlink: () => Promise<boolean>;
}

function LinkedWalletItem({ wallet, onSetPrimary, onUnlink }: LinkedWalletItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSetPrimary = async () => {
    setIsUpdating(true);
    await onSetPrimary();
    setIsUpdating(false);
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink this wallet?')) return;
    setIsUpdating(true);
    await onUnlink();
    setIsUpdating(false);
  };

  return (
    <div style={styles.card}>
      <div style={styles.flexBetween}>
        <div>
          <div style={styles.flexRow}>
            <span style={{ fontWeight: 500 }}>
              {wallet.ensName || wallet.label || formatAddress(wallet.address)}
            </span>
            {wallet.isPrimary && (
              <span style={{ ...styles.badge, ...styles.badgePrimary }}>Primary</span>
            )}
            <span style={styles.badge}>{wallet.type.toUpperCase()}</span>
          </div>
          <div style={{ ...styles.address, marginTop: '4px' }}>
            {formatAddress(wallet.address, 8)}
          </div>
        </div>
        <div style={{ ...styles.flexRow, gap: '4px' }}>
          {!wallet.isPrimary && (
            <button
              onClick={handleSetPrimary}
              disabled={isUpdating}
              style={{ ...styles.buttonSecondary, ...styles.buttonSmall }}
            >
              Set Primary
            </button>
          )}
          <button
            onClick={handleUnlink}
            disabled={isUpdating}
            style={{ ...styles.buttonDanger, ...styles.buttonSmall }}
          >
            Unlink
          </button>
        </div>
      </div>
    </div>
  );
}

interface LinkedWalletsSectionProps {
  wallets: LinkedWallet[];
  isLoading: boolean;
  error: string | null;
  onUpdateWallet: (address: string, updates: { isPrimary?: boolean }) => Promise<boolean>;
  onUnlinkWallet: (address: string) => Promise<boolean>;
}

function LinkedWalletsSection({
  wallets,
  isLoading,
  error,
  onUpdateWallet,
  onUnlinkWallet,
}: LinkedWalletsSectionProps) {
  if (isLoading) {
    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Linked Wallets</div>
        <div style={{ color: '#9ca3af', fontSize: '13px' }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Linked Wallets</div>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Linked Wallets</div>
        <div style={{ color: '#9ca3af', fontSize: '13px' }}>
          No wallets linked yet. Connect a wallet and link it above.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Linked Wallets ({wallets.length})</div>
      {wallets.map((wallet) => (
        <LinkedWalletItem
          key={wallet.id}
          wallet={wallet}
          onSetPrimary={() => onUpdateWallet(wallet.address, { isPrimary: true })}
          onUnlink={() => onUnlinkWallet(wallet.address)}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function WalletLinkPanel() {
  const { session } = useAuth();
  const {
    address,
    isConnected,
    isConnecting,
    chainId,
    connectorName,
    ensName,
    connect,
    disconnect,
    isDisconnecting,
    connectors,
  } = useWalletConnection();

  const { isLinking, linkError, linkWallet, clearError } = useWalletLink();

  const {
    wallets,
    isLoading: isLoadingWallets,
    error: walletsError,
    updateWallet,
    unlinkWallet,
    refetch: refetchWallets,
  } = useLinkedWallets();

  // Check if the connected wallet is already linked
  const isCurrentWalletLinked = address
    ? wallets.some(w => w.address.toLowerCase() === address.toLowerCase())
    : false;

  const handleLink = async (label?: string) => {
    clearError();
    const result = await linkWallet(label);
    if (result.success) {
      await refetchWallets();
    }
    return result;
  };

  return (
    <div style={styles.container}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
        Web3 Wallet
      </h3>

      {!isConnected ? (
        <ConnectWalletSection
          onConnect={connect}
          connectors={connectors}
          isConnecting={isConnecting}
        />
      ) : (
        <>
          <ConnectedWalletSection
            address={address!}
            ensName={ensName}
            chainId={chainId}
            connectorName={connectorName}
            onDisconnect={disconnect}
            isDisconnecting={isDisconnecting}
          />

          {!isCurrentWalletLinked && (
            <LinkWalletSection
              address={address!}
              isLinking={isLinking}
              linkError={linkError}
              onLink={handleLink}
              isAuthenticated={session.authed}
            />
          )}
        </>
      )}

      <LinkedWalletsSection
        wallets={wallets}
        isLoading={isLoadingWallets}
        error={walletsError}
        onUpdateWallet={updateWallet}
        onUnlinkWallet={unlinkWallet}
      />
    </div>
  );
}

export default WalletLinkPanel;
