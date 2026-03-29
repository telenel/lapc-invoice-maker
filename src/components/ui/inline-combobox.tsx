"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ComboboxItem {
  id: string;
  label: string;
  sublabel?: string;
  searchValue?: string;
  isCustom?: boolean;
}

interface InlineComboboxProps {
  items: ComboboxItem[];
  value: string;
  onSelect: (item: ComboboxItem) => void;
  /** Called when user exits the field with typed text that wasn't selected from suggestions */
  onCommitText?: (text: string) => void;
  placeholder?: string;
  displayValue?: string;
  className?: string;
  loading?: boolean;
  allowCustom?: boolean;
  customPrefix?: string;
}

export function InlineCombobox({
  items,
  value,
  onSelect,
  onCommitText,
  placeholder = "",
  displayValue,
  className,
  loading = false,
  allowCustom = false,
  customPrefix = "Add new:",
}: InlineComboboxProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [highlightIndex, setHighlightIndex] = React.useState(0);

  const instanceId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const filtered = React.useMemo(() => {
    if (!query) return items;
    const lower = query.toLowerCase();
    return items.filter((item) => {
      const haystack = [item.label, item.sublabel, item.searchValue]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(lower);
    });
  }, [items, query]);

  const suggestions = React.useMemo(() => {
    if (!allowCustom || !query) return filtered;
    const exactMatch = filtered.some(
      (item) => item.label.toLowerCase() === query.toLowerCase()
    );
    if (exactMatch) return filtered;
    return [
      ...filtered,
      { id: `__custom__${query}`, label: `${customPrefix} ${query}`, isCustom: true },
    ];
  }, [filtered, allowCustom, query, customPrefix]);

  // Reset highlight when suggestions change
  React.useEffect(() => {
    setHighlightIndex(0);
  }, [suggestions.length, query]);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    const item = items[highlightIndex];
    if (item && typeof item.scrollIntoView === "function") {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, open]);

  // Close on outside click — commit typed text if onCommitText is provided
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (query.trim() && onCommitText) {
          onCommitText(query.trim());
        }
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, query, onCommitText]);

  function handleSelect(item: ComboboxItem) {
    onSelect(item);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setOpen(true);
        e.preventDefault();
        return;
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (suggestions[highlightIndex]) {
          handleSelect(suggestions[highlightIndex]);
        } else if (query.trim() && onCommitText) {
          onCommitText(query.trim());
          setQuery("");
          setOpen(false);
        }
        break;
      case "Escape":
        setOpen(false);
        setQuery("");
        break;
      case "Tab":
        // Accept highlighted suggestion, or commit raw text if no suggestions
        if (suggestions[highlightIndex]) {
          handleSelect(suggestions[highlightIndex]);
        } else if (query.trim() && onCommitText) {
          onCommitText(query.trim());
          setQuery("");
          setOpen(false);
        }
        break;
    }
  }

  function handleFocus() {
    setOpen(true);
    if (value && displayValue) {
      setQuery(displayValue);
      // Select all text so typing replaces it
      setTimeout(() => {
        inputRef.current?.select();
      }, 0);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (!open) setOpen(true);
  }

  const inputValue = open ? query : value && displayValue ? displayValue : "";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={
          open && suggestions[highlightIndex]
            ? `${instanceId}-option-${highlightIndex}`
            : undefined
        }
        type="text"
        value={inputValue}
        placeholder={loading ? "Loading\u2026" : placeholder}
        disabled={loading}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base uppercase transition-colors outline-none placeholder:text-muted-foreground placeholder:normal-case focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm"
        )}
      />
      {open && !loading && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.length === 0 && (
            <li className="px-2.5 py-2 text-sm text-muted-foreground">
              No matches
            </li>
          )}
          {suggestions.map((item, index) => (
            <li
              key={item.id}
              id={`${instanceId}-option-${index}`}
              role="option"
              aria-selected={index === highlightIndex}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlightIndex(index)}
              onClick={() => handleSelect(item)}
              className={cn(
                "cursor-pointer px-2.5 py-2 text-sm",
                index === highlightIndex && "bg-accent text-accent-foreground"
              )}
            >
              <span>{item.label}</span>
              {item.sublabel && (
                <span className="ml-2 text-muted-foreground">
                  {item.sublabel}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
