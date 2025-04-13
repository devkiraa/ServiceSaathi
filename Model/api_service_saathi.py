import os
import torch
import faiss
from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForCausalLM
from datasets import Dataset
from sentence_transformers import SentenceTransformer
from googletrans import Translator
from pyngrok import ngrok

# -------------------------
# Google Drive Authentication Setup using PyDrive
# -------------------------
from pydrive.auth import GoogleAuth
from pydrive.drive import GoogleDrive

def authenticate_drive():
    """
    Authenticates and returns a PyDrive GoogleDrive instance.
    Make sure that your client_secrets.json file is available locally.
    """
    gauth = GoogleAuth()
    # This will open a local webserver and prompt you to login to your Google account.
    gauth.LocalWebserverAuth()  
    drive = GoogleDrive(gauth)
    return drive

def download_file_from_drive(drive, file_id, destination):
    """
    Downloads a file from Google Drive using its file ID.
    """
    if not os.path.exists(destination):
        print(f"Downloading {destination} from Google Drive...")
        file_obj = drive.CreateFile({'id': file_id})
        file_obj.GetContentFile(destination)
    else:
        print(f"{destination} already exists, skipping download.")

# -------------------------
# Set file paths and Google Drive File IDs (update these IDs with your own)
# -------------------------
# Local paths – adjust as necessary for your project structure.
model_path = "/content/drive/MyDrive/Major_Project/SERVICE_SAATHI/Chatbot_API/Service_Saathi_v0.2"  # Assumes model folder exists locally
faiss_index_path = "/content/drive/MyDrive/Major_Project/SERVICE_SAATHI/Chatbot_API/faiss_index.idx"
qa_dataset_path = "/content/drive/MyDrive/Major_Project/SERVICE_SAATHI/Chatbot_API/qa_dataset.json"

# Google Drive file IDs for files that need to be downloaded.
# Replace the following strings with your actual file IDs.
FAISS_INDEX_FILE_ID = "1VcWaWWRp7G4i6ftALQKxvl40pvVtshoS"
QA_DATASET_FILE_ID = "1VcWaWWRp7G4i6ftALQKxvl40pvVtshoS"

# -------------------------
# Authenticate and download necessary files from Google Drive (if they don't exist locally)
# -------------------------
drive = authenticate_drive()
download_file_from_drive(drive, FAISS_INDEX_FILE_ID, faiss_index_path)
download_file_from_drive(drive, QA_DATASET_FILE_ID, qa_dataset_path)

# -------------------------
# Load Model and Data
# -------------------------
tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    model_path, trust_remote_code=True, torch_dtype=torch.float16
).to("cuda")

embedder = SentenceTransformer("all-MiniLM-L6-v2")
index = faiss.read_index(faiss_index_path)
dataset = Dataset.from_json(qa_dataset_path)
qa_data = list(dataset)

translator = Translator()
app = Flask(__name__)

# -------------------------
# Flask Endpoints
# -------------------------
@app.route("/generate", methods=["POST"])
def generate():
    try:
        data = request.get_json()
        query = data.get("query", "")
        translate = data.get("translate", False)
        mode = data.get("mode", "").upper()

        if not query:
            return jsonify({"error": "No query provided"}), 400

        # Translate input if Malayalam to English
        if translate and mode == "MAL-ENG":
            query = translator.translate(query, src='ml', dest='en').text

        # Get top 5 semantic matches using the embedder and FAISS index
        query_vec = embedder.encode([query], convert_to_tensor=False).astype("float32")
        distances, indices = index.search(query_vec, 5)

        # Filter out generic questions and choose best result with keyword match
        best_match = None
        for i in indices[0]:
            candidate = qa_data[int(i)]
            if "Service name" in candidate["prompt"] or "document" in candidate["prompt"].lower():
                best_match = candidate
                break

        # If no specific match is found, fallback to top-1 match
        if not best_match:
            best_match = qa_data[int(indices[0][0])]

        # Construct natural instruction-style prompt
        final_prompt = (
            "You are an expert assistant on Akshaya services. "
            "Answer user queries naturally based on the given prompt-response data.\n\n"
            f"Context:\nPrompt: {best_match['prompt']}\nResponse: {best_match['response']}\n\n"
            f"User Query: {query}\nAnswer:"
        )

        inputs = tokenizer(final_prompt, return_tensors="pt", truncation=True, max_length=512).to("cuda")
        output = model.generate(**inputs, max_new_tokens=200)
        answer = tokenizer.decode(output[0], skip_special_tokens=True)

        # Clean up answer if needed
        if "Answer:" in answer:
            answer = answer.split("Answer:")[-1].strip()

        # Translate back if requested (from English to Malayalam)
        if translate and mode == "ENG-MAL":
            answer = translator.translate(answer, src='en', dest='ml').text

        return jsonify({"response": answer})

    except Exception as e:
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500

@app.route("/translate", methods=["POST"])
def translate_text():
    try:
        data = request.get_json()
        text = data.get("text", "")
        mode = data.get("mode", "").upper()
        if not text or not mode:
            return jsonify({"response": "Invalid input"}), 400

        translated = translator.translate(
            text,
            src='en' if mode == "ENG-MAL" else 'ml',
            dest='ml' if mode == "ENG-MAL" else 'en'
        )
        return jsonify({"response": translated.text})
    except Exception as e:
        return jsonify({"response": f"Error: {str(e)}"}), 500

# -------------------------
# Start the Server with ngrok for public URL exposure
# -------------------------
if __name__ == "__main__":
    # Set ngrok auth token (replace with your token if needed)
    ngrok.set_auth_token("2fAWju1W5uWzDMOGnTmlwVVrMsP_2tntM3dHVYMqXquuRGkUS")
    public_url = ngrok.connect(5000).public_url
    print(f"🔗 Public URL: {public_url}")
    
    # Run the Flask app on all interfaces, port 5000
    app.run(host="0.0.0.0", port=5000)
