import { AsyncLocalStorage } from "node:async_hooks";

type QueuedTelegramAction = {
  updateId: number;
  actionKey: string;
  method: string;
  payload: Record<string, unknown>;
};

type DeliveryContext = {
  updateId: number;
  nextActionIndex: number;
  enqueue: (action: QueuedTelegramAction) => Promise<void>;
};

const deliveryContext = new AsyncLocalStorage<DeliveryContext>();

async function persistTelegramAction(action: QueuedTelegramAction): Promise<void> {
  const { admin } = await import("./db.server");
  const db = await admin();
  const { error } = await db.rpc("enqueue_telegram_action", {
    p_telegram_update_id: action.updateId,
    p_action_key: action.actionKey,
    p_method: action.method,
    p_payload: action.payload,
  });
  if (error) throw error;
}

export async function withTelegramDeliveryContext<T>(
  updateId: number,
  handler: () => Promise<T>,
  enqueue: (action: QueuedTelegramAction) => Promise<void> = persistTelegramAction,
): Promise<T> {
  return deliveryContext.run({ updateId, nextActionIndex: 0, enqueue }, handler);
}

/**
 * Queues outbound Telegram work while processing a durable webhook update.
 * The sequence-based key is stable when that update is retried, so the database
 * can replace an unsent payload without creating another action.
 */
export async function queueTelegramAction(
  method: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const context = deliveryContext.getStore();
  if (!context) return false;

  const actionIndex = context.nextActionIndex++;
  await context.enqueue({
    updateId: context.updateId,
    actionKey: `${String(actionIndex).padStart(3, "0")}:${method}`,
    method,
    payload,
  });
  return true;
}
