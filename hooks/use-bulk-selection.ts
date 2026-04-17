"use client";

import { useState, useCallback, useMemo } from "react";

export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === items.length) {
        return new Set();
      }
      return new Set(items.map((i) => i.id));
    });
  }, [items]);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selected.has(id),
    [selected],
  );

  const allSelected = useMemo(
    () => items.length > 0 && selected.size === items.length,
    [items.length, selected.size],
  );

  const someSelected = useMemo(
    () => selected.size > 0 && selected.size < items.length,
    [items.length, selected.size],
  );

  return {
    selected,
    selectedIds: Array.from(selected),
    count: selected.size,
    toggleOne,
    toggleAll,
    clear,
    isSelected,
    allSelected,
    someSelected,
  };
}
