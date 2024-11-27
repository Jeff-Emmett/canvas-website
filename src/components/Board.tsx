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
export const WORKER_URL = (() => {
	// During development
	if (import.meta.env.DEV) {
		return 'http://127.0.0.1:5172';
	}
	// In production
	return import.meta.env.VITE_TLDRAW_WORKER_URL || 'https://jeffemmett-canvas.jeffemmett.workers.dev';
})();

const shapeUtils = [ChatBoxShape, VideoChatShape, EmbedShape]
const tools = [ChatBoxTool, VideoChatTool, EmbedTool]; // Array of tools

// Add these imports
import { useGSetState } from '@/hooks/useGSetState';
import { useLocalStorageRoom } from '@/hooks/useLocalStorageRoom';
import { usePersistentBoard } from '@/hooks/usePersistentBoard';


export function Board() {
	const { slug } = useParams<{ slug: string }>();
	const roomId = slug || 'default-room';
	const { store } = usePersistentBoard(roomId);
	const [editor, setEditor] = useState<Editor | null>(null)
	const { zoomToFrame, copyFrameLink, copyLocationLink } = useCameraControls(editor)

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				store={store}
				shapeUtils={shapeUtils}
				overrides={{
					...uiOverrides,
					tools: (_editor, baseTools) => ({
						...baseTools,
						frame: {
							...baseTools.frame,
							contextMenu: (shape: TLFrameShape) => [
								{
									id: 'copy-frame-link',
									label: 'Copy Frame Link',
									onSelect: () => copyFrameLink(shape.id),
								},
								{
									id: 'zoom-to-frame',
									label: 'Zoom to Frame',
									onSelect: () => zoomToFrame(shape.id),
								},
								{
									id: 'copy-location-link',
									label: 'Copy Location Link',
									onSelect: () => copyLocationLink(),
								}
							]
						},
					})
				}}
				components={components}
				tools={tools}
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
