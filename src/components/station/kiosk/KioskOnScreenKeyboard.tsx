"use client";

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";

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
  space,
  active,
  tone = "default",
}: {
  label: string;
  onPress: () => void;
  wide?: boolean;
  space?: boolean;
  active?: boolean;
  tone?: "default" | "done";
}) {
  const lastFire = useRef(0);
  const [down, setDown] = useState(false);
  const downTimer = useRef<number | null>(null);

  // pointerdown (no click): preventDefault mantiene el foco en el campo.
  // En el kiosco a veces solo llega mousedown; el margen de 80 ms evita doble letra.
  // Sin setPointerCapture: si el toque no termina en pointerup, la captura se queda
  // pegada y el resto de la pantalla deja de responder.
  const fire = (e: SyntheticEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    if (now - lastFire.current < 80) return;
    lastFire.current = now;
    setDown(true);
    if (downTimer.current) window.clearTimeout(downTimer.current);
    downTimer.current = window.setTimeout(() => setDown(false), 120);
    onPress();
  };

  const grow = space ? "flex-[2.2]" : wide ? "flex-[1.45]" : "flex-1";
  const pressed = active || down;
  const face =
    tone === "done"
      ? down
        ? "bg-emerald-800 text-white"
        : "bg-emerald-600 text-white"
      : pressed
        ? "bg-[#1d6eb8] text-white"
        : "bg-white text-slate-900";

  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={fire}
      onPointerDown={fire}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex h-full min-h-0 min-w-0 ${grow} items-center justify-center rounded-lg border-[3px] border-[#e8eef5] px-1 text-[clamp(1.35rem,2.7vh,2.35rem)] font-bold leading-none ${face}`}
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
      data-kiosk-keyboard
      className="kiosk-keyboard fixed inset-x-0 bottom-0 z-[80] flex flex-col border-t border-slate-300 bg-[#e8eef5] px-0.5 pb-0.5 pt-1 shadow-[0_-12px_40px_rgba(15,45,90,0.18)]"
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      role="group"
      aria-label="Teclado en pantalla"
    >
      <div className="mb-0.5 flex shrink-0 items-center justify-between gap-2 px-1.5">
        <p className="min-w-0 truncate text-base font-semibold text-slate-600">
          {emailMode
            ? "Correo: @ y punto están en el teclado. Listo ✓ muestra el resto."
            : "Escriba en el campo. Listo ✓ muestra el resto de la pantalla."}
        </p>
        <button
          type="button"
          tabIndex={-1}
          className="min-h-[48px] shrink-0 rounded-xl bg-slate-800 px-4 text-lg font-bold text-white"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dismiss();
          }}
        >
          Cerrar
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {rows.map((row, i) => (
          <div key={`${layout}-${emailMode ? "email" : "text"}-${i}`} className="flex min-h-0 flex-1">
            {i === 2 && layout === "letters" && (
              <KeyButton label="⇧" onPress={() => setShift((s) => !s)} active={shift} wide />
            )}
            {row.map((key) => (
              <KeyButton key={`${layout}-${key}-${i}`} label={key} onPress={() => insert(key)} />
            ))}
            {i === 2 && layout === "letters" && (
              <KeyButton label="⌫" onPress={backspace} wide />
            )}
          </div>
        ))}
        <div className="flex min-h-0 flex-1">
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
          <KeyButton label="Espacio" onPress={() => insert(" ")} space />
          <KeyButton label="⌫" onPress={backspace} wide />
          <KeyButton label="Listo ✓" onPress={dismiss} tone="done" wide />
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

function clearActiveField() {
  document.querySelectorAll(".kiosk-kb-active").forEach((node) => node.classList.remove("kiosk-kb-active"));
}

function markActiveField(el: HTMLElement) {
  clearActiveField();
  el.classList.add("kiosk-kb-active");
}

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
      clearActiveField();
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
      markActiveField(el);
      setTarget(el);
      setOpen(true);
      document.documentElement.classList.add("kiosk-kb-open");
      // El alto del teclado ya cambió el layout: acerca el campo al borde superior del teclado.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          el.scrollIntoView({ block: "end", behavior: "auto", inline: "nearest" });
        });
      });
    };

    const onFocusOut = () => {
      blurTimer.current = window.setTimeout(() => {
        setOpen(false);
        setTarget(null);
        clearActiveField();
        document.documentElement.classList.remove("kiosk-kb-open");
      }, 180);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
      clearActiveField();
      document.documentElement.classList.remove("kiosk-kb-open");
    };
  }, [enabled]);

  const close = useCallback(() => {
    setOpen(false);
    setTarget(null);
    clearActiveField();
    document.documentElement.classList.remove("kiosk-kb-open");
  }, []);

  return { open: enabled && open, target: enabled ? target : null, close, setOpen };
}
