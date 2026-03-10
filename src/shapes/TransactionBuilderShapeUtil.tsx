import { useState } from "react"
import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer } from "tldraw"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"
import { useMaximize } from "../hooks/useMaximize"
import { SafeHeader } from "../components/safe/SafeHeader"
import { TransactionComposer } from "../components/safe/TransactionComposer"
import { PendingTransactions } from "../components/safe/PendingTransactions"
import { TransactionHistory } from "../components/safe/TransactionHistory"

export type ITransactionBuilderShape = TLBaseShape<
  "TransactionBuilder",
  {
    w: number
    h: number
    mode: "compose" | "pending" | "history"
    pinnedToView: boolean
    tags: string[]
  }
>

export class TransactionBuilderShape extends BaseBoxShapeUtil<ITransactionBuilderShape> {
  static override type = "TransactionBuilder"

  getDefaultProps(): ITransactionBuilderShape["props"] {
    return {
      w: 480,
      h: 620,
      mode: "pending",
      pinnedToView: false,
      tags: ["safe", "treasury"],
    }
  }

  // Safe green theme
  static readonly PRIMARY_COLOR = "#12ff80"

  indicator(shape: ITransactionBuilderShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }

  component(shape: ITransactionBuilderShape) {
    const [isMinimized, setIsMinimized] = useState(false)
    const [activeTab, setActiveTab] = useState<"compose" | "pending" | "history">(shape.props.mode)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    const { isMaximized, toggleMaximize } = useMaximize({
      editor: this.editor,
      shapeId: shape.id,
      currentW: shape.props.w,
      currentH: shape.props.h,
      shapeType: "TransactionBuilder",
    })

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<ITransactionBuilderShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    const tabs = [
      { key: "compose" as const, label: "Compose" },
      { key: "pending" as const, label: "Pending" },
      { key: "history" as const, label: "History" },
    ]

    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
        <StandardizedToolWrapper
          title="Safe Treasury"
          primaryColor={TransactionBuilderShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          onMaximize={toggleMaximize}
          isMaximized={isMaximized}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          editor={this.editor}
          shapeId={shape.id}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              fontSize: 13,
              color: "#e2e8f0",
              background: "#0f172a",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Safe Info Header */}
            <SafeHeader />

            {/* Tab Navigation */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #1e293b",
                padding: "0 8px",
                gap: 2,
              }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "8px 16px",
                    border: "none",
                    background: activeTab === tab.key ? "#1e293b" : "transparent",
                    color: activeTab === tab.key ? "#12ff80" : "#94a3b8",
                    borderBottom: activeTab === tab.key ? "2px solid #12ff80" : "2px solid transparent",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: "4px 4px 0 0",
                    transition: "all 0.15s",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
              {activeTab === "compose" && <TransactionComposer />}
              {activeTab === "pending" && <PendingTransactions />}
              {activeTab === "history" && <TransactionHistory />}
            </div>
          </div>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }
}
