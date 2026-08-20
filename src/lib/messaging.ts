// ──────────────────────────────────────────────────────────────
// Type-safe Chrome Messaging Layer
// ──────────────────────────────────────────────────────────────

import type { MessageType, MessageMap, Message, MessageResponse } from '@/types/messages';

/**
 * Generate a unique request ID for message correlation.
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Send a typed message from content script or popup to the background service worker.
 * Returns a typed response.
 */
export async function sendMessage<T extends MessageType>(
  type: T,
  payload: MessageMap[T]['payload']
): Promise<MessageMap[T]['response']> {
  const requestId = generateRequestId();
  const message: Message<T> = { type, payload, requestId };

  const MAX_RETRIES = 2;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await chrome.runtime.sendMessage(message) as MessageResponse<T>;

      if (!response) {
        throw new Error(`No response received for message type: ${type}`);
      }

      if (!response.success) {
        throw new Error(response.error ?? `Message failed: ${type}`);
      }

      return response.data as MessageMap[T]['response'];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.includes('Extension context invalidated')) {
        console.warn('[AURE] Extension context invalidated, reload the page.');
        throw lastError;
      }

      // Chrome MV3: service worker was terminated before responding — retry
      const isPortClosed =
        lastError.message.includes('message port closed') ||
        lastError.message.includes('Could not establish connection') ||
        lastError.message.includes('Receiving end does not exist');

      if (isPortClosed && attempt < MAX_RETRIES) {
        console.warn(`[AURE] Service worker port closed for ${type}, retrying (${attempt + 1}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error(`Message failed after retries: ${type}`);
}

/**
 * Send a message to a specific tab's content script.
 */
export async function sendTabMessage<T extends MessageType>(
  tabId: number,
  type: T,
  payload: MessageMap[T]['payload']
): Promise<MessageMap[T]['response']> {
  const requestId = generateRequestId();
  const message: Message<T> = { type, payload, requestId };

  const response = await chrome.tabs.sendMessage(tabId, message) as MessageResponse<T>;

  if (!response?.success) {
    throw new Error(response?.error ?? `Tab message failed: ${type}`);
  }

  return response.data as MessageMap[T]['response'];
}

/**
 * Type-safe message handler registration for the background service worker.
 */
type MessageHandler<T extends MessageType> = (
  payload: MessageMap[T]['payload'],
  sender: chrome.runtime.MessageSender
) => Promise<MessageMap[T]['response']>;

const handlers = new Map<string, MessageHandler<MessageType>>();

/**
 * Register a handler for a specific message type.
 */
export function onMessage<T extends MessageType>(
  type: T,
  handler: MessageHandler<T>
): void {
  handlers.set(type, handler as any as MessageHandler<MessageType>);
}

/**
 * Initialize the message listener in the background service worker.
 * Call this once in entrypoints/background/index.ts.
 */
export function initMessageListener(): void {
  chrome.runtime.onMessage.addListener(
    (message: Message, sender, sendResponse) => {
      // Enforce sender-level authorization (AURE-03): Reject messages not originating from this extension
      if (sender.id !== chrome.runtime.id) {
        console.warn(`[AURE Security] Rejected unauthorized message from external sender: ${sender.id}`);
        sendResponse({
          success: false,
          error: 'Unauthorized message sender',
          requestId: message?.requestId,
        } satisfies MessageResponse);
        return false;
      }

      if (!message || typeof message.type !== 'string') {
        return false;
      }

      const handler = handlers.get(message.type);

      if (!handler) {
        sendResponse({
          success: false,
          error: `No handler for message type: ${message.type}`,
          requestId: message.requestId,
        } satisfies MessageResponse);
        return false;
      }

      // Handle async response
      handler(message.payload, sender)
        .then((data) => {
          sendResponse({
            success: true,
            data,
            requestId: message.requestId,
          } satisfies MessageResponse);
        })
        .catch((error: Error) => {
          console.error(`[AURE] Handler error for ${message.type}:`, error);
          sendResponse({
            success: false,
            error: error.message,
            requestId: message.requestId,
          } satisfies MessageResponse);
        });

      // Return true to indicate async sendResponse
      return true;
    }
  );
}
