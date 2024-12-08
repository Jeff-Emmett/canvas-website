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
import { createRoot } from "react-dom/client"

inject()

const customShapeUtils = [ChatBoxShape, VideoChatShape, EmbedShape]
const customTools = [ChatBoxTool, VideoChatTool, EmbedTool]

export default function InteractiveShapeExample() {
  return (
    <div className="tldraw__editor">
      <Tldraw
        shapeUtils={customShapeUtils}
        tools={customTools}
        overrides={overrides}
        components={components}
        onMount={(editor) => {
          handleInitialShapeLoad(editor)
          editor.createShape({ type: "my-interactive-shape", x: 100, y: 100 })
        }}
      />
    </div>
  )
}

const handleInitialShapeLoad = (editor: Editor) => {
  const url = new URL(window.location.href)
  const shapeId =
    url.searchParams.get("shapeId") || url.searchParams.get("frameId")
  const x = url.searchParams.get("x")
  const y = url.searchParams.get("y")
  const zoom = url.searchParams.get("zoom")

  if (shapeId) {
    console.log("Found shapeId in URL:", shapeId)
    const shape = editor.getShape(shapeId as TLShapeId)

    if (shape) {
      console.log("Found shape:", shape)
      if (x && y && zoom) {
        console.log("Setting camera to:", { x, y, zoom })
        editor.setCamera({
          x: parseFloat(x),
          y: parseFloat(y),
          z: parseFloat(zoom),
        })
      } else {
        console.log("Zooming to shape bounds")
        editor.zoomToBounds(editor.getShapeGeometry(shape).bounds, {
          targetZoom: 1,
        })
      }
    } else {
      console.warn("Shape not found in the editor")
    }
  } else {
    console.warn("No shapeId found in the URL")
  }
}

createRoot(document.getElementById("root")!).render(<App />)

function App() {
  return (
    // <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Default />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/board/:slug" element={<Board />} />
        <Route path="/inbox" element={<Inbox />} />
      </Routes>
    </BrowserRouter>
    // </React.StrictMode>
  )
}
