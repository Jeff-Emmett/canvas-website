import { useState } from "react"
import { useTransactionHistory } from "../../hooks/useSafeTransaction"
import { formatAddress } from "../../hooks/useWallet"

export function TransactionHistory() {
  const [page, setPage] = useState(1)
  const { data: txs, total, isLoading, error } = useTransactionHistory(page, 10)

  if (isLoading) {
    return <div style={{ color: "#64748b", fontSize: 12, textAlign: "center" }}>Loading...</div>
  }

  if (error) {
    return <div style={{ color: "#fca5a5", fontSize: 12 }}>Error: {error}</div>
  }

  if (txs.length === 0) {
    return (
      <div style={{ color: "#64748b", fontSize: 12, textAlign: "center", padding: 20 }}>
        No executed transactions
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
        {total} total transaction{total !== 1 ? "s" : ""}
      </div>

      {txs.map((tx) => {
        const valueEth =
          tx.value !== "0"
            ? `${(Number(tx.value) / 1e18).toFixed(6)} ETH`
            : "Contract call"

        const date = tx.executionDate
          ? new Date(tx.executionDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"

        return (
          <div
            key={tx.safeTxHash}
            style={{
              border: "1px solid #1e293b",
              borderRadius: 6,
              padding: 8,
              background: "#1e293b",
              marginBottom: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                <span style={{ color: "#e2e8f0" }}>#{tx.nonce}</span>
                <span style={{ color: "#64748b", marginLeft: 8 }}>→ {formatAddress(tx.to)}</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{valueEth}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: tx.isSuccessful ? "#34d399" : "#f87171",
                }}
              >
                {tx.isSuccessful ? "Success" : "Failed"}
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{date}</div>
              {tx.transactionHash && (
                <a
                  href={`https://basescan.org/tx/${tx.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 10, color: "#818cf8", textDecoration: "none" }}
                >
                  {formatAddress(tx.transactionHash, 4)}
                </a>
              )}
            </div>
          </div>
        )
      })}

      {/* Pagination */}
      {total > 10 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 8 }}>
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            style={{
              padding: "4px 12px",
              border: "1px solid #334155",
              borderRadius: 4,
              background: "transparent",
              color: page === 1 ? "#334155" : "#94a3b8",
              cursor: page === 1 ? "not-allowed" : "pointer",
              fontSize: 11,
            }}
          >
            Prev
          </button>
          <span style={{ fontSize: 11, color: "#64748b", lineHeight: "28px" }}>
            {page}/{Math.ceil(total / 10)}
          </span>
          <button
            disabled={page * 10 >= total}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: "4px 12px",
              border: "1px solid #334155",
              borderRadius: 4,
              background: "transparent",
              color: page * 10 >= total ? "#334155" : "#94a3b8",
              cursor: page * 10 >= total ? "not-allowed" : "pointer",
              fontSize: 11,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
