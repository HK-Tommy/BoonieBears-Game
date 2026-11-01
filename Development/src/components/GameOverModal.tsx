import React from 'react';
import { RotateCcw } from 'lucide-react';
import { CHARACTER_TIERS } from '../data/characters';
import { getBestScore } from '../utils/storage';
import { soundManager } from '../utils/audio';

interface GameOverModalProps {
  isOpen: boolean;
  score: number;
  maxTier: number;
  revivalCoins: number;
  onRestart: () => void;
  onUseRevival?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  score,
  maxTier,
  revivalCoins,
  onRestart,
  onUseRevival,
}) => {
  if (!isOpen) return null;

  const bestScore = getBestScore();
  const isNewRecord = score > bestScore;
  const maxTierConfig = CHARACTER_TIERS[maxTier - 1] || CHARACTER_TIERS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-sm bg-[#faf8f5] rounded-3xl shadow-2xl border-4 border-amber-300 overflow-hidden p-6 text-center">
        {/* Banner */}
        <div className="mb-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-3xl mb-2 shadow-inner border border-amber-200">
            {isNewRecord ? '🏆' : '🌲'}
          </div>
          <h2 className="text-2xl font-black text-amber-950">
            {isNewRecord ? '🎉 創下全新紀錄！' : '遊戲結束'}
          </h2>
          <p className="text-xs text-amber-800 mt-0.5">
            熊出沒森林冒險暫告一段落
          </p>
        </div>

        {/* Score & Tier Card */}
        <div className="bg-amber-100/60 rounded-2xl p-4 border border-amber-200 mb-4">
          <div className="text-xs font-semibold text-amber-800">最終得分</div>
          <div className="text-4xl font-black font-mono text-amber-600 my-1">
            {score.toLocaleString()}
          </div>

          <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-amber-200/60 text-xs text-amber-900">
            <span>最高合成:</span>
            <span className="font-bold flex items-center gap-1">
              <span>{maxTierConfig.emoji}</span>
              <span>{maxTierConfig.name} (第{maxTier}階)</span>
            </span>
          </div>

          <div className="text-[11px] text-stone-500 mt-1">
            歷史最高: {Math.max(score, bestScore).toLocaleString()} 分
          </div>
        </div>

        {/* Revival Coin prompt if player has any */}
        {revivalCoins > 0 && onUseRevival && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 mb-4 text-xs flex items-center justify-between">
            <div className="text-left">
              <span className="font-bold text-emerald-900 block">尚存 {revivalCoins} 枚復活幣</span>
              <span className="text-emerald-700 text-[11px]">可立即清除頂部角色繼續本局</span>
            </div>
            <button
              onClick={() => {
                onUseRevival();
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-xs"
            >
              立刻復活
            </button>
          </div>
        )}

        {/* Action Button */}
        <div>
          <button
            onClick={() => {
              soundManager.playClick();
              onRestart();
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-transform"
          >
            <RotateCcw className="w-4 h-4" />
            再來一局
          </button>
        </div>
      </div>
    </div>
  );
};
