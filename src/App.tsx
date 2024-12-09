import { inject } from "@vercel/analytics"
import "tldraw/tldraw.css"
import "@/css/style.css"
import { Default } from "@/routes/Default"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Contact } from "@/routes/Contact"
import { Board } from "./routes/Board"
import { Inbox } from "./routes/Inbox"
import { Editor, Tldraw, TLShapeId } from "tldraw"
import { components } from "./ui/components"
import { overrides } from "./ui/overrides"
import { ChatBoxShape } from "./shapes/ChatBoxShapeUtil"
import { VideoChatShape } from "./shapes/VideoChatShapeUtil"
import { ChatBoxTool } from "./tools/ChatBoxTool"
import { VideoChatTool } from "./tools/VideoChatTool"
import { EmbedTool } from "./tools/EmbedTool"
import { EmbedShape } from "./shapes/EmbedShapeUtil"
import { MarkdownShape } from "./shapes/MarkdownShapeUtil"
import { MarkdownTool } from "./tools/MarkdownTool"
import { createRoot } from "react-dom/client"
import { handleInitialPageLoad } from "./utils/handleInitialPageLoad"
import { DailyProvider } from "@daily-co/daily-react"
import Daily from "@daily-co/daily-js"

inject()

const customShapeUtils = [
  ChatBoxShape,
  VideoChatShape,
  EmbedShape,
  MarkdownShape,
]
const customTools = [ChatBoxTool, VideoChatTool, EmbedTool, MarkdownTool]

const callObject = Daily.createCallObject()

export default function InteractiveShapeExample() {
  return (
    <div className="tldraw__editor">
      <Tldraw
        shapeUtils={customShapeUtils}
        tools={customTools}
        overrides={overrides}
        components={components}
        onMount={(editor) => {
          handleInitialPageLoad(editor)
          editor.createShape({ type: "my-interactive-shape", x: 100, y: 100 })
        }}
      />
    </div>
  )
}

//createRoot(document.getElementById("root")!).render(<App />)

function App() {
  if (process.env.NODE_ENV === "production") {
    // Comment out console.log override temporarily for debugging
    // console.log = () => {}
    // console.debug = () => {}
    // console.info = () => {}
    // Keep error and warn for debugging
    // console.error = () => {};
    // console.warn = () => {};
  }

  // Add a debug message to verify console logging is working
  console.log("App initialized, NODE_ENV:", process.env.NODE_ENV)

  return (
    <DailyProvider callObject={callObject}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Default />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/board/:slug" element={<Board />} />
          <Route path="/inbox" element={<Inbox />} />
        </Routes>
      </BrowserRouter>
    </DailyProvider>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
