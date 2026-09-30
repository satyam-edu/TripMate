// Chat alerts on/off switch (new-message pop-up + desktop notification), per device.
// Unread badges always update; this only controls the interruptions.

const KEY = 'tripmate_chat_alerts';

export function alertsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'; // on by default
  } catch {
    return true;
  }
}

export function setAlertsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? 'on' : 'off');
  } catch {
    // storage unavailable (private mode): the switch just won't be remembered
  }
}

// The browser only shows desktop notifications once the user has allowed them.
export function desktopAllowed(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}
