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
        change_consiceness = f"I want this new chunk to be {'less' if conciseness > 0 else 'more'} detailed"
    
    prev_summary = "Previous summary: " + old_summary if old_summary else ""

    completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": f"{prev_summary}. Please update the summary concisely with the following new text {' '.join(text_chunks)}. {change_consiceness}",
            }
        ],
        model="llama3-8b-8192",
    )

    content = completion.choices[0].message.content

    return content  # TODO: remove the assistant helper messages


texts = []
curr_summary = ""


@app.post("/api/transcribe")
async def upload_audio(file: UploadFile = File(...)):
    global texts
    global curr_summary

    # TODO: segment the audio stuffs
    audio_data = await file.read()
    audio_io = io.BytesIO(audio_data)
    audio_io.name = "audio.wav"  # Groq API requires a filename

    transcription = await transcribe_audio_stream(audio_io)
    texts.append(transcription)

    return JSONResponse(content={"transcription": transcription})


@app.get("/api/summarize")
async def summarize():
    global texts
    global curr_summary

    curr_summary = summarize(curr_summary, texts[-1:])

    return JSONResponse(content={"summary": curr_summary})

# To run the server, use: uvicorn script_name:app --reload
