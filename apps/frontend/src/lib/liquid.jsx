import { useEffect, useId } from "react";
import { motion, useSpring, useTransform } from "motion/react";
import { SQUIRCLE_SMOOTHING, Squircle } from "@/lib/squircle";
import { cn } from "@/lib/utils";

export const LIQUID_SPRING = {
  type: "spring",
  stiffness: 200,
  damping: 28,
  mass: 1,
};

export const LIQUID_SEVER = 1.234;
export const LIQUID_VISCOSITY = 0.55;
export const LIQUID_THRESHOLD = 19;
export const LIQUID_SEAL = 2;
export const BEAD_SIZE = 0.18;
export const BEAD_FADE = 0.22;
export const BEAD_PEAK_MAX = 0.92;

export function liquidMetrics({
  gap,
  radius,
  viscosity,
}) {
  const blur = viscosity ?? gap * LIQUID_VISCOSITY;

  return {
    blur,
    sever: LIQUID_SEVER * blur,
    seal: LIQUID_SEAL * radius,
    pull: gap / 2,
  };
}

export function useFuseId(prefix) {
  return `${prefix}-${useId().replace(/:/g, "")}`;
}

export function beadPercent(gap, sever, open) {
  if (!Number.isFinite(gap) || open <= 0) return 0;

  const travel = gap / open;
  if (travel <= 0) return 0;

  const peak = Math.min(sever / open, BEAD_PEAK_MAX);
  if (travel < peak) return BEAD_SIZE * 100 * (travel / peak) ** 1.6;

  const fade = Math.min(BEAD_FADE, 1 - peak);
  const past = (travel - peak) / fade;
  return past >= 1 ? 0 : BEAD_SIZE * 100 * (1 - past);
}

export const SWALLOW_REACH = 0.25;

export function swallowShare(retracted, pull) {
  if (pull <= 0) return 1;

  const reach = SWALLOW_REACH * pull;
  const s = Math.min(1, Math.max(0, (reach - retracted) / reach));
  return s * s * (3 - 2 * s);
}

export function FuseFilter({
  id,
  blur,
  threshold = LIQUID_THRESHOLD,
  region,
}) {
  const box = {
    x: "-8%",
    y: "-60%",
    width: "116%",
    height: "220%",
    ...region,
  };

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute size-0">
      <defs>
        <filter
          id={id}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={blur}
            result="blur"
          />
          <feColorMatrix
            in="blur"
            type="matrix"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${threshold} ${-threshold / 2}`}
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

export function LiquidSegment({
  as = "li",
  className,
  seamLeft,
  seamRight,
  atStart,
  atEnd,
  radius,
  share,
  pull,
  seal,
  sever,
  bead = false,
  beadFill,
  paint,
  reduced = false,
  slot = "liquid-segment",
  beadSlot = `${slot}-bead`,
  children,
}) {
  const retractLeft = useSpring(!atStart && seamLeft ? pull : 0, LIQUID_SPRING);
  const retractRight = useSpring(!atEnd && seamRight ? pull : 0, LIQUID_SPRING);

  useEffect(() => {
    const to = {
      left: !atStart && seamLeft ? pull : 0,
      right: !atEnd && seamRight ? pull : 0,
    };

    if (reduced) {
      retractLeft.jump(to.left);
      retractRight.jump(to.right);
    } else {
      retractLeft.set(to.left);
      retractRight.set(to.right);
    }
  }, [
    atStart,
    atEnd,
    seamLeft,
    seamRight,
    pull,
    reduced,
    retractLeft,
    retractRight,
  ]);

  const left = useTransform(() => {
    const retracted = retractLeft.get();
    return retracted - (atStart ? 0 : seal * swallowShare(retracted, pull));
  });
  const right = useTransform(() => {
    const retracted = retractRight.get();
    return retracted - (atEnd ? 0 : seal * swallowShare(retracted, pull));
  });

  const shift = useTransform(
    () => (Math.max(0, left.get()) - Math.max(0, right.get())) / 2,
  );

  const beadHeight = useTransform(
    () => `${beadPercent(left.get() * 2, sever, pull * 2)}%`,
  );

  const Tag = as;
  const Content = as === "span" ? motion.span : motion.div;

  return (
    <Tag data-slot={slot} className={cn("relative flex", className)}>
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 block"
        style={{ left, right }}
      >
        <Squircle
          radius={radius}
          share={share}
          smoothing={SQUIRCLE_SMOOTHING}
          lift={false}
          className={cn("transition-colors duration-300 ease-out", paint)}
        />
      </motion.span>

      {bead && !atStart && (
        <motion.span
          aria-hidden="true"
          data-slot={beadSlot}
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current",
            beadFill,
          )}
          style={{ left: 0, height: beadHeight, aspectRatio: 1 }}
        />
      )}

      <Content className="relative z-10 flex min-w-0" style={{ x: shift }}>
        {children}
      </Content>
    </Tag>
  );
}
