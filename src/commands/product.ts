import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { writeFile } from "node:fs/promises";
import { getClient } from "../client.js";
import { resolveFormat, output } from "../output.js";
import { withErrorHandling } from "../errors.js";
import { formatPrice } from "../utils/format.js";

/** Strip Picnic's custom markdown color syntax: #(#hex)text#(#hex) → text */
function stripPicnicMarkdown(md: string): string {
  return md.replace(/#\([A-Za-z0-9#]+\)/g, "").replace(/\*\*/g, "").trim();
}

/** Extract markdown text nodes from nested PML/page structure */
function extractMarkdownTexts(obj: any, results: string[] = []): string[] {
  if (obj === null || obj === undefined || typeof obj !== "object") return results;
  if (obj.markdown && typeof obj.markdown === "string") {
    const clean = stripPicnicMarkdown(obj.markdown);
    if (clean.length > 1) results.push(clean);
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) v.forEach((item) => extractMarkdownTexts(item, results));
    else if (typeof v === "object" && v !== null) extractMarkdownTexts(v, results);
  }
  return results;
}

/** Find a section by id prefix in the page body children */
function findSection(sections: any[], idPrefix: string): any | undefined {
  return sections.find((s: any) => typeof s?.id === "string" && s.id.startsWith(idPrefix));
}

/** Extract product info from product details page response */
function extractProductInfo(page: any): {
  id: string;
  name: string;
  brand: string;
  unitQuantity: string;
  basePrice: string;
  displayPrice: number | null;
  description: string;
  highlights: string[];
  allergens: string[];
  ingredients: string;
  raw: any;
} {
  // Navigate to the content sections
  // Structure: body > child > child > children[1] ("root-content") > children[...]
  // Find the "root-content" block which contains all product detail sections
  let sections: any[] = [];
  function findContentSections(obj: any, depth = 0): boolean {
    if (obj === null || obj === undefined || typeof obj !== "object" || depth > 8) return false;
    if (obj.id === "root-content" && Array.isArray(obj.children)) {
      sections = obj.children;
      return true;
    }
    if (obj.child && findContentSections(obj.child, depth + 1)) return true;
    if (Array.isArray(obj.children)) {
      for (const c of obj.children) {
        if (findContentSections(c, depth + 1)) return true;
      }
    }
    return false;
  }
  findContentSections(page?.body ?? page);

  // Main info section: "product-details-page-root-main-container"
  const mainSection = findSection(sections, "product-details-page-root-main-container");
  const mainTexts = mainSection ? extractMarkdownTexts(mainSection) : [];

  // Highlights: "highlight-container"
  const hlSection = findSection(sections, "highlight-container");
  const hlTexts = hlSection ? extractMarkdownTexts(hlSection) : [];

  // Allergens: "allergy-container"
  const allergySection = findSection(sections, "allergy-container");
  const allergyTexts = allergySection ? extractMarkdownTexts(allergySection) : [];

  // Ingredients/nutrition: "accordion-section"
  const accordionSection = findSection(sections, "accordion-section");
  const accTexts = accordionSection ? extractMarkdownTexts(accordionSection) : [];

  // Find the sellingUnit with display_price for accurate pricing
  let displayPrice: number | null = null;
  let productId = "unknown";
  function findPricedUnit(obj: any) {
    if (obj === null || obj === undefined || typeof obj !== "object") return;
    if (obj.sellingUnit?.display_price != null) {
      displayPrice = obj.sellingUnit.display_price;
      productId = obj.sellingUnit.id ?? productId;
      return;
    }
    if (obj.sellingUnit?.id) productId = obj.sellingUnit.id;
    for (const v of Object.values(obj)) {
      if (displayPrice != null) return;
      if (Array.isArray(v)) v.forEach((item) => findPricedUnit(item));
      else if (typeof v === "object" && v !== null) findPricedUnit(v);
    }
  }
  findPricedUnit(page);

  // Long description from highlight section (not a short label)
  const shortHighlights = hlTexts.filter((t) => t.length < 80 && t.length > 3);
  const desc = hlTexts.find((t) => t.length >= 80) ?? "";
  const ingredients = accTexts.find((t) => t.startsWith("Ingrediënt")) ?? "";

  return {
    id: productId,
    name: mainTexts[0] ?? "Unknown",
    brand: mainTexts[1] ?? "",
    unitQuantity: mainTexts[2] ?? "",
    basePrice: mainTexts[3] ?? "",
    displayPrice,
    description: desc,
    highlights: shortHighlights,
    allergens: allergyTexts.filter((t) => t !== "Bevat"),
    ingredients,
    raw: page,
  };
}

export function registerProductCommands(program: Command): void {
  const product = program
    .command("product")
    .description("Product commands");

  product
    .command("show <id>", { isDefault: true })
    .description("Show product details")
    .action(
      withErrorHandling(async (productId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching product…").start();

        const client = getClient(opts.country);
        const page = await client.getProductDetailsPage(productId);

        spinner?.stop();

        const info = extractProductInfo(page);

        output(info, format, (data) => {
          const lines: string[] = [
            chalk.bold(data.name),
          ];

          if (data.brand) lines.push(`  Brand:         ${data.brand}`);
          if (data.displayPrice != null) lines.push(`  Price:         ${formatPrice(data.displayPrice)}`);
          if (data.unitQuantity) lines.push(`  Unit:          ${data.unitQuantity}`);
          if (data.basePrice) lines.push(`  Base price:    ${data.basePrice}`);

          if (data.allergens.length) {
            lines.push(`  Allergens:     ${data.allergens.join(", ")}`);
          }

          if (data.highlights.length) {
            lines.push("", chalk.bold("  Highlights:"));
            for (const h of data.highlights) {
              lines.push(`    - ${h}`);
            }
          }

          if (data.description) {
            lines.push("", `  ${data.description}`);
          }

          return lines.join("\n");
        }, (data) => {
          const info = new Table();
          info.push(
            { Name: data.name },
            { Brand: data.brand || "-" },
            { Price: data.displayPrice != null ? formatPrice(data.displayPrice) : "-" },
            { "Unit Qty": data.unitQuantity || "-" },
          );
          if (data.allergens.length) info.push({ Allergens: data.allergens.join(", ") });
          if (data.description) info.push({ Description: data.description });
          return info.toString();
        });
      }),
    );

  product
    .command("page <id>")
    .description("Get full product details page (JSON only)")
    .action(
      withErrorHandling(async (productId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching product page…").start();

        const client = getClient(opts.country);
        const page = await client.getProductDetailsPage(productId);

        spinner?.stop();

        output(page, format);
      }),
    );

  product
    .command("image <imageId>")
    .description("Download a product image")
    .option("--size <s>", "Image size (tiny|small|medium|large|extra-large)", "medium")
    .action(
      withErrorHandling(async (imageId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const localOpts = cmd.opts();
        const size = localOpts.size;
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Downloading image…").start();

        const client = getClient(opts.country);
        const imageData = await client.getImage(imageId, size);

        const filename = `${imageId}_${size}.jpg`;
        await writeFile(filename, imageData, "binary");

        spinner?.stop();

        output({ filename, size, imageId }, format, () => {
          return chalk.green(`Saved to ./${filename}`);
        }, () => {
          return `Saved to ./${filename}`;
        });
      }),
    );
}
