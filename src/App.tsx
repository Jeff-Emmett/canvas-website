import { inject } from '@vercel/analytics';
import "tldraw/tldraw.css";
import "@/css/style.css"
import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Default } from "@/components/Default";
import { Canvas } from "@/components/Canvas";
import { Toggle } from "@/components/Toggle";
import { useCanvas } from "@/hooks/useCanvas"
import { createShapes } from "@/utils/utils";
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Contact } from "@/components/Contact";
import { Post } from '@/components/Post';
import { Board } from './components/Board';
import { Inbox } from './components/Inbox';
import { Books } from './components/Books';
import {
	Editor,
	Tldraw,
	TLShapeId,
} from 'tldraw';
import { components, overrides } from './ui-overrides'
import { ChatBoxShape } from './shapes/ChatBoxShapeUtil';
import { VideoChatShape } from './shapes/VideoChatShapeUtil';
import { ChatBoxTool } from './tools/ChatBoxTool';
import { VideoChatTool } from './tools/VideoChatTool';
import { EmbedTool } from './tools/EmbedTool';
import { EmbedShape } from './shapes/EmbedShapeUtil';

inject();

const customShapeUtils = [ChatBoxShape, VideoChatShape, EmbedShape];
const customTools = [ChatBoxTool, VideoChatTool, EmbedTool];

// [2]
export default function InteractiveShapeExample() {
	return (
		<div className="tldraw__editor">
			<Tldraw
				shapeUtils={customShapeUtils}
				tools={customTools}
				overrides={overrides}
				components={components}
				onMount={(editor) => {
					handleInitialShapeLoad(editor);
					editor.createShape({ type: 'my-interactive-shape', x: 100, y: 100 });
				}}
			/>
		</div>
	);
}

// Add this function before or after InteractiveShapeExample
const handleInitialShapeLoad = (editor: Editor) => {
	const url = new URL(window.location.href);
	const shapeId = url.searchParams.get('shapeId') || url.searchParams.get('frameId');
	const x = url.searchParams.get('x');
	const y = url.searchParams.get('y');
	const zoom = url.searchParams.get('zoom');

	if (shapeId) {
		console.log('Found shapeId in URL:', shapeId);
		const shape = editor.getShape(shapeId as TLShapeId);

		if (shape) {
			console.log('Found shape:', shape);
			if (x && y && zoom) {
				console.log('Setting camera to:', { x, y, zoom });
				editor.setCamera({
					x: parseFloat(x),
					y: parseFloat(y),
					z: parseFloat(zoom)
				});
			} else {
				console.log('Zooming to shape bounds');
				editor.zoomToBounds(editor.getShapeGeometry(shape).bounds, {
					targetZoom: 1,
					//padding: 32
				});
			}
		} else {
			console.warn('Shape not found in the editor');
		}
	} else {
		console.warn('No shapeId found in the URL');
	}
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

function App() {

	return (
		// <React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/card/contact" element={<Contact />} />
				<Route path="/posts/:slug" element={<Post />} />
				<Route path="/board/:slug" element={<Board />} />
				<Route path="/inbox" element={<Inbox />} />
				<Route path="/books" element={<Books />} />
			</Routes>
		</BrowserRouter>
		// </React.StrictMode>
	);
};

function Home() {
	const { isCanvasEnabled, elementsInfo } = useCanvas();
	const shapes = createShapes(elementsInfo)
	const [isEditorMounted, setIsEditorMounted] = useState(false);

	useEffect(() => {
		const handleEditorDidMount = () => {
			setIsEditorMounted(true);
		};

		window.addEventListener('editorDidMountEvent', handleEditorDidMount);

		return () => {
			window.removeEventListener('editorDidMountEvent', handleEditorDidMount);
		};
	}, []);

	return (
		<>
			<Toggle />
			<div style={{ zIndex: 999999 }} className={`${isCanvasEnabled && isEditorMounted ? 'transparent' : ''}`}>
				{<Default />}
			</div>
			{isCanvasEnabled && elementsInfo.length > 0 ? <Canvas shapes={shapes} /> : null}
		</>
	)
}