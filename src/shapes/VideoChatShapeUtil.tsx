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

	component() {
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
				const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmFwcGVhci5pbiIsImF1ZCI6Imh0dHBzOi8vYXBpLmFwcGVhci5pbi92MSIsImV4cCI6OTAwNzE5OTI1NDc0MDk5MSwiaWF0IjoxNzI5MTkzOTE3LCJvcmdhbml6YXRpb25JZCI6MjY2MDk5LCJqdGkiOiI0MzI0MmUxMC1kZmRjLTRhYmEtYjlhOS01ZjcwNTFlMTYwZjAifQ.RaxXpZKYl_dOWyoATQZrzyMR2XRh3fHf02mALQiuTTs'; // Replace with your actual API key
				console.log(apiKey)
				// Generate a room name based on a default slug or any logic you prefer
				const roomNamePrefix = 'default-room'; // You can modify this logic as needed

				const response = await fetch('https://cors-anywhere.herokuapp.com/https://api.whereby.dev/v1/meetings', {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						isLocked: false,
						roomNamePrefix: roomNamePrefix,
						roomMode: 'normal',
						endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
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
