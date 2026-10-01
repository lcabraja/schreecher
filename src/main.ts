import ggwaveFactory from "ggwave";
import "./style.css";
import { view } from "./view";
import { createPackets, UrlReceiver, validateUrl } from "./transfer";

type GGWave = Awaited<ReturnType<typeof ggwaveFactory>>;


const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = view;


const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const sendTab = $<HTMLButtonElement>("#transmit-tab");
const receiveTab = $<HTMLButtonElement>("#receive-tab");
const sendPanel = $<HTMLDivElement>("#transmit-panel");
const receivePanel = $<HTMLDivElement>("#receive-panel");
const sendStatus = $<HTMLDivElement>("#send-status");
const receiveStatus = $<HTMLDivElement>("#receive-status");
const shareButton = $<HTMLButtonElement>("#share");
const cancelButton = $<HTMLButtonElement>("#cancel");
const listenButton = $<HTMLButtonElement>("#listen");
const urlInput = $<HTMLInputElement>("#url");
const inbox = $<HTMLDivElement>("#inbox");
const count = $<HTMLSpanElement>("#count");
let mode: "transmit" | "receive" = "transmit";
let modulePromise: Promise<GGWave> | null = null;
let context: AudioContext | null = null;
let txInstance: number | null = null;
let rxInstance: number | null = null;
let module: GGWave | null = null;
let stream: MediaStream | null = null;
let streamSource: MediaStreamAudioSourceNode | null = null;
let processor: ScriptProcessorNode | null = null;
let listening = false;
let sending = false;
let receiveEpoch = 0;
let sendController: AbortController | null = null;
let receivedCount = 0;
const receiver = new UrlReceiver();

function setMode(next: "transmit" | "receive") {
  if (mode === next) return;
  mode = next;
  sendController?.abort();
  sendTab.classList.toggle("active", next === "transmit");
  receiveTab.classList.toggle("active", next === "receive");
  sendTab.setAttribute("aria-selected", String(next === "transmit"));
  receiveTab.setAttribute("aria-selected", String(next === "receive"));
  sendPanel.classList.toggle("hidden", next !== "transmit");
  receivePanel.classList.toggle("hidden", next !== "receive");
  if (next === "transmit") stopListening();
}
sendTab.addEventListener("click", () => setMode("transmit"));
receiveTab.addEventListener("click", () => setMode("receive"));
for (const tab of [sendTab, receiveTab]) tab.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  setMode(mode === "transmit" ? "receive" : "transmit");
  (mode === "transmit" ? sendTab : receiveTab).focus();
});

async function initAudio() {
  if (!window.AudioContext) throw new Error("This browser does not support audio sharing.");
  // Create and resume within the user's click, before awaiting the codec. Safari needs this gesture.
  context ??= new AudioContext({ sampleRate: 48000 });
  const resumed = context.resume();
  modulePromise ??= ggwaveFactory();
  module = await modulePromise;
  module.disableLog();
  await resumed;
  if (txInstance === null) txInstance = createInstance(module.GGWAVE_OPERATING_MODE_TX);
  return { module, context, instance: txInstance! };
}

function createInstance(operatingMode: number) {
  const parameters = module!.getDefaultParameters();
  parameters.sampleRateInp = context!.sampleRate;
  parameters.sampleRateOut = context!.sampleRate;
  parameters.operatingMode = operatingMode;
  return module!.init(parameters);
}

function floatBytes(samples: Float32Array): Int8Array {
  return new Int8Array(samples.buffer, samples.byteOffset, samples.byteLength);
}

async function playPacket(message: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const audio = await initAudio();
  signal.throwIfAborted();
  // Copy the WASM view because another encode call can reuse its buffer.
  const waveform = audio.module.encode(audio.instance, message, audio.module.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST, 40).slice();
  if (!waveform.byteLength) throw new Error("Could not create the chirp.");
  const samples = new Float32Array(waveform.buffer, waveform.byteOffset, waveform.byteLength / 4);
  const buffer = audio.context.createBuffer(1, samples.length, audio.context.sampleRate);
  buffer.copyToChannel(samples, 0);
  await new Promise<void>((resolve, reject) => {
    const source = audio.context.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.context.destination);
    const cancel = () => { source.stop(); reject(new DOMException("Stopped", "AbortError")); };
    signal.addEventListener("abort", cancel, { once: true });
    source.onended = () => { signal.removeEventListener("abort", cancel); source.disconnect(); resolve(); };
    try { source.start(); } catch (error) { signal.removeEventListener("abort", cancel); source.disconnect(); reject(error); }
  });
}

function updatePacketInfo() {
  try {
    const url = validateUrl(urlInput.value);
    const packets = createPackets(url);
    $("#packet-info").textContent = `${new TextEncoder().encode(url).length} bytes · ${packets.length} ${packets.length === 1 ? "chirp" : "chirps"}${packets.length > 1 ? ". Keep both devices nearby until all chirps finish." : ""}`;
  } catch { $("#packet-info").textContent = ""; }
}
urlInput.addEventListener("input", updatePacketInfo);
cancelButton.addEventListener("click", () => sendController?.abort());

$("#send-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (sending) return;
  sending = true;
  shareButton.disabled = true;
  urlInput.disabled = true;
  cancelButton.classList.remove("hidden");
  sendController = new AbortController();
  const signal = sendController.signal;
  $("#share-label").textContent = "Preparing chirp…";
  sendStatus.textContent = "Preparing your link…";
  sendStatus.className = "status active-status";
  try {
    const packets = createPackets(urlInput.value);
    sendPanel.classList.add("is-sending");
    for (let index = 0; index < packets.length; index++) {
      signal.throwIfAborted();
      $("#share-label").textContent = packets.length === 1 ? "Chirping…" : `Chirp ${index + 1} of ${packets.length}`;
      sendStatus.textContent = packets.length === 1 ? "Playing the full link through your speaker." : `Sending part ${index + 1} of ${packets.length}. Keep the receiver listening.`;
      await playPacket(packets[index], signal);
      if (index < packets.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
    }
    signal.throwIfAborted();
    sendStatus.textContent = "Sent! Press Share again whenever you like.";
    sendStatus.className = "status success-status";
  } catch (error) {
    const stopped = error instanceof DOMException && error.name === "AbortError";
    sendStatus.textContent = stopped ? "Stopped. Share again to resend the full link." : error instanceof Error ? error.message : "Something went wrong.";
    sendStatus.className = stopped ? "status" : "status error-status";
  } finally {
    sendPanel.classList.remove("is-sending");
    $("#share-label").textContent = "Share with a chirp";
    shareButton.disabled = false;
    urlInput.disabled = false;
    cancelButton.classList.add("hidden");
    sending = false;
    sendController = null;
  }
});

function stopListening() {
  receiveEpoch++;
  if (processor) { processor.onaudioprocess = null; processor.disconnect(); }
  streamSource?.disconnect();
  stream?.getTracks().forEach(track => track.stop());
  if (rxInstance !== null) module?.free(rxInstance);
  rxInstance = null;
  processor = null;
  streamSource = null;
  stream = null;
  listening = false;
  listenButton.disabled = false;
  listenButton.classList.remove("listening");
  $("#listen-label").textContent = "Start listening";
  receiveStatus.textContent = "Microphone is off.";
  receiveStatus.className = "status";
}

function receiveMessage(message: string) {
  try {
    const result = receiver.accept(message);
    if (result.kind === "ignored") return;
    if (result.kind === "progress") {
      receiveStatus.textContent = `Caught ${result.received} of ${result.total} chirps. Keep listening for the rest.`;
      receiveStatus.className = "status active-status";
      return;
    }
    const url = new URL(result.url);
    count.textContent = String(++receivedCount).padStart(2, "0");
    const card = document.createElement("a");
    card.className = "received-card";
    card.href = url.toString();
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    const icon = document.createElement("span"); icon.className = "received-icon"; icon.textContent = "↗";
    const details = document.createElement("span"); details.className = "received-details";
    const host = document.createElement("strong"); host.textContent = url.hostname;
    const full = document.createElement("small"); full.textContent = url.toString();
    details.append(host, full);
    const time = document.createElement("time"); time.textContent = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
    card.append(icon, details, time);
    inbox.querySelector(".empty")?.remove();
    inbox.prepend(card);
    receiveStatus.textContent = "Link received. Still listening for more.";
    receiveStatus.className = "status success-status";
  } catch (error) {
    receiveStatus.textContent = error instanceof Error ? error.message : "Could not read that chirp. Ask the sender to share again.";
    receiveStatus.className = "status error-status";
  }
}

listenButton.addEventListener("click", async () => {
  if (listening) { stopListening(); return; }
  const epoch = ++receiveEpoch;
  listenButton.disabled = true;
  receiveStatus.textContent = "Allow microphone access in your browser's permission prompt.";
  receiveStatus.className = "status active-status";
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Receiving needs HTTPS and microphone support.");
    const audio = await initAudio();
    if (epoch !== receiveEpoch || mode !== "receive") return;
    const incomingStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    if (epoch !== receiveEpoch || mode !== "receive") { incomingStream.getTracks().forEach(track => track.stop()); return; }
    stream = incomingStream;
    rxInstance = createInstance(audio.module.GGWAVE_OPERATING_MODE_RX);
    streamSource = audio.context.createMediaStreamSource(stream);
    processor = audio.context.createScriptProcessor(1024, 1, 1);
    processor.onaudioprocess = event => {
      try {
        const decoded = audio.module.decode(rxInstance!, floatBytes(event.inputBuffer.getChannelData(0)));
        if (decoded?.length) receiveMessage(new TextDecoder().decode(decoded));
      } catch { receiveStatus.textContent = "Could not decode that sound. Still listening."; }
    };
    streamSource.connect(processor);
    processor.connect(audio.context.destination);
    listening = true;
    listenButton.classList.add("listening");
    $("#listen-label").textContent = "Stop listening";
    receiveStatus.textContent = "Listening now. Keep this page open and the screen awake.";
    receiveStatus.className = "status active-status";
    stream.getAudioTracks()[0]?.addEventListener("ended", () => {
      stopListening();
      receiveStatus.textContent = "The microphone disconnected. Start listening again.";
    });
  } catch (error) {
    if (epoch !== receiveEpoch) return;
    stopListening();
    receiveStatus.textContent = error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone permission was denied. Allow it in your browser settings, then try again." : error instanceof Error ? error.message : "Microphone access failed.";
    receiveStatus.className = "status error-status";
  } finally { if (epoch === receiveEpoch) listenButton.disabled = false; }
});

window.addEventListener("pagehide", () => { stopListening(); sendController?.abort(); });
