import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
        <AlertTriangle className="h-12 w-12 text-red-500" />
      </div>
      <h1 className="text-4xl font-bold font-display text-foreground mb-4">৪০৪</h1>
      <h2 className="text-2xl font-semibold mb-2">পৃষ্ঠাটি পাওয়া যায়নি</h2>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        দুঃখিত, আপনি যে পৃষ্ঠাটি খুঁজছেন তা বিদ্যমান নেই বা সরানো হয়েছে।
      </p>

      <Link href="/" className="w-full sm:w-auto">
        <Button size="lg" className="w-full sm:w-auto gap-2">
          <Home className="h-5 w-5" />
          হোম পেজে ফিরে যান
        </Button>
      </Link>
    </div>
  );
}
