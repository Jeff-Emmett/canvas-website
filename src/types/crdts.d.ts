declare module 'crdts/src/G-Set' {
    export default class GSet<T = any> {
        add(value: T): void;
        values(): Set<T>;
    }
} 