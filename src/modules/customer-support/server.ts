import "server-only";

import { cache } from "react";

import { getBusinessInformation } from "@/src/modules/business-information";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import { createCustomerSupportContactDetails } from "@/src/modules/customer-support/contact-details";

export const getCustomerSupportContactDetails = cache(async () => {
  const [business, settings] = await Promise.all([
    getBusinessInformation(),
    getMarketplaceSettings(),
  ]);

  return createCustomerSupportContactDetails({ business, settings });
});
