import { inject } from "@vercel/analytics"
import "tldraw/tldraw.css"
import "@/css/style.css"
import { Default } from "@/routes/Default"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Contact } from "@/routes/Contact"
import { Board } from "./routes/Board"
import { Inbox } from "./routes/Inbox"
import { ChatBoxShape } from "./shapes/ChatBoxShapeUtil"
import { VideoChatShape } from "./shapes/VideoChatShapeUtil"
import { ChatBoxTool } from "./tools/ChatBoxTool"
import { VideoChatTool } from "./tools/VideoChatTool"
import { EmbedTool } from "./tools/EmbedTool"
import { EmbedShape } from "./shapes/EmbedShapeUtil"
import { MycrozineTemplateTool } from './tools/MycrozineTemplateTool'
import { MycrozineTemplateShape } from './shapes/MycrozineTemplateShapeUtil'
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
  MycrozineTemplateShape,
  MarkdownShape,
]
const customTools = [
  ChatBoxTool, 
  VideoChatTool, 
  EmbedTool, 
  // MycrozineTemplateTool, 
  // MarkdownTool
]

const callObject = Daily.createCallObject()

function App() {
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

