# inference_api.py

import faiss
import torch
from flask import Flask, request, jsonify
from pyngrok import ngrok
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForCausalLM
from sentence_transformers import SentenceTransformer
from googletrans import Translator

# Paths
model_save_path = "/content/drive/MyDrive/Major_Project/SERVICE_SAATHI_v0.1/Chatbot_API/Service_Saathi_v0.2"
faiss_index_path = "/content/drive/MyDrive/Major_Project/SERVICE_SAATHI_v0.1/Chatbot_API/faiss_index.idx"
dataset_json_path = "/content/drive/MyDrive/Major_Project/SERVICE_SAATHI_v0.1/Chatbot_API/qa_dataset.json"

# Load model & tokenizer
tokenizer = AutoTokenizer.from_pretrained(model_save_path, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(model_save_path, torch_dtype=torch.float16, trust_remote_code=True).to("cuda")

# Load FAISS index and dataset
index = faiss.read_index(faiss_index_path)
dataset = Dataset.from_json(dataset_json_path)
all_qa_pairs = list(dataset)

embedder = SentenceTransformer('all-MiniLM-L6-v2')
translator = Translator()

app = Flask(__name__)

@app.route("/generate", methods=["POST"])
def generate_response():
    data_in = request.get_json()
    query = data_in.get("query", "")
    do_translate = data_in.get("translate", False)
    mode = data_in.get("mode", "").upper()

    if not query:
        return jsonify({"error": "No query provided."}), 400

    query_embedding = embedder.encode([query], convert_to_tensor=False).astype('float32')
    distances, indices = index.search(query_embedding, 1)
    idx = int(indices[0][0])
    match = all_qa_pairs[idx]

    if "document" in query.lower() and "required" in query.lower():
        answer = match["response"]
    else:
        simplified_context = f"Service: {match['prompt'].split('?')[0].split()[-1]} | Description: {match['response'].splitlines()[1].replace('**Description:** ', '')}"
        final_prompt = (
            "You are a helpful assistant for Akshaya services. Answer the query using complete, natural sentences.\n\n"
            f"Example: {simplified_context}\n\n"
            f"Now, answer the query: {query}\nFinal Answer:"
        )
        inputs = tokenizer(final_prompt, return_tensors="pt", truncation=True, max_length=256).to("cuda")
        output_ids = model.generate(**inputs, max_new_tokens=150)
        answer = tokenizer.decode(output_ids[0], skip_special_tokens=True)
        if "Final Answer:" in answer:
            answer = answer.split("Final Answer:")[-1].strip()

    if do_translate and mode:
        try:
            if mode == "ENG-MAL":
                answer = translator.translate(answer, src='en', dest='ml').text
            elif mode == "MAL-ENG":
                answer = translator.translate(answer, src='ml', dest='en').text
        except Exception as e:
            return jsonify({"error": f"Translation failed: {str(e)}"}), 500

    return jsonify({"response": answer})

@app.route('/translate', methods=['POST'])
def translate_text():
    data = request.get_json()
    text = data.get("text", "")
    mode = data.get("mode", "").upper()

    if not text or not mode:
        return jsonify({"response": "Invalid input"}), 400
    try:
        if mode == "ENG-MAL":
            translated = translator.translate(text, src='en', dest='ml')
        elif mode == "MAL-ENG":
            translated = translator.translate(text, src='ml', dest='en')
        else:
            return jsonify({"response": "Invalid mode"}), 400
        return jsonify({"response": translated.text})
    except Exception as e:
        return jsonify({"response": f"Error: {str(e)}"}), 500

# Start Ngrok
ngrok.set_auth_token("2fAWju1W5uWzDMOGnTmlwVVrMsP_2tntM3dHVYMqXquuRGkUS")  # Replace with yours
public_url = ngrok.connect(5000)
print(f"🌐 Public URL: {public_url.public_url}")

app.run(host="0.0.0.0", port=5000, use_reloader=False)
