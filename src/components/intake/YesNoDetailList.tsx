"use client";

import { useEffect, useState } from "react";
import { joinDetailList } from "@/lib/intake/list-details";
import { inputClassName, labelClassName } from "@/lib/ui/classes";

function itemsFromValue(value: string): string[] {
  if (!value.trim()) return [""];
  return value.split("\n");
}

export function YesNoDetailList({
  label,
  checked,
  onCheckedChange,
  value,
  onChange,
  placeholder,
  addLabel,
  detailName,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  addLabel: string;
  detailName?: string;
}) {
  const [items, setItems] = useState<string[]>(() => itemsFromValue(value));

  useEffect(() => {
    if (checked) {
      setItems(itemsFromValue(value));
    } else {
      setItems([""]);
    }
  }, [checked]);

  function commit(nextItems: string[]) {
    const normalized = nextItems.length > 0 ? nextItems : [""];
    setItems(normalized);
    onChange(joinDetailList(normalized));
  }

  function updateItem(index: number, text: string) {
    const next = [...items];
    next[index] = text;
    commit(next);
  }

  function addItem() {
    setItems((current) => [...current, ""]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) {
      commit([""]);
      return;
    }
    commit(items.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <p className={labelClassName}>{label}</p>
      <div className="mt-2 flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={!checked} onChange={() => onCheckedChange(false)} />
          No
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={checked} onChange={() => onCheckedChange(true)} />
          Sí
        </label>
      </div>
      {checked && (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                placeholder={placeholder}
                className={inputClassName}
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="shrink-0 text-sm text-slate-500 hover:text-red-600"
                  aria-label="Quitar"
                >
                  Quitar
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="text-sm text-teal-700 hover:underline"
          >
            + {addLabel}
          </button>
          {detailName && <input type="hidden" name={detailName} value={joinDetailList(items)} />}
        </div>
      )}
    </div>
  );
}
