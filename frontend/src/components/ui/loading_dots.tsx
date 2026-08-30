
export function LoadingDots() {
  return (
    <div className="flex items-center justify-center gap-2">
      <span
        className="h-3.5 w-3.5 rounded-full bg-blue-600 animate-bounce"
        style={{ animationDelay: '0s' }}
      />
      <span
        className="h-3.5 w-3.5 rounded-full bg-blue-600 animate-bounce"
        style={{ animationDelay: '0.2s' }}
      />
      <span
        className="h-3.5 w-3.5 rounded-full bg-blue-600 animate-bounce"
        style={{ animationDelay: '0.4s' }}
      />
    </div>
  );
}