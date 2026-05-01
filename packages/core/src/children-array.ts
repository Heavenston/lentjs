import { defineSerialization, register } from "@lentjs/core-serialize";

type K<T> = ["g", ()=>T] | ["v", T];

export class ChildrenArray<T> extends Array<T> {
  constructor() {
    super();
    defineSerialization(this, this.reducer.bind(this), (ChildrenArray<T>).reviver);
  }

  public child(val: T): this {
    this.push(val);
    return this;
  }

  public computed(getter: () => T): this {
    Object.defineProperty(this, this.length, {
      get: getter,
      enumerable: true,
      configurable: true,
    });
    return this;
  }

  public isComputed(idx: number): boolean {
    const desc = Object.getOwnPropertyDescriptor(this, idx);
    return desc?.get != null;
  }

  public asComputed(idx: number): (() => T) | null {
    const desc = Object.getOwnPropertyDescriptor(this, idx);
    if (!desc) throw new Error("Out of bound access");
    if (desc.get)
      return desc.get;
    else
      return null;
  }

  public getOrComputed(idx: number): T | (() => T) {
    const desc = Object.getOwnPropertyDescriptor(this, idx);
    if (!desc) throw new Error("Out of bound access");
    if (desc.get)
      return desc.get;
    else
      return desc.value;
  }

  private reducer(): K<T>[] {
    const result: K<T>[] = [];
    for (let i = 0; i < this.length; i++) {
      const desc = Object.getOwnPropertyDescriptor(this, i)!;
      if (desc.get)
        result.push(["g", desc.get]);
      else
        result.push(["v", desc.value]);
    }
    return result;
  }

  private static reviver<T>(val: K<T>[]): ChildrenArray<T> {
    const result = new ChildrenArray<T>;
    for (const i of val) {
      if (i[0] === "g") {
        result.computed(i[1]);
      }
      else {
        result.push(i[1]);
      }
    }
    return result;
  }
  static { register(ChildrenArray.reviver, "__lentjs_ChildrenArray.reviver") }
}
