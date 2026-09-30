import { api } from './api.js'

function keyToBytes(base64Key) {
  const base64 = (base64Key + '='.repeat((4 - (base64Key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isIphoneBrowserTab() {
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)
  return isIos && !window.matchMedia('(display-mode: standalone)').matches
}

export async function currentSubscription() {
  if (!pushSupported()) {
    return null
  }
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

export async function turnOnPush(publicKey) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked. Allow them in your device settings for Winter Arc.'
        : 'Notifications were not allowed.'
    )
  }
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }))
  await api('/push/subscriptions', { method: 'POST', body: subscription.toJSON() })
}

export async function turnOffPush() {
  const subscription = await currentSubscription()
  if (!subscription) {
    return
  }
  await api('/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } })
  await subscription.unsubscribe()
}

export async function syncPush() {
  if (!pushSupported() || Notification.permission !== 'granted') {
    return
  }
  const subscription = await currentSubscription()
  if (subscription) {
    await api('/push/subscriptions', { method: 'POST', body: subscription.toJSON() })
  }
}
