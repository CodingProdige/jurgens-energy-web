import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("marketplace header navigation highlights the current route", () => {
  const desktopNavSource = readFileSync(
    "components/marketplace/marketplace-desktop-nav.tsx",
    "utf8",
  );
  const mobileNavSource = readFileSync(
    "components/marketplace/marketplace-mobile-menu.tsx",
    "utf8",
  );
  const headerSource = readFileSync(
    "components/marketplace/marketplace-header.tsx",
    "utf8",
  );
  const headerSearchSource = readFileSync(
    "components/marketplace/marketplace-header-search.tsx",
    "utf8",
  );

  assert.match(desktopNavSource, /usePathname/);
  assert.match(desktopNavSource, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(desktopNavSource, /MarketplaceShopMenu[\s\S]*active=\{active\}/);
  assert.match(desktopNavSource, /currentPath\.startsWith\("\/categories\/"\)/);
  assert.match(mobileNavSource, /usePathname/);
  assert.match(mobileNavSource, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(mobileNavSource, /MarketplaceHeaderSearch/);
  assert.match(headerSource, /MarketplaceDesktopNav/);
  assert.match(headerSource, /MarketplaceHeaderSearch/);
  assert.match(headerSearchSource, /action="\/products"/);
  assert.match(headerSearchSource, /name="q"/);
  assert.match(headerSearchSource, /type="search"/);
  assert.doesNotMatch(headerSource, /\["Delivery", "\/delivery-information"\]/);
  assert.doesNotMatch(headerSource, /\["Blog", "\/blog"\]/);
  assert.doesNotMatch(headerSource, /import \{ MarketplaceShopMenu \}/);
  assert.doesNotMatch(headerSource, /<MarketplaceShopMenu/);
});
