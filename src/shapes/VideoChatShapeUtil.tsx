import { BaseBoxShapeUtil, TLBaseShape } from "tldraw";
import { useEffect, useState } from "react";
import { WORKER_URL } from '../components/Board';

export type IVideoChatShape = TLBaseShape<
	'VideoChat',
	{
		w: number;
		h: number;
		roomUrl: string | null;
		userName: string;
	}
>;

export class VideoChatShape extends BaseBoxShapeUtil<IVideoChatShape> {
	static override type = 'VideoChat';

	indicator(_shape: IVideoChatShape) {
		return null;
	}

	getDefaultProps(): IVideoChatShape['props'] {
		return {
			roomUrl: null,
			w: 640,
			h: 480,
			userName: ''
		};
	}

	async ensureRoomExists(shape: IVideoChatShape) {
		if (shape.props.roomUrl !== null) {
			return;
		}

		const response = await fetch(`${WORKER_URL}/daily/rooms`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				properties: {
					enable_recording: true,
					max_participants: 8
				}
			})
		});

		const data = await response.json();

		this.editor.updateShape<IVideoChatShape>({
			id: shape.id,
			type: 'VideoChat',
			props: {
				...shape.props,
				roomUrl: (data as any).url
			}
		});
	}

	component(shape: IVideoChatShape) {
		const [isInRoom, setIsInRoom] = useState(false);
		const [error, setError] = useState("");
		const [isLoading, setIsLoading] = useState(false);

		useEffect(() => {
			if (isInRoom && shape.props.roomUrl) {
				const script = document.createElement('script');
				script.src = 'https://www.daily.co/static/call-machine.js';
				document.body.appendChild(script);

				script.onload = () => {
					// @ts-ignore
					window.DailyIframe.createFrame({
						iframeStyle: {
							width: '100%',
							height: '100%',
							border: '0',
							borderRadius: '4px'
						},
						showLeaveButton: true,
						showFullscreenButton: true
					}).join({ url: shape.props.roomUrl });
				};
			}
		}, [isInRoom, shape.props.roomUrl]);

		return (
			<div style={{
				pointerEvents: 'all',
				width: `${shape.props.w}px`,
				height: `${shape.props.h}px`,
				position: 'absolute',
				top: '10px',
				left: '10px',
				zIndex: 9999,
				padding: '15px',
				backgroundColor: '#F0F0F0',
				boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
				borderRadius: '4px',
			}}>
				{!isInRoom ? (
					<button
						onClick={() => setIsInRoom(true)}
						className="bg-blue-500 text-white px-4 py-2 rounded"
					>
						Join Room
					</button>
				) : (
					<div id="daily-call-iframe-container" style={{
						width: '100%',
						height: '100%'
					}} />
				)}
				{error && <p className="text-red-500 mt-2">{error}</p>}
			</div>
		);
	}
}
