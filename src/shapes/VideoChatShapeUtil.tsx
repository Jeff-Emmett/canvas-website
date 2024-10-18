import { BaseBoxShapeUtil, TLBaseShape } from "tldraw";
import { useEffect, useState } from "react";

const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

export type IVideoChatShape = TLBaseShape<
	'VideoChat',
	{
		w: number;
		h: number;
		roomUrl: string | null;
		userName: string;
	}
>;

const WHEREBY_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmFwcGVhci5pbiIsImF1ZCI6Imh0dHBzOi8vYXBpLmFwcGVhci5pbi92MSIsImV4cCI6OTAwNzE5OTI1NDc0MDk5MSwiaWF0IjoxNzI5MTkzOTE3LCJvcmdhbml6YXRpb25JZCI6MjY2MDk5LCJqdGkiOiI0MzI0MmUxMC1kZmRjLTRhYmEtYjlhOS01ZjcwNTFlMTYwZjAifQ.RaxXpZKYl_dOWyoATQZrzyMR2XRh3fHf02mALQiuTTs'; // Replace with your actual API key
const ROOM_PREFIX = 'test'

export class VideoChatShape extends BaseBoxShapeUtil<IVideoChatShape> {
	static override type = 'VideoChat';

	getDefaultProps(): IVideoChatShape['props'] {
		return {
			roomUrl: null,
			w: 640,
			h: 480,
			userName: ''
		};
	}

	indicator(shape: IVideoChatShape) {
		return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />;
	}

	async ensureRoomExists(shape: IVideoChatShape) {

		console.log('This is your roomUrl 1:', shape.props.roomUrl);

		if (shape.props.roomUrl !== null) {
			return;
		}

		const expiryDate = new Date(Date.now() + 1000 * 24 * 60 * 60 * 1000);

		const response = await fetch(`${CORS_PROXY}https://api.whereby.dev/v1/meetings`, {
			method: 'POST',
			headers: {
				// 'Access-Control-Allow-Origin': 'https://jeffemmett.com/',
				'Authorization': `Bearer ${WHEREBY_API_KEY}`,
				'Content-Type': 'application/json',
				'X-Requested-With': 'XMLHttpRequest', // Required by some CORS proxies
			},
			body: JSON.stringify({
				isLocked: false,
				roomNamePrefix: ROOM_PREFIX,
				roomMode: 'normal',
				endDate: expiryDate.toISOString(),
				fields: ['hostRoomUrl'],
			}),
		}).catch((error) => {
			console.error('Failed to create meeting:', error);
			throw error;
		});

		console.log('This is your response:', response);

		console.log('This is your roomUrl 2:', shape.props.roomUrl);

		if (!response.ok) {
			const errorData = await response.json();
			console.error('Whereby API error:', errorData);
			throw new Error(`Whereby API error: ${(errorData as any).message || 'Unknown error'}`);
		}

		const data = await response.json();
		const roomUrl = (data as any).roomUrl;

		console.log('This is your roomUrl 3:', roomUrl);

		this.editor.updateShape<IVideoChatShape>({
			id: shape.id,
			type: 'VideoChat',
			props: {
				...shape.props,
				roomUrl
			}
		})


	}

	component(shape: IVideoChatShape) {
		const [roomUrl, setRoomUrl] = useState(""); // Added roomUrl state
		const [isInRoom, setIsInRoom] = useState(false);
		const [error, setError] = useState("");
		const [isLoading, setIsLoading] = useState(false);

		// Automatically show the button on load
		useEffect(() => {
			joinRoom();
		}, []);

		const joinRoom = async () => {
			this.ensureRoomExists(shape);
			setError("");
			setIsLoading(true);
			try {
				const response = await fetch(`${CORS_PROXY}https://api.whereby.dev/v1/meetings`, {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${WHEREBY_API_KEY}`,
						'Content-Type': 'application/json',
						'X-Requested-With': 'XMLHttpRequest', // Required by some CORS proxies
					},
					body: JSON.stringify({
						isLocked: false,
						roomNamePrefix: ROOM_PREFIX,
						roomMode: 'normal',
						endDate: new Date(Date.now() + 1000 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
						fields: ['hostRoomUrl'],
					}),
				});

				if (!response.ok) {
					const errorData: { message?: string } = await response.json(); // Explicitly type errorData
					console.error('Whereby API error:', errorData);
					throw new Error(`Whereby API error: ${errorData.message || 'Unknown error'}`);
				}

				const data: { roomUrl: string } = await response.json(); // Explicitly type the response
				setRoomUrl(data.roomUrl); // Set the room URL
				setIsInRoom(true);
			} catch (e) {
				console.error("Error joining room:", e);
				setError("An error occurred. Please try again.");
			}
			setIsLoading(false);
		};

		const leaveRoom = () => {
			setIsInRoom(false);
			setRoomUrl(""); // Clear the room URL
		};



		return (
			<div className="p-4" style={{ pointerEvents: 'all' }}>
				<h1 className="text-2xl font-bold mb-4">Whereby Video Chat Room</h1>
				{isLoading ? (
					<p>Joining room...</p>
				) : isInRoom ? (
					<div className="mb-4">
						<button onClick={leaveRoom} className="bg-red-500 text-white px-4 py-2 rounded mb-4">
							Leave Room
						</button>
						<div className="aspect-w-16 aspect-h-9">
							<iframe
								src={`${roomUrl}?embed&iframeSource=val.town&background=off&logo=off&chat=off&screenshare=on&people=on`}
								allow="camera; microphone; fullscreen; speaker; display-capture"
								className="w-full h-full"
							></iframe>
						</div>
					</div>
				) : (
					<div>
						<button onClick={joinRoom} className="bg-blue-500 text-white px-4 py-2 rounded">
							Join Room
						</button>
						{error && <p className="text-red-500 mt-2">{error}</p>}
					</div>
				)}
				<p className="mt-4 text-sm text-gray-600">
					View source: <a href={import.meta.url.replace("esm.town", "val.town")} className="text-blue-500 hover:underline">Val Town</a>
				</p>
			</div>
		);
	}
}
