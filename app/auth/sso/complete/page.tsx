import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import {
  canAccessCapability,
  deleteOAuthOnlyUserWithoutAccess,
  ensureUserRole,
  findUserById,
  getUserRoles,
} from "@/src/modules/auth/service";
import { getSharedAuthCookieDomain } from "@/src/modules/auth/constants";
import {
  createSurfaceAccessToken,
  getSurfaceAccessCookieName,
} from "@/src/modules/auth/surface-access";
import { createSsoHandoffToken } from "@/src/modules/auth/sso-handoff";
import { getSurfaceUrl, isSsoIntent } from "@/src/modules/auth/sso";
import { addEmailSubscriber } from "@/src/modules/marketing/email-subscribers";
import {
  claimWhatsappDraftForUser,
  getPrimaryWhatsappCustomerLinkForUser,
  WhatsappNumberLinkedToAnotherUserError,
} from "@/src/modules/whatsapp-ordering/customer-links";
import {
  getWhatsappDraftResumePath,
  parseWhatsappDraftToken,
} from "@/src/modules/whatsapp-ordering/draft-tokens";

type SsoCompletePageProps = {
  searchParams: Promise<{
    intent?: string;
    whatsappDraft?: string;
  }>;
};

async function setSessionSurfaceAccess(
  surface: "admin" | "seller",
  userId: string,
) {
  const cookieStore = await cookies();
  const surfaceAccessToken = createSurfaceAccessToken({
    remember: false,
    surface,
    userId,
  });

  cookieStore.set(getSurfaceAccessCookieName(surface), surfaceAccessToken, {
    domain: getSharedAuthCookieDomain(),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function getSellerRegisterUrlWithHandoff(user: {
  email: string | null;
  id: string;
  name: string | null;
}) {
  if (!user.email) {
    return getSurfaceUrl("seller", "/register");
  }

  return getSurfaceUrl("seller", "/register", {
    sso: createSsoHandoffToken({
      email: user.email,
      name: user.name,
      userId: user.id,
    }),
  });
}

export default async function SsoCompletePage({
  searchParams,
}: SsoCompletePageProps) {
  const { intent: rawIntent, whatsappDraft } = await searchParams;
  const intent = isSsoIntent(rawIntent) ? rawIntent : null;
  const whatsappDraftToken = parseWhatsappDraftToken(whatsappDraft);
  const session = await auth();

  if (!intent || !session?.user?.id) {
    redirect("/sign-in");
  }

  const user = await findUserById(session.user.id);

  if (!user?.isActive) {
    redirect("/sign-in");
  }

  const roles = await getUserRoles(user.id);

  if (intent === "marketplace_sign_in" || intent === "marketplace_register") {
    if (!roles.includes("customer")) {
      await ensureUserRole(user.id, "customer");
    }

    if (user.email) {
      await addEmailSubscriber({
        email: user.email,
        source: "customer_signup",
      });
    }

    if (whatsappDraftToken) {
      try {
        await claimWhatsappDraftForUser({
          source: "sso_completion",
          token: whatsappDraftToken,
          userId: user.id,
        });
      } catch (error) {
        if (error instanceof WhatsappNumberLinkedToAnotherUserError) {
          redirect("/account/whatsapp?error=link_conflict");
        }

        throw error;
      }

      redirect(getWhatsappDraftResumePath(whatsappDraftToken));
    }

    const whatsappLink = await getPrimaryWhatsappCustomerLinkForUser(user.id);

    if (!whatsappLink) {
      redirect("/account/whatsapp?next=/");
    }

    redirect("/");
  }

  if (intent === "admin_sign_in") {
    if (!canAccessCapability({ roles }, "admin")) {
      await deleteOAuthOnlyUserWithoutAccess(user.id);
      await signOut({
        redirectTo: getSurfaceUrl("admin", "/sign-in", {
          error: "admin_access_required",
        }),
      });
    }

    await setSessionSurfaceAccess("admin", user.id);
    redirect(getSurfaceUrl("admin"));
  }

  if (intent === "seller_sign_in") {
    if (!canAccessCapability({ roles }, "seller")) {
      redirect(getSellerRegisterUrlWithHandoff(user));
    }

    await setSessionSurfaceAccess("seller", user.id);
    redirect(getSurfaceUrl("seller"));
  }

  redirect(getSellerRegisterUrlWithHandoff(user));
}
