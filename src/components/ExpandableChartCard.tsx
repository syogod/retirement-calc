import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AdjustablePanel } from './AdjustablePanel'
import { CHART_VIEWBOX_WIDTH } from './charts/chartMath'
import type { AppInputs } from '../state/appInputs'

export interface ExpandableChartCardProps {
  title: string
  inputs: AppInputs
  onInputsChange: (inputs: AppInputs) => void
  /** Extra content shown right under the heading, in both the compact card and the
   * expanded view (e.g. a "funds run out" note, or Monte Carlo's run button). */
  extraHeader?: ReactNode
  /** Render-prop so the same chart can be rendered at a bigger height when expanded. */
  children: (height: number) => ReactNode
  compactHeight?: number
  /** Fallback used only for the first paint, before the actual available space has
   * been measured (see `useAvailableChartHeight` below). */
  expandedHeight?: number
}

/**
 * Wraps a chart card with an "Expand" control that opens it full-screen alongside the
 * Explore sliders — so you can size up a chart to actually read it while still being
 * able to drag an input and watch it update.
 */
export function ExpandableChartCard({
  title,
  inputs,
  onInputsChange,
  extraHeader,
  children,
  compactHeight = 320,
  expandedHeight = 640,
}: ExpandableChartCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { areaRef, chartHeight } = useAvailableChartHeight(expanded, expandedHeight)

  return (
    <>
      <section className="card">
        <div className="results-header">
          <h2>{title}</h2>
          <button type="button" className="expand-button" onClick={() => setExpanded(true)}>
            &#10530; Expand
          </button>
        </div>
        {extraHeader}
        {children(compactHeight)}
      </section>

      {expanded && (
        <div className="chart-overlay" role="dialog" aria-label={`${title}, expanded`}>
          <div className="chart-overlay-adjust">
            <AdjustablePanel inputs={inputs} onChange={onInputsChange} idPrefix="overlay-" />
          </div>
          <div className="chart-overlay-main">
            <div className="chart-overlay-header">
              <h2>{title}</h2>
              <button type="button" className="expand-button" onClick={() => setExpanded(false)}>
                &#10005; Close
              </button>
            </div>
            {extraHeader}
            <div className="chart-overlay-chart-area" ref={areaRef}>
              {children(chartHeight)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Measures the actual available box for the expanded chart and derives the `height`
 * prop (in the chart's internal viewBox units, see `CHART_VIEWBOX_WIDTH`) that makes
 * the rendered SVG exactly fill it — no more, no less — so the chart never grows
 * taller than the viewport and forces a scrollbar. Re-measures on every resize (via
 * ResizeObserver, which also fires once on first attach) and whenever the header
 * content above the chart changes size, since that changes how much room is left.
 */
function useAvailableChartHeight(active: boolean, fallback: number) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(fallback)

  useEffect(() => {
    if (!active) return
    const el = areaRef.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        setChartHeight((CHART_VIEWBOX_WIDTH * height) / width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [active])

  return { areaRef, chartHeight }
}
