import React from 'react';

interface ErrorBannerProps {
  readonly message: string | null;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div id="error-banner">
      <span className="error-icon">!</span>
      <span className="error-text">{message ?? ''}</span>
    </div>
  );
}
