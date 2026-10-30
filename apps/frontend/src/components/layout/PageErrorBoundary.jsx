import React from 'react';
import './page-error-boundary.css';

export default class PageErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="page-recovery" role="alert" aria-labelledby="page-recovery-heading">
      <h1 id="page-recovery-heading">This page couldn’t load</h1>
      <p>Your account is still signed in. Try again, or use the navigation to open another page.</p>
      <div>
        <button type="button" onClick={() => this.setState({ failed: false })}>Try again</button>
        <button type="button" onClick={this.props.onGoHome}>Back to food feed</button>
      </div>
    </section>;
  }
}
