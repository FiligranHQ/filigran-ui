import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgDatabaseOutline1 = ({
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
      d="M12 21q-3.775 0-6.388-1.163T3 17V7q0-1.65 2.638-2.825T12 3t6.363 1.175T21 7v10q0 1.675-2.613 2.838T12 21m0-11.975q2.225 0 4.475-.638T19 7.025q-.275-.725-2.513-1.375a15.864 15.864 0 0 0-8.95-.012Q5.349 6.276 5 7.024q.35.75 2.538 1.375T12 9.025M12 14q1.05 0 2.025-.1t1.863-.288a14 14 0 0 0 1.675-.462A10 10 0 0 0 19 12.525v-3a10 10 0 0 1-1.438.625q-.788.275-1.675.463a18 18 0 0 1-1.862.287Q13.05 11 12 11t-2.05-.1a18 18 0 0 1-1.888-.288A13 13 0 0 1 6.4 10.15 9 9 0 0 1 5 9.525v3q.625.35 1.4.625t1.663.463q.886.187 1.887.287T12 14m0 5q1.15 0 2.337-.175a17 17 0 0 0 2.188-.463q1-.287 1.675-.65t.8-.737v-2.45a10 10 0 0 1-1.438.625q-.788.275-1.675.463a18 18 0 0 1-1.862.287Q13.05 16 12 16t-2.05-.1a18 18 0 0 1-1.888-.288A13 13 0 0 1 6.4 15.15a9 9 0 0 1-1.4-.625V17q.125.375.788.725t1.662.638q1 .286 2.2.462Q10.85 19 12 19"
    />
  </svg>
);
export default SvgDatabaseOutline1;
