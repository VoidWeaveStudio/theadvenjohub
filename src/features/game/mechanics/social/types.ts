export type EmoteId = 'wave' | 'clap' | 'dance' | 'cheer' | 'bow' | 'laugh';

export interface Emote {
  id: EmoteId;
  name: string;
  icon: string;
  duration: number;
}

export interface EmoteState {
  activeEmote: EmoteId | null;
  emoteEndTime: number;
}