import type { Metadata } from "next";

export const SITE_ICON_VERSION = "20260413b";

export const siteIconsMetadata: Metadata["icons"] = {
  icon: [
    {
      url: `/icon-${SITE_ICON_VERSION}.svg`,
      type: "image/svg+xml",
      sizes: "any",
    },
    {
      url: `/favicon-${SITE_ICON_VERSION}.ico`,
      type: "image/x-icon",
      sizes: "48x48",
    },
  ],
  shortcut: [
    {
      url: `/favicon-${SITE_ICON_VERSION}.ico`,
      type: "image/x-icon",
    },
  ],
  apple: [
    {
      url: `/apple-icon-${SITE_ICON_VERSION}.png`,
      type: "image/png",
      sizes: "180x180",
    },
  ],
};
