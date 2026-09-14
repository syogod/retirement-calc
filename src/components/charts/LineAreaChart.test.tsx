import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LineAreaChart } from './LineAreaChart'

describe('LineAreaChart stacked area', () => {
  it("pairs each stacked segment's bottom edge with the right x position (regression: bottom edge was drawn mirrored)", () => {
    // Two series with deliberately non-monotonic, asymmetric values so a mirrored
    // bottom edge produces different y-coordinates than the correct one.
    const { container } = render(
      <LineAreaChart
        mode="stackedArea"
        xValues={[0, 1, 2]}
        series={[
          { id: 'a', label: 'A', color: 'red', values: [10, 20, 15] },
          { id: 'b', label: 'B', color: 'blue', values: [5, 5, 5] },
        ]}
      />,
    )

    const paths = container.querySelectorAll('path')
    // The second series' fill area is the first path with fill "blue" drawn.
    const bPath = Array.from(paths).find((p) => p.getAttribute('fill') === 'blue')
    expect(bPath).toBeTruthy()

    const d = bPath!.getAttribute('d')!
    const commands = d.match(/[ML] [\d.-]+ [\d.-]+/g)!
    // Commands: M(top@x0) L(top@x1) L(top@x2) L(bottom@x2) L(bottom@x1) L(bottom@x0)
    expect(commands).toHaveLength(6)

    const parse = (cmd: string) => cmd.split(' ').slice(1).map(Number)
    const [topX1] = parse(commands[1])
    const [bottomX2, bottomY2] = parse(commands[3])
    const [bottomX1, bottomY1] = parse(commands[4])
    const [bottomX0, bottomY0] = parse(commands[5])

    // The bottom edge must trace x2 -> x1 -> x0 (right to left)...
    expect(bottomX2).toBeGreaterThan(bottomX1)
    expect(bottomX1).toBeGreaterThan(bottomX0)
    // ...matching x1's position exactly (sanity check the x scale is shared).
    expect(bottomX1).toBeCloseTo(topX1, 5)

    // ...and each point's y must be the cumulative value AT THAT x (10, 20, 15 for
    // x0, x1, x2), not mirrored (which would pair x2 with value 10 instead of 15).
    // Higher cumulative value -> smaller y (SVG y grows downward), so bottom@x2
    // (cumulative 15) must sit above (smaller y) bottom@x0 (cumulative 10).
    expect(bottomY2).toBeLessThan(bottomY0)
    // And bottom@x1 (cumulative 20, the largest) must be the highest point of the three.
    expect(bottomY1).toBeLessThan(bottomY2)
    expect(bottomY1).toBeLessThan(bottomY0)
  })
})
