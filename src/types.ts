// Re-export picnic-api types from the types subpath
export type {
  CountryCode,
  ImageSize,
  LoginResult,
  User,
  UserInfo,
  ProfileMenu,
  SearchResult,
  SuggestionResult,
  Article,
  MyStore,
  Category,
  SubCategory,
  SingleArticle,
  Order,
  OrderLine,
  OrderArticle,
  GetDeliverySlotsResult,
  DeliverySlot,
  Delivery,
  DeliveryPosition,
  DeliveryScenario,
  DeliveryStatus,
  OrderStatus,
  MgmDetails,
  ConsentSetting,
  PaymentProfile,
  WalletTransaction,
  WalletTransactionDetails,
  CustomerServiceContactInfo,
  ApiConfig,
} from "picnic-api/lib/types/picnic-api.js";

// CLI-specific types
export type OutputFormat = "pretty" | "json" | "table";

export interface IPicnicCliConfig {
  countryCode: "NL" | "DE";
  apiVersion: string;
  authKey: string | null;
  username: string | null;
  defaultOutput: OutputFormat;
}
