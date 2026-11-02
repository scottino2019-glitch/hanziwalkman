/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DictationItem, AudioSettings, DictationAttempt } from './types/dictation';
import {
  fetchDefaultDictations,
  getCustomDictations,
  saveCustomDictation,
  deleteCustomDictation,
  getDictationAttempts,
  saveDictationAttempt,
} from './utils/storage';
import { soundFx } from './utils/audioEffects';
import { WalkmanChassis } from './components/WalkmanPlayer/WalkmanChassis';
import { DictationPad } from './components/DictationExercise/DictationPad';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import { Headphones, Info } from 'lucide-react';

export default function App() {
  const [dictations, setDictations] = useState<DictationItem[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [attempts, setAttempts] = useState<Record<string, DictationAttempt>>({});
  const [showInfoModal, setShowInfoModal] = useState(false);

  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    playbackRate: 1.0,
    autoPauseDuration: 0,
    soundFxEnabled: true,
    tapeEq: 'NORMAL',
    volume: 0.9,
  });

  const handleUpdateSettings = React.useCallback((newSettings: Partial<AudioSettings>) => {
    setAudioSettings((prev) => {
      let hasChanges = false;
      for (const [key, value] of Object.entries(newSettings)) {
        if (prev[key as keyof AudioSettings] !== value) {
          hasChanges = true;
          break;
        }
      }
      return hasChanges ? { ...prev, ...newSettings } : prev;
    });
  }, []);

  useEffect(() => {
    soundFx.enabled = audioSettings.soundFxEnabled;
  }, [audioSettings.soundFxEnabled]);

  useEffect(() => {
    async function loadData() {
      const defaults = await fetchDefaultDictations();
      const customs = getCustomDictations();
      const combined = [...customs, ...defaults];
      setDictations(combined);

      const savedAttempts = getDictationAttempts();
      setAttempts(savedAttempts);
    }
    loadData();
  }, []);

  const currentTrack: DictationItem | null = dictations[currentTrackIndex] || null;

  const handleSelectTrack = (track: DictationItem) => {
    const idx = dictations.findIndex((d) => d.id === track.id);
    if (idx >= 0) {
      setCurrentTrackIndex(idx);
    }
  };

  const handlePrevTrack = () => {
    soundFx.playClick('rewind');
    setCurrentTrackIndex((prev) => (prev > 0 ? prev - 1 : dictations.length - 1));
  };

  const handleNextTrack = () => {
    soundFx.playClick('ff');
    setCurrentTrackIndex((prev) => (prev < dictations.length - 1 ? prev + 1 : 0));
  };

  const handleSaveAttempt = (attempt: DictationAttempt) => {
    saveDictationAttempt(attempt);
    setAttempts((prev) => ({
      ...prev,
      [attempt.dictationId]: attempt,
    }));
  };

  const pauseWalkmanRef = React.useRef<(() => void) | null>(null);

  return (
    <div className="min-h-screen bg-[#eef1f5] text-stone-800 flex flex-col font-sans selection:bg-amber-400 selection:text-stone-950">
      <OfflineIndicator />

      {/* Barra Superiore Pulita */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b-2 border-stone-200 shadow-2xs">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-xs border border-amber-600">
              <Headphones className="w-4 h-4 text-stone-950 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-sm font-black font-mono tracking-wider text-stone-950">
                HANZI·WALK
              </span>
              <span className="text-[10px] font-mono text-stone-500 ml-1.5 hidden sm:inline">
                Dettato Cinese 90s
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <button
              onClick={() => setShowInfoModal(true)}
              title="Informazioni"
              className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center border border-stone-300 transition cursor-pointer"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* DISPOSIZIONE VERTICALE: 
          1. Menù scorrevole dei nastri in alto integrato nella scocca
          2. Nome traccia, display LCD e regolazioni audio a scomparsa
          3. Nastro (cassetta animata)
          4. Comandi fisici di riproduzione
          5. Area testo libera in fondo
      */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {/* 1, 2, 3, 4: Walkman dedicato alla riproduzione pura dei nastri MP3 */}
        <WalkmanChassis
          currentTrack={currentTrack}
          trackIndex={currentTrackIndex}
          totalTracks={dictations.length || 1}
          dictations={dictations}
          onSelectTrack={handleSelectTrack}
          onPrevTrack={handlePrevTrack}
          onNextTrack={handleNextTrack}
          settings={audioSettings}
          onUpdateSettings={handleUpdateSettings}
          attempts={attempts}
          onRegisterPause={(pauseFn) => {
            pauseWalkmanRef.current = pauseFn;
          }}
        />

        {/* 5. IN FONDO: Area testo del dettato con lettura vocale zh-CN indipendente */}
        <DictationPad
          currentTrack={currentTrack}
          onSaveAttempt={handleSaveAttempt}
          previousAttempt={currentTrack ? attempts[currentTrack.id] : undefined}
          onPauseWalkman={() => {
            if (pauseWalkmanRef.current) {
              pauseWalkmanRef.current();
            }
          }}
        />
      </main>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white border-2 border-stone-300 p-6 shadow-2xl text-stone-800">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-base font-bold text-amber-700 font-mono tracking-wide">
                GUIDA HANZI·WALK
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-xs bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-lg text-stone-600 cursor-pointer"
              >
                Chiudi
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-stone-600 font-mono leading-relaxed">
              <p>
                <strong>1. Porta-Nastri in primo piano:</strong> tutte le cassette disponibili sono visibili subito con testo chiaro e leggibile. Clicca su qualsiasi cassetta per inserirla nel Walkman.
              </p>
              <p>
                <strong>2. Traccia, Display & Regolazioni:</strong> controlla il contatore nastro e il VU meter. Clicca su <em>REGOLAZIONI</em> per aprire/chiudere le opzioni audio (volume, velocità 0.7x-1.15x, equalizzatore Dolby).
              </p>
              <p>
                <strong>3. Nastro:</strong> visualizza la rotazione delle bobine del nastro magnetico durante la riproduzione.
              </p>
              <p>
                <strong>4. Comandi meccanici:</strong> premi PLAY per ascoltare, REW/FF per spostarti di 5s, A-B per impostare un loop.
              </p>
              <p>
                <strong>5. Area testo libera in fondo:</strong> scrivi liberamente i caratteri cinesi senza distrazioni e premi <em>Controlla Dettato</em>.
              </p>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 mt-2">
                <strong>Nota sui file MP3:</strong> Puoi aggiungere o modificare le tracce audio posizionando direttamente i file <code>.mp3</code> nella cartella <code>/public/audio/</code> e aggiornando il file <code>/public/audio/dettati.txt</code> (1 riga per dettato).
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs font-mono transition"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}

      {/* Footer Essenziale */}
      <footer className="mt-auto border-t border-stone-200 bg-white/70 py-3 px-4 text-center text-xs font-mono text-stone-400">
        HANZI·WALK · Dettato Cinese 90s Walkman · PWA
      </footer>
    </div>
  );
}
