import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
try {
  writeFileSync(
    ".dev.vars",
    `# Private local development token; do not commit.\nADMIN_DEV_TOKEN="${randomBytes(32).toString("hex")}"\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created private .dev.vars for local admin testing. No cloud resources were created.",
  );
} catch (error) {
  if (error.code === "EEXIST") console.log("Existing .dev.vars was preserved.");
  else throw error;
}
