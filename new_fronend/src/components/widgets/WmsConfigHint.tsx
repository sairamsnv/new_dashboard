export default function WmsConfigHint() {
  return (
    <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
      API base URL is not set. Open the app from your Django server (e.g.{' '}
      <span className="font-mono text-foreground">http://127.0.0.1:8000</span>), or set{' '}
      <span className="mx-1 font-mono text-foreground">VITE_WMS_API_BASE_URL</span> in{' '}
      <span className="font-mono text-foreground">.env</span> if the UI runs on another port.
    </div>
  );
}
