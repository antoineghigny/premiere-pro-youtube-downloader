chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(
      {
        resolution: '1080',
        downloadPath: '',
        audioOnly: false,
        downloadMP3: false,
        videoOnly: false,
        secondsBefore: '15',
        secondsAfter: '15',
      },
      (settings) => sendResponse(settings)
    );
    return true;
  }
  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.sync.set(message.settings, () => sendResponse({ success: true }));
    return true;
  }
});
