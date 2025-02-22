import type { Environment } from './types';

interface RecordingPayload {
  recordingUrl: string;
  roomName: string;
  recordingId: string;
}

export class RecordingProcessor {
  async fetch(request: Request, env: Environment) {
    const payload = await request.json() as RecordingPayload;
    const { recordingUrl, roomName, recordingId } = payload;

    // Step 1: Download the recording
    const response = await fetch(recordingUrl, {
      headers: {
        'Authorization': `Bearer ${env.DAILY_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.statusText}`);
    }

    const downloadResult = await response.arrayBuffer();

    // Step 2: Upload to R2
    const bucket = env.TLDRAW_BUCKET;
    const key = `uploads/recordings/${roomName}/${recordingId}.mp4`;

    await bucket.put(key, downloadResult, {
      httpMetadata: {
        contentType: 'video/mp4',
      }
    });

    return new Response(JSON.stringify({
      status: "success",
      location: key
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 