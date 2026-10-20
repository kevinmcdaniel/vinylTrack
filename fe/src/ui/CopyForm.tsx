import type { Copy } from '@/lib/types';
import FormError from './FormError';
import PickOrAdd from './PickOrAdd';

type Action = (formData: FormData) => Promise<void>;
type Create = (name: string) => Promise<{ item: { id: string; label: string } } | { error: string }>;
type Option = { id: string; label: string };

const input = 'rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';
const label = 'flex flex-col gap-1 text-sm text-text';
const primaryButton = 'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text';
const CONDITIONS = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P'];

/**
 * New or edit copy (#102). Location and owner are required pickers that can
 * add a new one in place; condition only shows for a physical collection.
 * Blank optional fields clear on edit (the action sends null).
 */
export default function CopyForm({ copy, albumId, hidden, children, physical, locations, owners, defaultOwnerId, action, createLocation, createOwner, submitLabel, error, messages }: {
  copy?: Copy;
  albumId?: string;
  /** More hidden fields, e.g. the want id for found-it (#8). */
  hidden?: Record<string, string>;
  /** Fields above the pickers, e.g. which album an artist want turned out to be. */
  children?: React.ReactNode;
  physical: boolean;
  locations: Option[];
  owners: Option[];
  defaultOwnerId?: string;
  action: Action;
  createLocation: Create;
  createOwner: Create;
  submitLabel: string;
  error?: string;
  messages: Partial<Record<string, string>>;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError code={error} messages={messages} />
      {albumId && <input type="hidden" name="albumId" value={albumId} />}
      {copy && <input type="hidden" name="id" value={copy.id} />}
      {Object.entries(hidden ?? {}).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      <PickOrAdd name="locationId" label="Location" options={locations} defaultValue={copy?.locationId} addLabel="Add a location" create={createLocation} />
      <PickOrAdd name="ownerId" label="Owner" options={owners} defaultValue={copy?.ownerId ?? defaultOwnerId} addLabel="Add an owner" create={createOwner} />
      {physical && (
        <label className={label}>
          Condition
          <input name="condition" list="copy-conditions" defaultValue={copy?.condition ?? ''} className={input} />
          <datalist id="copy-conditions">{CONDITIONS.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Acquired
          <input name="dateAcquired" type="date" defaultValue={copy?.dateAcquired?.slice(0, 10) ?? ''} className={input} />
        </label>
        <label className={label}>
          Price
          <input name="price" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={copy?.price ?? ''} className={input} />
        </label>
      </div>
      <label className={label}>
        Notes
        <textarea name="notes" rows={2} defaultValue={copy?.notes ?? ''} className={input} />
      </label>
      <button type="submit" className={`${primaryButton} self-start`}>{submitLabel}</button>
    </form>
  );
}
