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

/** Correo: @ y . en la misma pantalla de letras (sin ir a 123). */
const LETTERS_EMAIL = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"],
  ["z", "x", "c", "v", "b", "n", "m", "@", "."],
];

const LETTERS_EMAIL_SHIFT = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
  ["Z", "X", "C", "V", "B", "N", "M", "@", "."],
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

function isEmailField(el: HTMLInputElement | HTMLTextAreaElement | null): boolean {
  if (!el) return false;
  const type = (el.getAttribute("type") || el.type || "").toLowerCase();
  if (type === "email") return true;
  const autoComplete = (el.getAttribute("autocomplete") || "").toLowerCase();
  if (autoComplete === "email") return true;
  const name = (el.getAttribute("name") || "").toLowerCase();
  const id = (el.id || "").toLowerCase();
  const placeholder = (el.getAttribute("placeholder") || "").toLowerCase();
  const haystack = `${name} ${id} ${placeholder}`;
  return /\bemail\b|correo|e-?mail|@/.test(haystack);
}

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
  // React controlled: sin value tracker el estado no guarda lo escrito y al tocar Listo se pierde.
  const tracker = (el as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
  tracker?.setValue(el.value);
  desc?.set?.call(el, value);
  const inputEvent =
    typeof InputEvent !== "undefined"
      ? new InputEvent("input", { bubbles: true, cancelable: true, inputType, composed: true })
      : new Event("input", { bubbles: true, cancelable: true });
  el.dispatchEvent(inputEvent);
  el.dispatchEvent(new Event("change", { bubbles: true }));
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
      className={`min-h-[56px] rounded-xl text-xl font-semibold shadow-sm ring-1 transition active:scale-[0.97] ${
        wide ? "min-w-[96px] flex-[1.4] px-3" : "min-w-[44px] flex-1 px-1"
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
    if (target) {
      // Asegura que el valor final quede en el estado de React antes de blur.
      setNativeValue(target, target.value, "insertReplacementText");
    }

    // Evita el “click fantasma”: al cerrar el teclado, el mismo toque cae en
    // Recargar / Nueva atención del footer y reinicia toda la atención.
    const shield = document.createElement("div");
    shield.setAttribute("data-kiosk-keyboard-shield", "1");
    shield.style.cssText =
      "position:fixed;inset:0;z-index:9999;touch-action:none;background:transparent;";
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    shield.addEventListener("pointerdown", block, true);
    shield.addEventListener("pointerup", block, true);
    shield.addEventListener("pointercancel", block, true);
    shield.addEventListener("click", block, true);
    shield.addEventListener("mousedown", block, true);
    shield.addEventListener("mouseup", block, true);
    document.body.appendChild(shield);

    window.setTimeout(() => {
      target?.blur();
      onClose();
    }, 80);

    window.setTimeout(() => {
      shield.remove();
    }, 550);
  }, [target, onClose]);

  if (!open) return null;

  const emailMode = isEmailField(target);
  const letterRows = emailMode
    ? shift
      ? LETTERS_EMAIL_SHIFT
      : LETTERS_EMAIL
    : shift
      ? LETTERS_SHIFT
      : LETTERS;
  const rows =
    layout === "numbers" ? NUMBERS : layout === "accents" ? ACCENTS : letterRows;

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
            {emailMode ? "Teclado · correo (@ y . en letras)" : "Teclado en pantalla"}
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
            <div key={`${layout}-${emailMode ? "email" : "text"}-${i}`} className="flex justify-center gap-1.5">
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
            {emailMode && layout === "letters" && (
              <>
                <KeyButton label="@" onPress={() => insert("@")} />
                <KeyButton label="." onPress={() => insert(".")} />
              </>
            )}
            <KeyButton label="Espacio" onPress={() => insert(" ")} wide />
            <KeyButton label="⌫" onPress={backspace} wide />
            <KeyButton
              label="Listo ✓"
              onPress={dismiss}
              wide
            />
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
      document.documentElement.classList.remove("kiosk-kb-open");
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
      document.documentElement.classList.add("kiosk-kb-open");
      // Deja el campo arriba del teclado, sin taparlo con el pie «Continuar».
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
      });
    };

    const onFocusOut = () => {
      blurTimer.current = window.setTimeout(() => {
        setOpen(false);
        setTarget(null);
        document.documentElement.style.setProperty("--kiosk-keyboard-height", "0px");
        document.documentElement.classList.remove("kiosk-kb-open");
      }, 180);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
      document.documentElement.style.setProperty("--kiosk-keyboard-height", "0px");
      document.documentElement.classList.remove("kiosk-kb-open");
    };
  }, [enabled]);

  const close = useCallback(() => {
    setOpen(false);
    setTarget(null);
    document.documentElement.style.setProperty("--kiosk-keyboard-height", "0px");
    document.documentElement.classList.remove("kiosk-kb-open");
  }, []);

  return { open: enabled && open, target: enabled ? target : null, close, setOpen };
}
