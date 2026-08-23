import webpush from "web-push";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { logger } from "../../common/services/logger.js";

const configured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (configured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export function getVapidPublicKey() {
  return env.VAPID_PUBLIC_KEY ?? null;
}

export async function subscribe(userId: string, data: { endpoint: string; p256dh: string; auth: string }) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    create: { userId, endpoint: data.endpoint, p256dh: data.p256dh, auth: data.auth },
    update: { userId, p256dh: data.p256dh, auth: data.auth },
  });
}

export async function unsubscribe(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

type PushPayload = { title: string; body: string };

async function send(subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[], payload: PushPayload) {
  const sends = subscriptions.map((sub) =>
    webpush
      .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload))
      .catch(async (err: { statusCode?: number; message: string }) => {
        if (err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          logger.error(`[push] failed to send to subscription ${sub.id}:`, err.message);
        }
      }),
  );
  await Promise.allSettled(sends);
}

/** Send a push notification to every subscription of one user. No-op if push isn't configured. */
export async function notifyUser(userId: string, payload: PushPayload) {
  if (!configured) return;
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length > 0) await send(subscriptions, payload);
}

/** Send a push notification to every user whose role grants the given permission key. */
export async function notifyPermission(permissionKey: string, payload: PushPayload) {
  if (!configured) return;
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { user: { role: { permissions: { some: { permission: { key: permissionKey } } } } } },
  });
  if (subscriptions.length > 0) await send(subscriptions, payload);
}
