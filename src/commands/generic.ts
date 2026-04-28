import { Command } from "commander";
import { attachOutputOptions, callTool, readGlobalOpts } from "./common.js";
import { getCurrentProfile, DEFAULT_ENDPOINTS, endpointFor } from "../lib/config.js";
import { McpClient } from "../lib/mcp.js";
import { renderError, renderResult, startSpinner } from "../lib/output.js";
import { SERVER_NAMES, type ServerName } from "../types/index.js";
import { CliError, UsageError } from "../lib/errors.js";
import { TOOL_CATALOG } from "../lib/aliases.js";

export function buildGenericCommands(program: Command): void {
  attachOutputOptions(
    program
      .command("servers")
      .description("List the Swiggy MCP servers this CLI can talk to")
      .action(async () => {
        const opts = readGlobalOpts(program);
        try {
          const { profile, name: profileName } = await getCurrentProfile();
          const data = SERVER_NAMES.map((s) => ({
            name: s,
            url: endpointFor(s, profile),
            default: DEFAULT_ENDPOINTS[s],
            toolCount: TOOL_CATALOG[s].length,
          }));
          renderResult(data, { ...opts, profile: opts.profile || profileName });
        } catch (err) {
          process.exitCode = renderError(err, opts);
        }
      })
  );

  attachOutputOptions(
    program
      .command("tools <server>")
      .description("List tools exposed by a Swiggy MCP server (live discovery)")
      .action(async (server: string) => {
        const opts = readGlobalOpts(program);
        try {
          assertServer(server);
          const { profile, name: profileName } = await getCurrentProfile();
          const sp = startSpinner(`Discovering tools on ${server}…`, opts);
          const client = new McpClient({ server, profile });
          let tools;
          try {
            tools = await client.listTools();
          } finally {
            sp?.stop();
          }
          const data = tools.map((t) => ({ name: t.name, description: t.description ?? "" }));
          renderResult(data, { ...opts, server, profile: opts.profile || profileName });
        } catch (err) {
          process.exitCode = renderError(err, { ...opts, server });
        }
      })
  );

  attachOutputOptions(
    program
      .command("schema <server> <tool>")
      .description("Show the JSON schema for a specific tool")
      .action(async (server: string, tool: string) => {
        const opts = readGlobalOpts(program);
        try {
          assertServer(server);
          const { profile, name: profileName } = await getCurrentProfile();
          const sp = startSpinner(`Fetching schema for ${server}/${tool}…`, opts);
          const client = new McpClient({ server, profile });
          let schema;
          try {
            schema = await client.getToolSchema(tool);
          } finally {
            sp?.stop();
          }
          if (!schema) throw new CliError("NOT_FOUND", `Tool "${tool}" not found on server "${server}".`);
          renderResult(schema, { ...opts, server, tool, profile: opts.profile || profileName });
        } catch (err) {
          process.exitCode = renderError(err, { ...opts, server, tool });
        }
      })
  );

  attachOutputOptions(
    program
      .command("call <server> <tool>")
      .description("Call any MCP tool with a JSON argument payload")
      .option("-i, --input <json>", "tool arguments as a JSON string", "{}")
      .option("--input-file <path>", "read tool arguments from a JSON file")
      .action(async (server: string, tool: string, localOpts: { input?: string; inputFile?: string }) => {
        const opts = readGlobalOpts(program);
        try {
          assertServer(server);
          let args: unknown = {};
          if (localOpts.inputFile) {
            const { readFile } = await import("node:fs/promises");
            args = JSON.parse(await readFile(localOpts.inputFile, "utf8"));
          } else if (localOpts.input) {
            try {
              args = JSON.parse(localOpts.input);
            } catch (e) {
              throw new UsageError(`--input is not valid JSON: ${(e as Error).message}`);
            }
          }
          await callTool(server, tool, args, opts);
        } catch (err) {
          process.exitCode = renderError(err, { ...opts, server, tool });
        }
      })
  );
}

function assertServer(server: string): asserts server is ServerName {
  if (!SERVER_NAMES.includes(server as ServerName)) {
    throw new UsageError(
      `Unknown server "${server}". Valid: ${SERVER_NAMES.join(", ")}`,
      "Run: swiggy servers"
    );
  }
}
