export default function TestDeployPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white">Test Deploy Page</h1>
      <p className="text-zinc-400">If you see this, the deployment worked!</p>
      <p className="text-zinc-500">Timestamp: {new Date().toISOString()}</p>
    </div>
  );
}
