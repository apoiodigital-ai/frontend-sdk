import React from 'react';
import { logger } from './logger';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class SafeBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    logger.error(
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
