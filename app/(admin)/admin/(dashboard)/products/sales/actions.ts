"use server";

import {
  cancelScheduledSaleCampaign,
  createSaleCampaign,
  deleteSaleCampaign,
  endSaleCampaign,
  startSaleCampaignNow,
  updateSaleCampaignSchedule,
  updateSaleCampaignAppearance,
} from "@/src/modules/admin/sales";

export async function createSaleCampaignAction(input: unknown) {
  return createSaleCampaign(input);
}

export async function endSaleCampaignAction(input: unknown) {
  return endSaleCampaign(input);
}

export async function startSaleCampaignNowAction(input: unknown) {
  return startSaleCampaignNow(input);
}

export async function updateSaleCampaignScheduleAction(input: unknown) {
  return updateSaleCampaignSchedule(input);
}

export async function cancelScheduledSaleCampaignAction(input: unknown) {
  return cancelScheduledSaleCampaign(input);
}

export async function deleteSaleCampaignAction(input: unknown) {
  return deleteSaleCampaign(input);
}

export async function updateSaleCampaignAppearanceAction(input: unknown) {
  return updateSaleCampaignAppearance(input);
}
