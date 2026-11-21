import { watchDatabaseUpgrade } from "./lib/bootDatabaseUpgrade";
import { showBootError } from "./lib/bootError";

watchDatabaseUpgrade();
// Shared dev chunks need the React refresh preamble first. Catch failures before React mounts.
void import("./main").then(({ startup }) => startup).catch(showBootError);
