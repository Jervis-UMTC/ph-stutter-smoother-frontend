
import { Client } from '@gradio/client';
import fs from 'fs';
Client.connect('gradio/hello_world').then(async c => {
  const formData = new FormData();
  formData.append('files', new Blob(['hello']), 'hello.txt');
  const res = await fetch(c.config.root + c.api_prefix + '/upload', { method: 'POST', body: formData });
  console.log(await res.text());
});

