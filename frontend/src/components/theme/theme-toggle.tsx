"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isMounted = useMounted();

  if (!isMounted) {
    return (
      <div
        className={cn(
          "inline-flex h-9 w-26 items-center rounded-lg border border-border bg-card p-0.5 opacity-50",
          className
        )}
      />
    );
  }

  const options = [
    { key: "light", label: "Light theme", icon: Sun },
    { key: "dark", label: "Dark theme", icon: Moon },
    { key: "system", label: "System preference", icon: Monitor },
  ] as const;

  return (
    <div
      role="group"
      aria-label="Theme selector"
      className={cn(
        "inline-flex h-9 items-center rounded-lg border border-border bg-card p-0.5 shadow-xs",
        className
      )}
    >
      {options.map(({ key, label, icon: Icon }) => {
        const isActive = theme === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setTheme(key)}
            aria-label={label}
            aria-pressed={isActive}
            className={cn(
              "relative flex h-7.5 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive && "bg-secondary text-foreground shadow-xs"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
