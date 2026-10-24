import type { SVGProps } from "react";
import { cn } from "cn";

interface DocMindLogoProps extends SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

export function DocMindLogo({
  className,
  size = 24,
  ...props
}: DocMindLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="365.5 384.5 1200 1200"
      width={size}
      height={size}
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      {/* Accent folds */}
      <g className="fill-accent">
        <polygon points="668,535 668,647 548,647" />
        <polygon points="1283,625 1388,733 1283,733" />
        <polygon points="1283,1237 1390,1237 1283,1340" />
        <rect x="1166" y="567" width="37" height="35" />
      </g>

      {/* Geometric Outlines */}
      <g
        className="stroke-current"
        strokeWidth="38"
        strokeLinejoin="miter"
        strokeMiterlimit="10"
        strokeLinecap="butt"
      >
        {/* Left page */}
        <path d="M1148,497 H686 L503,665 V1324 H783 V1160 L915,1030" />
        <path d="M686,497 V664 H503" />
        <path d="M1148,497 V775 L1015,910" />

        {/* Right page */}
        <path d="M966,672 V584 H1148" />
        <path d="M1203,584 H1270 L1428,750 V1225 L1270,1375 H966 V1260" />
        <path d="M1265,584 V750 H1428" />
        <path d="M1265,1375 V1218 H1428" />

        {/* Bottom connector */}
        <path d="M622,1324 V1472 H1148 V1375" />

        {/* Star rays */}
        <path d="M785,785 L915,915" />
        <path d="M1020,1035 L1145,1148" />
      </g>

      {/* Citation Spark Star */}
      <path
        className="fill-current"
        fillRule="evenodd"
        d="M966,715 L1015,888 L1215,966 L1015,1045 L966,1215 L915,1045 L716,966 L915,888 Z
           M966,830 L999,933 L1100,966 L999,999 L966,1100 L933,999 L832,966 L933,933 Z"
      />
    </svg>
  );
}
