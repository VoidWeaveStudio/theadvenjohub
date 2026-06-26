// src/features/games/components/GamePageContent.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { apiGet } from "@/core/api/client";
import { PurchaseButton } from "@/features/shared/PurchaseButton";
import { Spinner } from "@/core/ui/Spinner";

interface GameData {
    id: string;
    slug: string;
    title: string;
    developer: string | null;
    publisher: string | null;
    coverImage: string | null;
    backgroundImage: string | null;
    price: number;
    releaseDate: string | null;
    platform: string | null;
    status: string;
    isOwned: boolean;
    screenshots: { id: string; url: string }[];
    videos: { id: string; url: string; title: string | null; type: string }[];
    description: { shortDescription: string | null; fullDescription: string | null } | null;
    systemRequirements: {
        id: string;
        type: string;
        os: string | null;
        processor: string | null;
        memory: string | null;
        graphics: string | null;
        storage: string | null;
        additionalNotes: string | null;
    }[];
    reviews: {
        id: string;
        rating: number;
        title: string | null;
        content: string;
        isPositive: boolean;
        createdAt: string;
        userWallet: string;
    }[];
    tags: string[];
    features: string[];
    stats: {
        reviewsCount: number;
        positivePercent: number;
        playersCount: string;
    };
}

export default function GamePageContent() {
    const params = useParams();
    const slug = params.slug as string;
    const { t, language } = useLanguage();

    const [game, setGame] = useState<GameData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeScreenshot, setActiveScreenshot] = useState(0);
    const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "requirements">("overview");

    useEffect(() => {
        const loadGame = async () => {
            try {
                setLoading(true);
                const data = await apiGet<GameData>(`/api/games/${slug}/full?lang=${language}`);
                setGame(data);
            } catch (err: any) {
                setError(err.message || "Failed to load game");
            } finally {
                setLoading(false);
            }
        };

        if (slug) {
            loadGame();
        }
    }, [slug, language]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Spinner size="lg" />
            </div>
        );
    }

    if (error || !game) {
        return (
            <div className="text-center py-20">
                <p className="text-xl text-text-secondary">{error || "Game not found"}</p>
            </div>
        );
    }

    const formatPrice = (price: number) => {
        if (price <= 0) return t("game.free") || "Free";
        return `${price.toLocaleString("en-US")} TNJ`;
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { label: string; color: string }> = {
            development: { label: t("game.status.development") || "In Development", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
            released: { label: t("game.status.released") || "Released", color: "bg-green-500/10 text-green-400 border-green-500/30" },
            coming_soon: { label: t("game.status.coming_soon") || "Coming Soon", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
        };
        return badges[status] || badges.development;
    };

    const statusBadge = getStatusBadge(game.status);

    return (
        <div className="min-h-screen">
            <div className="relative h-[60vh] min-h-[500px] overflow-hidden">
                {game.backgroundImage ? (
                    <Image
                        src={game.backgroundImage}
                        alt={game.title}
                        fill
                        className="object-cover"
                        priority
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-surface" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />

                <div className="relative z-10 h-full flex items-end pb-12">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
                        <div className="flex items-end gap-8">
                            <div className="flex-shrink-0">
                                {game.coverImage ? (
                                    <div className="relative rounded-xl overflow-hidden shadow-2xl border-2 border-border bg-surface">
                                        <Image
                                            src={game.coverImage}
                                            alt={game.title}
                                            width={400}
                                            height={600}
                                            className="w-auto h-auto max-w-full max-h-[400px] object-contain"
                                            priority
                                            sizes="(max-width: 768px) 100vw, 400px"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-48 h-64 bg-surface rounded-xl border-2 border-border flex items-center justify-center text-6xl">
                                        🎮
                                    </div>
                                )}
                            </div>

                            <div className="flex-1">
                                <h1 className="text-5xl font-bold text-foreground mb-4">{game.title}</h1>

                                <div className="flex items-center gap-4 mb-6">
                                    {game.developer && (
                                        <p className="text-lg text-text-secondary">
                                            {t("game.developer") || "Developer"}: <span className="text-foreground">{game.developer}</span>
                                        </p>
                                    )}
                                    {game.publisher && (
                                        <p className="text-lg text-text-secondary">
                                            {t("game.publisher") || "Publisher"}: <span className="text-foreground">{game.publisher}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className={`px-4 py-2 rounded-lg border ${statusBadge.color}`}>
                                        {statusBadge.label}
                                    </span>
                                    {game.releaseDate && (
                                        <span className="text-text-secondary">
                                            {t("game.releaseDate") || "Release"}: {new Date(game.releaseDate).toLocaleDateString(language)}
                                        </span>
                                    )}
                                    {game.platform && (
                                        <span className="text-text-secondary">
                                            {game.platform}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-foreground">{t("game.media") || "Media"}</h2>

                            <div className="aspect-video rounded-xl overflow-hidden bg-surface border border-border">
                                {game.videos.length > 0 ? (
                                    <video
                                        src={game.videos[0].url}
                                        controls
                                        className="w-full h-full object-cover"
                                    />
                                ) : game.screenshots.length > 0 ? (
                                    <Image
                                        src={game.screenshots[activeScreenshot]?.url || game.screenshots[0].url}
                                        alt="Screenshot"
                                        width={1280}
                                        height={720}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-text-muted">
                                        {t("game.noMedia") || "No media available"}
                                    </div>
                                )}
                            </div>

                            {game.screenshots.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {game.screenshots.map((screenshot, idx) => (
                                        <button
                                            key={screenshot.id}
                                            onClick={() => setActiveScreenshot(idx)}
                                            className={`flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden border-2 transition-all ${activeScreenshot === idx ? "border-primary" : "border-transparent hover:border-border"
                                                }`}
                                        >
                                            <Image
                                                src={screenshot.url}
                                                alt={`Screenshot ${idx + 1}`}
                                                width={128}
                                                height={80}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-b border-border">
                            <div className="flex gap-6">
                                <button
                                    onClick={() => setActiveTab("overview")}
                                    className={`pb-3 px-1 font-medium transition-colors ${activeTab === "overview"
                                        ? "text-primary border-b-2 border-primary"
                                        : "text-text-secondary hover:text-foreground"
                                        }`}
                                >
                                    {t("game.overview") || "Overview"}
                                </button>
                                <button
                                    onClick={() => setActiveTab("reviews")}
                                    className={`pb-3 px-1 font-medium transition-colors ${activeTab === "reviews"
                                        ? "text-primary border-b-2 border-primary"
                                        : "text-text-secondary hover:text-foreground"
                                        }`}
                                >
                                    {t("game.reviews") || "Reviews"} ({game.stats.reviewsCount})
                                </button>
                                <button
                                    onClick={() => setActiveTab("requirements")}
                                    className={`pb-3 px-1 font-medium transition-colors ${activeTab === "requirements"
                                        ? "text-primary border-b-2 border-primary"
                                        : "text-text-secondary hover:text-foreground"
                                        }`}
                                >
                                    {t("game.requirements") || "System Requirements"}
                                </button>
                            </div>
                        </div>

                        {activeTab === "overview" && (
                            <div className="space-y-6">
                                {game.description?.shortDescription && (
                                    <p className="text-lg text-text-secondary">{game.description.shortDescription}</p>
                                )}

                                {game.description?.fullDescription && (
                                    <div className="prose prose-invert max-w-none">
                                        <p className="whitespace-pre-wrap text-text-secondary leading-relaxed">
                                            {game.description.fullDescription.split(/(https?:\/\/[^\s]+)/).map((part, idx) => {
                                                if (part.match(/^https?:\/\//)) {
                                                    return (
                                                        <a
                                                            key={idx}
                                                            href={part}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:underline font-medium"
                                                        >
                                                            {part}
                                                        </a>
                                                    );
                                                }
                                                return <span key={idx}>{part}</span>;
                                            })}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "reviews" && (
                            <div className="space-y-6">
                                {game.reviews.length === 0 ? (
                                    <p className="text-center text-text-secondary py-12">
                                        {t("game.noReviews") || "No reviews yet"}
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {game.reviews.map((review) => (
                                            <div key={review.id} className="card p-6 space-y-3">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="flex">
                                                                {[...Array(5)].map((_, i) => (
                                                                    <span key={i} className={i < review.rating ? "text-yellow-400" : "text-text-muted"}>
                                                                        ★
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <span className={`text-sm ${review.isPositive ? "text-green-400" : "text-red-400"}`}>
                                                                {review.isPositive ? (t("game.recommended") || "Recommended") : (t("game.notRecommended") || "Not Recommended")}
                                                            </span>
                                                        </div>
                                                        {review.title && (
                                                            <h4 className="font-semibold text-foreground">{review.title}</h4>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-text-muted">
                                                        {new Date(review.createdAt).toLocaleDateString(language)}
                                                    </span>
                                                </div>
                                                <p className="text-text-secondary">{review.content}</p>
                                                <p className="text-xs text-text-muted">
                                                    {t("game.reviewBy") || "By"} {review.userWallet.slice(0, 6)}...{review.userWallet.slice(-4)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "requirements" && (
                            <div className="space-y-6">
                                {game.systemRequirements.length === 0 ? (
                                    <p className="text-center text-text-secondary py-12">
                                        {t("game.noRequirements") || "System requirements not specified"}
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {game.systemRequirements.map((req) => {
                                            const translateValue = (value: string | null) => {
                                                if (!value) return "—";
                                                if (value === "available") return t("game.sysreq.available") || "Available";
                                                if (value === "not_available") return t("game.sysreq.notAvailable") || "Not available";
                                                if (value === "tbd") return t("game.sysreq.tbd") || "To be determined";
                                                return value;
                                            };

                                            return (
                                                <div key={req.id} className="card p-6 space-y-3">
                                                    <h3 className="text-lg font-bold text-foreground">
                                                        {req.type === "minimum"
                                                            ? (t("game.minimum") || "Minimum")
                                                            : (t("game.recommended") || "Recommended")}
                                                    </h3>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-text-muted">{t("game.os") || "OS"}:</span>
                                                            <span className="text-foreground font-medium">{translateValue(req.os)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-text-muted">{t("game.processor") || "Processor"}:</span>
                                                            <span className="text-foreground font-medium">{translateValue(req.processor)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-text-muted">{t("game.memory") || "Memory"}:</span>
                                                            <span className="text-foreground font-medium">{translateValue(req.memory)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-text-muted">{t("game.graphics") || "Graphics"}:</span>
                                                            <span className="text-foreground font-medium">{translateValue(req.graphics)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-text-muted">{t("game.storage") || "Storage"}:</span>
                                                            <span className="text-foreground font-medium">{translateValue(req.storage)}</span>
                                                        </div>
                                                        {req.additionalNotes && req.additionalNotes !== "available" && (
                                                            <div className="pt-2 border-t border-border">
                                                                <span className="text-text-muted">{t("game.additionalNotes") || "Additional Notes"}:</span>
                                                                <p className="text-foreground mt-1">{translateValue(req.additionalNotes)}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="card p-6 sticky top-24 space-y-4">
                            <div className="text-3xl font-bold text-primary">
                                {formatPrice(game.price)}
                            </div>

                            {game.isOwned ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-green-400">
                                        <span className="text-xl">✓</span>
                                        <span className="font-medium">{t("game.owned") || "In Your Library"}</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            console.log("🎮 Play button clicked! Slug:", game.slug);
                                            if (game.slug === "tanjo-shooter") {
                                                window.location.href = `/game/${game.slug}`;
                                            } else {
                                                console.log("Other game, no play action");
                                            }
                                        }}
                                        className="btn-primary w-full py-3"
                                    >
                                        {t("game.play") || "Play Now"}
                                    </button>
                                </div>
                            ) : (
                                <PurchaseButton
                                    gameId={game.id}
                                    price={game.price}
                                    onSuccess={() => {

                                        window.location.reload();
                                    }}
                                />
                            )}

                            <div className="pt-4 border-t border-border space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-text-secondary">{t("game.reviews") || "Reviews"}</span>
                                    <span className="text-foreground font-medium">{game.stats.reviewsCount}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-text-secondary">{t("game.positive") || "Positive"}</span>
                                    <span className="text-green-400 font-medium">{game.stats.positivePercent}%</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-text-secondary">{t("game.players") || "Players"}</span>
                                    <span className="text-foreground font-medium">{game.stats.playersCount}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 