const technology =
  /\b(ai|artificial intelligence|llm|agents?|models?|openai|anthropic|claude|chatgpt|gemini|google|microsoft|apple|amazon|meta|facebook|instagram|nvidia|amd|intel|tesla|spacex|starlink|chips?|semiconductors?|gpu|cpu|quantum|software|hardware|computers?|coding|code|programming|developers?|github|gitlab|linux|windows|macbook|macos|iphone|android|laptops?|phones?|smartphones?|gadgets?|routers?|network|broadband|internet|browser|web|api|cybersecurity|security|hackers?|hacked|breach|vulnerability|ransomware|malware|encryption|privacy|surveillance|data|database|cloud|saas|startup|funding|venture|fintech|crypto|bitcoin|blockchain|robot|robotics|automation|battery|batteries|electric|ev|rocket|space|nasa|satellite|3d|printer|touchscreen|electronic|digital|app|apps|platform|streaming|gaming|game|steam|nintendo|playstation|xbox|vr|xr|ar|display|oled|ebook|e-reader|kindle|wifi|wi-fi|drones?|telecom|bluetooth|music tech|smart speaker)\b/i;
export function isTechnologyStory(title: string, excerpt = "") {
  if (
    /\b(coupons?|promo codes?|discount codes?|world series|super bowl|nba playoffs)\b/i.test(
      title,
    )
  )
    return false;
  return technology.test(`${title} ${excerpt.slice(0, 240)}`);
}
