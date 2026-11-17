/** Hard-coded password asked before any admin save. Change it here. */
export const ADMIN_SAVE_PASSWORD = 'change-me'

/** Prompts for the password; false if cancelled or wrong. */
export function confirmAdminPassword(): boolean {
  const input = window.prompt('Enter admin password to save')
  if (input === null) return false
  if (input !== ADMIN_SAVE_PASSWORD) {
    window.alert('Wrong password')
    return false
  }
  return true
}
