import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-sky-600 text-white shadow-sm shadow-sky-600/30 hover:bg-sky-700 hover:shadow-md hover:shadow-sky-600/25 active:scale-[0.98]",
        destructive:
          "bg-rose-500 text-white shadow-sm hover:bg-rose-600 active:scale-[0.98]",
        outline:
          "border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 hover:border-sky-300 active:scale-[0.98]",
        secondary:
          "bg-sky-50 text-sky-700 hover:bg-sky-100 active:scale-[0.98]",
        ghost:
          "text-sky-700 hover:bg-sky-50 hover:text-sky-800 active:scale-[0.98]",
        link:
          "text-sky-600 underline-offset-4 hover:underline hover:text-sky-700",
        emerald:
          "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-600 hover:shadow-md active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-7",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
