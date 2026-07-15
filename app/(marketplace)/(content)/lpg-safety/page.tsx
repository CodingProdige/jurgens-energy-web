import type { Metadata } from "next";

import { LpgSafetyPage } from "@/src/modules/marketplace/content/lpg-safety-page";

export const metadata: Metadata = {
  title: "LPG Safety Guide",
  description:
    "Practical South African LPG safety guidance for cylinders, appliances, leak checks, storage, registered installers and cylinder exchanges.",
};

export default function LpgSafetyRoute() {
  return <LpgSafetyPage />;
}
