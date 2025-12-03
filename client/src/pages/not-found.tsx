import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardContent className="pt-12 pb-12 flex flex-col items-center text-center">
          <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/20 mb-6 animate-bounce">
            <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400" />
          </div>
          
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">404</h1>
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-4">Page Not Found</h2>
          
          <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs mx-auto leading-relaxed">
            The page you are looking for doesn't exist or has been moved.
          </p>

          <Link href="/">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all">
              <Home className="h-4 w-4 mr-2" />
              Return to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
