### MARKDOWN
 Because this is a fresh notebook, I have to reinstall Unsloth, Whisper, and Gradio. I also mount Google Drive immediately. I wrapped the Drive mount in a check so it doesn't throw annoying errors if I accidentally run the cell twice.

### CODE
from google.colab import drive
drive.mount('/content/drive')

### CODE
import os

# 1. Mount Drive securely
from google.colab import drive
if not os.path.exists('/content/drive/MyDrive'):
    print("Mounting Google Drive...")
    drive.mount('/content/drive')
else:
    print("Google Drive is already mounted.")

# 2. Install required dependencies
print("Installing Unsloth, Whisper, and Gradio...")
!pip install unsloth
!pip install --no-deps xformers trl peft accelerate bitsandbytes
# FIX: Swapped standard openai-whisper for faster-whisper to allow INT8 memory compression!
!pip install faster-whisper gradio
!sudo apt-get install ffmpeg -y
print("Environment setup complete.")

### MARKDOWN
 I have upgraded this pipeline to use the massive 9-Billion parameter Gemma model for maximum linguistic accuracy. To make this notebook "Run All" friendly, I wrote logic to check if my trained weights already exist in Google Drive. If they do, it instantly loads my custom brain so I don't have to train again. If they don't, it loads the base Gemma 9B model and attaches blank LoRA adapters ready for learning.

### CODE
from unsloth import FastLanguageModel
import torch
import os

max_seq_length = 2048
dtype = None
save_path = "/content/drive/MyDrive/ph_stutter_smoother_lora"

# Check if we already trained the model previously
if os.path.exists(save_path):
    print(f"Found trained weights at {save_path}!")
    print("Loading custom 9B model...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = save_path,
        max_seq_length = max_seq_length,
        dtype = dtype,
        load_in_4bit = True,
    )
    is_trained = True
    print("✅ Custom trained model loaded successfully.")
else:
    print("No trained weights found. Downloading quantized base Gemma 9B model (Best Accuracy)...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        # FIX: Pointing to the exact, official pre-quantized 4-bit HuggingFace repo to prevent 404 errors
        model_name = "unsloth/gemma-2-9b-it-bnb-4bit",
        max_seq_length = max_seq_length,
        dtype = dtype,
        load_in_4bit = True,
    )

    # Apply blank LoRA adapters
    model = FastLanguageModel.get_peft_model(
        model,
        r = 16,
        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj",
                          "gate_proj", "up_proj", "down_proj"],
        lora_alpha = 16,
        lora_dropout = 0,
        bias = "none",
        use_gradient_checkpointing = "unsloth",
        random_state = 3407,
    )
    is_trained = False
    print("✅ Base 9B model loaded and blank LoRA adapters successfully attached.")

### MARKDOWN
I can't just blindly feed a CSV into the trainer. If the generation script failed or the columns got messed up, the trainer will crash cryptically. I wrote strict guardrails here to verify the file exists, ensure the required columns are present, and drop any corrupted rows.

### CODE
import pandas as pd
from datasets import Dataset
import gc

if is_trained:
    print("✅ Model is already trained! Skipping dataset loading.")
else:
    csv_path = '/content/drive/MyDrive/my_dataset.csv'

    # GUARDRAIL 1: Check if file exists
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CRITICAL ERROR: Cannot find {csv_path}. Did you finish the dataset generation phase?")

    print("Loading dataset from Drive...")
    try:
        df = pd.read_csv(csv_path, on_bad_lines='skip')
    except Exception as e:
        raise RuntimeError(f"CRITICAL ERROR: Failed to read the CSV file. Details: {e}")

    # GUARDRAIL 2: Verify column integrity
    if 'input' not in df.columns or 'output' not in df.columns:
        raise ValueError("CRITICAL ERROR: The CSV is missing 'input' or 'output' columns. Please check the dataset format.")

    # GUARDRAIL 3: Clean corrupted data
    initial_row_count = len(df)
    df = df.dropna(subset=['input', 'output'])
    dropped_rows = initial_row_count - len(df)
    if dropped_rows > 0:
        print(f"Warning: Dropped {dropped_rows} corrupted or empty rows from the dataset.")

    if df.empty:
        raise ValueError("CRITICAL ERROR: The dataset is completely empty after cleaning. Cannot proceed with training.")

    raw_data = df.to_dict(orient="records")

    # Formatting to match Gemma's expected chat structure
    # ADDED: Explicitly telling the AI to expect Tagalog, Bisaya, and English mixtures.
    prompt_template = """<start_of_turn>user
You are an expert editor. Clean this raw Philippine speech transcript by removing stutters, false starts, and local filler words (ano, kuan, bale) while preserving the original meaning.
The text may be in Tagalog, Bisaya, English, or a mixture of the three. Keep the original language mixture intact.

Transcript: {input}<end_of_turn>
<start_of_turn>model
{output}<end_of_turn>"""

    def format_dataset(examples):
        texts = []
        for i, o in zip(examples["input"], examples["output"]):
            text = prompt_template.format(input=i, output=o) + tokenizer.eos_token
            texts.append(text)
        return {"text": texts}

    dataset = Dataset.from_list(raw_data)
    formatted_dataset = dataset.map(format_dataset, batched=True)

    # OPTIMIZATION: Delete intermediate data structures to instantly free up CPU RAM
    del df, raw_data, dataset
    gc.collect()

    print(f"Successfully validated, loaded, and formatted training pairs.")

### MARKDOWN
This is the riskiest part of the pipeline. Because I upgraded to the massive 9B model, I lowered the per_device_train_batch_size to 1 and increased the gradient accumulation to 8. This guarantees it will still fit comfortably inside the free T4 GPU's 15GB VRAM limit without triggering an Out-of-Memory (OOM) crash during backpropagation.

### CODE
import gc
from trl import SFTTrainer
from transformers import TrainingArguments

if is_trained:
    print("✅ Model is already trained! Skipping the SFT training loop.")
else:
    # GUARDRAIL 4: Flush GPU memory before training begins
    gc.collect()
    torch.cuda.empty_cache()

    # FIX: Gemma 4 is multi-modal so it uses a Processor.
    # SFTTrainer expects a pure text tokenizer, so we extract it to prevent NoneType positional errors.
    pure_text_tokenizer = getattr(tokenizer, "tokenizer", tokenizer)

    trainer = SFTTrainer(
        model = model,
        processing_class = pure_text_tokenizer,
        train_dataset = formatted_dataset,
        dataset_text_field = "text",
        max_seq_length = max_seq_length,
        dataset_num_proc = 2,
        args = TrainingArguments(
            per_device_train_batch_size = 1,
            gradient_accumulation_steps = 8,
            warmup_steps = 20,                    # OPTIMIZED: Replaced deprecated warmup_ratio
            num_train_epochs = 2,                 # OPTIMIZED: Swapped max_steps for Epochs.
            learning_rate = 2e-4,
            fp16 = True,
            bf16 = False,
            logging_steps = 5,
            optim = "adamw_8bit",
            weight_decay = 0.01,
            lr_scheduler_type = "cosine",         # OPTIMIZED: Cosine decay improves final accuracy over linear
            seed = 3407,
            output_dir = "outputs",
        ),
    )

    print("Starting Optimized Supervised Fine-Tuning (SFT)...")

    try:
        trainer_stats = trainer.train()
        print("Training complete. Neural weights updated successfully.")
    except RuntimeError as e:
        if "out of memory" in str(e).lower():
            print("\n❌ CRITICAL OOM ERROR: The GPU ran out of memory during training.")
            print("FIX: Check your batch size parameters.")
        raise e
    finally:
        # OPTIMIZATION: Instantly delete the trainer and its 8GB of optimizer states
        # Unsloth models save using `model.save_pretrained()`, so the trainer is no longer needed.
        if 'trainer' in locals() or 'trainer' in globals():
            del trainer
        gc.collect()
        torch.cuda.empty_cache()
        print("✅ Optimizer memory freed.")

### MARKDOWN
I use os.makedirs with exist_ok=True to ensure the directory is created properly before saving. Wrapping this in an exception handler ensures I know exactly if and why saving to Google Drive failed.

### CODE
import os

if is_trained:
    print("✅ Model weights are already secured in Google Drive. Skipping save.")
else:
    save_path = "/content/drive/MyDrive/ph_stutter_smoother_lora"

    # GUARDRAIL 5: Safely ensure the target directory exists
    os.makedirs(save_path, exist_ok=True)

    try:
        print(f"Saving custom LoRA adapters to {save_path}...")
        model.save_pretrained(save_path)
        tokenizer.save_pretrained(save_path)
        print("Model weights safely secured in Google Drive.")

        # Now mark as trained so future "Run All" commands skip the loop!
        is_trained = True
    except Exception as e:
        print(f"❌ CRITICAL ERROR: Failed to save weights to Drive. Make sure you have enough storage space. Details: {e}")

### MARKDOWN
I am building a custom frontend separately, I don't need a fancy UI here. Instead, I am turning this Colab notebook into a pure Backend API. The script accepts audio file uploads directly from my custom website, processes the audio synchronously using Whisper and Gemma, and securely exposes a /process_audio endpoint.

### CODE
# --- THE BACKEND API SERVER ---
import gradio as gr
from faster_whisper import WhisperModel
import torch
import gc
from unsloth import FastLanguageModel

print("Purging any remaining setup memory to make room for Whisper...")

# AGGRESSIVE VRAM PURGE (Global)
if 'formatted_dataset' in globals():
    del formatted_dataset

gc.collect()
torch.cuda.empty_cache()

print("Initializing local Backend API server...")

# 1. Load Whisper into the T4 GPU using Faster-Whisper
# REMEDIATION: We use `compute_type="int8"` to compress Large-V3's memory footprint by 50%!
# This guarantees it fits alongside the massive Gemma 9B model without OOM crashing.
audio_model = WhisperModel("large-v3", device="cuda", compute_type="int8")

# 2. Switch Gemma into super-fast inference mode
FastLanguageModel.for_inference(model)
pure_text_tokenizer = getattr(tokenizer, "tokenizer", tokenizer)

def process_audio_api(audio_filepath):
    """
    This function acts as our core API endpoint.
    It receives an audio file from the frontend. Context is inferred dynamically.
    It returns a tuple: (Raw Transcript, Cleaned Transcript).
    """
    if audio_filepath is None:
        return "Error: No audio file provided.", ""

    try:
        # STEP 1: Fast Transcription
        dynamic_hint = "A conversation using a mixture of Tagalog, Bisaya, and English discussing various mixed topics."

        # Faster-Whisper uses a slightly different return format (generators)
        segments, info = audio_model.transcribe(
            audio_filepath,
            condition_on_previous_text=False,
            language="tl",
            beam_size=5,
            initial_prompt=dynamic_hint
        )

        # Extract the text from the generated segments
        messy_text = " ".join([segment.text for segment in segments]).strip()

        if not messy_text:
            return "No speech detected in upload.", ""

        # STEP 2: Dynamic Gemma Prompting
        prompt = f"""<start_of_turn>user
You are an expert editor. Clean this raw Philippine speech transcript by removing stutters, false starts, and local filler words (ano, kuan, bale) while preserving the original meaning.
The text may be in Tagalog, Bisaya, English, or a mixture of the three. Keep the original language mixture intact.

Dynamically analyze the transcript to determine its context and mixed topics. Based on your analysis, aggressively correct any phonetic misspellings of English or Local words.

Transcript: {messy_text}<end_of_turn>
<start_of_turn>model\n"""

        inputs = pure_text_tokenizer([prompt], return_tensors="pt").to("cuda")

        # STEP 3: Synchronous Generation (Ultra-Stable)
        outputs = model.generate(
            **inputs,
            max_new_tokens=128,
            use_cache=True,
            pad_token_id=pure_text_tokenizer.eos_token_id
        )

        result_text = pure_text_tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
        clean_text = result_text.split("model\n")[-1].strip()

        return messy_text, clean_text

    except Exception as e:
        print(f"Backend Processing Error: {e}")
        return f"[API Error]: {e}", ""

    finally:
        # OPTIMIZATION: Explicitly delete massive tensor variables before forcing cache clear
        # Python's GC can be slow. This guarantees VRAM drops back to baseline instantly.
        if 'inputs' in locals():
            del inputs
        if 'outputs' in locals():
            del outputs

        gc.collect()
        torch.cuda.empty_cache()

# 3. Build the Headless API Interface
with gr.Blocks(theme=gr.themes.Monochrome()) as demo:
    gr.Markdown("### ⚙️ Backend API is Running")
    gr.Markdown("This interface is primarily for the custom frontend to connect to. You can test file uploads below.")

    with gr.Row():
        audio_in = gr.Audio(type="filepath", label="Upload Test Audio (Tagalog/Bisaya/English)")

    submit_btn = gr.Button("Test API")

    with gr.Row():
        raw_out = gr.Textbox(label="Raw Whisper Output")
        clean_out = gr.Textbox(label="Gemma Smoothed Output")

    # EXPOSING THE API ENDPOINT:
    submit_btn.click(
        fn=process_audio_api,
        inputs=[audio_in],
        outputs=[raw_out, clean_out],
        api_name="process_audio"
    )

print("Launching backend API...")
# queue() handles simultaneous frontend requests cleanly
demo.queue().launch(share=True)
