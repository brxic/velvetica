export const PWA_UPDATE_CHECK = 'velvetia:pwa-update-check'

/** Cancelable so active editors can veto an update without sharing draft data. */
export function canApplyPwaUpdate() {
  return window.dispatchEvent(new Event(PWA_UPDATE_CHECK, { cancelable: true }))
}
