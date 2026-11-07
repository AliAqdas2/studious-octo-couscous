import { useEffect } from 'react';

const DEFAULT_LEAVE_MESSAGE =
  'You have unsaved changes on this page. Leave anyway? Unsaved edits will be lost.';

/**
 * Confirm navigation when a surface has local dirty state.
 * @param {boolean} dirty
 * @param {string} [message]
 * @returns {boolean} true if navigation may proceed
 */
export function confirmLeave(dirty, message = DEFAULT_LEAVE_MESSAGE) {
  if (!dirty) return true;
  return window.confirm(message);
}

/**
 * Register beforeunload while dirty so browser chrome / refresh also warns.
 * @param {boolean} dirty
 * @param {string} [message]
 */
export function useUnsavedBeforeUnload(
  dirty,
  message = DEFAULT_LEAVE_MESSAGE
) {
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, message]);
}
