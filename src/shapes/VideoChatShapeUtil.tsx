import { BaseBoxShapeUtil, TLBaseShape } from "tldraw";
import { useEffect, useState } from "react";

export type IVideoChatShape = TLBaseShape<
	'VideoChat',
	{
		w: number;
		h: number;
		roomUrl: string; // Changed from roomId to roomUrl for Whereby
		userName: string;
	}
>;

export class VideoChatShape extends BaseBoxShapeUtil<IVideoChatShape> {
	static override type = 'VideoChat';

	getDefaultProps(): IVideoChatShape['props'] {
		return {
			roomUrl: 'https://whereby.com/default-room', // Default Whereby room URL
			w: 640,
			h: 480,
			userName: ''
		};
	}

	indicator(shape: IVideoChatShape) {
		return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />;
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
			console.log("HI IM A CONSOLE TEST")
			setError("");
			setIsLoading(true);
			try {
				const response = await fetch('/api/get-or-create-room', { method: 'GET' });
				const data: { roomUrl?: string; error?: string } = await response.json(); // Explicitly type 'data'
				if (data.roomUrl) {
					setRoomUrl(data.roomUrl); // Set the room URL
					setIsInRoom(true);
				} else {
					setError(data.error || "Failed to join room. Please try again.");
				}
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
