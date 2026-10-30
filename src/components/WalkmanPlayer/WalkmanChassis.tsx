import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DictationItem, AudioSettings } from '../../types/dictation';
import { TapeReel } from './TapeReel';
import { WalkmanDisplay } from './WalkmanDisplay';
import { PhysicalButtons } from './PhysicalButtons';
import { WalkmanControls } from './WalkmanControls';
import {
  speakChineseText,
  stopChineseSpeech,
  pauseChineseSpeech,
  resumeChineseSpeech,
} from '../../utils/chineseSpeech';
import { Palette, Disc, ChevronLeft, ChevronRight } from 'lucide-react';

export type WalkmanColorway = 'sports_yellow' | 'brushed_silver' | 'cobalt_teal';

interface WalkmanChassisProps {
  currentTrack: DictationItem | null;
  trackIndex: number;
  totalTracks: number;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  settings: AudioSettings;
  onUpdateSettings: (newSettings: Partial<AudioSettings>) => void;
  onOpenLibrary: () => void;
  onSentenceComplete?: () => void;
}

export const WalkmanChassis: React.FC<WalkmanChassisProps> = ({
  currentTrack,
  trackIndex,
  totalTracks,
  onPrevTrack,
  onNextTrack,
  settings,
  onUpdateSettings,
  onOpenLibrary,
  onSentenceComplete,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Colorway state (default: 90s Sports Yellow)
  const [colorway, setColorway] = useState<WalkmanColorway>('sports_yellow');

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tapeCounter, setTapeCounter] = useState(0);

  // A-B Loop State
  const [isLoopingAB, setIsLoopingAB] = useState(false);
  const [abPoints, setAbPoints] = useState<{ a: number | null; b: number | null }>({
    a: null,
    b: null,
  });

  const pauseTimerRef = useRef<number | null>(null);
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  // Handle Audio Element Loading
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;

    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
    setAbPoints({ a: null, b: null });
    setIsLoopingAB(false);

    audioRef.current.playbackRate = settings.playbackRate;
    audioRef.current.volume = settings.volume;

    const targetSrc = currentTrack.audioSrc;
    if (!audioRef.current.src.endsWith(targetSrc)) {
      audioRef.current.src = targetSrc;
      audioRef.current.load();
    }
  }, [currentTrack?.id, currentTrack?.audioSrc]);

  // Sync settings
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = settings.playbackRate;
      audioRef.current.volume = settings.volume;
    }
  }, [settings.playbackRate, settings.volume]);

  // Tape counter increment
  useEffect(() => {
    if (!isPlaying || isPaused) return;
    const interval = setInterval(() => {
      setTapeCounter((prev) => prev + 1);
    }, 1000 / settings.playbackRate);
    return () => clearInterval(interval);
  }, [isPlaying, isPaused, settings.playbackRate]);

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      stopChineseSpeech();
    };
  }, []);

  // Play
  const handlePlay = useCallback(() => {
    if (!currentTrack) {
      onOpenLibrary();
      return;
    }

    if (settings.voiceMode === 'speech_synthesis') {
      setIsPlaying(true);
      setIsPaused(false);
      speakChineseText(
        currentTrack.chineseText,
        settings.playbackRate,
        () => {
          setIsPlaying(false);
          setIsPaused(false);
          if (onSentenceComplete) onSentenceComplete();
        }
      );
      return;
    }

    if (audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsPaused(false);
          })
          .catch((err) => {
            console.warn('Audio playback error, fallback to speech synthesis:', err);
            speakChineseText(
              currentTrack.chineseText,
              settings.playbackRate,
              () => {
                setIsPlaying(false);
                setIsPaused(false);
                if (onSentenceComplete) onSentenceComplete();
              }
            );
          });
      }
    }
  }, [currentTrack, settings.voiceMode, settings.playbackRate, onOpenLibrary, onSentenceComplete]);

  // Pause
  const handlePause = useCallback(() => {
    if (!isPlaying) return;

    if (settings.voiceMode === 'speech_synthesis') {
      if (isPaused) {
        resumeChineseSpeech();
        setIsPaused(false);
      } else {
        pauseChineseSpeech();
        setIsPaused(true);
      }
      return;
    }

    if (audioRef.current) {
      if (isPaused) {
        audioRef.current.play();
        setIsPaused(false);
      } else {
        audioRef.current.pause();
        setIsPaused(true);
      }
    }
  }, [isPlaying, isPaused, settings.voiceMode]);

  // Stop
  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);

    if (settings.voiceMode === 'speech_synthesis') {
      stopChineseSpeech();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  }, [settings.voiceMode]);

  // Rewind
  const handleRewind = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
      setCurrentTime(audioRef.current.currentTime);
    } else {
      handlePlay();
    }
  }, [handlePlay]);

  // Fast forward
  const handleFastForward = useCallback(() => {
    if (audioRef.current && duration > 0) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5);
      setCurrentTime(audioRef.current.currentTime);
    }
  }, [duration]);

  // A-B Loop
  const handleToggleAB = useCallback(() => {
    if (!isLoopingAB) {
      const a = currentTime;
      const b = Math.min(duration || 10, a + 4);
      setAbPoints({ a, b });
      setIsLoopingAB(true);
    } else {
      setIsLoopingAB(false);
      setAbPoints({ a: null, b: null });
    }
  }, [isLoopingAB, currentTime, duration]);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    setCurrentTime(curr);

    if (isLoopingAB && abPoints.a !== null && abPoints.b !== null) {
      if (curr >= abPoints.b) {
        audioRef.current.currentTime = abPoints.a;
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setIsPaused(false);

    if (settings.autoPauseDuration > 0) {
      pauseTimerRef.current = window.setTimeout(() => {
        handlePlay();
      }, settings.autoPauseDuration * 1000);
    }

    if (onSentenceComplete) {
      onSentenceComplete();
    }
  };

  const colorwayStyles = {
    sports_yellow: {
      bodyGrad: 'bg-gradient-to-b from-[#f59e0b] via-[#fbbf24] to-[#d97706]',
      border: 'border-[#b45309]',
    },
    brushed_silver: {
      bodyGrad: 'bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400',
      border: 'border-slate-500',
    },
    cobalt_teal: {
      bodyGrad: 'bg-gradient-to-b from-teal-500 via-cyan-600 to-teal-700',
      border: 'border-teal-800',
    },
  }[colorway];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center select-none">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={handleEnded}
        onError={(e) => {
          console.warn('Audio element error event:', e);
        }}
      />

      {/* WALKMAN BODY CASING */}
      <div
        className={`w-full rounded-3xl ${colorwayStyles.bodyGrad} border-4 ${colorwayStyles.border} p-3.5 sm:p-5 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_12px_28px_rgba(0,0,0,0.25)] space-y-3.5`}
      >
        {/* ============================================================== */}
        {/* 1. SOPRA: MENU CONTROLLI (Volume, Velocità, Equalizzatore)     */}
        {/* ============================================================== */}
        <div className="bg-neutral-900 border-2 border-neutral-700 rounded-2xl p-3 shadow-md">
          {/* Header Bar: Brand, Colore Walkman, Tasto Libreria */}
          <div className="flex flex-wrap items-center justify-between pb-2.5 mb-2.5 border-b border-neutral-800 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-4 bg-red-600 rounded-xs"></div>
              <span className="font-mono font-black text-sm tracking-widest text-neutral-100">
                SPORTS WM-90
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Palette Selector */}
              <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                <Palette className="w-3 h-3 text-neutral-400 ml-1" />
                <button
                  onClick={() => setColorway('sports_yellow')}
                  title="Giallo Sports"
                  className={`w-4 h-4 rounded-full bg-amber-500 transition border ${
                    colorway === 'sports_yellow' ? 'border-white scale-110' : 'border-neutral-700 opacity-60'
                  }`}
                />
                <button
                  onClick={() => setColorway('brushed_silver')}
                  title="Argento"
                  className={`w-4 h-4 rounded-full bg-slate-300 transition border ${
                    colorway === 'brushed_silver' ? 'border-white scale-110' : 'border-neutral-700 opacity-60'
                  }`}
                />
                <button
                  onClick={() => setColorway('cobalt_teal')}
                  title="Teal"
                  className={`w-4 h-4 rounded-full bg-teal-500 transition border ${
                    colorway === 'cobalt_teal' ? 'border-white scale-110' : 'border-neutral-700 opacity-60'
                  }`}
                />
              </div>

              {/* Tasto Libreria Nastri */}
              <button
                onClick={onOpenLibrary}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-[11px] font-mono font-bold border border-neutral-700 cursor-pointer shadow-xs"
              >
                <Disc className="w-3.5 h-3.5" />
                <span>NASTRI</span>
              </button>
            </div>
          </div>

          {/* Slider Volume & Regolazioni Audio */}
          <WalkmanControls
            playbackRate={settings.playbackRate}
            onPlaybackRateChange={(rate) => onUpdateSettings({ playbackRate: rate })}
            autoPauseDuration={settings.autoPauseDuration}
            onAutoPauseDurationChange={(dur) => onUpdateSettings({ autoPauseDuration: dur })}
            volume={settings.volume}
            onVolumeChange={(vol) => onUpdateSettings({ volume: vol })}
            audioSource={settings.voiceMode === 'speech_synthesis' ? 'speech' : 'mp3'}
            onAudioSourceChange={(src) =>
              onUpdateSettings({
                voiceMode: src === 'speech' ? 'speech_synthesis' : 'native_audio',
              })
            }
            tapeEq={settings.tapeEq}
            onTapeEqChange={(eq) => onUpdateSettings({ tapeEq: eq })}
            soundFxEnabled={settings.soundFxEnabled}
            onToggleSoundFx={() => onUpdateSettings({ soundFxEnabled: !settings.soundFxEnabled })}
          />
        </div>

        {/* ============================================================== */}
        {/* 2. SOTTO: NOME DELLA TRACCIA & DISPLAY TEMPO                   */}
        {/* ============================================================== */}
        <div className="bg-neutral-900 border-2 border-neutral-700 rounded-2xl p-3 shadow-md space-y-2">
          {/* Barra Nome Traccia con Frecce ◄ ► */}
          <div className="flex items-center justify-between gap-2 bg-neutral-950 p-2 rounded-xl border border-neutral-800 font-mono text-xs">
            <button
              onClick={onPrevTrack}
              title="Traccia Precedente"
              className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 text-neutral-300 hover:text-white transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 truncate px-1 text-center">
              <span className="text-[10px] text-neutral-500 font-bold shrink-0">
                {trackIndex + 1}/{totalTracks}
              </span>
              <span className="font-bold text-amber-400 text-sm tracking-wide truncate">
                {currentTrack ? currentTrack.title : 'Nessun nastro caricato'}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 font-bold shrink-0">
                {currentTrack?.difficulty || 'N/A'}
              </span>
            </div>

            <button
              onClick={onNextTrack}
              title="Traccia Successiva"
              className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 text-neutral-300 hover:text-white transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* LCD Display 90s con Contatore e VU Meter */}
          <WalkmanDisplay
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            isPaused={isPaused}
            currentTime={currentTime}
            duration={duration || 6}
            isLoopingAB={isLoopingAB}
            abPoints={abPoints}
            playbackRate={settings.playbackRate}
            autoPauseDuration={settings.autoPauseDuration}
            tapeCounter={tapeCounter}
            onResetCounter={() => setTapeCounter(0)}
            audioSource={settings.voiceMode === 'speech_synthesis' ? 'speech' : 'mp3'}
          />
        </div>

        {/* ============================================================== */}
        {/* 3. SOTTO: IL NASTRO (SPORTELLO CON CASSETTA CHE GIRA)          */}
        {/* ============================================================== */}
        <div className="relative rounded-2xl bg-neutral-950 border-3 border-neutral-800 p-2 sm:p-3 shadow-[inset_0_4px_12px_rgba(0,0,0,0.9)] overflow-hidden">
          <div className="relative z-10 w-full flex items-center justify-center">
            <TapeReel
              isPlaying={isPlaying && !isPaused}
              progress={progress}
              speed={settings.playbackRate}
              currentTrack={currentTrack}
            />
          </div>
        </div>

        {/* ============================================================== */}
        {/* 4. SOTTO: I COMANDI DI RIPRODUZIONE (TASTI GRANDI DEL WALKMAN) */}
        {/* ============================================================== */}
        <div>
          <PhysicalButtons
            isPlaying={isPlaying}
            isPaused={isPaused}
            isLoopingAB={isLoopingAB}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onRewind={handleRewind}
            onFastForward={handleFastForward}
            onToggleAB={handleToggleAB}
          />
        </div>
      </div>
    </div>
  );
};
