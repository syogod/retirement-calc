import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement ResizeObserver. A no-op stub is enough for components that
// use it purely to react to layout changes in a real browser (getBoundingClientRect
// in jsdom always reports zero-sized rects anyway, so there's nothing real to observe).
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub
}
