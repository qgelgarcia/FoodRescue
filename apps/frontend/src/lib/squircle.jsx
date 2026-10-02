import React, { useMemo } from "react";
import { getSvgPath } from "figma-squircle";
import useMeasure from "react-use-measure";
import { cn } from "./utils";

export const SQUIRCLE_RADIUS = 28;
export const SQUIRCLE_SMOOTHING = 1;
export const SQUIRCLE_SHARE = 0.44;
export const SQUIRCLE_LIFT = "drop-shadow(0 14px 28px rgba(0, 0, 0, 0.24))";

export const squircleLift = (...layers) =>
  `var(--squircle-lift, ${layers.join(", ")})`;

export const NO_LIFT = { "--squircle-lift": "none" };

export function Squircle({
  className,
  radius = SQUIRCLE_RADIUS,
  share,
  smoothing = SQUIRCLE_SMOOTHING,
  lift = true,
  filter,
  border,
  borderWidth = 1,
  children,
}) {
  const [ref, bounds] = useMeasure({ offsetSize: true });

  const corner =
    share && bounds.height > 0
      ? Math.min(radius, bounds.height * share)
      : radius;

  const fallback = share ? `min(${radius}px, ${share * 100}%)` : `${radius}px`;

  const path = useMemo(
    () =>
      bounds.width > 0 && bounds.height > 0
        ? getSvgPath({
            width: bounds.width,
            height: bounds.height,
            cornerRadius: corner,
            cornerSmoothing: smoothing,
          })
        : null,
    [bounds.width, bounds.height, corner, smoothing],
  );

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 block"
      style={{
        filter: filter ?? (lift ? squircleLift(SQUIRCLE_LIFT) : undefined),
      }}
    >
      <span
        ref={ref}
        style={
          path ? { clipPath: `path('${path}')` } : { borderRadius: fallback }
        }
        className={cn("relative block size-full overflow-hidden", className)}
      >
        {children}

        {border &&
          (path ? (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full"
              fill="none"
            >
              <path
                d={path}
                className={border}
                stroke="currentColor"
                strokeWidth={borderWidth * 2}
              />
            </svg>
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 block",
                border,
              )}
              style={{
                borderRadius: fallback,
                boxShadow: `inset 0 0 0 ${borderWidth}px currentColor`,
              }}
            />
          ))}
      </span>
    </span>
  );
}
