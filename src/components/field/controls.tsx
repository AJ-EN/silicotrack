'use client';

/**
 * Field input controls.
 *
 * Every control here is sized for a gloved thumb on a 360px screen in
 * sunlight. Native <select> is avoided throughout: its dropdown is small, its
 * options are unreadable in glare, and it takes two taps. Big labelled buttons
 * take one tap and are readable at arm's length.
 */

import { useId } from 'react';

import { useLocale } from './locale';
import type { StringKey } from '@/lib/i18n';

interface FieldShellProps {
  label: StringKey;
  hint?: StringKey;
  error?: string | null;
  children: React.ReactNode;
  htmlFor?: string;
}

function FieldShell({ label, hint, error, children, htmlFor }: FieldShellProps) {
  const { t } = useLocale();
  return (
    <div className="mb-6">
      <label className="field-label" htmlFor={htmlFor}>
        {t(label)}
        {hint !== undefined && (
          <span className="ml-2 font-normal text-muted-foreground">({t(hint)})</span>
        )}
      </label>
      {children}
      {error != null && error !== '' && (
        <p role="alert" className="mt-2 text-base font-semibold text-destructive">
          {t(error as StringKey)}
        </p>
      )}
    </div>
  );
}

/**
 * A choice labels itself either by i18n key or by literal text.
 *
 * Most labels are keys. JEM task names are the exception: they carry their own
 * `labelEn`/`labelHi` on the matrix entry, and duplicating twelve task names
 * into the string table would create two places for them to drift apart.
 */
export type Choice<T extends string> =
  | { value: T; label: StringKey; text?: never }
  | { value: T; text: string; label?: never };

function choiceText<T extends string>(
  choice: Choice<T>,
  translate: (key: StringKey) => string,
): string {
  return choice.label === undefined ? choice.text : translate(choice.label);
}

interface ChoiceGroupProps<T extends string> {
  label: StringKey;
  hint?: StringKey;
  choices: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | null;
  /** Force one per row when labels are long. */
  stack?: boolean;
}

/**
 * Single-select as a row of large buttons.
 *
 * Rendered as real radio inputs behind the labels so it is operable by
 * keyboard and announced correctly, while looking like tap targets.
 */
export function ChoiceGroup<T extends string>({
  label,
  hint,
  choices,
  value,
  onChange,
  error,
  stack = false,
}: ChoiceGroupProps<T>) {
  const { t } = useLocale();
  const name = useId();

  return (
    <fieldset className="mb-6">
      <legend className="field-label">
        {t(label)}
        {hint !== undefined && (
          <span className="ml-2 font-normal text-muted-foreground">({t(hint)})</span>
        )}
      </legend>
      <div className={stack ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-2'}>
        {choices.map((choice) => {
          const selected = value === choice.value;
          return (
            <label
              key={choice.value}
              className={[
                'tap flex cursor-pointer items-center justify-center rounded-md border-2 px-3 text-center text-base font-semibold',
                selected
                  ? 'bg-foreground text-white'
                  : 'bg-white text-foreground hover:bg-neutral-100',
              ].join(' ')}
              style={{ borderColor: 'var(--field-rule)' }}
            >
              <input
                type="radio"
                name={name}
                value={choice.value}
                checked={selected}
                onChange={() => onChange(choice.value)}
                className="sr-only"
              />
              {choiceText(choice, t)}
            </label>
          );
        })}
      </div>
      {error != null && error !== '' && (
        <p role="alert" className="mt-2 text-base font-semibold text-destructive">
          {t(error as StringKey)}
        </p>
      )}
    </fieldset>
  );
}

interface TextFieldProps {
  label: StringKey;
  hint?: StringKey;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  placeholder?: StringKey;
  inputMode?: 'text' | 'numeric' | 'tel';
  maxLength?: number;
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  error,
  placeholder,
  inputMode = 'text',
  maxLength,
}: TextFieldProps) {
  const { t } = useLocale();
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder === undefined ? undefined : t(placeholder)}
        onChange={(event) => onChange(event.target.value)}
        className="field-input"
      />
    </FieldShell>
  );
}

interface NumberStepperProps {
  label: StringKey;
  unit?: StringKey;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  error?: string | null;
}

/**
 * Numeric entry as −/+ buttons around a readable value.
 *
 * A bare number input invites typos that a health worker under time pressure
 * will not catch — and "hours per day: 88" silently multiplies a worker's
 * exposure. Stepping cannot leave the valid range.
 */
export function NumberStepper({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  onChange,
  error,
}: NumberStepperProps) {
  const { t } = useLocale();
  const clamp = (next: number): number => Math.min(max, Math.max(min, next));

  return (
    <FieldShell label={label} error={error}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label="−"
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          className="tap w-16 shrink-0 rounded-md border-2 bg-white text-2xl font-bold disabled:opacity-35"
          style={{ borderColor: 'var(--field-rule)' }}
        >
          −
        </button>
        <output
          className="tap flex flex-1 items-center justify-center rounded-md border-2 bg-white text-xl font-bold tabular-nums"
          style={{ borderColor: 'var(--field-rule)' }}
        >
          {value}
          {unit !== undefined && (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {t(unit)}
            </span>
          )}
        </output>
        <button
          type="button"
          aria-label="+"
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          className="tap w-16 shrink-0 rounded-md border-2 bg-white text-2xl font-bold disabled:opacity-35"
          style={{ borderColor: 'var(--field-rule)' }}
        >
          +
        </button>
      </div>
    </FieldShell>
  );
}

interface ToggleProps {
  label: StringKey;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function YesNoToggle({ label, value, onChange }: ToggleProps) {
  return (
    <ChoiceGroup
      label={label}
      choices={[
        { value: 'yes', label: 'health.yes' },
        { value: 'no', label: 'health.no' },
      ]}
      value={value ? 'yes' : 'no'}
      onChange={(next) => onChange(next === 'yes')}
    />
  );
}

/** Primary action. Full width, unmissable, never ambiguous about its effect. */
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="tap w-full rounded-md bg-foreground px-6 text-lg font-bold text-white disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap w-full rounded-md border-2 bg-white px-6 text-lg font-semibold text-foreground"
      style={{ borderColor: 'var(--field-rule)' }}
    >
      {children}
    </button>
  );
}
