import { ErrorKind, Range } from '../context/documentReducer';
import vscode from '../vscodeApi';

const NAVIGATE_TO_LINE = 'navigateToLine' as const;

type EmptyMessageProps =
  | { readonly variant: 'idle' }
  | { readonly variant: 'empty'; readonly filename: string | null }
  | {
      readonly variant: 'error';
      readonly errorKind: ErrorKind;
      readonly filename: string | null;
      readonly message: string;
      readonly range: Range | null;
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

  const { range } = props;
  const locationLabel =
    range !== null
      ? `line ${range.start.line + 1}:${range.start.character + 1}`
      : null;

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
      {range !== null && locationLabel !== null && (
        <>
          <br />
          <span
            className="empty-msg-location"
            role="button"
            tabIndex={0}
            onClick={() => vscode.postMessage({ type: NAVIGATE_TO_LINE, line: range.start.line })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                vscode.postMessage({ type: NAVIGATE_TO_LINE, line: range.start.line });
              }
            }}
          >
            {locationLabel}
          </span>
        </>
      )}
    </div>
  );
}
