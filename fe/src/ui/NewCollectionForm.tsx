type Action = (formData: FormData) => Promise<void>;

// ?error= is user-controlled, so it only ever picks one of these.
const ERRORS: Record<string, string> = {
  invalid: 'Check the name and kind and try again.',
};

/** Start a collection (#73): enough for an empty production to begin. */
export default function NewCollectionForm({ action, error }: { action: Action; error?: string }) {
  return (
    <form action={action} className="flex max-w-sm flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {Object.hasOwn(ERRORS, error) ? ERRORS[error] : 'We couldn\u2019t create the collection. Please try again.'}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" required className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25" />
      </label>
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1">Kind</legend>
        <label className="flex items-center gap-1"><input type="radio" name="kind" value="physical" defaultChecked /> Physical</label>
        <label className="flex items-center gap-1"><input type="radio" name="kind" value="digital" /> Digital</label>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea name="notes" rows={2} className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25" />
      </label>
      <button type="submit" className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]">Create collection</button>
    </form>
  );
}
