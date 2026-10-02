import React, { useId } from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  white: "text-foreground",
  calamansi: "text-[#5c7a67] dark:text-[#b4e84c]",
  slate: "text-[#687396] dark:text-[#a99fd6]",
  citrus: "text-[#b87152] dark:text-[#ffc93d]",
};

export function Marquee({
  children,
  className,
  variant = "calamansi",
  duration = 25,
  reverse = false,
  pauseOnHover = true,
  fade = true,
  gap = 20,
  repeat = 6,
  vertical = false,
}) {
  const animId = `marquee-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const gapValue = typeof gap === "number" ? `${gap}px` : gap;

  const fadeMask = vertical
    ? "linear-gradient(to bottom, transparent, #000 8%, #000 92%, transparent)"
    : "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)";

  return (
    <div
      className={cn(
        "group relative flex w-full overflow-hidden",
        VARIANTS[variant] || VARIANTS.calamansi,
        vertical ? "flex-col" : "flex-row",
        className,
      )}
      style={{
        gap: gapValue,
        maskImage: fade ? fadeMask : undefined,
        WebkitMaskImage: fade ? fadeMask : undefined,
      }}
    >
      <style>{`
        @keyframes ${animId} {
          from {
            transform: ${
              vertical
                ? reverse
                  ? `translateY(calc(-100% - ${gapValue}))`
                  : "translateY(0)"
                : reverse
                  ? `translateX(calc(-100% - ${gapValue}))`
                  : "translateX(0)"
            };
          }
          to {
            transform: ${
              vertical
                ? reverse
                  ? "translateY(0)"
                  : `translateY(calc(-100% - ${gapValue}))`
                : reverse
                  ? "translateX(0)"
                  : `translateX(calc(-100% - ${gapValue}))`
            };
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .${animId} {
            animation: none !important;
          }
        }
      `}</style>

      {Array.from({ length: repeat }, (_, copy) => (
        <div
          key={copy}
          aria-hidden={copy > 0}
          className={cn(
            "flex shrink-0 items-center",
            animId,
            vertical ? "flex-col" : "flex-row",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
          )}
          style={{
            gap: gapValue,
            animationName: animId,
            animationDuration: `${duration}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            willChange: "transform",
          }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
