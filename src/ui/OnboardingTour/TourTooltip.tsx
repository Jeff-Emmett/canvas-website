import React from 'react'
import { TourStep } from './tourSteps'

interface TourTooltipProps {
  step: TourStep
  stepNumber: number
  totalSteps: number
  targetRect: DOMRect | null
  isDark: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  isFirstStep: boolean
  isLastStep: boolean
}

// Calculate tooltip position relative to target
function calculateTooltipPosition(
  targetRect: DOMRect,
  placement: TourStep['placement'],
  tooltipWidth: number,
  tooltipHeight: number,
  gap: number
): { top: number; left: number } {
  const { top, left, right, bottom, width, height } = targetRect
  const centerX = left + width / 2
  const centerY = top + height / 2

  switch (placement) {
    case 'center':
      // Center in viewport
      return {
        top: window.innerHeight / 2 - tooltipHeight / 2,
        left: window.innerWidth / 2 - tooltipWidth / 2
      }
    case 'top':
      return { top: top - tooltipHeight - gap, left: centerX - tooltipWidth / 2 }
    case 'bottom':
      return { top: bottom + gap, left: centerX - tooltipWidth / 2 }
    case 'left':
      return { top: centerY - tooltipHeight / 2, left: left - tooltipWidth - gap }
    case 'right':
      return { top: centerY - tooltipHeight / 2, left: right + gap }
    case 'top-left':
      return { top: top - tooltipHeight - gap, left: left }
    case 'top-right':
      return { top: top - tooltipHeight - gap, left: right - tooltipWidth }
    case 'bottom-left':
      return { top: bottom + gap, left: left }
    case 'bottom-right':
      return { top: bottom + gap, left: right - tooltipWidth }
    default:
      return { top: bottom + gap, left: centerX - tooltipWidth / 2 }
  }
}

// Clamp position to viewport bounds
function clampToViewport(
  position: { top: number; left: number },
  tooltipWidth: number,
  tooltipHeight: number,
  padding: number = 16
): { top: number; left: number } {
  return {
    top: Math.max(padding, Math.min(window.innerHeight - tooltipHeight - padding, position.top)),
    left: Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, position.left))
  }
}

export function TourTooltip({
  step,
  stepNumber,
  totalSteps,
  targetRect,
  isDark,
  onNext,
  onPrev,
  onSkip,
  isFirstStep,
  isLastStep
}: TourTooltipProps) {
  const tooltipWidth = 320
  const tooltipHeight = 300 // Approximate height to ensure buttons stay visible
  const highlightPadding = step.highlightPadding || 8
  const gap = 12

  // Theme colors
  const colors = isDark ? {
    background: 'rgba(30, 30, 30, 0.98)',
    border: 'rgba(70, 70, 70, 0.8)',
    text: '#e4e4e4',
    textMuted: '#a1a1aa',
    accent: '#10b981',
    accentHover: '#059669',
    buttonBg: 'rgba(50, 50, 50, 0.8)',
    buttonBorder: 'rgba(70, 70, 70, 0.6)',
    buttonHover: 'rgba(70, 70, 70, 1)',
    overlay: 'rgba(0, 0, 0, 0.7)'
  } : {
    background: 'rgba(255, 255, 255, 0.98)',
    border: 'rgba(229, 231, 235, 0.8)',
    text: '#18181b',
    textMuted: '#71717a',
    accent: '#10b981',
    accentHover: '#059669',
    buttonBg: 'rgba(244, 244, 245, 0.8)',
    buttonBorder: 'rgba(212, 212, 216, 0.8)',
    buttonHover: 'rgba(228, 228, 231, 1)',
    overlay: 'rgba(0, 0, 0, 0.5)'
  }

  // Calculate tooltip position
  let tooltipPosition = { top: 100, left: 100 }
  if (targetRect) {
    const calculated = calculateTooltipPosition(
      targetRect,
      step.placement,
      tooltipWidth,
      tooltipHeight,
      gap
    )
    tooltipPosition = clampToViewport(calculated, tooltipWidth, tooltipHeight)
  }

  return (
    <>
      {/* Spotlight overlay with cutout (or full overlay for noSpotlight steps) */}
      {step.noSpotlight ? (
        // Full overlay without cutout for intro/welcome steps
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: colors.overlay,
            zIndex: 99998,
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease-out'
          }}
        />
      ) : targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.y - highlightPadding,
            left: targetRect.x - highlightPadding,
            width: targetRect.width + highlightPadding * 2,
            height: targetRect.height + highlightPadding * 2,
            borderRadius: '12px',
            boxShadow: `0 0 0 9999px ${colors.overlay}`,
            zIndex: 99998,
            pointerEvents: 'none',
            transition: 'all 0.3s ease-out'
          }}
        />
      )}

      {/* Tooltip */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        aria-describedby="tour-step-content"
        style={{
          position: 'fixed',
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          width: tooltipWidth,
          zIndex: 99999,
          background: colors.background,
          borderRadius: '16px',
          border: `1px solid ${colors.border}`,
          boxShadow: isDark
            ? '0 20px 50px rgba(0, 0, 0, 0.5), 0 10px 20px rgba(0, 0, 0, 0.3)'
            : '0 20px 50px rgba(0, 0, 0, 0.15), 0 10px 20px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          animation: 'tourTooltipFadeIn 0.25s ease-out',
          pointerEvents: 'auto'
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with icon and step counter */}
        <div style={{
          padding: '16px 18px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {step.icon && (
              <span style={{
                fontSize: '24px',
                filter: isDark ? 'none' : 'saturate(0.9)'
              }}>
                {step.icon}
              </span>
            )}
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: colors.accent,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Step {stepNumber} of {totalSteps}
            </span>
          </div>
          <button
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '16px',
              opacity: 0.6,
              borderRadius: '6px',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.background = colors.buttonBg
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.6'
              e.currentTarget.style.background = 'none'
            }}
            title="Skip tour (Esc)"
            aria-label="Skip tour"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '14px 18px 16px' }}>
          <h3
            id="tour-step-title"
            style={{
              margin: '0 0 10px',
              fontSize: '17px',
              fontWeight: 600,
              color: colors.text,
              lineHeight: 1.3
            }}
          >
            {step.title}
          </h3>
          <p
            id="tour-step-content"
            style={{
              margin: 0,
              fontSize: '13px',
              lineHeight: 1.6,
              color: colors.textMuted
            }}
          >
            {step.content}
          </p>
          {step.actionHint && (
            <p style={{
              margin: '12px 0 0',
              fontSize: '11px',
              color: colors.accent,
              fontStyle: 'italic',
              opacity: 0.9
            }}>
              {step.actionHint}
            </p>
          )}
        </div>

        {/* Navigation */}
        <div style={{
          padding: '14px 18px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: `1px solid ${colors.border}`
        }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === stepNumber - 1 ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: i === stepNumber - 1 ? colors.accent : colors.buttonBg,
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isFirstStep && (
              <button
                onClick={onPrev}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.buttonBorder}`,
                  background: colors.buttonBg,
                  color: colors.text,
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.buttonHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.buttonBg
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={onNext}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: colors.accent,
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.accentHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.accent
              }}
            >
              {isLastStep ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes tourTooltipFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  )
}
