import { Component, type ErrorInfo, type ReactNode } from 'react';

interface HostRenderBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
  /** A new key (the content completed by the stream) gives the host's rendering another try. */
  resetKey: string;
  /** What failed, for the console: "A chat marker card", "A chat code block renderer". */
  label: string;
}

/**
 * What a host renders inside an answer (a marker card, a code block) that
 * throws takes only itself down: the answer around it, and the rest of the
 * thread, stay on screen.
 */
export class HostRenderBoundary extends Component<HostRenderBoundaryProps, { failed: boolean; resetKey: string }> {
  state = { failed: false, resetKey: this.props.resetKey };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { failed: boolean; resetKey: string }) {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`${this.props.label} failed to render`, error, info.componentStack);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The host's rendering, called inside the boundary: a renderer that throws itself is caught too. */
export function HostRendered({ draw }: { draw: () => ReactNode }) {
  return <>{draw()}</>;
}

/** What shows in place of a host's rendering that failed. */
export function HostRenderFallback({ t }: { t: (key: string) => string }) {
  return <p className="pl-1 text-[0.75rem] italic chat-text-muted">{t('This item could not be loaded.')}</p>;
}
