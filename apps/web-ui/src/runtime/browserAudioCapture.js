function stopTrack(track) {
  try {
    track?.stop();
  } catch {
    // Capture cleanup is best-effort because browsers vary in track lifecycle behavior.
  }
}

function removeTrack(stream, track) {
  try {
    stream?.removeTrack(track);
  } catch {
    // Removing a stopped track can throw in some browser implementations.
  }
}

function describeCaptureError(error) {
  const name = error?.name ? `${error.name}: ` : "";
  const message = error?.message || "Browser display audio capture was not started.";
  return `${name}${message}`;
}

export async function startBrowserDisplayAudioCapture() {
  if (!navigator?.mediaDevices?.getDisplayMedia) {
    return {
      stream: null,
      audioTracks: [],
      status: "error",
      message: "Browser display audio capture is not supported in this browser.",
    };
  }

  let stream = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  } catch (error) {
    return {
      stream: null,
      audioTracks: [],
      status: "error",
      message: `Browser display audio capture failed. ${describeCaptureError(error)}`,
    };
  }

  const videoTracks = stream.getVideoTracks();
  for (const track of videoTracks) {
    stopTrack(track);
    removeTrack(stream, track);
  }

  const audioTracks = stream.getAudioTracks().filter((track) => track.readyState !== "ended");
  if (!audioTracks.length) {
    for (const track of stream.getTracks()) {
      stopTrack(track);
      removeTrack(stream, track);
    }

    return {
      stream: null,
      audioTracks: [],
      status: "error",
      message: "No display audio track was returned. Select a browser tab, window, or screen source with audio.",
    };
  }

  const plural = audioTracks.length === 1 ? "" : "s";
  return {
    stream,
    audioTracks,
    status: "captured",
    message: `Browser/system audio captured (${audioTracks.length} audio track${plural}). Video tracks were stopped immediately.`,
  };
}

export function stopBrowserDisplayAudioCapture(captureState) {
  const audioTracks = Array.isArray(captureState?.audioTracks) ? captureState.audioTracks : [];
  for (const track of audioTracks) {
    stopTrack(track);
  }

  const stream = captureState?.stream || null;
  if (stream) {
    for (const track of stream.getTracks()) {
      stopTrack(track);
      removeTrack(stream, track);
    }
  }

  return {
    status: "stopped",
    message: audioTracks.length
      ? "Browser/system audio capture stopped."
      : "Stop requested. No browser/system audio capture was active.",
  };
}

export function getCaptureSummary(captureState) {
  const audioTracks = Array.isArray(captureState?.audioTracks) ? captureState.audioTracks : [];
  if (captureState?.status !== "captured" || !audioTracks.length) {
    return {
      status: captureState?.status || "idle",
      audioTrackCount: 0,
      message: captureState?.message || "No browser/system audio capture is active.",
    };
  }

  return {
    status: "captured",
    audioTrackCount: audioTracks.length,
    message: captureState.message || `Browser/system audio captured (${audioTracks.length} audio track).`,
  };
}
