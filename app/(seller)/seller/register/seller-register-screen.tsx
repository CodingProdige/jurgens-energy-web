"use client";

import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";
import type { FormEvent } from "react";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  User,
} from "lucide-react";

import {
  checkSellerRegistrationEmail,
  checkSellerStoreNameAvailability,
  submitSellerApplication,
  type SellerApplicationSubmitState,
  type SellerEmailCheckState,
  type SellerStoreNameAvailabilityState,
} from "@/app/(seller)/seller/register/actions";
import { registerSellerWithGoogle } from "@/app/auth/sso/actions";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const sellerGreen = "#58d83f";
const emailInitialState: SellerEmailCheckState = {};
const submitInitialState: SellerApplicationSubmitState = {};
const authLabelClass = "text-[13px] font-bold text-[#070b16] dark:text-white";
const authInputClass =
  "h-[45px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-4 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-[#58d83f] focus:ring-4 focus:ring-[#58d83f]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const authPasswordInputClass =
  "h-[45px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-11 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-[#58d83f] focus:ring-4 focus:ring-[#58d83f]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const authPrimaryButtonClass =
  "inline-flex h-[45px] w-full items-center justify-center gap-3 rounded-[6px] border border-[#053f17] bg-[linear-gradient(180deg,#08651f,#06491a)] text-base font-medium text-white shadow-[0_10px_24px_rgba(6,73,26,0.22)] transition hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-70";
const authSecondaryButtonClass =
  "inline-flex h-[45px] w-full items-center justify-center gap-3 rounded-[6px] border border-[#d9deea] bg-white text-base font-medium text-[#070b16] transition hover:bg-[#fafafa] dark:border-white/12 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10";

const featureItems = [
  {
    icon: Store,
    title: "Manage Your Store",
    description: "Update store details, branding, and preferences.",
  },
  {
    icon: ShoppingBag,
    title: "Products & Orders",
    description: "Add products, manage inventory, and track orders.",
  },
  {
    icon: BarChart3,
    title: "Insights & Growth",
    description: "Get real-time insights and grow your business faster.",
  },
];

const businessTypes = [
  "Clothing & Apparel",
  "Beauty & Personal Care",
  "Electronics",
  "Home & Living",
  "Food & Beverage",
  "Other",
];

const countries = [
  { code: "ZA", dialCode: "+27", flag: "🇿🇦", name: "South Africa", nationalMin: 9, nationalMax: 9 },
  { code: "US", dialCode: "+1", flag: "🇺🇸", name: "United States", nationalMin: 10, nationalMax: 10 },
  { code: "GB", dialCode: "+44", flag: "🇬🇧", name: "United Kingdom", nationalMin: 10, nationalMax: 10 },
  { code: "CA", dialCode: "+1", flag: "🇨🇦", name: "Canada", nationalMin: 10, nationalMax: 10 },
  { code: "AU", dialCode: "+61", flag: "🇦🇺", name: "Australia", nationalMin: 9, nationalMax: 9 },
  { code: "NZ", dialCode: "+64", flag: "🇳🇿", name: "New Zealand", nationalMin: 8, nationalMax: 10 },
  { code: "IE", dialCode: "+353", flag: "🇮🇪", name: "Ireland", nationalMin: 9, nationalMax: 9 },
  { code: "DE", dialCode: "+49", flag: "🇩🇪", name: "Germany", nationalMin: 10, nationalMax: 11 },
  { code: "FR", dialCode: "+33", flag: "🇫🇷", name: "France", nationalMin: 9, nationalMax: 9 },
  { code: "NL", dialCode: "+31", flag: "🇳🇱", name: "Netherlands", nationalMin: 9, nationalMax: 9 },
  { code: "AE", dialCode: "+971", flag: "🇦🇪", name: "United Arab Emirates", nationalMin: 9, nationalMax: 9 },
  { code: "IN", dialCode: "+91", flag: "🇮🇳", name: "India", nationalMin: 10, nationalMax: 10 },
  { code: "AF", dialCode: "+93", flag: "🇦🇫", name: "Afghanistan", nationalMin: 9, nationalMax: 9 },
  { code: "AL", dialCode: "+355", flag: "🇦🇱", name: "Albania", nationalMin: 8, nationalMax: 9 },
  { code: "DZ", dialCode: "+213", flag: "🇩🇿", name: "Algeria", nationalMin: 9, nationalMax: 9 },
  { code: "AO", dialCode: "+244", flag: "🇦🇴", name: "Angola", nationalMin: 9, nationalMax: 9 },
  { code: "AR", dialCode: "+54", flag: "🇦🇷", name: "Argentina", nationalMin: 10, nationalMax: 10 },
  { code: "AM", dialCode: "+374", flag: "🇦🇲", name: "Armenia", nationalMin: 8, nationalMax: 8 },
  { code: "AT", dialCode: "+43", flag: "🇦🇹", name: "Austria", nationalMin: 10, nationalMax: 13 },
  { code: "AZ", dialCode: "+994", flag: "🇦🇿", name: "Azerbaijan", nationalMin: 9, nationalMax: 9 },
  { code: "BH", dialCode: "+973", flag: "🇧🇭", name: "Bahrain", nationalMin: 8, nationalMax: 8 },
  { code: "BD", dialCode: "+880", flag: "🇧🇩", name: "Bangladesh", nationalMin: 10, nationalMax: 10 },
  { code: "BE", dialCode: "+32", flag: "🇧🇪", name: "Belgium", nationalMin: 9, nationalMax: 9 },
  { code: "BJ", dialCode: "+229", flag: "🇧🇯", name: "Benin", nationalMin: 8, nationalMax: 10 },
  { code: "BO", dialCode: "+591", flag: "🇧🇴", name: "Bolivia", nationalMin: 8, nationalMax: 8 },
  { code: "BA", dialCode: "+387", flag: "🇧🇦", name: "Bosnia and Herzegovina", nationalMin: 8, nationalMax: 8 },
  { code: "BW", dialCode: "+267", flag: "🇧🇼", name: "Botswana", nationalMin: 7, nationalMax: 8 },
  { code: "BR", dialCode: "+55", flag: "🇧🇷", name: "Brazil", nationalMin: 10, nationalMax: 11 },
  { code: "BG", dialCode: "+359", flag: "🇧🇬", name: "Bulgaria", nationalMin: 8, nationalMax: 9 },
  { code: "BF", dialCode: "+226", flag: "🇧🇫", name: "Burkina Faso", nationalMin: 8, nationalMax: 8 },
  { code: "KH", dialCode: "+855", flag: "🇰🇭", name: "Cambodia", nationalMin: 8, nationalMax: 9 },
  { code: "CM", dialCode: "+237", flag: "🇨🇲", name: "Cameroon", nationalMin: 9, nationalMax: 9 },
  { code: "CL", dialCode: "+56", flag: "🇨🇱", name: "Chile", nationalMin: 9, nationalMax: 9 },
  { code: "CN", dialCode: "+86", flag: "🇨🇳", name: "China", nationalMin: 11, nationalMax: 11 },
  { code: "CO", dialCode: "+57", flag: "🇨🇴", name: "Colombia", nationalMin: 10, nationalMax: 10 },
  { code: "CR", dialCode: "+506", flag: "🇨🇷", name: "Costa Rica", nationalMin: 8, nationalMax: 8 },
  { code: "CI", dialCode: "+225", flag: "🇨🇮", name: "Cote d'Ivoire", nationalMin: 10, nationalMax: 10 },
  { code: "HR", dialCode: "+385", flag: "🇭🇷", name: "Croatia", nationalMin: 8, nationalMax: 9 },
  { code: "CY", dialCode: "+357", flag: "🇨🇾", name: "Cyprus", nationalMin: 8, nationalMax: 8 },
  { code: "CZ", dialCode: "+420", flag: "🇨🇿", name: "Czech Republic", nationalMin: 9, nationalMax: 9 },
  { code: "DK", dialCode: "+45", flag: "🇩🇰", name: "Denmark", nationalMin: 8, nationalMax: 8 },
  { code: "DO", dialCode: "+1", flag: "🇩🇴", name: "Dominican Republic", nationalMin: 10, nationalMax: 10 },
  { code: "EC", dialCode: "+593", flag: "🇪🇨", name: "Ecuador", nationalMin: 9, nationalMax: 9 },
  { code: "EG", dialCode: "+20", flag: "🇪🇬", name: "Egypt", nationalMin: 10, nationalMax: 10 },
  { code: "EE", dialCode: "+372", flag: "🇪🇪", name: "Estonia", nationalMin: 7, nationalMax: 8 },
  { code: "ET", dialCode: "+251", flag: "🇪🇹", name: "Ethiopia", nationalMin: 9, nationalMax: 9 },
  { code: "FI", dialCode: "+358", flag: "🇫🇮", name: "Finland", nationalMin: 9, nationalMax: 10 },
  { code: "GE", dialCode: "+995", flag: "🇬🇪", name: "Georgia", nationalMin: 9, nationalMax: 9 },
  { code: "GH", dialCode: "+233", flag: "🇬🇭", name: "Ghana", nationalMin: 9, nationalMax: 9 },
  { code: "GR", dialCode: "+30", flag: "🇬🇷", name: "Greece", nationalMin: 10, nationalMax: 10 },
  { code: "GT", dialCode: "+502", flag: "🇬🇹", name: "Guatemala", nationalMin: 8, nationalMax: 8 },
  { code: "HK", dialCode: "+852", flag: "🇭🇰", name: "Hong Kong", nationalMin: 8, nationalMax: 8 },
  { code: "HU", dialCode: "+36", flag: "🇭🇺", name: "Hungary", nationalMin: 9, nationalMax: 9 },
  { code: "IS", dialCode: "+354", flag: "🇮🇸", name: "Iceland", nationalMin: 7, nationalMax: 7 },
  { code: "ID", dialCode: "+62", flag: "🇮🇩", name: "Indonesia", nationalMin: 9, nationalMax: 12 },
  { code: "IL", dialCode: "+972", flag: "🇮🇱", name: "Israel", nationalMin: 9, nationalMax: 9 },
  { code: "IT", dialCode: "+39", flag: "🇮🇹", name: "Italy", nationalMin: 9, nationalMax: 10 },
  { code: "JM", dialCode: "+1", flag: "🇯🇲", name: "Jamaica", nationalMin: 10, nationalMax: 10 },
  { code: "JP", dialCode: "+81", flag: "🇯🇵", name: "Japan", nationalMin: 10, nationalMax: 10 },
  { code: "JO", dialCode: "+962", flag: "🇯🇴", name: "Jordan", nationalMin: 9, nationalMax: 9 },
  { code: "KE", dialCode: "+254", flag: "🇰🇪", name: "Kenya", nationalMin: 9, nationalMax: 9 },
  { code: "KW", dialCode: "+965", flag: "🇰🇼", name: "Kuwait", nationalMin: 8, nationalMax: 8 },
  { code: "LV", dialCode: "+371", flag: "🇱🇻", name: "Latvia", nationalMin: 8, nationalMax: 8 },
  { code: "LB", dialCode: "+961", flag: "🇱🇧", name: "Lebanon", nationalMin: 7, nationalMax: 8 },
  { code: "LT", dialCode: "+370", flag: "🇱🇹", name: "Lithuania", nationalMin: 8, nationalMax: 8 },
  { code: "LU", dialCode: "+352", flag: "🇱🇺", name: "Luxembourg", nationalMin: 9, nationalMax: 9 },
  { code: "MY", dialCode: "+60", flag: "🇲🇾", name: "Malaysia", nationalMin: 9, nationalMax: 10 },
  { code: "MT", dialCode: "+356", flag: "🇲🇹", name: "Malta", nationalMin: 8, nationalMax: 8 },
  { code: "MX", dialCode: "+52", flag: "🇲🇽", name: "Mexico", nationalMin: 10, nationalMax: 10 },
  { code: "MA", dialCode: "+212", flag: "🇲🇦", name: "Morocco", nationalMin: 9, nationalMax: 9 },
  { code: "MZ", dialCode: "+258", flag: "🇲🇿", name: "Mozambique", nationalMin: 8, nationalMax: 9 },
  { code: "NA", dialCode: "+264", flag: "🇳🇦", name: "Namibia", nationalMin: 8, nationalMax: 9 },
  { code: "NG", dialCode: "+234", flag: "🇳🇬", name: "Nigeria", nationalMin: 10, nationalMax: 10 },
  { code: "NO", dialCode: "+47", flag: "🇳🇴", name: "Norway", nationalMin: 8, nationalMax: 8 },
  { code: "OM", dialCode: "+968", flag: "🇴🇲", name: "Oman", nationalMin: 8, nationalMax: 8 },
  { code: "PK", dialCode: "+92", flag: "🇵🇰", name: "Pakistan", nationalMin: 10, nationalMax: 10 },
  { code: "PA", dialCode: "+507", flag: "🇵🇦", name: "Panama", nationalMin: 8, nationalMax: 8 },
  { code: "PE", dialCode: "+51", flag: "🇵🇪", name: "Peru", nationalMin: 9, nationalMax: 9 },
  { code: "PH", dialCode: "+63", flag: "🇵🇭", name: "Philippines", nationalMin: 10, nationalMax: 10 },
  { code: "PL", dialCode: "+48", flag: "🇵🇱", name: "Poland", nationalMin: 9, nationalMax: 9 },
  { code: "PT", dialCode: "+351", flag: "🇵🇹", name: "Portugal", nationalMin: 9, nationalMax: 9 },
  { code: "QA", dialCode: "+974", flag: "🇶🇦", name: "Qatar", nationalMin: 8, nationalMax: 8 },
  { code: "RO", dialCode: "+40", flag: "🇷🇴", name: "Romania", nationalMin: 9, nationalMax: 9 },
  { code: "RW", dialCode: "+250", flag: "🇷🇼", name: "Rwanda", nationalMin: 9, nationalMax: 9 },
  { code: "SA", dialCode: "+966", flag: "🇸🇦", name: "Saudi Arabia", nationalMin: 9, nationalMax: 9 },
  { code: "SN", dialCode: "+221", flag: "🇸🇳", name: "Senegal", nationalMin: 9, nationalMax: 9 },
  { code: "RS", dialCode: "+381", flag: "🇷🇸", name: "Serbia", nationalMin: 8, nationalMax: 9 },
  { code: "SG", dialCode: "+65", flag: "🇸🇬", name: "Singapore", nationalMin: 8, nationalMax: 8 },
  { code: "SK", dialCode: "+421", flag: "🇸🇰", name: "Slovakia", nationalMin: 9, nationalMax: 9 },
  { code: "SI", dialCode: "+386", flag: "🇸🇮", name: "Slovenia", nationalMin: 8, nationalMax: 8 },
  { code: "KR", dialCode: "+82", flag: "🇰🇷", name: "South Korea", nationalMin: 9, nationalMax: 10 },
  { code: "ES", dialCode: "+34", flag: "🇪🇸", name: "Spain", nationalMin: 9, nationalMax: 9 },
  { code: "LK", dialCode: "+94", flag: "🇱🇰", name: "Sri Lanka", nationalMin: 9, nationalMax: 9 },
  { code: "SE", dialCode: "+46", flag: "🇸🇪", name: "Sweden", nationalMin: 9, nationalMax: 10 },
  { code: "CH", dialCode: "+41", flag: "🇨🇭", name: "Switzerland", nationalMin: 9, nationalMax: 9 },
  { code: "TW", dialCode: "+886", flag: "🇹🇼", name: "Taiwan", nationalMin: 9, nationalMax: 9 },
  { code: "TZ", dialCode: "+255", flag: "🇹🇿", name: "Tanzania", nationalMin: 9, nationalMax: 9 },
  { code: "TH", dialCode: "+66", flag: "🇹🇭", name: "Thailand", nationalMin: 9, nationalMax: 9 },
  { code: "TR", dialCode: "+90", flag: "🇹🇷", name: "Turkey", nationalMin: 10, nationalMax: 10 },
  { code: "UG", dialCode: "+256", flag: "🇺🇬", name: "Uganda", nationalMin: 9, nationalMax: 9 },
  { code: "UA", dialCode: "+380", flag: "🇺🇦", name: "Ukraine", nationalMin: 9, nationalMax: 9 },
  { code: "UY", dialCode: "+598", flag: "🇺🇾", name: "Uruguay", nationalMin: 8, nationalMax: 8 },
  { code: "VN", dialCode: "+84", flag: "🇻🇳", name: "Vietnam", nationalMin: 9, nationalMax: 10 },
  { code: "ZM", dialCode: "+260", flag: "🇿🇲", name: "Zambia", nationalMin: 9, nationalMax: 9 },
  { code: "ZW", dialCode: "+263", flag: "🇿🇼", name: "Zimbabwe", nationalMin: 9, nationalMax: 9 },
] as const;

const defaultCountry = countries[0];

type FormValues = {
  addressLine1: string;
  addressLine2: string;
  businessType: string;
  countryCode: string;
  city: string;
  countryRegion: string;
  fullName: string;
  password: string;
  phone: string;
  phoneDialCode: string;
  phoneLocal: string;
  postalCode: string;
  stateProvince: string;
  storeName: string;
};

type StepName = "Account" | "Business" | "Address" | "Review";
type FieldErrors = Partial<Record<keyof FormValues | "agreement", string>>;
type StoreNameAvailability = SellerStoreNameAvailabilityState & {
  checkedName?: string;
  status: "available" | "checking" | "error" | "idle" | "unavailable";
};

const initialFormValues: FormValues = {
  addressLine1: "",
  addressLine2: "",
  businessType: "",
  city: "",
  countryCode: defaultCountry.code,
  countryRegion: defaultCountry.name,
  fullName: "",
  password: "",
  phone: defaultCountry.dialCode,
  phoneDialCode: defaultCountry.dialCode,
  phoneLocal: "",
  postalCode: "",
  stateProvince: "",
  storeName: "",
};

function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo/Piessang Logo Full - Clipped.png"
      alt="Piessang"
      width={164}
      height={30}
      priority
      className={cn("h-auto w-[142px]", className)}
    />
  );
}

function GoogleGlyph() {
  return (
    <span
      aria-hidden="true"
      className="grid size-5 place-items-center text-[18px] font-bold leading-none"
    >
      <span className="bg-[conic-gradient(from_-35deg,#4285f4_0_25%,#34a853_0_50%,#fbbc05_0_75%,#ea4335_0)] bg-clip-text text-transparent">
        G
      </span>
    </span>
  );
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-1 text-red-500">
      *
    </span>
  );
}

function sanitizeNationalPhoneNumber(
  rawValue: string,
  country: (typeof countries)[number],
) {
  let digits = rawValue.replace(/\D/g, "");

  if (digits.startsWith(country.dialCode.replace(/\D/g, ""))) {
    digits = digits.slice(country.dialCode.replace(/\D/g, "").length);
  }

  digits = digits.replace(/^0+/, "");

  return digits.slice(0, country.nationalMax);
}

function createClientStoreSlug(storeName: string) {
  const slug = storeName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);

  return slug || "seller";
}

function TextInput({
  error,
  icon: Icon,
  label,
  name,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  error?: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  name: keyof FormValues;
  onChange: (name: keyof FormValues, value: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className={authLabelClass}>
        {label}
        {required ? <RequiredMark /> : null}
      </span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
        <input
          name={name}
          type={type}
          value={value}
          required={required}
          onChange={(event) => onChange(name, event.target.value)}
          onBlur={(event) => onChange(name, event.target.value.trim())}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          className={cn(
            authInputClass,
            error &&
              "border-red-300 focus:border-red-400 focus:ring-red-400/20",
          )}
        />
      </span>
      {error ? (
        <span id={`${name}-error`} className="text-[12px] font-semibold text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function StatusPanel({
  description,
  title,
  tone = "neutral",
}: {
  description: string;
  title: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-[#58d83f]/30 bg-[#58d83f]/10 text-[#58d83f]"
      : tone === "warning"
        ? "border-amber-300/40 bg-amber-400/10 text-amber-500"
        : "border-[#d9deea] bg-[#fafafa] text-[#11952f] dark:border-white/12 dark:bg-white/5 dark:text-white";

  return (
    <div className={cn("rounded-[10px] border p-5", toneClass)}>
      <div className="grid size-12 place-items-center rounded-full bg-current/10">
        <ShieldCheck className="size-6" />
      </div>
      <h2 className="mt-5 text-[22px] font-extrabold leading-tight text-[#070b16] dark:text-white">
        {title}
      </h2>
      <p className="mt-3 text-[14px] leading-6 text-[#596176] dark:text-zinc-300">
        {description}
      </p>
    </div>
  );
}

function EmailGate({
  initialState = emailInitialState,
}: {
  initialState?: SellerEmailCheckState;
}) {
  const [state, action, pending] = useActionState(
    checkSellerRegistrationEmail,
    initialState,
  );

  if (
    state.mode === "new_user" ||
    state.mode === "existing_signed_in"
  ) {
    return <ApplicationForm emailState={state} />;
  }

  return (
    <div className="w-full max-w-[390px]">
      <div className="mb-9 text-center lg:text-left">
        <BrandMark className="mx-auto mb-9 w-[126px] lg:hidden" />
        <div className="mx-auto mb-6 grid size-[74px] place-items-center rounded-full bg-[#58d83f]/16 text-[#0f8a2c] lg:hidden">
          <Store className="size-9" />
        </div>
        <h1 className="m-0 text-[22px] font-extrabold leading-tight text-[#070b16] dark:text-white">
          Apply to sell on Piessang
        </h1>
        <p className="mx-auto mt-3 max-w-[330px] text-[14px] leading-5 text-[#596176] dark:text-zinc-300 lg:mx-0">
          Start with your email so we can check your account status.
        </p>
      </div>

      <form action={action}>
        <label className="grid gap-2">
          <span className={authLabelClass}>
            Email address
            <RequiredMark />
          </span>
          <span className="relative block">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state.email}
              placeholder="youremail@example.com"
              className={authInputClass}
            />
          </span>
        </label>

        {state.error ? (
          <p className="mt-5 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className={cn("mt-7", authPrimaryButtonClass)}
        >
          <ArrowRight className="size-4" />
          {pending ? "Checking..." : "Continue"}
        </button>
      </form>

      <EmailStatus state={state} />

      <div className="my-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-[#e2e6ef] dark:bg-white/12" />
        <span className="text-xs font-bold uppercase text-[#596176]">OR</span>
        <span className="h-px flex-1 bg-[#e2e6ef] dark:bg-white/12" />
      </div>

      <form action={registerSellerWithGoogle}>
        <button
          type="submit"
          className={authSecondaryButtonClass}
      >
          <GoogleGlyph />
          <span className="text-[#070b16] dark:text-white">
            Sign in with Google
          </span>
        </button>
      </form>

      <div className="mt-13 text-center">
        <ShieldCheck className="mx-auto size-9 text-[#2eb338]" />
        <p className="mt-4 text-[13px] font-extrabold text-[#070b16] dark:text-white">
          Secure seller application
        </p>
        <p className="mx-auto mt-2 max-w-[260px] text-[13px] leading-5 text-[#596176] dark:text-zinc-300">
          Your application details are encrypted and protected
        </p>
      </div>
    </div>
  );
}

function EmailStatus({ state }: { state: SellerEmailCheckState }) {
  if (state.mode === "sign_in_required") {
    return (
      <div className="mt-6">
        <StatusPanel
          title="Account found"
          description="This email already belongs to a Piessang account. Sign in first, then we will continue your seller application from there."
          tone="warning"
        />
        <Link
          href={`/sign-in${state.email ? `?email=${encodeURIComponent(state.email)}` : ""}`}
          className={cn("mt-4", authPrimaryButtonClass)}
        >
          Go to Seller Sign In
        </Link>
      </div>
    );
  }

  if (state.mode === "already_seller") {
    return (
      <div className="mt-6">
        <StatusPanel
          title="Seller access already exists"
          description="This account already has seller access. Sign in to manage your store from the seller dashboard."
          tone="success"
        />
        <Link
          href="/sign-in"
          className={cn("mt-4", authPrimaryButtonClass)}
        >
          Go to Seller Sign In
        </Link>
      </div>
    );
  }

  if (state.mode === "existing_application") {
    const copy = {
      approved: {
        title: "Application approved",
        description:
          "Your seller application has been approved. Sign in to access your seller dashboard.",
        tone: "success" as const,
      },
      pending: {
        title: "Application under review",
        description:
          "We already have your seller application. Our team will review it and get back to you.",
        tone: "neutral" as const,
      },
      rejected: {
        title: "Application reviewed",
        description:
          "This application has already been reviewed. Contact support if you believe this needs another look.",
        tone: "warning" as const,
      },
    }[state.applicationStatus ?? "pending"];

    return (
      <div className="mt-6">
        <StatusPanel {...copy} />
      </div>
    );
  }

  if (state.mode === "email_mismatch") {
    return (
      <div className="mt-6">
        <StatusPanel
          title="Use your signed-in email"
          description="You are already signed in. Please use that same email address or sign out before starting another seller application."
          tone="warning"
        />
      </div>
    );
  }

  return null;
}

function StoreNameAvailabilityMessage({
  availability,
  currentName,
  isPending,
  onSuggestionClick,
}: {
  availability: StoreNameAvailability;
  currentName: string;
  isPending: boolean;
  onSuggestionClick: (storeName: string) => void;
}) {
  const trimmedName = currentName.trim();

  if (trimmedName.length < 2) {
    return (
      <p className="text-[12px] leading-5 text-[#7a8297] dark:text-zinc-400">
        Enter a store name to check storefront availability.
      </p>
    );
  }

  const isCurrentCheck = availability.checkedName === trimmedName;

  if (
    availability.status === "checking" ||
    isPending ||
    !isCurrentCheck
  ) {
    return (
      <p className="text-[12px] font-semibold leading-5 text-[#7a8297] dark:text-zinc-400">
        Checking storefront name...
      </p>
    );
  }

  if (availability.status === "available") {
    return (
      <p className="text-[12px] font-semibold leading-5 text-[#2eb338]">
        Available as /seller/{availability.storeSlug ?? createClientStoreSlug(trimmedName)}
      </p>
    );
  }

  if (availability.status === "unavailable") {
    return (
      <div className="grid gap-2">
        <p className="text-[12px] font-semibold leading-5 text-red-500">
          That storefront name is already taken.
        </p>
        {availability.suggestions?.length ? (
          <div className="flex flex-wrap gap-2">
            {availability.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick(suggestion)}
                className="rounded-full border border-[#58d83f]/35 px-3 py-1 text-[12px] font-semibold text-[#58d83f] transition hover:border-[#58d83f] hover:bg-[#58d83f]/10"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (availability.status === "error") {
    return (
      <p className="text-[12px] font-semibold leading-5 text-red-500">
        {availability.error}
      </p>
    );
  }

  return null;
}

function ApplicationForm({ emailState }: { emailState: SellerEmailCheckState }) {
  const [submitState, submitAction, pending] = useActionState(
    submitSellerApplication,
    submitInitialState,
  );
  const [values, setValues] = useState<FormValues>(initialFormValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [storeNameAvailability, setStoreNameAvailability] =
    useState<StoreNameAvailability>({ status: "idle" });
  const [agreedToReview, setAgreedToReview] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingStoreName, startStoreNameTransition] = useTransition();
  const isNewUser = emailState.mode === "new_user";
  const [step, setStep] = useState(0);
  const steps = useMemo(
    () =>
      isNewUser
        ? ["Account", "Business", "Address", "Review"]
        : ["Business", "Address", "Review"],
    [isNewUser],
  );
  const maxStep = steps.length - 1;
  const currentStep = steps[step] as StepName;
  const selectedCountry =
    countries.find((country) => country.code === values.countryCode) ??
    defaultCountry;

  useEffect(() => {
    const storeName = values.storeName.trim();

    if (storeName.length < 2) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      startStoreNameTransition(async () => {
        const result = await checkSellerStoreNameAvailability(storeName);

        setStoreNameAvailability({
          ...result,
          checkedName: storeName,
          status: result.error
            ? "error"
            : result.available
              ? "available"
              : "unavailable",
        });
      });
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [values.storeName]);

  function updateValue(name: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      if (!current[name]) {
        return current;
      }

      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function requireText(
    errors: FieldErrors,
    field: keyof FormValues,
    label: string,
    minLength = 2,
  ) {
    const sanitizedValue = values[field].trim();

    if (!sanitizedValue) {
      errors[field] = `${label} is required.`;
      return;
    }

    if (sanitizedValue.length < minLength) {
      errors[field] = `${label} is too short.`;
    }
  }

  function validateStep(stepName: StepName) {
    const errors: FieldErrors = {};

    if (stepName === "Account" && isNewUser) {
      requireText(errors, "fullName", "Full name");

      if (!values.password) {
        errors.password = "Password is required.";
      } else if (values.password.length < 8) {
        errors.password = "Password must be at least 8 characters.";
      }
    }

    if (stepName === "Business") {
      requireText(errors, "storeName", "Store name");
      requireText(errors, "businessType", "Business type");
      requireText(errors, "countryRegion", "Country / region");

      if (!values.phoneLocal) {
        errors.phone = "Phone number is required.";
      } else if (
        values.phoneLocal.length < selectedCountry.nationalMin ||
        values.phoneLocal.length > selectedCountry.nationalMax
      ) {
        errors.phone =
          selectedCountry.nationalMin === selectedCountry.nationalMax
            ? `Enter a ${selectedCountry.nationalMax}-digit mobile number for ${selectedCountry.name}.`
            : `Enter a ${selectedCountry.nationalMin}-${selectedCountry.nationalMax} digit mobile number for ${selectedCountry.name}.`;
      }
    }

    if (stepName === "Address") {
      requireText(errors, "addressLine1", "Address line 1", 3);
      requireText(errors, "city", "City");
      requireText(errors, "stateProvince", "State / province");
      requireText(errors, "postalCode", "Postal code");
    }

    if (stepName === "Review" && !agreedToReview) {
      errors.agreement = "Confirm the seller review agreement before submitting.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function validateStoreNameBeforeContinue() {
    const storeName = values.storeName.trim();

    if (storeName.length < 2) {
      return false;
    }

    if (
      storeNameAvailability.status === "available" &&
      storeNameAvailability.checkedName === storeName
    ) {
      return true;
    }

    setStoreNameAvailability({
      checkedName: storeName,
      status: "checking",
    });

    const result = await checkSellerStoreNameAvailability(storeName);
    const nextAvailability: StoreNameAvailability = {
      ...result,
      checkedName: storeName,
      status: result.error
        ? "error"
        : result.available
          ? "available"
          : "unavailable",
    };

    setStoreNameAvailability(nextAvailability);

    if (!result.available) {
      setFieldErrors((current) => ({
        ...current,
        storeName:
          result.error ??
          "That store name is already in use. Choose one of the suggestions or enter a different name.",
      }));
      return false;
    }

    return true;
  }

  async function goToNextStep() {
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep === "Business" && !(await validateStoreNameBeforeContinue())) {
      return;
    }

    setValues((current) => ({
      ...current,
      addressLine1: current.addressLine1.trim(),
      addressLine2: current.addressLine2.trim(),
      businessType: current.businessType.trim(),
      city: current.city.trim(),
      countryRegion: current.countryRegion.trim(),
      fullName: current.fullName.trim(),
      phone: current.phone.trim(),
      postalCode: current.postalCode.trim(),
      stateProvince: current.stateProvince.trim(),
      storeName: current.storeName.trim(),
    }));

    setStep((current) => Math.min(current + 1, maxStep));
  }

  function useStoreNameSuggestion(storeName: string) {
    updateValue("storeName", storeName);
    setStoreNameAvailability({ status: "checking", checkedName: storeName });
  }

  function updateCountry(countryCode: string) {
    const country =
      countries.find((item) => item.code === countryCode) ?? defaultCountry;
    const phoneLocal = sanitizeNationalPhoneNumber(values.phoneLocal, country);

    setValues((current) => ({
      ...current,
      countryCode: country.code,
      countryRegion: country.name,
      phoneDialCode: country.dialCode,
      phoneLocal,
      phone: `${country.dialCode}${phoneLocal}`,
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.countryRegion;
      delete next.phone;
      return next;
    });
  }

  function updatePhoneLocal(rawValue: string) {
    const phoneLocal = sanitizeNationalPhoneNumber(rawValue, selectedCountry);

    setValues((current) => ({
      ...current,
      phoneDialCode: selectedCountry.dialCode,
      phoneLocal,
      phone: `${selectedCountry.dialCode}${phoneLocal}`,
    }));
    setFieldErrors((current) => {
      if (!current.phone) {
        return current;
      }

      const next = { ...current };
      delete next.phone;
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!validateStep("Review")) {
      event.preventDefault();
    }
  }

  if (submitState.ok) {
    return (
      <div className="w-full max-w-[390px]">
        <StatusPanel
          title="Application submitted"
          description="Thank you for applying to sell on Piessang. We have received your application and will review it before activating seller access."
          tone="success"
        />
        <Link
          href="/sign-in"
          className={cn("mt-5", authPrimaryButtonClass)}
        >
          Go to Seller Sign In
        </Link>
      </div>
    );
  }

  return (
    <form
      action={submitAction}
      noValidate
      onSubmit={handleSubmit}
      className="w-full max-w-[390px]"
    >
      <input type="hidden" name="email" value={emailState.email ?? ""} />
      <input type="hidden" name="countryRegion" value={values.countryRegion} />
      <input type="hidden" name="phone" value={values.phone} />

      <div className="mb-9 text-center lg:text-left">
        <BrandMark className="mx-auto mb-9 w-[126px] lg:hidden" />
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#11952f]">
          Step {step + 1} of {steps.length}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e2e6ef] dark:bg-white/12">
          <div
            className="h-full rounded-full bg-[#58d83f] transition-all"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
        <h1 className="mt-6 text-[22px] font-extrabold leading-tight text-[#070b16] dark:text-white">
          {currentStep === "Account" ? "Create your account" : null}
          {currentStep === "Business" ? "Business information" : null}
          {currentStep === "Address" ? "Store address" : null}
          {currentStep === "Review" ? "Review & submit" : null}
        </h1>
        <p className="mx-auto mt-3 max-w-[330px] text-[14px] leading-5 text-[#596176] dark:text-zinc-300 lg:mx-0">
          {currentStep === "Account"
            ? "Create the account that will own this seller application."
            : null}
          {currentStep === "Business"
            ? "Tell us about the store you want to launch."
            : null}
          {currentStep === "Address"
            ? "Add the location connected to your seller profile."
            : null}
          {currentStep === "Review"
            ? "Confirm everything looks correct before submitting."
            : null}
        </p>
      </div>

      <div className={cn("grid gap-6", currentStep !== "Account" && "hidden")}>
        <TextInput
          error={fieldErrors.fullName}
          icon={User}
          label="Full name"
          name="fullName"
          onChange={updateValue}
          placeholder="Enter your full name"
          required={isNewUser}
          value={values.fullName}
        />
        <label className="grid gap-2">
          <span className={authLabelClass}>
            Password
            {isNewUser ? <RequiredMark /> : null}
          </span>
          <span className="relative block">
            <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required={isNewUser}
              minLength={8}
              value={values.password}
              onChange={(event) => updateValue("password", event.target.value)}
              placeholder="Create a strong password"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              className={cn(
                authPasswordInputClass,
                fieldErrors.password &&
                  "border-red-300 focus:border-red-400 focus:ring-red-400/20",
              )}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-4 top-1/2 grid size-5 -translate-y-1/2 place-items-center text-[#596176] transition hover:text-[#070b16] dark:text-zinc-400 dark:hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </span>
          {fieldErrors.password ? (
            <span id="password-error" className="text-[12px] font-semibold text-red-600">
              {fieldErrors.password}
            </span>
          ) : null}
        </label>
      </div>

      <div className={cn("grid gap-6", currentStep !== "Business" && "hidden")}>
        <TextInput
          error={fieldErrors.storeName}
          icon={Store}
          label="Store name"
          name="storeName"
          onChange={updateValue}
          placeholder="Enter your store name"
          required
          value={values.storeName}
        />
        <div className="-mt-4">
          <StoreNameAvailabilityMessage
            availability={storeNameAvailability}
            currentName={values.storeName}
            isPending={isCheckingStoreName}
            onSuggestionClick={useStoreNameSuggestion}
          />
        </div>
        <label className="grid gap-2">
          <span className={authLabelClass}>
            Business type
            <RequiredMark />
          </span>
          <select
            name="businessType"
            value={values.businessType}
            required
            onChange={(event) => updateValue("businessType", event.target.value)}
            aria-invalid={Boolean(fieldErrors.businessType)}
            aria-describedby={
              fieldErrors.businessType ? "businessType-error" : undefined
            }
            className={cn(
              "h-[45px] w-full rounded-[6px] border border-[#d9deea] bg-white px-4 text-[14px] font-medium text-[#070b16] outline-none transition focus:border-[#58d83f] focus:ring-4 focus:ring-[#58d83f]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white",
              fieldErrors.businessType &&
                "border-red-300 focus:border-red-400 focus:ring-red-400/20",
            )}
          >
            <option value="">Select your business type</option>
            {businessTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {fieldErrors.businessType ? (
            <span
              id="businessType-error"
              className="text-[12px] font-semibold text-red-600"
            >
              {fieldErrors.businessType}
            </span>
          ) : null}
        </label>
        <label className="grid gap-2">
          <span className={authLabelClass}>
            Country / Region
            <RequiredMark />
          </span>
          <span className="relative block">
            <MapPin className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
            <select
              name="countryCode"
              value={values.countryCode}
              required
              onChange={(event) => updateCountry(event.target.value)}
              aria-invalid={Boolean(fieldErrors.countryRegion)}
              aria-describedby={
                fieldErrors.countryRegion ? "countryRegion-error" : undefined
              }
              className={cn(
                "h-[45px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-4 text-[14px] font-medium text-[#070b16] outline-none transition focus:border-[#58d83f] focus:ring-4 focus:ring-[#58d83f]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white",
                fieldErrors.countryRegion &&
                  "border-red-300 focus:border-red-400 focus:ring-red-400/20",
              )}
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
          </span>
          {fieldErrors.countryRegion ? (
            <span
              id="countryRegion-error"
              className="text-[12px] font-semibold text-red-600"
            >
              {fieldErrors.countryRegion}
            </span>
          ) : null}
        </label>

        <label className="grid gap-2">
          <span className={authLabelClass}>
            Phone number
            <RequiredMark />
          </span>
          <span
            className={cn(
              "grid h-[45px] grid-cols-[118px_1fr] overflow-hidden rounded-[6px] border border-[#d9deea] bg-white transition focus-within:border-[#58d83f] focus-within:ring-4 focus-within:ring-[#58d83f]/20 dark:border-white/12 dark:bg-[#151719]",
              fieldErrors.phone &&
                "border-red-300 focus-within:border-red-400 focus-within:ring-red-400/20",
            )}
          >
            <select
              aria-label="Phone country code"
              value={values.countryCode}
              onChange={(event) => updateCountry(event.target.value)}
              className="h-full border-r border-[#d9deea] bg-transparent px-3 text-[14px] font-medium text-[#070b16] outline-none dark:border-white/12 dark:text-white"
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.dialCode}
                </option>
              ))}
            </select>
            <span className="relative block">
              <Smartphone className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
              <input
                inputMode="numeric"
                autoComplete="tel-national"
                value={values.phoneLocal}
                onChange={(event) => updatePhoneLocal(event.target.value)}
                placeholder="555 000 000"
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                className="h-full w-full bg-transparent pl-11 pr-4 text-[14px] font-medium text-[#070b16] outline-none placeholder:text-[#7a8297] dark:text-white dark:placeholder:text-zinc-500"
              />
            </span>
          </span>
          {fieldErrors.phone ? (
            <span id="phone-error" className="text-[12px] font-semibold text-red-600">
              {fieldErrors.phone}
            </span>
          ) : (
            <span className="text-[12px] leading-5 text-[#7a8297] dark:text-zinc-400">
              We store this as {values.phoneDialCode}
              {values.phoneLocal || " your mobile number"}.
            </span>
          )}
        </label>
      </div>

      <div className={cn("grid gap-6", currentStep !== "Address" && "hidden")}>
        <TextInput
          error={fieldErrors.addressLine1}
          icon={MapPin}
          label="Address line 1"
          name="addressLine1"
          onChange={updateValue}
          placeholder="Enter your address"
          required
          value={values.addressLine1}
        />
        <TextInput
          error={fieldErrors.addressLine2}
          icon={MapPin}
          label="Address line 2"
          name="addressLine2"
          onChange={updateValue}
          placeholder="Apartment, suite, etc."
          value={values.addressLine2}
        />
        <TextInput
          error={fieldErrors.city}
          icon={MapPin}
          label="City"
          name="city"
          onChange={updateValue}
          placeholder="Enter your city"
          required
          value={values.city}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <TextInput
            error={fieldErrors.stateProvince}
            icon={MapPin}
            label="State / Province"
            name="stateProvince"
            onChange={updateValue}
            placeholder="Enter state"
            required
            value={values.stateProvince}
          />
          <TextInput
            error={fieldErrors.postalCode}
            icon={MapPin}
            label="Postal code"
            name="postalCode"
            onChange={updateValue}
            placeholder="ZIP code"
            required
            value={values.postalCode}
          />
        </div>
      </div>

      <div className={cn("grid gap-6", currentStep !== "Review" && "hidden")}>
        <div className="rounded-[10px] border border-[#d9deea] bg-white p-5 text-[13px] dark:border-white/12 dark:bg-[#151719]">
          {[
            ["Email", emailState.email ?? ""],
            ["Store name", values.storeName],
            ["Business type", values.businessType],
            ["Phone", values.phone],
            [
              "Location",
              [values.city, values.stateProvince, values.countryRegion]
                .filter(Boolean)
                .join(", "),
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[112px_1fr] gap-4 py-2 text-[#596176] dark:text-zinc-300"
            >
              <span>{label}</span>
              <strong className="font-semibold text-[#070b16] dark:text-white">
                {value || "Not provided"}
              </strong>
            </div>
          ))}
        </div>
        <label className="flex items-start gap-3 text-[13px] leading-5 text-[#596176] dark:text-zinc-300">
          <input
            type="checkbox"
            checked={agreedToReview}
            onChange={(event) => {
              setAgreedToReview(event.target.checked);
              setFieldErrors((current) => {
                if (!current.agreement) {
                  return current;
                }

                const next = { ...current };
                delete next.agreement;
                return next;
              });
            }}
            className="mt-0.5 size-4 rounded border-[#cbd2df]"
          />
          I confirm that this information is accurate and I agree to Piessang&apos;s
          seller review process.
          <RequiredMark />
        </label>
        {fieldErrors.agreement ? (
          <p className="text-[12px] font-semibold text-red-600">
            {fieldErrors.agreement}
          </p>
        ) : null}
      </div>

      {submitState.error ? (
        <p className="mt-5 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {submitState.error}
        </p>
      ) : null}

      <div className="mt-7 grid gap-3">
        {step === maxStep ? (
          <button
            type="submit"
            disabled={pending}
            className={authPrimaryButtonClass}
          >
            <LockKeyhole className="size-4" />
            {pending ? "Submitting..." : "Submit Application"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              void goToNextStep();
            }}
            className={authPrimaryButtonClass}
          >
            <ArrowRight className="size-4" />
            Continue
          </button>
        )}
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            className="inline-flex h-7 w-fit items-center justify-start gap-2 text-[13px] font-semibold text-[#58d83f] transition hover:text-[#2eb338]"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function SellerRegisterScreen({
  initialEmailState,
}: {
  initialEmailState?: SellerEmailCheckState;
}) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [didVideoEnd, setDidVideoEnd] = useState(false);

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-white dark:bg-[#0f1114] lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(430px,1fr)]">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <section className="relative min-h-[430px] min-w-0 overflow-hidden bg-[#06130d] px-7 py-8 lg:min-h-screen lg:px-10 xl:px-12">
        <video
          aria-hidden="true"
          autoPlay
          muted
          onCanPlay={() => setIsVideoReady(true)}
          onLoadedData={() => setIsVideoReady(true)}
          onEnded={() => setDidVideoEnd(true)}
          onError={() => {
            setIsVideoReady(true);
            setDidVideoEnd(true);
          }}
          onPlaying={() => setIsVideoReady(true)}
          playsInline
          preload="auto"
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out",
            isVideoReady ? "opacity-100" : "opacity-0",
          )}
        >
          <source
            src="/brand/video/make_all_of_these_products_com_Seedance_20_39082.mp4"
            type="video/mp4"
          />
        </video>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_93%_8%,rgba(88,216,63,0.16),transparent_30%),radial-gradient(circle_at_69%_82%,rgba(88,216,63,0.22),transparent_39%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent)]" />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[78%] bg-[linear-gradient(90deg,rgba(0,0,0,0.9),rgba(0,0,0,0.66)_42%,rgba(0,0,0,0.28)_72%,transparent)] transition-opacity duration-1000 ease-out",
            didVideoEnd ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "relative z-20 transition-all duration-1000 ease-out",
            didVideoEnd ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0",
          )}
        >
          <BrandMark className="w-[136px]" />

          <div className="mt-[112px]">
            <h2 className="max-w-[390px] text-[34px] font-extrabold leading-[1.08] xl:text-[36px]">
              Join Piessang as a{" "}
              <span style={{ color: sellerGreen }}>Seller</span>
            </h2>
            <p className="mt-5 max-w-[385px] text-[14px] font-medium leading-6 text-white/88">
              Start your journey and grow your business with Piessang Marketplace.
            </p>
          </div>

          <div className="mt-8 grid gap-6">
            {featureItems.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="grid grid-cols-[44px_1fr] gap-4">
                  <div className="grid size-11 place-items-center rounded-[8px] border border-white/12 bg-[#58d83f]/10 text-[#58d83f] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-extrabold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1 max-w-[285px] text-[13px] leading-5 text-white/72">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid min-h-[calc(100vh-430px)] min-w-0 place-items-center bg-white px-7 py-10 dark:bg-[#0f1114] sm:px-12 lg:min-h-screen lg:px-16">
        <EmailGate initialState={initialEmailState} />
      </section>
    </main>
  );
}
