# Fathom API Integration for tldraw Canvas

This integration allows you to import Fathom meeting transcripts directly into your tldraw canvas at jeffemmett.com/board/test.

## Features

- 🎥 **Import Fathom Meetings**: Browse and import your Fathom meeting recordings
- 📝 **Rich Transcript Display**: View full transcripts with speaker identification and timestamps
- ✅ **Action Items**: See extracted action items from meetings
- 📋 **AI Summaries**: Display AI-generated meeting summaries
- 🔗 **Direct Links**: Click to view meetings in Fathom
- 🎨 **Customizable Display**: Toggle between compact and expanded views

## Setup Instructions

### 1. Get Your Fathom API Key

1. Go to your [Fathom User Settings](https://app.usefathom.com/settings/integrations)
2. Navigate to the "Integrations" section
3. Generate an API key
4. Copy the API key for use in the canvas

### 2. Using the Integration

1. **Open the Canvas**: Navigate to `jeffemmett.com/board/test`
2. **Access Fathom Meetings**: Click the "Fathom Meetings" button in the toolbar (calendar icon)
3. **Enter API Key**: When prompted, enter your Fathom API key
4. **Browse Meetings**: The panel will load your recent Fathom meetings
5. **Add to Canvas**: Click "Add to Canvas" on any meeting to create a transcript shape

### 3. Customizing Transcript Shapes

Once added to the canvas, you can:

- **Toggle Transcript View**: Click the "📝 Transcript" button to show/hide the full transcript
- **Toggle Action Items**: Click the "✅ Actions" button to show/hide action items
- **Expand/Collapse**: Click the "📄 Expanded/Compact" button to change the view
- **Resize**: Drag the corners to resize the shape
- **Move**: Click and drag to reposition the shape

## API Endpoints

The integration includes these backend endpoints:

- `GET /api/fathom/meetings` - List all meetings
- `GET /api/fathom/meetings/:id` - Get specific meeting details
- `POST /api/fathom/webhook` - Receive webhook notifications (for future real-time updates)

## Webhook Setup (Optional)

For real-time updates when new meetings are recorded:

1. **Get Webhook URL**: Your webhook endpoint is `https://jeffemmett-canvas.jeffemmett.workers.dev/api/fathom/webhook`
2. **Configure in Fathom**: Add this URL in your Fathom webhook settings
3. **Enable Notifications**: Turn on webhook notifications for new meetings

## Data Structure

The Fathom transcript shape includes:

```typescript
{
  meetingId: string
  meetingTitle: string
  meetingUrl: string
  summary: string
  transcript: Array<{
    speaker: string
    text: string
    timestamp: string
  }>
  actionItems: Array<{
    text: string
    assignee?: string
    dueDate?: string
  }>
}
```

## Troubleshooting

### Common Issues

1. **"No API key provided"**: Make sure you've entered your Fathom API key correctly
2. **"Failed to fetch meetings"**: Check that your API key is valid and has the correct permissions
3. **Empty transcript**: Some meetings may not have transcripts if they were recorded without transcription enabled

### Getting Help

- Check the browser console for error messages
- Verify your Fathom API key is correct
- Ensure you have recorded meetings in Fathom
- Contact support if issues persist

## Security Notes

- API keys are stored locally in your browser
- Webhook endpoints are currently not signature-verified (TODO for production)
- All data is processed client-side for privacy

## Future Enhancements

- [ ] Real-time webhook notifications
- [ ] Search and filter meetings
- [ ] Export transcript data
- [ ] Integration with other meeting tools
- [ ] Advanced transcript formatting options






























