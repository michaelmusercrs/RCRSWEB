/**
 * HoneypotField — invisible bot trap input.
 *
 * How it works:
 *   A honeypot field is a form input that real humans never see and never
 *   fill in. Bots that scrape forms and fill every field they find will
 *   blindly populate it. The server side then drops any submission where
 *   the honeypot field is non-empty.
 *
 * Hiding strategy (defense-in-depth):
 *   1. Visual:        position:absolute + left:-9999px takes it off-screen
 *                     for sighted users even if CSS hadn't loaded yet.
 *   2. Screen reader: aria-hidden="true" prevents AT from announcing it.
 *   3. Keyboard:      tabIndex={-1} removes it from the tab order so keyboard
 *                     users can't accidentally land in it.
 *   4. Autofill:      autoComplete="off" stops Chrome/Safari password
 *                     managers from helpfully filling it with the user's
 *                     real website / URL.
 *
 * Field naming:
 *   Defaults to `website` because that's a plausible-looking field name
 *   bots are likely to fill, while being something we'd never legitimately
 *   ask a roofing customer for. Keep the name consistent everywhere —
 *   the server reads body.website by default.
 *
 * Usage:
 *   <form onSubmit={...}>
 *     ...real fields...
 *     <HoneypotField />            // place anywhere before the submit button
 *     <button type="submit">Send</button>
 *   </form>
 *
 *   For controlled forms that JSON-stringify state (most of ours), wire it
 *   via the `value` / `onChange` props and include `website` in the POST body
 *   so the server can run checkHoneypot() on it.
 */

interface HoneypotFieldProps {
  /** Field name. Default `website`. Keep consistent with server check. */
  name?: string;
  /** Controlled value, if you want to forward it in the JSON POST body. */
  value?: string;
  /** Controlled onChange, paired with `value`. */
  onChange?: (value: string) => void;
}

export default function HoneypotField({
  name = 'website',
  value,
  onChange,
}: HoneypotFieldProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: 1,
        height: 1,
        overflow: 'hidden',
      }}
    >
      <label htmlFor={`hp-${name}`}>Website (leave blank)</label>
      {value !== undefined && onChange ? (
        // Controlled: caller manages state and forwards `website` in POST body.
        <input
          type="text"
          id={`hp-${name}`}
          name={name}
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        // Uncontrolled: relies on FormData.get(name) at submit time.
        <input
          type="text"
          id={`hp-${name}`}
          name={name}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      )}
    </div>
  );
}
