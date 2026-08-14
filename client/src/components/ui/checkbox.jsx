import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // Explicit brand colors: Layout sets --primary as hex, which breaks hsl(var(--primary)).
      "peer h-4 w-4 shrink-0 overflow-hidden rounded-sm border border-[#C84B31] bg-white shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C84B31] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[#C84B31] data-[state=checked]:bg-[#C84B31] data-[state=checked]:text-white",
      className
    )}
    {...props}>
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-3 w-3 stroke-[3]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
