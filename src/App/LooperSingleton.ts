export default class LooperSingleton {
  private static instance: LooperSingleton;

  /**
   * Start looping over simulation
   *
   * @returns some number stub
   */
  public start(): number {
    return 1;
  }

  /**
   * Get the singleton instance
   *
   * @returns the singleton
   */
  static getInstance(): LooperSingleton {
    if (!LooperSingleton.instance) {
      LooperSingleton.instance = new LooperSingleton();
    }

    return LooperSingleton.instance;
  }
}