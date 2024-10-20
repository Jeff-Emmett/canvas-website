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

		if (shape.props.roomUrl !== null) {
			return;
		}

		const expiryDate = new Date(Date.now() + 1000 * 24 * 60 * 60 * 1000);

		const response = await fetch(`${CORS_PROXY}https://api.whereby.dev/v1/meetings`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${WHEREBY_API_KEY}`,
				'Content-Type': 'application/json',
				'X-Requested-With': 'XMLHttpRequest', // Required by some CORS proxies
			},
			body: JSON.stringify({
				isLocked: false,
				roomMode: 'normal',
				endDate: expiryDate.toISOString(),
				fields: ['hostRoomUrl'],
			}),
		}).catch((error) => {
			console.error('Failed to create meeting:', error);
			throw error;
		});

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
		const [isInRoom, setIsInRoom] = useState(false);
		const [error, setError] = useState("");
		const [isLoading, setIsLoading] = useState(false);

		useEffect(() => {
			// Load the Whereby SDK only in the browser
			if (typeof window !== 'undefined') {
				import("@whereby.com/browser-sdk/embed").then(() => {
					joinRoom();
				}).catch(err => {
					console.error("Error loading Whereby SDK:", err);
					setError("Failed to load video chat component.");
				});
			}
		}, []);

		const joinRoom = async () => {
			setError("");
			setIsLoading(true);
			try {
				await this.ensureRoomExists(shape);
				setIsInRoom(true);
			} catch (e) {
				console.error("Error joining room:", e);
				setError("An error occurred. Please try again.");
			}
			setIsLoading(false);
		};

		const leaveRoom = () => {
			setIsInRoom(false);
			// setRoomUrl(""); // Clear the room URL
		};

		return (
			<div style={{
				pointerEvents: 'all',
				width: `${shape.props.w}px`,
				height: `${shape.props.h}px`,
				position: 'absolute',
				top: '10px',
				left: '10px',
				zIndex: 9999,
				padding: '15px', // Increased padding by 5px
				margin: 0,
				backgroundColor: '#F0F0F0', // Light gray background
				boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', // Added drop shadow
				borderRadius: '4px', // Slight border radius for softer look
			}}>
				<div style={{
					width: '100%',
					height: '100%',
					border: '1px solid #D3D3D3',
					backgroundColor: '#FFFFFF',
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					overflow: 'hidden',
				}}>
					{isLoading ? (
						<p>Joining room...</p>
					) : isInRoom && shape.props.roomUrl && typeof window !== 'undefined' ? (
						<div className="mb-4" style={{ width: '100%', height: '100%', objectFit: 'contain' }}>
							<whereby-embed
								room={shape.props.roomUrl}
								background="off"
								logo="off"
								chat="off"
								screenshare="on"
								people="on"
								style={{ width: '100%', height: '100%', objectFit: 'cover' }}
							></whereby-embed>
						</div>
					) : (
						<div>
							<button onClick={joinRoom} className="bg-blue-500 text-white px-4 py-2 rounded">
								Join Room
							</button>
							{error && <p className="text-red-500 mt-2">{error}</p>}
						</div>
					)}
				</div>
			</div>
		);
	}
}
