import React, { useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { Squircle } from "@/lib/squircle";
import { cn } from "@/lib/utils";

const SURFACE = "relative flex flex-col p-5 select-none sm:p-6";

const VARIANTS = {
  white: {
    paint: "bg-white",
    ink: "text-[#182019]",
  },
  calamansi: {
    paint: "bg-gradient-to-br from-[#8fa37d] via-[#5c7a67] to-[#39564a]",
    ink: "text-white",
  },
  slate: {
    paint: "bg-gradient-to-br from-[#a79cb7] via-[#687396] to-[#4a5a7f]",
    ink: "text-white",
  },
  citrus: {
    paint: "bg-gradient-to-br from-[#d69f7e] via-[#b87152] to-[#7d4128]",
    ink: "text-white",
  },
};

const CONTENT = "relative z-10 flex flex-1 flex-col";

export function TiltCard({
  children,
  className,
  title,
  subtitle,
  icon,
  badge,
  header,
  maxTilt = 10,
  hoverScale = 1.02,
  glare = true,
  stiffness = 220,
  damping = 18,
  variant = "calamansi",
  onClick,
}) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);

  const rotateX = useSpring(
    useTransform(pointerY, [0, 1], [maxTilt, -maxTilt]),
    { stiffness, damping },
  );
  const rotateY = useSpring(
    useTransform(pointerX, [0, 1], [-maxTilt, maxTilt]),
    { stiffness, damping },
  );

  const glareX = useTransform(pointerX, [0, 1], [0, 100]);
  const glareY = useTransform(pointerY, [0, 1], [0, 100]);
  const glareBackground = useMotionTemplate`radial-gradient(320px circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.35), transparent 65%)`;

  const track = (event) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return;

    pointerX.set((event.clientX - bounds.left) / bounds.width);
    pointerY.set((event.clientY - bounds.top) / bounds.height);
  };

  const reset = () => {
    setHovered(false);
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  const hasTopHeader = Boolean(header || title || icon || subtitle || badge);

  return (
    <div
      ref={ref}
      onPointerMove={track}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={reset}
      onClick={onClick}
      style={{ perspective: 1500 }}
      className="w-full cursor-pointer"
    >
      <motion.div
        style={
          reduceMotion
            ? undefined
            : { rotateX, rotateY, transformStyle: "preserve-3d" }
        }
        whileHover={reduceMotion ? undefined : { scale: hoverScale }}
        transition={{ type: "spring", stiffness, damping }}
        className={cn(SURFACE, VARIANTS[variant]?.ink || VARIANTS.calamansi.ink, className)}
      >
        <Squircle className={VARIANTS[variant]?.paint || VARIANTS.calamansi.paint}>
          {glare && (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0"
              style={{ background: glareBackground }}
            />
          )}
        </Squircle>

        <div className={CONTENT}>
          {hasTopHeader && (
            <div className="mb-4 flex items-start justify-between gap-3">
              {header ? (
                header
              ) : (
                <div className="flex items-center gap-3 min-w-0">
                  {icon && (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-current/15 text-current ring-1 ring-current/20">
                      {icon}
                    </span>
                  )}
                  {(title || subtitle) && (
                    <div className="min-w-0">
                      {title && (
                        <h3 className="truncate text-base font-bold tracking-tight">
                          {title}
                        </h3>
                      )}
                      {subtitle && (
                        <p className="truncate text-xs font-medium text-current/70">
                          {subtitle}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
          )}

          {children}
        </div>
      </motion.div>
    </div>
  );
}
