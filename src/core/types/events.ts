//src\core\types\events.ts
export type PlatformEvent =
  | { type: "game:progress:updated"; payload: { gameId: string; userId: string; newBalance: number } }
  | { type: "game:purchase:request"; payload: { gameId: string; userId: string; itemId: string; amount: number } }
  | { type: "auth:login"; payload: { wallet: string } }
  | { type: "auth:logout"; payload: { wallet: string } };

export type EventHandler<T extends PlatformEvent["type"]> = (
  event: Extract<PlatformEvent, { type: T }>
) => void | Promise<void>;