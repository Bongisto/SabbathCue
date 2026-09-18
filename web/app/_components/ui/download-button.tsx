"use client";

import { IconBrandWindows } from "@tabler/icons-react";
import { Button } from "./button";
import { windowsInstallerDownloadLinkProps } from "../../_lib/windows-installer-download";

export function DownloadButton({
  size = "md",
  className,
}: {
  size?: "md" | "lg";
  className?: string;
}) {
  const downloadLink = windowsInstallerDownloadLinkProps();
  return (
    <Button
      href={downloadLink.href}
      target={downloadLink.target}
      download={downloadLink.download}
      variant="primary"
      size={size}
      className={className}
    >
      <IconBrandWindows size={16} aria-hidden stroke={2} />
      <span>Download for Windows</span>
    </Button>
  );
}
