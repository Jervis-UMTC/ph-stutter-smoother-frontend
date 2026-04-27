import { Client } from '@gradio/client'; Client.connect('gradio/hello_world').then(c => console.log(c.config.root, c.api_prefix));
