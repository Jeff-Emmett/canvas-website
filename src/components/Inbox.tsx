import { createShapeId, Editor, Tldraw, TLGeoShape, TLShapePartial } from "@tldraw/tldraw";

export function Inbox() {
  return (
    <div className="tldraw__editor">
      <Tldraw
        onMount={(editor: Editor) => {
          (async () => {
            try {
              const response = await fetch('https://jeffemmett-canvas.web.val.run', {
                method: 'GET',
              });
              const messages = await response.json();

              for (let i = 0; i < messages.length; i++) { 
                const message = messages[i];
                const parsedEmailName = message.from.match(/^([^<]+)/)?.[1]?.trim() || message.from.match(/[^<@]+(?=@)/)?.[0] || message.from;
                const messageText = `from: ${parsedEmailName}\nsubject: ${message.subject}\n\n${message.text}`
                const shapeWidth = 500
                const shapeHeight = 300
                const spacing = 50
                const shape: TLShapePartial<TLGeoShape> = {
                  id: createShapeId(),
                  type: 'geo',
                  x: shapeWidth * (i % 5) + spacing * (i % 5),
                  y: shapeHeight * Math.floor(i / 5) + spacing * Math.floor(i / 5),
                  props: {
                    w: shapeWidth,
                    h: shapeHeight,
                    text: messageText,
                    align:'start',
                    verticalAlign:'start'
                  }
                }
                editor.createShape(shape)
              }
            } catch (error) {
              console.error('Error fetching data:', error);
            }
          })();
        }}
      />
    </div>
  );
}