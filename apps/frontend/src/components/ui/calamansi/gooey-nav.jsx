import React, { useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  FuseFilter,
  LiquidSegment,
  LIQUID_THRESHOLD,
  liquidMetrics,
  useFuseId,
} from "@/lib/liquid";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: {
    label: "gap-1.5 px-3.5 py-1.5 text-xs font-semibold",
    radius: 12,
    separation: 12,
  },
  md: {
    label: "gap-2 px-4 py-2 text-xs font-bold",
    radius: 14,
    separation: 14,
  },
  lg: {
    label: "gap-2.5 px-5 py-2.5 text-sm font-bold",
    radius: 16,
    separation: 18,
  },
};

export function GooeyNav({
  items,
  value,
  defaultValue = 0,
  onChange,
  size = "md",
  separation,
  radius,
  viscosity,
  threshold = LIQUID_THRESHOLD,
  gooey = true,
  bead = true,
  className,
  ...props
}) {
  const reduced = useReducedMotion() ?? false;
  const filterId = useFuseId("gooey-nav");

  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const active = value ?? uncontrolled;

  const gap = separation ?? SIZES[size].separation;
  const corner = radius ?? SIZES[size].radius;
  const { blur, sever, seal, pull } = liquidMetrics({
    gap,
    radius: corner,
    viscosity,
  });
  
  // Clean Light Mode Palette
  const fused = gooey && !reduced;
  const TRAY = "bg-[#e8efe2]"; // Clean soft sage light gray
  const ACTIVE_PILL = "bg-gradient-to-r from-[#2c8a38] to-[#1c6428]"; // Vibrant emerald
  const ACTIVE_JUICE = "text-[#2c8a38]";
  const TRAY_INK = "text-[#8fa37d]";

  const open = (seam) => seam - 1 === active || seam === active;

  return (
    <nav
      data-slot="gooey-nav"
      className={cn("inline-block select-none", className)}
      {...props}
    >
      <FuseFilter id={filterId} blur={blur} threshold={threshold} />

      <ul
        className="relative flex items-center p-1 rounded-2xl bg-[#e3ece0] border border-[#2a382e]/10 shadow-xs"
        style={fused ? { filter: `url(#${filterId})` } : undefined}
      >
        {items.map((item, index) => {
          const navItem = typeof item === "string" ? { label: item } : item;
          const isActive = index === active;

          return (
            <LiquidSegment
              key={`${index}-${navItem.label}`}
              seamLeft={open(index)}
              seamRight={open(index + 1)}
              atStart={index === 0}
              atEnd={index === items.length - 1}
              radius={corner}
              pull={pull}
              seal={seal}
              sever={sever}
              bead={bead}
              beadFill={open(index) ? ACTIVE_JUICE : TRAY_INK}
              paint={cn(TRAY, isActive && ACTIVE_PILL)}
              reduced={reduced}
              slot="gooey-nav-segment"
              beadSlot="gooey-nav-bead"
            >
              <button
                type="button"
                data-slot="gooey-nav-item"
                data-active={isActive}
                onClick={() => {
                  if (value === undefined) setUncontrolled(index);
                  if (navItem.onClick) navItem.onClick();
                  onChange?.(index);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-center whitespace-nowrap transition-colors select-none",
                  isActive
                    ? "transition-colors duration-[300ms] text-white"
                    : "transition-colors duration-0 text-[#4c5b4f] hover:text-[#182019]",
                  SIZES[size].label,
                )}
              >
                {navItem.icon && <span className="shrink-0 mr-1.5 flex items-center">{navItem.icon}</span>}
                <span>{navItem.label}</span>
              </button>
            </LiquidSegment>
          );
        })}
      </ul>
    </nav>
  );
}

export default GooeyNav;
