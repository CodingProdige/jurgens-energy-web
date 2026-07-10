import Image from "next/image";

import { cn } from "@/lib/utils";

const logoSrc = "/brand/logo/jurgens-icon.png";

type JurgensEnergyLogoProps = {
  className?: string;
  compact?: boolean;
  markClassName?: string;
  textClassName?: string;
};

export function JurgensEnergyLogo({
  className,
  compact = false,
  markClassName,
  textClassName,
}: JurgensEnergyLogoProps) {
  const widthClass = compact ? "w-[5.4rem]" : "w-[9.05rem]";
  const jurgensLetters = "JURGENS".split("");
  const energyLetters = "ENERGY".split("");

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden",
          compact ? "size-8" : "size-12",
          markClassName,
        )}
      >
        <Image
          alt=""
          className="object-contain"
          fill
          priority
          sizes={compact ? "32px" : "48px"}
          src={logoSrc}
        />
      </span>
      <span
        className={cn(
          "grid leading-none",
          widthClass,
          compact ? "gap-0.5" : "gap-1",
          textClassName,
        )}
      >
        <span
          className={cn(
            "flex w-full justify-between font-black uppercase text-[#1a1a1a] dark:text-[#f7f7f2]",
            compact ? "text-[12px]" : "text-[22px]",
          )}
          aria-label="Jurgens"
        >
          {jurgensLetters.map((letter, index) => (
            <span aria-hidden="true" key={`${letter}-${index}`}>
              {letter}
            </span>
          ))}
        </span>
        <span
          className={cn(
            "flex w-full justify-between font-black uppercase text-[#ff5a1f]",
            compact ? "text-[8px]" : "text-[12px]",
          )}
          aria-label="Energy"
        >
          {energyLetters.map((letter, index) => (
            <span aria-hidden="true" key={`${letter}-${index}`}>
              {letter}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
