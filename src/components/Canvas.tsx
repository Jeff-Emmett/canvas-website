import { Editor, Tldraw, TLShape, TLUiComponents } from "tldraw";
import { SimController } from "@/physics/PhysicsControls";
import { HTMLShapeUtil } from "@/shapes/HTMLShapeUtil";

const components: TLUiComponents = {
  HelpMenu: null,
  StylePanel: null,
  PageMenu: null,
  NavigationPanel: null,
  DebugMenu: null,
  ContextMenu: null,
  ActionsMenu: null,
  QuickActions: null,
  MainMenu: null,
  MenuPanel: null,
}

export function Canvas({ shapes }: { shapes: TLShape[]; }) {

  return (
    <div className="tldraw__editor">
      <Tldraw
        components={components}
        shapeUtils={[HTMLShapeUtil]}
        onMount={(_: Editor) => {
          window.dispatchEvent(new CustomEvent('editorDidMountEvent'));
        }}
      >
        <SimController shapes={shapes} />
      </Tldraw>
    </div>
  );
}
