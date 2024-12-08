import { Editor, TLShapeId } from "tldraw"
import { jsPDF } from "jspdf"
import { exportToBlob } from "tldraw"

export const saveToPdf = async (editor: Editor) => {
  const selectedIds = editor.getSelectedShapeIds()
  if (selectedIds.length === 0) return

  try {
    // Get common bounds of selected shapes
    const selectionBounds = editor.getSelectionPageBounds()
    if (!selectionBounds) return

    // Get blob using the editor's export functionality
    const blob = await exportToBlob({
      editor,
      ids: selectedIds,
      format: "png",
      opts: {
        scale: 2,
        background: true,
        padding: 10,
        preserveAspectRatio: "true",
      },
    })

    if (!blob) return

    // Create PDF with proper dimensions
    const pdf = new jsPDF({
      orientation: selectionBounds.width > selectionBounds.height ? "l" : "p",
      unit: "px",
      format: [selectionBounds.width, selectionBounds.height],
    })

    // Convert blob directly to base64
    const reader = new FileReader()
    const imageData = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    // Add the image to the PDF
    pdf.addImage(
      imageData,
      "PNG",
      0,
      0,
      selectionBounds.width,
      selectionBounds.height,
    )

    pdf.save("canvas-selection.pdf")
  } catch (error) {
    console.error("Failed to generate PDF:", error)
    alert("Failed to generate PDF. Please try again.")
  }
}
