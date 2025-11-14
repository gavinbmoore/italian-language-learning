import * as React from "react"

import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: string; onValueChange?: (value: string) => void }
>(({ className, value, onValueChange, children, ...props }, ref) => {
  const handleChange = (newValue: string) => {
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  return (
    <div
      ref={ref}
      className={cn("grid gap-2", className)}
      role="radiogroup"
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            ...child.props,
            checked: child.props.value === value,
            onSelect: () => handleChange(child.props.value),
          } as any);
        }
        return child;
      })}
    </div>
  );
})
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { 
    value: string;
    checked?: boolean;
    onSelect?: () => void;
  }
>(({ className, value, checked, onSelect, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="radio"
    aria-checked={checked}
    className={cn(
      "flex items-center space-x-2 rounded-md border border-input p-3 text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      checked && "border-primary bg-primary/10",
      className
    )}
    onClick={onSelect}
    {...props}
  >
    <div
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary",
        checked && "bg-primary"
      )}
    >
      {checked && (
        <div className="h-full w-full rounded-full bg-primary flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-white" />
        </div>
      )}
    </div>
    {children}
  </button>
))
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }

