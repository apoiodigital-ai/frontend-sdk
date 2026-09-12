import React from 'react';
import { logger } from './logger';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * React error boundary used to wrap every piece of overlay UI the SDK
 * renders. try/catch cannot intercept exceptions thrown during React's
 * render phase, so this is the render-time half of the SDK's fail-safe
 * contract (the async/sync half lives in `safeguard.ts`). Any render error
 * anywhere inside the SDK's overlay tree results in that subtree rendering
 * `null` -- the host app's own UI underneath is completely unaffected.
 */
export class SafeBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    logger.warn(
      'Overlay render error -- hiding CaneSDK overlay for this session.',
      error
    );
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
