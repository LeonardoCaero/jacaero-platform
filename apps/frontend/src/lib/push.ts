import { api } from './axios'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Safe)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function isSubscribed() {
  if (!pushSupported()) return false
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return Boolean(subscription)
}

/** This device's push endpoint, if subscribed — used to exclude it from "other devices" notifications. */
export async function getCurrentEndpoint() {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription?.endpoint ?? null
}

export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('permission-denied')

  const { data } = await api.get<{ publicKey: string | null }>('/push-subscriptions/vapid-public-key')
  if (!data.publicKey) throw new Error('not-configured')

  const registration = await navigator.serviceWorker.register('/sw.js')
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  })

  const json = subscription.toJSON()
  await api.post('/push-subscriptions', { endpoint: json.endpoint, keys: json.keys })
}

export async function disablePush() {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  await api.post('/push-subscriptions/unsubscribe', { endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}
