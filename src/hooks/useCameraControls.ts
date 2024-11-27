import { useEffect } from 'react';
import { Editor, TLEventMap, TLFrameShape, TLParentId } from 'tldraw';
import { useSearchParams } from 'react-router-dom';

// Define camera state interface
interface CameraState {
    x: number;
    y: number;
    z: number;
}

const MAX_HISTORY = 10;
let cameraHistory: CameraState[] = [];

// Improved camera change tracking with debouncing
const trackCameraChange = (editor: Editor) => {
    const currentCamera = editor.getCamera();
    const lastPosition = cameraHistory[cameraHistory.length - 1];

    // Store any viewport change that's not from a revert operation
    if (!lastPosition ||
        currentCamera.x !== lastPosition.x ||
        currentCamera.y !== lastPosition.y ||
        currentCamera.z !== lastPosition.z) {
        cameraHistory.push({ ...currentCamera });
        if (cameraHistory.length > MAX_HISTORY) {
            cameraHistory.shift();
        }
    }
};

export function useCameraControls(editor: Editor | null) {
    const [searchParams] = useSearchParams();

    // Handle URL-based camera positioning
    useEffect(() => {
        if (!editor) return;

        const frameId = searchParams.get('frameId');
        const x = searchParams.get('x');
        const y = searchParams.get('y');
        const zoom = searchParams.get('zoom');

        if (x && y && zoom) {
            editor.setCamera({
                x: parseFloat(x),
                y: parseFloat(y),
                z: parseFloat(zoom)
            });
            return;
        }

        if (frameId) {
            const frame = editor.getShape(frameId as TLParentId) as TLFrameShape;
            if (!frame) {
                console.warn('Frame not found:', frameId);
                return;
            }

            // Use editor's built-in zoomToBounds with animation
            editor.zoomToBounds(
                editor.getShapePageBounds(frame)!,
                {
                    inset: 32,
                    animation: { duration: 500 }
                }
            );
        }
    }, [editor, searchParams]);

    // Track camera changes
    useEffect(() => {
        if (!editor) return;

        const handler = () => {
            trackCameraChange(editor);
        };

        // Track both viewport changes and user interaction end
        editor.on('viewportChange' as keyof TLEventMap, handler);
        editor.on('userChangeEnd' as keyof TLEventMap, handler);

        return () => {
            editor.off('viewportChange' as keyof TLEventMap, handler);
            editor.off('userChangeEnd' as keyof TLEventMap, handler);
        };
    }, [editor]);

    // Enhanced camera control functions
    return {
        zoomToFrame: (frameId: string) => {
            if (!editor) return;
            const frame = editor.getShape(frameId as TLParentId) as TLFrameShape;
            if (!frame) return;

            editor.zoomToBounds(
                editor.getShapePageBounds(frame)!,
                {
                    inset: 32,
                    animation: { duration: 500 }
                }
            );
        },

        copyFrameLink: (frameId: string) => {
            const url = new URL(window.location.href);
            url.searchParams.set('frameId', frameId);
            navigator.clipboard.writeText(url.toString());
        },

        copyLocationLink: () => {
            if (!editor) return;
            const camera = editor.getCamera();
            const url = new URL(window.location.href);
            url.searchParams.set('x', camera.x.toString());
            url.searchParams.set('y', camera.y.toString());
            url.searchParams.set('zoom', camera.z.toString());
            navigator.clipboard.writeText(url.toString());
        },

        revertCamera: () => {
            if (!editor || cameraHistory.length === 0) return;
            const previousCamera = cameraHistory.pop();
            if (previousCamera) {
                editor.setCamera(previousCamera, { animation: { duration: 200 } });
            }
        }
    };
} 