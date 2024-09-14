from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import io
import os
from groq import Groq

app = FastAPI()

# Initialize Groq client
client = Groq(api_key=os.environ["GROQ_API_KEY"])

async def transcribe_audio_stream(audio_chunk):
    try:
        transcription = client.audio.transcriptions.create(
            file=audio_chunk,
            model="distil-whisper-large-v3-en",
            response_format="text",
            language="en"
        )
        return transcription
    except Exception as e:
        print(f"Error in transcription: {e}")
        return ""

@app.post("/api/transcribe")
async def upload_audio(file: UploadFile = File(...)):
    audio_data = await file.read()
    audio_io = io.BytesIO(audio_data)
    audio_io.name = "audio.wav"  # Groq API requires a filename

    transcription = await transcribe_audio_stream(audio_io)
    return JSONResponse(content={"transcription": transcription})

# To run the server, use: uvicorn script_name:app --reload