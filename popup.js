document.addEventListener('DOMContentLoaded', () => {
  const promptInput = document.getElementById('promptText');
  const apiKeyInput = document.getElementById('apiKey');
  const triggerKeySelect = document.getElementById('triggerKey');
  const systemMessageInput = document.getElementById('systemMessage');
  const modelSelect = document.getElementById('model');

  // Selectors for Advanced Settings
  const advancedToggle = document.querySelector('.advanced-toggle:not(.api-key-toggle)');
  const advancedSettings = document.querySelector('.advanced-settings:not(.api-key-settings)');

  // Selectors for API Key Settings
  const apiKeyToggle = document.querySelector('.api-key-toggle');
  const apiKeySettings = document.querySelector('.api-key-settings');

  const colorThemeInputs = document.querySelectorAll('input[name="colorTheme"]');
  const popupBody = document.getElementById('popupBody');

  // Load the saved values
  chrome.storage.sync.get(['promptText', 'apiKey', 'triggerKey', 'systemMessage', 'model', 'advancedSettingsVisible', 'colorTheme'], function (data) {
    if (promptInput) promptInput.value = data.promptText || 'What is';
    if (apiKeyInput) apiKeyInput.value = data.apiKey || '';
    if (triggerKeySelect) triggerKeySelect.value = data.triggerKey || 'Ctrl';
    if (systemMessageInput) systemMessageInput.value = data.systemMessage || 'Reply in at most 3 sentences';
    if (modelSelect) modelSelect.value = data.model || 'openai/gpt-oss-20b:groq';

    // Initial visibility logic based on API Key
    const hasApiKey = !!data.apiKey;

    if (apiKeySettings && apiKeyToggle) {
      if (!hasApiKey) {
        apiKeyToggle.classList.add('open');
        apiKeySettings.classList.add('open');
        apiKeySettings.style.display = 'block';
      } else {
        apiKeyToggle.classList.remove('open');
        apiKeySettings.classList.remove('open');
        apiKeySettings.style.display = 'none';
      }
    }

    if (advancedSettings && advancedToggle) {
      if (hasApiKey) {
        advancedToggle.classList.add('open');
        advancedSettings.classList.add('open');
        advancedSettings.style.display = 'block';
      } else {
        advancedToggle.classList.remove('open');
        advancedSettings.classList.remove('open');
        advancedSettings.style.display = 'none';
      }
    }

    // Set the color theme
    const savedTheme = data.colorTheme || 'LightYellow';
    const themeInput = document.querySelector(`input[value="${savedTheme}"]`);
    if (themeInput) themeInput.checked = true;
    if (popupBody) popupBody.style.backgroundColor = savedTheme;
  });

  // Handle flag clicks
  const flags = document.querySelectorAll('.flag');
  flags.forEach(flag => {
    flag.addEventListener('click', () => {
      const prompt = flag.getAttribute('data-prompt');
      const system = flag.getAttribute('data-system');
      if (promptInput) {
        promptInput.value = prompt;
        saveValue({ target: promptInput });
      }
      if (systemMessageInput && system) {
        systemMessageInput.value = system;
        saveValue({ target: systemMessageInput });
      }
    });
  });

  // Save values immediately on change
  if (promptInput) promptInput.addEventListener('input', saveValue);
  if (apiKeyInput) apiKeyInput.addEventListener('input', saveValue);
  if (triggerKeySelect) triggerKeySelect.addEventListener('change', saveValue);
  if (systemMessageInput) systemMessageInput.addEventListener('input', saveValue);
  if (modelSelect) modelSelect.addEventListener('change', saveValue);

  // Toggle advanced settings
  if (advancedToggle && advancedSettings) {
    advancedToggle.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = advancedToggle.classList.toggle('open');
      advancedSettings.classList.toggle('open');
      advancedSettings.style.display = isOpen ? 'block' : 'none';
    });
  }

  // Toggle API key settings
  if (apiKeyToggle && apiKeySettings) {
    apiKeyToggle.addEventListener('click', (e) => {
      // If the click was on the link, let it happen and don't toggle
      if (e.target.tagName === 'A' || e.target.parentElement.tagName === 'A') {
        return;
      }

      e.preventDefault();
      const isOpen = apiKeyToggle.classList.toggle('open');
      apiKeySettings.classList.toggle('open');
      apiKeySettings.style.display = isOpen ? 'block' : 'none';
    });
  }

  // Save color theme when changed
  if (colorThemeInputs) {
    colorThemeInputs.forEach(input => {
      input.addEventListener('change', (event) => {
        const selectedColor = event.target.value;
        chrome.storage.sync.set({ colorTheme: selectedColor }, function () {
          console.log('Colour theme saved:', selectedColor);
          if (popupBody) popupBody.style.backgroundColor = selectedColor;
        });
      });
    });
  }

  function saveValue(event) {
    const idMap = {
      'promptText': 'promptText',
      'apiKey': 'apiKey',
      'triggerKey': 'triggerKey',
      'systemMessage': 'systemMessage',
      'model': 'model'
    };

    const elementId = event.target.id;
    const storageKey = idMap[elementId] || elementId;
    const value = event.target.value;

    chrome.storage.sync.set({ [storageKey]: value }, function () {
      console.log(`${storageKey} saved:`, value);

      // Immediately show Advanced Settings when HF Token's value has been filled
      if (storageKey === 'apiKey' && value.trim() !== '') {
        if (advancedToggle && advancedSettings) {
          advancedToggle.classList.add('open');
          advancedSettings.classList.add('open');
          advancedSettings.style.display = 'block';
        }
      }
    });
  }
});