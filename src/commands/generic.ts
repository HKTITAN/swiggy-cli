import { Command } from "commander";
import { attachOutputOptions, callTool, parseJsonInput, readGlobalOpts, run } from "./common.js";
import { getCurrentProfile, DEFAULT_ENDPOINTS, DOCS, SERVER_LABEL, endpointFor } from "../lib/config.js";
import { McpClient } from "../lib/mcp.js";
import { renderResult, startSpinner } from "../lib/output.js";
import { SERVER_NAMES, type ServerName } from "../types/index.js";
import { CliError, NetworkError, UsageError } from "../lib/errors.js";
import { TOOL_CATALOG, TOOL_COUNTS, DESTRUCTIVE_TOOLS, WRITE_TOOLS } from "../lib/aliases.js";
import { USER_AGENT } from "../lib/version.js";

export function assertServer(server: string): asserts server is ServerName {
  if (!SERVER_NAMES.includes(server as ServerName)) {
    throw new UsageError(`Unknown server "${server}". Valid: ${SERVER_NAMES.join(", ")}`, "Run: swiggy servers");
  }
}

/** Accept `im` as shorthand for instamart everywhere a server name is expected. */
export function normalizeServer(server: string): string {
  return server === "im" ? "instamart" : server;
}

export function buildGenericCommands(program: Command): void {
  attachOutputOptions(
    program
      .command("servers")
      .description("List the Swiggy MCP servers this CLI can talk to")
      .action(async () => {
        const opts = readGlobalOpts(program);
        await run(opts, async () => {
          const { profile, name: profileName } = await getCurrentProfile(opts.profile);
          const data = SERVER_NAMES.map((s) => ({
            name: s,
            label: SERVER_LABEL[s],
            url: endpointFor(s, profile),
            default: DEFAULT_ENDPOINTS[s],
            toolCount: TOOL_COUNTS[s],
          }));
          renderResult(data, { ...opts, profile: opts.profile || profileName });
        });
      })
  );

  attachOutputOptions(
    program
      .command("tools <server>")
      .description("List tools exposed by a Swiggy MCP server (live tools/list; needs auth)")
      .option("--offline", "print the bundled catalog instead of calling the server")
      .action(async (serverArg: string, o: { offline?: boolean }) => {
        const opts = readGlobalOpts(program);
        const server = normalizeServer(serverArg);
        await run(
          opts,
          async () => {
            assertServer(server);
            const { profile, name: profileName } = await getCurrentProfile(opts.profile);
            if (o.offline) {
              const data = TOOL_CATALOG[server].map((name) => ({ name, destructive: DESTRUCTIVE_TOOLS.has(name), write: WRITE_TOOLS.has(name) }));
              renderResult(data, { ...opts, server, profile: opts.profile || profileName, meta: { source: "bundled catalog (2026-09-05)" } });
              return;
            }
            const sp = startSpinner(`discovering tools on ${server}`, opts);
            const client = new McpClient({ server, profile });
            let tools;
            try {
              tools = await client.listTools();
              sp.succeed(`${tools.length} tools on ${server}`);
            } catch (err) {
              sp.fail(`tools/list on ${server}`);
              throw err;
            }
            const known = new Set(TOOL_CATALOG[server]);
            const data = tools.map((t) => ({ name: t.name, description: t.description ?? "", destructive: DESTRUCTIVE_TOOLS.has(t.name), inCatalog: known.has(t.name) }));
            const missing = TOOL_CATALOG[server].filter((n) => !tools.some((t) => t.name === n));
            renderResult(data, { ...opts, server, profile: opts.profile || profileName, meta: { rateLimit: client.lastRateLimit, notInCatalog: data.filter((d) => !d.inCatalog).map((d) => d.name), missingFromServer: missing } });
          },
          { server }
        );
      })
  );

  attachOutputOptions(
    program
      .command("schema <server> <tool>")
      .description("Show the live JSON Schema for a tool's arguments")
      .action(async (serverArg: string, tool: string) => {
        const opts = readGlobalOpts(program);
        const server = normalizeServer(serverArg);
        await run(
          opts,
          async () => {
            assertServer(server);
            const { profile, name: profileName } = await getCurrentProfile(opts.profile);
            const sp = startSpinner(`fetching schema for ${server}/${tool}`, opts);
            const client = new McpClient({ server, profile });
            let schema;
            try {
              schema = await client.getToolSchema(tool);
              sp.stop();
            } catch (err) {
              sp.fail(`schema ${server}/${tool}`);
              throw err;
            }
            if (!schema) throw new CliError("NOT_FOUND", `Tool "${tool}" not found on server "${server}".`, { hint: `Run: swiggy tools ${server}` });
            renderResult(schema, { ...opts, server, tool, profile: opts.profile || profileName });
          },
          { server, tool }
        );
      })
  );

  attachOutputOptions(
    program
      .command("call <server> <tool>")
      .description("Call any MCP tool with a JSON argument payload (the universal escape hatch)")
      .option("-i, --input <json>", "tool arguments as a JSON string", "{}")
      .option("--input-file <path>", "read tool arguments from a JSON file")
      .action(async (serverArg: string, tool: string, localOpts: { input?: string; inputFile?: string }) => {
        const opts = readGlobalOpts(program);
        const server = normalizeServer(serverArg);
        await run(
          opts,
          async () => {
            assertServer(server);
            let args: unknown = {};
            if (localOpts.inputFile) {
              const { readFile } = await import("node:fs/promises");
              args = parseJsonInput(await readFile(localOpts.inputFile, "utf8"), "--input-file");
            } else if (localOpts.input) {
              args = parseJsonInput(localOpts.input);
            }
            await callTool(server, tool, args, opts);
          },
          { server, tool }
        );
      })
  );

  attachOutputOptions(
    program
      .command("docs [path]")
      .description("Fetch Swiggy Builders Club docs as Markdown (index by default; e.g. `docs reference/food/search_menu`)")
      .option("--full", "fetch llms-full.txt (every page, ~400 KB)")
      .action(async (path: string | undefined, o: { full?: boolean }) => {
        const opts = readGlobalOpts(program);
        await run(opts, async () => {
          let url: string;
          if (o.full) url = DOCS.full;
          else if (!path) url = DOCS.index;
          else if (/^https?:\/\//.test(path)) url = path.endsWith(".md") || path.endsWith(".txt") ? path : `${path.replace(/\/$/, "")}.md`;
          else {
            const clean = path.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.md$/, "");
            const prefixed = clean.startsWith("docs/") || clean.startsWith("blog/") ? clean : `docs/${clean}`;
            url = `${DOCS.base}/${prefixed}.md`;
          }
          const sp = startSpinner(`fetching ${url}`, opts);
          let res: Response;
          try {
            res = await fetch(url, { headers: { accept: "text/markdown, text/plain", "user-agent": USER_AGENT } });
          } catch (err) {
            sp.fail("docs");
            throw new NetworkError(`Could not fetch ${url}: ${(err as Error).message}`);
          }
          if (!res.ok) {
            sp.fail("docs");
            throw new CliError("NOT_FOUND", `Docs page not found: ${url} (HTTP ${res.status})`, { hint: "Paths look like reference/food/search_menu, start/authenticate, operate/rate-limits. Run `swiggy docs` for the index." });
          }
          const text = await res.text();
          sp.succeed(`docs ${url}`);
          if (opts.json || opts.plain || opts.raw) renderResult({ url, markdown: text }, { ...opts, tool: "docs" });
          else process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
        });
      })
  );

  attachOutputOptions(
    program
      .command("mcp-config")
      .description("Print MCP client config for the official Swiggy servers (claude|cursor|vscode|windsurf|codex|plugin|generic)")
      .option("--client <name>", "target client", "generic")
      .option("--servers <list>", "comma-separated subset: food,instamart,dineout", "food,instamart,dineout")
      .action(async (o: { client: string; servers: string }) => {
        const opts = readGlobalOpts(program);
        await run(opts, async () => {
          const wanted = o.servers.split(",").map((s) => normalizeServer(s.trim())).filter(Boolean);
          for (const s of wanted) assertServer(s);
          const entries = wanted.map((s) => [`swiggy-${s}`, DEFAULT_ENDPOINTS[s as ServerName]] as const);
          const config = mcpConfigFor(o.client.toLowerCase(), entries);
          if (opts.json || opts.raw) renderResult(config.body, { ...opts, tool: "mcp-config", meta: { client: o.client, file: config.file } });
          else if (opts.plain) process.stdout.write(`${JSON.stringify(config.body)}\n`);
          else process.stdout.write(`${config.file ? `# ${config.file}\n` : ""}${JSON.stringify(config.body, null, 2)}\n${config.note ? `\n${config.note}\n` : ""}`);
        });
      })
  );
}

function mcpConfigFor(client: string, entries: ReadonlyArray<readonly [string, string]>): { body: unknown; file?: string; note?: string } {
  const obj = <T>(f: (name: string, url: string) => T): Record<string, T> => Object.fromEntries(entries.map(([n, u]) => [n, f(n, u)]));
  switch (client) {
    case "claude":
    case "claude-desktop":
      return {
        file: process.platform === "win32" ? "%APPDATA%\\Claude\\claude_desktop_config.json" : "~/Library/Application Support/Claude/claude_desktop_config.json",
        body: { mcpServers: obj((_n, url) => ({ command: "npx", args: ["mcp-remote", url] })) },
        note: "Claude Desktop (Pro) can also add these under Settings → Connectors → Add custom connector with just the URL.",
      };
    case "claude-code":
      return { file: ".mcp.json", body: { mcpServers: obj((_n, url) => ({ type: "http", url })) }, note: "Or: claude mcp add --transport http swiggy-food https://mcp.swiggy.com/food" };
    case "cursor":
      return { file: "~/.cursor/mcp.json", body: { mcpServers: obj((_n, url) => ({ type: "http", url })) } };
    case "vscode":
    case "copilot":
      return { file: "settings.json", body: { "github.copilot.chat.mcp.servers": obj((_n, url) => ({ url })) } };
    case "windsurf":
      return { file: "~/.codeium/windsurf/mcp_config.json", body: { mcpServers: obj((_n, url) => ({ url })) } };
    case "codex":
      return { file: "~/.codex/config.toml", body: { mcp_servers: obj((_n, url) => ({ url })) }, note: "Codex config is TOML; translate each entry to [mcp_servers.<name>] url = \"...\"." };
    case "plugin":
    case "agent-plugins":
      return {
        file: "mcp.json (Agent Plugins 1.0.0)",
        body: { $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json", mcpServers: obj((_n, url) => ({ type: "streamable-http", url })) },
      };
    default:
      return { body: { mcpServers: obj((_n, url) => ({ type: "http", url })) }, note: "Transport: Streamable HTTP · Auth: OAuth 2.1 + PKCE (dynamic client registration) · Docs: https://mcp.swiggy.com/builders/docs/start/consumer/use-in-ai-client/" };
  }
}
