import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import {
  FuseFilter,
  LiquidSegment,
  LIQUID_SPRING,
  LIQUID_THRESHOLD,
  liquidMetrics,
  useFuseId,
} from "@/lib/liquid";
import { cn } from "@/lib/utils";

const WIDTH_SPRING = { stiffness: 250, damping: 31 };
const ERROR_SPRING = { stiffness: 700, damping: 9 };
const SWAY_SPRING = { stiffness: 200, damping: 24 };
const ICON_SPRING = { stiffness: 300, damping: 30 };
const REFUSAL = 6;

const PEN_PATH =
  "M3.78181 16.3092L3 21L7.69086 20.2182C8.50544 20.0825 9.25725 19.6956 9.84119 19.1116L20.4198 8.53288C21.1934 7.75922 21.1934 6.5049 20.4197 5.73126L18.2687 3.58024C17.495 2.80658 16.2406 2.80659 15.4669 3.58027L4.88841 14.159C4.30447 14.7429 3.91757 15.4947 3.78181 16.3092Z";
const TICK_PATH = "M4.6 12.4 9.6 17.4 19.4 7.6";

const VARIANTS = {
  white: {
    paint: "bg-white",
    juice: "text-white",
    ink: "text-[#182019]",
  },
  calamansi: {
    paint: "bg-[#2c8a38]",
    juice: "text-[#2c8a38]",
    ink: "text-white",
  },
  slate: {
    paint: "bg-[#687396]",
    juice: "text-[#687396]",
    ink: "text-white",
  },
  citrus: {
    paint: "bg-[#b87152]",
    juice: "text-[#b87152]",
    ink: "text-white",
  },
};

const TRAY = "bg-[#e8efe2]";
const TRAY_INK = "text-[#c2d3b8]";

const SIZES = {
  sm: {
    bar: "h-9",
    radius: 14,
    gap: 10,
    field: "px-3",
    toggle: "size-9",
    icon: "size-3.5",
    text: "text-xs",
    unit: "text-[10px]",
    box: 36,
  },
  md: {
    bar: "h-11",
    radius: 18,
    gap: 12,
    field: "px-3.5",
    toggle: "size-11",
    icon: "size-4",
    text: "text-sm",
    unit: "text-xs",
    box: 42,
  },
  lg: {
    bar: "h-13",
    radius: 22,
    gap: 14,
    field: "px-4",
    toggle: "size-13",
    icon: "size-5",
    text: "text-base",
    unit: "text-sm",
    box: 48,
  },
};

function fieldText(value, field) {
  const n = value?.[field];
  return n === undefined || n === 0 ? "" : String(n);
}

const clampField = (raw, max) =>
  Math.min(max, Math.max(0, Math.trunc(raw) || 0));

function DurationField({
  value,
  onValueChange,
  onCommit,
  max,
  label,
  editing,
  reduced,
  disabled,
  sway,
  size,
  inputRef,
}) {
  const preset = SIZES[size] || SIZES.md;
  const refusal = useSpring(0, ERROR_SPRING);
  const x = useTransform(() => sway.get() + refusal.get());

  const handleChange = (event) => {
    const next = event.target.value;
    if (next !== "" && (Number(next) > max || Number(next) < 0)) {
      onValueChange(String(clampField(Number(next), max)));
      if (!reduced) {
        refusal.jump(REFUSAL);
        refusal.set(0);
      }
      return;
    }
    onValueChange(next);
  };

  return (
    <motion.input
      ref={inputRef}
      type="number"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit();
        }
      }}
      placeholder={editing ? "" : "0"}
      readOnly={!editing}
      disabled={disabled}
      aria-label={label}
      min={0}
      max={max}
      style={{ x }}
      animate={{ width: editing ? preset.box : 24 }}
      transition={
        reduced ? { duration: 0 } : { type: "spring", ...WIDTH_SPRING }
      }
      className={cn(
        "h-full shrink-0 bg-transparent text-center font-bold tabular-nums text-[#182019] outline-none",
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        preset.text,
      )}
    />
  );
}

export function DurationPicker({
  value,
  defaultValue = { hours: 3, minutes: 0 },
  onChange,
  onConfirm,
  onEditingChange,
  editing: editingProp,
  defaultEditing = false,
  maxHours = 24,
  maxMinutes = 59,
  hoursLabel = "Hr.",
  minutesLabel = "Min.",
  variant = "calamansi",
  size = "md",
  gap: gapProp,
  radius: radiusProp,
  viscosity,
  threshold = LIQUID_THRESHOLD,
  gooey = true,
  bead = true,
  disabled = false,
  className,
  ...props
}) {
  const reduced = useReducedMotion() ?? false;
  const filterId = useFuseId("duration-picker");
  const preset = SIZES[size] || SIZES.md;
  const palette = VARIANTS[variant] || VARIANTS.calamansi;

  const gap = gapProp ?? preset.gap;
  const corner = radiusProp ?? preset.radius;
  const { blur, sever, seal, pull } = liquidMetrics({
    gap,
    radius: corner,
    viscosity,
  });
  const fused = gooey && !reduced;

  const [uncontrolledEditing, setUncontrolledEditing] = useState(defaultEditing);
  const editing = editingProp ?? uncontrolledEditing;

  const [hours, setHours] = useState(() =>
    fieldText(value ?? defaultValue, "hours"),
  );
  const [minutes, setMinutes] = useState(() =>
    fieldText(value ?? defaultValue, "minutes"),
  );
  const hoursRef = useRef(null);

  const open = useSpring(defaultEditing ? 1 : 0, LIQUID_SPRING);
  useEffect(() => {
    const to = editing ? 1 : 0;
    if (reduced) open.jump(to);
    else open.set(to);
  }, [editing, reduced, open]);

  const velocity = useVelocity(open);
  const swayRaw = useTransform(velocity, [-3, 0, 3], [-3, 0, 3], {
    clamp: true,
  });
  const sway = useSpring(swayRaw, SWAY_SPRING);

  const toValue = (nextHours, nextMinutes) => ({
    hours: clampField(Number(nextHours), maxHours),
    minutes: clampField(Number(nextMinutes), maxMinutes),
  });

  const applyEditing = (next) => {
    if (editingProp === undefined) setUncontrolledEditing(next);
    onEditingChange?.(next);
  };

  const commit = () => {
    applyEditing(false);
    onConfirm?.(toValue(hours, minutes));
  };

  const toggleEditing = () => {
    if (disabled) return;
    if (editing) {
      commit();
      return;
    }
    applyEditing(true);
    setTimeout(() => hoursRef.current?.focus(), 50);
  };

  const handleHours = (text) => {
    setHours(text);
    onChange?.(toValue(text, minutes));
  };

  const handleMinutes = (text) => {
    setMinutes(text);
    onChange?.(toValue(hours, text));
  };

  const transition = reduced ? { duration: 0 } : ICON_SPRING;

  return (
    <div
      data-slot="duration-picker"
      data-editing={editing || undefined}
      data-disabled={disabled || undefined}
      data-variant={variant}
      className={cn(
        "relative inline-flex select-none",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <FuseFilter id={filterId} blur={blur} threshold={threshold} />

      <ul
        className={cn("relative flex items-stretch", preset.bar)}
        style={fused ? { filter: `url(#${filterId})` } : undefined}
      >
        <LiquidSegment
          seamLeft={false}
          seamRight={editing}
          atStart
          atEnd={false}
          radius={corner}
          pull={pull}
          seal={seal}
          sever={sever}
          bead={bead}
          beadFill={palette.juice}
          paint={TRAY}
          reduced={reduced}
          slot="duration-picker-segment"
          beadSlot="duration-picker-bead"
        >
          <div className={cn("flex h-full items-center gap-0.5", preset.field)}>
            <DurationField
              value={hours}
              onValueChange={handleHours}
              onCommit={commit}
              max={maxHours}
              label="Hours"
              editing={editing}
              reduced={reduced}
              disabled={disabled}
              sway={sway}
              size={size}
              inputRef={hoursRef}
            />
            <motion.span
              style={{ x: sway }}
              className={cn(
                "shrink-0 font-medium text-[#687066]",
                preset.unit,
              )}
            >
              {hoursLabel}
            </motion.span>
          </div>
        </LiquidSegment>

        <LiquidSegment
          seamLeft={editing}
          seamRight={editing}
          atStart={false}
          atEnd={false}
          radius={corner}
          pull={pull}
          seal={seal}
          sever={sever}
          bead={bead}
          beadFill={TRAY_INK}
          paint={TRAY}
          reduced={reduced}
          slot="duration-picker-segment"
          beadSlot="duration-picker-bead"
        >
          <div className={cn("flex h-full items-center gap-0.5", preset.field)}>
            <DurationField
              value={minutes}
              onValueChange={handleMinutes}
              onCommit={commit}
              max={maxMinutes}
              label="Minutes"
              editing={editing}
              reduced={reduced}
              disabled={disabled}
              sway={sway}
              size={size}
            />
            <motion.span
              style={{ x: sway }}
              className={cn(
                "shrink-0 font-medium text-[#687066]",
                preset.unit,
              )}
            >
              {minutesLabel}
            </motion.span>
          </div>
        </LiquidSegment>

        <LiquidSegment
          seamLeft={editing}
          seamRight={false}
          atStart={false}
          atEnd
          radius={corner}
          pull={pull}
          seal={seal}
          sever={sever}
          bead={bead}
          beadFill={palette.juice}
          paint={cn(TRAY, editing && palette.paint)}
          reduced={reduced}
          slot="duration-picker-segment"
          beadSlot="duration-picker-bead"
        >
          <button
            type="button"
            data-slot="duration-picker-toggle"
            onClick={toggleEditing}
            disabled={disabled}
            aria-label={editing ? "Save duration" : "Edit duration"}
            className={cn(
              "flex cursor-pointer items-center justify-center transition-transform duration-200 active:scale-90",
              preset.toggle,
              editing
                ? palette.ink
                : "text-[#687066] hover:text-[#182019]",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={cn("overflow-visible", preset.icon)}
            >
              <motion.path
                d={PEN_PATH}
                fill="currentColor"
                initial={false}
                animate={{ opacity: editing ? 0 : 1, y: editing ? -3 : 0 }}
                transition={transition}
              />
              <motion.path
                d={TICK_PATH}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={false}
                animate={{
                  pathLength: editing ? 1 : 0,
                  opacity: editing ? 1 : 0,
                }}
                transition={transition}
              />
            </svg>
          </button>
        </LiquidSegment>
      </ul>
    </div>
  );
}

export default DurationPicker;
