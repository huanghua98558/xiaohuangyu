import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export async function detectHomepageInteraction(imagePath, { serviceUrl, timeoutMs }) {
  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error(`文件不存在: ${imagePath}`);
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));

  const response = await axios.post(`${serviceUrl}/yolo/detect_file`, form, {
    headers: form.getHeaders(),
    timeout: timeoutMs,
  });

  return response.data;
}

export default {
  detectHomepageInteraction,
};
