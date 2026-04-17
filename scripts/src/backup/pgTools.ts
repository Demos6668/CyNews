import { spawn } from "node:child_process";

export interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number;
}

export async function runCommand(
  cmd: string,
  args: ReadonlyArray<string>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? -1 });
    });
  });
}

export async function assertPgTool(tool: "pg_dump" | "pg_restore"): Promise<string> {
  try {
    const result = await runCommand(tool, ["--version"]);
    if (result.code !== 0) {
      throw new Error(`${tool} --version exited with code ${result.code}: ${result.stderr.trim()}`);
    }
    return result.stdout.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Unable to execute ${tool}. Ensure PostgreSQL client tools are installed and on PATH. Underlying error: ${msg}`,
    );
  }
}
