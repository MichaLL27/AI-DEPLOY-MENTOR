import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (prefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  if (!mounted) {
    return <Button size="icon" variant="ghost" disabled className="opacity-0" />;
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="relative overflow-hidden transition-all hover:bg-muted"
    >
      <div className={cn(
        "absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out transform",
        theme === "dark" ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
      )}>
        <Moon className="h-5 w-5 text-blue-400" />
      </div>
      <div className={cn(
        "absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out transform",
        theme === "light" ? "rotate-0 opacity-100" : "rotate-90 opacity-0"
      )}>
        <Sun className="h-5 w-5 text-orange-500" />
      </div>
    </Button>
  );
}
