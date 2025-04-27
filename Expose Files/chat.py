# combined_api_full_csv_by_index_v3.py
# >>> Accesses CSV by Index
# >>> Auto Detects EN/ML, Handles Specific Queries (No Greeting), Translate Placeholders <<<
# >>> Includes /ping endpoint <<<

import pandas as pd
import json
import os
from dotenv import load_dotenv
import sys
import requests # Using requests library for synchronous API call
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field # Field for default values
from typing import Optional # For optional request fields
import uvicorn
from langdetect import detect, LangDetectException # For language detection

# --- Configuration ---
load_dotenv() # Load .env file if present for API key
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyA-8j_gcxD5-BVx680IwwI0lQU3ufoi_GE") # Use Env Var or placeholder

# --- CSV Configuration ---
CSV_FILE_PATH = 'akshya_services.csv' # !!! UPDATE PATH IF NEEDED !!!
EXPECTED_COLUMN_COUNT = 7 # Service name, Desc, Docs, Cost, Time, Validity, Eligibility

# --- Gemini Model Configuration ---
GEMINI_MODEL_NAME = "gemini-2.0-flash"
GEMINI_API_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL_NAME}:generateContent"

# --- Base System Prompt ---
# >>> UPDATED Prompt: Stricter rules for specific answers vs greetings <<<
BASE_SYSTEM_PROMPT = """
You are **Service Saathi**, a friendly, polite, and helpful AI assistant. Your purpose is to provide information about **Akshaya services** available in India, based *only* on the full dataset provided below.

**Your Persona:** You are knowledgeable *only within the provided dataset*, patient, and focused on helping users by accurately extracting requirements and details for accessing these services from the provided text. Your name is Service Saathi.

**Your Knowledge & Capabilities:**

1.  **Specific Akshaya Service Details:** Your *only* source of knowledge for specific services is the **'Full Service Dataset Provided' section** included later in this prompt. You must search within this section to find service details. This dataset contains entries with (Column Number -> Content Type):\n    * 1 -> Service Name\n    * 2 -> Description\n    * 3 -> Required Documents\n    * 4 -> Cost / Rates\n    * 5 -> Time Required (Processing Time)\n    * 6 -> Validity (if applicable)\n    * 7 -> Eligibility Criteria
2.  **General Conversation:** You can handle basic greetings (Hi, Hello) and answer questions about yourself (Who are you?, What is your name?, How can you help?).
3.  **Basic General Knowledge:** You might possess some general knowledge, but do *not* use it for answering specific Akshaya service details – rely *only* on the provided dataset.

**How to Respond:**

1.  **User asks about a Specific Akshaya Service:**
    * **Search carefully** through the **entire 'Full Service Dataset Provided' section below.** Locate the specific service entry where the first column value (Service Name) best matches the service mentioned in the user's query.
    * **If NO clear match for the service name is found:** Respond using the 'Service Not Found' logic (Point 3).
    * **If a clear match IS found:**
        * **Check if the user asked for a SPECIFIC DETAIL:** Look for keywords in the User Query like 'cost', 'fee', 'rate', 'documents', 'papers', 'time', 'duration', 'validity', 'eligible', 'who can apply', 'process', 'steps'.
        * **If a specific detail WAS asked for:** Extract *only* that specific detail from the corresponding column for the matched service entry.
            * If the detail exists and is not 'Not Available' -> Provide *only* that detail, starting directly with the information (e.g., "The cost for [Service Name] is [Value from column 4].").
            * If the detail is 'Not Available' -> Respond: "I found the service '[Service Name]', but the specific detail '[requested detail]' is listed as 'Not Available' in my dataset."
        * **If the user asked generally (e.g., "details about...", "tell me about...") OR if unsure:** Format a response with *all* available details using the template below. Start the response *directly* with the template.
            ```
            **Service:** [Value from 1st column]
            **Description:** [Value from 2nd column]
            **Required Documents:** [Value from 3rd column]
            **Cost:** [Value from 4th column]
            **Time Required:** [Value from 5th column]
            **Validity:** [Value from 6th column]
            **Eligibility Criteria:** [Value from 7th column]
            ```
        * **CRITICAL:** When answering a specific service query (either a specific detail or the full template), **DO NOT add any introductory greetings** like "Hello!", "I can help with that...", etc. Respond *only* with the requested information.
2.  **User asks a General Question (Greetings, Identity, Capabilities):**
    * **This is the ONLY case where you use conversational greetings/responses.**
    * **If the user says "Hi" or "Hello"** -> Respond: "Hello! I’m here to help you with information about Akshaya services and their document requirements."
    * **If the user asks "Who are you?" or "What is your name?"** -> Respond: "I am Service Saathi, your AI-powered assistant for Akshaya services."
    * **If the user asks "How can you help me?" or "What can you do?"** -> Respond: "I can provide detailed information about the required documents, processing time, cost, and eligibility for various Akshaya services, based on the dataset provided to me."
3.  **User asks an Out-of-Scope or Unknown Query (or service not found in provided data):**
    * If you cannot find the requested service within the **entire 'Full Service Dataset Provided' section below**, politely state that.
    * Example response: \"I apologize, I couldn't find specific details for '[User's Requested Service]' in the service dataset provided to me right now. Please ensure you've asked about a service included in the list. How else may I assist you?\"

**Important Notes:**

* Always be polite and helpful *within the defined response structures*.
* **CRITICAL: Rely *strictly and solely* on the 'Full Service Dataset Provided' section below for specific service details.** Do not invent details.
* Use the current date (Sunday, April 27, 2025 at 01:14 PM IST) and location context (India) if relevant.

---
"""

# --- Helper Functions ---
service_data_cache = None

def load_csv_data(filepath):
    """Loads CSV, validates column *count*, cleans data, and caches it."""
    global service_data_cache
    if service_data_cache is not None:
        return service_data_cache
    print(f"Loading CSV data from: {filepath}...")
    try:
        df = pd.read_csv(filepath, header=0)
        df = df.fillna("Not Available")
        if df.shape[1] < EXPECTED_COLUMN_COUNT:
            print(f"Error: CSV has {df.shape[1]} columns, expected at least {EXPECTED_COLUMN_COUNT}.")
            return None
        service_data_cache = df
        print(f"CSV data loaded and cached ({len(df)} records, {df.shape[1]} columns).")
        return df
    except FileNotFoundError:
        print(f"Error: CSV file not found at {filepath}")
        return None
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return None

def format_full_csv_context(df):
    """Formats the *entire* DataFrame into one large text block using column indices."""
    if df is None or df.empty:
        return "\n\n---\nFull Service Dataset Provided:\n[No Data Available]\n---"
    # (Formatting logic remains the same)
    context_str = "\n\n---\nFull Service Dataset Provided:\n"
    context_str += "[START OF DATASET]\n"
    for index, row in df.iterrows():
        try:
            service_name = str(row.iloc[0]); description = str(row.iloc[1])
            documents = str(row.iloc[2]); cost = str(row.iloc[3])
            time_req = str(row.iloc[4]); validity = str(row.iloc[5])
            eligibility = str(row.iloc[6])
            context_str += (
                f"\n--- Service Entry {index+1} ---\n"
                f"Service Name: {service_name}\n"
                f"Description: {description}\n"
                f"Required Documents: {documents}\n"
                f"Cost: {cost}\n"
                f"Time Required: {time_req}\n"
                f"Validity: {validity}\n"
                f"Eligibility Criteria: {eligibility}\n"
            )
        except IndexError: continue
        except Exception as e: continue
    context_str += "\n[END OF DATASET]\n---"
    return context_str

def construct_final_prompt_with_full_context(base_prompt, full_context_str, user_query):
    """Combines base prompt, the *full* CSV context, and final instruction."""
    # Updated final instruction to be even clearer about flow
    final_instruction = f"\n\n---\n\n**Now, process the following user query based *only* on the instructions above and the 'Full Service Dataset Provided' section. Follow these steps:\n1. Check if the User Query is a general query (Hi, Who are you?, How can you help?). If yes, use the predefined general response from instruction point 2 and STOP.\n2. If not a general query, search the 'Full Service Dataset Provided' section for the requested service name (match query against 'Service Name' in first column).\n3. If the service is found, determine if a specific detail was asked for (cost, documents, time, etc.). Provide ONLY that specific detail OR state if it's 'Not Available'. If the query was general (e.g., 'details'), provide the full structured response for the found service. Do NOT add any greetings.\n4. If the service itself is not found in the dataset, use the out-of-scope response from instruction point 3.**\n\nUser Query: {user_query}"
    return base_prompt + full_context_str + final_instruction

# --- Translation Placeholder Function ---
# !!! REPLACE THIS WITH ACTUAL TRANSLATION API CALLS (e.g., using google-cloud-translate) !!!
def translate_text(text: str, target_language: str, source_language: Optional[str] = None) -> str:
    """Placeholder for translation."""
    print(f"--- TRANSLATION PLACEHOLDER ---")
    if text and target_language:
        print(f"--- Would translate '{text[:100]}...' from '{source_language or 'auto'}' to '{target_language}' ---")
    else:
        print("--- Translation skipped (invalid input) ---")
    # Return original text for placeholder behavior
    return text
# !!! END OF PLACEHOLDER !!!

# --- FastAPI App Definition ---
app = FastAPI(title="Service Saathi API v3 (Auto Lang Detect, Specific Ans, Translate Placeholder)")

# --- Input/Output Models ---
class GenerateRequest(BaseModel):
    # Removed translate/mode, now uses auto-detection
    query: str

class GenerateResponse(BaseModel):
    response: str # Final response to the user (potentially translated)
    detected_query_language: Optional[str] = None # For info
    response_language: Optional[str] = None # For info

# --- API Endpoint ---
@app.post("/generate", response_model=GenerateResponse)
async def generate_message(request: GenerateRequest):
    user_query_original = request.query
    print(f"Received query: '{user_query_original}'")

    query_lang = "en" # Default
    response_lang = "en"
    query_for_llm = user_query_original

    # --- Auto Language Detection ---
    try:
        # Only detect if query is reasonably long to avoid errors
        if user_query_original and len(user_query_original) > 5:
             detected_lang = detect(user_query_original)
             print(f"Detected language: {detected_lang}")
             if detected_lang == 'ml':
                 query_lang = 'ml'
                 response_lang = 'ml' # Respond in the detected language
             # Add other language detections here if needed (e.g., 'hi' for Hindi)
             # else: assume English or handle other languages

        else:
             print("Query too short for reliable language detection, assuming English.")

    except LangDetectException:
        print("Language detection failed, assuming English.")
        query_lang = "en" # Default to English if detection fails
        response_lang = "en"
    except Exception as e:
        print(f"Error during language detection: {e}")
        # Default to English

    # --- Input Translation (Placeholder) ---
    if query_lang != "en":
        print(f"Attempting {query_lang.upper()}->ENG translation (Placeholder)...")
        query_for_llm = translate_text(user_query_original, target_language='en', source_language=query_lang)
        # If translation failed, maybe fallback? For now, we use the potentially untranslated text
        # query_for_llm = query_for_llm or user_query_original # Fallback if translate returns empty

    print(f"Query being processed by LLM (Eng): '{query_for_llm}'")

    # 1. Load CSV / 2. Format Context
    service_df = load_csv_data(CSV_FILE_PATH)
    if service_df is None:
        raise HTTPException(status_code=500, detail=f"Failed to load service data CSV.")
    full_context_block = format_full_csv_context(service_df)

    # 3. Construct Prompt (using English query)
    final_prompt_text = construct_final_prompt_with_full_context(
        BASE_SYSTEM_PROMPT, full_context_block, query_for_llm
    )

    # 4. Prepare Gemini Payload
    gemini_payload = {"contents": [{"parts": [{"text": final_prompt_text}]}]}

    # 5. Call Gemini API
    api_key = GOOGLE_API_KEY
    if not api_key or api_key == "key":
        print("ERROR: Valid Google API Key not found or is placeholder.")
        raise HTTPException(status_code=500, detail="Google API Key not configured correctly.")

    api_url = f"{GEMINI_API_ENDPOINT}?key={api_key}"
    headers = {"Content-Type": "application/json"}

    try:
        print(f"Sending request to Gemini API...")
        response = requests.post(api_url, headers=headers, json=gemini_payload, timeout=180)
        response.raise_for_status()
        response_data = response.json()
        print("Received response from Gemini API.")

        # Extract text safely
        gemini_english_response = "Error: Could not parse response."
        # (Error handling and text extraction logic remains the same)
        if response_data:
            candidates = response_data.get("candidates")
            if candidates and isinstance(candidates, list) and len(candidates) > 0:
                 finish_reason = candidates[0].get("finishReason")
                 if finish_reason == "SAFETY": gemini_english_response = "Response blocked by safety filters."
                 elif finish_reason == "MAX_TOKENS": gemini_english_response = "Response cut off due to length limits."
                 else:
                     content = candidates[0].get("content")
                     if content and isinstance(content, dict):
                         parts = content.get("parts")
                         if parts and isinstance(parts, list) and len(parts) > 0:
                             gemini_english_response = parts[0].get("text", "Error: No text in response part.")
            else: # Check for prompt blockages
                 prompt_feedback = response_data.get("promptFeedback")
                 if prompt_feedback and prompt_feedback.get("blockReason"):
                     block_reason = prompt_feedback.get("blockReason")
                     gemini_english_response = f"Request blocked by safety filters ({block_reason})."
        else: print(f"Warning: Empty response data: {response_data}")

    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Request to AI service timed out.")
    except requests.exceptions.RequestException as e:
        # (Error handling remains the same)
        error_detail=f"Failed to communicate with Gemini API: {e}"; status_code=502
        if e.response is not None: status_code=e.response.status_code if 400<=e.response.status_code<600 else 502
        raise HTTPException(status_code=status_code, detail=error_detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing Gemini response: {e}")

    # --- Output Translation (Placeholder) ---
    final_user_response = gemini_english_response
    if response_lang != "en":
        print(f"Attempting ENG->{response_lang.upper()} translation (Placeholder)...")
        final_user_response = translate_text(gemini_english_response, target_language=response_lang, source_language='en')

    # 6. Return Final Response
    return GenerateResponse(
        response=final_user_response,
        detected_query_language=query_lang, # Report detected lang
        response_language=response_lang # Report target response lang
        )

# --- Health Check Endpoint ---
@app.get("/health")
def health_check():
     # (Same as previous version)
     csv_loaded = "OK" if service_data_cache is not None else "Not Loaded"
     rows, cols = (len(service_data_cache), service_data_cache.shape[1]) if service_data_cache is not None else (0, 0)
     if csv_loaded != "OK" and os.path.exists(CSV_FILE_PATH):
         temp_df = load_csv_data(CSV_FILE_PATH) # Attempt load for health check
         if temp_df is not None: csv_loaded="Loadable"; rows=len(temp_df); cols=temp_df.shape[1]
         else: csv_loaded="Load Failed"
     return {
        "status": "OK", "csv_path": CSV_FILE_PATH, "csv_status": csv_loaded,
        "csv_rows": rows, "csv_columns_found": cols, "expected_columns": EXPECTED_COLUMN_COUNT,
        "gemini_model": GEMINI_MODEL_NAME
     }

# --- Ping Endpoint ---
@app.get("/ping")
def ping():
    """Simple health check endpoint."""
    print("Ping request received.")
    return {"status": "ok", "message": "Service Saathi API is running"}

# --- Main Execution Block ---
if __name__ == "__main__":
    if load_csv_data(CSV_FILE_PATH) is None:
         print("\nFATAL ERROR: Could not load CSV data on startup.")
         sys.exit(1)
    if not GOOGLE_API_KEY or GOOGLE_API_KEY == "key":
        print("\nWARNING: GOOGLE_API_KEY not found or is placeholder 'key'. Set environment variable.")
    print("\n--- Starting Service Saathi API Server v3 ---")
    print(f"--- Mode: Full CSV Context by Index ---")
    print(f"--- Features: Auto Lang Detect (EN/ML), Specific Ans, Translate Placeholders, Ping ---")
    uvicorn.run(app, host="127.0.0.1", port=5600) # Running on port 5600