import { io, Socket } from 'socket.io-client';

export const wsConfig = {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
};

class WebSocketManager {
    private socket: Socket | null = null;
    private retryCount = 0;

    connect(url: string) {
        this.socket = io(url, wsConfig);

        this.socket.on('connect', () => {
            console.log('WebSocket connected');
            this.retryCount = 0;
        });

        this.socket.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.handleRetry();
        });

        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            this.handleRetry();
        });
    }

    private handleRetry() {
        if (this.retryCount < wsConfig.reconnectionAttempts) {
            this.retryCount++;
            setTimeout(() => {
                console.log(`Attempting reconnection ${this.retryCount}/${wsConfig.reconnectionAttempts}`);
                this.socket?.connect();
            }, wsConfig.reconnectionDelay);
        }
    }

    // Add methods to send/receive messages
    send(event: string, data: any) {
        this.socket?.emit(event, data);
    }

    subscribe(event: string, callback: (data: any) => void) {
        this.socket?.on(event, callback);
    }
}

export const webSocketManager = new WebSocketManager();