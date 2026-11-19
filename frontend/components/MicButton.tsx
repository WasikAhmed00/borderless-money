"use client";
import { useState } from "react";
import { Mic, Loader2 } from "lucide-react";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export default function MicButton({
  onTranscript,
  disabled,
  titleMic = "Fill amount by voice",
  titleListening = "Listening",
  titleUnsupported = "Voice input is not supported in this browser",
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  titleMic?: string;
  titleListening?: string;
  titleUnsupported?: string;
}) {
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const start = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setUnsupported(true); return; }
    const rec = new Ctor();
    rec.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    rec.continuous = false; rec.interimResults = false;
    rec.onresult = (event) => onTranscript(event.results[0][0].transcript);
    rec.onerror = () => setListening(false); rec.onend = () => setListening(false);
    rec.start(); setListening(true);
  };
  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled || listening || unsupported}
      aria-label={listening ? titleListening : titleMic}
      title={unsupported ? titleUnsupported : titleMic}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${listening ? "border-[#E3E6EA] bg-[#F6F7F9] text-[#17181C]" : "border-[#E3E6EA] bg-white text-[#5C6470] hover:border-[#17181C] hover:text-[#17181C]"} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {listening ? <Loader2 size={18} strokeWidth={1.75} className="animate-spin" aria-hidden="true" /> : <Mic size={18} strokeWidth={1.75} aria-hidden="true" />}
    </button>
  );
}
