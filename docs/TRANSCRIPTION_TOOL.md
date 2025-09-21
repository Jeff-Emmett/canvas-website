# Transcription Tool for Canvas

The Transcription Tool is a powerful feature that allows you to transcribe audio from participants in your Canvas sessions using the Web Speech API. This tool provides real-time speech-to-text conversion, making it easy to capture and document conversations, presentations, and discussions.

## Features

### 🎤 Real-time Transcription
- Live speech-to-text conversion using the Web Speech API
- Support for multiple languages including English, Spanish, French, German, and more
- Continuous recording with interim and final results

### 🌐 Multi-language Support
- **English (US/UK)**: Primary language support
- **European Languages**: Spanish, French, German, Italian, Portuguese
- **Asian Languages**: Japanese, Korean, Chinese (Simplified)
- Easy language switching during recording sessions

### 👥 Participant Management
- Automatic participant detection and tracking
- Individual transcript tracking for each speaker
- Visual indicators for speaking status

### 📝 Transcript Management
- Real-time transcript display with auto-scroll
- Clear transcript functionality
- Download transcripts as text files
- Persistent storage within the Canvas session

### ⚙️ Advanced Controls
- Auto-scroll toggle for better reading experience
- Recording start/stop controls
- Error handling and status indicators
- Microphone permission management

## How to Use

### 1. Adding the Tool to Your Canvas

1. In your Canvas session, look for the **Transcribe** tool in the toolbar
2. Click on the Transcribe tool icon
3. Click and drag on the canvas to create a transcription widget
4. The widget will appear with default dimensions (400x300 pixels)

### 2. Starting a Recording Session

1. **Select Language**: Choose your preferred language from the dropdown menu
2. **Enable Auto-scroll**: Check the auto-scroll checkbox for automatic scrolling
3. **Start Recording**: Click the "🎤 Start Recording" button
4. **Grant Permissions**: Allow microphone access when prompted by your browser

### 3. During Recording

- **Live Transcription**: See real-time text as people speak
- **Participant Tracking**: Monitor who is speaking
- **Status Indicators**: Red dot shows active recording
- **Auto-scroll**: Transcript automatically scrolls to show latest content

### 4. Managing Your Transcript

- **Stop Recording**: Click "⏹️ Stop Recording" to end the session
- **Clear Transcript**: Use "🗑️ Clear" to reset the transcript
- **Download**: Click "💾 Download" to save as a text file

## Browser Compatibility

### ✅ Supported Browsers
- **Chrome/Chromium**: Full support with `webkitSpeechRecognition`
- **Edge (Chromium)**: Full support
- **Safari**: Limited support (may require additional setup)

### ❌ Unsupported Browsers
- **Firefox**: No native support for Web Speech API
- **Internet Explorer**: No support

### 🔧 Recommended Setup
For the best experience, use **Chrome** or **Chromium-based browsers** with:
- Microphone access enabled
- HTTPS connection (required for microphone access)
- Stable internet connection

## Technical Details

### Web Speech API Integration
The tool uses the Web Speech API's `SpeechRecognition` interface:
- **Continuous Mode**: Enables ongoing transcription
- **Interim Results**: Shows partial results in real-time
- **Language Detection**: Automatically adjusts to selected language
- **Error Handling**: Graceful fallback for unsupported features

### Audio Processing
- **Microphone Access**: Secure microphone permission handling
- **Audio Stream Management**: Proper cleanup of audio resources
- **Quality Optimization**: Optimized for voice recognition

### Data Persistence
- **Session Storage**: Transcripts persist during the Canvas session
- **Shape Properties**: All settings and data stored in the Canvas shape
- **Real-time Updates**: Changes sync across all participants

## Troubleshooting

### Common Issues

#### "Speech recognition not supported in this browser"
- **Solution**: Use Chrome or a Chromium-based browser
- **Alternative**: Check if you're using the latest browser version

#### "Unable to access microphone"
- **Solution**: Check browser permissions for microphone access
- **Alternative**: Ensure you're on an HTTPS connection

#### Poor transcription quality
- **Solutions**:
  - Speak clearly and at a moderate pace
  - Reduce background noise
  - Ensure good microphone positioning
  - Check internet connection stability

#### Language not working correctly
- **Solution**: Verify the selected language matches the spoken language
- **Alternative**: Try restarting the recording session

### Performance Tips

1. **Close unnecessary tabs** to free up system resources
2. **Use a good quality microphone** for better accuracy
3. **Minimize background noise** in your environment
4. **Speak at a natural pace** - not too fast or slow
5. **Ensure stable internet connection** for optimal performance

## Future Enhancements

### Planned Features
- **Speaker Identification**: Advanced voice recognition for multiple speakers
- **Export Formats**: Support for PDF, Word, and other document formats
- **Real-time Translation**: Multi-language translation capabilities
- **Voice Commands**: Canvas control through voice commands
- **Cloud Storage**: Automatic transcript backup and sharing

### Integration Possibilities
- **Daily.co Integration**: Enhanced participant detection from video sessions
- **AI Enhancement**: Improved accuracy using machine learning
- **Collaborative Editing**: Real-time transcript editing by multiple users
- **Search and Indexing**: Full-text search within transcripts

## Support and Feedback

If you encounter issues or have suggestions for improvements:

1. **Check Browser Compatibility**: Ensure you're using a supported browser
2. **Review Permissions**: Verify microphone access is granted
3. **Check Network**: Ensure stable internet connection
4. **Report Issues**: Contact the development team with detailed error information

## Privacy and Security

### Data Handling
- **Local Processing**: Speech recognition happens locally in your browser
- **No Cloud Storage**: Transcripts are not automatically uploaded to external services
- **Session Privacy**: Data is only shared within your Canvas session
- **User Control**: You control when and what to record

### Best Practices
- **Inform Participants**: Let others know when recording
- **Respect Privacy**: Don't record sensitive or confidential information
- **Secure Sharing**: Be careful when sharing transcript files
- **Regular Cleanup**: Clear transcripts when no longer needed

---

*The Transcription Tool is designed to enhance collaboration and documentation in Canvas sessions. Use it responsibly and respect the privacy of all participants.*
