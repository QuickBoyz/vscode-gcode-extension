import React from 'react';

interface ErrorBannerProps {
  readonly message: string | null;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message }) => (
  <div id="error-banner" style={{ display: message ? 'flex' : 'none' }}>
    <span className="error-icon">!</span>
    <span className="error-text">{message ?? ''}</span>
  </div>
);
