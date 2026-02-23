import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getClient } from "../client.js";
import { resolveFormat, output } from "../output.js";
import { withErrorHandling } from "../errors.js";
import { formatPrice } from "../utils/format.js";

interface ICategory {
  id: string;
  name: string;
  imageId?: string;
}

interface ICategoryProduct {
  id: string;
  name: string;
  price: number | null;
  unitQuantity: string;
  imageId?: string;
}

/** Extract categories from search-page-root PML response */
function extractCategories(page: any): ICategory[] {
  const categories: ICategory[] = [];

  function walk(obj: any, depth = 0): void {
    if (obj === null || obj === undefined || typeof obj !== "object" || depth > 15) return;

    // Look for PML items with id "core-list-item-category-*"
    if (typeof obj.id === "string" && obj.id.startsWith("core-list-item-category-")) {
      const catId = obj.id.replace("core-list-item-category-", "");
      const name = obj.pml?.component?.accessibilityLabel ?? "";
      const imageId = findImageId(obj.pml?.component);
      if (name) {
        categories.push({ id: catId, name, imageId });
      }
    }

    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) v.forEach((item) => walk(item, depth + 1));
      else if (typeof v === "object" && v !== null) walk(v, depth + 1);
    }
  }

  walk(page);
  return categories;
}

/** Extract products from an L1 category page response */
function extractCategoryProducts(page: any): ICategoryProduct[] {
  const products: ICategoryProduct[] = [];

  function walk(obj: any, depth = 0): void {
    if (obj === null || obj === undefined || typeof obj !== "object" || depth > 15) return;

    // Products appear as sellingUnit objects within the page
    if (obj.sellingUnit && obj.sellingUnit.name) {
      const su = obj.sellingUnit;
      products.push({
        id: su.id ?? "unknown",
        name: su.name,
        price: su.display_price ?? null,
        unitQuantity: su.unit_quantity ?? "",
        imageId: su.image_id,
      });
    }

    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) v.forEach((item) => walk(item, depth + 1));
      else if (typeof v === "object" && v !== null) walk(v, depth + 1);
    }
  }

  walk(page);
  return products;
}

/** Find first image source id in a PML component tree */
function findImageId(obj: any, depth = 0): string | undefined {
  if (obj === null || obj === undefined || typeof obj !== "object" || depth > 8) return undefined;
  if (obj.type === "IMAGE" && obj.source?.id) return obj.source.id;
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        const r = findImageId(item, depth + 1);
        if (r) return r;
      }
    } else if (typeof v === "object" && v !== null) {
      const r = findImageId(v, depth + 1);
      if (r) return r;
    }
  }
  return undefined;
}

/** Extract subcategories from a category page (PML list items) */
function extractSubcategories(page: any): ICategory[] {
  const subs: ICategory[] = [];
  const seen = new Set<string>();

  function walk(obj: any, depth = 0): void {
    if (obj === null || obj === undefined || typeof obj !== "object" || depth > 15) return;

    // PML items with id "core-list-item-category-*" (same format as top-level)
    if (typeof obj.id === "string" && obj.id.startsWith("core-list-item-category-")) {
      const catId = obj.id.replace("core-list-item-category-", "");
      const name = obj.pml?.component?.accessibilityLabel ?? "";
      if (name && !seen.has(catId)) {
        seen.add(catId);
        subs.push({ id: catId, name });
      }
    }

    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) v.forEach((item) => walk(item, depth + 1));
      else if (typeof v === "object" && v !== null) walk(v, depth + 1);
    }
  }

  walk(page);
  return subs;
}

export function registerCategoryCommands(program: Command): void {
  program
    .command("categories")
    .description("Browse product categories")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching categories…").start();

        const client = getClient(opts.country);
        const page = await client.sendRequest("GET", "/pages/search-page-root", null, true);

        spinner?.stop();

        const cats = extractCategories(page);

        output(cats, format, (data) => {
          if (!data.length) return chalk.dim("No categories found.");
          return data
            .map((c: ICategory) => `  ${chalk.bold(c.name)}  ${chalk.dim(c.id)}`)
            .join("\n");
        }, (data) => {
          if (!data.length) return "No categories found.";
          const table = new Table({ head: ["ID", "Name"] });
          for (const c of data) {
            table.push([c.id, c.name]);
          }
          return table.toString();
        });
      }),
    );

  program
    .command("category <id>")
    .description("Browse a category (shows subcategories and/or products)")
    .action(
      withErrorHandling(async (categoryId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching category…").start();

        const client = getClient(opts.country);
        const page = await client.sendRequest(
          "GET",
          `/pages/L1-category-page-root?category_id=${categoryId}`,
          null,
          true,
        );

        spinner?.stop();

        // Try to find subcategories first, then products
        const subs = extractSubcategories(page);
        const products = extractCategoryProducts(page);

        // Wrap for output
        const result = { subcategories: subs, products, raw: page };

        output(result, format, (data) => {
          const lines: string[] = [];

          if (data.subcategories.length) {
            lines.push(chalk.bold("Subcategories:"));
            for (const s of data.subcategories) {
              lines.push(`  ${chalk.bold(s.name)}  ${chalk.dim(s.id)}`);
            }
          }

          if (data.products.length) {
            if (lines.length) lines.push("");
            lines.push(chalk.bold(`Products (${data.products.length}):`));
            for (const p of data.products) {
              const price = p.price != null ? formatPrice(p.price) : "";
              lines.push(`  ${chalk.bold(p.name)}  ${price}  ${p.unitQuantity}  ${chalk.dim(p.id)}`);
            }
          }

          if (!lines.length) {
            return chalk.dim("This is a leaf category. Use 'picnic search <query>' to find products.");
          }

          return lines.join("\n");
        }, (data) => {
          const lines: string[] = [];

          if (data.subcategories.length) {
            const table = new Table({ head: ["ID", "Subcategory"] });
            for (const s of data.subcategories) {
              table.push([s.id, s.name]);
            }
            lines.push(table.toString());
          }

          if (data.products.length) {
            const table = new Table({ head: ["ID", "Name", "Price", "Unit"] });
            for (const p of data.products) {
              table.push([p.id, p.name, p.price != null ? formatPrice(p.price) : "-", p.unitQuantity]);
            }
            lines.push(table.toString());
          }

          return lines.join("\n\n") || "No data found.";
        });
      }),
    );
}
