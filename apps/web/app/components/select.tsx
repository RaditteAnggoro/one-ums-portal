"use client";
import * as Primitive from "@radix-ui/react-select";
import {
  Children,
  isValidElement,
  Fragment,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
  type ChangeEvent,
} from "react";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import { t as tr } from "./i18n";
type Props = SelectHTMLAttributes<HTMLSelectElement>;
type Option = {
  value: string;
  label: ReactNode;
  disabled: boolean;
};
const EMPTY = "__ums_empty_option__";
function optionsOf(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: unknown;
        children?: ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === Fragment || child.type === "optgroup")
      return optionsOf(child.props.children);
    if (child.type !== "option") return [];
    return [
      {
        value: String(child.props.value ?? child.props.children ?? ""),
        label: child.props.children,
        disabled: !!child.props.disabled,
      },
    ];
  });
}
function SingleSelect({
  children,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  className = "",
  id,
  ...attributes
}: Props) {
  const options = optionsOf(children),
    [internal, setInternal] = useState(
      String(defaultValue ?? options.find((o) => !o.disabled)?.value ?? ""),
    );
  const selected = value !== undefined ? String(value) : internal;
  const [invalid, setInvalid] = useState(false),
    trigger = useRef<HTMLButtonElement>(null),
    generated = useId();
  const choose = (next: string) => {
    const actual = next === EMPTY ? "" : next;
    setInternal(actual);
    setInvalid(false);
    onChange?.({
      target: { value: actual, name: name ?? "" },
      currentTarget: { value: actual, name: name ?? "" },
    } as ChangeEvent<HTMLSelectElement>);
  };
  const label =
    options.find((o) => o.value === selected)?.label ?? tr("Pilih opsi");
  const safe = Object.fromEntries(
    Object.entries(attributes).filter(
      ([key]) =>
        key.startsWith("aria-") ||
        key.startsWith("data-") ||
        ["title", "style", "onBlur", "onFocus"].includes(key),
    ),
  );
  return (
    <span className={`ums-select ${className}`}>
      <Primitive.Root
        value={selected || EMPTY}
        onValueChange={choose}
        disabled={disabled}
      >
        <Primitive.Trigger
          {...safe}
          id={id}
          ref={trigger}
          className="ums-select-trigger"
          data-value={selected}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={
            invalid ? `${generated}-error` : attributes["aria-describedby"]
          }
        >
          <Primitive.Value>{label}</Primitive.Value>
          <Primitive.Icon className="ums-select-chevron">
            <ChevronDown size={14} />
          </Primitive.Icon>
        </Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content
            className="ums-select-content"
            position="popper"
            sideOffset={6}
            collisionPadding={12}
          >
            <Primitive.ScrollUpButton className="ums-select-scroll">
              <ChevronUp size={14} />
            </Primitive.ScrollUpButton>
            <Primitive.Viewport className="ums-select-viewport">
              {options.map((option, index) => (
                <Primitive.Item
                  key={`${option.value}-${index}`}
                  value={option.value || EMPTY}
                  disabled={option.disabled}
                  data-value={option.value}
                  className="ums-select-item"
                  textValue={
                    typeof option.label === "string" ? option.label : undefined
                  }
                >
                  <Primitive.ItemText>{option.label}</Primitive.ItemText>
                  <Primitive.ItemIndicator className="ums-select-check">
                    <Check size={14} />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              ))}
            </Primitive.Viewport>
            <Primitive.ScrollDownButton className="ums-select-scroll">
              <ChevronDown size={14} />
            </Primitive.ScrollDownButton>
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
      <select
        className="ums-select-native"
        aria-hidden="true"
        aria-label="Form value"
        tabIndex={-1}
        name={name}
        required={required}
        disabled={disabled}
        value={selected}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
        }}
      >
        {!options.some((o) => o.value === "") && <option value="" />}
        {options.map((o, i) => (
          <option key={i} value={o.value} disabled={o.disabled}>
            {typeof o.label === "string" ? o.label : o.value}
          </option>
        ))}
      </select>
      {invalid && (
        <span className="field-error" id={`${generated}-error`} role="alert">
          {tr("Pilih opsi yang diperlukan.")}
        </span>
      )}
    </span>
  );
}
export function Select(props: Props) {
  return props.multiple ? (
    <MultiSelect {...props} />
  ) : (
    <SingleSelect {...props} />
  );
}
function MultiSelect({
  children,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  ...attributes
}: Props) {
  const options = optionsOf(children),
    [internal, setInternal] = useState<string[]>(
      Array.isArray(defaultValue) ? defaultValue.map(String) : [],
    ),
    [invalid, setInvalid] = useState(false),
    first = useRef<HTMLInputElement>(null);
  const selected = Array.isArray(value) ? value.map(String) : internal;
  const choose = (item: string, checked: boolean) => {
    const next = checked
      ? [...selected, item]
      : selected.filter((v) => v !== item);
    setInternal(next);
    setInvalid(false);
    onChange?.({
      target: {
        selectedOptions: next.map((value) => ({ value })),
        value: next[0] ?? "",
      },
      currentTarget: {
        selectedOptions: next.map((value) => ({ value })),
        value: next[0] ?? "",
      },
    } as unknown as ChangeEvent<HTMLSelectElement>);
  };
  return (
    <span className="ums-multiselect">
      <span
        role="group"
        aria-label={attributes["aria-label"]}
        aria-labelledby={attributes["aria-labelledby"]}
      >
        {options.map((option, index) => (
          <label key={option.value}>
            <input
              ref={index === 0 ? first : undefined}
              type="checkbox"
              checked={selected.includes(option.value)}
              disabled={disabled || option.disabled}
              onChange={(event) => choose(option.value, event.target.checked)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </span>
      <select
        className="ums-select-native"
        aria-hidden="true"
        aria-label="Form value"
        tabIndex={-1}
        name={name}
        multiple
        required={required}
        disabled={disabled}
        value={selected}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          first.current?.focus();
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {typeof o.label === "string" ? o.label : o.value}
          </option>
        ))}
      </select>
      {invalid && (
        <span role="alert" className="field-error">
          {tr("Pilih setidaknya satu peran.")}
        </span>
      )}
    </span>
  );
}
