import React from 'react';

interface LoadingOverlayProps {
  readonly visible: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible }) => (
  <div id="loading-overlay" style={{ display: visible ? 'flex' : 'none' }}>
    <div className="spinner" />
    <span className="loading-text">Parsing...</span>
  </div>
);
