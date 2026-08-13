/**
 * WAI-ARIA tabs keyboard support for custom `role="tablist"` containers:
 * Arrow keys move between tabs (wrapping), Home/End jump to the ends.
 * Attach to the tablist's `onKeyDown` and pair with roving tabindex
 * (`tabIndex={active ? 0 : -1}` on each `role="tab"`).
 */
export function handleTabListKeyDown(event: React.KeyboardEvent<HTMLElement>) {
  const { key } = event;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;

  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'),
  );
  const current = tabs.indexOf(document.activeElement as HTMLElement);
  if (current === -1) return;

  event.preventDefault();
  let next = current;
  if (key === "ArrowRight") next = (current + 1) % tabs.length;
  else if (key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
  else if (key === "Home") next = 0;
  else next = tabs.length - 1;

  const target = tabs[next];
  if (!target) return;
  target.focus();
  target.click();
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab / Shift+Tab focus cycling inside a `role="dialog"` container.
 * Attach to the dialog element's `onKeyDown`.
 */
export function trapDialogTabKey(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;

  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
