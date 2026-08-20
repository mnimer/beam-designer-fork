/**
 * InfoTooltip Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders an accessible, hoverable/focusable information icon that displays
 * a contextual tooltip/popup with field documentation extracted from Apache Beam SDK docs.
 * 
 * Architectural Decisions:
 * - Uses Lucide Info icon with an accessible trigger container.
 * - Renders the floating tooltip via React Portal directly into document.body to prevent
 *   clipping/cutting off by parent containers with overflow-y: auto or overflow: hidden.
 * - Dynamically calculates viewport coordinates, automatically flipping above/below
 *   and clamping to viewport horizontal edges with safe margins.
 * - Adheres strictly to the 8pt grid system for spacing and sizing.
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  /** Text content to display in the tooltip */
  text: string;
  /** Optional position preference override ('top' | 'bottom' | 'auto') */
  position?: 'top' | 'bottom' | 'auto';
}

/**
 * InfoTooltip renders a clickable/hoverable info icon with a floating portal popup.
 *
 * @param props Component properties containing documentation text and position.
 * @returns React component.
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, position = 'auto' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  /**
   * Calculates viewport coordinates for the floating tooltip to prevent clipping.
   */
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 260;
    const tooltipEstimatedHeight = 80;
    const padding = 12;

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

    // Center horizontally relative to the trigger icon
    let left = rect.left + (rect.width || 14) / 2 - tooltipWidth / 2;
    // Clamp horizontally to stay inside viewport boundaries
    if (left < padding) {
      left = padding;
    } else if (left + tooltipWidth > viewportWidth - padding) {
      left = Math.max(padding, viewportWidth - tooltipWidth - padding);
    }

    // Determine vertical position
    let top: number;
    if (position === 'bottom') {
      top = rect.bottom + 8;
    } else if (position === 'top') {
      top = rect.top - tooltipEstimatedHeight - 8;
      if (top < padding) {
        top = rect.bottom + 8;
      }
    } else {
      // Auto: prefer top unless near top of viewport
      if (rect.top >= tooltipEstimatedHeight + padding + 8) {
        top = rect.top - tooltipEstimatedHeight - 8;
      } else {
        top = rect.bottom + 8;
      }
    }

    // Clamp top to viewport
    if (top < padding) {
      top = padding;
    } else if (top + tooltipEstimatedHeight > viewportHeight - padding) {
      top = Math.max(padding, viewportHeight - tooltipEstimatedHeight - padding);
    }

    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleFocus = () => {
    updatePosition();
    setIsVisible(true);
  };

  const handleBlur = () => {
    setIsVisible(false);
  };

  // Close or reposition on scroll / resize while visible
  useEffect(() => {
    if (!isVisible) return;

    const handleScrollOrResize = () => {
      setIsVisible(false);
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isVisible]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center ml-1 text-slate-400 hover:text-blue-400 cursor-help focus:outline-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
      role="tooltip"
      aria-label={text}
    >
      <Info className="w-3.5 h-3.5" aria-hidden="true" />

      {isVisible && coords && typeof document !== 'undefined' &&
        createPortal(
          <span
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className="fixed z-[9999] w-[260px] p-2 text-xs font-normal leading-relaxed text-slate-200 bg-slate-900/95 border border-slate-700 rounded-md shadow-2xl backdrop-blur pointer-events-none normal-case tracking-normal"
          >
            {text}
          </span>,
          document.body
        )}
    </span>
  );
};
