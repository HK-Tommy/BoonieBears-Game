import React from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { CHARACTER_TIERS } from '../data/characters';
import { soundManager } from '../utils/audio';

interface EvolutionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EvolutionGuideModal: React.FC<EvolutionGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#faf8f5] rounded-3xl shadow-2xl border-4 border-amber-300 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-200" />
            <div>
              <h2 className="text-xl font-bold">角色合成進化圖鑑</h2>
              <p className="text-xs text-amber-100">兩兩相同碰撞合成下一階角色</p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-white/20 active:scale-95 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CHARACTER_TIERS.map((char) => (
              <div
                key={char.tier}
                className="bg-white rounded-2xl p-3 border border-amber-200/80 shadow-2xs flex items-center gap-3 hover:border-amber-400 transition-colors"
              >
                <div
                  className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-xl shadow-xs border-2 border-white relative overflow-hidden"
                  style={{ backgroundColor: char.color }}
                >
                  {char.tier !== 6 ? (
                    <img
                      src={char.image}
                      alt={char.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to emoji if needed
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span className="absolute text-xl pointer-events-none drop-shadow-xs">
                    {char.emoji}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-amber-600 font-mono">
                      階級 {char.tier}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-stone-800 truncate">
                    {char.name}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate">
                    合成得分: +{char.score}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Special Rules Card */}
          <div className="mt-4 bg-amber-100/70 rounded-2xl p-4 border border-amber-300 text-xs text-amber-950 space-y-2">
            <div className="font-bold text-amber-900 flex items-center gap-1.5">
              <span>✨</span>
              <span>終極合體特例規則:</span>
            </div>
            <p className="text-amber-900 leading-relaxed">
              當兩個第 12 階「神級大合體」碰撞時，將會引發超大範圍歡慶爆炸！
              直接獎勵 <span className="font-bold text-amber-700 font-mono">+500 分</span> 與 <span className="font-bold text-emerald-700">1 枚復活幣</span>！
            </p>
            <div className="font-bold text-amber-900 pt-1 flex items-center gap-1.5">
              <span>🪙</span>
              <span>復活幣累積規則:</span>
            </div>
            <p className="text-amber-900 leading-relaxed">
              本局遊戲中，每獲得 <span className="font-bold text-amber-700 font-mono">2000 分</span> 就會自動攢得一枚復活幣。
              當角色觸及頂部危險線即將遊戲結束時，可使用復活幣瞬間清除頂部障礙重振旗鼓！
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-stone-50 px-6 py-3 border-t border-stone-200 text-right">
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs transition-transform shadow-xs"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
};
