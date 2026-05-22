"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  showLabel?: string;
  hideLabel?: string;
};

function PasswordInput({
  className,
  showLabel = "Show password",
  hideLabel = "Hide password",
  disabled,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-9", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        title={visible ? hideLabel : showLabel}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 right-0 grid w-9 place-items-center rounded-r-md",
          "text-muted-foreground transition-colors",
          "hover:text-foreground",
          "focus-visible:text-foreground focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <Icon
          aria-hidden
          className={cn(
            "size-4 transition-all duration-150",
            visible ? "scale-100 opacity-100" : "scale-100 opacity-80",
          )}
        />
      </button>
    </div>
  );
}

export { PasswordInput };
