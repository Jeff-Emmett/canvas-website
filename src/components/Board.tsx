import { useSync } from '@tldraw/sync'
import {
	AssetRecordType,
	getHashForString,
	TLBookmarkAsset,
	TLRecord,
	Tldraw,
	TLAnyShapeUtilConstructor,
} from '@tldraw/tldraw'
import { useParams } from 'react-router-dom'
import useLocalStorageState from 'use-local-storage-state'
import { ChatBoxTool } from '@/tools/ChatBoxTool'
import { ChatBoxShapeUtil } from '@/shapes/ChatBoxShapeUtil'
import { VideoChatTool } from '@/tools/VideoChatTool'
import { VideoChatShapeUtil } from '@/shapes/VideoChatShapeUtil'
import { multiplayerAssetStore } from '../client/multiplayerAssetStore'
import { customSchema } from '../../worker/TldrawDurableObject'
import { EmbedShapeUtil } from '@/shapes/EmbedShapeUtil'
import { EmbedTool } from '@/tools/EmbedTool'

import React, { useState, useEffect, useCallback } from 'react';
import { ChatBox } from '@/shapes/ChatBoxShapeUtil';
import { components, uiOverrides } from '@/ui-overrides'

//const WORKER_URL = `https://jeffemmett-canvas.jeffemmett.workers.dev`
export const WORKER_URL = process.env.VITE_TLDRAW_WORKER_URL || 'https://jeffemmett-canvas.jeffemmett.workers.dev';

// Add these imports
import { useLocalStorageRoom } from '@/hooks/useLocalStorageRoom';


export function Board() {
	const { slug } = useParams<{ slug: string }>();
	const roomId = slug || 'default-room';
	const { store, isOnline } = useLocalStorageRoom(roomId);

	useEffect(() => {
		if (!store) return;

		const unsubscribe = store.listen((update) => {
			if (update.source === 'remote') {
				console.log('Received remote update:', update);
			}
		});

		return () => unsubscribe();
	}, [store]);

	useEffect(() => {
		console.log('Store updated:', {
			hasStore: !!store,
			recordCount: store?.allRecords().length,
			records: store?.allRecords()
		});
	}, [store]);

	const getBaseUrl = () => {
		const isLocalhost = window.location.hostname === 'localhost' ||
			window.location.hostname === '127.0.0.1';

		return isLocalhost
			? `${window.location.protocol}//${window.location.hostname}:5172`
			: WORKER_URL;
	};

	useEffect(() => {
		if (!store) return;

		const unsubscribe = store.listen((update) => {
			if (update.source === 'user') {
				fetch(`${getBaseUrl()}/room/${roomId}`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(store.allRecords())
				}).catch(error => {
					console.error('Error sending update to server:', error);
				});
			}
		});

		return () => unsubscribe();
	}, [store, roomId]);

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				store={store}
				shapeUtils={[ChatBoxShapeUtil, VideoChatShapeUtil, EmbedShapeUtil]}
				overrides={uiOverrides}
				components={components}
				autoFocus
				onMount={(editor) => {
					editor.registerExternalAssetHandler('url', unfurlBookmarkUrl)
					editor.setCurrentTool('hand')
				}}
			/>
			{!isOnline && (
				<div style={{ position: 'absolute', top: 0, right: 0, padding: '8px', background: '#ffeb3b' }}>
					Offline Mode
				</div>
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
