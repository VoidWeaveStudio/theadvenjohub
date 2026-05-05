## 🗺️ Roadmap
We are actively expanding the platform's capabilities. In the mid-term, we plan to implement the following key features:

- 🖼️ **Full-Featured NFT Marketplace** — Support for trading unique in-game items, digital assets, and collectibles powered by Solana.
- 📦 **Indie Developer Platform** — A system for third-party developers to upload, publish, and distribute their games directly on the site. Includes monetization tools, verification workflows, and automatic updates.
- 💬 **Real-Time Community Chat** — An integrated chat system for players to communicate, discuss projects, find teammates, and receive support within the ecosystem.

> ⚠️ **Note:** These features are currently in the research and planning phase. Implementation priorities may shift based on community feedback, technical feasibility, and ecosystem needs. We welcome proposals, discussions, and contributions for each of these areas.
## 🔄 Architecture & Future Plans
The current project core is built with **Next.js + TypeScript** and is fully production-ready. 
As traffic grows and business logic becomes more complex, we *may* consider refactoring the backend to a more specialized stack (e.g., Go or Rust). However, this is **not a confirmed roadmap item**—it remains a hypothetical optimization path. 
For now, TypeScript remains the primary development language. The codebase is stable, and all contributors can confidently build upon and extend the current architecture.


## 🔒 Privacy & Data Collection

This platform is built with a strict **privacy-first** architecture. We do not track, profile, or collect any personal data beyond what is absolutely required for authentication, gameplay, and platform security.

### ✅ What We Store
- **Public Wallet Address**: Used exclusively for authentication and user identification. Linked to your account internally.
- **Game & Marketplace Progress**: Purchase history, in-game balances, upgrades, and skins. Stored only to preserve your gameplay state.
- **User-Generated Content**: Forum posts and comments. Stored only when you explicitly publish them.
- **Session Tokens**: Secure, `httpOnly` cookies (`token`, `refresh_token`, `csrf_token`) used solely for maintaining your login session.

### ❌ What We DO NOT Collect
- 🚫 **Email addresses, phone numbers, or real names**
- 🚫 **Geolocation, device fingerprints, or browsing history**
- 🚫 **Private keys, seed phrases, or any wallet credentials**
- 🚫 **Persistent IP logs, analytics, or cross-site trackers**
- 🚫 **Third-party cookies or fingerprinting scripts**

### 🌐 What About IP Addresses?
IP addresses are temporarily read from the `x-forwarded-for` header **strictly for rate limiting** (e.g., preventing spam or brute-force attempts). They are **never stored in the database**, never written to logs, and never shared with third parties. IP data is held only in memory/Redis for a short sliding window and automatically discarded.

### 📂 Transparency: Source Files
All data handling is fully open-source and auditable. Below are the exact files responsible for data collection, processing, and storage:

| Component | File | What It Does |
|:---|:---|:---|
| **Database Schema** | [`src/core/database/schema.ts`](src/core/database/schema.ts) | Defines exactly what is persisted (wallets, posts, purchases, progress) |
| **Authentication** | [`app/api/auth/verify/route.ts`](app/api/auth/verify/route.ts) | Verifies Solana signatures & issues JWT sessions |
| **Session & CSRF** | [`src/core/auth/lib/auth.ts`](src/core/auth/lib/auth.ts), [`src/core/auth/lib/csrf.ts`](src/core/auth/lib/csrf.ts) | Manages secure cookies & cross-site request protection |
| **Rate Limiting (IP)** | [`src/core/lib/rateLimit.ts`](src/core/lib/rateLimit.ts) | Temporary request counters (no persistent storage) |
| **Client Data Flow** | [`src/core/api/client.ts`](src/core/api/client.ts) | Handles secure token transmission & response sanitization |

🔍 **Verify it yourself**: Every database query, cookie flag, and API response is visible in the codebase. We believe transparency is the foundation of trust in Web3.
