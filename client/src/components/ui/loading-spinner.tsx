import { Loader2 } from "lucide-react";

export function LoadingSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function PageLoader() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background gap-4">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
        <LoadingSpinner className="h-12 w-12 text-primary relative z-10" />
      </div>
      <p className="text-muted-foreground animate-pulse font-medium">লোড হচ্ছে...</p>
    </div>
  );
}
