import { inject } from '@vercel/analytics';
import "tldraw/tldraw.css";
import "./css/style.css"
import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Default } from "./components/Default";
import { Canvas } from "./components/Canvas";
import { Toggle } from "./components/Toggle";
import { useCanvas } from "./hooks/useCanvas"
import { createShapes } from "./utils/utils";
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Contact } from "./components/Contact";
import { Post } from "./components/Post";
import { Board } from './components/Board';
import { Inbox } from './components/Inbox';
import { Books } from './components/Books';
import {
	BindingUtil,
	IndexKey,
	TLBaseBinding,
	TLBaseShape,
	Tldraw,
} from 'tldraw';
import { components, uiOverrides } from './ui-overrides';
import { ChatBoxShape } from './shapes/ChatBoxShapeUtil';
import { VideoChatShape } from './shapes/VideoChatShapeUtil';
import { ChatBoxTool } from './tools/ChatBoxTool';
import { VideoChatTool } from './tools/VideoChatTool';
import { GoogleAuthProvider } from './context/GoogleAuthContext';
import EnvCheck from './test/EnvCheck';
import { EmbedTest } from './test/EmbedTest';
//import { Callback } from './components/callback';
import AuthCallback from './pages/auth/callback';

inject();

// The container shapes that can contain element shapes
const CONTAINER_PADDING = 24;

type ContainerShape = TLBaseShape<'element', { height: number; width: number }>;

// ... existing code for ContainerShapeUtil ...

// The element shapes that can be placed inside the container shapes
type ElementShape = TLBaseShape<'element', { color: string }>;

// ... existing code for ElementShapeUtil ...

// The binding between the element shapes and the container shapes
type LayoutBinding = TLBaseBinding<
	'layout',
	{
		index: IndexKey;
		placeholder: boolean;
	}
>;

const customShapeUtils = [ChatBoxShape, VideoChatShape];
const customTools = [ChatBoxTool, VideoChatTool];

// [2]
export default function InteractiveShapeExample() {
	return (
		<div className="tldraw__editor">
			<Tldraw

				shapeUtils={customShapeUtils} // Use custom shape utils
				tools={customTools} // Pass in the array of custom tool classes
				overrides={uiOverrides}
				components={components}
				onMount={(editor) => {
					editor.createShape({ type: 'my-interactive-shape', x: 100, y: 100 });
				}}
			/>
		</div>
	);
}

// ... existing code ...

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

function App() {
	return (
		<GoogleAuthProvider>
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/card/contact" element={<Contact />} />
					<Route path="/posts/:slug" element={<Post />} />
					<Route path="/board/:slug" element={<Board />} />
					<Route path="/inbox" element={<Inbox />} />
					<Route path="/books" element={<Books />} />
					<Route path="/test" element={<EnvCheck />} />
					<Route path="/embed-test" element={<EmbedTest />} />
					<Route path="/auth/callback" element={<AuthCallback />} />
				</Routes>
			</BrowserRouter>
		</GoogleAuthProvider>
	);
}

function Home() {
	const { isCanvasEnabled, elementsInfo } = useCanvas();
	const shapes = createShapes(elementsInfo)
	const [isEditorMounted, setIsEditorMounted] = useState(false);

	//console.log("THIS WORKS SO FAR")

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
		<><Toggle />
			<div style={{ zIndex: 999999 }} className={`${isCanvasEnabled && isEditorMounted ? 'transparent' : ''}`}>
				{<Default />}
			</div>
			{isCanvasEnabled && elementsInfo.length > 0 ? <Canvas shapes={shapes} /> : null}</>
	)
}