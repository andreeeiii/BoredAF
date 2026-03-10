import React from "react";

const motion = new Proxy(
  {},
  {
    get: (_target, prop: string) => {
      return React.forwardRef(
        (
          {
            children,
            ...props
          }: React.PropsWithChildren<Record<string, unknown>>,
          ref: React.Ref<HTMLElement>
        ) => {
          const filteredProps: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(props)) {
            if (
              ![
                "initial",
                "animate",
                "exit",
                "whileHover",
                "whileTap",
                "transition",
                "variants",
                "layout",
              ].includes(key)
            ) {
              filteredProps[key] = value;
            }
          }
          return React.createElement(
            prop,
            { ...filteredProps, ref },
            children
          );
        }
      );
    },
  }
);

function AnimatePresence({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}

export { motion, AnimatePresence };
