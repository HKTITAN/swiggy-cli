import type { Command } from "commander";
import type { ServerName } from "../types/index.js";
import { attachOutputOptions, buildArgs, callTool, oneOf, positiveInt, readGlobalOpts, requireFlag, run } from "./common.js";
import { UsageError } from "../lib/errors.js";

const CATEGORIES = ["HOME", "WORK", "OFFICE", "FRIENDS_AND_FAMILY", "OTHER"] as const;

/**
 * Address commands shared by Food and Instamart (create_address / delete_address went GA for every
 * authenticated user in Aug 2026; lat/lng are optional — Swiggy geocodes server-side).
 */
export function attachAddressCommands(server: Extract<ServerName, "food" | "instamart">, parent: Command): void {
  attachOutputOptions(
    parent
      .command("addresses")
      .description("List saved delivery addresses (most recently used first)")
      .option("--page <n>", "1-based page (default 1)")
      .option("--page-size <n>", "addresses per page (max 10)")
      .action(async (o: { page?: string; pageSize?: string }) => {
        const opts = readGlobalOpts(parent);
        await run(opts, async () => {
          await callTool(server, "get_addresses", await buildArgs({ page: positiveInt(o.page, "--page"), pageSize: positiveInt(o.pageSize, "--page-size") }), opts);
        });
      })
  );

  attachOutputOptions(
    parent
      .command("create-address")
      .description("Create a delivery address (coordinates optional — Swiggy geocodes the address)")
      .option("--full-address <text>", "the complete address as the user wrote it")
      .option("--line1 <text>", "street / building / house number")
      .option("--line2 <text>", "apartment, floor, wing ('' if none)", "")
      .option("--locality <text>", "area or neighbourhood")
      .option("--city <text>", "city")
      .option("--postal-code <code>", "PIN code")
      .option("--category <cat>", `one of ${CATEGORIES.join("|")}`)
      .option("--tag <label>", "friendly label, e.g. 'Home', 'Office'")
      .option("--name <name>", "account holder name")
      .option("--phone <phone>", "account holder phone")
      .option("--receiver-name <name>", "receiver name if delivering to someone else")
      .option("--receiver-phone <phone>", "receiver phone if delivering to someone else")
      .option("--lat <lat>", "latitude (optional)")
      .option("--lng <lng>", "longitude (optional)")
      .option("--input <json>", "raw create_address arguments (merged over flags)")
      .action(
        async (o: {
          fullAddress?: string;
          line1?: string;
          line2?: string;
          locality?: string;
          city?: string;
          postalCode?: string;
          category?: string;
          tag?: string;
          name?: string;
          phone?: string;
          receiverName?: string;
          receiverPhone?: string;
          lat?: string;
          lng?: string;
          input?: string;
        }) => {
          const opts = readGlobalOpts(parent);
          await run(opts, async () => {
            const args = await buildArgs(
              {
                fullAddress: o.fullAddress,
                addressLine: o.line1,
                addressLine2: o.line2 ?? "",
                locality: o.locality,
                city: o.city,
                postalCode: o.postalCode,
                addressCategory: oneOf(o.category, "--category", CATEGORIES),
                addressTag: o.tag,
                userName: o.name,
                userPhone: o.phone,
                receiverName: o.receiverName,
                receiverPhone: o.receiverPhone,
                latitude: o.lat !== undefined ? Number(o.lat) : undefined,
                longitude: o.lng !== undefined ? Number(o.lng) : undefined,
              },
              o.input
            );
            if (!("addressLine2" in args)) args.addressLine2 = "";
            for (const [key, flag] of [
              ["fullAddress", "--full-address"],
              ["addressLine", "--line1"],
              ["city", "--city"],
              ["postalCode", "--postal-code"],
              ["addressCategory", "--category"],
              ["userName", "--name"],
              ["userPhone", "--phone"],
            ] as const) {
              if (args[key] === undefined || args[key] === "") throw new UsageError(`Missing required option ${flag}.`, "Required: --full-address --line1 --city --postal-code --category --name --phone (or --input <json>)");
            }
            await callTool(server, "create_address", args, opts);
          });
        }
      )
  );

  attachOutputOptions(
    parent
      .command("delete-address <addressId>")
      .description("Delete a saved address (destructive)")
      .action(async (addressId: string) => {
        const opts = readGlobalOpts(parent);
        await run(opts, async () => {
          requireFlag(addressId, "<addressId>");
          await callTool(server, "delete_address", { addressId }, opts, undefined, `Delete address ${addressId}`);
        });
      })
  );
}
