import {
  createShapeId,
  Editor,
  Tldraw,
  TLGeoShape,
  TLShapePartial,
} from "tldraw"
import { useEffect, useRef } from "react"

export function Inbox() {
  const editorRef = useRef<Editor | null>(null)

  const updateEmails = async (editor: Editor) => {
    try {
      const response = await fetch("https://jeffemmett-canvas.web.val.run", {
        method: "GET",
      })
      const messages = (await response.json()) as {
        id: string
        from: string
        subject: string
        text: string
      }[]

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i]
        const messageId = message.id
        const parsedEmailName =
          message.from.match(/^([^<]+)/)?.[1]?.trim() ||
          message.from.match(/[^<@]+(?=@)/)?.[0] ||
          message.from
        const messageText = `from: ${parsedEmailName}\nsubject: ${message.subject}\n\n${message.text}`
        const shapeWidth = 500
        const shapeHeight = 300
        const spacing = 50
        const shape: TLShapePartial<TLGeoShape> = {
          id: createShapeId(),
          type: "geo",
          x: shapeWidth * (i % 5) + spacing * (i % 5),
          y: shapeHeight * Math.floor(i / 5) + spacing * Math.floor(i / 5),
          props: {
            w: shapeWidth,
            h: shapeHeight,
            text: messageText,
            align: "start",
            verticalAlign: "start",
          },
          meta: {
            id: messageId,
          },
        }
        let found = false
        for (const s of editor.getCurrentPageShapes()) {
          if (s.meta.id === messageId) {
            found = true
            break
          }
        }
        if (!found) {
          editor.createShape(shape)
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    }
  }

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (editorRef.current) {
        updateEmails(editorRef.current)
      }
    }, 5 * 1000)

    return () => clearInterval(intervalId)
  }, [])

  return (
    <div className="tldraw__editor">
      <Tldraw
        onMount={(editor: Editor) => {
          editorRef.current = editor
          updateEmails(editor)
        }}
      />
    </div>
  )
}
