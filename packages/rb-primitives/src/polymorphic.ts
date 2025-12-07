import type { ComponentPropsWithRef, ComponentPropsWithoutRef, ElementType } from 'react';

export type AsProp<E extends ElementType> = {
  as?: E;
};

export type PolymorphicComponentProps<E extends ElementType, P> = P &
  AsProp<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof P | 'as'>;

export type PolymorphicRef<E extends ElementType> = ComponentPropsWithRef<E>['ref'];
