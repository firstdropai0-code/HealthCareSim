type GeminiTtsOptions = {
  voiceName?: string;
  style?: string;
  signal?: AbortSignal;
};

function abortError(): Error {
  return new Error("Gemini TTS playback was cancelled.");
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || "Gemini TTS request failed.";
  } catch {
    return "Gemini TTS request failed.";
  }
}

export async function speakWithGeminiTts(
  text: string,
  options: GeminiTtsOptions = {},
): Promise<void> {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return;
  }

  if (options.signal?.aborted) {
    throw abortError();
  }

  const response = await fetch("/api/gemini-tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: trimmedText,
      voiceName: options.voiceName,
      style: options.style,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const audioBlob = await response.blob();

  if (options.signal?.aborted) {
    throw abortError();
  }

  const objectUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(objectUrl);

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(objectUrl);
      options.signal?.removeEventListener("abort", handleAbort);
    };

    const finish = (handler: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      handler();
    };

    const handleAbort = () => {
      finish(() => reject(abortError()));
    };

    audio.onended = () => {
      finish(resolve);
    };

    audio.onerror = () => {
      finish(() => reject(new Error("Gemini TTS audio playback failed.")));
    };

    options.signal?.addEventListener("abort", handleAbort, { once: true });

    audio.play().catch((error: unknown) => {
      finish(() =>
        reject(error instanceof Error ? error : new Error("Gemini TTS audio playback failed.")),
      );
    });
  });
}
