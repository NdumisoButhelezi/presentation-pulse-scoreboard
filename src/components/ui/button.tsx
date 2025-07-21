import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Enhanced base styles for visibility, contrast, and feedback
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-md hover:shadow-xl active:scale-95 focus-visible:scale-105",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-2xl transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-primary/40",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg hover:shadow-2xl focus-visible:ring-4 focus-visible:ring-destructive/40",
        outline:
          "border-2 border-primary/60 bg-background text-primary hover:bg-primary/10 hover:text-primary-foreground hover:border-primary/80 shadow-md hover:shadow-lg focus-visible:ring-4 focus-visible:ring-primary/30",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-md hover:shadow-lg focus-visible:ring-4 focus-visible:ring-secondary/30",
        ghost: "hover:bg-accent/40 hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-accent/30",
        link: "text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary/30",
        success: "bg-success text-success-foreground hover:bg-success/90 shadow-lg hover:shadow-2xl focus-visible:ring-4 focus-visible:ring-success/40",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90 shadow-lg hover:shadow-2xl focus-visible:ring-4 focus-visible:ring-warning/40",
        gradient: "bg-gradient-to-r from-primary via-blue-500 to-accent text-white shadow-xl hover:shadow-2xl transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-primary/40 border-0",
        vote: "bg-gradient-to-r from-primary via-blue-500 to-accent text-white shadow-xl hover:shadow-2xl border-2 border-transparent hover:border-primary-glow/30 transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-primary/40",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-md px-4 py-1.5 text-sm",
        lg: "h-14 rounded-xl px-10 py-4 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
