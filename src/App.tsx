import { inject } from "@vercel/analytics"
import "tldraw/tldraw.css"
import "@/css/style.css"
import { Default } from "@/routes/Default"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Contact } from "@/routes/Contact"
import { Board } from "./routes/Board"
import { Inbox } from "./routes/Inbox"
import { createRoot } from "react-dom/client"
import { DailyProvider } from "@daily-co/daily-react"
import Daily from "@daily-co/daily-js"

inject()

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

