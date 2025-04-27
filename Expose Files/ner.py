from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.responses import JSONResponse
import os
import re
import json
import base64
import requests
from google.cloud import vision
from google.oauth2 import service_account

app = FastAPI()
# Load credentials and API key from environment or defaults
GOOGLE_CREDENTIALS_PATH = "service_account.json"
GEMINI_API_KEY = "AIzaSyA-8j_gcxD5-BVx680IwwI0lQU3ufoi_GE" 

# Initialize Vision client
def _get_vision_client():
    creds = service_account.Credentials.from_service_account_file(GOOGLE_CREDENTIALS_PATH)
    return vision.ImageAnnotatorClient(credentials=creds)

vision_client = _get_vision_client()

class DocumentRequest(BaseModel):
    document_type: str = None
    base64_image: str

@app.post("/process")
async def process_document(req: DocumentRequest):
    # Decode base64 image
    img_data = req.base64_image
    try:
        if img_data.startswith("data:"):
            img_data = img_data.split(',', 1)[1]
        img_bytes = base64.b64decode(img_data)
    except Exception as e:
        return JSONResponse(status_code=200, content={"detail": f"Invalid base64 image: {e}"})

    # OCR
    try:
        image = vision.Image(content=img_bytes)
        texts = vision_client.text_detection(image=image).text_annotations
        if not texts:
            raise ValueError("No text detected")
        extracted = texts[0].description
    except Exception as e:
        return JSONResponse(status_code=200, content={"detail": f"Vision API: {e}"})

    # Prepare prompt
    hint = req.document_type or ""
    prompt = (
        f"{extracted}\n\n(Optional) Document Type Hint: {hint}\n"  
        "\nYou are an expert data extraction AI. Extract key fields from the text and return a JSON object "
        "with only English letters, numbers, and standard punctuation."
    )

    # Call Gemini
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    )
    try:
        res = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
        res.raise_for_status()
        candidate = res.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        return JSONResponse(status_code=200, content={"detail": f"Gemini API error: {e}"})

    # Parse JSON
    try:
        m = re.search(r"```json\s*(\{.*?\})\s*```", candidate, re.DOTALL)
        j = m.group(1) if m else candidate
        data = json.loads(j)
    except Exception as e:
        return JSONResponse(status_code=200, content={"detail": f"Response parse error: {e}"})

    # Success: return extracted data
    return JSONResponse(status_code=200, content=data)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5601)
