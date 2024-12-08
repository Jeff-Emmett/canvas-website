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
      format: "svg",
      opts: {
        scale: 2,
        background: true,
        padding: 10,
        preserveAspectRatio: "xMidYMid slice",
      },
    })

    if (!blob) return

    // Convert blob to data URL
    const url = URL.createObjectURL(blob)

    // Create image from blob
    const img = new Image()
    img.src = url

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })

    // Create PDF with proper dimensions
    const pdf = new jsPDF({
      orientation: selectionBounds.width > selectionBounds.height ? "l" : "p",
      unit: "px",
      format: [selectionBounds.width, selectionBounds.height],
    })

    // Add the image to the PDF
    pdf.addImage(
      img,
      "SVG",
      0,
      0,
      selectionBounds.width,
      selectionBounds.height,
    )
    pdf.save("canvas-selection.pdf")

    // Cleanup
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error("Failed to generate PDF:", error)
    alert("Failed to generate PDF. Please try again.")
  }
}
