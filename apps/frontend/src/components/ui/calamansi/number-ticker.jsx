import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Squircle } from "@/lib/squircle";
import { cn } from "@/lib/utils";

const DIGITS_UP = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const DIGITS_DOWN = [...DIGITS_UP].reverse();

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const FORMAT = (value) => NUMBER.format(value);

const SURFACE = "relative inline-flex p-1.5 font-bold select-none sm:p-2";

const VARIANTS = {
  white: {
    paint: "bg-white",
    ink: "text-[#182019]",
  },
  calamansi: {
    paint: "bg-[#e8efe2]",
    ink: "text-[#0c6b20]",
  },
  slate: {
    paint: "bg-slate-100",
    ink: "text-slate-800",
  },
  citrus: {
    paint: "bg-amber-100",
    ink: "text-amber-800",
  },
  transparent: {
    paint: "hidden",
    ink: "text-inherit",
  },
};

const ROW = "relative z-10 inline-flex items-center px-2 py-0.5 tabular-nums sm:px-2.5";

export function NumberTicker({
  value = 0,
  className,
  variant = "calamansi",
  duration = 0.7,
  stagger = 0.05,
  direction = "up",
  prefix,
  suffix,
  format = FORMAT,
}) {
  const reduceMotion = useReducedMotion();
  const text = format(value);
  const characters = [...text];

  return (
    <span className={cn(SURFACE, VARIANTS[variant]?.ink || VARIANTS.calamansi.ink, className)}>
      <Squircle className={VARIANTS[variant]?.paint || VARIANTS.calamansi.paint} radius={14} />

      <span className="sr-only">{`${prefix ?? ""}${text}${suffix ?? ""}`}</span>

      <span className={ROW}>
        <span aria-hidden className="inline-flex items-center tabular-nums drop-shadow-sm">
          {prefix}

          {characters.map((character, index) => (
            <DigitColumn
              key={characters.length - index}
              character={character}
              duration={reduceMotion ? 0 : duration}
              delay={reduceMotion ? 0 : (characters.length - index - 1) * stagger}
              direction={direction}
            />
          ))}

          {suffix}
        </span>
      </span>
    </span>
  );
}

function DigitColumn({ character, duration, delay, direction }) {
  if (!/\d/.test(character)) {
    return <span className="inline-block leading-none">{character}</span>;
  }

  const strip = direction === "down" ? DIGITS_DOWN : DIGITS_UP;
  const digit = Number(character);
  const offset = (direction === "down" ? 9 - digit : digit) * 10;

  return (
    <span
      className="relative inline-block h-[1em] overflow-hidden leading-none"
      style={{ width: "0.62em" }}
    >
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col"
        initial={false}
        animate={{ y: `${-offset}%` }}
        transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform" }}
      >
        {strip.map((row) => (
          <span
            key={row}
            className="flex h-[1em] shrink-0 items-center justify-center leading-none"
          >
            {row}
          </span>
        ))}
      </motion.span>
    </span>
  );
}
