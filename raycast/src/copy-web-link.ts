import { Clipboard, showHUD } from "@raycast/api";
import { SCREECHER_WEB_URL } from "./web-link";

export default async function CopyWebLink() {
  await Clipboard.copy(SCREECHER_WEB_URL);
  await showHUD("Screecher web link copied");
}
