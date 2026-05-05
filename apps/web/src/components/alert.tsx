import React from "react";

export function Alert({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-start gap-3 p-4 border rounded-lg ${className}`}>
      {children}
    </div>
  );
}

export function AlertTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`font-semibold ${className}`}>{children}</div>;
}

export function AlertDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-sm text-muted-foreground ${className}`}>{children}</div>;
}

export default Alert;
