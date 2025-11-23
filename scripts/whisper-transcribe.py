#!/Users/diegoberkovics/Apps/ScoreBoard/studio/venv/bin/python3
"""
Simple Whisper transcription script
Usage: python whisper-transcribe.py <audio-file> [initial_prompt]
"""

import sys
import whisper
import warnings
import json

# Suppress FP16 warnings
warnings.filterwarnings("ignore", message="FP16 is not supported on CPU")

def transcribe(audio_file, initial_prompt=None):
    # Load Whisper model (base = better accuracy, ~142MB)
    # Options: tiny (~39MB, fast, less accurate), base (~142MB, balanced), small (~466MB, good)
    model = whisper.load_model("base")

    # Transcribe with language detection and fp16=False for CPU
    transcribe_options = {
        "language": "es",
        "fp16": False,  # CPU doesn't support fp16
        "temperature": 0,  # Make it deterministic (less creative, more accurate)
        "compression_ratio_threshold": 2.4,  # Default filtering
        "logprob_threshold": -1.0,  # Be more strict about word choices
        "no_speech_threshold": 0.6,  # Filter out non-speech
        "condition_on_previous_text": True,  # Use prompt context heavily
        "beam_size": 5,  # More thorough search for best transcription
    }

    # Add initial prompt if provided (helps with custom vocabulary)
    if initial_prompt:
        transcribe_options["initial_prompt"] = initial_prompt

    result = model.transcribe(audio_file, **transcribe_options)

    # Return just the text
    return result["text"].strip()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python whisper-transcribe.py <audio-file> [initial_prompt]")
        sys.exit(1)

    audio_file = sys.argv[1]
    initial_prompt = sys.argv[2] if len(sys.argv) > 2 else None

    text = transcribe(audio_file, initial_prompt)
    print(text)
