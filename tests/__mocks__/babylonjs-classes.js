// Define Color3 and Color4 classes for testing
export class Color3 {
    constructor(r = 0, g = 0, b = 0) {
        Object.defineProperty(this, "r", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "g", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "b", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.r = r;
        this.g = g;
        this.b = b;
    }
    static White() {
        return new Color3(1, 1, 1);
    }
    static Black() {
        return new Color3(0, 0, 0);
    }
    static Yellow() {
        return new Color3(1, 1, 0);
    }
    static Red() {
        return new Color3(1, 0, 0);
    }
    static Green() {
        return new Color3(0, 1, 0);
    }
    static Blue() {
        return new Color3(0, 0, 1);
    }
}
export class Color4 extends Color3 {
    constructor(r = 0, g = 0, b = 0, a = 1) {
        super(r, g, b);
        Object.defineProperty(this, "a", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.a = a;
    }
}
