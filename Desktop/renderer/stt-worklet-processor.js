class STTPCMDowsampleProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._carry = new Float32Array(0);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0]; // Float32 @ 48k
    // concat carry + current
    let buf;
    if (this._carry.length > 0) {
      buf = new Float32Array(this._carry.length + channel.length);
      buf.set(this._carry, 0);
      buf.set(channel, this._carry.length);
    } else {
      buf = channel;
    }

    const factor = 3; // 48k -> 16k
    const outLen = Math.floor(buf.length / factor);
    const pcm16 = new Int16Array(outLen);

    for (let i = 0; i < outLen; i++) {
      const j = i * factor;

      // simple anti-alias-ish average of 3 samples
      let s = (buf[j] + buf[j + 1] + buf[j + 2]) / 3;

      // NaN/Infinity protection
      if (!Number.isFinite(s)) s = 0;

      s = Math.max(-1, Math.min(1, s));
      pcm16[i] = s < 0 ? (s * 0x8000) : (s * 0x7fff);
    }

    // keep leftover
    const used = outLen * factor;
    const rem = buf.length - used;
    if (rem > 0) {
      this._carry = buf.slice(used);
    } else {
      this._carry = new Float32Array(0);
    }

    // send binary PCM16@16k to main thread
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);

    return true;
  }
}

registerProcessor("stt-pcm16-16k", STTPCMDowsampleProcessor);

class DirectRealtimePCM16Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._carry = new Float32Array(0);
    this._nextIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0];
    let buf;
    if (this._carry.length > 0) {
      buf = new Float32Array(this._carry.length + channel.length);
      buf.set(this._carry, 0);
      buf.set(channel, this._carry.length);
    } else {
      buf = channel;
    }

    const sourceRate = Number(sampleRate || 48000);
    const targetRate = 24000;
    const ratio = sourceRate / targetRate;
    if (!Number.isFinite(ratio) || ratio <= 0) return true;

    const out = [];
    while (this._nextIndex + 1 < buf.length) {
      const i = Math.floor(this._nextIndex);
      const frac = this._nextIndex - i;
      let s = buf[i] + ((buf[i + 1] - buf[i]) * frac);

      if (!Number.isFinite(s)) s = 0;
      s = Math.max(-1, Math.min(1, s));
      out.push(s < 0 ? (s * 0x8000) : (s * 0x7fff));

      this._nextIndex += ratio;
    }

    const used = Math.floor(this._nextIndex);
    if (used > 0) {
      this._carry = buf.slice(used);
      this._nextIndex -= used;
    } else {
      this._carry = buf;
    }

    if (out.length > 0) {
      const pcm16 = new Int16Array(out.length);
      for (let i = 0; i < out.length; i++) pcm16[i] = out[i];
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }

    return true;
  }
}

registerProcessor("direct-realtime-pcm16-24k", DirectRealtimePCM16Processor);
