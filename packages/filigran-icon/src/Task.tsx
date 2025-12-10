import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgTask = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 25 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M12.324 22q-2.182 0-4.056-.762a10.05 10.05 0 0 1-3.261-2.113 9.75 9.75 0 0 1-2.17-3.175q-.783-1.825-.783-3.95 0-2.1.783-3.925A9.75 9.75 0 0 1 5.007 4.9q1.386-1.35 3.26-2.125Q10.143 2 12.325 2q1.926 0 3.595.6t3.004 1.65l-1.104 1.075a8.7 8.7 0 0 0-2.516-1.35 9.1 9.1 0 0 0-2.979-.475q-3.723 0-6.226 2.438Q3.595 8.375 3.595 12t2.503 6.063 6.226 2.437 6.227-2.437q2.503-2.437 2.503-6.063 0-.75-.115-1.463a8.5 8.5 0 0 0-.347-1.387L21.773 8q.412.925.616 1.925.206 1 .206 2.075 0 2.125-.796 3.95a9.9 9.9 0 0 1-2.183 3.175q-1.386 1.35-3.26 2.113Q14.48 22 12.323 22m-1.514-5.45L6.573 12.4l1.155-1.125 3.082 3 10.63-10.35 1.18 1.125z"
    />
  </svg>
);
export default SvgTask;
