import { Action } from "@raycast/api";
import { SCREECHER_WEB_URL } from "./web-link";

export default function CopyWebLinkAction() {
  return (
    <Action.CopyToClipboard
      title="Copy Screecher Web Link"
      content={SCREECHER_WEB_URL}
    />
  );
}
