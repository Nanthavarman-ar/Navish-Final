#!/usr/bin/env python3
"""
Test script for STT/TTS backend services
Tests all endpoints and functionality
"""

import requests
import json
import time
import os
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:8000"
TEST_AUDIO_FILE = "test_audio.wav"  # We'll create a simple test audio file

def create_test_audio():
    """Create a simple test audio file for testing"""
    try:
        import numpy as np
        from scipy.io import wavfile

        # Create a simple sine wave
        sample_rate = 16000
        duration = 2  # seconds
        frequency = 440  # A4 note
        t = np.linspace(0, duration, int(sample_rate * duration), False)
        audio = np.sin(frequency * 2 * np.pi * t)

        # Convert to 16-bit PCM
        audio = (audio * 32767).astype(np.int16)

        wavfile.write(TEST_AUDIO_FILE, sample_rate, audio)
        print(f"✓ Created test audio file: {TEST_AUDIO_FILE}")
        return True
    except ImportError:
        print("⚠ scipy or numpy not available, skipping audio creation")
        return False

def test_health_check():
    """Test the health check endpoint"""
    print("\n🔍 Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print("✓ Health check passed")
            print(f"  - Whisper available: {data.get('whisper_available', False)}")
            print(f"  - TTS available: {data.get('tts_available', False)}")
            print(f"  - Supported languages: {len(data.get('supported_languages', []))}")
            return True
        else:
            print(f"✗ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Health check error: {e}")
        return False

def test_supported_languages():
    """Test the languages endpoint"""
    print("\n🌍 Testing supported languages...")
    try:
        response = requests.get(f"{BASE_URL}/languages")
        if response.status_code == 200:
            data = response.json()
            languages = data.get('languages', {})
            print(f"✓ Languages endpoint works - {len(languages)} languages supported")
            # Show a few example languages
            for i, (code, info) in enumerate(list(languages.items())[:3]):
                print(f"  - {code}: {info.get('name', 'Unknown')}")
            return True
        else:
            print(f"✗ Languages endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Languages endpoint error: {e}")
        return False

def test_stt_endpoint():
    """Test the STT endpoint"""
    print("\n🎤 Testing STT endpoint...")
    if not os.path.exists(TEST_AUDIO_FILE):
        print("⚠ No test audio file available, skipping STT test")
        return False

    try:
        with open(TEST_AUDIO_FILE, 'rb') as f:
            files = {'file': ('test.wav', f, 'audio/wav')}
            data = {'lang': 'en', 'use_auto_detection': 'true'}
            response = requests.post(f"{BASE_URL}/stt", files=files, data=data)

        if response.status_code == 200:
            result = response.json()
            print("✓ STT endpoint works")
            print(f"  - Detected text: '{result.get('text', 'N/A')}'")
            print(f"  - Language: {result.get('language', 'N/A')}")
            print(f"  - Confidence: {result.get('confidence', 'N/A')}")
            return True
        else:
            print(f"✗ STT endpoint failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"✗ STT endpoint error: {e}")
        return False

def test_tts_endpoint():
    """Test the TTS endpoint"""
    print("\n🔊 Testing TTS endpoint...")
    try:
        data = {
            'text': 'Hello, this is a test of the text to speech system.',
            'lang': 'en'
        }
        response = requests.post(f"{BASE_URL}/tts", data=data)

        if response.status_code == 200:
            # Check if we got audio data
            content_type = response.headers.get('content-type', '')
            if 'audio' in content_type:
                print("✓ TTS endpoint works - received audio data")
                print(f"  - Content type: {content_type}")
                print(f"  - Content length: {len(response.content)} bytes")
                return True
            else:
                print(f"⚠ TTS endpoint returned non-audio content: {content_type}")
                return False
        else:
            print(f"✗ TTS endpoint failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"✗ TTS endpoint error: {e}")
        return False

def test_language_detection():
    """Test language detection endpoint"""
    print("\n🔍 Testing language detection...")
    if not os.path.exists(TEST_AUDIO_FILE):
        print("⚠ No test audio file available, skipping language detection test")
        return False

    try:
        with open(TEST_AUDIO_FILE, 'rb') as f:
            files = {'file': ('test.wav', f, 'audio/wav')}
            response = requests.post(f"{BASE_URL}/detect-language", files=files)

        if response.status_code == 200:
            result = response.json()
            print("✓ Language detection works")
            print(f"  - Detected language: {result.get('detected_language', 'N/A')}")
            print(f"  - Language name: {result.get('language_name', 'N/A')}")
            return True
        else:
            print(f"✗ Language detection failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Language detection error: {e}")
        return False

def cleanup():
    """Clean up test files"""
    if os.path.exists(TEST_AUDIO_FILE):
        os.remove(TEST_AUDIO_FILE)
        print(f"✓ Cleaned up {TEST_AUDIO_FILE}")

def main():
    """Run all tests"""
    print("🚀 Starting STT/TTS Backend Tests")
    print("=" * 50)

    # Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print("❌ Backend server is not running or not responding")
            print(f"   Make sure the server is running on {BASE_URL}")
            return
    except:
        print("❌ Cannot connect to backend server")
        print(f"   Make sure the server is running on {BASE_URL}")
        print("   Run: cd stt_tts && python app.py")
        return

    # Create test audio
    audio_created = create_test_audio()

    # Run tests
    tests = [
        ("Health Check", test_health_check),
        ("Supported Languages", test_supported_languages),
        ("Language Detection", test_language_detection),
        ("Speech to Text", test_stt_endpoint),
        ("Text to Speech", test_tts_endpoint),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"✗ {test_name} crashed: {e}")
            results.append((test_name, False))

    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)

    passed = 0
    total = len(results)

    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1

    print(f"\n🎯 Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! Backend is ready.")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")

    # Cleanup
    cleanup()

if __name__ == "__main__":
    main()
