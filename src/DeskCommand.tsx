import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

export type DeskCommandItem = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
};

type Props = {
  open: boolean;
  items: DeskCommandItem[];
  onClose: () => void;
};

/**
 * The desk's global jump palette. It is deliberately local to the owner console: the data is
 * already in the page, so opening it never costs another request, and the result list can mix
 * navigation (sections) with subjects (tickers) without inventing a second search service.
 */
export default function DeskCommand({ open, items, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter(item => `${item.label} ${item.group} ${item.hint ?? ''} ${item.keywords ?? ''}`.toLowerCase().includes(term));
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    setActive(0);
    input.current?.focus();
    return () => {
      previous.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const current = filtered[active];
    if (!current) return;
    document.getElementById(current.id)?.scrollIntoView({ block: 'nearest' });
  }, [active, filtered, open]);

  if (!open) return null;

  const choose = (item: DeskCommandItem) => {
    onClose();
    item.run();
  };

  const trapTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = [...(panel.current?.querySelectorAll<HTMLElement>('input, button:not([disabled])') ?? [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(index => (filtered.length ? (index + 1) % filtered.length : 0));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(index => (filtered.length ? (index - 1 + filtered.length) % filtered.length : 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = filtered[active];
      if (item) choose(item);
    }
  };

  let lastGroup = '';
  return <div className="sd-command-backdrop" onMouseDown={onClose}>
    <div className="sd-command" ref={panel} role="dialog" aria-modal="true" aria-label="Search tickers and sections" onKeyDown={trapTab} onMouseDown={event => event.stopPropagation()}>
      <div className="sd-command-field">
        <svg className="sd-command-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.4-3.4" /></svg>
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls="sd-command-results"
          aria-autocomplete="list"
          aria-activedescendant={filtered[active]?.id}
          aria-label="Search tickers and sections"
          placeholder="Jump to a ticker, section or action"
          value={query}
          onChange={event => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <kbd>esc</kbd>
      </div>
      <div className="sd-command-results" id="sd-command-results" role="listbox" aria-label="Desk results">
        {filtered.map((item, index) => {
          const header = item.group !== lastGroup ? item.group : '';
          lastGroup = item.group;
          return <Fragment key={item.id}>
            {header && <div className="sd-command-group" role="presentation">{header}</div>}
            <button
              id={item.id}
              type="button"
              role="option"
              aria-selected={index === active}
              className={index === active ? 'is-active' : undefined}
              onMouseMove={() => setActive(index)}
              onClick={() => choose(item)}
            >
              <span className="sd-command-label">{item.label}</span>
              {item.hint && <span className="sd-command-hint">{item.hint}</span>}
              <span className="sd-command-enter" aria-hidden="true">↵</span>
            </button>
          </Fragment>;
        })}
        {!filtered.length && <p className="sd-command-empty">No ticker or section matches “{query.trim()}”.</p>}
      </div>
      <div className="sd-command-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> to move</span>
        <span><kbd>↵</kbd> to open</span>
        <span className="sd-command-count">{filtered.length} of {items.length}</span>
      </div>
    </div>
  </div>;
}
