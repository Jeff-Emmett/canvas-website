import { useSafeInfo, useSafeBalances } from "../../hooks/useSafeTransaction"
import { formatAddress } from "../../hooks/useWallet"

export function SafeHeader() {
  const { data: info, isLoading: infoLoading } = useSafeInfo()
  const { data: balances, isLoading: balLoading } = useSafeBalances()

  if (infoLoading) {
    return (
      <div style={{ padding: 12, textAlign: "center", color: "#64748b", fontSize: 12 }}>
        Loading Safe info...
      </div>
    )
  }

  if (!info) {
    return (
      <div style={{ padding: 12, textAlign: "center", color: "#f87171", fontSize: 12 }}>
        Treasury not configured
      </div>
    )
  }

  // Sum native balance from balances data
  const nativeBalance = balances?.balances?.find((b) => !b.tokenAddress)
  const nativeFormatted = nativeBalance
    ? (Number(nativeBalance.balance) / 1e18).toFixed(4)
    : "..."

  return (
    <div
      style={{
        padding: "10px 12px",
        borderBottom: "1px solid #1e293b",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Address + Chain */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "monospace",
              color: "#12ff80",
            }}
          >
            {formatAddress(info.address, 6)}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(info.address)}
            style={{
              border: "none",
              background: "transparent",
              color: "#64748b",
              cursor: "pointer",
              fontSize: 11,
              padding: "2px 4px",
            }}
            title="Copy address"
          >
            copy
          </button>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 4,
            background: "#1e293b",
            color: "#94a3b8",
          }}
        >
          Chain {info.chainId}
        </span>
      </div>

      {/* Owners + Threshold + Balance */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
        <span>
          {info.threshold}/{info.owners.length} owners
        </span>
        <span>v{info.version}</span>
        <span>{nativeFormatted} ETH</span>
      </div>
    </div>
  )
}
