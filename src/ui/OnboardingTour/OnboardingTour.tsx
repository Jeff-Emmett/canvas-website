import React, { useEffect, useReducer, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { TOUR_STEPS, TourStep } from './tourSteps'
import { TourTooltip } from './TourTooltip'

// Storage key for persistence
const STORAGE_KEY = 'canvas_onboarding_completed'

// State types
interface TourState {
  isActive: boolean
  currentStepIndex: number
  hasCompletedTour: boolean
}

type TourAction =
  | { type: 'START_TOUR' }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SKIP_TOUR' }
  | { type: 'COMPLETE_TOUR' }
  | { type: 'GO_TO_STEP'; payload: number }

// Reducer for tour state
function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'START_TOUR':
      return { ...state, isActive: true, currentStepIndex: 0 }
    case 'NEXT_STEP':
      return { ...state, currentStepIndex: state.currentStepIndex + 1 }
    case 'PREV_STEP':
      return { ...state, currentStepIndex: Math.max(0, state.currentStepIndex - 1) }
    case 'SKIP_TOUR':
    case 'COMPLETE_TOUR':
      localStorage.setItem(STORAGE_KEY, 'true')
      return { ...state, isActive: false, hasCompletedTour: true }
    case 'GO_TO_STEP':
      return { ...state, currentStepIndex: action.payload }
    default:
      return state
  }
}

// Hook to detect dark mode
function useDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'))
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  return isDark
}

// Global function to trigger tour from anywhere (e.g., Help menu)
export function startOnboardingTour() {
  window.dispatchEvent(new CustomEvent('start-onboarding-tour'))
}

// Main tour component
export function OnboardingTour() {
  const isDark = useDarkMode()
  const totalSteps = TOUR_STEPS.length

  const [state, dispatch] = useReducer(tourReducer, {
    isActive: false,
    currentStepIndex: 0,
    hasCompletedTour: localStorage.getItem(STORAGE_KEY) === 'true'
  })

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const { isActive, currentStepIndex, hasCompletedTour } = state
  const currentStep = TOUR_STEPS[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === totalSteps - 1

  // Actions
  const startTour = useCallback(() => dispatch({ type: 'START_TOUR' }), [])

  const nextStep = useCallback(() => {
    if (currentStepIndex >= totalSteps - 1) {
      dispatch({ type: 'COMPLETE_TOUR' })
    } else {
      dispatch({ type: 'NEXT_STEP' })
    }
  }, [currentStepIndex, totalSteps])

  const prevStep = useCallback(() => dispatch({ type: 'PREV_STEP' }), [])
  const skipTour = useCallback(() => dispatch({ type: 'SKIP_TOUR' }), [])

  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    dispatch({ type: 'START_TOUR' })
  }, [])

  // Listen for external trigger (from Help menu)
  useEffect(() => {
    const handleStartTour = () => resetTour()
    window.addEventListener('start-onboarding-tour', handleStartTour)
    return () => window.removeEventListener('start-onboarding-tour', handleStartTour)
  }, [resetTour])

  // Auto-start tour for first-time users (with delay to let UI render)
  useEffect(() => {
    if (!hasCompletedTour) {
      const timer = setTimeout(() => startTour(), 1500)
      return () => clearTimeout(timer)
    }
  }, [hasCompletedTour, startTour])

  // Update target element rect when step changes
  useEffect(() => {
    if (!isActive || !currentStep) return

    const updateTargetRect = () => {
      // Try each selector (some steps have multiple selectors separated by comma)
      const selectors = currentStep.targetSelector.split(',').map(s => s.trim())
      let target: Element | null = null

      for (const selector of selectors) {
        target = document.querySelector(selector)
        if (target) break
      }

      if (target) {
        setTargetRect(target.getBoundingClientRect())
      } else if (currentStep.fallbackPosition) {
        // Create a synthetic rect for fallback position
        setTargetRect(new DOMRect(
          currentStep.fallbackPosition.left,
          currentStep.fallbackPosition.top,
          40,
          40
        ))
      } else {
        // Center of screen fallback
        setTargetRect(new DOMRect(
          window.innerWidth / 2 - 20,
          window.innerHeight / 2 - 20,
          40,
          40
        ))
      }
    }

    // Initial update
    updateTargetRect()

    // Update on resize and scroll
    window.addEventListener('resize', updateTargetRect)
    window.addEventListener('scroll', updateTargetRect, true)

    // Also update periodically in case elements are dynamically rendered
    const interval = setInterval(updateTargetRect, 500)

    return () => {
      window.removeEventListener('resize', updateTargetRect)
      window.removeEventListener('scroll', updateTargetRect, true)
      clearInterval(interval)
    }
  }, [isActive, currentStep, currentStepIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          skipTour()
          break
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          nextStep()
          break
        case 'ArrowLeft':
          e.preventDefault()
          e.stopPropagation()
          if (!isFirstStep) prevStep()
          break
      }
    }

    // Use capture phase to intercept before tldraw
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [isActive, nextStep, prevStep, skipTour, isFirstStep])

  // Don't render if not active
  if (!isActive || !currentStep) return null

  return createPortal(
    <TourTooltip
      step={currentStep}
      stepNumber={currentStepIndex + 1}
      totalSteps={totalSteps}
      targetRect={targetRect}
      isDark={isDark}
      onNext={nextStep}
      onPrev={prevStep}
      onSkip={skipTour}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
    />,
    document.body
  )
}
