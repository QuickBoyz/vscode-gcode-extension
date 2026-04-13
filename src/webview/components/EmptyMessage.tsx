import { ErrorKind } from '../context/documentReducer';

type EmptyMessageProps =
  | { readonly variant: 'idle' }
  | { readonly variant: 'empty'; readonly filename: string | null }
  | {
      readonly variant: 'error';
      readonly errorKind: ErrorKind;
      readonly filename: string | null;
      readonly message: string;
    };

const ERROR_HEADERS: Record<ErrorKind, string> = {
  [ErrorKind.PARSE_FAILURE]: 'G-code parse failed',
  [ErrorKind.WORKER_CRASH]: 'Visualizer worker failed',
  [ErrorKind.UNKNOWN]: 'Could not render tool path',
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
        Add a move command to see a tool path.
      </div>
    );
  }

  return (
    <div id="empty-msg" className="empty-msg-error">
      <strong>{ERROR_HEADERS[props.errorKind]}</strong>
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
