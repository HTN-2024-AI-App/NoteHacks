from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import io
import os
from groq import Groq
import dotenv
import numpy as np
import threading
from flask import Flask, jsonify
from groq import Groq
import base64
import cv2
import base64
import requests
import os
import time
from openai import OpenAI
import json

dotenv.load_dotenv()

app = Flask(__name__)

# --- audio_transcription.py ---

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


@app.post("/api/transcribe")
async def upload_audio(file: UploadFile = File(...)):
    audio_data = await file.read()
    audio_io = io.BytesIO(audio_data)
    audio_io.name = "audio.wav"  # Groq API requires a filename

    transcription = await transcribe_audio_stream(audio_io)
    return JSONResponse(content={"transcription": transcription})


# --- facedetection.py -- 

# Load pre-trained Haar cascades for face and eye detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

# Global variable to store the latest result
latest_result = False


def are_eyes_visible(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    for (x, y, w, h) in faces:
        roi_gray = gray[y:y+h, x:x+w]
        eyes = eye_cascade.detectMultiScale(roi_gray)
        if len(eyes) > 0:
            return True
    return False

def face_detection_loop():
    global latest_result
    cap = cv2.VideoCapture(0)  # Use default camera

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        latest_result = are_eyes_visible(frame)
        print(f"LOOKING: {latest_result}")


    cap.release()

@app.route('/face_detection', methods=['GET'])
def get_latest_result():
    return jsonify({"res": latest_result})


# starting thread
camera_thread = threading.Thread(target=face_detection_loop)
camera_thread.daemon = True  # Set as a daemon thread so it will close when the main program exits
camera_thread.start()
# ----- End of facedetection.py -----



latest_result_2 = False

# Function to encode the image
def encode_image(image_array):
    _, buffer = cv2.imencode('.jpg', image_array)
    return base64.b64encode(buffer).decode('utf-8')

def capture_and_query_chatgpt(prompt, image_base64, model="gpt-4o", max_tokens=300):
    # Initialize the OpenAI client
    client = OpenAI()

    # Prepare the messages for the API request
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}"
                    }
                }
            ]
        }
    ]

    try:
        # Send the request to the ChatGPT API
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens
        )

        # Return the content of the response
        return response.choices[0].message.content
    except Exception as e:
        return f"Error: {str(e)}"


def query_groq(prompt, base64_image):

    client = Groq()

    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}",
                        },
                    },
                ],
            }
        ],
        model="llava-v1.5-7b-4096-preview",
    )
    response_content = chat_completion.choices[0].message.content

    try:
        response_json = json.loads(response_content)
    except json.JSONDecodeError as e:
        # Handle cases where the content is not valid JSON
        print(e)
        print(response_content)
        response_json = {"error": "Invalid JSON response"}

    return response_json

def gesture_loop():
    global latest_result_2
    cap = cv2.VideoCapture(0)  # Use default camera

    prompt = """Analyze the image and provide a JSON string with the following information:
    1. Determine if the person in the image has their hands positioned together in a gesture resembling prayer. This includes recognizing situations where:
       - The hands may be partially visible, possibly being cut off by the edges of the image.
       - The hands are joined or touching in a manner that resembles a prayer position, where the palms or fingers are pressed together.
    2. Identify if there is a flat horizontal palm visible in the image.
    3. Detect if there is a closed fist present in the image.
    4. Recognize if there is a hand gesture resembling a stop sign (palm facing forward with fingers extended).

    Please ensure that your analysis considers various possible orientations and positions of the hands to accurately detect these gestures.

    Return the results in the following JSON format:
    {
        "handsPrayer": true or false,
        "flatPalm": true or false,
        "fist": true or false,
        "stopSign": true or false
    }

    Ensure that the JSON string strictly adheres to this format and contains no additional text, escape characters, or deviations from the specified format."""

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Show the image in a window
        # cv2.imshow('Camera Feed', frame)
        
        # Capture and query Groq
        base64_image = encode_image(frame)
        latest_result_2 = capture_and_query_chatgpt(prompt, base64_image)
        print("PRAYING", latest_result_2)

    
    cap.release()
    cv2.destroyAllWindows()


@app.route('/praying', methods=['GET'])
def get_latest_result_2():
    return jsonify({"res": latest_result_2})

# starting thread
camera_thread = threading.Thread(target=gesture_loop)
camera_thread.daemon = True  # Set as a daemon thread so it will close when the main program exits
camera_thread.start()
# -- End of gesturedetection.py --



if __name__ == "__main__":
    app.run(port=5000)


# To run the server, use: uvicorn script_name:app --reload
