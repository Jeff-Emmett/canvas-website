import { BaseBoxShapeTool } from "tldraw"

export class StripePaymentTool extends BaseBoxShapeTool {
  static override id = "stripe-payment"
  shapeType = "stripe-payment"
  override initial = "idle"
} 