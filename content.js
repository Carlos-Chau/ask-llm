// ===== Constants and State Management =====
const STATE = {
  isRecording: false,
  currentInputField: null,
  tooltipPosition: null,
  audioChunks: [],
  mediaRecorder: null,
  audioPlayer: null,
  isPlaying: false
};

// ===== Event Listeners =====
document.addEventListener('mouseup', handleMouseUp);
document.addEventListener('mousedown', handleMouseDown);

// ===== Main Functions =====

function handleMouseUp(event) {
  if (event.button === 1) { // Middle mouse button
    event.preventDefault();

    if (STATE.isRecording) {
      stopRecording();
    } else {
      const isInputField = isElementInputField(event.target);

      if (isInputField) {
        STATE.currentInputField = event.target;
        STATE.tooltipPosition = { x: event.pageX, y: event.pageY };
        createTooltip(event.pageX, event.pageY, '', 'input-recording');
        startRecording();
      } else if (event.target.closest('a') === null) {
        askLlama(event.pageX, event.pageY);
      }
    }
  }
}

function handleMouseDown(event) {
  if (event.button === 1 && (event.target.closest('a') === null || STATE.isRecording ||
    isElementInputField(event.target))) {
    event.preventDefault();
  }
}

function isElementInputField(element) {
  return element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.isContentEditable;
}

async function askLlama(x, y) {
  const selectedText = window.getSelection().toString().trim();
  const data = await getStorageData(['promptText', 'apiKey', 'systemMessage', 'model']);
  const promptText = data.promptText || 'What is';

  const tooltip = createTooltip(x, y, selectedText, 'normal', promptText);

  if (selectedText) {
    callChatCompletionAPI(promptText + " '" + selectedText + "'", tooltip);
  }

  addIconsToTooltip(tooltip, selectedText);
  addBrandingToTooltip(tooltip);
}

// ===== Tooltip Management =====

function createTooltip(x, y, selectedText, mode = 'normal', promptText = 'What is') {
  removeExistingTooltip();

  const tooltip = document.createElement('div');
  tooltip.id = 'askLlama-tooltip';
  tooltip.style.position = 'absolute';
  tooltip.style.zIndex = '1000000';
  document.body.appendChild(tooltip);
  tooltip.style.paddingTop = '25px';

  let promptValue = "";
  if (mode === 'recording' || mode === 'input-recording') {
    promptValue = "Turning your voice to text...";
  } else if (selectedText) {
    promptValue = promptText + ' ' + "'" + selectedText + "'";
  } else {
    promptValue = "Try 'Youtube Search Sunny Lam'";
  }

  const commandListHTML = `
    List of Commands<br>
    <div style="display: flex; align-items: center; margin: 5px 0;">
      <img src="${chrome.runtime.getURL('icons/wikipedia-icon.png')}" style="width: 16px; height: 16px; margin-right: 5px;"> Wikipedia Search
    </div>
    <div style="display: flex; align-items: center; margin: 5px 0;">
      <img src="${chrome.runtime.getURL('icons/youtube-icon.png')}" style="width: 16px; height: 16px; margin-right: 5px;"> Youtube Search
    </div>
    <div style="display: flex; align-items: center; margin: 5px 0;">
      <img src="${chrome.runtime.getURL('icons/google-icon.webp')}" style="width: 16px; height: 16px; margin-right: 5px;"> Google Search
    </div>
    <div style="display: flex; align-items: center; margin: 5px 0;">
      <img src="${chrome.runtime.getURL('icons/google-translate-icon.webp')}" style="width: 16px; height: 16px; margin-right: 5px;"> Google Translate
    </div>
  `;

  let resultContent = "Loading...";
  if (mode === 'input-recording') {
    resultContent = "";
  } else if (!selectedText && mode === 'normal') {
    resultContent = commandListHTML;
  }

  tooltip.innerHTML = `
    <div style="position: relative; margin-bottom: 5px; display: flex; align-items: center;">
      <img src="${chrome.runtime.getURL('icons/mic_icon.png')}" id="mic-icon" style="width: 20px; height: 20px; margin-right: 5px; cursor: pointer;">
      <div style="flex-grow: 1; position: relative;">
        <input type="text" id="prompt-input" style="width: 100%; font-weight: bold; background-color: transparent; border: none; outline: none; padding-bottom: 2px;" value="${promptValue}">
        <div id="input-underline" style="position: absolute; bottom: 0; left: 0; height: 1px; width: 100%; background-color: lightgrey; transition: width 0.1s;"></div>
      </div>
      <button id="play-button" style="cursor: pointer; background: none; border: none; font-size: 16px; margin-left: auto;" title="Play as speech">▶️</button>
    </div>
    <div id="result" style="margin-top:5px">${resultContent}</div>
  `;

  setTooltipPosition(tooltip, x, y);
  setupTooltipEventListeners(tooltip, selectedText, mode);
  makeDraggable(tooltip);
  updateMicIcon();
  addIconsToTooltip(tooltip, selectedText);
  addBrandingToTooltip(tooltip);

  return tooltip;
}

function setTooltipPosition(tooltip, x, y) {
  tooltip.style.left = `${x + 10}px`;
  tooltip.style.top = `${y + 10}px`;

  const tooltipRect = tooltip.getBoundingClientRect();
  const rightOverflow = (x + tooltipRect.width > window.innerWidth);
  const bottomOverflow = (y + tooltipRect.height > window.innerHeight + window.scrollY);

  if (rightOverflow) {
    tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
  }

  if (bottomOverflow) {
    tooltip.style.top = `${window.scrollY + window.innerHeight - tooltipRect.height - 10}px`;
  }
}

function removeExistingTooltip() {
  const existingTooltip = document.getElementById('askLlama-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
  stopAudioPlayback();
}

function stopAudioPlayback() {
  if (STATE.audioPlayer) {
    STATE.audioPlayer.pause();
    if (STATE.audioPlayer.src) {
      URL.revokeObjectURL(STATE.audioPlayer.src);
    }
    STATE.audioPlayer = null;
    STATE.isPlaying = false;
  }
}

function setupTooltipEventListeners(tooltip, selectedText, mode) {
  const micIcon = tooltip.querySelector('#mic-icon');
  const playButton = tooltip.querySelector('#play-button');
  const promptInput = tooltip.querySelector('#prompt-input');

  if (promptInput) {
    if (mode !== 'recording' && mode !== 'input-recording') {
      setupPromptInputListeners(promptInput, selectedText, tooltip);
    } else {
      promptInput.readOnly = true;
    }
    updateUnderlineWidth();
  }

  if (micIcon) {
    micIcon.addEventListener('click', toggleRecording);
  }

  if (playButton) {
    setupPlayButtonListener(playButton);
  }

  document.addEventListener('mouseup', function handleMouseUpOutside(event) {
    if (!tooltip.contains(event.target) && event.button !== 1) {
      removeExistingTooltip();
      document.removeEventListener('mouseup', handleMouseUpOutside);
      stopRecording();
    }
  });
}

function setupPromptInputListeners(promptInput, selectedText, tooltip) {
  promptInput.focus();

  promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputText = this.value.trim();
      if (inputText && !handleSpecialCommands(inputText)) {
        callChatCompletionAPI(inputText, tooltip);
      }
    }
  });

  promptInput.addEventListener('input', updateUnderlineWidth);
  updateUnderlineWidth();
}

function setupPlayButtonListener(playButton) {
  playButton.addEventListener('click', function () {
    if (STATE.isPlaying && STATE.audioPlayer) {
      STATE.audioPlayer.pause();
      STATE.isPlaying = false;
      playButton.textContent = '▶️';
      playButton.title = "Play as speech";
    } else if (STATE.audioPlayer && STATE.audioPlayer.paused) {
      STATE.audioPlayer.play();
      STATE.isPlaying = true;
      playButton.textContent = '⏸️';
      playButton.title = "Pause speech";
    } else {
      const promptInput = document.getElementById('prompt-input');
      const resultElement = document.getElementById('result');

      if (promptInput && resultElement) {
        const combinedText = promptInput.value + " " + resultElement.textContent;
        if (combinedText.trim()) {
          playButton.textContent = '⌛';
          playButton.disabled = true;

          callTTSAPI(combinedText.substring(0, 200))
            .then(audioBlob => {
              stopAudioPlayback();
              const audioUrl = URL.createObjectURL(audioBlob);
              STATE.audioPlayer = new Audio(audioUrl);
              STATE.audioPlayer.onended = function () {
                STATE.isPlaying = false;
                playButton.textContent = '▶️';
                playButton.title = "Play as speech";
              };
              STATE.audioPlayer.play();
              STATE.isPlaying = true;
              playButton.textContent = '⏸️';
              playButton.title = "Pause speech";
            })
            .catch(error => {
              console.error('Error generating speech:', error);
              alert('Error generating speech. Please try again.');
            })
            .finally(() => {
              playButton.disabled = false;
            });
        }
      }
    }
  });
}

function updateUnderlineWidth() {
  const promptInput = document.getElementById('prompt-input');
  const inputUnderline = document.getElementById('input-underline');
  if (promptInput && inputUnderline) {
    const textWidth = getTextWidth(promptInput.value, getComputedStyle(promptInput).font);
    inputUnderline.style.width = `${textWidth}px`;
  }
}

function getTextWidth(text, font) {
  const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

function addIconsToTooltip(tooltip, text) {
  const iconContainer = document.createElement('div');
  iconContainer.style.position = 'absolute';
  iconContainer.style.bottom = '10px';
  iconContainer.style.right = '10px';
  iconContainer.style.display = 'flex';
  iconContainer.style.gap = '5px';

  const icons = [
    { src: chrome.runtime.getURL('icons/wikipedia-icon.png'), url: `https://en.wikipedia.org/wiki/${encodeURIComponent(text)}` },
    { src: chrome.runtime.getURL('icons/google-icon.webp'), url: `https://www.google.com/search?q=${encodeURIComponent(text)}` },
    { src: chrome.runtime.getURL('icons/google-translate-icon.webp'), url: `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(text)}&op=translate` },
    { src: chrome.runtime.getURL('icons/youtube-icon.png'), url: `https://www.youtube.com/results?search_query=${encodeURIComponent(text)}` }
  ];

  icons.forEach(icon => {
    const img = document.createElement('img');
    img.src = icon.src;
    img.style.width = '20px';
    img.style.height = '20px';
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => {
      window.open(icon.url, '_blank');
    });
    iconContainer.appendChild(img);
  });

  tooltip.appendChild(iconContainer);
}

function addBrandingToTooltip(tooltip) {
  const brandingContainer = document.createElement('div');
  brandingContainer.style.position = 'absolute';
  brandingContainer.style.bottom = '10px';
  brandingContainer.style.left = '10px';
  brandingContainer.style.display = 'flex';
  brandingContainer.style.alignItems = 'center';
  brandingContainer.style.gap = '5px';

  const brandingIcon = document.createElement('img');
  brandingIcon.src = chrome.runtime.getURL('icons/icon48.png');
  brandingIcon.style.width = '20px';
  brandingIcon.style.height = '20px';

  const brandingText = document.createElement('span');
  brandingText.innerHTML = `<b id='brandingAppName'>Ask Llama! </b>by <a href="https://www.d24h.hk/" target="_blank">d24h.hk</a>`;

  brandingContainer.appendChild(brandingIcon);
  brandingText.style.fontSize = '12px';
  brandingContainer.appendChild(brandingText);

  tooltip.appendChild(brandingContainer);
}

function makeDraggable(tooltip) {
  let isDragging = false;
  let startX, startY, startLeft, startTop;

  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  tooltip.insertBefore(dragHandle, tooltip.firstChild);

  dragHandle.addEventListener('mousedown', startDragging);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDragging);

  function startDragging(e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(window.getComputedStyle(tooltip).left, 10);
    startTop = parseInt(window.getComputedStyle(tooltip).top, 10);
    e.preventDefault();
  }

  function drag(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    tooltip.style.left = `${startLeft + dx}px`;
    tooltip.style.top = `${startTop + dy}px`;
  }

  function stopDragging() {
    isDragging = false;
  }
}

function handleSpecialCommands(input) {
  const lowerInput = input.trimLeft().toLowerCase();
  const commands = {
    'youtube search': { slice: 14, url: 'https://www.youtube.com/results?search_query=' },
    'google search': { slice: 7, url: 'https://www.google.com/search?q=' },
    'google translate': { slice: 17, url: 'https://translate.google.com/?sl=auto&tl=en&text=' },
    'wikipedia search': { slice: 17, url: 'https://en.wikipedia.org/wiki/Special:Search?search=' }
  };

  for (const [command, { slice, url }] of Object.entries(commands)) {
    if (lowerInput.startsWith(command)) {
      const searchTerm = input.slice(slice).trim();
      if (searchTerm) {
        setTimeout(() => {
          window.open(url + encodeURIComponent(searchTerm), '_blank');
        }, 700);
        return true;
      }
    }
  }
  return false;
}

async function callChatCompletionAPI(selectedText, tooltip) {
  const data = await getStorageData(['apiKey', 'systemMessage', 'model']);
  const systemMessage = data.systemMessage || 'Reply in at most 3 sentences';
  const model = data.model || 'openai/gpt-oss-20b:groq';

  console.log(`[AskLlama] Using HuggingFace model: ${model}`);

  callHuggingFaceChatAPI(data.apiKey || '', model, systemMessage, selectedText, tooltip);
}

function callAPIThroughBackground(portName, apiUrl, apiKey, model, systemMessage, userMessage, tooltip, provider, headers = {}) {
  if (!apiKey) {
    showApiKeyError(tooltip);
    return;
  }

  const port = chrome.runtime.connect({ name: portName });
  let totalResult = '';
  let notFinished = '';

  port.onMessage.addListener((msg) => {
    if (msg.type === 'chunk') {
      let chunkText = msg.data;
      if (notFinished) {
        chunkText = notFinished + chunkText;
        notFinished = '';
      }

      const lines = chunkText.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (!line || line === 'data: [DONE]') continue;
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.substring(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              totalResult += content;
              updateResultDisplay(tooltip, totalResult);
            }
          } catch (e) {
            notFinished = line;
          }
        }
      }
    } else if (msg.type === 'error') {
      console.error(`[AskLlama] Error:`, msg.message);
      showAPIError(tooltip, msg.message);
    }
  });

  port.postMessage({
    apiUrl,
    apiKey: apiKey.trim(),
    headers,
    body: {
      model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      stream: true
    }
  });
}

function updateResultDisplay(tooltip, text) {
  try {
    const htmlContent = marked.parse(text);
    const resultElement = tooltip.querySelector('#result');
    if (resultElement) {
      resultElement.innerHTML = htmlContent;
    }
  } catch (error) {
    const resultElement = tooltip.querySelector('#result');
    if (resultElement) {
      resultElement.textContent = text;
    }
  }
}

async function callWhisperAPI(audioBlob) {
  const data = await getStorageData(['apiKey']);
  return callHuggingFaceWhisperAPI(audioBlob, data.apiKey);
}

async function callTTSAPI(text) {
  const data = await getStorageData(['apiKey']);
  return callHuggingFaceTTSAPI(text, data.apiKey);
}

function showApiKeyError(tooltip) {
  const link = 'https://huggingface.co/settings/tokens';
  tooltip.querySelector('#result').innerHTML = `Error: <a href="${link}" target="_blank" style="color:#0000EE">HuggingFace API key</a> is not set.`;
}

function showAPIError(tooltip, message) {
  tooltip.querySelector('#result').innerHTML = `
    Error from HuggingFace: ${message} <br /> 
    Check your API key or limits.
  `;
}

// ===== Voice Recording Functions =====

function toggleRecording() {
  STATE.isRecording ? stopRecording() : startRecording();
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    STATE.mediaRecorder = new MediaRecorder(stream);
    STATE.audioChunks = [];
    STATE.mediaRecorder.addEventListener("dataavailable", event => STATE.audioChunks.push(event.data));
    STATE.mediaRecorder.start();
    STATE.isRecording = true;

    const promptInput = document.getElementById('prompt-input');
    if (promptInput) {
      promptInput.value = "Turning your voice to text...";
      promptInput.readOnly = true;
      updateUnderlineWidth();
    }

    updateMicIcon();
  } catch (err) {
    console.error("Error accessing microphone:", err);
    alert("Could not access microphone. Please check permissions.");
  }
}

function stopRecording() {
  if (STATE.mediaRecorder && STATE.isRecording) {
    STATE.isRecording = false;
    STATE.mediaRecorder.stop();
    STATE.mediaRecorder.addEventListener("stop", () => {
      const audioBlob = new Blob(STATE.audioChunks, { type: 'audio/webm' });
      callWhisperAPI(audioBlob);
    }, { once: true });
  }
  stopMediaTracks();
  updateMicIcon();
}

function stopMediaTracks() {
  if (STATE.mediaRecorder && STATE.mediaRecorder.stream) {
    STATE.mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
}

function updateMicIcon() {
  const micIcon = document.getElementById('mic-icon');
  if (micIcon) {
    micIcon.style.filter = STATE.isRecording ? 'drop-shadow(0 0 3px red)' : 'none';
    micIcon.style.transform = STATE.isRecording ? 'scale(1.1)' : 'scale(1)';
  }
}

function updatePromptInputWithTranscription(transcription) {
  if (STATE.currentInputField) {
    if (STATE.currentInputField.isContentEditable) {
      STATE.currentInputField.textContent = transcription;
    } else {
      STATE.currentInputField.value = transcription;
      const inputEvent = new Event('input', { bubbles: true });
      STATE.currentInputField.dispatchEvent(inputEvent);
    }
    STATE.currentInputField.focus();
    removeExistingTooltip();
    STATE.currentInputField = null;
    STATE.tooltipPosition = null;
    return;
  }

  const promptInput = document.getElementById('prompt-input');
  if (promptInput) {
    promptInput.value = transcription;
    promptInput.readOnly = false;
    promptInput.focus();
    updateUnderlineWidth();

    const trimmedTranscription = transcription.trim();
    if (trimmedTranscription && /\S/.test(trimmedTranscription)) {
      if (!handleSpecialCommands(trimmedTranscription)) {
        callChatCompletionAPI(trimmedTranscription, document.getElementById('askLlama-tooltip'));
      }
    } else {
      const resultElement = document.getElementById('result');
      if (resultElement) {
        resultElement.textContent = 'No valid text was transcribed. Please try again.';
      }
    }
  }
}

// ===== Utility Functions =====

function getStorageData(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}