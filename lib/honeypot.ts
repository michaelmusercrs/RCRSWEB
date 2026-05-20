/**
 * Server-side honeypot check.
 *
 * Pairs with components/forms/HoneypotField.tsx. The component renders an
 * off-screen input named `website` (by default) that real users never fill.
 * Bots that blindly populate every form field will fill it.
 *
 * On every public form API route, call checkHoneypot(body) BEFORE any
 * real processing (validation, spam scoring, side-effects). If it returns
 * triggered=true, log it and return a generic 200 OK that mirrors the legit
 * success shape — never reveal to the bot that the submission was blocked.
 *
 * Field name default is `website` — must match the component's `name` prop.
 */

export interface HoneypotResult {
  triggered: boolean;
  /** The value the bot supplied, if any — useful for logs. */
  value?: string;
}

/**
 * Check a request body for a non-empty honeypot field.
 *
 * @param body       Parsed JSON body of the request (or any object).
 * @param fieldName  Field to check. Default `website`. Keep this in sync
 *                   with the `name` prop on <HoneypotField />.
 * @returns          { triggered: true, value } if the field has any content,
 *                   { triggered: false } otherwise (including missing field).
 */
export function checkHoneypot(
  body: unknown,
  fieldName: string = 'website',
): HoneypotResult {
  if (!body || typeof body !== 'object') {
    return { triggered: false };
  }

  const value = (body as Record<string, unknown>)[fieldName];

  // Only string values can plausibly come from a real <input> element.
  // Anything else (number, object, array) is junk — treat as untriggered
  // so we don't false-positive on weird client serialization.
  if (typeof value !== 'string') {
    return { triggered: false };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { triggered: false };
  }

  return { triggered: true, value: trimmed };
}
