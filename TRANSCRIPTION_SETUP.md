# Transcription Setup Guide

## Why the Start Button Doesn't Work

The transcription start button is likely disabled because the **OpenAI API key is not configured**. The button will be disabled and show a tooltip "OpenAI API key not configured - Please set your API key in settings" when this is the case.

## How to Fix It

### Step 1: Get an OpenAI API Key
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Sign in to your OpenAI account
3. Click "Create new secret key"
4. Copy the API key (it starts with `sk-`)

### Step 2: Configure the API Key in Canvas
1. In your Canvas application, look for the **Settings** button (usually a gear icon)
2. Open the settings dialog
3. Find the **OpenAI API Key** field
4. Paste your API key
5. Save the settings

### Step 3: Test the Transcription
1. Create a transcription shape on the canvas
2. Click the "Start" button
3. Allow microphone access when prompted
4. Start speaking - you should see the transcription appear in real-time

## Debugging Information

The application now includes debug logging to help identify issues:

- **Console Logs**: Check the browser console for messages starting with `🔧 OpenAI Config Debug:`
- **Visual Indicators**: The transcription window will show "(API Key Required)" if not configured
- **Button State**: The start button will be disabled and grayed out if the API key is missing

## Troubleshooting

### Button Still Disabled After Adding API Key
1. Refresh the page to reload the configuration
2. Check the browser console for any error messages
3. Verify the API key is correctly saved in settings

### Microphone Permission Issues
1. Make sure you've granted microphone access to the browser
2. Check that your microphone is working in other applications
3. Try refreshing the page and granting permission again

### No Audio Being Recorded
1. Check the browser console for audio-related error messages
2. Verify your microphone is not being used by another application
3. Try using a different browser if issues persist

## Technical Details

The transcription system:
- Uses the device microphone directly (not Daily room audio)
- Records audio in WebM format
- Sends audio chunks to OpenAI's Whisper API
- Updates the transcription shape in real-time
- Requires a valid OpenAI API key to function
