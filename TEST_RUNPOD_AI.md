# Testing RunPod AI Integration

This guide explains how to test the RunPod AI API integration in development.

## Quick Setup

1. **Add RunPod environment variables to `.env.local`:**

```bash
# Add these lines to your .env.local file
VITE_RUNPOD_API_KEY=your_runpod_api_key_here
VITE_RUNPOD_ENDPOINT_ID=your_endpoint_id_here
```

**Important:** Replace `your_runpod_api_key_here` and `your_endpoint_id_here` with your actual RunPod credentials.

2. **Get your RunPod credentials:**
   - **API Key**: Go to [RunPod Settings](https://www.runpod.io/console/user/settings) → API Keys section
   - **Endpoint ID**: Go to [RunPod Serverless Endpoints](https://www.runpod.io/console/serverless) → Find your endpoint → Copy the ID from the URL
     - Example: If URL is `https://api.runpod.ai/v2/jqd16o7stu29vq/run`, then `jqd16o7stu29vq` is your endpoint ID

3. **Restart the dev server:**
   ```bash
   npm run dev
   ```

## Testing the Integration

### Method 1: Using Prompt Shapes
1. Open the canvas website in your browser
2. Select the **Prompt** tool from the toolbar (or press the keyboard shortcut)
3. Click on the canvas to create a prompt shape
4. Type a prompt like "Write a hello world program in Python"
5. Press Enter or click the send button
6. The AI response should appear in the prompt shape

### Method 2: Using Arrow LLM Action
1. Create an arrow shape pointing from one shape to another
2. Add text to the arrow (this becomes the prompt)
3. Select the arrow
4. Press **Alt+G** (or use the action menu)
5. The AI will process the prompt and fill the target shape with the response

### Method 3: Using Command Palette
1. Press **Cmd+J** (Mac) or **Ctrl+J** (Windows/Linux) to open the LLM view
2. Type your prompt
3. Press Enter
4. The response should appear

## Verifying RunPod is Being Used

1. **Open browser console** (F12 or Cmd+Option+I)
2. Look for these log messages:
   - `🔑 Found RunPod configuration from environment variables - using as primary AI provider`
   - `🔍 Found X available AI providers: runpod (default)`
   - `🔄 Attempting to use runpod API (default)...`

3. **Check Network tab:**
   - Look for requests to `https://api.runpod.ai/v2/{endpointId}/run`
   - The request should have `Authorization: Bearer {your_api_key}` header

## Expected Behavior

- **With RunPod configured**: RunPod will be used FIRST (priority over user API keys)
- **Without RunPod**: System will fall back to user-configured API keys (OpenAI, Anthropic, etc.)
- **If both fail**: You'll see an error message

## Troubleshooting

### "No valid API key found for any provider"
- Check that `.env.local` has the correct variable names (`VITE_RUNPOD_API_KEY` and `VITE_RUNPOD_ENDPOINT_ID`)
- Restart the dev server after adding environment variables
- Check browser console for detailed error messages

### "RunPod API error: 401"
- Verify your API key is correct
- Check that your API key hasn't expired
- Ensure you're using the correct API key format

### "RunPod API error: 404"
- Verify your endpoint ID is correct
- Check that your endpoint is active in RunPod console
- Ensure the endpoint URL format matches: `https://api.runpod.ai/v2/{ENDPOINT_ID}/run`

### RunPod not being used
- Check browser console for `🔑 Found RunPod configuration` message
- Verify environment variables are loaded (check `import.meta.env.VITE_RUNPOD_API_KEY` in console)
- Make sure you restarted the dev server after adding environment variables

## Testing Different Scenarios

### Test 1: RunPod Only (No User Keys)
1. Remove or clear any user API keys from localStorage
2. Set RunPod environment variables
3. Run an AI command
4. Should use RunPod automatically

### Test 2: RunPod Priority (With User Keys)
1. Set RunPod environment variables
2. Also configure user API keys in settings
3. Run an AI command
4. Should use RunPod FIRST, then fall back to user keys if RunPod fails

### Test 3: Fallback Behavior
1. Set RunPod environment variables with invalid credentials
2. Configure valid user API keys
3. Run an AI command
4. Should try RunPod first, fail, then use user keys

## API Request Format

The integration sends requests in this format:

```json
{
  "input": {
    "prompt": "Your prompt text here"
  }
}
```

The system prompt and user prompt are combined into a single prompt string.

## Response Handling

The integration handles multiple response formats:
- Direct text response: `{ "output": "text" }`
- Object with text: `{ "output": { "text": "..." } }`
- Object with response: `{ "output": { "response": "..." } }`
- Async jobs: Polls until completion

## Next Steps

Once testing is successful:
1. Verify RunPod responses are working correctly
2. Test with different prompt types
3. Monitor RunPod usage and costs
4. Consider adding rate limiting if needed

