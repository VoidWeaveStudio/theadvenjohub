//src\features\game\mechanics\social\components\EmoteWheel.tsx
import { EMOTES } from '../config';
import { EmoteId } from '../types';

interface EmoteWheelProps {
  onSelect: (emoteId: EmoteId) => void;
  onClose: () => void;
}

export function EmoteWheel({ onSelect, onClose }: EmoteWheelProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <div className="relative bg-gradient-to-br from-zinc-900/95 to-black/95 border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-black text-white">Emotes</h2>
          <p className="text-zinc-400 text-xs">Click to play • ESC to close</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {EMOTES.map((emote) => (
            <button
              key={emote.id}
              onClick={() => {
                onSelect(emote.id);
                onClose();
              }}
              className="flex flex-col items-center gap-1 p-4 bg-zinc-800/50 hover:bg-purple-600/30 border border-zinc-700 hover:border-purple-500 rounded-xl transition-all"
            >
              <span className="text-3xl">{emote.icon}</span>
              <span className="text-white text-xs font-semibold">{emote.name}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-700/50 font-semibold text-sm"
        >
          Cancel (ESC)
        </button>
      </div>
    </div>
  );
}