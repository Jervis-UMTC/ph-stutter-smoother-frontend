
import { Client } from '@gradio/client';
Client.connect('gradio/hello_world').then(c => console.log(c.config.root, typeof c.api_prefix, c.api_prefix));

