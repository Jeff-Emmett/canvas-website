import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
} from "tldraw"
import React, { useState, useCallback } from "react"
import HoloSphere from "holosphere"

// Initialize HoloSphere
const holosphere = new HoloSphere('holons')

type IHolon = TLBaseShape<
  "Holon",
  {
    w: number
    h: number
    holonId: string | null
    showAdvancedMenu?: boolean
    loadedContent?: {
      tasks?: any[] | { error: string }
      lists?: any[] | { error: string }
      users?: any[] | { error: string }
      events?: any[] | { error: string }
      proposals?: any[] | { error: string }
      offers?: any[] | { error: string }
      requests?: any[] | { error: string }
      balance?: any | { error: string }
      quests?: any[] | { error: string }
    }
  }
>

export class HolonShape extends BaseBoxShapeUtil<IHolon> {
  static override type = "Holon" as const

  getDefaultProps(): IHolon["props"] {
    return {
      w: 400,
      h: 300,
      holonId: null,
      showAdvancedMenu: false,
      loadedContent: {},
    }
  }

  component(shape: IHolon) {
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    
    const [inputHolonId, setInputHolonId] = useState(shape.props.holonId || "")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputHolonId.trim()) {
          setError("Please enter a Holon ID")
          return
        }

        // Basic validation - Holon IDs are typically numbers
        const isValidHolonId = /^-?\d+$/.test(inputHolonId.trim())
        if (!isValidHolonId) {
          setError("Invalid Holon ID format")
          return
        }

        this.editor.updateShape<IHolon>({
          id: shape.id,
          type: "Holon",
          props: { ...shape.props, holonId: inputHolonId.trim() },
        })
        setError("")
      },
      [inputHolonId],
    )

    const toggleAdvancedMenu = useCallback(() => {
      // Debounce to prevent rapid sync updates
      const timeoutId = setTimeout(() => {
        try {
          this.editor.updateShape<IHolon>({
            id: shape.id,
            type: "Holon",
            props: { 
              ...shape.props, 
              showAdvancedMenu: !shape.props.showAdvancedMenu 
            },
          })
        } catch (syncError) {
          console.error(`❌ Toggle menu failed (sync error):`, syncError)
        }
      }, 100) // 100ms debounce
      
      return () => clearTimeout(timeoutId)
    }, [shape.props.showAdvancedMenu])

    const loadContent = useCallback(async (contentType: string) => {
      if (!shape.props.holonId) return
      
      console.log(`🔄 Starting to load ${contentType} for Holon ${shape.props.holonId}`)
      setIsLoading(true)
      
      try {
        console.log(`📡 Calling holosphere.getAll('${shape.props.holonId}','${contentType}')`)
        
        // Wrap HoloSphere API call in a timeout to prevent blocking sync
        const data = await Promise.race([
          holosphere.getAll(`'${shape.props.holonId}'`,`'${contentType}'`),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('HoloSphere API timeout')), 10000)
          )
        ])

        console.log(`🔍 Data(users):`, await holosphere.getAll('-1002848305066','status'))
        console.log(`🔍 Data(tasks):`, await holosphere.getAll('-1002848305066','tasks'))
        
        console.log(`✅ Received data for ${contentType}:`, data)
        console.log(`📊 Data type: ${typeof data}, isArray: ${Array.isArray(data)}`)
        console.log(`📏 Data length: ${Array.isArray(data) ? data.length : 'N/A'}`)
        
        // Test with different Holon ID to see if it's a data issue
        console.log(`🧪 Testing with different Holon ID:`, await holosphere.getAll('-1002848305066', 'status'))
        
        // Test with different content type to see if it's a content type issue
        console.log(`🧪 Testing with different content type:`, await holosphere.getAll(shape.props.holonId, 'tasks'))
        
        // Log the HoloSphere instance to see its configuration
        console.log(`🔧 HoloSphere instance:`, holosphere)
        console.log(`🔧 HoloSphere methods:`, Object.getOwnPropertyNames(Object.getPrototypeOf(holosphere)))
        
        // Wrap shape update in try-catch to prevent sync interference
        try {
          this.editor.updateShape<IHolon>({
            id: shape.id,
            type: "Holon",
            props: {
              ...shape.props,
              loadedContent: {
                ...shape.props.loadedContent,
                [contentType]: data
              }
            },
          })
          console.log(`💾 Updated shape with ${contentType} data`)
        } catch (syncError) {
          console.error(`❌ Shape update failed (sync error):`, syncError)
          // Don't re-throw sync errors to prevent blocking
        }
        
      } catch (error) {
        console.error(`❌ Failed to load ${contentType} from Holon ${shape.props.holonId}:`, error)
        console.error(`🔍 Error details:`, {
          message: (error as Error).message,
          stack: (error as Error).stack,
          name: (error as Error).name
        })
        
        // Wrap error state update in try-catch
        try {
          this.editor.updateShape<IHolon>({
            id: shape.id,
            type: "Holon",
            props: {
              ...shape.props,
              loadedContent: {
                ...shape.props.loadedContent,
                [contentType]: { error: `Failed to load ${contentType}: ${(error as Error).message}` }
              }
            },
          })
        } catch (syncError) {
          console.error(`❌ Error state update failed (sync error):`, syncError)
        }
      } finally {
        console.log(`🏁 Finished loading ${contentType}`)
        setIsLoading(false)
      }
    }, [shape.props.holonId, shape.props.loadedContent])

    const contentStyle = {
      pointerEvents: isSelected ? "none" as const : "all" as const,
      width: "100%",
      height: "100%",
      border: "1px solid #D3D3D3",
      backgroundColor: "#FFFFFF",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    }

    const wrapperStyle = {
      position: 'relative' as const,
      width: `${shape.props.w}px`,
      height: `${shape.props.h}px`,
      backgroundColor: "#F0F0F0",
      borderRadius: "4px",
      overflow: "hidden",
    }

    const buttonStyle = {
      border: "none",
      background: "#007bff",
      color: "white",
      padding: "6px 12px",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "11px",
      margin: "2px",
      pointerEvents: "all" as const,
      whiteSpace: "nowrap" as const,
      transition: "background-color 0.2s",
    }

    const secondaryButtonStyle = {
      ...buttonStyle,
      background: "#6c757d",
      fontSize: "10px",
      padding: "4px 8px",
    }

    const toggleButtonStyle = {
      ...buttonStyle,
      background: "#28a745",
      fontSize: "10px",
      padding: "4px 8px",
    }

    // For empty state (no holonId set)
    if (!shape.props.holonId) {
      return (
        <HTMLContainer>
          <div style={wrapperStyle}>
            <div 
              style={{
                ...contentStyle,
                cursor: 'text',
                touchAction: 'none',
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const input = e.currentTarget.querySelector('input')
                input?.focus()
              }}
            >
              <form
                onSubmit={handleSubmit}
                style={{ 
                  width: "100%", 
                  height: "100%", 
                  padding: "10px",
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ textAlign: "center", marginBottom: "10px" }}>
                  <h3 style={{ margin: "0 0 8px 0", color: "#495057", fontSize: "16px" }}>
                    🌟 Holon Task Manager
                  </h3>
                  <p style={{ margin: "0", color: "#6c757d", fontSize: "12px" }}>
                    Enter a Holon ID to get started
                  </p>
                </div>
                <input
                  type="text"
                  value={inputHolonId}
                  onChange={(e) => setInputHolonId(e.target.value)}
                  placeholder="Enter Holon ID (e.g., -4962820663)"
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "16px",
                    touchAction: 'none',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSubmit(e)
                    }
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.currentTarget.focus()
                  }}
                  onPointerUp={(e) => e.stopPropagation()}
                />
                {error && (
                  <div style={{ color: "red", marginTop: "10px", fontSize: "12px" }}>{error}</div>
                )}
              </form>
            </div>
          </div>
        </HTMLContainer>
      )
    }

    // For loaded state (holonId is set)
    return (
      <HTMLContainer>
        <div style={wrapperStyle}>
          <div
            style={{
              ...contentStyle,
              flexDirection: "column",
              padding: "12px",
              alignItems: "stretch",
              overflow: "auto",
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: "12px", textAlign: "center" }}>
              <h3 style={{ margin: "0 0 4px 0", color: "#495057", fontSize: "14px" }}>
                🌟 Holon Task Manager
              </h3>
              <p style={{ margin: "0", color: "#6c757d", fontSize: "10px" }}>
                ID: {shape.props.holonId}
              </p>
            </div>

            {/* Basic Menu */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "4px", color: "#495057" }}>
                Quick Actions:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
                <button
                  onClick={() => loadContent("tasks")}
                  disabled={isLoading}
                  style={buttonStyle}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                >
                  📋 Tasks
                </button>
                <button
                  onClick={() => loadContent("lists")}
                  disabled={isLoading}
                  style={buttonStyle}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                >
                  📝 Lists
                </button>
                <button
                  onClick={() => loadContent("status")}
                  disabled={isLoading}
                  style={buttonStyle}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                >
                  👥 Users
                </button>
                <button
                  onClick={() => loadContent("events")}
                  disabled={isLoading}
                  style={buttonStyle}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                >
                  📅 Events
                </button>
              </div>
            </div>

            {/* Advanced Menu Toggle */}
            <div style={{ marginBottom: "8px" }}>
              <button
                onClick={toggleAdvancedMenu}
                style={toggleButtonStyle}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
              >
                {shape.props.showAdvancedMenu ? "🔽 Hide Advanced" : "🔼 Show Advanced"}
              </button>
            </div>

            {/* Advanced Menu */}
            {shape.props.showAdvancedMenu && (
              <div style={{ marginBottom: "8px" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "4px", color: "#495057" }}>
                  Advanced Features:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
                  <button
                    onClick={() => loadContent("proposals")}
                    disabled={isLoading}
                    style={secondaryButtonStyle}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                  >
                    📋 Proposals
                  </button>
                  <button
                    onClick={() => loadContent("offers")}
                    disabled={isLoading}
                    style={secondaryButtonStyle}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                  >
                    🎁 Offers
                  </button>
                  <button
                    onClick={() => loadContent("requests")}
                    disabled={isLoading}
                    style={secondaryButtonStyle}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                  >
                    🙏 Requests
                  </button>
                  <button
                    onClick={() => loadContent("balance")}
                    disabled={isLoading}
                    style={secondaryButtonStyle}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                  >
                    💰 Balance
                  </button>
                  <button
                    onClick={() => loadContent("quests")}
                    disabled={isLoading}
                    style={secondaryButtonStyle}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                  >
                    🎯 Quests
                  </button>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div style={{ textAlign: "center", padding: "8px", color: "#6c757d", fontSize: "10px" }}>
                Loading...
              </div>
            )}

            {/* Content Display */}
            <div style={{ flex: 1, overflow: "auto", fontSize: "10px" }}>
              {shape.props.loadedContent && Object.keys(shape.props.loadedContent).length > 0 && (
                <div>
                  {shape.props.loadedContent.tasks && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#495057" }}>📋 Tasks:</div>
                      {'error' in shape.props.loadedContent.tasks ? (
                        <div style={{ color: "#dc3545", fontSize: "9px", padding: "2px 4px" }}>
                          ❌ {shape.props.loadedContent.tasks.error}
                        </div>
                      ) : Array.isArray(shape.props.loadedContent.tasks) ? (
                        shape.props.loadedContent.tasks.map((task: any) => (
                          <div key={task.id || task._id} style={{ 
                            padding: "2px 4px", 
                            backgroundColor: task.completed ? "#d4edda" : "#f8f9fa",
                            marginBottom: "2px",
                            borderRadius: "2px",
                            fontSize: "9px"
                          }}>
                            {task.completed ? "✅" : "⭕"} {task.text || task.title} {task.assigned && `(${task.assigned})`}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "#6c757d", fontSize: "9px", padding: "2px 4px" }}>
                          No tasks found
                        </div>
                      )}
                    </div>
                  )}

                  {shape.props.loadedContent.lists && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#495057" }}>📝 Lists:</div>
                      {'error' in shape.props.loadedContent.lists ? (
                        <div style={{ color: "#dc3545", fontSize: "9px", padding: "2px 4px" }}>
                          ❌ {shape.props.loadedContent.lists.error}
                        </div>
                      ) : Array.isArray(shape.props.loadedContent.lists) ? (
                        shape.props.loadedContent.lists.map((list: any) => (
                          <div key={list.id || list._id} style={{ 
                            padding: "2px 4px", 
                            backgroundColor: "#f8f9fa",
                            marginBottom: "2px",
                            borderRadius: "2px",
                            fontSize: "9px"
                          }}>
                            📋 {list.name || list.title}: {list.items ? list.items.join(", ") : "No items"}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "#6c757d", fontSize: "9px", padding: "2px 4px" }}>
                          No lists found
                        </div>
                      )}
                    </div>
                  )}

                  {shape.props.loadedContent.users && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#495057" }}>👥 Users:</div>
                      {'error' in shape.props.loadedContent.users ? (
                        <div style={{ color: "#dc3545", fontSize: "9px", padding: "2px 4px" }}>
                          ❌ {shape.props.loadedContent.users.error}
                        </div>
                      ) : Array.isArray(shape.props.loadedContent.users) ? (
                        shape.props.loadedContent.users.map((user: any) => (
                          <div key={user.id || user._id} style={{ 
                            padding: "2px 4px", 
                            backgroundColor: "#f8f9fa",
                            marginBottom: "2px",
                            borderRadius: "2px",
                            fontSize: "9px"
                          }}>
                            👤 {user.name || user.username} ({user.role || "Member"}) - {user.status || "Active"}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "#6c757d", fontSize: "9px", padding: "2px 4px" }}>
                          No users found
                        </div>
                      )}
                    </div>
                  )}

                  {shape.props.loadedContent.events && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#495057" }}>📅 Events:</div>
                      {'error' in shape.props.loadedContent.events ? (
                        <div style={{ color: "#dc3545", fontSize: "9px", padding: "2px 4px" }}>
                          ❌ {shape.props.loadedContent.events.error}
                        </div>
                      ) : Array.isArray(shape.props.loadedContent.events) ? (
                        shape.props.loadedContent.events.map((event: any) => (
                          <div key={event.id || event._id} style={{ 
                            padding: "2px 4px", 
                            backgroundColor: "#f8f9fa",
                            marginBottom: "2px",
                            borderRadius: "2px",
                            fontSize: "9px"
                          }}>
                            📅 {event.title || event.name} - {event.date || event.startDate} {event.time && event.time}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "#6c757d", fontSize: "9px", padding: "2px 4px" }}>
                          No events found
                        </div>
                      )}
                    </div>
                  )}

                  {shape.props.loadedContent.proposals && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#495057" }}>📋 Proposals:</div>
                      {'error' in shape.props.loadedContent.proposals ? (
                        <div style={{ color: "#dc3545", fontSize: "9px", padding: "2px 4px" }}>
                          ❌ {shape.props.loadedContent.proposals.error}
                        </div>
                      ) : Array.isArray(shape.props.loadedContent.proposals) ? (
                        shape.props.loadedContent.proposals.map((proposal: any) => (
                          <div key={proposal.id || proposal._id} style={{ 
                            padding: "2px 4px", 
                            backgroundColor: "#f8f9fa",
                            marginBottom: "2px",
                            borderRadius: "2px",
                            fontSize: "9px"
                          }}>
                            📋 {proposal.title || proposal.name} - {proposal.status || "Active"} {proposal.votes && `(${proposal.votes} votes)`}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "#6c757d", fontSize: "9px", padding: "2px 4px" }}>
                          No proposals found
                        </div>
                      )}
                    </div>
                  )}

                  {shape.props.loadedContent.offers && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#495057" }}>🎁 Offers:</div>
                      {'error' in shape.props.loadedContent.offers ? (
                        <div style={{ color: "#dc3545", fontSize: "9px", padding: "2px 4px" }}>
                          ❌ {shape.props.loadedContent.offers.error}
                        </div>
                      ) : Array.isArray(shape.props.loadedContent.offers) ? (
                        shape.props.loadedContent.offers.map((offer: any) => (
                          <div key={offer.id || offer._id} style={{ 
                            padding: "2px 4px", 
                            backgroundColor: "#f8f9fa",
                            marginBottom: "2px",
                            borderRadius: "2px",
                            fontSize: "9px"
                          }}>
                            🎁 {offer.title || offer.name} by {offer.offered_by || offer.user}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "#6c757d", fontSize: "9px", padding: "2px 4px" }}>
                          No offers found
                        </div>
                      )}
                    </div>
                  )}

                  {shape.props.loadedContent.requests && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#495057" }}>🙏 Requests:</div>
                      {'error' in shape.props.loadedContent.requests ? (
                        <div style={{ color: "#dc3545", fontSize: "9px", padding: "2px 4px" }}>
                          ❌ {shape.props.loadedContent.requests.error}
                        </div>
                      ) : Array.isArray(shape.props.loadedContent.requests) ? (
                        shape.props.loadedContent.requests.map((request: any) => (
                          <div key={request.id || request._id} style={{ 
                            padding: "2px 4px", 
                            backgroundColor: "#f8f9fa",
                            marginBottom: "2px",
                            borderRadius: "2px",
                            fontSize: "9px"
                          }}>
                            🙏 {request.title || request.name} by {request.requested_by || request.user}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "#6c757d", fontSize: "9px", padding: "2px 4px" }}>
                          No requests found
                        </div>
                      )}
                    </div>
                  )}

                  {shape.props.loadedContent.balance && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#495057" }}>💰 Balance:</div>
                      {'error' in shape.props.loadedContent.balance ? (
                        <div style={{ color: "#dc3545", fontSize: "9px", padding: "2px 4px" }}>
                          ❌ {shape.props.loadedContent.balance.error}
                        </div>
                      ) : (
                        <div style={{ 
                          padding: "2px 4px", 
                          backgroundColor: "#f8f9fa",
                          borderRadius: "2px",
                          fontSize: "9px"
                        }}>
                          💰 {shape.props.loadedContent.balance.total || shape.props.loadedContent.balance.amount} {shape.props.loadedContent.balance.currency || "EUR"} {shape.props.loadedContent.balance.transactions && `(${shape.props.loadedContent.balance.transactions} transactions)`}
                        </div>
                      )}
                    </div>
                  )}

                  {shape.props.loadedContent.quests && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#495057" }}>🎯 Quests:</div>
                      {'error' in shape.props.loadedContent.quests ? (
                        <div style={{ color: "#dc3545", fontSize: "9px", padding: "2px 4px" }}>
                          ❌ {shape.props.loadedContent.quests.error}
                        </div>
                      ) : Array.isArray(shape.props.loadedContent.quests) ? (
                        shape.props.loadedContent.quests.map((quest: any) => (
                          <div key={quest.id || quest._id} style={{ 
                            padding: "2px 4px", 
                            backgroundColor: "#f8f9fa",
                            marginBottom: "2px",
                            borderRadius: "2px",
                            fontSize: "9px"
                          }}>
                            🎯 {quest.title || quest.name} - {quest.description} - {quest.status || "Active"}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "#6c757d", fontSize: "9px", padding: "2px 4px" }}>
                          No quests found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* External Link */}
            <div style={{ textAlign: "center", marginTop: "8px" }}>
              <a
                href={`https://dashboard.holons.io/${shape.props.holonId}/`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#1976d2",
                  textDecoration: "none",
                  cursor: "pointer",
                  fontSize: "10px",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
              >
                Open in Holons.io →
              </a>
            </div>
          </div>
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: IHolon) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        fill="none"
        stroke="dashed"
        strokeWidth={2}
        strokeDasharray={8}
        strokeDashoffset={4}
      />
    )
  }

  // Handle sync for Holon shape updates
  onBeforeUpdate = (_prev: IHolon, next: IHolon) => {
    return next
  }

  // Handle creation with proper sync
  onBeforeCreate = (shape: IHolon) => {
    return shape
  }

  // Handle pointer down for input focus
  onPointerDown = (shape: IHolon) => {
    if (!shape.props.holonId) {
      const input = document.querySelector('input[placeholder*="Holon ID"]') as HTMLInputElement
      input?.focus()
    }
  }

  // Handle double click for interaction
  override onDoubleClick = (shape: IHolon) => {
    // If no holonId is set, focus the input field
    if (!shape.props.holonId) {
      const input = document.querySelector('input[placeholder*="Holon ID"]') as HTMLInputElement
      input?.focus()
      return
    }

    // For existing holons, open in new tab
    window.open(`https://dashboard.holons.io/${shape.props.holonId}/`, '_blank', 'noopener,noreferrer')
  }
} 