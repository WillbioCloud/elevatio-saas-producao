import * as React from "react"

import { cn } from "../../lib/utils"

type TooltipContextValue = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  delayDuration: number
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null)

const TooltipProvider = ({
  children,
  delayDuration = 200,
}: {
  children: React.ReactNode
  delayDuration?: number
}) => <>{children}</>

const Tooltip = ({
  children,
  delayDuration = 200,
}: {
  children: React.ReactNode
  delayDuration?: number
}) => {
  const [open, setOpen] = React.useState(false)
  const timeoutRef = React.useRef<number | null>(null)

  const openWithDelay = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setOpen(true), delayDuration)
  }

  const closeNow = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    setOpen(false)
  }

  React.useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
  }, [])

  return (
    <TooltipContext.Provider value={{ open, setOpen, delayDuration }}>
      <span className="relative inline-flex" onMouseEnter={openWithDelay} onMouseLeave={closeNow} onFocus={openWithDelay} onBlur={closeNow}>
        {children}
      </span>
    </TooltipContext.Provider>
  )
}

const TooltipTrigger = ({ children, asChild }: { children: React.ReactElement; asChild?: boolean }) => {
  if (!asChild) return children
  return React.cloneElement(children)
}

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { side?: "top" | "bottom" | "left" | "right"; align?: "start" | "center" | "end" }
>(({ className, side = "top", align = "center", children, ...props }, ref) => {
  const ctx = React.useContext(TooltipContext)
  if (!ctx?.open) return null

  const sideClass =
    side === "bottom"
      ? "top-full mt-2"
      : side === "left"
      ? "right-full mr-2"
      : side === "right"
      ? "left-full ml-2"
      : "bottom-full mb-2"

  const alignClass =
    align === "start"
      ? "left-0"
      : align === "end"
      ? "right-0"
      : "left-1/2 -translate-x-1/2"

  return (
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "absolute z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
        sideClass,
        alignClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }