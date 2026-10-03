import React, { createContext, useContext, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

const DockMouseContext = createContext(null);

const DockConfigContext = createContext({
  reach: 100,
  size: 42,
  magnify: 56,
});

const PANEL = "relative flex items-center justify-center gap-3 overflow-visible px-4 py-2 select-none rounded-full bg-white/70 backdrop-blur-[60px] border border-white/80 shadow-[0_12px_40px_0_rgba(0,0,0,0.08)] mx-auto w-max";

const ITEM = "relative flex cursor-pointer items-center justify-center rounded-full transition-colors duration-300 focus-visible:outline-none";

export function Dock({
  children,
  className,
  reach = 100,
  size = 42,
  magnify = 56,
}) {
  const mouseX = useMotionValue(Infinity);

  return (
    <DockMouseContext.Provider value={mouseX}>
      <motion.div
        onPointerMove={(event) => mouseX.set(event.pageX)}
        onPointerLeave={() => mouseX.set(Infinity)}
        className={cn(PANEL, className)}
      >
        <DockConfigContext.Provider value={{ reach, size, magnify }}>
          {children}
        </DockConfigContext.Provider>
      </motion.div>
    </DockMouseContext.Provider>
  );
}

export function DockItem({
  children,
  className,
  onClick,
  active = false,
  ariaLabel,
}) {
  const dockMouseX = useContext(DockMouseContext);
  const { reach, size, magnify } = useContext(DockConfigContext);
  const reduceMotion = useReducedMotion();
  const ref = useRef(null);

  const localMouseX = useMotionValue(Infinity);
  const mouseX = dockMouseX ?? localMouseX;

  const distance = useTransform(mouseX, (value) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return reach;
    return value - bounds.x - bounds.width / 2;
  });

  const animatedSize = useTransform(
    distance,
    [-reach, 0, reach],
    [size, magnify, size],
  );
  
  const springSize = useSpring(animatedSize, {
    mass: 0.1,
    stiffness: 200,
    damping: 15,
  });

  const expandedSize = useTransform(springSize, s => s * 1.7);

  return (
    <div
      ref={ref}
      className="relative flex flex-col items-center justify-center"
    >
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        title={ariaLabel}
        style={{
          width: active ? (reduceMotion ? size * 1.7 : expandedSize) : (reduceMotion ? size : springSize),
          height: reduceMotion ? size : springSize,
        }}
        className={cn(
          ITEM, 
          active 
            ? "text-black" 
            : "bg-transparent text-black/70 hover:bg-black/5 hover:text-black",
          className
        )}
      >
        {active && (
          <motion.div
            layoutId="dock-active-indicator"
            className="absolute inset-0 bg-black/10 rounded-[100px]"
            transition={{ type: "spring", stiffness: 350, damping: 25, mass: 0.8 }}
          />
        )}
        <div className="relative z-10 flex items-center justify-center">
          {children}
        </div>
      </motion.button>
    </div>
  );
}

export default Dock;
