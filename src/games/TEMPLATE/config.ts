//src\games\TEMPLATE\config.ts
export const config = {
  id: "template-game",
  title: "Template Game",
  price: 0,
  version: "0.1.0",
  status: "active",
  requirements: {
    walletConnected: true,
  },
} as const;