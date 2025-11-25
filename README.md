# ScoreBoard Studio

This is a NextJS application for hockey scoreboard control with voice recognition.

## Installation

### 1. Install Node dependencies
```bash
npm install
```

### 2. Install Python dependencies (for voice recognition)

**Important:** Voice recognition requires Python 3.9+ with Whisper and ffmpeg.

```bash
# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On macOS/Linux
# OR
venv\Scripts\activate     # On Windows

# Install Python packages
pip install -r requirements.txt

# Install NumPy < 2 (compatibility fix)
pip install "numpy<2"
```

### 3. Install ffmpeg (required for audio processing)

```bash
# macOS
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt-get install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

## Running the application

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Voice Control

Access voice control at `/voice` route. Requires:
- Active game with teams loaded in `tmp/new-storage/data/live.json`
- Microphone permissions in browser
- Python venv activated (runs automatically via API)

### Cloud Transcription (Optional - Faster)

For faster transcription, you can use Groq's free cloud API:

1. Get a free API key at https://console.groq.com/keys
2. Add to your `.env` file:
   ```
   GROQ_API_KEY=your_key_here
   VOICE_TRANSCRIPTION_MODE=auto
   ```

**Modes:**
- `auto` (default): Try cloud first, fallback to local if unavailable
- `cloud`: Only use cloud (requires internet + API key)
- `local`: Only use local Whisper (offline, slower)

**Speed comparison:**
- Cloud (Groq): ~500-1000ms ⚡
- Local (Whisper base): ~2000-4000ms 🐢