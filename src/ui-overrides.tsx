import {
	DefaultToolbar,
	DefaultToolbarContent,
	TLComponents,
	TLUiOverrides,
	TldrawUiMenuItem,
	useEditor,
	useTools,
	TLShapeId,
	DefaultContextMenu,
	DefaultContextMenuContent,
	TLUiContextMenuProps,
	TldrawUiMenuGroup,
	TLShape,
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

const copyFrameLink = async (editor: Editor, frameId: string) => {
	console.log('Starting copyFrameLink with frameId:', frameId);

	if (!editor.store.getSnapshot()) {
		console.warn('Store not ready');
		return;
	}

	try {
		const baseUrl = `${window.location.origin}${window.location.pathname}`;
		console.log('Base URL:', baseUrl);

		const url = new URL(baseUrl);
		url.searchParams.set('frameId', frameId);

		const frame = editor.getShape(frameId as TLShapeId);
		console.log('Found frame:', frame);

		if (frame) {
			const camera = editor.getCamera();
			console.log('Camera position:', { x: camera.x, y: camera.y, zoom: camera.z });

			url.searchParams.set('x', camera.x.toString());
			url.searchParams.set('y', camera.y.toString());
			url.searchParams.set('zoom', camera.z.toString());
		}

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
			textArea.select();
			document.execCommand('copy');
			document.body.removeChild(textArea);
			console.log('URL copied successfully using fallback method');
		}
	} catch (error) {
		console.error('Failed to copy to clipboard:', error);
		alert('Failed to copy link. Please check clipboard permissions.');
	}
};

const zoomToSelection = (editor: Editor) => {
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

	if (!editor.store.getSnapshot()) {
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
			textArea.select();
			document.execCommand('copy');
			document.body.removeChild(textArea);
			console.log('URL copied successfully using fallback method');
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

function CustomContextMenu(props: TLUiContextMenuProps) {
	const editor = useEditor()
	const hasSelection = editor.getSelectedShapeIds().length > 0
	const selectedShape = editor.getSelectedShapes()[0]
	const hasCameraHistory = cameraHistory.length > 0

	return (
		<DefaultContextMenu {...props}>
			<TldrawUiMenuGroup id="camera-actions">
				<TldrawUiMenuItem
					id="revert-camera"
					label="Revert Camera"
					icon="undo"
					kbd="b"
					readonlyOk
					disabled={!hasCameraHistory}
					onSelect={() => {
						console.log('Reverting camera');
						revertCamera(editor);
					}}
				/>
				<TldrawUiMenuItem
					id="zoom-to-selection"
					label="Zoom to Selection"
					icon="zoom-in"
					kbd="z"
					readonlyOk
					disabled={!hasSelection}
					onSelect={() => {
						console.log('Zoom to Selection clicked');
						zoomToSelection(editor);
					}}
				/>
				<TldrawUiMenuItem
					id="copy-link-to-current-view"
					label="Copy Link to Current View"
					icon="link"
					kbd="s"
					readonlyOk
					onSelect={() => {
						console.log('Copy Link to Current View clicked');
						copyLinkToCurrentView(editor);
					}}
				/>
			</TldrawUiMenuGroup>
			<DefaultContextMenuContent />
		</DefaultContextMenu>
	)
}

export const uiOverrides: TLUiOverrides = {
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
		actions['copyFrameLink'] = {
			id: 'copy-frame-link',
			label: 'Copy Frame Link',
			onSelect: () => {
				const shape = editor.getSelectedShapes()[0]
				if (shape && shape.type === 'frame') {
					copyFrameLink(editor, shape.id)
				}
			},
			readonlyOk: true,
		}

		actions['zoomToFrame'] = {
			id: 'zoom-to-frame',
			label: 'Zoom to Frame',
			onSelect: () => {
				const shape = editor.getSelectedShapes()[0]
				if (shape && shape.type === 'frame') {
					zoomToSelection(editor)
				}
			},
			readonlyOk: true,
		}

		actions['copyLinkToCurrentView'] = {
			id: 'copy-link-to-current-view',
			label: 'Copy Link to Current View',
			kbd: 'c',
			onSelect: () => {
				console.log('Creating link to current view');
				copyLinkToCurrentView(editor);
			},
			readonlyOk: true,
		}

		actions['zoomToShape'] = {
			id: 'zoom-to-shape',
			label: 'Zoom to Selection',
			kbd: 'z',
			onSelect: () => {
				if (editor.getSelectedShapeIds().length > 0) {
					console.log('Zooming to selection');
					zoomToSelection(editor);
				}
			},
			readonlyOk: true,
		}

		actions['revertCamera'] = {
			id: 'revert-camera',
			label: 'Revert Camera',
			kbd: 'b',
			onSelect: () => {
				console.log('Reverting camera position');
				revertCamera(editor);
			},
			readonlyOk: true,
		}

		return actions
	},
}

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
	ContextMenu: function CustomContextMenu({ ...rest }) {
		const editor = useEditor()
		const hasSelection = editor.getSelectedShapeIds().length > 0
		const hasCameraHistory = cameraHistory.length > 0

		return (
			<DefaultContextMenu {...rest}>
				<DefaultContextMenuContent />
				<TldrawUiMenuGroup id="custom-actions">
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
						kbd="c"
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
			</DefaultContextMenu>
		)
	},
}

const handleInitialShapeLoad = (editor: Editor) => {
	const url = new URL(window.location.href);

	// Check for both shapeId and legacy frameId (for backwards compatibility)
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
			console.warn('Shape not found:', shapeId);
		}
	}
};