/**
 * Type declarations for Wrangler's WASM module imports
 * The `?module` suffix tells Wrangler to bundle as a WebAssembly module
 */

// Declaration for automerge WASM module
declare module '@automerge/automerge/automerge.wasm?module' {
  const wasmModule: WebAssembly.Module
  export default wasmModule
}

// Alternative path declaration
declare module '@automerge/automerge/dist/automerge.wasm?module' {
  const wasmModule: WebAssembly.Module
  export default wasmModule
}

// Workerd-specific WASM module
declare module '@automerge/automerge/dist/mjs/wasm_bindgen_output/workerd/automerge_wasm_bg.wasm?module' {
  const wasmModule: WebAssembly.Module
  export default wasmModule
}
