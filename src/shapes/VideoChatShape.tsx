import { BaseBoxShapeUtil, TLBaseShape } from "tldraw";
import React, { useEffect, useState } from "react"; // Updated import for React

export type IVideoChatShape = TLBaseShape<
	'videoChat',
	{
		w: number;
		h: number;
		roomUrl: string; // Changed from roomId to roomUrl for Whereby
		userName: string;
	}
>;

export class VideoChatShape extends BaseBoxShapeUtil <IVideoChatShape> {
	static override type = 'videoChat';

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
		return <VideoChat roomUrl={shape.props.roomUrl} />;
	}
}

interface VideoChatProps {
    roomUrl: string;
    // Remove width and height as they are not used
    // width: number; 
    // height: number; 
    // Remove userName as it is not used
    // userName: string; 
}

// VideoChat component using Whereby
export const VideoChat: React.FC<VideoChatProps> = () => { // Removed roomUrl from props
	// Remove unused destructured props
	// const [roomUrl, setRoomUrl] = useState(initialRoomUrl); // Use initialRoomUrl to avoid duplicate identifier
	// const [roomUrl, setRoomUrl] = useState(roomId); // Use roomId instead
	const [isInRoom, setIsInRoom] = useState(false);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	// Automatically show the button on load
	useEffect(() => {
		joinRoom();
	}, []);

	const joinRoom = async () => {
		setError("");
		setIsLoading(true);
		try {
			const response = await fetch('/api/get-or-create-room', { method: 'GET' });
			const data: { roomUrl?: string; error?: string } = await response.json(); // Explicitly type 'data'
			if (data.roomUrl) {
				// setRoomUrl(data.roomUrl); // Remove this line
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
		// setRoomUrl(""); // Remove this line
	};

	return (
		<div>
			{!isInRoom && ( // Show button if not in room
				<button onClick={() => setIsInRoom(true)} className="bg-green-500 text-white px-4 py-2 rounded">
					Join Video Chat
				</button>
			)}
			{/* Render Video Chat UI here when isInRoom is true */}
			{isInRoom && <div>Video Chat UI goes here</div>}
		</div>
	);
}