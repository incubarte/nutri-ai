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