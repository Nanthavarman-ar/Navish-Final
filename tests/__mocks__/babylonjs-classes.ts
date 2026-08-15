// Define Color3 and Color4 classes for testing
export class Color3 {
  r: number;
  g: number;
  b: number;

  constructor(r: number = 0, g: number = 0, b: number = 0) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  static White(): Color3 {
    return new Color3(1, 1, 1);
  }

  static Black(): Color3 {
    return new Color3(0, 0, 0);
  }

  static Yellow(): Color3 {
    return new Color3(1, 1, 0);
  }

  static Red(): Color3 {
    return new Color3(1, 0, 0);
  }

  static Green(): Color3 {
    return new Color3(0, 1, 0);
  }

  static Blue(): Color3 {
    return new Color3(0, 0, 1);
  }
}

export class Color4 extends Color3 {
  a: number;

  constructor(r: number = 0, g: number = 0, b: number = 0, a: number = 1) {
    super(r, g, b);
    this.a = a;
  }
}
