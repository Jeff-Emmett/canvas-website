import { Editor } from 'tldraw';
import { exportToBlob } from 'tldraw';

export interface BoardScreenshot {
  slug: string;
  dataUrl: string;
  timestamp: number;
}

/**
 * Generates a screenshot of the current canvas state
 */
export const generateCanvasScreenshot = async (editor: Editor): Promise<string | null> => {
  try {
    // Get all shapes on the current page
    const shapes = editor.getCurrentPageShapes();
    console.log('Found shapes:', shapes.length);

    if (shapes.length === 0) {
      console.log('No shapes found, no screenshot generated');
      return null;
    }

    // Get all shape IDs for export
    const allShapeIds = shapes.map(shape => shape.id);
    console.log('Exporting all shapes:', allShapeIds.length);

    // Calculate bounds of all shapes to fit everything in view
    const bounds = editor.getCurrentPageBounds();
    console.log('Canvas bounds:', bounds);

    // Use Tldraw's export functionality to get a blob with all content
    const blob = await exportToBlob({
      editor,
      ids: allShapeIds,
      format: "png",
      opts: {
        scale: 0.5, // Reduced scale to make image smaller
        background: true,
        padding: 20, // Increased padding to show full canvas
        preserveAspectRatio: "xMidYMid meet",
        bounds: bounds, // Export the entire canvas bounds
      },
    });

    if (!blob) {
      console.warn('Failed to export blob, no screenshot generated');
      return null;
    }

    // Convert blob to data URL with compression
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        // Create a canvas to compress the image
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get 2D context'));
            return;
          }
          
          // Set canvas size for compression (max 400x300 for dashboard)
          canvas.width = 400;
          canvas.height = 300;
          
          // Draw and compress the image
          ctx.drawImage(img, 0, 0, 400, 300);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6); // Use JPEG with 60% quality
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    console.log('Successfully exported board to data URL');
    console.log('Screenshot data URL:', dataUrl);
    return dataUrl;
  } catch (error) {
    console.error('Error generating screenshot:', error);
    return null;
  }
};



/**
 * Stores a screenshot for a board
 */
export const storeBoardScreenshot = (slug: string, dataUrl: string): void => {
  try {
    const screenshot: BoardScreenshot = {
      slug,
      dataUrl,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(`board_screenshot_${slug}`, JSON.stringify(screenshot));
  } catch (error) {
    console.error('Error storing screenshot:', error);
  }
};

/**
 * Retrieves a stored screenshot for a board
 */
export const getBoardScreenshot = (slug: string): BoardScreenshot | null => {
  try {
    const stored = localStorage.getItem(`board_screenshot_${slug}`);
    if (!stored) return null;
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error retrieving screenshot:', error);
    return null;
  }
};

/**
 * Removes a stored screenshot for a board
 */
export const removeBoardScreenshot = (slug: string): void => {
  try {
    localStorage.removeItem(`board_screenshot_${slug}`);
  } catch (error) {
    console.error('Error removing screenshot:', error);
  }
};

/**
 * Checks if a screenshot exists for a board
 */
export const hasBoardScreenshot = (slug: string): boolean => {
  return getBoardScreenshot(slug) !== null;
};

/**
 * Generates and stores a screenshot for the current board
 * This should be called when the board content changes significantly
 */
export const captureBoardScreenshot = async (editor: Editor, slug: string): Promise<void> => {
  console.log('Starting screenshot capture for:', slug);
  const dataUrl = await generateCanvasScreenshot(editor);
  if (dataUrl) {
    console.log('Screenshot generated successfully for:', slug);
    storeBoardScreenshot(slug, dataUrl);
    console.log('Screenshot stored for:', slug);
  } else {
    console.warn('Failed to generate screenshot for:', slug);
  }
}; 