import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  Icon,
  Toast,
  showToast,
} from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { createPackets, validateUrl } from "../../src/transfer";
import { transmit } from "./audio";

export default function Send() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    "Ready when you are. Turn up the volume and keep the receiver nearby.",
  );
  const [error, setError] = useState<string>();
  const current = useRef<AbortController | null>(null);
  const loadedClipboard = useRef(false);
  useEffect(() => {
    let mounted = true;
    Clipboard.readText().then((text) => {
      if (!mounted || loadedClipboard.current) return;
      try {
        setUrl(validateUrl(text ?? ""));
      } catch {
        /* Non-link clipboard contents stay out of the form. */
      }
    });
    return () => {
      mounted = false;
      current.current?.abort();
    };
  }, []);
  let info = "Paste a complete http or https URL, up to 2048 bytes.";
  try {
    const normalized = validateUrl(url);
    const count = createPackets(normalized, "00000000").length;
    info = `${Buffer.byteLength(normalized)} bytes · ${count} ${count === 1 ? "chirp" : "chirps"}. The entire URL travels through sound.`;
  } catch {
    /* Show the input hint until a URL is valid. */
  }
  async function share() {
    if (current.current) return;
    let normalized: string;
    try {
      normalized = validateUrl(url);
      setError(undefined);
    } catch (failure) {
      setError((failure as Error).message);
      return;
    }
    const controller = new AbortController();
    current.current = controller;
    setBusy(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Sharing link",
    });
    try {
      await transmit(normalized, controller.signal, (part, total) => {
        const message = `Chirp ${part} of ${total}. Keep the receiver listening.`;
        setStatus(message);
        toast.message = message;
      });
      setStatus("Sent! Share again whenever you like.");
      toast.style = Toast.Style.Success;
      toast.title = "Link sent";
      toast.message = "Share again to repeat it.";
    } catch (failure) {
      const message = controller.signal.aborted
        ? "Stopped. Share again to resend the complete link."
        : (failure as Error).message;
      setStatus(message);
      toast.title = controller.signal.aborted
        ? "Sharing stopped"
        : "Could not share";
      toast.style = controller.signal.aborted
        ? Toast.Style.Success
        : Toast.Style.Failure;
      toast.message = message;
    } finally {
      current.current = null;
      setBusy(false);
    }
  }
  return (
    <Form
      navigationTitle="Screecher · Send"
      isLoading={busy}
      actions={
        <ActionPanel>
          {busy ? (
            <Action
              title="Stop Chirping"
              icon={Icon.Stop}
              onAction={() => current.current?.abort()}
            />
          ) : (
            <Action.SubmitForm
              title="Share with a Chirp"
              icon={Icon.SpeakerHigh}
              onSubmit={share}
            />
          )}
          <Action
            title="Load Link from Clipboard"
            icon={Icon.Clipboard}
            shortcut={{ modifiers: ["cmd"], key: "l" }}
            onAction={async () => {
              if (current.current) return;
              try {
                setUrl(validateUrl((await Clipboard.readText()) ?? ""));
                setError(undefined);
              } catch (failure) {
                setError((failure as Error).message);
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="Link to Share"
        placeholder="https://example.com/anything"
        value={url}
        error={error}
        onChange={(value) => {
          loadedClipboard.current = true;
          if (!current.current) {
            setUrl(value);
            setError(undefined);
          }
        }}
      />
      <Form.Description title="Chirps" text={info} />
      <Form.Description title="Status" text={status} />
      <Form.Description
        title="Nearby Sharing"
        text="Open Screecher on the other device and start receiving. Links are audible and are not encrypted."
      />
    </Form>
  );
}
