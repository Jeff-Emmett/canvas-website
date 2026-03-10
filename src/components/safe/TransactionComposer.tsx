import { useState } from "react"
import { useProposeTransaction, useSafeBalances } from "../../hooks/useSafeTransaction"
import { useWalletConnection } from "../../hooks/useWallet"

export function TransactionComposer() {
  const { address, isConnected } = useWalletConnection()
  const { data: balances } = useSafeBalances()
  const { propose, isLoading, error } = useProposeTransaction()

  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [tokenAddress, setTokenAddress] = useState("")
  const [title, setTitle] = useState("")
  const [signerKey, setSignerKey] = useState("")
  const [result, setResult] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!recipient || !amount || !signerKey) return

    const res = await propose({
      recipientAddress: recipient,
      amount,
      tokenAddress: tokenAddress || undefined,
      title: title || undefined,
      signerPrivateKey: signerKey,
    })

    if (res) {
      setResult(`Proposed: ${res.safeTxHash.slice(0, 16)}...`)
      setRecipient("")
      setAmount("")
      setTitle("")
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #334155",
    borderRadius: 6,
    background: "#1e293b",
    color: "#e2e8f0",
    fontSize: 12,
    fontFamily: "monospace",
    outline: "none",
    boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: 4,
    display: "block",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Title */}
      <div>
        <label style={labelStyle}>Description (optional)</label>
        <input
          style={inputStyle}
          placeholder="Payment for..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Recipient */}
      <div>
        <label style={labelStyle}>Recipient Address *</label>
        <input
          style={inputStyle}
          placeholder="0x..."
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>

      {/* Token (optional) */}
      <div>
        <label style={labelStyle}>Token Address (empty = native ETH)</label>
        <select
          style={{ ...inputStyle, fontFamily: "Inter, system-ui, sans-serif" }}
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
        >
          <option value="">ETH (native)</option>
          {balances?.balances
            ?.filter((b) => b.tokenAddress && b.token)
            .map((b) => (
              <option key={b.tokenAddress} value={b.tokenAddress!}>
                {b.token!.symbol} — {(Number(b.balance) / 10 ** b.token!.decimals).toFixed(4)}
              </option>
            ))}
        </select>
      </div>

      {/* Amount */}
      <div>
        <label style={labelStyle}>Amount * {tokenAddress ? "(token units)" : "(wei)"}</label>
        <input
          style={inputStyle}
          placeholder={tokenAddress ? "100" : "1000000000000000"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="text"
        />
      </div>

      {/* Signer Key */}
      <div>
        <label style={labelStyle}>Signer Private Key *</label>
        <input
          style={inputStyle}
          type="password"
          placeholder="0x..."
          value={signerKey}
          onChange={(e) => setSignerKey(e.target.value)}
        />
        <span style={{ fontSize: 10, color: "#64748b", marginTop: 2, display: "block" }}>
          Must be a Safe owner. Key is sent to treasury-service for signing.
        </span>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isLoading || !recipient || !amount || !signerKey}
        style={{
          padding: "10px 16px",
          border: "none",
          borderRadius: 6,
          background: isLoading ? "#334155" : "#12ff80",
          color: isLoading ? "#94a3b8" : "#0f172a",
          fontWeight: 700,
          fontSize: 13,
          cursor: isLoading ? "not-allowed" : "pointer",
          transition: "all 0.15s",
        }}
      >
        {isLoading ? "Proposing..." : "Propose Transaction"}
      </button>

      {/* Result / Error */}
      {result && (
        <div style={{ padding: 8, borderRadius: 6, background: "#064e3b", color: "#34d399", fontSize: 11 }}>
          {result}
        </div>
      )}
      {error && (
        <div style={{ padding: 8, borderRadius: 6, background: "#450a0a", color: "#fca5a5", fontSize: 11 }}>
          {error}
        </div>
      )}
    </div>
  )
}
