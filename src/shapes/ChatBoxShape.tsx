import { useEffect, useRef, useState } from "react";
import { BaseBoxShapeUtil, TLBaseBoxShape, TLBaseShape, TldrawBaseProps } from "tldraw";

export type IChatBoxShape = TLBaseShape<
	'chatBox',
	{
		w: number
		h: number
        roomId: string
	}
>

export class ChatBoxShape extends BaseBoxShapeUtil<IChatBoxShape> {
    static override type = 'chatBox'

    getDefaultProps(): IChatBoxShape['props'] {
        return {
            roomId: 'default-room',
            w: 100,
            h: 100,
        }
    }

    indicator(shape: IChatBoxShape) {
        return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
    }

    component(shape: IChatBoxShape) {
        return (
            <ChatBox roomId={shape.props.roomId} width={shape.props.w} height={shape.props.h} />
        )
    }
}

interface Message {
    id: string;
    username: string;
    content: string;
    timestamp: Date;
}

// Add this new component after the ChatBoxShape class
function ChatBox({ width, height }: { roomId: string, width: number, height: number }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [username, setUsername] = useState("jeff");
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const storedUsername = localStorage.getItem("chatUsername");
        if (storedUsername) {
            setUsername(storedUsername);
        } else {
            const newUsername = `User${Math.floor(Math.random() * 1000)}`;
            setUsername(newUsername);
            localStorage.setItem("chatUsername", newUsername);
        }
        
        fetchMessages();
        const interval = setInterval(fetchMessages, 2000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (messagesEndRef.current) {
            (messagesEndRef.current as HTMLElement).scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const fetchMessages = async () => {
        try {
            const response = await fetch("https://jeffemmett-realtimechatappwithpolling.web.val.run?action=getMessages");
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const newMessages = await response.json() as Message[];
            setMessages(newMessages.map(msg => ({ ...msg, timestamp: new Date(msg.timestamp) })));
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const sendMessage = async (e: any) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;
        await sendMessageToChat(username, inputMessage);
        setInputMessage("");
        fetchMessages();
    };

    return (
        <div className="chat-container" style={{ pointerEvents: 'all', width: `${width}px`, height: `${height}px`, overflow: 'auto' }}>
            <div className="messages-container">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.username === username ? 'own-message' : ''}`}>
                        <div className="message-header">
                            <strong>{msg.username}</strong> 
                            <span className="timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>
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
                />
                <button type="submit" style={{ pointerEvents: 'all',}} onPointerDown={(e)=>e.stopPropagation()} className="send-button">Send</button>
            </form>
        </div>
    );
}

async function sendMessageToChat(username: string, content: string): Promise<void> {
    const apiUrl = 'https://jeffemmett-realtimechatappwithpolling.web.val.run'; // Replace with your actual Val Town URL
  
    try {
      const response = await fetch(`${apiUrl}?action=sendMessage`, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          content,
        }),
      });
  
      const result = await response.text();
      console.log('Message sent successfully:', result);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }