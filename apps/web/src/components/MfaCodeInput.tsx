import { useRef } from "react";

const CODE_LENGTH = 6;

export function MfaCodeInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH).split("");

  function updateAt(index: number, next: string) {
    const nextDigits = [...digits];
    nextDigits[index] = next;
    onChange(nextDigits.join(""));
  }

  function handleChange(index: number, raw: string) {
    const pasted = raw.replace(/\D/g, "");
    if (!pasted) {
      updateAt(index, "");
      return;
    }
    const nextDigits = [...digits];
    for (const [offset, digit] of pasted
      .slice(0, CODE_LENGTH - index)
      .split("")
      .entries()) {
      nextDigits[index + offset] = digit;
    }
    onChange(nextDigits.join(""));
    inputRefs.current[
      Math.min(index + pasted.length, CODE_LENGTH - 1)
    ]?.focus();
  }

  return (
    <div
      aria-label="6-digit authentication code"
      className="flex gap-2"
      role="group"
    >
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          aria-label={`Authentication code digit ${index + 1}`}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          className="size-10 rounded-md border border-input bg-background text-center font-mono text-lg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          id={index === 0 ? id : undefined}
          inputMode="numeric"
          key={`${id}-${index}`}
          maxLength={1}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digits[index] && index > 0) {
              event.preventDefault();
              updateAt(index - 1, "");
              inputRefs.current[index - 1]?.focus();
            }
            if (event.key === "ArrowLeft" && index > 0) {
              event.preventDefault();
              inputRefs.current[index - 1]?.focus();
            }
            if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
              event.preventDefault();
              inputRefs.current[index + 1]?.focus();
            }
          }}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          value={digits[index] ?? ""}
        />
      ))}
    </div>
  );
}
