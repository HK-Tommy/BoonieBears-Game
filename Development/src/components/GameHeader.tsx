import React from 'react';
import { Volume2, VolumeX, RotateCcw, BookOpen, Coins } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface GameHeaderProps {
  score: number;
  bestScore: number;
  revivalCoins: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenEvolutionGuide: () => void;
  onRestart: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  score,
  bestScore,
  revivalCoins,
  soundEnabled,
  onToggleSound,
  onOpenEvolutionGuide,
  onRestart,
}) => {
  return (
    <header className="w-full max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      {/* Title & Brand */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md flex items-center justify-center text-2xl border-2 border-amber-200">
          🐻
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-amber-950 flex items-center gap-1.5">
            <span>熊出沒 · 萌友大合成</span>
          </h1>
          <p className="text-xs text-amber-800 font-medium">
            1至12階隨機掉落 · 相同萌友撞擊合體！
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Revival Coins Pill */}
        <div
          title="每2000分獲得一枚復活幣，可用於危急時清除頂部障礙"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100/90 border border-amber-300 text-xs font-bold text-amber-900 shadow-2xs"
        >
          <Coins className="w-4 h-4 text-amber-600" />
          <span>復活幣:</span>
          <span className="font-mono text-emerald-700 text-sm">{revivalCoins}</span>
        </div>

        {/* Evolution Guide Button */}
        <button
          onClick={() => {
            soundManager.playClick();
            onOpenEvolutionGuide();
          }}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white hover:bg-amber-50 active:scale-95 border border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-1.5 shadow-2xs transition-all"
          title="合成圖鑑"
        >
          <BookOpen className="w-4 h-4 text-amber-600" />
          <span className="hidden sm:inline">合成表</span>
        </button>

        {/* Sound Toggle */}
        <button
          onClick={onToggleSound}
          className={`p-2 rounded-xl border active:scale-95 transition-all ${
            soundEnabled
              ? 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
              : 'bg-stone-100 border-stone-200 text-stone-400'
          }`}
          title={soundEnabled ? '靜音' : '開啟音效'}
          aria-label={soundEnabled ? '靜音' : '開啟音效'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Restart Button */}
        <button
          onClick={() => {
            if (window.confirm('確定要重新開始本局遊戲嗎？')) {
              soundManager.playClick();
              onRestart();
            }
          }}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-xs font-bold text-white flex items-center gap-1.5 shadow-xs transition-all"
          title="重開本局"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">重開</span>
        </button>
      </div>
    </header>
  );
};
