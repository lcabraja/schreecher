declare module "ggwave" {
  export interface GGWaveParameters { sampleRateInp: number; sampleRateOut: number; operatingMode: number; }
  export interface GGWaveModule {
    getDefaultParameters(): GGWaveParameters;
    init(parameters: GGWaveParameters): number;
    free(instance: number): void;
    encode(instance: number, message: string, protocol: unknown, volume: number): Int8Array;
    decode(instance: number, samples: Int8Array): Uint8Array;
    disableLog(): void;
    ProtocolId: { GGWAVE_PROTOCOL_AUDIBLE_FAST: unknown };
    GGWAVE_OPERATING_MODE_TX: number;
    GGWAVE_OPERATING_MODE_RX: number;
  }
  export default function factory(): Promise<GGWaveModule>;
}
