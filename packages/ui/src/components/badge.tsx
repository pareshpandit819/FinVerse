import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-sky-100   text-sky-700   border border-sky-200",
        secondary:   "bg-sky-50    text-sky-600   border border-sky-100",
        destructive: "bg-rose-50   text-rose-600  border border-rose-200",
        outline:     "bg-white     text-sky-700   border border-sky-200",
        success:     "bg-emerald-50 text-emerald-700 border border-emerald-200",
        warning:     "bg-amber-50  text-amber-700 border border-amber-200",
        info:        "bg-blue-50   text-blue-700  border border-blue-200",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
