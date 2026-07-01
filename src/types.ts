/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GameState {
  START = "START",
  PLAYING = "PLAYING",
  CLEAR = "CLEAR",
  GAMEOVER = "GAMEOVER"
}

export enum DifficultyLevel {
  EASY = 1,
  NORMAL = 2,
  HARD = 3
}

export interface Card {
  id: number;
  pairId: number;
  emoji: string;
  name: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export interface BestRecord {
  bestTime: number | null; // 秒
  bestTaps: number | null; // タップ回数
}

export interface SaveData {
  records: Record<DifficultyLevel, BestRecord>;
  lastPlayedDate: string | null;
}
