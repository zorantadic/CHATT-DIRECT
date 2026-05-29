import struct


INPUT_SAMPLE_RATE = 24000
OUTPUT_SAMPLE_RATE = 16000
PCM16_BYTES_PER_SAMPLE = 2


def pcm16_mono_24k_to_16k(audio_bytes: bytes) -> bytes:
    if not audio_bytes:
        return b""

    if len(audio_bytes) < PCM16_BYTES_PER_SAMPLE:
        return b""

    usable_length = len(audio_bytes) - (len(audio_bytes) % PCM16_BYTES_PER_SAMPLE)
    if usable_length <= 0:
        return b""

    sample_count = usable_length // PCM16_BYTES_PER_SAMPLE
    if sample_count <= 0:
        return b""

    samples = struct.unpack(f"<{sample_count}h", audio_bytes[:usable_length])
    out_count = max(1, (sample_count * OUTPUT_SAMPLE_RATE) // INPUT_SAMPLE_RATE)

    if sample_count == 1:
        return struct.pack("<h", samples[0]) * out_count

    out_samples: list[int] = []
    max_index = sample_count - 1
    scale = INPUT_SAMPLE_RATE / OUTPUT_SAMPLE_RATE

    for i in range(out_count):
        src_pos = i * scale
        left_index = int(src_pos)
        if left_index >= max_index:
            out_samples.append(int(samples[max_index]))
            continue

        right_index = left_index + 1
        frac = src_pos - left_index
        left_sample = samples[left_index]
        right_sample = samples[right_index]
        interpolated = left_sample + ((right_sample - left_sample) * frac)
        out_samples.append(int(round(interpolated)))

    return struct.pack(f"<{len(out_samples)}h", *out_samples)
