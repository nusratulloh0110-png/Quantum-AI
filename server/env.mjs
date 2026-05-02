import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const parseEnvLine = (line) => {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const equalsIndex = trimmed.indexOf("=");

  if (equalsIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return [key, value];
};

export const loadLocalEnv = () => {
  const fileNames =
    process.env.NODE_ENV === "production"
      ? [".env.production", ".env"]
      : [".env.local", ".env"];

  for (const fileName of fileNames) {
    const envPath = resolve(process.cwd(), fileName);

    if (!existsSync(envPath)) {
      continue;
    }

    const content = readFileSync(envPath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const entry = parseEnvLine(line);

      if (!entry) {
        continue;
      }

      const [key, value] = entry;

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
};
