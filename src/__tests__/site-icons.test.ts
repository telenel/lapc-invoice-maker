import { describe, expect, it } from "vitest";
import { SITE_ICON_VERSION, siteIconsMetadata } from "@/lib/site-icons";

describe("site icon metadata", () => {
  it("uses versioned icon asset URLs to break stubborn browser favicon caches", () => {
    expect(siteIconsMetadata).toMatchObject({
      icon: expect.arrayContaining([
        expect.objectContaining({ url: `/favicon-${SITE_ICON_VERSION}.ico` }),
        expect.objectContaining({ url: `/icon-${SITE_ICON_VERSION}.svg` }),
      ]),
      shortcut: [
        expect.objectContaining({ url: `/favicon-${SITE_ICON_VERSION}.ico` }),
      ],
      apple: [
        expect.objectContaining({ url: `/apple-icon-${SITE_ICON_VERSION}.png` }),
      ],
    });
  });
});
