
type TODO = any;

function toVal(mix: TODO) {
  let k,
    y,
    str = "";

  if (typeof mix === "string" || typeof mix === "number") {
    str += mix;
  } else if (typeof mix === "object") {
    if (Array.isArray(mix)) {
      let len = mix.length;
      for (k = 0; k < len; k++) {
        if (mix[k]) {
          if ((y = toVal(mix[k]))) {
            // Changed assignment to conditional expression
            str && (str += " ");
            str += y;
          }
        }
      }
    } else {
      for (y in mix) {
        if (mix[y]) {
          str && (str += " ");
          str += y;
        }
      }
    }
  }

  return str;
}

export type ClassValue =
  | ClassArray
  | ClassDictionary
  | string
  | number
  | bigint
  | null
  | boolean
  | undefined;
export type ClassDictionary = Record<string, any>;
export type ClassArray = ClassValue[];

export function clsx(...inputs: ClassValue[]): string {
  const len = inputs.length; // Changed 'let' to 'const'

  let i = 0,
    tmp,
    x,
    str = "";
  for (; i < len; i++) {
    if ((tmp = inputs[i])) {
      // Changed assignment to conditional expression
      if ((x = toVal(tmp))) {
        // Changed assignment to conditional expression
        str && (str += " ");
        str += x;
      }
    }
  }
  return str;
}

export default clsx;
