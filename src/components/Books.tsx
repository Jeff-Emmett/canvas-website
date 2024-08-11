
import { Editor, Tldraw } from "@tldraw/tldraw";
import { canvas } from "@/canvas01";

export function Books() {
  return (
    <div className="tldraw__editor">
      <Tldraw
        onMount={(editor: Editor) => {
          editor.putContentOntoCurrentPage(canvas as any)
        }}
      />
    </div>
  );
}
