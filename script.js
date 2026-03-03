const pages = {
  role: document.getElementById("role-page"),
  receiver: document.getElementById("receiver-page"),
  sender: document.getElementById("sender-page"),
};

const receiverBtn = document.getElementById("receiver-btn");
const senderBtn = document.getElementById("sender-btn");

const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const receiverStatus = document.getElementById("receiver-status");
const senderStatus = document.getElementById("sender-status");

const beaming = document.getElementById("beaming");
const messageBox = document.getElementById("message-box");
const receivedMessage = document.getElementById("received-message");
const clearBtn = document.getElementById("clear-btn");

const backFromReceiver = document.getElementById("back-from-receiver");
const backFromSender = document.getElementById("back-from-sender");

let ndef = null;
let ignoreRead = false;
let scanStarted = false;
let activeRole = "role";

if ("NDEFReader" in window) {
  ndef = new NDEFReader();

  ndef.onreading = (event) => {
    if (ignoreRead) {
      return;
    }

    if (activeRole !== "sender") {
      return;
    }

    const message = extractMessageFromTag(event);

    if (message) {
      showMessageState(message);
      senderStatus.textContent = "Message received from NFC tag.";
    } else {
      senderStatus.textContent = "Tag read, but no valid text message was found.";
      showWaitingState();
    }
  };
}

function showPage(pageName) {
  Object.values(pages).forEach((page) => page.classList.remove("active"));
  pages[pageName].classList.add("active");
  activeRole = pageName;
}

function showWaitingState() {
  beaming.classList.remove("hidden");
  messageBox.classList.add("hidden");
}

function showMessageState(message) {
  beaming.classList.add("hidden");
  messageBox.classList.remove("hidden");
  receivedMessage.textContent = message;
}

function clearSenderDisplay() {
  receivedMessage.textContent = "";
  showWaitingState();
}

function requireNfcSupport() {
  if (!ndef) {
    throw new Error("Web NFC is not supported on this browser/device.");
  }
}

async function ensureScanStarted() {
  requireNfcSupport();

  if (scanStarted) {
    return;
  }

  await ndef.scan();
  scanStarted = true;
}

function decodeRecordText(record) {
  if (!record.data) {
    return "";
  }

  const bytes = new Uint8Array(
    record.data.buffer,
    record.data.byteOffset,
    record.data.byteLength,
  );

  if (bytes.length === 0) {
    return "";
  }

  if (record.recordType === "text") {
    const status = bytes[0];
    const languageLength = status & 0x3f;
    const textBytes = bytes.slice(1 + languageLength);
    const textDecoder = new TextDecoder(record.encoding || "utf-8");
    return textDecoder.decode(textBytes);
  }

  const textDecoder = new TextDecoder("utf-8");
  return textDecoder.decode(bytes);
}

function extractMessageFromTag(event) {
  for (const record of event.message.records) {
    if (record.recordType === "empty") {
      continue;
    }

    const text = decodeRecordText(record).trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function write(data) {
  ignoreRead = true;
  return new Promise((resolve, reject) => {
    ndef.addEventListener(
      "reading",
      () => {
        ndef
          .write(data)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            ignoreRead = false;
          });
      },
      { once: true },
    );
  });
}

async function startSenderMode() {
  showPage("sender");
  clearSenderDisplay();

  if (!ndef) {
    senderStatus.textContent = "Web NFC is not supported on this browser/device.";
    return;
  }

  senderStatus.textContent = "Bring an NFC tag close to receive a message.";

  try {
    await ensureScanStarted();
  } catch (error) {
    senderStatus.textContent = `Could not start NFC scan: ${error.message}`;
  }
}

async function sendViaNfc() {
  const message = messageInput.value.trim();

  if (!message) {
    receiverStatus.textContent = "Please type a message before sending.";
    return;
  }

  if (!ndef) {
    receiverStatus.textContent = "Web NFC is not supported on this browser/device.";
    return;
  }

  receiverStatus.textContent = "Bring an NFC tag close to write your message.";

  try {
    await ensureScanStarted();
    await write(message);
    receiverStatus.textContent = "Message written to NFC tag successfully.";
    messageInput.value = "";
  } catch (error) {
    ignoreRead = false;
    receiverStatus.textContent = `Write failed: ${error.message}`;
  }
}

receiverBtn.addEventListener("click", () => {
  showPage("receiver");
  receiverStatus.textContent = "";
});

senderBtn.addEventListener("click", startSenderMode);

sendBtn.addEventListener("click", sendViaNfc);

clearBtn.addEventListener("click", () => {
  clearSenderDisplay();
  senderStatus.textContent = "Display cleared. Waiting for NFC message...";
});

backFromReceiver.addEventListener("click", () => {
  receiverStatus.textContent = "";
  showPage("role");
});

backFromSender.addEventListener("click", () => {
  senderStatus.textContent = "";
  showPage("role");
});

clearSenderDisplay();
