
import type * as React from "react";

export type Merge<P1 = {}, P2 = {}> = Omit<P1, keyof P2> & P2;

export type IntrinsicElement<E> = E extends ForwardRefComponent<infer I, any> ? I : never;

type ForwardRefExoticComponent<E, OwnProps> = React.ForwardRefExoticComponent<
 Merge<
   E extends React.ElementType ? React.ComponentPropsWithRef<E> : never,
   OwnProps & {
     as?: E;
   }
 >
>;
export interface ForwardRefComponent<
 IntrinsicElementString,
 OwnProps = {},
> extends ForwardRefExoticComponent<IntrinsicElementString, OwnProps> {
 <As = IntrinsicElementString>(
   props: As extends ""
     ? {
         as: keyof JSX.IntrinsicElements;
       }
     : As extends React.ComponentType<infer P>
       ? Merge<
           P,
           OwnProps & {
             as: As;
           }
         >
       : As extends keyof JSX.IntrinsicElements
         ? Merge<
             JSX.IntrinsicElements[As],
             OwnProps & {
               as: As;
             }
           >
         : never,
 ): React.ReactElement | null;
}
