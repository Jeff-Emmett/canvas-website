# Holon Shape for Canvas Website

## Overview

The Holon shape is a new tool that allows users to interact with Holon data objects through a visual interface. It provides functionality to input a Holon ID and perform put/get operations on JSON tasklists.

## Features

- **Holon ID Input**: Enter a Holon ID (e.g., -4962820663) to connect to a specific holon
- **Tasklist Management**: Load, view, and manage tasklists from the holon
- **Task Operations**: Add new tasks to existing or new tasklists
- **Task Completion**: Toggle task completion status
- **Real-time Updates**: Changes are immediately reflected in the holon data

## Usage

1. **Adding the Holon Shape**: 
   - Select the Holon tool from the toolbar (star icon) or context menu
   - Use keyboard shortcut `Alt+H` to quickly select the Holon tool
   - Click and drag on the canvas to create a new Holon shape

2. **Connecting to a Holon**:
   - Enter a Holon ID in the input field
   - Click "Load Tasklists" to fetch existing tasklists

3. **Managing Tasks**:
   - Enter a tasklist name and task description
   - Click "Add" to create a new task
   - Check/uncheck tasks to mark them as complete/incomplete

## Technical Implementation

### Files Created/Modified

- `src/shapes/HolonShapeUtil.tsx` - Main shape utility with UI component and sync support
- `src/tools/HolonShapeTool.ts` - Tool definition for the Holon shape
- `src/routes/Board.tsx` - Updated to include Holon shape and tool
- `src/ui/overrides.tsx` - Added Holon tool definition with keyboard shortcut (Alt+H)
- `src/ui/CustomContextMenu.tsx` - Added Holon tool to context menu
- `src/ui/CustomToolbar.tsx` - Added Holon tool to toolbar
- `worker/TldrawDurableObject.ts` - Added Holon shape to worker schema for multiplayer sync

### HoloSphere Class

The `HoloSphere` class provides the interface for interacting with Holon data:

```typescript
class HoloSphere {
  async getAll(holonId: string, dataType: string): Promise<any[]>
  async put(holonId: string, dataType: string, data: any): Promise<void>
}
```

### API Endpoints

The shape currently uses these API endpoints:
- `GET https://api.holons.io/holons/{holonId}/tasklists` - Fetch tasklists
- `PUT https://api.holons.io/holons/{holonId}/tasklists` - Update tasklists

## Data Structure

Tasklists are stored as JSON arrays with the following structure:

```typescript
interface Tasklist {
  name: string
  tasks: Task[]
}

interface Task {
  id: number
  text: string
  completed: boolean
}
```

## Integration with Holons i/o

This shape integrates with the Holons i/o ecosystem, allowing users to:

- Connect to their personal me-holon and we-holons
- Manage tasks across different holons
- Collaborate on shared tasklists
- Track task completion and progress

## Sync Support

The Holon shape is fully integrated with TL-Draw's sync system:

- **Multiplayer Support**: All state changes are synchronized across multiple users
- **Real-time Updates**: Task additions, completions, and Holon ID changes sync immediately
- **State Persistence**: Shape state is preserved in the room's persistent storage
- **Conflict Resolution**: Uses TL-Draw's built-in conflict resolution for concurrent edits
- **Worker Schema**: Properly registered in the worker schema for multiplayer sessions

## Future Enhancements

- Support for other Holon data types (offers, requests, expenses, etc.)
- Real-time synchronization with other users
- Integration with the Holons Bot commands
- Support for nested tasklists and subtasks
- Export/import functionality for tasklists

## Example Usage

```typescript
// Example Holon ID from the Holons i/o system
const holonId = "-4962820663"

// The shape will automatically handle:
// - Fetching existing tasklists
// - Adding new tasks
// - Updating task completion status
// - Persisting changes to the holon
```

## Notes

- The shape currently uses simulated API endpoints
- Error handling is implemented for network failures
- The UI is responsive and follows the existing design patterns
- All data operations are logged to the console for debugging 