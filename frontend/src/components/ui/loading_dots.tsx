interface LoadingDotsProps {
  size?: string;
  color?: string;
}

export function LoadingDots({ size = 'h-3.5 w-3.5', color = 'bg-blue-600' }: LoadingDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <span className={`${size} ${color} rounded-full animate-bounce`} style={{ animationDelay: '0s' }} />
      <span className={`${size} ${color} rounded-full animate-bounce`} style={{ animationDelay: '0.2s' }} />
      <span className={`${size} ${color} rounded-full animate-bounce`} style={{ animationDelay: '0.4s' }} />
    </div>
  );
}