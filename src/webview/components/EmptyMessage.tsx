import React from 'react';

interface EmptyMessageProps {
  readonly visible: boolean;
}

export const EmptyMessage: React.FC<EmptyMessageProps> = ({ visible }) => (
  <div id="empty-msg" style={{ display: visible ? 'flex' : 'none' }}>
    No tool path loaded.
    <br />
    Open a G-code file and run <em>G-Code: Open 3D Visualizer</em>.
  </div>
);
