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
import { multiplayerAssetStore } from '@/client/multiplayerAssetStore'
import { customSchema } from '../../worker/TldrawDurableObject'

const WORKER_URL = `https://jeffemmett-canvas.jeffemmett.workers.dev`

const shapeUtils = [ChatBoxShape]
const tools = [ChatBoxTool]

export function Board() {
	// Extract the slug from the URL
	const { slug } = useParams<{ slug: string }>()
	
	// Use the slug as the roomId, or fallback to 'default-room' if not provided
	const roomId = slug || 'default-room'

	// Create a store connected to multiplayer.
	const store = useSync({
		// Use the dynamic roomId in the URI
		uri: `${WORKER_URL}/connect/${roomId}`,
		// ...and how to handle static assets like images & videos
		assets: multiplayerAssetStore,
    shapeUtils: shapeUtils,
    schema: customSchema
	})

	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				// we can pass the connected store into the Tldraw component which will handle
				// loading states & enable multiplayer UX like cursors & a presence menu
				store={store} 
				shapeUtils={shapeUtils}
				tools={tools}
				onMount={(editor) => {
					// when the editor is ready, we need to register out bookmark unfurling service
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
          })
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