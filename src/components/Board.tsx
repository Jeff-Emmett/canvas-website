import { useLocation, useParams } from 'react-router-dom';
import { Editor, Tldraw } from "@tldraw/tldraw";
import { canvas } from "@/canvas01";
import { sharedcalendar2025 } from "@/sharedcalendar2025";

export function Board() {
  const { pathname } = useLocation();
  const boardId = pathname.substring(pathname.lastIndexOf('/') + 1);
  const getBoard = () => {
    switch (boardId) {
      case 'canvas01':
        return canvas;
      case 'sharedcalendar2025':
        return sharedcalendar2025;
      default:
        return canvas; // Default to canvas if no match
    }
  };
  
  return (
    <div className="tldraw__editor">
      <Tldraw
        onMount={(editor: Editor) => {
          editor.putContentOntoCurrentPage(getBoard() as any)
        }}
      />
    </div>
  );
}