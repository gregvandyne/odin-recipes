"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

/**
 * Form field primitives. Used throughout the app so every form has the same
 * visual language, error semantics, and a11y wiring.
 *
 * Pattern:
 *   <Field>
 *     <FieldLabel htmlFor="id">…</FieldLabel>
 *     <Input id="id" aria-describedby="id-help id-err" aria-invalid={hasError} … />
 *     <FieldHelpText id="id-help">…</FieldHelpText>
 *     <FieldError id="id-err">…</FieldError>
 *   </Field>
 *
 * IDs are auto-wired via React.useId where the consumer doesn't supply one.
 */

interface FieldContextValue {
  id: string;
  helpId: string;
  errorId: string;
  hasError: boolean;
  setHasError: (hasError: boolean) => void;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

export function Field({
  id: idProp,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const generated = React.useId();
  const id = idProp ?? `field-${generated}`;
  const [hasError, setHasError] = React.useState(false);
  const value = React.useMemo<FieldContextValue>(
    () => ({
      id,
      helpId: `${id}-help`,
      errorId: `${id}-err`,
      hasError,
      setHasError,
    }),
    [id, hasError],
  );
  return (
    <FieldContext.Provider value={value}>
      <div className={cn("flex flex-col gap-1.5", className)}>{children}</div>
    </FieldContext.Provider>
  );
}

export function useField(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

export const FieldLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { optional?: boolean }
>(({ className, children, optional, htmlFor, ...props }, ref) => {
  const ctx = useField();
  return (
    <LabelPrimitive.Root
      ref={ref}
      htmlFor={htmlFor ?? ctx?.id}
      className={cn(
        "text-caption font-semibold uppercase tracking-wide text-ink-secondary",
        className,
      )}
      {...props}
    >
      {children}
      {optional && (
        <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-tertiary">
          optional
        </span>
      )}
    </LabelPrimitive.Root>
  );
});
FieldLabel.displayName = "FieldLabel";

export function FieldHelpText({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = useField();
  if (!children) return null;
  return (
    <p
      id={id ?? ctx?.helpId}
      className={cn("text-caption text-ink-tertiary", className)}
    >
      {children}
    </p>
  );
}

export function FieldError({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = useField();
  React.useEffect(() => {
    ctx?.setHasError(!!children);
  }, [ctx, children]);
  if (!children) return null;
  return (
    <p
      id={id ?? ctx?.errorId}
      role="alert"
      className={cn("text-caption font-semibold text-crisis", className)}
    >
      {children}
    </p>
  );
}

const inputBase =
  "h-11 w-full rounded-md border bg-canvas-card px-3 text-body text-ink-primary placeholder:text-ink-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, id: idProp, ...props }, ref) => {
  const ctx = useField();
  const id = idProp ?? ctx?.id;
  const describedBy = [ctx?.helpId, ctx?.hasError ? ctx?.errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;
  return (
    <input
      ref={ref}
      id={id}
      aria-describedby={describedBy}
      aria-invalid={ctx?.hasError || undefined}
      className={cn(
        inputBase,
        ctx?.hasError ? "border-crisis/60" : "border-border",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, id: idProp, rows = 4, ...props }, ref) => {
  const ctx = useField();
  const id = idProp ?? ctx?.id;
  const describedBy = [ctx?.helpId, ctx?.hasError ? ctx?.errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;
  return (
    <textarea
      ref={ref}
      id={id}
      rows={rows}
      aria-describedby={describedBy}
      aria-invalid={ctx?.hasError || undefined}
      className={cn(
        "min-h-[6rem] w-full rounded-md border bg-canvas-card p-3 text-body text-ink-primary placeholder:text-ink-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60",
        ctx?.hasError ? "border-crisis/60" : "border-border",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, id: idProp, children, ...props }, ref) => {
  const ctx = useField();
  const id = idProp ?? ctx?.id;
  const describedBy = [ctx?.helpId, ctx?.hasError ? ctx?.errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;
  return (
    <select
      ref={ref}
      id={id}
      aria-describedby={describedBy}
      aria-invalid={ctx?.hasError || undefined}
      className={cn(
        inputBase,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-9",
        ctx?.hasError ? "border-crisis/60" : "border-border",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

/**
 * Inline checkbox + label. Used for consent / opt-ins where the visual
 * weight of a separate label feels heavy.
 */
export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }
>(({ className, label, id: idProp, ...props }, ref) => {
  const generated = React.useId();
  const id = idProp ?? `chk-${generated}`;
  return (
    <label htmlFor={id} className="inline-flex items-start gap-2 text-body text-ink-secondary">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn(
          "mt-1 h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
});
Checkbox.displayName = "Checkbox";

/**
 * Radio group with consistent styling. Pass options + selected.
 */
export function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  name,
  className,
}: {
  options: { value: T; label: React.ReactNode; description?: React.ReactNode }[];
  value: T | null;
  onChange: (value: T) => void;
  name: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("flex flex-col gap-2", className)}>
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-body transition-colors",
              checked
                ? "border-primary bg-primary/5"
                : "border-border bg-canvas-card hover:bg-canvas-banded",
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="mt-1 h-4 w-4 border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink-primary">{opt.label}</div>
              {opt.description && (
                <div className="mt-0.5 text-caption text-ink-tertiary">{opt.description}</div>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
