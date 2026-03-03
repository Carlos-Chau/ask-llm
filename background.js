chrome.runtime.onInstalled.addListener(() => {
  console.log("Ask Llama! Extension Installed");
});

// Handle streaming connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "hf-stream") {
    port.onMessage.addListener(async (msg) => {
      const { apiUrl, apiKey, body, headers } = msg;

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...headers
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          port.postMessage({ type: 'error', message: errorText, status: response.status });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          port.postMessage({ type: 'chunk', data: chunk });
        }

        port.postMessage({ type: 'done' });
      } catch (error) {
        port.postMessage({ type: 'error', message: error.message });
      }
    });
  }
});

// Handle one-shot messages (Whisper, TTS)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_API') {
    handleOneShotFetch(request, sendResponse);
    return true; // Keep channel open for async response
  }
});

async function handleOneShotFetch(request, sendResponse) {
  const { apiUrl, apiKey, method, headers, body, isBinaryResponse, isBinaryRequest } = request;

  try {
    const fetchOptions = {
      method: method || 'POST',
      headers: {
        ...headers
      }
    };

    if (apiKey) {
      fetchOptions.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (body) {
      if (isBinaryRequest) {
        // Convert base64 back to Uint8Array
        const binaryString = atob(body);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        fetchOptions.body = bytes;
      } else {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
    }

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      sendResponse({ success: false, error: errorText, status: response.status });
      return;
    }

    if (isBinaryResponse) {
      const arrayBuffer = await response.arrayBuffer();
      // Safer base64 conversion for potentially large buffers
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      sendResponse({ success: true, data: base64 });
    } else {
      const data = await response.json();
      sendResponse({ success: true, data });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}