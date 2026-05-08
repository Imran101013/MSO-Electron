export const MEETING_SAVED_EVENT = "meeting:saved";

export function emitMeetingSaved() {
  window.dispatchEvent(new CustomEvent(MEETING_SAVED_EVENT));
}

export function onMeetingSaved(cb: () => void) {
  window.addEventListener(MEETING_SAVED_EVENT, cb);
  return () => window.removeEventListener(MEETING_SAVED_EVENT, cb);
}
