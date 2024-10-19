import { BaseBoxShapeUtil, TLBaseShape } from "tldraw";
import { useCallback, useState } from "react";

export type IEmbedShape = TLBaseShape<
    'Embed',
    {
        w: number;
        h: number;
        url: string | null;
    }
>;

export class EmbedShape extends BaseBoxShapeUtil<IEmbedShape> {
    static override type = 'Embed';

    getDefaultProps(): IEmbedShape['props'] {
        return {
            url: null,
            w: 640,
            h: 480,
        };
    }

    indicator(shape: IEmbedShape) {
        return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />;
    }

    component(shape: IEmbedShape) {
        const [inputUrl, setInputUrl] = useState(shape.props.url || '');

        const handleSubmit = useCallback((e: React.FormEvent) => {
            e.preventDefault();
            this.editor.updateShape<IEmbedShape>({ id: shape.id, type: 'Embed', props: { ...shape.props, url: inputUrl } });
        }, [inputUrl]);

        if (!shape.props.url) {
            return (
                <div style={{ pointerEvents: 'all' }}>
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            placeholder="Enter URL"
                            style={{ width: shape.props.w, height: shape.props.h }}
                        />
                        <button type="submit">Load</button>
                    </form>
                </div>
            );
        }

        return (
            <div style={{ pointerEvents: 'all' }}>
                <iframe src={shape.props.url} width={shape.props.w} height={shape.props.h} />
            </div>
        );
    }
}
