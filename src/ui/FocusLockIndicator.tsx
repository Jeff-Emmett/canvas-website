import { useEffect, useState } from "react"
import { useEditor } from "tldraw"
import {
  onFocusLockChange,
  unlockCameraFocus,
  getFocusLockedShapeId,
} from "./cameraUtils"
import type { TLShapeId } from "tldraw"

export function FocusLockIndicator() {
  const editor = useEditor()
  const [isLocked, setIsLocked] = useState(false)
  const [shapeName, setShapeName] = useState<string>("")

  useEffect(() => {
    const unsubscribe = onFocusLockChange((locked, shapeId) => {
      setIsLocked(locked)

      if (locked && shapeId) {
        // Try to get a name for the shape
        const shape = editor.getShape(shapeId)
        if (shape) {
          // Check for common name properties
          const name =
            (shape.props as any)?.name ||
            (shape.props as any)?.title ||
            (shape.meta as any)?.name ||
            shape.type
          setShapeName(name)
        }
      } else {
        setShapeName("")
      }
    })

    return () => {
      unsubscribe()
    }
  }, [editor])

  if (!isLocked) return null

  return (
    <div
      className="focus-lock-indicator"
      style={{
        position: "fixed",
        top: "60px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 16px",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        color: "white",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "14px",
        backdropFilter: "blur(8px)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>
          Focused on:{" "}
          <strong style={{ color: "#60a5fa" }}>{shapeName || "Shape"}</strong>
        </span>
      </span>

      <button
        onClick={() => unlockCameraFocus(editor)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 500,
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "#2563eb")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "#3b82f6")
        }
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
        Unlock View
      </button>

      <span
        style={{
          color: "#9ca3af",
          fontSize: "12px",
          marginLeft: "4px",
        }}
      >
        (Press Esc)
      </span>
    </div>
  )
}
