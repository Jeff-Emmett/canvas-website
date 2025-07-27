# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- `npm run dev` - Run development servers (client + worker)
- `npm run build` - Build for production
- `npm run deploy` - Build and deploy to Vercel/Cloudflare
- `npm run types` - TypeScript type checking

## Code Style Guidelines
- **TypeScript**: Use strict mode, explicit return types, and proper interfaces for props
- **Formatting**: No semicolons, trailing commas for all elements
- **Naming**: PascalCase for components/types, camelCase for utilities/functions
- **Imports**: Group related imports, React imports first, use absolute paths with aliases
- **Error Handling**: Catch and log errors with console.error, return success/failure values
- **Components**: Separate UI from business logic, use functional components with hooks
- **State**: Use React Context for global state, follow immutable update patterns
- **Documentation**: Include JSDoc comments for functions and modules

## Project Structure
- `/src/components/` - UI components organized by feature
- `/src/context/` - React Context providers
- `/src/lib/` - Business logic and utilities
- `/src/routes/` - Page definitions
- `/src/css/` - Styles organized by feature
- `/src/ui/` - Reusable UI components
- `/worker/` - Cloudflare Workers backend code