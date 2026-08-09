import { createElement, type ComponentPropsWithRef, type ElementType, type ReactNode } from "react";
import { CombatFrameCorners } from "./CombatFrameCorners";

type CombatFrameOwnProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  frameRef?: ComponentPropsWithRef<T>["ref"];
};

export type CombatFrameProps<T extends ElementType = "div"> = CombatFrameOwnProps<T> &
  Omit<ComponentPropsWithRef<T>, keyof CombatFrameOwnProps<T> | "ref">;

export function CombatFrame<T extends ElementType = "div">({
  as,
  children,
  className,
  frameRef,
  ...props
}: CombatFrameProps<T>) {
  const Component: ElementType = as ?? "div";
  const frameClassName = className ? `combat-frame ${className}` : "combat-frame";

  return createElement(
    Component,
    { ...props, ref: frameRef, className: frameClassName },
    <CombatFrameCorners />,
    children,
  );
}
