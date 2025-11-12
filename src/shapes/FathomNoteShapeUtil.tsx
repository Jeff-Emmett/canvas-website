import React, { useState } from 'react'
import { BaseBoxShapeUtil, TLBaseShape, createShapeId, IndexKey, TLParentId, HTMLContainer } from '@tldraw/tldraw'
import { StandardizedToolWrapper } from '../components/StandardizedToolWrapper'
import { usePinnedToView } from '../hooks/usePinnedToView'

export type IFathomNoteShape = TLBaseShape<
  'FathomNote',
  {
    w: number
    h: number
    title: string
    content: string
    tags: string[]
    noteId: string
    pinnedToView: boolean
    primaryColor: string // Blue shade for the header
  }
>

export class FathomNoteShape extends BaseBoxShapeUtil<IFathomNoteShape> {
  static override type = 'FathomNote' as const

  // Default blue color (can be overridden per shape)
  static readonly PRIMARY_COLOR = "#3b82f6"

  getDefaultProps(): IFathomNoteShape['props'] {
    return {
      w: 500,
      h: 600,
      title: 'Fathom Note',
      content: '',
      tags: [],
      noteId: '',
      pinnedToView: false,
      primaryColor: FathomNoteShape.PRIMARY_COLOR,
    }
  }

  component(shape: IFathomNoteShape) {
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)
    const [isMinimized, setIsMinimized] = useState(false)
    const [isCopied, setIsCopied] = useState(false)

    // Use the pinning hook
    usePinnedToView(this.editor, shape.id, shape.props.pinnedToView)

    const handleClose = () => {
      this.editor.deleteShape(shape.id)
    }

    const handleMinimize = () => {
      setIsMinimized(!isMinimized)
    }

    const handlePinToggle = () => {
      this.editor.updateShape<IFathomNoteShape>({
        id: shape.id,
        type: 'FathomNote',
        props: {
          ...shape.props,
          pinnedToView: !shape.props.pinnedToView,
        },
      })
    }

    const handleCopy = async () => {
      try {
        // Extract plain text from content (remove HTML tags and markdown formatting)
        let textToCopy = shape.props.content || ''
        
        // Remove HTML tags if present
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = textToCopy
        textToCopy = tempDiv.textContent || tempDiv.innerText || textToCopy
        
        // Clean up markdown formatting for better plain text output
        // Remove markdown headers
        textToCopy = textToCopy.replace(/^#+\s+/gm, '')
        // Remove markdown bold/italic
        textToCopy = textToCopy.replace(/\*\*([^*]+)\*\*/g, '$1')
        textToCopy = textToCopy.replace(/\*([^*]+)\*/g, '$1')
        // Remove markdown links but keep text
        textToCopy = textToCopy.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove markdown code blocks
        textToCopy = textToCopy.replace(/```[\s\S]*?```/g, '')
        // Remove inline code
        textToCopy = textToCopy.replace(/`([^`]+)`/g, '$1')
        
        // Clean up extra whitespace
        textToCopy = textToCopy.trim().replace(/\n{3,}/g, '\n\n')
        
        if (!textToCopy.trim()) {
          console.warn('No content to copy')
          return
        }
        
        await navigator.clipboard.writeText(textToCopy)
        setIsCopied(true)
        setTimeout(() => {
          setIsCopied(false)
        }, 2000)
      } catch (error) {
        console.error('Failed to copy text:', error)
      }
    }

    const contentStyle: React.CSSProperties = {
      padding: '16px',
      overflow: 'auto',
      flex: 1,
      backgroundColor: '#ffffff',
      color: '#000000',
      fontSize: '13px',
      lineHeight: '1.6',
      fontFamily: 'Inter, sans-serif',
      userSelect: 'text', // Enable text selection
      cursor: 'text', // Show text cursor
      WebkitUserSelect: 'text', // Safari support
      MozUserSelect: 'text', // Firefox support
      msUserSelect: 'text', // IE/Edge support
    }

    // Format markdown content for display
    const formatContent = (content: string) => {
      if (!content) return null
      
      // Check if content starts with HTML (for the header with date)
      if (content.trim().startsWith('<div')) {
        // Find where the HTML div ends
        const divEndIndex = content.indexOf('</div>')
        if (divEndIndex !== -1) {
          const htmlHeader = content.substring(0, divEndIndex + 6) // Include </div>
          const markdownContent = content.substring(divEndIndex + 6).trim()
          
          return (
            <>
              <div dangerouslySetInnerHTML={{ __html: htmlHeader }} />
              {markdownContent ? formatMarkdownContent(markdownContent) : null}
            </>
          )
        }
      }
      
      return formatMarkdownContent(content)
    }
    
    // Format markdown content (extracted to separate function)
    const formatMarkdownContent = (content: string) => {
      const lines = content.split('\n')
      const elements: JSX.Element[] = []
      let i = 0
      let inCodeBlock = false
      let codeBlockLines: string[] = []
      let listItems: string[] = []
      let listType: 'ul' | 'ol' | null = null
      
      const processInlineMarkdown = (text: string): (string | JSX.Element)[] => {
        const parts: (string | JSX.Element)[] = []
        let lastIndex = 0
        let keyCounter = 0
        
        // Process inline code, links, bold, italic in order of precedence
        // We need to process them in a way that handles overlapping patterns correctly
        // Process bold first, then italic (to avoid conflicts)
        const patterns: Array<{
          regex: RegExp
          render: (...args: any[]) => JSX.Element
          groupCount: number
        }> = [
          { 
            regex: /`([^`]+)`/g,
            groupCount: 1,
            render: (code: string, key: number) => (
              <code key={key} style={{ 
                backgroundColor: '#f4f4f4', 
                padding: '2px 4px', 
                borderRadius: '3px',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}>{code}</code>
            )
          },
          { 
            regex: /\[([^\]]+)\]\(([^)]+)\)/g,
            groupCount: 2,
            render: (linkText: string, url: string, key: number) => (
              <a key={key} href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>{linkText}</a>
            )
          },
          { 
            regex: /\*\*([^*]+)\*\*/g,
            groupCount: 1,
            render: (boldText: string, key: number) => (
              <strong key={key} style={{ fontWeight: 'bold' }}>{boldText}</strong>
            )
          },
        ]
        
        // Process italic separately after bold to avoid conflicts
        // Match single asterisks that aren't part of double asterisks
        // Use a simpler approach: match *text* where text doesn't contain *
        const italicPattern = /\*([^*\n]+?)\*/g
        
        // Find all matches and sort by position
        const matches: Array<{ index: number; length: number; render: () => JSX.Element }> = []
        
        patterns.forEach(({ regex, render, groupCount }) => {
          regex.lastIndex = 0
          let match
          while ((match = regex.exec(text)) !== null) {
            const matchKey = keyCounter++
            // Store the match data to avoid closure issues
            const matchIndex = match.index
            const matchLength = match[0].length
            // Extract captured groups immediately and store them
            const matchGroups: string[] = []
            for (let i = 1; i <= groupCount; i++) {
              if (match[i] !== undefined) {
                matchGroups.push(match[i])
              }
            }
            
            matches.push({
              index: matchIndex,
              length: matchLength,
              render: () => {
                // Call render with the stored groups and key
                // Safety check: ensure we have the required groups
                if (matchGroups.length < groupCount) {
                  return <span key={matchKey}>{text.substring(matchIndex, matchIndex + matchLength)}</span>
                }
                if (groupCount === 1) {
                  return render(matchGroups[0], matchKey)
                } else if (groupCount === 2) {
                  return render(matchGroups[0], matchGroups[1], matchKey)
                } else {
                  return render(...matchGroups, matchKey)
                }
              }
            })
          }
        })
        
        // Process italic separately (after bold to avoid conflicts)
        // First, create a set of positions that are already covered by bold
        const boldPositions = new Set<number>()
        matches.forEach(m => {
          for (let pos = m.index; pos < m.index + m.length; pos++) {
            boldPositions.add(pos)
          }
        })
        
        italicPattern.lastIndex = 0
        let italicMatch
        while ((italicMatch = italicPattern.exec(text)) !== null) {
          // Safety check: ensure we have a captured group
          if (!italicMatch[1]) continue
          
          // Check if this italic match overlaps with any bold match
          let overlapsBold = false
          for (let pos = italicMatch.index; pos < italicMatch.index + italicMatch[0].length; pos++) {
            if (boldPositions.has(pos)) {
              overlapsBold = true
              break
            }
          }
          
          if (!overlapsBold) {
            const matchKey = keyCounter++
            // Store the italic text to avoid closure issues
            const italicText = italicMatch[1]
            const italicIndex = italicMatch.index
            const italicLength = italicMatch[0].length
            matches.push({
              index: italicIndex,
              length: italicLength,
              render: () => (
                <em key={matchKey} style={{ fontStyle: 'italic' }}>{italicText}</em>
              )
            })
          }
        }
        
        // Sort matches by position, and remove overlapping matches (keep the first one)
        matches.sort((a, b) => a.index - b.index)
        
        // Remove overlapping matches - if two matches overlap, keep the one that starts first
        const nonOverlapping: typeof matches = []
        for (const match of matches) {
          const overlaps = nonOverlapping.some(existing => {
            const existingEnd = existing.index + existing.length
            const matchEnd = match.index + match.length
            return (match.index < existingEnd && matchEnd > existing.index)
          })
          if (!overlaps) {
            nonOverlapping.push(match)
          }
        }
        
        // Build parts array
        nonOverlapping.forEach((match) => {
          if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index))
          }
          parts.push(match.render())
          lastIndex = match.index + match.length
        })
        
        if (lastIndex < text.length) {
          parts.push(text.substring(lastIndex))
        }
        
        return parts.length > 0 ? parts : [text]
      }
      
      const flushList = () => {
        if (listItems.length > 0) {
          const ListTag = listType === 'ol' ? 'ol' : 'ul'
          elements.push(
            <ListTag key={`list-${i}`} style={{ margin: '8px 0', paddingLeft: '24px' }}>
              {listItems.map((item, idx) => (
                <li key={idx} style={{ margin: '4px 0' }}>
                  {processInlineMarkdown(item)}
                </li>
              ))}
            </ListTag>
          )
          listItems = []
          listType = null
        }
      }
      
      const flushCodeBlock = () => {
        if (codeBlockLines.length > 0) {
          elements.push(
            <pre key={`codeblock-${i}`} style={{
              backgroundColor: '#f4f4f4',
              padding: '12px',
              borderRadius: '4px',
              overflow: 'auto',
              margin: '12px 0',
              fontSize: '12px',
              fontFamily: 'monospace',
              lineHeight: '1.5'
            }}>
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          )
          codeBlockLines = []
        }
      }
      
      while (i < lines.length) {
        const line = lines[i]
        const trimmed = line.trim()
        
        // Code blocks
        if (trimmed.startsWith('```')) {
          if (inCodeBlock) {
            flushCodeBlock()
            inCodeBlock = false
          } else {
            flushList()
            inCodeBlock = true
          }
          i++
          continue
        }
        
        if (inCodeBlock) {
          codeBlockLines.push(line)
          i++
          continue
        }
        
        // Headers
        if (trimmed.startsWith('# ')) {
          flushList()
          flushCodeBlock()
          elements.push(
            <h1 key={i} style={{ fontSize: '20px', fontWeight: 'bold', margin: '16px 0 8px 0' }}>
              {processInlineMarkdown(trimmed.substring(2))}
            </h1>
          )
          i++
          continue
        }
        if (trimmed.startsWith('## ')) {
          flushList()
          flushCodeBlock()
          elements.push(
            <h2 key={i} style={{ fontSize: '18px', fontWeight: 'bold', margin: '12px 0 6px 0' }}>
              {processInlineMarkdown(trimmed.substring(3))}
            </h2>
          )
          i++
          continue
        }
        if (trimmed.startsWith('### ')) {
          flushList()
          flushCodeBlock()
          elements.push(
            <h3 key={i} style={{ fontSize: '16px', fontWeight: 'bold', margin: '10px 0 4px 0' }}>
              {processInlineMarkdown(trimmed.substring(4))}
            </h3>
          )
          i++
          continue
        }
        if (trimmed.startsWith('#### ')) {
          flushList()
          flushCodeBlock()
          elements.push(
            <h4 key={i} style={{ fontSize: '15px', fontWeight: 'bold', margin: '10px 0 4px 0' }}>
              {processInlineMarkdown(trimmed.substring(5))}
            </h4>
          )
          i++
          continue
        }
        
        // Horizontal rule
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
          flushList()
          flushCodeBlock()
          elements.push(
            <hr key={i} style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />
          )
          i++
          continue
        }
        
        // Blockquote
        if (trimmed.startsWith('> ')) {
          flushList()
          flushCodeBlock()
          elements.push(
            <blockquote key={i} style={{
              margin: '8px 0',
              paddingLeft: '16px',
              borderLeft: '3px solid #e0e0e0',
              color: '#666',
              fontStyle: 'italic'
            }}>
              {processInlineMarkdown(trimmed.substring(2))}
            </blockquote>
          )
          i++
          continue
        }
        
        // Unordered list
        if (trimmed.match(/^[-*+]\s/)) {
          flushCodeBlock()
          if (listType !== 'ul') {
            flushList()
            listType = 'ul'
          }
          listItems.push(trimmed.substring(2))
          i++
          continue
        }
        
        // Ordered list
        if (trimmed.match(/^\d+\.\s/)) {
          flushCodeBlock()
          if (listType !== 'ol') {
            flushList()
            listType = 'ol'
          }
          listItems.push(trimmed.replace(/^\d+\.\s/, ''))
          i++
          continue
        }
        
        // Empty line
        if (trimmed === '') {
          flushList()
          flushCodeBlock()
          elements.push(<br key={i} />)
          i++
          continue
        }
        
        // Regular paragraph
        flushList()
        flushCodeBlock()
        const processed = processInlineMarkdown(trimmed)
        elements.push(
          <p key={i} style={{ margin: '8px 0' }}>
            {processed}
          </p>
        )
        i++
      }
      
      // Flush any remaining lists or code blocks
      flushList()
      flushCodeBlock()
      
      return elements
    }

    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
        <StandardizedToolWrapper
          title={shape.props.title}
          primaryColor={shape.props.primaryColor}
          isSelected={isSelected}
          width={shape.props.w}
          height={shape.props.h}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
          editor={this.editor}
          shapeId={shape.id}
          isPinnedToView={shape.props.pinnedToView}
          onPinToggle={handlePinToggle}
          tags={shape.props.tags}
          onTagsChange={(newTags) => {
            this.editor.updateShape<IFathomNoteShape>({
              id: shape.id,
              type: 'FathomNote',
              props: {
                ...shape.props,
                tags: newTags,
              }
            })
          }}
          tagsEditable={true}
        >
          <div 
            style={contentStyle}
            onPointerDown={(e) => {
              // Allow text selection - don't stop propagation for text selection
              // Only stop if clicking on interactive elements (links, etc.)
              const target = e.target as HTMLElement
              if (target.tagName === 'A' || target.closest('a')) {
                // Let links work normally
                return
              }
              // For text selection, allow the event to bubble but don't prevent default
              // This allows text selection while still allowing shape selection
            }}
            onMouseDown={(e) => {
              // Allow text selection on mouse down
              // Don't prevent default to allow text selection
              const target = e.target as HTMLElement
              if (target.tagName === 'A' || target.closest('a')) {
                return
              }
            }}
          >
            {formatContent(shape.props.content)}
          </div>
          {/* Copy button at bottom right */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCopy()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              backgroundColor: isCopied ? '#10b981' : 'rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '4px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              transition: 'background-color 0.2s ease',
              zIndex: 10,
              opacity: 0.8,
            }}
            onMouseEnter={(e) => {
              if (!isCopied) {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isCopied) {
                e.currentTarget.style.opacity = '0.8'
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
              }
            }}
            title={isCopied ? 'Copied!' : 'Copy content to clipboard'}
          >
            {isCopied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/>
              </svg>
            )}
          </button>
        </StandardizedToolWrapper>
      </HTMLContainer>
    )
  }

  indicator(shape: IFathomNoteShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  /**
   * Create a Fathom note shape from data
   */
  static createFromData(
    data: {
      id: string
      title: string
      content: string
      tags: string[]
      primaryColor?: string
    },
    x: number = 0,
    y: number = 0
  ): IFathomNoteShape {
    return {
      id: createShapeId(),
      type: 'FathomNote',
      x,
      y,
      rotation: 0,
      index: 'a1' as IndexKey,
      parentId: 'page:page' as TLParentId,
      isLocked: false,
      opacity: 1,
      meta: {},
      typeName: 'shape',
      props: {
        w: 500,
        h: 600,
        title: data.title,
        content: data.content,
        tags: data.tags,
        noteId: data.id,
        pinnedToView: false,
        primaryColor: data.primaryColor || FathomNoteShape.PRIMARY_COLOR,
      }
    }
  }
}

