import { useEffect } from 'react';
import { Editor, TLFrameShape, TLParentId } from 'tldraw';
import { useSearchParams } from 'react-router-dom';

const initialCamera = { x: 0, y: 0, z: 1 };

export function useCameraControls(editor: Editor | null) {
    const [searchParams] = useSearchParams();

    useEffect(() => {
        if (!editor) return;

        const frameId = searchParams.get('frameId');
        const x = searchParams.get('x');
        const y = searchParams.get('y');
        const zoom = searchParams.get('zoom');

        console.log('Loading camera position:', { frameId, x, y, zoom });

        if (x && y && zoom) {
            editor.setCamera({
                x: parseFloat(x),
                y: parseFloat(y),
                z: parseFloat(zoom)
            });
            console.log('Camera position set from URL params');
            return;
        }

        if (!frameId) return;

        const frame = editor.getShape(frameId as TLParentId) as TLFrameShape;
        if (!frame) {
            console.warn('Frame not found:', frameId);
            return;
        }

        editor.zoomToBounds(
            editor.getShapePageBounds(frame)!,
            {
                inset: 32,
                targetZoom: editor.getCamera().z,
            }
        );

        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('frameId', frameId);
        window.history.replaceState(null, '', newUrl.toString());
    }, [editor, searchParams]);

    const copyLocationLink = () => {
        if (!editor) return;
        const camera = editor.getCamera();
        const url = new URL(window.location.href);
        url.searchParams.set('x', camera.x.toString());
        url.searchParams.set('y', camera.y.toString());
        url.searchParams.set('zoom', camera.z.toString());
        console.log('Copying location link:', url.toString());
        navigator.clipboard.writeText(url.toString());
    };

    const zoomToFrame = (frameId: string) => {
        if (!editor) return;

        const frame = editor.getShape(frameId as TLParentId) as TLFrameShape;
        if (!frame) {
            console.warn('Frame not found:', frameId);
            return;
        }

        editor.zoomToBounds(
            editor.getShapePageBounds(frame)!,
            {
                inset: 32,
                targetZoom: editor.getCamera().z,
            }
        );
    };

    const copyFrameLink = (frameId: string) => {
        const url = new URL(window.location.href);
        url.searchParams.set('frameId', frameId);
        console.log('Copying frame link:', url.toString());
        navigator.clipboard.writeText(url.toString());
    };

    return {
        zoomToFrame,
        copyFrameLink,
        copyLocationLink,
        revertCamera: () => {
            if (!editor) return
            editor.setCamera(initialCamera)
        }
    };
} 