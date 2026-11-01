/**
 * Game Types and Configurations for Suika Merge Game
 */

export interface CharacterTier {
  tier: number; // 1 to 12
  name: string;
  title: string;
  image: string;
  radius: number; // in pixels
  score: number;
  color: string;
  emoji: string;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
  scale: number;
  velocityY: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  rotation: number;
  rotationSpeed: number;
}

export interface GameStats {
  score: number;
  bestScore: number;
  revivalCoins: number;
  maxTierAchieved: number;
  combos: number;
  maxCombo: number;
  mergesCount: number;
}
