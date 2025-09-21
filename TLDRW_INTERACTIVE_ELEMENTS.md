# TLDraw Interactive Elements - Z-Index Requirements

## Important Note for Developers

When creating tldraw shapes that contain interactive elements (buttons, inputs, links, etc.), you **MUST** set appropriate z-index values to ensure these elements are clickable and accessible.

## The Problem

TLDraw's canvas has its own event handling and layering system. Interactive elements within custom shapes can be blocked by the canvas's event listeners, making them unclickable or unresponsive.

## The Solution

Always add the following CSS properties to interactive elements:

```css
.interactive-element {
  position: relative;
  z-index: 1000; /* or higher if needed */
}
```

## Examples

### Buttons
```css
.custom-button {
  /* ... other styles ... */
  position: relative;
  z-index: 1000;
}
```

### Input Fields
```css
.custom-input {
  /* ... other styles ... */
  position: relative;
  z-index: 1000;
}
```

### Links
```css
.custom-link {
  /* ... other styles ... */
  position: relative;
  z-index: 1000;
}
```

## Z-Index Guidelines

- **1000**: Standard interactive elements (buttons, inputs, links)
- **1001-1999**: Dropdowns, modals, tooltips
- **2000+**: Critical overlays, error messages

## Testing Checklist

Before deploying any tldraw shape with interactive elements:

- [ ] Test clicking all buttons/links
- [ ] Test input field focus and typing
- [ ] Test hover states
- [ ] Test on different screen sizes
- [ ] Verify elements work when shape is selected/deselected
- [ ] Verify elements work when shape is moved/resized

## Common Issues

1. **Elements appear clickable but don't respond** → Add z-index
2. **Hover states don't work** → Add z-index
3. **Elements work sometimes but not others** → Check z-index conflicts
4. **Mobile touch events don't work** → Ensure z-index is high enough

## Files to Remember

This note should be updated whenever new interactive elements are added to tldraw shapes. Current shapes with interactive elements:

- `src/components/TranscribeComponent.tsx` - Copy button (z-index: 1000)

## Last Updated

Created: [Current Date]
Last Updated: [Current Date]
