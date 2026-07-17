'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/telemetry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

export class GameErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'unknown render error';
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError('runtime.window.error', error, {
      filename: 'react-error-boundary',
      line: 0,
      column: 0,
    });
    console.error('[GameErrorBoundary]', error, info.componentStack);
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="game-error-boundary">
        <div className="game-error-card">
          <p className="game-error-kicker">⚓ 航路遭遇風浪</p>
          <h2 className="game-error-title">遊戲遇到了預期外的錯誤</h2>
          <p className="game-error-body">
            你的存檔不會遺失。請重新整理頁面繼續旅程。
          </p>
          {this.state.errorMessage && (
            <p className="game-error-detail">{this.state.errorMessage}</p>
          )}
          <button className="btn" onClick={this.handleReload}>
            重新整理
          </button>
        </div>
      </div>
    );
  }
}
