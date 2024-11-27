import { useSync } from '@tldraw/sync'
import {
	AssetRecordType,
	getHashForString,
	TLBookmarkAsset,
	TLRecord,
	Tldraw,
	Editor,
	TLFrameShape,
	TLUiEventSource,
} from 'tldraw'
import { useParams } from 'react-router-dom'
import useLocalStorageState from 'use-local-storage-state'
import { ChatBoxTool } from '@/tools/ChatBoxTool'
import { ChatBoxShape } from '@/shapes/ChatBoxShapeUtil'
import { VideoChatTool } from '@/tools/VideoChatTool'
import { VideoChatShape } from '@/shapes/VideoChatShapeUtil'
import { multiplayerAssetStore } from '../client/multiplayerAssetStore'
import { customSchema } from '../../worker/TldrawDurableObject'
import { EmbedShape } from '@/shapes/EmbedShapeUtil'
import { EmbedTool } from '@/tools/EmbedTool'

import React, { useState, useEffect, useCallback } from 'react';
import { ChatBox } from '@/shapes/ChatBoxShapeUtil';
import { components, uiOverrides } from '@/ui-overrides'
import { useCameraControls } from '@/hooks/useCameraControls'

//const WORKER_URL = `https://jeffemmett-canvas.jeffemmett.workers.dev`
export const WORKER_URL = 'https://jeffemmett-canvas.jeffemmett.workers.dev';

const shapeUtils = [ChatBoxShape, VideoChatShape, EmbedShape]
const tools = [ChatBoxTool, VideoChatTool, EmbedTool]; // Array of tools

// Add these imports
import { useGSetState } from '@/hooks/useGSetState';
import { useLocalStorageRoom } from '@/hooks/useLocalStorageRoom';
import { usePersistentBoard } from '@/hooks/usePersistentBoard';


export function Board() {
	const { slug } = useParams<{ slug: string }>();
	const roomId = slug || 'default-room';
	const store = usePersistentBoard(roomId);
	const [editor, setEditor] = useState<Editor | null>(null)
	const { zoomToFrame, copyFrameLink, copyLocationLink, revertCamera } = useCameraControls(editor)

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				store={store.store}
				shapeUtils={shapeUtils}
				tools={tools}
				components={components}
				overrides={{
					tools: (editor, baseTools) => ({
						...baseTools,
						ChatBox: {
							id: 'ChatBox',
							icon: 'chat',
							label: 'Chat',
							kbd: 'c',
							readonlyOk: true,
							onSelect: () => {
								editor.setCurrentTool('ChatBox')
							},
						},
						VideoChat: {
							id: 'VideoChat',
							icon: 'video',
							label: 'Video Chat',
							kbd: 'v',
							readonlyOk: true,
							onSelect: () => {
								editor.setCurrentTool('VideoChat')
							},
						},
						Embed: {
							id: 'Embed',
							icon: 'embed',
							label: 'Embed',
							kbd: 'e',
							readonlyOk: true,
							onSelect: () => {
								editor.setCurrentTool('Embed')
							},
						},
					}),
					actions: (editor, actions) => ({
						...actions,
						'zoomToShape': {
							id: 'zoom-to-shape',
							label: 'Zoom to Selection',
							kbd: 'z',
							onSelect: () => {
								if (editor.getSelectedShapeIds().length > 0) {
									zoomToFrame(editor.getSelectedShapeIds()[0]);
								}
							},
							readonlyOk: true,
						},
						'copyLinkToCurrentView': {
							id: 'copy-link-to-current-view',
							label: 'Copy Link to Current View',
							kbd: 'c',
							onSelect: () => {
								copyLocationLink();
							},
							readonlyOk: true,
						},
						'revertCamera': {
							id: 'revert-camera',
							label: 'Revert Camera',
							kbd: 'b',
							onSelect: () => {
								revertCamera();
							},
							readonlyOk: true,
						},
					}),
				}}
				onMount={(editor) => {
					setEditor(editor)
					editor.registerExternalAssetHandler('url', unfurlBookmarkUrl)
					editor.setCurrentTool('hand')
				}}
			/>
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
