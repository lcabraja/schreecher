import {
  Action,
  ActionPanel,
  Icon,
  List,
  Toast,
  showToast,
} from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { randomUUID } from "node:crypto";
import { listenViaCompanion } from "./companion";

type Link = { id: string; url: string; at: Date };
export default function Receive() {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState(
    "Microphone is off. Start listening to catch nearby chirps.",
  );
  const [links, setLinks] = useState<Link[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function stop() {
    controller.current?.abort();
    controller.current = null;
    setActive(false);
    setStatus(
      "Microphone is off. Received links remain here until you leave this command.",
    );
  }
  async function start() {
    if (controller.current) return;
    const signal = new AbortController();
    controller.current = signal;
    setActive(true);
    setStatus("Starting the audio companion…");
    try {
      listenViaCompanion(signal.signal, {
        status: (message) => {
          if (!signal.signal.aborted) setStatus(message);
        },
        received: (url) => {
          if (!signal.signal.aborted)
            setLinks((items) => [
              { id: randomUUID(), url, at: new Date() },
              ...items,
            ]);
        },
        failed: (error) => {
          if (signal.signal.aborted) return;
          signal.abort();
          controller.current = null;
          setActive(false);
          setStatus(error.message);
          void showToast({
            style: Toast.Style.Failure,
            title: "Could not listen",
            message: error.message,
          });
        },
      });
    } catch (error) {
      if (signal.signal.aborted) return;
      controller.current = null;
      setActive(false);
      setStatus((error as Error).message);
      void showToast({
        style: Toast.Style.Failure,
        title: "Could not listen",
        message: (error as Error).message,
      });
    }
  }
  const toggle = (
    <Action
      title={active ? "Stop Listening" : "Start Listening"}
      icon={active ? Icon.Stop : Icon.Microphone}
      onAction={active ? stop : start}
      shortcut={{ modifiers: ["cmd"], key: "l" }}
    />
  );
  return (
    <List
      navigationTitle={`Screecher · Receive · ${links.length} links`}
      searchBarPlaceholder="Search received links"
      isLoading={active}
      isShowingDetail={links.length > 0}
      actions={<ActionPanel>{toggle}</ActionPanel>}
    >
      {links.length === 0 ? (
        <List.EmptyView
          icon={Icon.Microphone}
          title={active ? "Listening for chirps" : "Catch a link through sound"}
          description={`${status}\nKeep this command open and the sender nearby. Nothing opens automatically.`}
          actions={<ActionPanel>{toggle}</ActionPanel>}
        />
      ) : (
        <List.Section title={status}>
          {links.map((link) => (
            <List.Item
              key={link.id}
              id={link.id}
              icon={Icon.Link}
              title={new URL(link.url).hostname}
              subtitle={link.url}
              keywords={[link.url]}
              accessories={[
                {
                  text: link.at.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
              ]}
              detail={
                <List.Item.Detail
                  markdown={`# ${new URL(link.url).hostname}\n\n${link.url.replace(/[\\`*_[\]<>#]/g, "\\$&")}\n\n${status}`}
                />
              }
              actions={
                <ActionPanel>
                  <Action.OpenInBrowser
                    title="Open Received Link"
                    url={link.url}
                  />
                  <Action.CopyToClipboard
                    title="Copy Complete Link"
                    content={link.url}
                  />
                  {toggle}
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}
