import React from 'react';
import { Sparkles, Dices, Layers, HelpCircle, BookOpen } from 'lucide-react';
import { CHARACTER_TIERS } from '../data/characters';
import { soundManager } from '../utils/audio';

interface SidebarProps {
  score: number;
  bestScore: number;
  onOpenEvolutionGuide: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  score,
  bestScore,
  onOpenEvolutionGuide,
}) => {
  return (
    <aside className="w-full lg:w-80 flex flex-col gap-4">
      {/* Score Panel */}
      <div className="grid grid-cols-2 gap-3">
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

      {/* Game Mode Info Card */}
      <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
            <Dices className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-amber-950">
            1至12階 全角色隨機掉落
          </span>
        </div>
        <p className="text-[11px] text-stone-600 leading-relaxed">
          每局由 1 至 12 階角色完全隨機掉落！無論是小松鼠還是大合體皆可能降臨，考驗您的臨場應變與堆疊策略！
        </p>
      </div>

      {/* Evolution Chain Overview */}
      <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-600" />
            角色合成進化鏈 (1 ➜ 12)
          </span>
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenEvolutionGuide();
            }}
            className="text-[11px] text-amber-600 hover:text-amber-700 font-bold underline flex items-center gap-0.5"
          >
            <span>圖鑑</span>
          </button>
        </div>

        {/* Horizontal Mini Badges */}
        <div
          onClick={onOpenEvolutionGuide}
          className="cursor-pointer bg-stone-50 rounded-xl p-2.5 border border-stone-200 hover:border-amber-300 transition-colors"
          title="點擊查看完整圖鑑"
        >
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
            {CHARACTER_TIERS.map((char, idx) => (
              <React.Fragment key={char.tier}>
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm shadow-2xs border border-amber-200 relative overflow-hidden"
                  style={{ backgroundColor: char.color }}
                  title={`第${char.tier}階: ${char.name}`}
                >
                  {char.tier !== 6 ? (
                    <img
                      src={char.image}
                      alt={char.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span className="absolute text-xs pointer-events-none">
                    {char.emoji}
                  </span>
                </div>
                {idx < CHARACTER_TIERS.length - 1 && (
                  <span className="text-[9px] text-stone-400 shrink-0">›</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Special Rules */}
        <div className="mt-3 space-y-1.5 text-[11px] text-amber-900 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
          <div className="flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>兩個神級大合體碰撞會一起炸掉，換 <strong>500 分</strong> + <strong>一枚復活幣</strong></span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-amber-600 shrink-0">🪙</span>
            <span>每 <strong>2000 分</strong> 攢一枚復活幣，只在本局有效</span>
          </div>
        </div>
      </div>

      {/* Evolution Guide Direct Button */}
      <button
        onClick={() => {
          soundManager.playClick();
          onOpenEvolutionGuide();
        }}
        className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-98 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-transform"
      >
        <BookOpen className="w-4 h-4 text-amber-100" />
        <span>查看角色合成圖鑑</span>
      </button>

      {/* Controls guide */}
      <div className="bg-stone-100/80 rounded-2xl p-3.5 border border-stone-200 text-[11px] text-stone-600 space-y-1">
        <div className="font-bold text-stone-800 flex items-center gap-1 mb-1">
          <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
          操作指南
        </div>
        <div><strong>鼠標:</strong> 移動瞄準、點擊投放</div>
        <div><strong>觸屏:</strong> 拖動瞄準、鬆手投放</div>
        <div><strong>鍵盤:</strong> ← → 微調位置，空格鍵投放，R 鍵重開</div>
      </div>
    </aside>
  );
};
