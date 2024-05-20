import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgIndicator = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 38"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M18.5 14.25c1.227 0 2.403.5 3.27 1.391A4.82 4.82 0 0 1 23.125 19c0 1.26-.487 2.468-1.355 3.359a4.56 4.56 0 0 1-3.27 1.391c-1.227 0-2.403-.5-3.27-1.391A4.82 4.82 0 0 1 13.875 19c0-1.26.487-2.468 1.355-3.359a4.56 4.56 0 0 1 3.27-1.391m9.034 16.324c-2.513 3.024-5.519 4.972-9.034 5.843-3.947-.966-7.246-3.278-9.897-6.92-2.652-3.625-3.978-7.647-3.978-12.08v-9.5L18.5 1.583l13.875 6.334v9.5c0 3.784-.987 7.299-2.96 10.56l-4.486-4.607a8.17 8.17 0 0 0 1.28-4.37c0-2.1-.813-4.113-2.258-5.598a7.6 7.6 0 0 0-5.451-2.319 7.6 7.6 0 0 0-5.45 2.32A8.03 8.03 0 0 0 10.791 19c0 2.1.812 4.113 2.257 5.598a7.6 7.6 0 0 0 5.451 2.319c1.542 0 3.037-.491 4.255-1.315z"
    />
  </svg>
);
export default SvgIndicator;
