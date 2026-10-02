import { connect } from "node:net";
import { companionSocket } from "../src/companion";
const client = connect(companionSocket);
client.on("connect", () => client.write('{"type":"shutdown"}\n'));
client.on("data", () => console.log("Screecher audio companion stopped."));
client.on("error", (error) => {
  if (
    (error as NodeJS.ErrnoException).code === "ENOENT" ||
    (error as NodeJS.ErrnoException).code === "ECONNREFUSED"
  )
    console.log("The companion is already stopped.");
  else {
    console.error(error.message);
    process.exitCode = 1;
  }
});
