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
    <header className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 shrink-0">
      {/* Brand & Title */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md flex items-center justify-center text-xl sm:text-2xl border-2 border-amber-200 shrink-0">
          🐻
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-black tracking-tight text-amber-950 truncate">
            熊出沒 · 萌友大合成
          </h1>
          <p className="hidden sm:block text-[11px] text-amber-800 font-medium truncate">
            順次解鎖掉落 · 相同萌友撞擊合體！
          </p>
        </div>
      </div>

      {/* Middle: Quick Mobile / Tablet Score Indicator */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-xl border border-amber-200 shadow-2xs text-center">
          <span className="text-[10px] text-stone-500 block leading-tight">得分</span>
          <span className="text-sm sm:text-base font-black font-mono text-amber-600 leading-tight">
            {score.toLocaleString()}
          </span>
        </div>

        <div className="hidden xs:block bg-stone-100/90 px-2.5 py-1 rounded-xl border border-stone-200 text-center">
          <span className="text-[10px] text-stone-400 block leading-tight">最高</span>
          <span className="text-xs sm:text-sm font-bold font-mono text-stone-700 leading-tight">
            {bestScore.toLocaleString()}
          </span>
        </div>

        {/* Revival Coin Badge */}
        <div
          title="每2000分獲得一枚復活幣，可用於危急時清除頂部障礙"
          className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-amber-100 border border-amber-300 text-xs font-bold text-amber-900 shadow-2xs"
        >
          <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="font-mono text-emerald-700 font-black">{revivalCoins}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Evolution Guide Button */}
        <button
          onClick={() => {
            soundManager.playClick();
            onOpenEvolutionGuide();
          }}
          className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 active:scale-95 border border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-1 shadow-2xs transition-all"
          title="合成圖鑑"
          aria-label="合成圖鑑"
        >
          <BookOpen className="w-4 h-4 text-amber-600" />
          <span className="hidden sm:inline">圖鑑</span>
        </button>

        {/* Sound Toggle */}
        <button
          onClick={onToggleSound}
          className={`min-h-[38px] min-w-[38px] p-2 rounded-xl border active:scale-95 flex items-center justify-center transition-all ${
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
          className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-xs font-bold text-white flex items-center gap-1 shadow-xs transition-all"
          title="重開本局"
          aria-label="重開本局"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">重開</span>
        </button>
      </div>
    </header>
  );
};
