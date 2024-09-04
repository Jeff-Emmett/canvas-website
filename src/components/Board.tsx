import { useSync } from '@tldraw/sync'
import {
	AssetRecordType,
	getHashForString,
	TLAssetStore,
	TLBookmarkAsset,
	Tldraw,
	uniqueId,
} from 'tldraw'
import { useParams } from 'react-router-dom' // Add this import
import { ChatBoxTool } from '@/tools/ChatBoxTool'
import { IChatBoxShape, ChatBoxShape } from '@/shapes/ChatBoxShape'
import { VideoChatTool } from '@/tools/VideoChatTool'
import { IVideoChatShape, VideoChatShape } from '@/shapes/VideoChatShape'
import { multiplayerAssetStore } from '../client/multiplayerAssetStore' // Adjusted path if necessary
import { customSchema } from '../../worker/TldrawDurableObject'
import './ChatBoxStyles.css' // Add a CSS file for styles

import React, { useState, useEffect, useRef } from 'react'; // Ensure useRef is imported
import { ChatBox } from '@/shapes/ChatBoxShape'; // Add this import
 import { VideoChat }  from '@/shapes/VideoChatShape';

const WORKER_URL = `https://jeffemmett-canvas.jeffemmett.workers.dev`

const shapeUtils = [ChatBoxShape, VideoChatShape]
const tools = [ChatBoxTool, VideoChatTool]; // Array of tools

// Function to register tools
const registerTools = (store: any, registeredToolsRef: React.MutableRefObject<Set<string>>) => {
	const typedStore = store as unknown as { 
		registerTool: (tool: any) => void; 
		hasTool: (id: string) => boolean; 
	}; 

	tools.forEach(tool => {
		if (!registeredToolsRef.current.has(tool.id) && typedStore.hasTool && !typedStore.hasTool(tool.id)) {
			typedStore.registerTool(tool); // Register the tool
			registeredToolsRef.current.add(tool.id); // Mark this tool as registered
		}
	});
};


export function Board() {
	const { slug } = useParams<{ slug: string }>(); // Ensure this is inside the Board component
	const roomId = slug || 'default-room'; // Declare roomId here

	const store = useSync({
		uri: `${WORKER_URL}/connect/${roomId}`,
		assets: multiplayerAssetStore,
		shapeUtils: shapeUtils,
		schema: customSchema
	});

	const [isChatBoxVisible, setChatBoxVisible] = useState(false);
	const [userName, setUserName] = useState('');
	const [isVideoChatVisible, setVideoChatVisible] = useState(false); // Added state for video chat visibility
	const registeredToolsRef = useRef(new Set<string>()); // Ref to track registered tools

	// Call the function to register tools only once
	useEffect(() => {
		registerTools(store, registeredToolsRef);
	}, [store]); // Ensure this effect runs when the store changes

//	const videoChatTool = {
//		id: 'videoChatTool', // Ensure this ID is unique
//		// ... other properties of the tool
//	};

	//const typedStore = store as unknown as { 
	//	registerTool: (tool: any) => void; 
	//	hasTool: (id: string) => boolean; // Ensure hasTool is included
	//}; 

	//if (typedStore.hasTool && !typedStore.hasTool(videoChatTool.id)) { // Check if the tool ID is unique
	//	typedStore.registerTool(videoChatTool); // Register the video chat tool
	//} else {
	//	console.error(`Tool with id "${videoChatTool.id}" is already registered. Cannot register again.`); // Log an error
	//}

//	useEffect(() => {
//		tools.forEach(tool => {
//			const typedStore = store as unknown as { 
//				registerTool: (tool: any) => void; 
//				hasTool: (id: string) => boolean; // Ensure hasTool is included
//			}; 
//			if (typedStore.hasTool && !typedStore.hasTool(tool.id)) { // Check if hasTool exists
//				typedStore.registerTool(tool); // Use the typed store
//			} else {
//				console.warn(`Tool with id "${tool.id}" is already registered. Cannot register again.`); // Log an error
//			}
//		});
//	}, [store]); // Run this effect when the store changes

	const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setUserName(event.target.value);
	};

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				store={store} 
				shapeUtils={shapeUtils}
				tools={tools}
				onMount={(editor) => {
					editor.registerExternalAssetHandler('url', unfurlBookmarkUrl)
					editor.createShape<IChatBoxShape>({
						type: 'chatBox',
						x: 0,
						y: 0,
						props: {
							w: 200,
							h: 200,
							roomId: roomId,
						},
					});
					//if (isVideoChatVisible) {
						//editor.registerExternalAssetHandler('url', unfurlBookmarkUrl)	
						editor.createShape<IVideoChatShape>({
							type: 'videoChat',
							x: 300, // Adjust position as needed
							y: 0,
							props: {
								roomUrl: 'https://whereby.com/default-room', // Default room URL
								w: 640,
								h: 480,
							},
						});
					//}
				}}
			/>
			{isChatBoxVisible && (
				<div>
					<input
						type="text"
						value={userName}
						onChange={handleNameChange}
						placeholder="Enter your name"
					/>
					<ChatBox 
						userName={userName} 
						roomId={roomId} // Added roomId
						width={200} // Set appropriate width
						height={200} // Set appropriate height
					/> 
				</div>
			)}
			{isVideoChatVisible && ( // Render the button to join video chat
				<button onClick={() => setVideoChatVisible(false)} className="bg-green-500 text-white px-4 py-2 rounded">
					Join Video Call
				</button>
			)}
		</div>
	)
}

// Assuming you have a message structure like this
interface ChatMessage {
    id: string;
    text: string;
    isUser: boolean; // New property to identify the sender
}

// Example rendering function for messages
function renderMessage(message: ChatMessage) {
    return (
        <div className={message.isUser ? 'user-message' : 'other-message'}>
            {message.text}
        </div>
    )
}

// How does our server handle bookmark unfurling?
async function unfurlBookmarkUrl({ url }: { url: string }): Promise<TLBookmarkAsset> {
	const asset: TLBookmarkAsset = {
		id: AssetRecordType.createId(getHashForString(url)),
		typeName: 'asset',
		type: 'bookmark',
		meta: {},
		props: {
			src: url,
			description: '',
			image: '',
			favicon: '',
			title: '',
		},
	}

	try {
		const response = await fetch(`${WORKER_URL}/unfurl?url=${encodeURIComponent(url)}`)
		const data = await response.json() as { description: string, image: string, favicon: string, title: string }

		asset.props.description = data?.description ?? ''
		asset.props.image = data?.image ?? ''
		asset.props.favicon = data?.favicon ?? ''
		asset.props.title = data?.title ?? ''
	} catch (e) {
		console.error(e)
	}

	return asset
}