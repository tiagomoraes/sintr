/**
 * Plain WAV (16-bit, mono), for a provider that cannot read what a browser
 * records (Gemini takes neither WebM nor MP4 audio). Sixteen thousand
 * samples a second is what speech recognisers listen at.
 */
export const SPEECH_RATE = 16_000;

/** Samples between -1 and 1 as a WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number = SPEECH_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return bytes;
}

/** A recording as 16 kHz mono WAV, decoded and resampled by the browser itself. */
export async function toSpeechWav(recording: Blob): Promise<Blob> {
  const decoder = new AudioContext();
  try {
    const decoded = await decoder.decodeAudioData(await recording.arrayBuffer());
    const frames = Math.ceil(decoded.duration * SPEECH_RATE);
    const offline = new OfflineAudioContext(1, Math.max(1, frames), SPEECH_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return new Blob([new Uint8Array(encodeWav(rendered.getChannelData(0)))], { type: "audio/wav" });
  } finally {
    void decoder.close();
  }
}
