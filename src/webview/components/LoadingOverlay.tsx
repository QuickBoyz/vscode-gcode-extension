export function LoadingOverlay() {
  return (
    <div id="loading-overlay">
      <div className="spinner" />
      <span className="loading-text">Parsing...</span>
    </div>
  );
}
