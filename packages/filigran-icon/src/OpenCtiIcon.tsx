import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgOpenCtiIcon = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M22.897 23.745 0 1.092 1.103 0 24 22.653z"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M0 22.653 22.897 0 24 1.092 1.103 23.745zM18.618 1.092 11.956 7.68l-6.657-6.59L6.402.001l5.554 5.497L17.516 0zM11.984 16.072l.56.553 6.094 6.028-1.103 1.092-5.55-5.49-5.548 5.49-1.104-1.092z"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M13.079 1.31 11.886.13l-1.193 1.18 1.193 1.18zM13.08 22.664l-1.193-1.18-1.193 1.18 1.193 1.18z"
    />
  </svg>
);
export default SvgOpenCtiIcon;
