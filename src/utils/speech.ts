// Speech Synthesis (TTS) and Recognition (STT) helpers for browser execution

export class SpeechEngine {
  private static synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static currentUtterance: SpeechSynthesisUtterance | null = null;
  public static isMuted = false;

  public static speak(text: string, language: 'en' | 'hi' = 'en', onStart?: () => void, onEnd?: () => void): void {
    if (!this.synth || this.isMuted) {
      if (onEnd) onEnd();
      return;
    }

    try {
      this.synth.cancel(); // Stop any ongoing utterance
      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
      utterance.rate = 1.05; // Telephony cadence
      utterance.pitch = 1.0;

      // Select natural voice if available
      const voices = this.synth.getVoices();
      if (language === 'hi') {
        const hiVoice = voices.find((v) => v.lang.includes('hi') || v.lang.includes('Hindi'));
        if (hiVoice) utterance.voice = hiVoice;
      } else {
        const enVoice = voices.find((v) => (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Karen') || v.name.includes('Female')) && v.lang.startsWith('en'));
        if (enVoice) utterance.voice = enVoice;
      }

      utterance.onstart = () => {
        if (onStart) onStart();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        if (onEnd) onEnd();
      };

      utterance.onerror = () => {
        this.currentUtterance = null;
        if (onEnd) onEnd();
      };

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('TTS error:', e);
      if (onEnd) onEnd();
    }
  }

  public static stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  public static isSpeaking(): boolean {
    return this.synth ? this.synth.speaking : false;
  }
}
