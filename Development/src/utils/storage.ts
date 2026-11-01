const BEST_SCORE_KEY = 'suika_best_score_v1';

export function getBestScore(): number {
  try {
    const val = localStorage.getItem(BEST_SCORE_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score: number) {
  try {
    localStorage.setItem(BEST_SCORE_KEY, score.toString());
  } catch {
    // Ignore error
  }
}
