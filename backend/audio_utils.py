import io, struct

def pcm16_to_wav_bytes(pcm_bytes: bytes, sample_rate: int = 48000, channels: int = 1) -> bytes:
    byte_rate = sample_rate * channels * 2
    block_align = channels * 2
    data_size = len(pcm_bytes)
    riff_size = 36 + data_size
    buf = io.BytesIO()
    buf.write(b"RIFF"); buf.write(struct.pack("<I", riff_size)); buf.write(b"WAVE")
    buf.write(b"fmt "); buf.write(struct.pack("<I", 16)); buf.write(struct.pack("<H", 1))
    buf.write(struct.pack("<H", channels)); buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", byte_rate)); buf.write(struct.pack("<H", block_align))
    buf.write(struct.pack("<H", 16))
    buf.write(b"data"); buf.write(struct.pack("<I", data_size)); buf.write(pcm_bytes)
    return buf.getvalue()