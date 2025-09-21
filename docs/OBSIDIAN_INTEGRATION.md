# Obsidian Vault Integration

This document describes the Obsidian vault integration feature that allows you to import and work with your Obsidian notes directly on the canvas.

## Features

- **Vault Import**: Load your local Obsidian vault using the File System Access API
- **Searchable Interface**: Browse and search through all your obs_notes with real-time filtering
- **Tag-based Filtering**: Filter obs_notes by tags for better organization
- **Canvas Integration**: Drag obs_notes from the browser directly onto the canvas as rectangle shapes
- **Rich ObsNote Display**: ObsNotes show title, content preview, tags, and metadata
- **Markdown Rendering**: Support for basic markdown formatting in obs_note previews

## How to Use

### 1. Access the Obsidian Browser

You can access the Obsidian browser in multiple ways:

- **Toolbar Button**: Click the "Obsidian Note" button in the toolbar (file-text icon)
- **Context Menu**: Right-click on the canvas and select "Open Obsidian Browser"
- **Keyboard Shortcut**: Press `Alt+O` to open the browser
- **Tool Selection**: Select the "Obsidian Note" tool from the toolbar or context menu

This will open the Obsidian Vault Browser overlay

### 2. Load Your Vault

The browser will attempt to use the File System Access API to let you select your Obsidian vault directory. If this isn't supported in your browser, it will fall back to demo data.

**Supported Browsers for File System Access API:**
- Chrome 86+
- Edge 86+
- Opera 72+

### 3. Browse and Search ObsNotes

- **Search**: Use the search box to find obs_notes by title, content, or tags
- **Filter by Tags**: Click on any tag to filter obs_notes by that tag
- **Clear Filters**: Click "Clear Filters" to remove all active filters

### 4. Add ObsNotes to Canvas

- Click on any obs_note in the browser to add it to the canvas
- The obs_note will appear as a rectangle shape at the center of your current view
- You can move, resize, and style the obs_note shapes like any other canvas element

### 5. Keyboard Shortcuts

- **Alt+O**: Open Obsidian browser or select Obsidian Note tool
- **Escape**: Close the Obsidian browser
- **Enter**: Select the currently highlighted obs_note (when browsing)

## ObsNote Shape Features

### Display Options
- **Title**: Shows the obs_note title at the top
- **Content Preview**: Displays a formatted preview of the obs_note content
- **Tags**: Shows up to 3 tags, with a "+N" indicator for additional tags
- **Metadata**: Displays file path and link count

### Styling
- **Background Color**: Customizable background color
- **Text Color**: Customizable text color
- **Preview Mode**: Toggle between preview and full content view

### Markdown Support
The obs_note shapes support basic markdown formatting:
- Headers (# ## ###)
- Bold (**text**)
- Italic (*text*)
- Inline code (`code`)
- Lists (- item, 1. item)
- Wiki links ([[link]])
- External links ([text](url))

## File Structure

```
src/
├── lib/
│   └── obsidianImporter.ts          # Core vault import logic
├── shapes/
│   └── NoteShapeUtil.tsx            # Canvas shape for displaying notes
├── tools/
│   └── NoteTool.ts                  # Tool for creating note shapes
├── components/
│   ├── ObsidianVaultBrowser.tsx     # Main browser interface
│   └── ObsidianToolbarButton.tsx    # Toolbar button component
└── css/
    ├── obsidian-browser.css         # Browser styling
    └── obsidian-toolbar.css         # Toolbar button styling
```

## Technical Details

### ObsidianImporter Class

The `ObsidianImporter` class handles:
- Reading markdown files from directories
- Parsing frontmatter and metadata
- Extracting tags, links, and other obs_note properties
- Searching and filtering functionality

### ObsNoteShape Class

The `ObsNoteShape` class extends TLDraw's `BaseBoxShapeUtil` and provides:
- Rich obs_note display with markdown rendering
- Interactive preview/full content toggle
- Customizable styling options
- Integration with TLDraw's shape system

### File System Access

The integration uses the modern File System Access API when available, with graceful fallback to demo data for browsers that don't support it.

## Browser Compatibility

- **File System Access API**: Chrome 86+, Edge 86+, Opera 72+
- **Fallback Mode**: All modern browsers (uses demo data)
- **Canvas Rendering**: All browsers supported by TLDraw

## Future Enhancements

Potential improvements for future versions:
- Real-time vault synchronization
- Bidirectional editing (edit obs_notes on canvas, sync back to vault)
- Advanced search with regex support
- ObsNote linking and backlink visualization
- Custom obs_note templates
- Export canvas content back to Obsidian
- Support for Obsidian plugins and custom CSS

## Troubleshooting

### Vault Won't Load
- Ensure you're using a supported browser
- Check that the selected directory contains markdown files
- Verify you have read permissions for the directory

### ObsNotes Not Displaying Correctly
- Check that the markdown files are properly formatted
- Ensure the files have `.md` extensions
- Verify the obs_note content isn't corrupted

### Performance Issues
- Large vaults may take time to load initially
- Consider filtering by tags to reduce the number of displayed obs_notes
- Use search to quickly find specific obs_notes

## Contributing

To extend the Obsidian integration:
1. Add new features to the `ObsidianImporter` class
2. Extend the `NoteShape` for new display options
3. Update the `ObsidianVaultBrowser` for new UI features
4. Add corresponding CSS styles for new components
