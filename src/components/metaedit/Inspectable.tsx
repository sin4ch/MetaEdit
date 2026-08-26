"use client";

import * as React from "react";
import { TargetMetadata } from "@/types/metaedit";

interface InspectableProps {
  id: string;
  component: string;
  source: string;
  description?: string;
  isInspecting: boolean;
  isSelected: boolean;
  remoteOutlineColor?: string;
  remoteCollaboratorName?: string;
  onSelect: (target: TargetMetadata) => void;
  children: React.ReactNode;
  className?: string;
}

export function Inspectable({
  id,
  component,
  source,
  description,
  children,
  className,
}: InspectableProps) {
  return (
    <div
      data-component={component}
      data-source={source}
      data-instance-id={id}
      data-description={description}
      className={className}
    >
      {children}
    </div>
  );
}
