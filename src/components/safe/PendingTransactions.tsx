import { useState } from "react"
import {
  usePendingTransactions,
  useConfirmTransaction,
  useExecuteTransaction,
  type SafeTransaction,
} from "../../hooks/useSafeTransaction"
import { formatAddress } from "../../hooks/useWallet"

function TxCard({ tx, onRefresh }: { tx: SafeTransaction; onRefresh: () => void }) {
  const { confirm, isLoading: confirming } = useConfirmTransaction()
  const { execute, isLoading: executing } = useExecuteTransaction()
  const [signerKey, setSignerKey] = useState("")
  const [showActions, setShowActions] = useState(false)

  const thresholdMet = tx.confirmations.length >= tx.confirmationsRequired
  const sigProgress = `${tx.confirmations.length}/${tx.confirmationsRequired}`

  const valueEth = tx.value !== "0"
    ? `${(Number(tx.value) / 1e18).toFixed(6)} ETH`
    : "Contract call"

  const handleConfirm = async () => {
    if (!signerKey) return
    await confirm(tx.safeTxHash, signerKey)
    setSignerKey("")
    setShowActions(false)
    onRefresh()
  }

  const handleExecute = async () => {
    if (!signerKey) return
    await execute(tx.safeTxHash, signerKey)
    setSignerKey("")
    setShowActions(false)
    onRefresh()
  }

  return (
    <div
      style={{
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: 10,
        background: "#1e293b",
        marginBottom: 8,
      }}
    >
      {/* Header Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: "#e2e8f0" }}>#{tx.nonce}</span>
          <span style={{ color: "#64748b", marginLeft: 8 }}>→ {formatAddress(tx.to)}</span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 4,
            background: thresholdMet ? "#064e3b" : "#1e1b4b",
            color: thresholdMet ? "#34d399" : "#818cf8",
          }}
        >
          {sigProgress}
        </span>
      </div>

      {/* Value */}
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{valueEth}</div>

      {/* Signers */}
      <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
        {tx.confirmations.map((c) => (
          <span
            key={c.owner}
            style={{
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 3,
              background: "#064e3b",
              color: "#34d399",
              fontFamily: "monospace",
            }}
          >
            {formatAddress(c.owner, 3)}
          </span>
        ))}
      </div>

      {/* Actions Toggle */}
      <button
        onClick={() => setShowActions(!showActions)}
        style={{
          marginTop: 6,
          border: "none",
          background: "transparent",
          color: "#818cf8",
          cursor: "pointer",
          fontSize: 11,
          padding: 0,
          fontWeight: 600,
        }}
      >
        {showActions ? "Hide" : thresholdMet ? "Execute" : "Confirm"}
      </button>

      {/* Action Panel */}
      {showActions && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            type="password"
            placeholder="Signer private key (0x...)"
            value={signerKey}
            onChange={(e) => setSignerKey(e.target.value)}
            style={{
              padding: "6px 8px",
              border: "1px solid #334155",
              borderRadius: 4,
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: 11,
              fontFamily: "monospace",
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            {!thresholdMet && (
              <button
                onClick={handleConfirm}
                disabled={confirming || !signerKey}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: 4,
                  background: confirming ? "#334155" : "#818cf8",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: confirming ? "not-allowed" : "pointer",
                }}
              >
                {confirming ? "..." : "Confirm"}
              </button>
            )}
            {thresholdMet && (
              <button
                onClick={handleExecute}
                disabled={executing || !signerKey}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: 4,
                  background: executing ? "#334155" : "#12ff80",
                  color: "#0f172a",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: executing ? "not-allowed" : "pointer",
                }}
              >
                {executing ? "..." : "Execute On-Chain"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function PendingTransactions() {
  const { data: txs, isLoading, error, refetch } = usePendingTransactions()

  if (isLoading) {
    return <div style={{ color: "#64748b", fontSize: 12, textAlign: "center" }}>Loading...</div>
  }

  if (error) {
    return <div style={{ color: "#fca5a5", fontSize: 12 }}>Error: {error}</div>
  }

  if (txs.length === 0) {
    return (
      <div style={{ color: "#64748b", fontSize: 12, textAlign: "center", padding: 20 }}>
        No pending transactions
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
        {txs.length} pending transaction{txs.length !== 1 ? "s" : ""}
      </div>
      {txs.map((tx) => (
        <TxCard key={tx.safeTxHash} tx={tx} onRefresh={refetch} />
      ))}
    </div>
  )
}
