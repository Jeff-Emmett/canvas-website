import {
	DefaultToolbar,
	DefaultToolbarContent,
	TLComponents,
	TLUiOverrides,
	TldrawUiMenuItem,
	useEditor,
	useTools,
	DefaultContextMenu,
	DefaultContextMenuContent,
	TLUiContextMenuProps,
	TldrawUiMenuGroup,
} from 'tldraw'
import { CustomMainMenu } from './components/CustomMainMenu'
import { Editor } from 'tldraw'

let cameraHistory: { x: number; y: number; z: number }[] = [];
const MAX_HISTORY = 10; // Keep last 10 camera positions

// Helper function to store camera position
const storeCameraPosition = (editor: Editor) => {
	const currentCamera = editor.getCamera();
	// Only store if there's a meaningful change from the last position
	const lastPosition = cameraHistory[cameraHistory.length - 1];
	if (!lastPosition ||
		Math.abs(lastPosition.x - currentCamera.x) > 1 ||
		Math.abs(lastPosition.y - currentCamera.y) > 1 ||
		Math.abs(lastPosition.z - currentCamera.z) > 0.1) {

		cameraHistory.push({ ...currentCamera });
		if (cameraHistory.length > MAX_HISTORY) {
			cameraHistory.shift();
		}
		console.log('Stored camera position:', currentCamera);
	}
};


export const zoomToSelection = (editor: Editor) => {
	// Store camera position before zooming
	storeCameraPosition(editor);

	// Get all selected shape IDs
	const selectedIds = editor.getSelectedShapeIds();
	if (selectedIds.length === 0) return;

	// Get the common bounds that encompass all selected shapes
	const commonBounds = editor.getSelectionPageBounds();
	if (!commonBounds) return;

	// Calculate viewport dimensions
	const viewportPageBounds = editor.getViewportPageBounds();

	// Calculate the ratio of selection size to viewport size
	const widthRatio = commonBounds.width / viewportPageBounds.width;
	const heightRatio = commonBounds.height / viewportPageBounds.height;

	// Calculate target zoom based on selection size
	let targetZoom;
	if (widthRatio < 0.1 || heightRatio < 0.1) {
		// For very small selections, zoom in up to 8x
		targetZoom = Math.min(
			(viewportPageBounds.width * 0.8) / commonBounds.width,
			(viewportPageBounds.height * 0.8) / commonBounds.height,
			8 // Max zoom of 8x for small selections
		);
	} else if (widthRatio > 1 || heightRatio > 1) {
		// For selections larger than viewport, zoom out more
		targetZoom = Math.min(
			(viewportPageBounds.width * 0.7) / commonBounds.width,
			(viewportPageBounds.height * 0.7) / commonBounds.height,
			0.125 // Min zoom of 1/8x for large selections (reciprocal of 8)
		);
	} else {
		// For medium-sized selections, allow up to 4x zoom
		targetZoom = Math.min(
			(viewportPageBounds.width * 0.8) / commonBounds.width,
			(viewportPageBounds.height * 0.8) / commonBounds.height,
			4 // Medium zoom level
		);
	}

	// Zoom to the common bounds
	editor.zoomToBounds(commonBounds, {
		targetZoom,
		inset: widthRatio > 1 || heightRatio > 1 ? 20 : 50, // Less padding for large selections
		animation: {
			duration: 400,
			easing: (t) => t * (2 - t)
		}
	});

	// Update URL with new camera position and first selected shape ID
	const newCamera = editor.getCamera();
	const url = new URL(window.location.href);
	url.searchParams.set('shapeId', selectedIds[0].toString());
	url.searchParams.set('x', newCamera.x.toString());
	url.searchParams.set('y', newCamera.y.toString());
	url.searchParams.set('zoom', newCamera.z.toString());
	window.history.replaceState(null, '', url.toString());
};

const copyLinkToCurrentView = async (editor: Editor) => {
	console.log('Starting copyLinkToCurrentView');

	if (!editor.store.serialize()) {
		console.warn('Store not ready');
		return;
	}

	try {
		const baseUrl = `${window.location.origin}${window.location.pathname}`;
		console.log('Base URL:', baseUrl);

		const url = new URL(baseUrl);
		const camera = editor.getCamera();
		console.log('Current camera position:', { x: camera.x, y: camera.y, zoom: camera.z });

		// Set camera parameters
		url.searchParams.set('x', camera.x.toString());
		url.searchParams.set('y', camera.y.toString());
		url.searchParams.set('zoom', camera.z.toString());

		const finalUrl = url.toString();
		console.log('Final URL to copy:', finalUrl);

		if (navigator.clipboard && window.isSecureContext) {
			console.log('Using modern clipboard API...');
			await navigator.clipboard.writeText(finalUrl);
			console.log('URL copied successfully using clipboard API');
		} else {
			console.log('Falling back to legacy clipboard method...');
			const textArea = document.createElement('textarea');
			textArea.value = finalUrl;
			document.body.appendChild(textArea);
			try {
				await navigator.clipboard.writeText(textArea.value);
				console.log('URL copied successfully');
			} catch (err) {
				// Fallback for older browsers
				textArea.select();
				document.execCommand('copy');
				console.log('URL copied using fallback method');
			}
			document.body.removeChild(textArea);
		}
	} catch (error) {
		console.error('Failed to copy to clipboard:', error);
		alert('Failed to copy link. Please check clipboard permissions.');
	}
};

const revertCamera = (editor: Editor) => {
	if (cameraHistory.length > 0) {
		const previousCamera = cameraHistory.pop();
		if (previousCamera) {
			// Get current viewport bounds
			const viewportPageBounds = editor.getViewportPageBounds();

			// Create bounds that center on the previous camera position
			const targetBounds = {
				x: previousCamera.x - (viewportPageBounds.width / 2) / previousCamera.z,
				y: previousCamera.y - (viewportPageBounds.height / 2) / previousCamera.z,
				w: viewportPageBounds.width / previousCamera.z,
				h: viewportPageBounds.height / previousCamera.z,
			};

			// Use the same zoom animation as zoomToShape
			editor.zoomToBounds(targetBounds, {
				targetZoom: previousCamera.z,
				animation: {
					duration: 400,
					easing: (t) => t * (2 - t)
				}
			});

			console.log('Reverted to camera position:', previousCamera);
		}
	} else {
		console.log('No camera history available');
	}
};

// Export a function that creates the uiOverrides
export const overrides: TLUiOverrides = ({
	tools(editor, tools) {
		return {
			...tools,
			VideoChat: {
				id: 'VideoChat',
				icon: 'video',
				label: 'Video Chat',
				kbd: 'v',
				readonlyOk: true,
				onSelect: () => editor.setCurrentTool('VideoChat'),
			},
			ChatBox: {
				id: 'ChatBox',
				icon: 'chat',
				label: 'Chat',
				kbd: 'c',
				readonlyOk: true,
				onSelect: () => editor.setCurrentTool('ChatBox'),
			},
			Embed: {
				id: 'Embed',
				icon: 'embed',
				label: 'Embed',
				kbd: 'e',
				readonlyOk: true,
				onSelect: () => editor.setCurrentTool('Embed'),
			},
		}
	},
	actions(editor, actions) {
		return {
			...actions,
			'zoomToSelection': {
				id: 'zoom-to-selection',
				label: 'Zoom to Selection',
				kbd: 'z',
				onSelect: () => {
					if (editor.getSelectedShapeIds().length > 0) {
						zoomToSelection(editor);
					}
				},
				readonlyOk: true,
			},
			'copyLinkToCurrentView': {
				id: 'copy-link-to-current-view',
				label: 'Copy Link to Current View',
				kbd: 's',
				onSelect: () => {
					copyLinkToCurrentView(editor);
				},
				readonlyOk: true,
			},
			'revertCamera': {
				id: 'revert-camera',
				label: 'Revert Camera',
				kbd: 'b',
				onSelect: () => {
					if (cameraHistory.length > 0) {
						revertCamera(editor);
					}
				},
				readonlyOk: true,
			},
			'lockToFrame': {
				id: 'lock-to-frame',
				label: 'Lock to Frame',
				kbd: 'l',
				onSelect: () => {
					const selectedShapes = editor.getSelectedShapes()
					if (selectedShapes.length === 0) return
					const selectedShape = selectedShapes[0]
					const isFrame = selectedShape.type === 'frame'
					const bounds = editor.getShapePageBounds(selectedShape)
					if (!isFrame || !bounds) return

					editor.zoomToBounds(bounds, {
						animation: { duration: 300 },
						targetZoom: 1
					})
					editor.updateInstanceState({
						meta: { ...editor.getInstanceState().meta, lockedFrameId: selectedShape.id }
					})
				}
			}
		}
	},
})

export const components: TLComponents = {
	Toolbar: function Toolbar() {
		const editor = useEditor()
		const tools = useTools()

		return (
			<DefaultToolbar>
				<DefaultToolbarContent />
				{tools['VideoChat'] && (
					<TldrawUiMenuItem
						{...tools['VideoChat']}
						icon="video"
						label="Video Chat"
						isSelected={tools['VideoChat'].id === editor.getCurrentToolId()}
					/>
				)}
				{tools['ChatBox'] && (
					<TldrawUiMenuItem
						{...tools['ChatBox']}
						icon="chat"
						label="Chat"
						isSelected={tools['ChatBox'].id === editor.getCurrentToolId()}
					/>
				)}
				{tools['Embed'] && (
					<TldrawUiMenuItem
						{...tools['Embed']}
						icon="embed"
						label="Embed"
						isSelected={tools['Embed'].id === editor.getCurrentToolId()}
					/>
				)}
			</DefaultToolbar>
		)
	},
	MainMenu: CustomMainMenu,
	ContextMenu: function CustomContextMenu(props: TLUiContextMenuProps) {
		const editor = useEditor()
		const hasSelection = editor.getSelectedShapeIds().length > 0
		const hasCameraHistory = cameraHistory.length > 0
		const selectedShape = editor.getSelectedShapes()[0]
		const isFrame = selectedShape?.type === 'frame'

		return (
			<DefaultContextMenu {...props}>
				<DefaultContextMenuContent />

				{/* Camera Controls Group */}
				<TldrawUiMenuGroup id="camera-controls">
					<TldrawUiMenuItem
						id="zoom-to-selection"
						label="Zoom to Selection"
						icon="zoom-in"
						kbd="z"
						disabled={!hasSelection}
						onSelect={() => zoomToSelection(editor)}
					/>
					<TldrawUiMenuItem
						id="copy-link-to-current-view"
						label="Copy Link to Current View"
						icon="link"
						kbd="s"
						onSelect={() => copyLinkToCurrentView(editor)}
					/>
					<TldrawUiMenuItem
						id="revert-camera"
						label="Revert Camera"
						icon="undo"
						kbd="b"
						disabled={!hasCameraHistory}
						onSelect={() => revertCamera(editor)}
					/>
				</TldrawUiMenuGroup>

				{/* Creation Tools Group */}
				<TldrawUiMenuGroup id="creation-tools">
					<TldrawUiMenuItem
						id="video-chat"
						label="Create Video Chat"
						icon="video"
						kbd="v"
						onSelect={() => { editor.setCurrentTool('VideoChat'); }}
					/>
					<TldrawUiMenuItem
						id="chat-box"
						label="Create Chat Box"
						icon="chat"
						kbd="c"
						onSelect={() => { editor.setCurrentTool('ChatBox'); }}
					/>
					<TldrawUiMenuItem
						id="embed"
						label="Create Embed"
						icon="embed"
						kbd="e"
						onSelect={() => { editor.setCurrentTool('Embed'); }}
					/>
				</TldrawUiMenuGroup>

				{/* Frame Controls */}
				{isFrame && (
					<TldrawUiMenuGroup id="frame-controls">
						<TldrawUiMenuItem
							id="lock-to-frame"
							label="Lock to Frame"
							icon="lock"
							kbd="l"
							onSelect={() => {
								console.warn('lock to frame NOT IMPLEMENTED')
							}}
						/>
					</TldrawUiMenuGroup>
				)}
			</DefaultContextMenu>
		)
	}
}