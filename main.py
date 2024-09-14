from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import io
import os
from groq import Groq
import dotenv

dotenv.load_dotenv()

app = FastAPI()

# Initialize Groq client
client = Groq(api_key=os.environ["GROQ_API_KEY"])


async def transcribe_audio_stream(audio_chunk):
    try:
        transcription = client.audio.transcriptions.create(
            file=audio_chunk,
            model="distil-whisper-large-v3-en",
            response_format="text",
            language="en",
        )
        return transcription
    except Exception as e:
        print(f"Error in transcription: {e}")
        return ""


def summarize(old_summary, text_chunks, conciseness=0):
    if conciseness == 0:
        change_consiceness = ""
    else:
        change_consiceness = f"Make this chunk {'less' if conciseness > 0 else 'more'} detailed."
    
    prev_summary = "Previous summary: " + old_summary if old_summary else ""

    completion = client.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": f"You are a summarizer who summarizes texts succinctly.",
            },
            {
                "role": "user",
                "content": f"{prev_summary}. Please update the summary concisely with the following new text {' '.join(text_chunks)}. {change_consiceness}. Do not tell me that this is the summary, just give the summary.",
            }
        ],
        model="llama3-8b-8192",
    )

    content = completion.choices[0].message.content

    return content


texts = []
last_seen = 0
curr_summary = ""


@app.post("/api/transcribe")
async def upload_audio(file: UploadFile = File(...)):
    # TODO: segment the audio stuffs
    audio_data = await file.read()
    audio_io = io.BytesIO(audio_data)
    audio_io.name = "audio.wav"  # Groq API requires a filename

    transcription = await transcribe_audio_stream(audio_io)
    texts.append(transcription)

    return JSONResponse(content={"transcription": transcription})


@app.get("/api/summarize")
async def summarize_audio():
    global texts
    global curr_summary
    global last_seen

    if len(texts) == 0:
        return JSONResponse(content={"summary": "No transcriptions available"})

    curr_summary = summarize(curr_summary, texts[last_seen:])
    last_seen = len(texts)

    return JSONResponse(content={"summary": curr_summary})

# To run the server, use: uvicorn script_name:app --reload

# import uvicorn
# uvicorn.run(app, host="0.0.0.0", port=8080)
