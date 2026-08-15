from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import uuid
import tempfile
import logging
import re
from typing import Optional, Dict, Any

# Security utility function
def sanitize_for_log(input_str: str) -> str:
    """Sanitize input for safe logging"""
    if not isinstance(input_str, str):
        input_str = str(input_str)
    # Remove newlines and limit length
    return re.sub(r'[\r\n\t]', '_', input_str)[:200]
import torch
from pydub import AudioSegment
import soundfile as sf
import numpy as np
from pathlib import Path
import librosa
import noisereduce as nr
from scipy import signal
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Import Whisper for STT
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("Warning: Whisper not available. Install with: pip install openai-whisper")

# Import Coqui TTS
try:
    from TTS.api import TTS
    TTS_AVAILABLE = True
except ImportError:
    TTS_AVAILABLE = False
    print("Warning: Coqui TTS not available. Install with: pip install coqui-tts")

# Import gTTS
try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False
    print("Warning: gTTS not available. Install with: pip install gtts")

# Import pyttsx3
try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False
    print("Warning: pyttsx3 not available. Install with: pip install pyttsx3")

# Determine TTS library to use
if GTTS_AVAILABLE:
    TTS_LIB = 'gtts'
elif PYTTSX3_AVAILABLE:
    TTS_LIB = 'pyttsx3'
else:
    TTS_LIB = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Multi-Language STT/TTS Service",
    description="Advanced speech-to-text and text-to-speech service supporting Indian languages",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global models cache
models_cache = {}

# Supported languages configuration
SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "whisper_model": "base", "tts_model": "tts_models/en/ljspeech/tacotron2-DDC_ph"},
    "hi": {"name": "Hindi", "whisper_model": "base", "tts_model": "tts_models/hi/custom/v1"},
    "ta": {"name": "Tamil", "whisper_model": "base", "tts_model": "tts_models/ta/custom/v1"},
    "te": {"name": "Telugu", "whisper_model": "base", "tts_model": "tts_models/te/custom/v1"},
    "bn": {"name": "Bengali", "whisper_model": "base", "tts_model": "tts_models/bn/custom/v1"},
    "mr": {"name": "Marathi", "whisper_model": "base", "tts_model": "tts_models/mr/custom/v1"},
    "gu": {"name": "Gujarati", "whisper_model": "base", "tts_model": "tts_models/gu/custom/v1"},
    "kn": {"name": "Kannada", "whisper_model": "base", "tts_model": "tts_models/kn/custom/v1"},
    "ml": {"name": "Malayalam", "whisper_model": "base", "tts_model": "tts_models/ml/custom/v1"},
    "pa": {"name": "Punjabi", "whisper_model": "base", "tts_model": "tts_models/pa/custom/v1"},
    "or": {"name": "Odia", "whisper_model": "base", "tts_model": "tts_models/or/custom/v1"},
    "as": {"name": "Assamese", "whisper_model": "base", "tts_model": "tts_models/as/custom/v1"},
    "mai": {"name": "Maithili", "whisper_model": "base", "tts_model": "tts_models/hi/custom/v1"},  # Fallback to Hindi
    "bho": {"name": "Bhojpuri", "whisper_model": "base", "tts_model": "tts_models/hi/custom/v1"},  # Fallback to Hindi
    "awa": {"name": "Awadhi", "whisper_model": "base", "tts_model": "tts_models/hi/custom/v1"},    # Fallback to Hindi
    "mag": {"name": "Magahi", "whisper_model": "base", "tts_model": "tts_models/hi/custom/v1"},   # Fallback to Hindi
}

def get_whisper_model(language: str) -> Optional[Any]:
    """Load or retrieve cached Whisper model for the specified language."""
    if not WHISPER_AVAILABLE:
        raise HTTPException(status_code=503, detail="Whisper is not available. Please install openai-whisper.")

    model_size = SUPPORTED_LANGUAGES.get(language, {}).get("whisper_model", "base")
    cache_key = f"whisper_{model_size}"

    if cache_key not in models_cache:
        try:
            logger.info(f"Loading Whisper model: {model_size}")
            models_cache[cache_key] = whisper.load_model(model_size)
        except Exception as e:
            logger.error(f"Failed to load Whisper model {model_size}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load Whisper model: {str(e)}")

    return models_cache[cache_key]

def get_tts_model(language: str) -> Optional[Any]:
    """Load or retrieve cached TTS model for the specified language."""
    if not TTS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Coqui TTS is not available. Please install coqui-tts.")

    model_name = SUPPORTED_LANGUAGES.get(language, {}).get("tts_model")
    if not model_name:
        raise HTTPException(status_code=400, detail=f"TTS model not available for language: {language}")

    cache_key = f"tts_{language}"

    if cache_key not in models_cache:
        try:
            logger.info(f"Loading TTS model for {language}: {model_name}")
            models_cache[cache_key] = TTS(model_name).to("cpu")  # Use CPU for compatibility
        except Exception as e:
            logger.error(f"Failed to load TTS model for {language}: {e}")
            # Fallback to English if language-specific model fails
            if language != "en":
                logger.info("Falling back to English TTS model")
                return get_tts_model("en")
            raise HTTPException(status_code=500, detail=f"Failed to load TTS model: {str(e)}")

    return models_cache[cache_key]

def detect_language(audio_data: bytes) -> str:
    """Detect the language of the audio using Whisper's language detection."""
    try:
        # Convert audio to numpy array
        audio_segment = AudioSegment.from_file(io.BytesIO(audio_data))
        audio_array = np.array(audio_segment.get_array_of_samples(), dtype=np.float32)

        # Normalize audio
        if audio_segment.channels == 2:
            audio_array = audio_array.reshape((-1, 2)).mean(axis=1)
        audio_array = audio_array / (2**15 if audio_segment.sample_width == 2 else 2**31)

        # Load base Whisper model for language detection
        model = get_whisper_model("en")  # Use English model as base

        # Detect language
        audio_tensor = torch.from_numpy(audio_array).float()
        result = model.detect_language(audio_tensor)

        detected_lang = result[0] if isinstance(result, tuple) else result
        logger.info(f"Detected language: {sanitize_for_log(str(detected_lang))}")

        # Map to our supported languages
        if detected_lang in SUPPORTED_LANGUAGES:
            return detected_lang
        elif detected_lang in ["hi", "ur"]:  # Urdu often detected as Hindi
            return "hi"
        else:
            return "en"  # Default fallback

    except Exception as e:
        logger.error(f"Language detection failed: {e}")
        return "en"  # Default fallback



@app.post("/tts")
async def text_to_speech(
    text: str = Form(...),
    lang: str = Form("en"),
    speaker: Optional[str] = Form(None)
):
    """
    Convert text to speech with multi-language support.

    - **text**: Text to convert to speech
    - **lang**: Language code
    - **speaker**: Speaker ID for multi-speaker models (optional)
    """
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")

    if lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {lang}")

    try:
        logger.info(f"Generating speech for text: {sanitize_for_log(text[:50])}... (lang: {sanitize_for_log(lang)})")

        if TTS_LIB == 'gtts':
            tts = gTTS(text=text, lang=lang)
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
                temp_path = temp_file.name
            tts.save(temp_path)
            with open(temp_path, "rb") as audio_file:
                audio_data = audio_file.read()
            os.unlink(temp_path)
            return StreamingResponse(
                io.BytesIO(audio_data),
                media_type="audio/mpeg",
                headers={"Content-Disposition": f"attachment; filename=speech_{lang}.mp3"}
            )
        elif TTS_LIB == 'pyttsx3':
            engine = pyttsx3.init()
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_path = temp_file.name
            engine.save_to_file(text, temp_path)
            engine.runAndWait()
            with open(temp_path, "rb") as audio_file:
                audio_data = audio_file.read()
            os.unlink(temp_path)
            return StreamingResponse(
                io.BytesIO(audio_data),
                media_type="audio/wav",
                headers={"Content-Disposition": f"attachment; filename=speech_{lang}.wav"}
            )
        else:
            raise HTTPException(status_code=503, detail="No TTS library available")

    except Exception as e:
        logger.error(f"TTS processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Text-to-speech failed: {str(e)}")

@app.get("/languages")
async def get_supported_languages():
    """Get list of supported languages."""
    return {
        "languages": SUPPORTED_LANGUAGES,
        "total": len(SUPPORTED_LANGUAGES)
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "whisper_available": WHISPER_AVAILABLE,
        "tts_available": TTS_AVAILABLE,
        "gtts_available": GTTS_AVAILABLE,
        "pyttsx3_available": PYTTSX3_AVAILABLE,
        "tts_lib": TTS_LIB,
        "supported_languages": list(SUPPORTED_LANGUAGES.keys())
    }

@app.post("/detect-language")
async def detect_audio_language(file: UploadFile = File(...)):
    """Detect the language of an audio file."""
    if not file:
        raise HTTPException(status_code=400, detail="No audio file provided")

    try:
        audio_data = await file.read()
        detected_lang = detect_language(audio_data)

        return {
            "detected_language": detected_lang,
            "language_name": SUPPORTED_LANGUAGES.get(detected_lang, {}).get("name", "Unknown"),
            "confidence": 0.8  # Placeholder confidence
        }

    except Exception as e:
        logger.error(f"Language detection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Language detection failed: {str(e)}")

@app.post("/stt")
async def speech_to_text(
    file: UploadFile = File(...),
    lang: Optional[str] = Form(None),
    use_auto_detection: bool = Form(True)
):
    if not file:
        raise HTTPException(status_code=400, detail="No audio file provided")

    try:
        audio_data = validate_and_convert_audio(file)

        if not lang or use_auto_detection:
            detected_lang = detect_language(audio_data)
            if not lang:
                lang = detected_lang
            logger.info(f"Using language: {sanitize_for_log(lang)} (detected: {sanitize_for_log(detected_lang)})")

        if lang not in SUPPORTED_LANGUAGES:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {lang}")

        audio_array = preprocess_audio(audio_data)

        model = get_whisper_model(lang)

        logger.info(f"Transcribing audio with Whisper ({lang})")
        result = model.transcribe(audio_array, language=lang if lang != "en" else None)

        transcription = result["text"].strip()
        confidence = result.get("confidence", 0.8)

        logger.info(f"Transcription completed: {sanitize_for_log(str(transcription[:100]))}...")

        return {
            "text": transcription,
            "language": lang,
            "confidence": confidence,
            "detected_language": detect_language(audio_data) if use_auto_detection else lang
        }

    except Exception as e:
        logger.error(f"STT processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Speech-to-text failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Real-time WebSocket support for streaming audio transcription

executor = ThreadPoolExecutor(max_workers=2)

async def transcribe_audio_stream(websocket: WebSocket):
    await websocket.accept()
    buffer = bytearray()
    try:
        while True:
            data = await websocket.receive_bytes()
            buffer.extend(data)
            # For demonstration, transcribe every 5 seconds of audio
            if len(buffer) > 16000 * 2 * 5:  # 5 seconds of 16kHz 16-bit audio
                audio_array = preprocess_audio(bytes(buffer))
                model = get_whisper_model("en")  # For streaming, use English base model
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(executor, model.transcribe, audio_array)
                transcription = result["text"].strip()
                await websocket.send_text(transcription)
                buffer.clear()
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=1011, reason=str(e))

@app.websocket("/ws/stt")
async def websocket_stt_endpoint(websocket: WebSocket):
    await transcribe_audio_stream(websocket)

# Improved audio preprocessing with noise reduction and normalization

def enhanced_preprocess_audio(audio_data: bytes) -> np.ndarray:
    try:
        audio_segment = AudioSegment.from_file(io.BytesIO(audio_data))
        if audio_segment.channels == 2:
            audio_segment = audio_segment.set_channels(1)
        audio_segment = audio_segment.set_frame_rate(16000)
        samples = np.array(audio_segment.get_array_of_samples()).astype(np.float32)
        samples /= np.max(np.abs(samples))  # Normalize to -1 to 1
        # Noise reduction
        reduced_noise = nr.reduce_noise(y=samples, sr=16000)
        # Additional normalization
        normalized = reduced_noise / np.max(np.abs(reduced_noise))
        return normalized
    except Exception as e:
        logger.error(f"Enhanced audio preprocessing failed: {e}")
        raise HTTPException(status_code=400, detail=f"Enhanced audio preprocessing failed: {str(e)}")

# Override the existing preprocess_audio function with enhanced version
preprocess_audio = enhanced_preprocess_audio

# Audio format validation and conversion utility

def validate_and_convert_audio(file: UploadFile) -> bytes:
    try:
        contents = file.file.read()
        audio_segment = AudioSegment.from_file(io.BytesIO(contents))
        # Convert to WAV 16kHz mono if not already
        if audio_segment.channels != 1 or audio_segment.frame_rate != 16000:
            audio_segment = audio_segment.set_channels(1).set_frame_rate(16000)
        buffer = io.BytesIO()
        audio_segment.export(buffer, format="wav")
        return buffer.getvalue()
    except Exception as e:
        logger.error(f"Audio validation/conversion failed: {e}")
        raise HTTPException(status_code=400, detail=f"Audio validation/conversion failed: {str(e)}")


