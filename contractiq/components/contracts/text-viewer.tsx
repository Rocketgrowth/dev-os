'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface TextViewerProps {
  text: string
  targetPage?: number
  className?: string
}

export function TextViewer({ text, targetPage, className }: TextViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse text into pages based on [PAGE N] markers
  const pages = text.split(/\[PAGE (\d+)\]/).reduce<Array<{ page: number; content: string }>>(
    (acc, part, index) => {
      if (index === 0 && part.trim()) {
        // Content before first page marker
        acc.push({ page: 0, content: part.trim() })
      } else if (index % 2 === 1) {
        // Page number
        const pageNum = parseInt(part, 10)
        const content = text.split(/\[PAGE \d+\]/)[Math.floor(index / 2) + 1]?.trim() || ''
        if (content) {
          acc.push({ page: pageNum, content })
        }
      }
      return acc
    },
    []
  )

  useEffect(() => {
    if (targetPage && containerRef.current) {
      const pageElement = containerRef.current.querySelector(
        `[data-page="${targetPage}"]`
      )
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [targetPage])

  return (
    <div
      ref={containerRef}
      className={cn(
        'h-full overflow-y-auto bg-white rounded-lg border p-4',
        className
      )}
    >
      {pages.length > 0 ? (
        <div className="space-y-6">
          {pages.map(({ page, content }) => (
            <div key={page} data-page={page} className="space-y-2">
              <div className="sticky top-0 bg-white py-1">
                <span className="inline-block rounded bg-muted px-2 py-1 text-xs font-medium">
                  Page {page}
                </span>
              </div>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {content}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
        </div>
      )}
    </div>
  )
}
