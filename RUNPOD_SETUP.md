# RunPod WhisperX Integration Setup

This guide explains how to set up and use the RunPod WhisperX endpoint for transcription in the canvas website.

## Overview

The transcription system can now use a hosted WhisperX endpoint on RunPod instead of running the Whisper model locally in the browser. This provides:
- Better accuracy with WhisperX's advanced features
- Faster processing (no model download needed)
- Reduced client-side resource usage
- Support for longer audio files

## Prerequisites

1. A RunPod account with an active WhisperX endpoint
2. Your RunPod API key
3. Your RunPod endpoint ID

## Configuration

### Environment Variables

Add the following environment variables to your `.env.local` file (or your deployment environment):

```bash
# RunPod Configuration
VITE_RUNPOD_API_KEY=your_runpod_api_key_here
VITE_RUNPOD_ENDPOINT_ID=your_endpoint_id_here
```

Or if using Next.js:

```bash
NEXT_PUBLIC_RUNPOD_API_KEY=your_runpod_api_key_here
NEXT_PUBLIC_RUNPOD_ENDPOINT_ID=your_endpoint_id_here
```

### Getting Your RunPod Credentials

1. **API Key**: 
   - Go to [RunPod Settings](https://www.runpod.io/console/user/settings)
   - Navigate to API Keys section
   - Create a new API key or copy an existing one

2. **Endpoint ID**:
   - Go to [RunPod Serverless Endpoints](https://www.runpod.io/console/serverless)
   - Find your WhisperX endpoint
   - Copy the endpoint ID from the URL or endpoint details
   - Example: If your endpoint URL is `https://api.runpod.ai/v2/lrtisuv8ixbtub/run`, then `lrtisuv8ixbtub` is your endpoint ID

## Usage

### Automatic Detection

The transcription hook automatically detects if RunPod is configured and uses it instead of the local Whisper model. No code changes are needed!

### Manual Override

If you want to explicitly control which transcription method to use:

```typescript
import { useWhisperTranscription } from '@/hooks/useWhisperTranscriptionSimple'

const {
  isRecording,
  transcript,
  startRecording,
  stopRecording
} = useWhisperTranscription({
  useRunPod: true, // Force RunPod usage
  language: 'en',
  onTranscriptUpdate: (text) => {
    console.log('New transcript:', text)
  }
})
```

Or to force local model:

```typescript
useWhisperTranscription({
  useRunPod: false, // Force local Whisper model
  // ... other options
})
```

## API Format

The integration sends audio data to your RunPod endpoint in the following format:

```json
{
  "input": {
    "audio": "base64_encoded_audio_data",
    "audio_format": "audio/wav",
    "language": "en",
    "task": "transcribe"
  }
}
```

### Expected Response Format

The endpoint should return one of these formats:

**Direct Response:**
```json
{
  "output": {
    "text": "Transcribed text here"
  }
}
```

**Or with segments:**
```json
{
  "output": {
    "segments": [
      {
        "start": 0.0,
        "end": 2.5,
        "text": "Transcribed text here"
      }
    ]
  }
}
```

**Async Job Pattern:**
```json
{
  "id": "job-id-123",
  "status": "IN_QUEUE"
}
```

The integration automatically handles async jobs by polling the status endpoint until completion.

## Customizing the API Request

If your WhisperX endpoint expects a different request format, you can modify `src/lib/runpodApi.ts`:

```typescript
// In transcribeWithRunPod function
const requestBody = {
  input: {
    // Adjust these fields based on your endpoint
    audio: audioBase64,
    // Add or modify fields as needed
  }
}
```

## Troubleshooting

### "RunPod API key or endpoint ID not configured"

- Ensure environment variables are set correctly
- Restart your development server after adding environment variables
- Check that variable names match exactly (case-sensitive)

### "RunPod API error: 401"

- Verify your API key is correct
- Check that your API key has not expired
- Ensure you're using the correct API key format

### "RunPod API error: 404"

- Verify your endpoint ID is correct
- Check that your endpoint is active in the RunPod console
- Ensure the endpoint URL format matches: `https://api.runpod.ai/v2/{ENDPOINT_ID}/run`

### "No transcription text found in RunPod response"

- Check your endpoint's response format matches the expected format
- Verify your WhisperX endpoint is configured correctly
- Check the browser console for detailed error messages

### "Failed to return job results" (400 Bad Request)

This error occurs on the **server side** when your WhisperX endpoint tries to return results. This typically means:

1. **Response format mismatch**: Your endpoint's response doesn't match RunPod's expected format
   - Ensure your endpoint returns: `{"output": {"text": "..."}}` or `{"output": {"segments": [...]}}`
   - The response must be valid JSON
   - Check your endpoint handler code to ensure it's returning the correct structure

2. **Response size limits**: The response might be too large
   - Try with shorter audio files first
   - Check RunPod's response size limits

3. **Timeout issues**: The endpoint might be taking too long to process
   - Check your endpoint logs for processing time
   - Consider optimizing your WhisperX model configuration

4. **Check endpoint handler**: Review your WhisperX endpoint's `handler.py` or equivalent:
   ```python
   # Example correct format
   def handler(event):
       # ... process audio ...
       return {
           "output": {
               "text": transcription_text
           }
       }
   ```

### Transcription not working

- Check browser console for errors
- Verify your endpoint is active and responding
- Test your endpoint directly using curl or Postman
- Ensure audio format is supported (WAV format is recommended)
- Check RunPod endpoint logs for server-side errors

## Testing Your Endpoint

You can test your RunPod endpoint directly:

```bash
curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "input": {
      "audio": "base64_audio_data_here",
      "audio_format": "audio/wav",
      "language": "en"
    }
  }'
```

## Fallback Behavior

If RunPod is not configured or fails, the system will:
1. Try to use RunPod if configured
2. Fall back to local Whisper model if RunPod fails or is not configured
3. Show error messages if both methods fail

## Performance Considerations

- **RunPod**: Better for longer audio files and higher accuracy, but requires network connection
- **Local Model**: Works offline, but requires model download and uses more client resources

## Support

For issues specific to:
- **RunPod API**: Check [RunPod Documentation](https://docs.runpod.io)
- **WhisperX**: Check your WhisperX endpoint configuration
- **Integration**: Check browser console for detailed error messages



