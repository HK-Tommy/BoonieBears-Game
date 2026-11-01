import React from 'react';
import { Sparkles, Layers, HelpCircle, BookOpen, Lock } from 'lucide-react';
import { CHARACTER_TIERS } from '../data/characters';
import { soundManager } from '../utils/audio';

interface SidebarProps {
  score: number;
  bestScore: number;
  maxTierAchieved: number;
  onOpenEvolutionGuide: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  score,
  bestScore,
  maxTierAchieved,
  onOpenEvolutionGuide,
}) => {
  return (
    <aside className="w-full lg:w-80 flex flex-col gap-3.5">
      {/* Score Panel (prominent on desktop, complementary on tablet) */}
      <div className="hidden lg:grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border-2 border-amber-200/80 shadow-xs text-center">
          <div className="text-xs font-bold text-amber-800 tracking-wide mb-0.5">目前得分</div>
          <div className="text-3xl font-black font-mono text-amber-600 truncate">
            {score.toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border-2 border-amber-200/80 shadow-xs text-center">
          <div className="text-xs font-bold text-stone-500 tracking-wide mb-0.5">最高得分</div>
          <div className="text-3xl font-black font-mono text-stone-700 truncate">
            {bestScore.toLocaleString()}
          </div>
        </div>
      </div>



      {/* Evolution Chain Overview with Unlock States */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-amber-200 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-600" />
            角色合成鏈與掉落池
          </span>
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenEvolutionGuide();
            }}
            className="text-[11px] text-amber-600 hover:text-amber-700 font-bold underline flex items-center gap-0.5"
          >
            <span>完整圖鑑</span>
          </button>
        </div>

        {/* Horizontal Mini Badges with Unlocked/Locked States */}
        <div
          onClick={onOpenEvolutionGuide}
          className="cursor-pointer bg-stone-50 rounded-xl p-2 sm:p-2.5 border border-stone-200 hover:border-amber-300 transition-colors"
          title="點擊查看完整圖鑑"
        >
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
            {CHARACTER_TIERS.map((char, idx) => {
              const isUnlocked = char.tier <= maxTierAchieved;

              return (
                <React.Fragment key={char.tier}>
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full shrink-0 flex items-center justify-center text-sm shadow-2xs border relative transition-all ${
                      isUnlocked
                        ? 'border-amber-400 ring-2 ring-amber-300/60 bg-amber-50 scale-105'
                        : 'border-stone-200 opacity-40 grayscale bg-stone-100'
                    }`}
                    title={`第${char.tier}階: ${char.name} (${isUnlocked ? '已解鎖可掉落' : '尚未解鎖'})`}
                  >
                    <img
                      src={char.image}
                      alt={char.name}
                      className="w-full h-full object-contain p-0.5"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span className="absolute text-xs pointer-events-none hidden">
                      {char.emoji}
                    </span>
                    {!isUnlocked && (
                      <div className="absolute inset-0 bg-stone-900/30 rounded-full flex items-center justify-center">
                        <Lock className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  {idx < CHARACTER_TIERS.length - 1 && (
                    <span className="text-[9px] text-stone-400 shrink-0">›</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Special Rules */}
        <div className="mt-2.5 space-y-1 text-[11px] text-amber-900 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
          <div className="flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>兩個第12階合體碰撞會一起炸掉，換 <strong>500 分</strong> + <strong>1 枚復活幣</strong></span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-amber-600 shrink-0">🪙</span>
            <span>每 <strong>2000 分</strong> 攢一枚復活幣，關鍵時刻一鍵清除頂部障礙</span>
          </div>
        </div>
      </div>

      {/* Evolution Guide Direct Button */}
      <button
        onClick={() => {
          soundManager.playClick();
          onOpenEvolutionGuide();
        }}
        className="w-full py-2.5 sm:py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-transform"
      >
        <BookOpen className="w-4 h-4 text-amber-100" />
        <span>查看角色合成詳細圖鑑</span>
      </button>

      {/* Controls guide */}
      <div className="hidden sm:block bg-stone-100/80 rounded-2xl p-3 border border-stone-200 text-[11px] text-stone-600 space-y-1">
        <div className="font-bold text-stone-800 flex items-center gap-1 mb-0.5">
          <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
          操作支援
        </div>
        <div><strong>手機 / iPad:</strong> 拖動手指瞄準位置，鬆手即可投放</div>
        <div><strong>電腦:</strong> 滑鼠移動瞄準，點擊或空格鍵投放，R 鍵重開</div>
      </div>
    </aside>
  );
};
