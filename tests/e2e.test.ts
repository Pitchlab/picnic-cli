import { describe, it, expect, beforeAll } from "vitest";
import PicnicClient from "picnic-api";

const username = process.env.PICNIC_TEST_USERNAME;
const password = process.env.PICNIC_TEST_PASSWORD;

const skip = !username || !password;

describe.skipIf(skip)("picnic-cli e2e", () => {
  let client: InstanceType<typeof PicnicClient>;

  beforeAll(async () => {
    client = new PicnicClient({ countryCode: "NL" });
    const result = await client.login(username!, password!);
    expect(result.authKey).toBeTruthy();
    client = new PicnicClient({ countryCode: "NL", authKey: result.authKey });
  });

  describe("Auth", () => {
    it("should get user details (whoami)", async () => {
      const user = await client.getUserDetails();
      expect(user.firstname).toBeTruthy();
      expect(user.contact_email).toBeTruthy();
    });
  });

  describe("Shopping", () => {
    it("should search for products", async () => {
      const results = await client.search("melk");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBeTruthy();
    });

    it("should manage cart", async () => {
      const searchResults = await client.search("melk");
      const productId = searchResults[0].id;

      // Add to cart
      const cartAfterAdd = await client.addProductToShoppingCart(productId, 1);
      expect(cartAfterAdd.total_count).toBeGreaterThanOrEqual(1);

      // View cart
      const cart = await client.getShoppingCart();
      expect(cart.items.length).toBeGreaterThan(0);

      // Clear cart
      const clearedCart = await client.clearShoppingCart();
      expect(clearedCart.total_count).toBe(0);
    });
  });

  describe("Slots", () => {
    it("should list delivery slots", async () => {
      const result = await client.getDeliverySlots();
      expect(result.delivery_slots).toBeDefined();
      expect(Array.isArray(result.delivery_slots)).toBe(true);
    });
  });

  describe("Deliveries", () => {
    it("should list deliveries", async () => {
      const deliveries = await client.getDeliveries();
      expect(Array.isArray(deliveries)).toBe(true);
    });
  });
});
