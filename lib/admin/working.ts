import type { AdminAudio, AdminExhibit, AdminPhoto, AdminState, WorkingState } from './types'

/** Fresh working copy of a loaded state: each section's `originalId` is its loaded id. */
export function toWorking(state: AdminState): WorkingState {
  return { ...state, sections: state.sections.map((s) => ({ ...s, originalId: s.id })) }
}

export function replaceExhibit(exhibits: AdminExhibit[], next: AdminExhibit): AdminExhibit[] {
  return exhibits.map((e) => (e.id === next.id ? next : e))
}

/** Replace the row for (exhibit_id, language), or append if there is none yet. */
export function upsertAudio(audio: AdminAudio[], next: AdminAudio): AdminAudio[] {
  const i = audio.findIndex((a) => a.exhibit_id === next.exhibit_id && a.language === next.language)
  return i < 0 ? [...audio, next] : audio.map((a, j) => (j === i ? next : a))
}

/** Swap one exhibit's photos for `next` (the full list after an edit); other exhibits' photos are untouched. */
export function replaceExhibitPhotos(photos: AdminPhoto[], exhibitId: string, next: AdminPhoto[]): AdminPhoto[] {
  return [...photos.filter((p) => p.exhibit_id !== exhibitId), ...next]
}
