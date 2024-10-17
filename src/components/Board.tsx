import { useSync } from '@tldraw/sync'
import {
	AssetRecordType,
	getHashForString,
	TLBookmarkAsset,
	Tldraw,
} from 'tldraw'
import { useParams } from 'react-router-dom'
import { ChatBoxTool } from '@/tools/ChatBoxTool'
import { IChatBoxShape, ChatBoxShape } from '@/shapes/ChatBoxShapeUtil'
import { VideoChatTool } from '@/tools/VideoChatTool'
import { IVideoChatShape, VideoChatShape } from '@/shapes/VideoChatShapeUtil'
import { multiplayerAssetStore } from '../client/multiplayerAssetStore'
import { customSchema } from '../../worker/TldrawDurableObject'

import React, { useState, useEffect, useRef } from 'react';
import { ChatBox } from '@/shapes/ChatBoxShapeUtil';
import { components, uiOverrides } from '@/ui-overrides'

const WORKER_URL = `https://jeffemmett-canvas.jeffemmett.workers.dev`

const shapeUtils = [ChatBoxShape, VideoChatShape]
const tools = [ChatBoxTool, VideoChatTool]; // Array of tools

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

	const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setUserName(event.target.value);
	};

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				store={store}
				shapeUtils={shapeUtils}
				overrides={uiOverrides}
				components={components}
				tools={tools}
			// onMount={(editor) => {
			// editor.registerExternalAssetHandler('url', unfurlBookmarkUrl)
			// }}
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