'use client';

import { useId, useState, useTransition } from 'react';

type Option = { id: string; label: string };
type Create = (name: string) => Promise<{ item: Option } | { error: string }>;

const input = 'rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';

/**
 * A required <select> that can grow (#102): pick a location or owner, or add a
 * new one without leaving the copy form. The select is a plain form field, so
 * picking works before JS loads; only "add" needs it.
 */
export default function PickOrAdd({ name, label, options: initial, defaultValue, addLabel, create }: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string;
  addLabel: string;
  create: Create;
}) {
  const [options, setOptions] = useState(initial);
  const [value, setValue] = useState(defaultValue ?? '');
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const selectId = useId();
  const draftId = useId();
  const noun = label.toLowerCase();

  const add = () => {
    setFailed(false);
    startTransition(async () => {
      const result = await create(draft.trim());
      if ('item' in result) {
        setOptions((prev) => [...prev, result.item].sort((a, b) => a.label.localeCompare(b.label)));
        setValue(result.item.id);
        setDraft('');
        setOpen(false);
      } else {
        setFailed(true);
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm text-text">{label}</label>
      <select id={selectId} name={name} required value={value} onChange={(e) => setValue(e.target.value)} className={input}>
        <option value="" disabled>Pick one</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="cursor-pointer text-sm text-primary underline">{addLabel}</summary>
        <div className="mt-2 flex gap-2">
          <label htmlFor={draftId} className="sr-only">New {noun} name</label>
          <input id={draftId} value={draft} onChange={(e) => setDraft(e.target.value)} className={`${input} min-w-0 flex-1`} />
          <button type="button" onClick={add} disabled={pending || !draft.trim()} className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-text">
            Add
          </button>
        </div>
      </details>
      {failed && <p role="status" className="text-sm text-danger-text">Couldn&rsquo;t add that {noun}. Please try again.</p>}
    </div>
  );
}
