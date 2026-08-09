"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const LETTERS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const LETTERS_SHIFT = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

const NUMBERS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["@", ".", "-", "_", "/", "+", "(", ")", ",", ":"],
  ["#", "*", "?", "!", "%", "&", "'", '"'],
];

const ACCENTS = [
  ["á", "é", "í", "ó", "ú", "ü", "Á", "É", "Í"],
  ["Ó", "Ú", "Ü", "ñ", "Ñ", "@", ".", "-", "_"],
];

type Layout = "letters" | "numbers" | "accents";

/** Props for kiosk text fields so the OS keyboard stays suppressed. */
export const kioskTextFieldProps = {
  inputMode: "none" as const,
  autoComplete: "off",
  autoCapitalize: "off" as const,
  spellCheck: false,
};

function applyVirtualKeyboardPolicy(el: HTMLElement) {
  try {
    el.setAttribute("virtualkeyboardpolicy", "manual");
    el.style.setProperty("virtual-keyboard-policy", "manual");
  } catch {
    /* ignore */
  }
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string, inputType = "insertText") {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
  // React controlled inputs listen via the value tracker + bubbling input events.
  const inputEvent =
    typeof InputEvent !== "undefined"
      ? new InputEvent("input", { bubbles: true, cancelable: true, inputType, composed: true })
      : new Event("input", { bubbles: true, cancelable: true });
  el.dispatchEvent(inputEvent);
}

function KeyButton({
  label,
  onPress,
  wide,
  active,
}: {
  label: string;
  onPress: () => void;
  wide?: boolean;
  active?: boolean;
}) {
  // Fire on pointerdown (not click): preventDefault keeps focus in the field on touch
  // devices; delaying to click can drop the event after preventDefault.
  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onPress();
  };

  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      className={`min-h-[52px] rounded-xl text-lg font-semibold shadow-sm ring-1 transition active:scale-[0.97] ${
        wide ? "min-w-[88px] flex-[1.4] px-3" : "min-w-[40px] flex-1 px-1"
      } ${
        active
          ? "bg-[#1d6eb8] text-white ring-[#1d6eb8]"
          : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

export function KioskOnScreenKeyboard({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: HTMLInputElement | HTMLTextAreaElement | null;
}) {
  const [layout, setLayout] = useState<Layout>("letters");
  const [shift, setShift] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setLayout("letters");
      setShift(false);
    }
  }

  const insert = useCallback(
    (chars: string) => {
      if (!target) return;
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const next = target.value.slice(0, start) + chars + target.value.slice(end);
      setNativeValue(target, next, "insertText");
      const caret = start + chars.length;
      try {
        target.setSelectionRange(caret, caret);
      } catch {
        /* some input types */
      }
      target.focus({ preventScroll: true });
      if (shift && layout === "letters") setShift(false);
    },
    [target, shift, layout],
  );

  const backspace = useCallback(() => {
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    if (start !== end) {
      const next = target.value.slice(0, start) + target.value.slice(end);
      setNativeValue(target, next, "deleteContentBackward");
      try {
        target.setSelectionRange(start, start);
      } catch {
        /* ignore */
      }
    } else if (start > 0) {
      const next = target.value.slice(0, start - 1) + target.value.slice(end);
      setNativeValue(target, next, "deleteContentBackward");
      try {
        target.setSelectionRange(start - 1, start - 1);
      } catch {
        /* ignore */
      }
    }
    target.focus({ preventScroll: true });
  }, [target]);

  const dismiss = useCallback(() => {
    target?.blur();
    onClose();
  }, [target, onClose]);

  if (!open) return null;

  const rows =
    layout === "numbers" ? NUMBERS : layout === "accents" ? ACCENTS : shift ? LETTERS_SHIFT : LETTERS;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-slate-200 bg-[#e8eef5]/95 p-3 shadow-[0_-8px_30px_rgba(15,45,90,0.12)] backdrop-blur"
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
      role="group"
      aria-label="Teclado en pantalla"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Teclado en pantalla
          </p>
          <button
            type="button"
            tabIndex={-1}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault();
              dismiss();
            }}
          >
            Cerrar teclado
          </button>
        </div>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={`${layout}-${i}`} className="flex justify-center gap-1.5">
              {i === 2 && layout === "letters" && (
                <KeyButton label="⇧" onPress={() => setShift((s) => !s)} active={shift} wide />
              )}
              {row.map((key) => (
                <KeyButton key={`${layout}-${key}`} label={key} onPress={() => insert(key)} />
              ))}
              {i === 2 && layout === "letters" && (
                <KeyButton label="⌫" onPress={backspace} wide />
              )}
            </div>
          ))}
          <div className="flex justify-center gap-1.5">
            <KeyButton
              label="123"
              active={layout === "numbers"}
              onPress={() => setLayout((l) => (l === "numbers" ? "letters" : "numbers"))}
              wide
            />
            <KeyButton
              label="áéí"
              active={layout === "accents"}
              onPress={() => setLayout((l) => (l === "accents" ? "letters" : "accents"))}
              wide
            />
            <KeyButton label="Espacio" onPress={() => insert(" ")} wide />
            <KeyButton label="⌫" onPress={backspace} wide />
            <KeyButton label="Listo" onPress={dismiss} wide />
          </div>
        </div>
      </div>
    </div>
  );
}

const NON_TEXT_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "file",
  "hidden",
  "range",
  "color",
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
]);

function isKeyboardTarget(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.readOnly || el.disabled) return false;
  const type = (el.type || "text").toLowerCase();
  return !NON_TEXT_INPUT_TYPES.has(type);
}

/** Activa teclado virtual al enfocar inputs de texto dentro del kiosk. */
export function useKioskVirtualKeyboard(enabled: boolean) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const blurTimer = useRef<number | null>(null);

  // Close immediately when leaving a keyboard-enabled step (render-time adjust).
  if (!enabled && (open || target)) {
    setOpen(false);
    setTarget(null);
  }

  useEffect(() => {
    if (!enabled) {
      document.documentElement.style.setProperty("--kiosk-keyboard-height", "0px");
      return;
    }

    const onFocusIn = (event: FocusEvent) => {
      if (!isKeyboardTarget(event.target)) return;
      if (blurTimer.current) {
        window.clearTimeout(blurTimer.current);
        blurTimer.current = null;
      }
      const el = event.target;
      el.setAttribute("inputmode", "none");
      el.setAttribute("autocomplete", "off");
      el.setAttribute("autocapitalize", "off");
      el.setAttribute("spellcheck", "false");
      applyVirtualKeyboardPolicy(el);
      setTarget(el);
      setOpen(true);
      document.documentElement.style.setProperty("--kiosk-keyboard-height", "300px");
      // Keep the caret visible above the keyboard.
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    };

    const onFocusOut = () => {
      blurTimer.current = window.setTimeout(() => {
        setOpen(false);
        setTarget(null);
        document.documentElement.style.setProperty("--kiosk-keyboard-height", "0px");
      }, 180);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
      document.documentElement.style.setProperty("--kiosk-keyboard-height", "0px");
    };
  }, [enabled]);

  const close = useCallback(() => {
    setOpen(false);
    setTarget(null);
    document.documentElement.style.setProperty("--kiosk-keyboard-height", "0px");
  }, []);

  return { open: enabled && open, target: enabled ? target : null, close, setOpen };
}
