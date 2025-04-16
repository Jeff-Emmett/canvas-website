# Jeff Emmett's Website

This is a collaborative canvas-based website built with React, TLDraw, and Cloudflare Workers.

## Features

- Interactive canvas with custom shapes and tools
- Real-time collaboration
- Markdown editing
- Video chat integration with Daily.co
- AI-powered text generation
- Responsive design

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm (comes with Node.js)
- A Cloudflare account (for deploying the worker)
- Daily.co API key (for video chat functionality)
- OpenAI or Anthropic API key (for AI features)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/jeffemmett.git
   cd jeffemmett
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment files:

   Create a `.env.development` file in the root directory:
   ```
   VITE_TLDRAW_WORKER_URL=http://localhost:5172
   VITE_DAILY_API_KEY=your_daily_api_key
   ```

   For production, create a `.env.production` file:
   ```
   VITE_TLDRAW_WORKER_URL=https://api.yourdomain.com
   VITE_DAILY_API_KEY=your_daily_api_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   This will start both the client (on port 5173) and the worker (on port 5172).

5. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

## Development

The project uses a dual-server architecture:

- **Client**: A Vite-powered React application (port 5173)
- **Worker**: A Cloudflare Worker for handling real-time collaboration and asset storage (port 5172)

### Project Structure

- `/src` - Frontend React application
  - `/routes` - React Router routes
  - `/shapes` - Custom TLDraw shape definitions
  - `/tools` - Custom TLDraw tool definitions
  - `/ui` - UI components
  - `/lib` - Utility libraries
- `/worker` - Cloudflare Worker code
- `/public` - Static assets

### Adding API Keys

To use AI features, you'll need to add your API keys:

1. Open the application in your browser
2. Click on the settings icon in the toolbar
3. Enter your OpenAI API key
4. Click "Close" to save

## Deployment

### Deploying the Client

The client is deployed using Vercel:

```bash
npm run deploy:dev   # Deploy to development
npm run deploy:prod  # Deploy to production
```

### Deploying the Worker

The worker is deployed using Wrangler:

```bash
npm run deploy:dev   # Deploy to development
npm run deploy:prod  # Deploy to production
```

You can also deploy the worker separately:

```bash
cd worker
npx wrangler deploy --env production
```

## Configuration

### Wrangler Configuration

The `wrangler.toml` file contains configuration for the Cloudflare Worker. You'll need to set up:

- R2 buckets for asset storage
- Durable Objects for real-time collaboration
- Environment variables for API keys

### Vercel Configuration

The `vercel.json` file contains configuration for the Vercel deployment, including:

- Build commands
- Output directory
- Routing rules
- Cache headers

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Acknowledgments

- [TLDraw](https://tldraw.com) for the collaborative canvas
- [Daily.co](https://daily.co) for video chat functionality
- [Cloudflare Workers](https://workers.cloudflare.com) for serverless backend
