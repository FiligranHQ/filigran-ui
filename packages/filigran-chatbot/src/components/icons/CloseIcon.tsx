const defaultButtonColor = '#3B81F6';
const defaultIconColor = 'white';

export const CloseIcon = (props: { color?: string }) => (
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
      fill={props.color ?? defaultIconColor}
      d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
    />
  </svg>
);
