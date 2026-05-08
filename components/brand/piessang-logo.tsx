import Image from "next/image";

import { cn } from "@/lib/utils";

const logoSrc = "/brand/logo/Piessang Logo Full - Clipped.png";

type PiessangLogoProps = {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function PiessangLogo({
  className,
  imageClassName,
  priority = false,
}: PiessangLogoProps) {
  return (
    <div className={cn("relative h-9 w-48", className)}>
      <Image
        src={logoSrc}
        alt="Piessang"
        fill
        priority={priority}
        sizes="192px"
        className={cn("object-contain object-left", imageClassName)}
      />
    </div>
  );
}
