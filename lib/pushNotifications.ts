import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { getSyncValue, setSyncValue } from "@/lib/syncStore";

const PUSH_SUBSCRIPTIONS_KEY = "pf-control-push-subs-v1";

type StoredSubscription = {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) {
    return true;
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@pf-control.local";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

async function getSubscriptions(): Promise<StoredSubscription[]> {
  const raw = await getSyncValue(PUSH_SUBSCRIPTIONS_KEY);
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(
    (item): item is StoredSubscription =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as StoredSubscription).endpoint === "string"
  );
}

async function saveSubscriptions(subscriptions: StoredSubscription[]) {
  await setSyncValue(PUSH_SUBSCRIPTIONS_KEY, subscriptions);
}

export async function addPushSubscription(subscription: StoredSubscription) {
  const current = await getSubscriptions();
  const next = [
    subscription,
    ...current.filter((item) => item.endpoint !== subscription.endpoint),
  ];

  await saveSubscriptions(next);
}

export async function removePushSubscription(endpoint: string) {
  const current = await getSubscriptions();
  const next = current.filter((item) => item.endpoint !== endpoint);
  await saveSubscriptions(next);
}

export async function sendPushNotificationToAll(payload: Record<string, unknown>) {
  if (!configureVapid()) {
    return;
  }

  const subscriptions = await getSubscriptions();
  if (subscriptions.length === 0) {
    return;
  }

  const deadEndpoints = new Set<string>();
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          subscription as unknown as WebPushSubscription,
          body
        );
      } catch (error: unknown) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          deadEndpoints.add(subscription.endpoint);
        }
      }
    })
  );

  if (deadEndpoints.size > 0) {
    const cleaned = subscriptions.filter(
      (item) => !deadEndpoints.has(item.endpoint)
    );
    await saveSubscriptions(cleaned);
  }
}

export async function notifySyncChanged(key: string) {
  await sendPushNotificationToAll({
    title: "PF Control",
    body: `Se guardo un cambio en ${key}`,
    key,
    at: new Date().toISOString(),
  });
}
