import { useRef, useState } from 'react'

/**
 * Tracks which data index the pointer is nearest to over an SVG chart, so a chart can
 * draw a crosshair and tooltip. `plotLeft`/`plotWidth` are in the SVG's own viewBox
 * units; the hook converts client mouse coordinates into that space.
 */
export function useChartHover(pointCount: number, plotLeft: number, plotWidth: number) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  function handleMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg || pointCount < 2) return
    const rect = svg.getBoundingClientRect()
    const viewBox = svg.viewBox.baseVal
    const scaleX = viewBox.width / rect.width
    const xInViewBox = (event.clientX - rect.left) * scaleX

    const fraction = (xInViewBox - plotLeft) / plotWidth
    const index = Math.round(fraction * (pointCount - 1))
    setHoverIndex(Math.min(pointCount - 1, Math.max(0, index)))
  }

  function handleMouseLeave() {
    setHoverIndex(null)
  }

  return { svgRef, hoverIndex, handleMouseMove, handleMouseLeave }
}
