"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function RequiredIndicator() {
  return (
    <span aria-hidden="true" className="text-red-500">
      *
    </span>
  )
}

function renderRequiredChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string" && children.trimEnd().endsWith("*")) {
    const label = children.trimEnd().slice(0, -1).trimEnd()

    return (
      <>
        {label}
        <RequiredIndicator />
      </>
    )
  }

  if (Array.isArray(children)) {
    const lastIndex = children.length - 1
    const lastChild = children[lastIndex]

    if (
      typeof lastChild === "string" &&
      lastChild.trimEnd().endsWith("*")
    ) {
      return [
        ...children.slice(0, lastIndex),
        lastChild.trimEnd().slice(0, -1).trimEnd(),
        <RequiredIndicator key="required-indicator" />,
      ]
    }
  }

  return children
}

function Label({ className, children, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {renderRequiredChildren(children)}
    </label>
  )
}

export { Label, RequiredIndicator }
