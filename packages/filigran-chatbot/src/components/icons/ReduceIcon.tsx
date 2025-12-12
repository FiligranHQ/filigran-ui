const defaultButtonColor = '#3B81F6';
export const ReduceIcon = (props: { color?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="icon icon-tabler icon-tabler-refresh"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke={props.color ?? defaultButtonColor}
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path
      d="M14 10L21 3M14 10H20M14 10V4M3 21L10 14M10 14V20M10 14H4"
      stroke={props.color ?? defaultButtonColor}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);
