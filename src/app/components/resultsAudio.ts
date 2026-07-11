import winnerGameSound from './winner-game.mp3';
import gameOverSound from './game-over.mp3';

type Outcome = 'win' | 'lose';

const outcomeAudio: Record<Outcome, HTMLAudioElement | null> = {
  win: null,
  lose: null,
};

function getOutcomeAudio(outcome: Outcome): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;

  if (!outcomeAudio[outcome]) {
    const audio = new Audio(outcome === 'win' ? winnerGameSound : gameOverSound);
    audio.preload = 'auto';
    outcomeAudio[outcome] = audio;
  }

  return outcomeAudio[outcome];
}

export function preloadResultsOutcomeSounds() {
  getOutcomeAudio('win')?.load();
  getOutcomeAudio('lose')?.load();
}

export function playResultsOutcomeSound(won: boolean) {
  const outcome: Outcome = won ? 'win' : 'lose';
  const otherOutcome: Outcome = won ? 'lose' : 'win';
  const otherAudio = outcomeAudio[otherOutcome];
  const audio = getOutcomeAudio(outcome);

  if (otherAudio) {
    otherAudio.pause();
    otherAudio.currentTime = 0;
  }

  if (!audio) return;

  audio.pause();
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
