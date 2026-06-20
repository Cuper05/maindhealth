"use client";

import { inputClassName, labelClassName, textareaClassName } from "@/lib/ui/classes";

export type CatalogOption = {
  value: string;
  label: string;
};

export function CatalogAutocomplete({
  label,
  name,
  value,
  onChange,
  options,
  required,
  placeholder,
  hint,
  rows,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: CatalogOption[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  rows?: number;
}) {
  const listId = `catalog-${name.replace(/[^a-z0-9-]/gi, "-")}`;
  const isTextarea = rows !== undefined && rows > 1;
  const sharedProps = {
    name,
    required,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    list: listId,
    placeholder,
  };

  return (
    <div>
      <label className={labelClassName}>{label}</label>
      {hint ? <p className="mb-1 text-xs text-slate-500">{hint}</p> : null}
      {isTextarea ? (
        <textarea {...sharedProps} rows={rows} className={textareaClassName} />
      ) : (
        <input type="text" {...sharedProps} className={inputClassName} />
      )}
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </div>
  );
}
