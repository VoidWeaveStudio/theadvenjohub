// src/features/admin/ui/AdminDashboard.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    LayoutDashboard,
    Users,
    Shield,
    Scroll,
    Trophy,
    Receipt,
    Tags,
    Gamepad2,
    ArrowLeftRight,
    Globe2,
    CalendarClock,
    LifeBuoy,
    MessagesSquare,
    RefreshCw,
    LogOut,
    Wallet,
    TriangleAlert,
} from "lucide-react";
import { AdminPlayersTable } from "./AdminPlayersTable";
import { AdminFactionsTable } from "./AdminFactionsTable";
import { AdminSupportTable } from "./AdminSupportTable";
import { AdminChatTable } from "./AdminChatTable";
import { AdminTradeHistoryTable } from "./AdminTradeHistoryTable";
import { AdminFactionQuestsTable } from "./AdminFactionQuestsTable";
import { AdminBasementTable } from "./AdminBasementTable";
import { AdminEventsTable } from "./AdminEventsTable";
import { AdminTournamentsTable } from "./AdminTournamentsTable";
import { AdminShopPricesTable } from "./AdminShopPricesTable";
import { AdminGamePricesTable } from "./AdminGamePricesTable";
import { AdminMaintenanceToggle } from "./AdminMaintenanceToggle";
import { AdminWorldPanel } from "./AdminWorldPanel";
import { AdminInfluencePanel } from "./AdminInfluencePanel";
import { AdminOverview } from "./AdminOverview";
import { AdminPurchasesTable } from "./AdminPurchasesTable";
import { AdminTableRef } from "./AdminTableRef";
import { Badge, Panel } from "./AdminKit";

const WalletMultiButton = dynamic(
    () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
    { ssr: false }
);

type AdminSection =
    | "overview"
    | "players"
    | "factions"
    | "quests"
    | "tournaments"
    | "purchases"
    | "shop"
    | "gamePrices"
    | "trades"
    | "world"
    | "events"
    | "support"
    | "chat";

interface NavEntry {
    id: AdminSection;
    label: string;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
}

const NAV: { group: string; items: NavEntry[] }[] = [
    {
        group: "Dashboard",
        items: [
            { id: "overview", label: "Overview", title: "Overview", subtitle: "Live numbers across players, revenue and the world", icon: LayoutDashboard },
            { id: "players", label: "Players", title: "Players", subtitle: "Search, inspect, grant and revoke everything a player owns", icon: Users },
        ],
    },
    {
        group: "Community",
        items: [
            { id: "factions", label: "Factions", title: "Factions", subtitle: "Rosters, levels and paid faction perks", icon: Shield },
            { id: "quests", label: "Faction quests", title: "Faction quests", subtitle: "Published quests, banks and payouts", icon: Scroll },
            { id: "tournaments", label: "Tournaments", title: "Tournaments", subtitle: "Contests on the main hall billboard", icon: Trophy },
        ],
    },
    {
        group: "Economy",
        items: [
            { id: "purchases", label: "Purchases", title: "Purchases", subtitle: "Every paid transaction — who, when, how much", icon: Receipt },
            { id: "shop", label: "Item prices", title: "Item prices", subtitle: "In-game shop catalogue and pricing", icon: Tags },
            { id: "gamePrices", label: "Game prices", title: "Game prices", subtitle: "Storefront price of each game", icon: Gamepad2 },
            { id: "trades", label: "Trade history", title: "Trade history", subtitle: "Player to player trades", icon: ArrowLeftRight },
        ],
    },
    {
        group: "World",
        items: [
            { id: "world", label: "World state", title: "World state", subtitle: "Rampart, rift, basement pedestals and maintenance", icon: Globe2 },
            { id: "events", label: "Events", title: "Events", subtitle: "Doors in the Events Hall", icon: CalendarClock },
        ],
    },
    {
        group: "Moderation",
        items: [
            { id: "support", label: "Support", title: "Support", subtitle: "Player tickets and replies", icon: LifeBuoy },
            { id: "chat", label: "Chat log", title: "Chat log", subtitle: "Global chat history and deletions", icon: MessagesSquare },
        ],
    },
];

const ALL_ENTRIES = NAV.flatMap((group) => group.items);

export function AdminDashboard() {
    const router = useRouter();
    const { connected, publicKey } = useWallet();
    const [section, setSection] = useState<AdminSection>("overview");
    const [maintenance, setMaintenance] = useState<{ enabled: boolean } | null>(null);
    const [openTickets, setOpenTickets] = useState<number | null>(null);
    const [refreshTick, setRefreshTick] = useState(0);

    const playersRef = useRef<AdminTableRef>(null);
    const factionsRef = useRef<AdminTableRef>(null);
    const supportRef = useRef<AdminTableRef>(null);
    const chatRef = useRef<AdminTableRef>(null);
    const tradesRef = useRef<AdminTableRef>(null);
    const questsRef = useRef<AdminTableRef>(null);
    const basementRef = useRef<AdminTableRef>(null);
    const eventsRef = useRef<AdminTableRef>(null);
    const tournamentsRef = useRef<AdminTableRef>(null);
    const shopRef = useRef<AdminTableRef>(null);
    const gamePricesRef = useRef<AdminTableRef>(null);
    const maintenanceRef = useRef<AdminTableRef>(null);
    const worldRef = useRef<AdminTableRef>(null);
    const influenceRef = useRef<AdminTableRef>(null);
    const purchasesRef = useRef<AdminTableRef>(null);

    const loadHeader = useCallback(async () => {
        try {
            const [maintenanceRes, overviewRes] = await Promise.all([
                fetch("/api/admin/maintenance", { credentials: "include" }),
                fetch("/api/admin/overview", { credentials: "include" }),
            ]);
            if (maintenanceRes.ok) setMaintenance(await maintenanceRes.json());
            if (overviewRes.ok) {
                const data = await overviewRes.json();
                setOpenTickets(Number(data?.world?.ticketsOpen ?? 0) || 0);
            }
        } catch {
            setMaintenance(null);
        }
    }, []);

    useEffect(() => {
        loadHeader();
    }, [loadHeader, refreshTick]);

    const handleRefresh = () => {
        setRefreshTick((tick) => tick + 1);
        const map: Record<AdminSection, React.RefObject<AdminTableRef | null> | null> = {
            overview: null,
            players: playersRef,
            factions: factionsRef,
            quests: questsRef,
            tournaments: tournamentsRef,
            purchases: purchasesRef,
            shop: shopRef,
            gamePrices: gamePricesRef,
            trades: tradesRef,
            world: worldRef,
            events: eventsRef,
            support: supportRef,
            chat: chatRef,
        };
        map[section]?.current?.refresh();
        if (section === "world") {
            maintenanceRef.current?.refresh();
            basementRef.current?.refresh();
        }
    };

    const handleLogout = async () => {
        await fetch("/api/admin/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
        router.push("/admin/login");
    };

    const active = ALL_ENTRIES.find((entry) => entry.id === section) ?? ALL_ENTRIES[0];

    return (
        <div className="a-shell">
            <nav className="a-side">
                {NAV.map((group) => (
                    <div key={group.group} className="a-side-group">
                        <span className="a-side-label">{group.group}</span>
                        {group.items.map((entry) => {
                            const Icon = entry.icon;
                            return (
                                <button
                                    key={entry.id}
                                    type="button"
                                    className="a-nav"
                                    data-active={section === entry.id}
                                    onClick={() => setSection(entry.id)}
                                >
                                    <Icon />
                                    {entry.label}
                                    {entry.id === "support" && !!openTickets && (
                                        <span className="a-nav-count" data-tone="warn">{openTickets}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="a-main">
                <header className="a-top">
                    <div>
                        <div className="a-top-title">{active.title}</div>
                        <div className="a-top-sub">{active.subtitle}</div>
                    </div>

                    <div className="a-row a-spacer">
                        {maintenance?.enabled && (
                            <button type="button" className="a-btn a-btn-danger" onClick={() => setSection("world")}>
                                <TriangleAlert />
                                Maintenance on
                            </button>
                        )}

                        {connected && publicKey ? (
                            <Badge tone="good" dot>
                                <Wallet className="w-3 h-3" />
                                {`${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`}
                            </Badge>
                        ) : (
                            <WalletMultiButton />
                        )}

                        <button type="button" className="a-btn" onClick={handleRefresh}>
                            <RefreshCw />
                            Refresh
                        </button>
                        <button type="button" className="a-btn a-btn-ghost" onClick={handleLogout}>
                            <LogOut />
                            Sign out
                        </button>
                    </div>
                </header>

                {!connected && (
                    <div className="a-alert" data-tone="warn">
                        Your admin wallet is not connected. Read-only views work, but every grant, ban or price change needs a
                        wallet signature — connect above before acting.
                    </div>
                )}

                {section === "overview" && <AdminOverview refreshKey={refreshTick} onNavigate={(next) => setSection(next as AdminSection)} />}
                {section === "players" && <AdminPlayersTable ref={playersRef} />}
                {section === "factions" && <AdminFactionsTable ref={factionsRef} />}
                {section === "quests" && (
                    <Panel title="Faction quests">
                        <AdminFactionQuestsTable ref={questsRef} />
                    </Panel>
                )}
                {section === "tournaments" && (
                    <Panel title="Tournaments">
                        <AdminTournamentsTable ref={tournamentsRef} />
                    </Panel>
                )}
                {section === "purchases" && <AdminPurchasesTable ref={purchasesRef} />}
                {section === "shop" && (
                    <Panel title="Shop items & prices">
                        <AdminShopPricesTable ref={shopRef} />
                    </Panel>
                )}
                {section === "gamePrices" && (
                    <Panel title="Game prices">
                        <AdminGamePricesTable ref={gamePricesRef} />
                    </Panel>
                )}
                {section === "trades" && (
                    <Panel title="Trade history">
                        <AdminTradeHistoryTable ref={tradesRef} />
                    </Panel>
                )}
                {section === "world" && (
                    <>
                        <AdminMaintenanceToggle ref={maintenanceRef} />
                        <AdminWorldPanel ref={worldRef} />
                        <AdminInfluencePanel ref={influenceRef} />
                        <Panel title="Basement pedestals">
                            <AdminBasementTable ref={basementRef} />
                        </Panel>
                    </>
                )}
                {section === "events" && (
                    <Panel title="Events hall">
                        <AdminEventsTable ref={eventsRef} />
                    </Panel>
                )}
                {section === "support" && (
                    <Panel title="Support tickets">
                        <AdminSupportTable ref={supportRef} />
                    </Panel>
                )}
                {section === "chat" && (
                    <Panel title="Chat log">
                        <AdminChatTable ref={chatRef} />
                    </Panel>
                )}
            </div>
        </div>
    );
}
