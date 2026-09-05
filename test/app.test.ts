import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMockMcp } from "./helpers/mock-mcp.js";
import { FakeTTY, KEY, pretendTTY, until } from "./helpers/fake-tty.js";

/**
 * Drives the full-screen app end to end through fake terminal streams against the mock MCP server:
 * address picker → search → arrow keys → Enter drills into a menu → Enter adds to cart →
 * destructive confirm (n / y) → help, tab completion → quit. This is what a human sees after `swiggy`.
 */

let mock: Awaited<ReturnType<typeof startMockMcp>>;
let home: string;
let restore: () => void;
let app: typeof import("../src/tui/app.js");
let buildProgram: typeof import("../src/program.js").buildProgram;

beforeAll(async () => {
  mock = await startMockMcp();
  home = await mkdtemp(join(tmpdir(), "swiggy-app-"));
  await writeFile(join(home, "auth.json"), JSON.stringify({ servers: { food: { accessToken: "test-token", expiresAt: Date.now() + 86_400_000 } } }));
  await writeFile(join(home, "config.json"), JSON.stringify({ currentProfile: "default", profiles: { default: { output: "human" } } }));
  process.env.SWIGGY_HOME = home;
  process.env.SWIGGY_FOOD_URL = mock.url;
  process.env.SWIGGY_NO_BANNER = "1";
  restore = pretendTTY();
  app = await import("../src/tui/app.js");
  buildProgram = (await import("../src/program.js")).buildProgram;
});

afterAll(async () => {
  restore();
  await mock.close();
});

function streams() {
  const stdin = new FakeTTY();
  const stdout = FakeTTY.output();
  return { stdin, stdout, io: { stdin: stdin as unknown as NodeJS.ReadStream, stdout: stdout as unknown as NodeJS.WriteStream }, screen: () => stdout.screen().join("\n") };
}

describe("swiggy app (full-screen session)", () => {
  it("walks search → menu → add → confirm → quit with the keyboard", async () => {
    const { stdin, stdout, io, screen } = streams();
    const done = app.runApp(buildProgram, io);

    await until(() => screen().includes("no default address"), "startup frame", screen);
    expect(stdout.chunks.join("")).toContain("\u001b[?1049h"); // alternate screen: the user's scrollback survives
    expect(screen()).toContain("signed in");
    expect(screen()).toContain("Powered by Swiggy");

    // typing shows on the command line; Enter runs it
    stdin.write("food search biryani");
    await until(() => screen().includes("› food search biryani"), "typed command", screen);
    stdin.write(KEY.enter);

    // no default address → the picker is answered inside the app (not by the prompts library)
    await until(() => screen().includes("Delivery address for"), "address picker", screen);
    expect(screen()).toContain("Home · 12B Sobha Lotus");
    stdin.write(KEY.down);
    await until(() => /#2 .*Work/.test(screen()), "second address selected", screen);
    stdin.write(KEY.enter);

    // results render as the native table and the rows become selectable
    await until(() => screen().includes("Behrouz Biryani") && screen().includes("2 rows"), "search results", screen);
    const search = mock.state.calls.find((c) => c.name === "search_restaurants");
    expect(search?.args).toMatchObject({ addressId: "addr_2", query: "biryani" });
    expect(screen()).toContain("Enter: open menu");

    // ↓ then Enter opens the menu of row 2
    stdin.write(KEY.down);
    await until(() => screen().includes("#2 Behrouz"), "row 2 selected", screen);
    stdin.write(KEY.enter);
    await until(() => screen().includes("Paneer Biryani") && screen().includes("Enter: add 1 to cart"), "menu view", screen);
    const menu = mock.state.calls.filter((c) => c.name === "get_restaurant_menu").at(-1);
    expect(menu?.args).toMatchObject({ restaurantId: "r2" });

    // Enter on a menu item adds it and shows the cart
    stdin.write(KEY.enter);
    await until(() => mock.state.calls.some((c) => c.name === "update_food_cart"), "add to cart", screen);
    await until(() => screen().includes("Chicken Dum Biryani") && !screen().includes("running"), "cart view", screen);

    // a destructive command asks inline; n cancels, y proceeds
    stdin.write("food clear" + KEY.enter);
    await until(() => screen().includes("[y/n]"), "confirmation prompt", screen);
    expect(mock.state.calls.some((c) => c.name === "flush_food_cart")).toBe(false);
    stdin.write("n");
    await until(() => !screen().includes("[y/n]") && !screen().includes("running"), "prompt dismissed", screen);
    expect(mock.state.calls.some((c) => c.name === "flush_food_cart")).toBe(false);
    stdin.write("food clear" + KEY.enter);
    await until(() => screen().includes("[y/n]"), "second confirmation prompt", screen);
    stdin.write("y");
    await until(() => mock.state.calls.some((c) => c.name === "flush_food_cart"), "flush called", screen);
    await until(() => !screen().includes("running"), "clear finished", screen);

    // ? shows help; Tab completes; Ctrl+U clears the line
    stdin.write("?");
    await until(() => screen().includes("move the selection"), "help", screen);
    stdin.write("food sea");
    await until(() => screen().includes("› food sea"), "partial input", screen);
    stdin.write(KEY.tab);
    await until(() => screen().includes("› food search") && screen().includes("search-menu"), "tab completion fills the shared prefix and lists candidates", screen);
    stdin.write("-m" + KEY.tab);
    await until(() => screen().includes("› food search-menu"), "unique completion", screen);
    stdin.write(KEY.ctrlU);
    await until(() => !screen().includes("› food search"), "line cleared", screen);

    // q on an empty line quits and restores the terminal
    stdin.write("q");
    await done;
    const all = stdout.chunks.join("");
    expect(all.endsWith("\u001b[?25h\u001b[?1049l")).toBe(true);
    expect(stdin.isRaw).toBe(false);

    const history = await readFile(join(home, "history"), "utf8");
    expect(history).toContain("food search biryani");
    expect(history).toContain("food clear");
  }, 30_000);

  it("shows errors from commands in the pane and stays alive", async () => {
    const { stdin, io, screen } = streams();
    const done = app.runApp(buildProgram, io);
    await until(() => screen().includes("swiggy"), "startup", screen);
    const idle = () => !screen().includes("running");
    // two lines typed back to back: the second is entered while the first runs and must not be dropped
    stdin.write("profile set default bogusKey 1" + KEY.enter + "nonsense" + KEY.enter);
    await until(() => /Unknown profile key/.test(screen()), "usage error shown", screen);
    await until(() => /unknown command "nonsense"/i.test(screen()) && idle(), "typed-ahead command ran after the first", screen);
    stdin.write("food nonsense" + KEY.enter);
    await until(() => /unknown command 'nonsense'/i.test(screen()) && idle(), "unknown subcommand shown (commander exit intercepted)", screen);
    stdin.write("food menu --help" + KEY.enter);
    await until(() => /Usage: swiggy food menu/i.test(screen()) && idle(), "help output captured", screen);
    stdin.write("q");
    await done;
  }, 20_000);

  it("refuses to start without a terminal", async () => {
    const { stdin, io } = streams();
    stdin.isTTY = false;
    await app.runApp(buildProgram, io);
    expect(process.exitCode).toBe(2);
    process.exitCode = 0;
  });
});

describe("app helpers", () => {
  it("measures and slices ANSI strings by visible width", () => {
    const s = "\u001b[31mhello\u001b[0m world";
    expect(app.visibleWidth(s)).toBe(11);
    expect(app.stripAnsi(app.sliceAnsi(s, 7))).toBe("hello w");
    expect(app.stripAnsi(app.sliceAnsi("a\u001b]8;;https://x\u0007link\u001b]8;;\u0007b", 2))).toBe("al");
    expect(app.visibleWidth("🍛 x")).toBe(4);
  });

  it("completes the shared prefix", () => {
    expect(app.commonPrefix(["search", "search-menu"])).toBe("search");
    expect(app.commonPrefix(["cart", "checkout"])).toBe("c");
    expect(app.commonPrefix([])).toBe("");
  });

  it("maps a selected row to the obvious next command", () => {
    expect(app.actionFor("restaurants", "food", 3)).toEqual({ run: "food menu 3" });
    expect(app.actionFor("menuItems", "food", 1)).toEqual({ run: "food add 1 --qty 1" });
    expect(app.actionFor("products", "instamart", 2)).toEqual({ run: "instamart add 2 --qty 1" });
    expect(app.actionFor("dineout", "dineout", 1)).toEqual({ run: "dineout slots 1" });
    expect(app.actionFor("slots", "dineout", 2, { id: "x", label: "y", extra: { isFree: false } })).toEqual({ prefill: "dineout book 2 --guests 2 --pay upi --wait" });
    expect(app.actionFor("slots", "dineout", 2, { id: "x", label: "y", extra: { isFree: true } })).toEqual({ prefill: "dineout book 2 --guests 2" });
    expect(app.actionFor("orders", "food", 1)).toEqual({ run: "food order 1" });
    expect(app.actionFor("orders", "instamart", 1)).toEqual({ run: "instamart order 1" });
    expect(app.actionFor("orders", "dineout", 1)).toEqual({ run: "dineout status 1" });
    expect(app.actionFor("addresses", "food", 1)).toEqual({ special: "default-address" });
    expect(app.actionFor("coupons", "food", 1)).toEqual({});
    expect(app.actionFor(undefined, undefined, 1)).toEqual({});
  });
});
