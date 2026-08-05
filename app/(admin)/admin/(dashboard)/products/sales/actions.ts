"use server";

import {
  createSaleCampaign,
  deleteSaleCampaign,
  endSaleCampaign,
} from "@/src/modules/admin/sales";

export async function createSaleCampaignAction(input: unknown) {
  return createSaleCampaign(input);
}

export async function endSaleCampaignAction(input: unknown) {
  return endSaleCampaign(input);
}

export async function deleteSaleCampaignAction(input: unknown) {
  return deleteSaleCampaign(input);
}
