import { Client } from '@gradio/client'; Client.connect('https://huggingface.co/spaces/huggingface-projects/whisper-large-v3').then(c => console.log(c.config.root, c.api_prefix));
