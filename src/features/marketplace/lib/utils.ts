//src\features\marketplace\lib\utils.ts

export function formatPrice(price: number): string {
  return (price / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

export function formatLotPrice(price: number): string {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function parsePrice(amount: string): number {
  return Math.floor(parseFloat(amount) * 1_000_000);
}