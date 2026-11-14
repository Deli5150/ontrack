import { Platform } from 'react-native'
import { formatMoney } from './currency'
import { addDays, formatDate, isActive, paymentsBetween, priceOn, today, toDate } from './dates'
import { desktop } from './storage'
import type { Settings, Subscription } from './types'

// Reminders before payments: worked out here for the next couple of months and handed to the
// system (phones) or the desktop app's scheduler, again whenever anything changes.

export interface Reminder {
  id: string
  at: number
  title: string
  body: string
}

const MAX = 60

export function computeReminders(subs: Subscription[], settings: Settings, now = Date.now()): Reminder[] {
  if (!settings.notifications) return []
  const [hh, mm] = settings.notifyTime.split(':').map(Number)
  const from = today()
  const to = addDays(from, 70)
  const out: Reminder[] = []
  for (const sub of subs) {
    if (sub.notify === null || !isActive(sub)) continue
    for (const date of paymentsBetween(sub, from, to)) {
      const day = toDate(addDays(date, -sub.notify))
      day.setHours(hh || 0, mm || 0, 0, 0)
      if (day.getTime() <= now) continue
      const when = sub.notify === 0 ? 'today' : sub.notify === 1 ? 'tomorrow' : `in ${sub.notify} days`
      const trial = sub.freeTrial && date === sub.startDate
      out.push({
        id: `${sub.id}:${date}`,
        at: day.getTime(),
        title: trial ? `${sub.name} trial ends ${when}` : `${sub.name} renews ${when}`,
        body: `${formatMoney(priceOn(sub, date), sub.currency)} on ${formatDate(date)}`
      })
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX)
}

async function scheduleNative(reminders: Reminder[]): Promise<void> {
  const N = await import('expo-notifications')
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('reminders', { name: 'Payment reminders', importance: N.AndroidImportance.HIGH })
  }
  await N.cancelAllScheduledNotificationsAsync()
  if (!reminders.length) return
  const perm = await N.getPermissionsAsync()
  if (!perm.granted) {
    if (!perm.canAskAgain) return
    const asked = await N.requestPermissionsAsync()
    if (!asked.granted) return
  }
  for (const r of reminders) {
    await N.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, sound: true },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(r.at), channelId: 'reminders' }
    })
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
/** What was last scheduled, so edits that don't change any reminder (most of them) schedule nothing. */
let lastScheduled = ''

/** Re-schedules every reminder (shortly, so a burst of edits schedules once), when they changed. */
export function syncReminders(subs: Subscription[], settings: Settings, force = false): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    const reminders = computeReminders(subs, settings)
    const key = JSON.stringify(reminders)
    if (!force && key === lastScheduled) return
    lastScheduled = key
    if (desktop) desktop.setReminders(reminders)
    else if (Platform.OS !== 'web') scheduleNative(reminders).catch((e) => console.warn('OnTrack: reminders', e))
  }, 1500)
}

/** Sends one right away, to check notifications work. */
export async function testNotification(): Promise<boolean> {
  const r: Reminder = { id: `test-${Date.now()}`, at: Date.now() + 1500, title: 'OnTrack', body: 'Reminders are working. You’ll get one like this before each payment.' }
  if (desktop) {
    desktop.notifyNow(r.title, r.body)
    return true
  }
  if (Platform.OS === 'web') return false
  const N = await import('expo-notifications')
  const perm = await N.requestPermissionsAsync()
  if (!perm.granted) return false
  await N.scheduleNotificationAsync({ content: { title: r.title, body: r.body }, trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, channelId: 'reminders' } })
  return true
}
