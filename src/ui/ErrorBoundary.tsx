import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logError } from '../game/errors'

interface Props {
  title: string
  body: string
  retry: string
  reload: string
  onReset: () => void
  children: ReactNode
}

/** Catches a render crash in a screen or mode, reports it, and offers a way back instead of a blank page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    logError(err, 'render ' + (info.componentStack ?? '').trim().split('\n')[0]?.trim().slice(0, 80))
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="loading crash">
        <div className="board board-blue results-board crash-board">
          <div className="board-inner">
            <div className="board-title">{this.props.title}</div>
            <p className="crash-text">{this.props.body}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  this.setState({ failed: false })
                  this.props.onReset()
                }}
              >
                {this.props.retry}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => location.reload()}>
                {this.props.reload}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
