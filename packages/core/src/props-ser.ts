import { defineSerialization, register } from "@lentjs/core-serialize";

type ReducedProps = (["v", string, unknown] | ["g", string, () => unknown])[];

function reducer(p: object): ReducedProps {
  const result: ReducedProps = [];

  const descriptors = Object.getOwnPropertyDescriptors(p);
  for (const [k, desc] of Object.entries(descriptors)) {
    if (desc.get) {
      result.push(["g", k, desc.get]);
    }
    else {
      result.push(["v", k, desc.value]);
    }
  }
  return result;
}

const reviver = register((reduced: ReducedProps): object => {
  const result = {};
  Object.defineProperties(result, Object.fromEntries(reduced.map((entry): [string, PropertyDescriptor] => {
    if (entry[0] === "v") {
      return [entry[1], { value: entry[2], configurable: true, enumerable: true }];
    }
    else {
      return [entry[1], { get: entry[2], configurable: true, enumerable: true }];
    }
  })));
  return result;
}, "__lentjs_propsReviver");

export function defineAsProps<T extends object>(p: T): T {
  defineSerialization(p, reducer, reviver);
  return p;
}
