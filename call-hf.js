async function callHuggingFaceChatAPI(apiKey, model, systemMessage, userMessage, tooltip) {
    const apiUrl = 'https://router.huggingface.co/v1/chat/completions';
    callAPIThroughBackground('hf-stream', apiUrl, apiKey, model, systemMessage, userMessage, tooltip, 'huggingface');
}

async function callHuggingFaceWhisperAPI(audioBlob, apiKey) {
    if (!apiKey) {
        alert('HuggingFace API key is not set. Please set it in the extension options.');
        return;
    }

    try {
        // Convert blob to base64 to send to background
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64data = reader.result.split(',')[1];

            chrome.runtime.sendMessage({
                type: 'FETCH_API',
                apiUrl: 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3',
                apiKey: apiKey.trim(),
                headers: {
                    'Content-Type': 'audio/webm',
                    'x-wait-for-model': 'true'
                },
                body: base64data,
                isBinaryRequest: true
            }, (response) => {
                if (response.success) {
                    const transcription = response.data.text || (Array.isArray(response.data) ? response.data[0]?.text : null);
                    if (transcription) {
                        updatePromptInputWithTranscription(transcription);
                    } else {
                        console.error('HF Whisper Error: No transcription found in response', response.data);
                        alert('Error: No transcription found in HF response.');
                    }
                } else {
                    console.error('HF Whisper Error:', response.error);
                    alert('Error transcribing audio with HF. Please try again.');
                }
            });
        };
    } catch (error) {
        console.error('Error sending audio to HF Whisper:', error);
    }
}

async function callHuggingFaceTTSAPI(text, apiKey) {
    if (!apiKey) {
        throw new Error('HuggingFace API key is not set');
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: 'FETCH_API',
            apiUrl: 'https://router.huggingface.co/replicate/v1/predictions',
            apiKey: apiKey.trim(),
            headers: {
                'Content-Type': 'application/json'
            },
            body: { text: text },
            isBinaryResponse: false
        }, async (response) => {
            if (response.success) {
                try {
                    const result = response.data;
                    let audioSource = result.output;

                    if (Array.isArray(audioSource)) {
                        audioSource = audioSource[0];
                    }

                    if (!audioSource) {
                        // If output is missing, check if the response itself is a string (direct audio bytes/url)
                        if (typeof result === 'string') {
                            audioSource = result;
                        } else {
                            console.error('TTS Error: No output found in response', result);
                            reject(new Error('No audio output found in response'));
                            return;
                        }
                    }

                    // If audioSource is a URL, fetch the binary data
                    if (typeof audioSource === 'string' && audioSource.startsWith('http')) {
                        chrome.runtime.sendMessage({
                            type: 'FETCH_API',
                            apiUrl: audioSource,
                            method: 'GET',
                            isBinaryResponse: true
                        }, (audioResponse) => {
                            if (audioResponse.success) {
                                const binaryString = atob(audioResponse.data);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                resolve(new Blob([bytes.buffer], { type: 'audio/wav' }));
                            } else {
                                reject(new Error('Failed to fetch audio from URL: ' + audioResponse.error));
                            }
                        });
                    } else {
                        // Assume audioSource is base64 encoded audio
                        const binaryString = atob(audioSource);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        resolve(new Blob([bytes.buffer], { type: 'audio/wav' }));
                    }
                } catch (err) {
                    console.error('TTS Processing Error:', err);
                    reject(err);
                }
            } else {
                reject(new Error(response.error));
            }
        });
    });
}
