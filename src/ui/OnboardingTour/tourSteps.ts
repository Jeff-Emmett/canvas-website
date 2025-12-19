// Tour step definitions for the onboarding walkthrough

export interface TourStep {
  id: string
  title: string
  content: string
  // Target element selector - CSS selector string
  targetSelector: string
  // Fallback positioning if element not found
  fallbackPosition?: { top: number; left: number }
  // Tooltip placement relative to target
  placement: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  // Optional highlight padding around target element
  highlightPadding?: number
  // Optional action hint (e.g., "Click to continue" vs "Press Enter")
  actionHint?: string
  // Optional icon for visual interest
  icon?: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'local-first',
    title: 'Your Data, Your Device',
    content: 'This canvas stores everything locally in your browser first. Your work is saved automatically and works offline - no account required to start creating.',
    targetSelector: '.tlui-menu__button',
    placement: 'bottom-right',
    highlightPadding: 8,
    icon: '🏠',
    actionHint: 'Your data never leaves your device unless you choose to sync'
  },
  {
    id: 'cryptid-login',
    title: 'Encrypted Identity',
    content: 'Sign in with CryptID for end-to-end encrypted sync across devices. Your password never leaves your browser - we use cryptographic keys instead.',
    targetSelector: '.cryptid-dropdown-trigger',
    fallbackPosition: { top: 60, left: window.innerWidth - 200 },
    placement: 'bottom-left',
    highlightPadding: 8,
    icon: '🔐',
    actionHint: 'Create an account or sign in to sync'
  },
  {
    id: 'share-collaborate',
    title: 'Share & Collaborate',
    content: 'Invite others to view or edit this board in real-time. See live cursors and collaborate together on the same canvas.',
    targetSelector: '.share-board-button',
    fallbackPosition: { top: 60, left: window.innerWidth - 150 },
    placement: 'bottom-left',
    highlightPadding: 8,
    icon: '👥',
    actionHint: 'Share via link or QR code'
  },
  {
    id: 'toolbar-tools',
    title: 'Your Creative Toolkit',
    content: 'Draw, write, add shapes, embed media, generate AI images, and more. Everything you need to think visually is here.',
    targetSelector: '.tlui-toolbar',
    placement: 'right',
    highlightPadding: 12,
    icon: '🎨',
    actionHint: 'Select a tool to get started'
  },
  {
    id: 'mycelial-ai',
    title: 'Mycelial Intelligence',
    content: 'Ask questions about your canvas. The AI understands all your shapes, notes, and connections - like a second brain for your visual thinking.',
    targetSelector: '.mycelial-intelligence-bar',
    fallbackPosition: { top: window.innerHeight - 100, left: window.innerWidth / 2 - 150 },
    placement: 'top',
    highlightPadding: 8,
    icon: '🍄',
    actionHint: 'Type a question to get started'
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    content: 'Press ? anytime to see all keyboard shortcuts. Power users can navigate, zoom, and create without touching the mouse.',
    targetSelector: '.help-button, [title*="Keyboard shortcuts"]',
    fallbackPosition: { top: 60, left: window.innerWidth - 50 },
    placement: 'bottom-left',
    highlightPadding: 8,
    icon: '⌨️',
    actionHint: 'Press ? to open shortcuts anytime'
  }
]
