import React, { useState, useEffect } from 'react';
import { DictationItem, DictationAttempt } from '../../types/dictation';
import { CheckCircle2, RotateCcw, Eye, EyeOff, Award, BookOpen, Volume2 } from 'lucide-react';
import { soundFx } from '../../utils/audioEffects';
import { speakChineseText } from '../../utils/chineseSpeech';

interface DictationPadProps {
  currentTrack: DictationItem | null;
  onSaveAttempt: (attempt: DictationAttempt) => void;
  previousAttempt?: DictationAttempt;
}

export const DictationPad: React.FC<DictationPadProps> = ({
  currentTrack,
  onSaveAttempt,
  previousAttempt,
}) => {
  const [userInput, setUserInput] = useState('');
  const [hasChecked, setHasChecked] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [charDiff, setCharDiff] = useState<
    Array<{ char: string; expected?: string; status: 'correct' | 'wrong' }>
  >([]);

  // Reset when track changes
  useEffect(() => {
    setUserInput('');
    setHasChecked(false);
    setShowSolution(false);
    setScore(null);
    setCharDiff([]);
  }, [currentTrack?.id]);

  const cleanForComparison = (str: string) => {
    return str.replace(/[，。！？、；：""''（）\s,!?.:;\n\r]/g, '');
  };

  const handleCheck = () => {
    if (!currentTrack) return;
    soundFx.playClick('switch');

    const expectedRaw = currentTrack.chineseText;
    const userClean = cleanForComparison(userInput);
    const expectedClean = cleanForComparison(expectedRaw);

    let matchCount = 0;
    const diff: Array<{ char: string; expected?: string; status: 'correct' | 'wrong' }> = [];

    const maxLen = Math.max(userClean.length, expectedClean.length);
    for (let i = 0; i < maxLen; i++) {
      const uChar = userClean[i] || '';
      const expChar = expectedClean[i] || '';

      if (uChar === expChar) {
        matchCount++;
        diff.push({ char: uChar, status: 'correct' });
      } else {
        diff.push({
          char: uChar || '—',
          expected: expChar,
          status: 'wrong',
        });
      }
    }

    const calculatedScore = expectedClean.length > 0 ? Math.round((matchCount / expectedClean.length) * 100) : 0;
    setScore(calculatedScore);
    setCharDiff(diff);
    setHasChecked(true);

    onSaveAttempt({
      dictationId: currentTrack.id,
      date: new Date().toISOString(),
      userText: userInput,
      score: calculatedScore,
      accuracyChars: matchCount,
      totalChars: expectedClean.length,
      completed: calculatedScore >= 80,
    });
  };

  const handleReset = () => {
    soundFx.playClick('stop');
    setUserInput('');
    setHasChecked(false);
    setShowSolution(false);
    setScore(null);
    setCharDiff([]);
  };

  if (!currentTrack) {
    return (
      <div className="w-full bg-white border-2 border-stone-300 rounded-3xl p-6 text-center text-stone-500 shadow-xs">
        <BookOpen className="w-8 h-8 mx-auto mb-2 text-stone-400" />
        <p className="font-mono text-sm font-bold text-stone-700">Area Dettato</p>
        <p className="text-xs text-stone-500 mt-0.5">Seleziona una traccia audio per iniziare a scrivere.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-white border-2 border-stone-300 rounded-3xl p-4 sm:p-6 shadow-sm text-stone-800 space-y-3">
      {/* Intestazione essenziale e pulita */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-200">
        <span className="text-xs font-mono font-bold tracking-wider text-stone-600 uppercase">
          AREA DETTATO · 听写
        </span>
        <div className="flex items-center gap-2 text-xs font-mono text-stone-400">
          <span>{userInput.length} caratteri</span>
        </div>
      </div>

      {/* AREA TESTO COMPLETAMENTE LIBERA (Spaziosa, confortevole, senza tasti di disturbo) */}
      <div className="relative">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ascolta l'audio nel Walkman e scrivi liberamente qui il testo in cinese..."
          rows={5}
          className="w-full bg-[#fbfbfa] border-2 border-stone-300 focus:border-amber-500 focus:bg-white focus:outline-hidden rounded-2xl p-4 text-base sm:text-lg text-stone-900 placeholder:text-stone-400 font-sans tracking-wide leading-relaxed resize-y transition shadow-inner"
        />
      </div>

      {/* Barra pulsanti essenziale: solo Controlla, Mostra soluzione e Ripulisci */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          {/* Tasto principale CONVALIDA */}
          <button
            onClick={handleCheck}
            disabled={userInput.trim().length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 disabled:pointer-events-none text-stone-950 font-bold text-xs font-mono tracking-wider transition cursor-pointer shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>CONTROLLA DETTATO</span>
          </button>

          {/* Tasto RIPULISCI */}
          {userInput.length > 0 && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono text-xs font-semibold transition cursor-pointer border border-stone-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ripulisci</span>
            </button>
          )}
        </div>

        {/* Azioni secondarie (Pronuncia zh-CN e Mostra/Nascondi Testo) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundFx.playClick('switch');
              speakChineseText(currentTrack.chineseText, 0.9);
            }}
            title="Ascolta con voce cinese zh-CN"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono text-xs font-semibold transition cursor-pointer border border-stone-300"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-600" />
            <span>Voce zh-CN</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick('switch');
              setShowSolution(!showSolution);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono text-xs font-semibold transition cursor-pointer border border-stone-300"
          >
            {showSolution ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showSolution ? 'Nascondi' : 'Mostra Testo'}</span>
          </button>
        </div>
      </div>

      {/* Soluzione (se richiesta) */}
      {showSolution && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-200 text-xs font-mono space-y-1 animate-in fade-in">
          <span className="text-amber-800 font-bold block">TESTO ORIGINALE DELLA TRACCIA:</span>
          <p className="text-base font-bold text-stone-900 font-sans tracking-wide leading-relaxed">
            {currentTrack.chineseText}
          </p>
          {currentTrack.pinyin && <p className="text-amber-700 text-xs pt-1">{currentTrack.pinyin}</p>}
          {currentTrack.translation && <p className="text-stone-600 text-xs italic">{currentTrack.translation}</p>}
        </div>
      )}

      {/* Risultato verifica carattere per carattere */}
      {hasChecked && (
        <div className="rounded-2xl bg-stone-50 border-2 border-stone-300 p-4 space-y-3 animate-in fade-in shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200">
            <div className="flex items-center gap-2">
              <Award className={`w-5 h-5 ${score && score >= 80 ? 'text-amber-500' : 'text-stone-400'}`} />
              <span className="font-mono font-bold text-sm text-stone-900">
                Punteggio: <span className="text-amber-600 text-lg font-black">{score}%</span>
              </span>
            </div>
            <span
              className={`text-xs font-black font-mono px-3 py-0.5 rounded-full ${
                score && score >= 85
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : score && score >= 60
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-red-100 text-red-800 border border-red-300'
              }`}
            >
              {score && score >= 85 ? 'Ottimo! 很好！' : 'Da riascoltare'}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-mono text-stone-500 block mb-1.5 font-bold">
              CONFRONTO CARATTERI (Verde = Esatto, Rosso = Errato/Mancante):
            </span>
            <div className="max-h-48 overflow-y-auto p-2 bg-white rounded-xl border border-stone-200 flex flex-wrap gap-1.5">
              {charDiff.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col items-center justify-center min-w-8 h-10 px-1 rounded-lg border-2 font-sans text-base font-bold ${
                    item.status === 'correct'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                      : 'bg-red-50 border-red-400 text-red-700'
                  }`}
                >
                  <span>{item.char}</span>
                  {item.status === 'wrong' && item.expected && (
                    <span className="text-[7px] text-stone-600 font-mono font-normal">
                      {item.expected}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-stone-200 text-xs font-mono">
            <span className="text-stone-400 font-bold block mb-0.5">FRASE ATTESA:</span>
            <p className="text-sm font-bold text-stone-900 font-sans">{currentTrack.chineseText}</p>
          </div>
        </div>
      )}

      {previousAttempt && (
        <div className="text-right text-[11px] font-mono text-stone-400">
          Miglior tentativo precedente: <span className="text-amber-600 font-bold">{previousAttempt.score}%</span>
        </div>
      )}
    </div>
  );
};
