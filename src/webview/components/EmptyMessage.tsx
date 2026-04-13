type EmptyMessageProps =
  | { readonly variant: 'idle' }
  | { readonly variant: 'empty'; readonly filename: string | null }
  | {
      readonly variant: 'error';
      readonly filename: string | null;
      readonly message: string;
    };

export function EmptyMessage(props: EmptyMessageProps) {
  if (props.variant === 'idle') {
    return (
      <div id="empty-msg">
        No tool path loaded.
        <br />
        Open a G-code file and run <em>G-Code: Open 3D Visualizer</em>.
      </div>
    );
  }

  if (props.variant === 'empty') {
    return (
      <div id="empty-msg">
        {props.filename && (
          <>
            <strong>{props.filename}</strong>
            <br />
          </>
        )}
        This program contains no motion commands.
        <br />
        Add a G0/G1 move to see a tool path.
      </div>
    );
  }

  return (
    <div id="empty-msg" className="empty-msg-error">
      <strong>Could not render tool path</strong>
      {props.filename && (
        <>
          <br />
          <span className="empty-msg-filename">{props.filename}</span>
        </>
      )}
      <br />
      <span className="empty-msg-reason">{props.message}</span>
    </div>
  );
}
