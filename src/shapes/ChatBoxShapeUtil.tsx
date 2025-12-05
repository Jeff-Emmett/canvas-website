import { useEffect, useRef, useState } from "react"
import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer } from "tldraw"
import { StandardizedToolWrapper } from "../components/StandardizedToolWrapper"
import { usePinnedToView } from "../hooks/usePinnedToView"

export type IChatBoxShape = TLBaseShape<
  "ChatBox",
  {
    w: number
    h: number
    roomId: string
    userName: string
    pinnedToView: boolean
    tags: string[]
  }
>

export class ChatBoxShape extends BaseBoxShapeUtil<IChatBoxShape> {
  static override type = "ChatBox"

  getDefaultProps(): IChatBoxShape["props"] {
    return {
      roomId: "default-room",
      w: 400,
      h: 500,
      userName: "",
      pinnedToView: false,
      tags: ['chat'],
    }
  }

  // ChatBox theme color: Orange (Rainbow)
  static readonly PRIMARY_COLOR = "#f97316"

  indicator(shape: IChatBoxShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }

  component(shape: IChatBoxShape) {
    const [isMinimized, setIsMinimized] = useState(false)
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    // Use the pinning hook to keep the shape fixed to viewport when pinned
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IChatBoxShape>({
        id: shape.id,
        type: shape.type,
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
        <StandardizedToolWrapper
          title="Chat"
          primaryColor={ChatBoxShape.PRIMARY_COLOR}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<IChatBoxShape>({
              id: shape.id,
              type: 'ChatBox',
              props: {
                ...shape.props,
                tags: newTags,
              }
            })
          }}
          tagsEditable={true}
        >
          <ChatBox
            roomId={shape.props.roomId}
            w={shape.props.w}
            h={shape.props.h - 40} // Subtract header height
            userName=""
            pinnedToView={shape.props.pinnedToView}
            tags={shape.props.tags}
          />
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }
}

interface Message {
  id: string
  username: string
  content: string
  timestamp: Date
}

// Update the ChatBox component to accept userName
export const ChatBox: React.FC<IChatBoxShape["props"]> = ({
  roomId,
  w: _w,
  h: _h,
  userName,
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [username, setUsername] = useState(userName)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const storedUsername = localStorage.getItem("chatUsername")
    if (storedUsername) {
      setUsername(storedUsername)
    } else {
      const newUsername = `User${Math.floor(Math.random() * 1000)}`
      setUsername(newUsername)
      localStorage.setItem("chatUsername", newUsername)
    }
    // DISABLED: Chat polling disabled until Telegram channels integration via Holons
    // fetchMessages(roomId)
    // const interval = setInterval(() => fetchMessages(roomId), 2000)

    // return () => clearInterval(interval)
  }, [roomId])

  useEffect(() => {
    if (messagesEndRef.current) {
      ;(messagesEndRef.current as HTMLElement).scrollIntoView({
        behavior: "smooth",
      })
    }
  }, [messages])

  const fetchMessages = async (roomId: string) => {
    try {
      const response = await fetch(
        `https://jeffemmett-realtimechatappwithpolling.web.val.run?action=getMessages&roomId=${roomId}`,
      )
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const newMessages = (await response.json()) as Message[]
      setMessages(
        newMessages.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      )
    } catch (error) {
      console.error("Error fetching messages:", error)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim()) return
    await sendMessageToChat(roomId, username, inputMessage)
    setInputMessage("")
    fetchMessages(roomId)
  }

  return (
    <div
      className="chat-container"
      style={{
        pointerEvents: "all",
        width: '100%',
        height: '100%',
        overflow: "hidden",
        touchAction: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="messages-container">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${
              msg.username === username ? "own-message" : ""
            }`}
          >
            <div className="message-header">
              <strong>{msg.username}</strong>
              <span className="timestamp">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="input-form">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type a message..."
          className="message-input"
          style={{ touchAction: "manipulation" }}
        />
        <button
          type="submit"
          style={{ pointerEvents: "all", touchAction: "manipulation" }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="send-button"
        >
          Send
        </button>
      </form>
    </div>
  )
}

async function sendMessageToChat(
  roomId: string,
  username: string,
  content: string,
): Promise<void> {
  const apiUrl = "https://jeffemmett-realtimechatappwithpolling.web.val.run" // Replace with your actual Val Town URL

  try {
    const response = await fetch(`${apiUrl}?action=sendMessage`, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId,
        username,
        content,
      }),
    })

    const result = await response.text()
    //console.log("Message sent successfully:", result)
  } catch (error) {
    console.error("Error sending message:", error)
  }
}
