import type { Company } from "@/lib/types";
export const companies: Company[] = [
  {
    symbol: "JPM",
    name: "JPMorgan Chase",
    aliases: ["jpmorgan", "jp morgan"],
    color: "#7b8a98",
    initials: "JP",
  },
  {
    symbol: "BAC",
    name: "Bank of America",
    aliases: ["bank of america", "bofa"],
    color: "#798c9d",
    initials: "BA",
  },
  {
    symbol: "V",
    name: "Visa",
    aliases: ["visa"],
    color: "#7b88a0",
    initials: "V",
  },
  {
    symbol: "MA",
    name: "Mastercard",
    aliases: ["mastercard"],
    color: "#a88e70",
    initials: "MC",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    aliases: ["nvidia", "geforce", "cuda"],
    color: "#76a83b",
    initials: "N",
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    aliases: ["microsoft", "azure", "github", "copilot"],
    color: "#737d94",
    initials: "M",
  },
  {
    symbol: "GOOGL",
    name: "Alphabet",
    aliases: ["google", "alphabet", "gemini", "deepmind", "youtube", "android"],
    color: "#5681c2",
    initials: "G",
  },
  {
    symbol: "AAPL",
    name: "Apple",
    aliases: ["apple", "iphone", "macbook", "macos", "ipad"],
    color: "#727779",
    initials: "a",
  },
  {
    symbol: "AMZN",
    name: "Amazon",
    aliases: ["amazon", "aws"],
    color: "#be8a3f",
    initials: "a",
  },
  {
    symbol: "META",
    name: "Meta",
    aliases: ["meta", "facebook", "instagram", "whatsapp", "llama"],
    color: "#5274b9",
    initials: "m",
  },
  {
    symbol: "AMD",
    name: "AMD",
    aliases: ["amd", "ryzen", "radeon"],
    color: "#b65950",
    initials: "A",
  },
  {
    symbol: "INTC",
    name: "Intel",
    aliases: ["intel"],
    color: "#5b91a6",
    initials: "i",
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    aliases: ["tesla", "cybertruck"],
    color: "#b95755",
    initials: "T",
  },
  {
    symbol: "CRM",
    name: "Salesforce",
    aliases: ["salesforce", "slack"],
    color: "#4e95b5",
    initials: "S",
  },
  {
    symbol: "ORCL",
    name: "Oracle",
    aliases: ["oracle"],
    color: "#b65a54",
    initials: "O",
  },
  {
    symbol: "TSM",
    name: "TSMC",
    aliases: ["tsmc", "taiwan semiconductor"],
    color: "#8f7167",
    initials: "T",
  },
  {
    symbol: "PLTR",
    name: "Palantir",
    aliases: ["palantir"],
    color: "#737373",
    initials: "P",
  },
  {
    symbol: "OPENAI",
    name: "OpenAI",
    aliases: ["openai", "chatgpt", "codex"],
    color: "#6e9284",
    initials: "O",
    private: true,
  },
  {
    symbol: "ANTHROPIC",
    name: "Anthropic",
    aliases: ["anthropic", "claude"],
    color: "#bd8b73",
    initials: "A",
    private: true,
  },
  {
    symbol: "SPACE",
    name: "SpaceX",
    aliases: ["spacex", "starlink"],
    color: "#7b8493",
    initials: "S",
    private: true,
  },
];
export function findCompanies(text: string): string[] {
  const normalized = text.toLowerCase();
  return companies
    .filter(
      (company) =>
        (company.symbol !== "V" ||
          /\b(payments?|cards?|network|merchant|earnings|revenue|profit|fintech|stock)\b/i.test(
            normalized,
          )) &&
        company.aliases.some((alias) =>
          new RegExp(`\\b${alias}\\b`, "i").test(normalized),
        ),
    )
    .map((company) => company.symbol);
}
export function getCompany(symbol: string) {
  return companies.find((company) => company.symbol === symbol);
}
