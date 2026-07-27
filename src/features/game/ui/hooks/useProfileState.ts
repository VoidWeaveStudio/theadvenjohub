// src/features/game/ui/hooks/useProfileState.ts
import { useCallback, useState } from "react";
import { PlayerProfileData } from "../../network/NetworkManager";

export function useProfileState() {
    const [selfProfile, setSelfProfile] = useState<PlayerProfileData | null>(null);
    const [viewedProfile, setViewedProfile] = useState<PlayerProfileData | null>(null);
    const [isProfileCardOpen, setIsProfileCardOpen] = useState(false);

    const handleSelfProfile = useCallback((profile: PlayerProfileData | null) => {
        setSelfProfile(profile);
    }, []);

    const handleViewedProfile = useCallback((profile: PlayerProfileData | null) => {
        setViewedProfile(profile);
        setIsProfileCardOpen(true);
    }, []);

    const closeProfileCard = useCallback(() => {
        setIsProfileCardOpen(false);
        setViewedProfile(null);
    }, []);

    return {
        selfProfile,
        viewedProfile,
        isProfileCardOpen,
        handleSelfProfile,
        handleViewedProfile,
        closeProfileCard,
    };
}
