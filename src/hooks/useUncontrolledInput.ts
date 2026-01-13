import { useRef, useState, useCallback } from 'react';

/**
 * Hook for managing uncontrolled input fields
 * Prevents parent re-renders during typing by managing state internally
 * 
 * @param initialValue - Initial/default value for the input
 * @param onChange - Optional callback that fires on change (doesn't trigger parent re-render)
 * @returns Object with ref, defaultValue, onChange handler, and utility methods
 */
export function useUncontrolledInput<T extends string | number = string>(
  initialValue: T,
  onChange?: (value: T) => void
) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [internalValue, setInternalValue] = useState<T>(initialValue);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = (e.target.value as T);
    setInternalValue(value);
    // Optional callback - doesn't cause parent re-render
    onChange?.(value);
  }, [onChange]);

  return {
    ref,
    defaultValue: initialValue,
    onChange: handleChange,
    getValue: useCallback(() => {
      return ref.current?.value ?? String(internalValue);
    }, [internalValue]),
    setValue: useCallback((value: T) => {
      if (ref.current) {
        ref.current.value = String(value);
        setInternalValue(value);
      }
    }, []),
    reset: useCallback(() => {
      if (ref.current) {
        ref.current.value = String(initialValue);
        setInternalValue(initialValue);
      }
    }, [initialValue])
  };
}
