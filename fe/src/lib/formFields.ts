/** Form-field readers shared by the copy and found-it actions (#102, #8). */

export const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
};

/** The picked day as midnight UTC: what a copy's dateAcquired is stored as. */
export const dayOf = (formData: FormData, name = 'dateAcquired') =>
  /^\d{4}-\d{2}-\d{2}$/.test(field(formData, name)) ? `${field(formData, name)}T00:00:00.000Z` : null;

/** A non-negative price, or null for blank or not-a-number. */
export const priceOf = (formData: FormData, name = 'price') => {
  const n = Number(field(formData, name));
  return field(formData, name) && Number.isFinite(n) && n >= 0 ? n : null;
};
