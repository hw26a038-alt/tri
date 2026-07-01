/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { GameState, DifficultyLevel, Card, SaveData, BestRecord } from "./types";
import { Volume2, VolumeX, RotateCcw, Award, ShieldAlert, Clock, RefreshCw, Undo2 } from "lucide-react";

// 和風の絵柄セット（仕様書に基づく：桜、富士山、扇子、折鶴、和傘、こま/提灯）
const WA_ITEMS = [
  { emoji: "🌸", name: "桜 (さくら)" },
  { emoji: "🗻", name: "富士山 (ふじさん)" },
  { emoji: "🪭", name: "扇子 (せんす)" },
  { emoji: "🏮", name: "提灯 (ちょうちん)" },
  { emoji: "☂️", name: "和傘 (わがさ)" },
  { emoji: "🪁", name: "和玩具 (おもちゃ)" },
];

const INITIAL_SAVE_DATA: SaveData = {
  records: {
    [DifficultyLevel.EASY]: { bestTime: null, bestTaps: null },
    [DifficultyLevel.NORMAL]: { bestTime: null, bestTaps: null },
    [DifficultyLevel.HARD]: { bestTime: null, bestTaps: null },
  },
  lastPlayedDate: null,
};

export default function App() {
  // ゲーム状態
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [level, setLevel] = useState<DifficultyLevel>(DifficultyLevel.EASY);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // ゲーム内ステータス
  const [timeLeft, setTimeLeft] = useState<number>(45);
  const [missCount, setMissCount] = useState<number>(0);
  const [totalTaps, setTotalTaps] = useState<number>(0);

  // タイマーとローカル保存
  const [saveData, setSaveData] = useState<SaveData>(INITIAL_SAVE_DATA);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 音声オブジェクトのプリロード
  const audioClick = useRef<HTMLAudioElement | null>(null);
  const audioPowerUp = useRef<HTMLAudioElement | null>(null);
  const audioSynth = useRef<HTMLAudioElement | null>(null);

  // 音声ファイルの初期化
  useEffect(() => {
    audioClick.current = new Audio("/public/click.wav");
    audioPowerUp.current = new Audio("/public/powerUp.wav");
    audioSynth.current = new Audio("/public/synth.wav");

    // 音声読み込み失敗時などにクラッシュしないようにガード
    const setupAudio = (audio: HTMLAudioElement | null) => {
      if (audio) {
        audio.preload = "auto";
      }
    };
    setupAudio(audioClick.current);
    setupAudio(audioPowerUp.current);
    setupAudio(audioSynth.current);

    // ローカルデータのロード
    const saved = localStorage.getItem("nou_tre_records");
    if (saved) {
      try {
        setSaveData(JSON.parse(saved));
      } catch (e) {
        console.error("データのロードに失敗しました:", e);
      }
    }
  }, []);

  // レベル設定値 of 取得
  const getLevelConfig = (lvl: DifficultyLevel) => {
    switch (lvl) {
      case DifficultyLevel.EASY:
        return { pairs: 2, time: 45, grid: "grid-cols-2" };
      case DifficultyLevel.NORMAL:
        return { pairs: 4, time: 35, grid: "grid-cols-4" };
      case DifficultyLevel.HARD:
        return { pairs: 6, time: 25, grid: "grid-cols-4" };
    }
  };

  // 効果音の再生
  const playSound = (type: "click" | "match" | "miss" | "win" | "fail") => {
    if (!soundEnabled) return;

    try {
      if (type === "click" && audioClick.current) {
        audioClick.current.currentTime = 0;
        audioClick.current.play().catch(() => playSynthesizedSound("click"));
      } else if (type === "match" && audioPowerUp.current) {
        audioPowerUp.current.currentTime = 0;
        audioPowerUp.current.play().catch(() => playSynthesizedSound("match"));
      } else if (type === "miss" && audioSynth.current) {
        audioSynth.current.currentTime = 0;
        audioSynth.current.play().catch(() => playSynthesizedSound("miss"));
      } else {
        // win, fail または読み込みエラー時はシンセサイザーで和風音を鳴らす
        playSynthesizedSound(type);
      }
    } catch (e) {
      playSynthesizedSound(type);
    }
  };

  // Web Audio APIによる和楽器風（琴や太鼓）のシンセサイザー補完音
  const playSynthesizedSound = (type: string) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      if (type === "click") {
        // 「ぽん」と鳴る小鼓風の音
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
      } else if (type === "match") {
        // 「シャラーン」と鳴る琴の和音風
        const now = ctx.currentTime;
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // ド・ミ・ソ・ド (C和音)
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, now + i * 0.05);
          gain.gain.setValueAtTime(0.15, now + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.35);
        });
      } else if (type === "miss") {
        // 「ぼーん」という低い和太鼓・鐘のような音
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        // 低周波フィルターでこもらせる
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(300, ctx.currentTime);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === "win") {
        // 華やかでめでたい雅楽調の琴の早いアルペジオ
        const now = ctx.currentTime;
        const scale = [440.00, 493.88, 554.37, 659.25, 739.99, 880.00]; // 和風ペンタトニック(Aメジャー)
        scale.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, now + i * 0.08);
          gain.gain.setValueAtTime(0.12, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.6);
        });
      } else if (type === "fail") {
        // 寂しげな琴の音が下がる（ヒョロ〜ン）
        const now = ctx.currentTime;
        const notes = [392.00, 349.23, 293.66, 261.63];
        notes.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, now + i * 0.15);
          osc.frequency.linearRampToValueAtTime(f - 30, now + i * 0.15 + 0.25);
          gain.gain.setValueAtTime(0.15, now + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.15);
          osc.stop(now + i * 0.15 + 0.3);
        });
      }
    } catch (err) {
      console.warn("シンセサイザー音源再生エラー:", err);
    }
  };

  // タイマー処理
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleGameOver();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // ゲームの初期化・開始
  const startGame = (selectedLevel: DifficultyLevel) => {
    setLevel(selectedLevel);
    const config = getLevelConfig(selectedLevel);

    // カードの準備
    const activeItems = WA_ITEMS.slice(0, config.pairs);
    const pairCards: Card[] = [];
    
    activeItems.forEach((item, index) => {
      // 1ペアにつき2枚
      pairCards.push({
        id: index * 2,
        pairId: index,
        emoji: item.emoji,
        name: item.name,
        isFlipped: false,
        isMatched: false,
      });
      pairCards.push({
        id: index * 2 + 1,
        pairId: index,
        emoji: item.emoji,
        name: item.name,
        isFlipped: false,
        isMatched: false,
      });
    });

    // シャッフル（和風ランダム並び替え）
    const shuffled = pairCards.sort(() => Math.random() - 0.5);

    setCards(shuffled);
    setSelectedIndices([]);
    setIsLocked(false);
    setTimeLeft(config.time);
    setMissCount(0);
    setTotalTaps(0);
    setGameState(GameState.PLAYING);
    playSound("click");
  };

  // カードめくり処理
  const handleCardClick = (index: number) => {
    if (isLocked) return;
    const clickedCard = cards[index];
    if (clickedCard.isFlipped || clickedCard.isMatched) return;

    playSound("click");
    setTotalTaps((prev) => prev + 1);

    // 選択状態の更新
    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const nextSelected = [...selectedIndices, index];
    setSelectedIndices(nextSelected);

    if (nextSelected.length === 2) {
      setIsLocked(true);
      const [firstIdx, secondIdx] = nextSelected;
      const firstCard = cards[firstIdx];
      const secondCard = cards[secondIdx];

      if (firstCard.pairId === secondCard.pairId) {
        // 一致
        setTimeout(() => {
          const matchedCards = [...newCards];
          matchedCards[firstIdx].isMatched = true;
          matchedCards[secondIdx].isMatched = true;
          setCards(matchedCards);
          setSelectedIndices([]);
          setIsLocked(false);
          playSound("match");

          // クリア判定
          if (matchedCards.every((c) => c.isMatched)) {
            handleGameClear();
          }
        }, 500);
      } else {
        // 不一致
        const newMissCount = missCount + 1;
        setMissCount(newMissCount);

        setTimeout(() => {
          const resetCards = [...newCards];
          resetCards[firstIdx].isFlipped = false;
          resetCards[secondIdx].isFlipped = false;
          setCards(resetCards);
          setSelectedIndices([]);
          setIsLocked(false);
          playSound("miss");
        }, 1200); // 仕様書「少しの間（1〜2秒）表示して裏返る」に従い、約1.2秒に設定
      }
    }
  };

  // クリア処理
  const handleGameClear = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState(GameState.CLEAR);
    playSound("win");

    // レコード更新
    const config = getLevelConfig(level);
    const timeUsed = config.time - timeLeft;
    const today = new Date().toLocaleDateString("ja-JP");

    const currentRecord = saveData.records[level];
    const updatedRecord: BestRecord = {
      bestTime:
        currentRecord.bestTime === null
          ? timeUsed
          : Math.min(currentRecord.bestTime, timeUsed),
      bestTaps:
        currentRecord.bestTaps === null
          ? totalTaps + 1 // 最後のタップ分を含める
          : Math.min(currentRecord.bestTaps, totalTaps + 1),
    };

    const newSaveData: SaveData = {
      records: {
        ...saveData.records,
        [level]: updatedRecord,
      },
      lastPlayedDate: today,
    };

    setSaveData(newSaveData);
    localStorage.setItem("nou_tre_records", JSON.stringify(newSaveData));
  };

  // ゲームオーバー処理
  const handleGameOver = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState(GameState.GAMEOVER);
    playSound("fail");
  };

  // 記録リセット処理
  const resetAllRecords = () => {
    if (confirm("これまでのすべての最高記録を削除します。よろしいですか？")) {
      setSaveData(INITIAL_SAVE_DATA);
      localStorage.removeItem("nou_tre_records");
      playSound("miss");
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-[#F7F4EB] text-[#333333] font-sans flex flex-col items-center justify-between py-2 px-3 sm:p-4 selection:bg-[#E3D9C6] selection:text-[#5C1E1E] overflow-hidden">
      
      {/* 共通ヘッダー */}
      <header className="w-full max-w-lg flex items-center justify-end border-b border-[#D4C3A3] pb-1.5 mb-2">
        <div className="flex items-center gap-2">
          {/* 消音切り替え */}
          <button
            id="toggle-sound-btn"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              // 小さなフィードバック
              if (!soundEnabled) {
                setTimeout(() => playSynthesizedSound("click"), 50);
              }
            }}
            className="p-1.5 rounded-full hover:bg-[#EAE2D1] text-[#7A6B58] transition-colors"
            title={soundEnabled ? "音声を消す" : "音声を出す"}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </header>

      {/* メインステージ */}
      <main className="w-full max-w-md flex-1 flex flex-col justify-center items-center py-1 overflow-hidden">
        
        {/* START 画面 */}
        {gameState === GameState.START && (
          <div className="w-full bg-white border-2 border-[#D4C3A3] rounded-2xl shadow-sm p-4 sm:p-5 relative overflow-hidden flex flex-col items-center max-h-full overflow-y-auto">
            {/* 背景の薄い和風デザイン丸飾り */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#FDF9F2] rounded-full border border-[#E3D9C6] -z-10 flex items-center justify-center">
              <span className="text-4xl opacity-10">🌸</span>
            </div>

            <div className="text-center mb-4">
              <span className="inline-block bg-[#FDF1EE] text-[#A63F3F] text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-[#F5D5D5] mb-1">
                認知症予防・脳トレゲーム
              </span>
              <h2 className="text-xl font-bold text-[#3E2D1A] font-serif tracking-wide">
                雅の絵合わせ
              </h2>
              <p className="text-xs text-[#7A6B58] mt-1 leading-relaxed">
                裏返されたカードをめくって、和の絵柄のペアを揃えましょう。
                レベルが上がると制限時間が短くなります！
              </p>
            </div>

            {/* レベル選択セクション */}
            <div className="w-full space-y-2 mb-3">
              <h3 className="text-xs font-bold text-[#7A6B58] tracking-widest text-center uppercase mb-1">
                難易度を選択してください
              </h3>
              
              <button
                id="btn-level-easy"
                onClick={() => startGame(DifficultyLevel.EASY)}
                className="w-full bg-[#F3FAF0] hover:bg-[#E2F0DD] active:bg-[#D4E9CD] border-2 border-[#C6E2BD] hover:border-[#A6CD99] text-[#2A5C1E] py-2 px-3 rounded-xl transition-all duration-200 flex flex-col items-center justify-center"
              >
                <span className="text-base font-bold font-serif">レベル１：かんたん</span>
                <span className="text-[11px] mt-0.5 text-[#467E39]">
                  カード: 4枚 (2ペア) | 時間: 45秒
                </span>
              </button>

              <button
                id="btn-level-normal"
                onClick={() => startGame(DifficultyLevel.NORMAL)}
                className="w-full bg-[#FFFDF2] hover:bg-[#FFF9D6] active:bg-[#FFF4B8] border-2 border-[#EBE0AF] hover:border-[#D9C682] text-[#695B12] py-2 px-3 rounded-xl transition-all duration-200 flex flex-col items-center justify-center"
              >
                <span className="text-base font-bold font-serif">レベル２：ふつう</span>
                <span className="text-[11px] mt-0.5 text-[#8C7B25]">
                  カード: 8枚 (4ペア) | 時間: 35秒
                </span>
              </button>

              <button
                id="btn-level-hard"
                onClick={() => startGame(DifficultyLevel.HARD)}
                className="w-full bg-[#FDF5F5] hover:bg-[#FBE8E8] active:bg-[#F8D6D6] border-2 border-[#E9C2C2] hover:border-[#D69F9F] text-[#8C2D2D] py-2 px-3 rounded-xl transition-all duration-200 flex flex-col items-center justify-center"
              >
                <span className="text-base font-bold font-serif">レベル３：むずかしい</span>
                <span className="text-[11px] mt-0.5 text-[#A84A4A]">
                  カード: 12枚 (6ペア) | 時間: 25秒
                </span>
              </button>
            </div>

            {/* 最高記録表示 */}
            <div className="w-full border-t border-[#EAE2D1] pt-2 mt-1">
              <h4 className="text-xs font-bold text-[#7A6B58] tracking-widest text-center uppercase mb-2 flex items-center justify-center gap-1">
                <Award size={13} className="text-[#B59441]" />
                あなたの最高記録
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {[DifficultyLevel.EASY, DifficultyLevel.NORMAL, DifficultyLevel.HARD].map((lvl) => {
                  const rec = saveData.records[lvl];
                  const label = lvl === 1 ? "レベル1" : lvl === 2 ? "レベル2" : "レベル3";
                  const color = lvl === 1 ? "bg-[#F3FAF0]" : lvl === 2 ? "bg-[#FFFDF2]" : "bg-[#FDF5F5]";
                  return (
                    <div key={lvl} className={`p-1.5 rounded-lg text-center ${color} border border-black/5`}>
                      <span className="text-[10px] font-bold block text-gray-500">{label}</span>
                      {rec.bestTime !== null ? (
                        <div className="mt-0.5">
                          <span className="text-xs font-bold block text-gray-800">{rec.bestTime}秒</span>
                          <span className="text-[9px] block text-gray-500">{rec.bestTaps}タップ</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-gray-400 block mt-0.5">記録なし</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {saveData.lastPlayedDate && (
                <p className="text-[9px] text-[#9E8E79] text-center mt-1.5">
                  最終プレイ日: {saveData.lastPlayedDate}
                </p>
              )}

              {/* 記録消去ボタン */}
              <div className="flex justify-center mt-2">
                <button
                  id="btn-reset-records"
                  onClick={resetAllRecords}
                  className="text-[10px] text-[#9C3A3A] hover:text-[#7D2E2E] hover:underline flex items-center gap-1 px-2.5 py-0.5 bg-[#FFF0F0] rounded border border-[#F4CCCC]"
                >
                  <RotateCcw size={10} />
                  これまでの記録を消去
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PLAYING 画面 */}
        {gameState === GameState.PLAYING && (
          <div className="w-full flex flex-col items-center max-h-full overflow-y-auto px-1">
            {/* 上部ステータスパネル */}
            <div className="w-full bg-[#FDFBF7] border-2 border-[#D4C3A3] rounded-xl p-2 mb-2.5 grid grid-cols-3 text-center shadow-sm">
              <div>
                <span className="text-[9px] text-[#7A6B58] block">現在のレベル</span>
                <span className={`text-xs font-bold inline-block px-1.5 py-0.5 rounded ${
                  level === 1 ? "bg-[#E2F0DD] text-[#2A5C1E]" : level === 2 ? "bg-[#FFF9D6] text-[#695B12]" : "bg-[#FBE8E8] text-[#8C2D2D]"
                }`}>
                  レベル {level}
                </span>
              </div>
              <div className="border-x border-[#EAE2D1]">
                <span className="text-[9px] text-[#7A6B58] block flex items-center justify-center gap-0.5">
                  <Clock size={9} className="inline" /> 制限時間
                </span>
                <span className={`text-sm font-bold font-mono ${timeLeft <= 10 ? "text-[#C0392B] animate-pulse" : "text-[#3E2D1A]"}`}>
                  {timeLeft}秒
                </span>
              </div>
              <div>
                <span className="text-[9px] text-[#7A6B58] block flex items-center justify-center gap-0.5">
                  <ShieldAlert size={9} className="inline" /> お手つき回数
                </span>
                <span className="text-sm font-bold text-[#3E2D1A]">
                  <span className={`${missCount > 0 ? "text-[#C0392B]" : ""}`}>{missCount}</span>
                  <span className="text-xs text-gray-400 font-normal"> 回</span>
                </span>
              </div>
            </div>

            {/* カードグリッドステージ */}
            <div className={`w-full grid gap-2 max-w-[320px] justify-center items-center ${getLevelConfig(level).grid} p-1`}>
              {cards.map((card, idx) => {
                const isSelected = selectedIndices.includes(idx);
                const showFront = card.isFlipped || card.isMatched || isSelected;

                return (
                  <button
                    key={card.id}
                    id={`card-item-${idx}`}
                    onClick={() => handleCardClick(idx)}
                    disabled={card.isMatched || isLocked}
                    className={`
                      w-[68px] h-[84px] xs:w-[74px] xs:h-[90px] sm:w-20 sm:h-24 rounded-lg flex items-center justify-center text-2xl xs:text-3xl select-none
                      transition-all duration-300 transform border-2 relative outline-none focus:ring-2 focus:ring-[#5C1E1E]
                      ${
                        showFront
                           ? "bg-white border-[#D4C3A3] scale-100 shadow-sm"
                           : "bg-[#2C3E50] border-[#34495E] hover:bg-[#34495E] cursor-pointer hover:shadow-md"
                      }
                      ${card.isMatched ? "opacity-30" : ""}
                    `}
                    style={{
                      // 裏面の和柄をCSSで表現（藍色地に市松・ドット柄グラデーション風）
                      background: showFront
                        ? "white"
                        : "linear-gradient(45deg, #1F2D3D 25%, #2C3E50 25%, #2C3E50 50%, #1F2D3D 50%, #1F2D3D 75%, #2C3E50 75%, #2C3E50 100%)",
                      backgroundSize: showFront ? "auto" : "14px 14px",
                    }}
                  >
                    {/* カード裏面時の和風ワンポイントデザイン（藍色と金の調和） */}
                    {!showFront && (
                      <div className="absolute w-3.5 h-3.5 rounded-full bg-[#E6C280] opacity-40 border border-[#D4A359]"></div>
                    )}

                    {/* カード表面時の絵柄 */}
                    {showFront && (
                      <div className="flex flex-col items-center">
                        <span className="scale-105 select-none">{card.emoji}</span>
                        {/* 視認性向上のため、高齢者向けに簡単な読み仮名（ひらがな）を添える */}
                        <span className="text-[8px] text-[#7A6B58] mt-0.5 font-sans tracking-tighter select-none">
                          {card.name.split(" ")[0]}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ゲーム中のリセット/戻るボタン */}
            <div className="mt-4 flex gap-4 w-full justify-center">
              <button
                id="btn-abandon-game"
                onClick={() => {
                  if (confirm("現在のゲームを終了して、ホーム画面に戻りますか？")) {
                    setGameState(GameState.START);
                    playSound("click");
                  }
                }}
                className="px-4 py-2 bg-white hover:bg-[#EAE2D1] border border-[#D4C3A3] text-[#7A6B58] font-bold rounded-lg transition-all text-xs flex items-center gap-1"
              >
                <Undo2 size={14} />
                ゲームをやめる
              </button>
            </div>
          </div>
        )}

        {/* CLEAR 画面 */}
        {gameState === GameState.CLEAR && (
          <div className="w-full bg-white border-4 border-[#C6E2BD] rounded-2xl shadow-md p-6 text-center max-w-sm flex flex-col items-center">
            <div className="w-16 h-16 bg-[#F3FAF0] rounded-full flex items-center justify-center text-4xl mb-4 border-2 border-[#A6CD99]">
              🌸
            </div>
            <h2 className="text-3xl font-bold text-[#2A5C1E] font-serif tracking-wider mb-2">
              見事、揃いました！
            </h2>
            <p className="text-sm text-[#557E49] mb-6">
              素晴らしい記憶力です。脳のトレーニングが正常に行われました！
            </p>

            <div className="w-full bg-[#F9FBF8] border border-[#D4E9CD] rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">クリア難易度:</span>
                <span className="font-bold text-gray-800">レベル {level}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">かかった時間:</span>
                <span className="font-bold text-[#2A5C1E] font-mono">
                  {getLevelConfig(level).time - timeLeft} 秒
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">めくった回数 (合計タップ):</span>
                <span className="font-bold text-gray-800 font-mono">
                  {totalTaps} 回
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">お手つき回数:</span>
                <span className="font-bold text-gray-800">
                  {missCount} 回
                </span>
              </div>
            </div>

            <div className="space-y-3 w-full">
              <button
                id="btn-clear-retry"
                onClick={() => startGame(level)}
                className="w-full bg-[#E2F0DD] hover:bg-[#D4E9CD] active:bg-[#C6E2BD] border-2 border-[#A6CD99] text-[#2A5C1E] font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 text-base"
              >
                <RefreshCw size={18} />
                同じ難易度でもう一度遊ぶ
              </button>

              <button
                id="btn-clear-home"
                onClick={() => {
                  setGameState(GameState.START);
                  playSound("click");
                }}
                className="w-full bg-white hover:bg-[#EAE2D1] border-2 border-[#D4C3A3] text-[#7A6B58] font-bold py-3 px-4 rounded-xl transition-all text-base"
              >
                難易度選択（ホーム）へ戻る
              </button>
            </div>
          </div>
        )}

        {/* GAMEOVER 画面 */}
        {gameState === GameState.GAMEOVER && (
          <div className="w-full bg-white border-4 border-[#E9C2C2] rounded-2xl shadow-md p-6 text-center max-w-sm flex flex-col items-center">
            {/* 筆文字調の「残念！」を模した大きな和風ヘッダー */}
            <div className="text-5xl mb-3 select-none">🍂</div>
            <h2 className="text-4xl font-extrabold text-[#8C2D2D] font-serif tracking-widest mb-1">
              残念！
            </h2>
            <div className="text-xs text-gray-400 tracking-wider mb-4 uppercase font-mono">
              GAME OVER
            </div>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              <span className="font-bold text-[#8C2D2D] block mb-1">【時間切れ】</span>
              制限時間を過ぎてしまいました。<br />焦らずに少しずつ覚えていきましょう！
            </p>

            <div className="space-y-3 w-full">
              {/* 高齢者向けに極めて大きな操作ボタン */}
              <button
                id="btn-gameover-retry"
                onClick={() => startGame(level)}
                className="w-full bg-[#FDF5F5] hover:bg-[#FBE8E8] active:bg-[#F8D6D6] border-2 border-[#D69F9F] text-[#8C2D2D] font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
              >
                <RefreshCw size={20} />
                もう一度遊ぶ（再挑戦）
              </button>

              <button
                id="btn-gameover-home"
                onClick={() => {
                  setGameState(GameState.START);
                  playSound("click");
                }}
                className="w-full bg-white hover:bg-[#EAE2D1] border-2 border-[#D4C3A3] text-[#7A6B58] font-bold py-3 px-4 rounded-xl transition-all text-base"
              >
                戻る（レベル選択へ）
              </button>
            </div>
          </div>
        )}

      </main>

      {/* 共通フッター */}
      <footer className="w-full max-w-lg border-t border-[#D4C3A3] pt-3 mt-4 text-center">
        <p className="text-[10px] text-[#9E8E79] tracking-wider leading-relaxed">
          和風 脳活性絵合わせ | 脳の血流を良くし、楽しく認知症を予防しましょう。<br />
          © 和風脳トレゲーム製作委員会
        </p>
      </footer>
    </div>
  );
}
