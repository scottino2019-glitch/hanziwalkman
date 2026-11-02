/**
 * Client-side native Chinese speech synthesis utility.
 * Sequential chunk playback engine with asynchronous voice discovery,
 * GC protection, error recovery watchdogs, and zero freezing.
 */

let activeUtterance: SpeechSynthesisUtterance | null = null;
let isSpeaking = false;
let isPaused = false;
let watchdogTimer: number | null = null;
let currentOnEndCallback: (() => void) | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
let pendingChunks: string[] = [];
let currentChunkIndex = 0;
let currentRate = 1.0;
let currentOnBoundaryCallback: ((charIndex: number) => void) | null = null;

// Populate voices as soon as available
function updateCachedVoices() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      cachedVoices = window.speechSynthesis.getVoices() || [];
    } catch {
      cachedVoices = [];
    }
  }
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  updateCachedVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      updateCachedVoices();
    };
  }
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function getChineseVoice(): SpeechSynthesisVoice | null {
  if (cachedVoices.length === 0) {
    updateCachedVoices();
  }
  if (cachedVoices.length === 0) return null;

  // 1. Exact Mainland Mandarin (zh-CN, cmn-Hans, cmn)
  const mainlandVoice = cachedVoices.find((v) => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    return (
      lang === 'zh-cn' ||
      lang === 'cmn-hans-cn' ||
      lang === 'cmn-hans' ||
      lang === 'cmn-cn' ||
      name.includes('mandarin') ||
      name.includes('putonghua') ||
      name.includes('普通话')
    );
  });
  if (mainlandVoice) return mainlandVoice;

  // 2. Any Chinese variant (zh, zh-TW, zh-HK)
  const anyZH = cachedVoices.find((v) => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    return lang.startsWith('zh') || name.includes('chinese');
  });
  return anyZH || null;
}

/**
 * Splits Chinese text into natural sentence chunks by punctuation: 。！？!?；;
 * Also splits long clauses by commas if segment exceeds 20 characters.
 */
export function splitChineseIntoChunks(text: string): string[] {
  if (!text) return [];
  const clean = text.trim();
  if (!clean) return [];

  // Split by major sentence terminators first
  const rawSegments = clean.split(/([。！？!?；;\n]+)/g);
  const segments: string[] = [];

  for (let i = 0; i < rawSegments.length; i += 2) {
    const part = rawSegments[i]?.trim() || '';
    const punctuation = rawSegments[i + 1] || '';
    const full = (part + punctuation).trim();
    if (full) segments.push(full);
  }

  const finalChunks: string[] = [];
  // If any segment is still overly long (> 24 chars), sub-split by comma to avoid browser TTS timeout
  for (const seg of segments) {
    if (seg.length > 24) {
      const subParts = seg.split(/([，,、]+)/g);
      for (let j = 0; j < subParts.length; j += 2) {
        const sub = (subParts[j]?.trim() || '') + (subParts[j + 1] || '');
        if (sub.trim()) finalChunks.push(sub.trim());
      }
    } else {
      finalChunks.push(seg);
    }
  }

  return finalChunks.length > 0 ? finalChunks : [clean];
}

/**
 * Estimates reading duration in seconds for Chinese text based on playback rate.
 */
export function estimateChineseReadingDuration(text: string, rate: number = 1.0): number {
  if (!text) return 3;
  const charCount = text.replace(/[\s\r\n]/g, '').length;
  const effectiveRate = Math.max(0.5, Math.min(1.5, rate));
  // Average Chinese reading speed: ~3.2 characters per second at 1.0x, + 0.5s pause
  const estSeconds = (charCount / 3.2) / effectiveRate + 0.6;
  return Math.max(2, Math.round(estSeconds * 10) / 10);
}

function clearWatchdog() {
  if (watchdogTimer !== null) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

function playNextChunk() {
  if (!isSpeaking) return;

  if (currentChunkIndex >= pendingChunks.length) {
    // All chunks finished
    isSpeaking = false;
    isPaused = false;
    activeUtterance = null;
    clearWatchdog();
    if (currentOnEndCallback) {
      const cb = currentOnEndCallback;
      currentOnEndCallback = null;
      cb();
    }
    return;
  }

  const chunk = pendingChunks[currentChunkIndex];
  if (!chunk || !chunk.trim()) {
    currentChunkIndex++;
    playNextChunk();
    return;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = 'zh-CN';
    utterance.rate = Math.max(0.6, Math.min(1.3, currentRate));
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voice = getChineseVoice();
    if (voice) {
      utterance.voice = voice;
    }

    let chunkHandled = false;
    const proceedToNext = () => {
      if (chunkHandled) return;
      chunkHandled = true;
      clearWatchdog();
      currentChunkIndex++;
      // Microtask delay to ensure clean utterance transition in browser engine
      setTimeout(() => {
        playNextChunk();
      }, 50);
    };

    utterance.onend = () => {
      proceedToNext();
    };

    utterance.onerror = (e) => {
      console.warn('TTS chunk playback notice:', e);
      proceedToNext();
    };

    if (currentOnBoundaryCallback) {
      utterance.onboundary = (e) => {
        if (typeof e.charIndex === 'number' && currentOnBoundaryCallback) {
          currentOnBoundaryCallback(e.charIndex);
        }
      };
    }

    activeUtterance = utterance;

    // Safety watchdog: ensure a stuck utterance never hangs the app forever
    const maxWaitMs = Math.max(4000, ((chunk.length / 2) / currentRate) * 1000 + 4000);
    watchdogTimer = window.setTimeout(() => {
      if (isSpeaking && !isPaused && !chunkHandled) {
        console.warn('TTS watchdog triggered chunk transition');
        proceedToNext();
      }
    }, maxWaitMs);

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('SpeechSynthesis error during chunk speak:', err);
    currentChunkIndex++;
    playNextChunk();
  }
}

export function speakChineseText(
  text: string,
  rate: number = 1.0,
  onEnd?: () => void,
  onBoundary?: (charIndex: number) => void
): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onEnd) onEnd();
    return;
  }

  // Cancel prior reading cleanly
  stopChineseSpeech();

  const chunks = splitChineseIntoChunks(text);
  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  pendingChunks = chunks;
  currentChunkIndex = 0;
  currentRate = rate;
  isSpeaking = true;
  isPaused = false;
  currentOnEndCallback = onEnd || null;
  currentOnBoundaryCallback = onBoundary || null;

  // Small delay after cancel() ensures the synthesis engine's queue is flushed
  setTimeout(() => {
    if (isSpeaking) {
      playNextChunk();
    }
  }, 40);
}

export function stopChineseSpeech(): void {
  isSpeaking = false;
  isPaused = false;
  pendingChunks = [];
  currentChunkIndex = 0;
  activeUtterance = null;
  currentOnEndCallback = null;
  currentOnBoundaryCallback = null;
  clearWatchdog();

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore cancel errors
    }
  }
}

export function pauseChineseSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis && isSpeaking && !isPaused) {
    try {
      isPaused = true;
      window.speechSynthesis.pause();
    } catch (err) {
      console.warn('Error pausing speech:', err);
    }
  }
}

export function resumeChineseSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis && isSpeaking && isPaused) {
    try {
      isPaused = false;
      window.speechSynthesis.resume();
    } catch (err) {
      console.warn('Error resuming speech:', err);
    }
  }
}
