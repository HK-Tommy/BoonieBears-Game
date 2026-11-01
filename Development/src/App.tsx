import React, { useState, useEffect, useCallback } from 'react';
import { GameBoard } from './components/GameBoard';
import { GameHeader } from './components/GameHeader';
import { Sidebar } from './components/Sidebar';
import { GameOverModal } from './components/GameOverModal';
import { EvolutionGuideModal } from './components/EvolutionGuideModal';
import { getBestScore, saveBestScore } from './utils/storage';
import { soundManager } from './utils/audio';

export default function App() {
  const [gameKey, setGameKey] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(getBestScore());
  const [revivalCoins, setRevivalCoins] = useState<number>(0);
  const [lastRevivalScoreMilestone, setLastRevivalScoreMilestone] = useState<number>(0);
  const [maxTierAchieved, setMaxTierAchieved] = useState<number>(1);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundManager.getSoundEnabled());
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isEvolutionGuideOpen, setIsEvolutionGuideOpen] = useState<boolean>(false);

  // Restart game
  const handleRestart = useCallback(() => {
    setScore(0);
    setRevivalCoins(0);
    setLastRevivalScoreMilestone(0);
    setMaxTierAchieved(1);
    setIsGameOver(false);
    setGameKey((prev) => prev + 1);
  }, []);

  // Keyboard shortcut: 'R' to restart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && !isEvolutionGuideOpen) {
        if (!isGameOver) {
          if (window.confirm('確定要重新開始本局遊戲嗎？')) {
            soundManager.playClick();
            handleRestart();
          }
        } else {
          soundManager.playClick();
          handleRestart();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRestart, isGameOver, isEvolutionGuideOpen]);

  // Handle score update from GameBoard
  const handleScoreUpdate = useCallback(
    (delta: number, newMaxTier: number) => {
      setScore((prevScore) => {
        const nextScore = prevScore + delta;
        if (nextScore > bestScore) {
          setBestScore(nextScore);
          saveBestScore(nextScore);
        }

        // Check 2000 points milestone for revival coin
        const coinsEarned = Math.floor(nextScore / 2000);
        const prevCoinsEarned = Math.floor(lastRevivalScoreMilestone / 2000);
        if (coinsEarned > prevCoinsEarned) {
          const deltaCoins = coinsEarned - prevCoinsEarned;
          setRevivalCoins((rc) => rc + deltaCoins);
          setLastRevivalScoreMilestone(nextScore);
        }

        return nextScore;
      });

      if (newMaxTier > maxTierAchieved) {
        setMaxTierAchieved(newMaxTier);
      }
    },
    [bestScore, lastRevivalScoreMilestone, maxTierAchieved]
  );

  // When Tier 12 merge awards +1 revival coin
  const handleRevivalEarned = useCallback(() => {
    setRevivalCoins((prev) => prev + 1);
  }, []);

  // When player spends a revival coin
  const handleUseRevivalCoin = useCallback((): boolean => {
    if (revivalCoins > 0) {
      setRevivalCoins((prev) => prev - 1);
      return true;
    }
    return false;
  }, [revivalCoins]);

  // Handle Game Over
  const handleGameOver = useCallback((finalScore: number, finalMaxTier: number) => {
    soundManager.playGameOver();
    setIsGameOver(true);
  }, []);

  // Sound toggle
  const handleToggleSound = () => {
    const newState = soundManager.toggleSound();
    setSoundEnabled(newState);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f5f0] text-stone-800 antialiased overflow-x-hidden selection:bg-amber-200">
      {/* Responsive Top Header */}
      <GameHeader
        score={score}
        bestScore={bestScore}
        revivalCoins={revivalCoins}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenEvolutionGuide={() => setIsEvolutionGuideOpen(true)}
        onRestart={handleRestart}
      />

      {/* Main Play Area: Mobile, iPad & Desktop optimized */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-2 sm:px-4 py-1 sm:py-2 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 lg:gap-6">
        {/* Left / Center: Interactive Game Board */}
        <div className="w-full flex justify-center">
          <GameBoard
            key={gameKey}
            onScoreUpdate={handleScoreUpdate}
            onRevivalEarned={handleRevivalEarned}
            onGameOver={handleGameOver}
            revivalCoins={revivalCoins}
            onUseRevivalCoin={handleUseRevivalCoin}
            score={score}
          />
        </div>

        {/* Right / Sidebar: Status & Evolution */}
        <Sidebar
          score={score}
          bestScore={bestScore}
          maxTierAchieved={maxTierAchieved}
          onOpenEvolutionGuide={() => setIsEvolutionGuideOpen(true)}
        />
      </main>

      {/* Footer */}
      <footer className="w-full py-3 sm:py-4 text-center text-xs text-stone-500 border-t border-stone-200/80 mt-2 sm:mt-4 shrink-0">
        熊出沒 · 萌友大合成 © 2026 · Developed by{' '}
        <a
          href="https://hk-tommy.github.io/Profile/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-800 font-semibold hover:underline"
        >
          湯米Tommy
        </a>
      </footer>

      {/* Modals */}
      <EvolutionGuideModal
        isOpen={isEvolutionGuideOpen}
        onClose={() => setIsEvolutionGuideOpen(false)}
      />

      <GameOverModal
        isOpen={isGameOver}
        score={score}
        maxTier={maxTierAchieved}
        revivalCoins={revivalCoins}
        onRestart={handleRestart}
        onUseRevival={() => {
          if (handleUseRevivalCoin()) {
            setIsGameOver(false);
          }
        }}
      />
    </div>
  );
}
