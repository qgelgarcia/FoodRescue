import React, { useState, forwardRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Squircle, SQUIRCLE_SHARE } from "@/lib/squircle";
import { cn } from "@/lib/utils";

const SWAP_IN = { duration: 0.28, ease: [0.16, 1, 0.3, 1] };
const SWAP_OUT = { duration: 0.16, ease: [0.7, 0, 0.84, 0] };
const BOX_MORPH = "transition-[width,height,border-radius] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";
const PADDING_MORPH = "transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";
const SURFACE = "relative flex cursor-pointer select-none items-center justify-center";

export const DynamicIsland = forwardRef(function DynamicIsland(
  {
    state,
    defaultState = "compact",
    onStateChange,
    icon,
    leading,
    trailing,
    title,
    expandedContent,
    interactive = true,
    className,
    pulse = false,
  },
  ref,
) {
  const [internalState, setInternalState] = useState(defaultState);
  const currentState = state ?? internalState;
  const reduceMotion = useReducedMotion();

  const isExpanded = currentState === "expanded";
  const isAlert = currentState === "alert";
  const showPulse = pulse && (currentState === "compact" || currentState === "idle");

  const toggleExpand = () => {
    if (!interactive) return;
    const nextState = isExpanded ? "compact" : "expanded";
    if (state === undefined) {
      setInternalState(nextState);
    }
    onStateChange?.(nextState);
  };

  const sizeClass = (() => {
    switch (currentState) {
      case "idle":
        return "h-10 w-36";
      case "compact":
        return "h-11 w-full max-w-72";
      case "alert":
        return "h-11 w-full max-w-80";
      case "expanded":
        return "h-56 w-full max-w-96";
      default:
        return "h-11 w-full max-w-72";
    }
  })();

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center p-1 select-none",
        className,
      )}
    >
      <motion.div
        ref={ref}
        onClick={toggleExpand}
        className={cn(
          SURFACE,
          BOX_MORPH,
          "text-[#182019]",
          sizeClass,
          !interactive && "cursor-default",
        )}
      >
        {/* Light Mode Capsule */}
        <div
          className="bg-white border border-[#2c8a38]/20 shadow-lg shadow-emerald-950/10 rounded-[2rem] w-full h-full overflow-hidden"
        >
          <div
            className={cn(
              "relative flex size-full pointer-events-auto " + PADDING_MORPH,
              isExpanded
                ? "flex-col justify-between p-4 sm:p-5"
                : "items-center justify-between px-3.5",
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isExpanded ? (
                <motion.div
                  key="expanded"
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -6, transition: SWAP_OUT }
                  }
                  transition={reduceMotion ? { duration: 0 } : SWAP_IN}
                  className="relative flex size-full flex-col justify-between gap-3 text-left"
                >
                  {expandedContent}
                </motion.div>
              ) : (
                <motion.div
                  key="collapsed"
                  initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 6, transition: SWAP_OUT }
                  }
                  transition={reduceMotion ? { duration: 0 } : SWAP_IN}
                  className="relative flex size-full items-center justify-between gap-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {leading && <span className="shrink-0 flex items-center">{leading}</span>}
                    {title && (
                      <div className="truncate text-xs font-bold text-[#182019] tracking-tight">
                        {title}
                      </div>
                    )}
                    {showPulse && (
                      <span aria-hidden="true" className="relative flex size-2 shrink-0">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
                      </span>
                    )}
                  </div>
                  {trailing && (
                    <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#2c8a38]">
                      {trailing}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

DynamicIsland.displayName = "DynamicIsland";
export default DynamicIsland;
