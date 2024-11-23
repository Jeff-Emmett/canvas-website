import { useSync } from '@tldraw/sync'
import {
	AssetRecordType,
	getHashForString,
	TLBookmarkAsset,
	Tldraw,
} from 'tldraw'
import { useParams } from 'react-router-dom'
import { ChatBoxTool } from '@/tools/ChatBoxTool'
import { ChatBoxShape } from '@/shapes/ChatBoxShapeUtil'
import { VideoChatTool } from '@/tools/VideoChatTool'
import { VideoChatShape } from '@/shapes/VideoChatShapeUtil'
import { multiplayerAssetStore } from '../client/multiplayerAssetStore'
import { customSchema } from '../../worker/TldrawDurableObject'
import { EmbedShape } from '@/shapes/EmbedShapeUtil'
import { EmbedTool } from '@/tools/EmbedTool'
import { useGoogleAuth } from '@/context/GoogleAuthContext';

import React, { useState } from 'react';
import { ChatBox } from '@/shapes/ChatBoxShapeUtil';
import { components, uiOverrides } from '@/ui-overrides'

const WORKER_URL = process.env.NODE_ENV === 'development'
	? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:5172`
	: 'wss://jeffemmett-canvas.jeffemmett.workers.dev'

const shapeUtils = [ChatBoxShape, VideoChatShape, EmbedShape]
const tools = [ChatBoxTool, VideoChatTool, EmbedTool]; // Array of tools

export function Board() {
	const { slug } = useParams<{ slug: string }>(); // Ensure this is inside the Board component
	const roomId = slug || 'default-room'; // Declare roomId here

	const store = useSync({
		uri: `${WORKER_URL}/connect/${roomId}`,
		assets: multiplayerAssetStore,
		shapeUtils: shapeUtils,
		schema: customSchema,
	});

	const [isChatBoxVisible, setChatBoxVisible] = useState(false);
	const [userName, setUserName] = useState('');
	const [isVideoChatVisible, setVideoChatVisible] = useState(false); // Added state for video chat visibility
	const { isAuthenticated, user } = useGoogleAuth();

	const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setUserName(event.target.value);
	};

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			{isAuthenticated && user?.picture && (
				<div style={{
					position: 'fixed',
					top: '10px',
					right: '10px',
					zIndex: 10000,
					borderRadius: '50%',
					overflow: 'hidden',
					width: '32px',
					height: '32px',
					boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
				}}>
					<img
						src={user.picture}
						alt="User Profile"
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'cover'
						}}
					/>
				</div>
			)}
			<Tldraw
				store={store}
				shapeUtils={shapeUtils}
				overrides={uiOverrides}
				components={components}
				tools={tools}
				onMount={(editor) => {
					editor.registerExternalAssetHandler('url', unfurlBookmarkUrl)
					editor.setCurrentTool('hand')
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
						w={200} // Set appropriate width
						h={200} // Set appropriate height
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
