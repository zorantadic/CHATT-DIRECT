class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0];
    const pcm16 = new Int16Array(channel.length);

    for (let i = 0; i < channel.length; i++) {
      let s = channel[i];

      // 🔴 KLJUČNO: NaN / Infinity zaštita
      if (!Number.isFinite(s)) {
        pcm16[i] = 0;
        continue;
      }

      s = Math.max(-1, Math.min(1, s));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
