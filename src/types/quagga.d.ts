declare module 'quagga' {
    interface QuaggaConfig {
        inputStream: {
            type: string;
            target: HTMLElement | string;
            constraints: {
                facingMode: string;
                width: { min: number };
                height: { min: number };
                aspectRatio: { min: number; max: number };
            };
        };
        numOfWorkers?: number;
        locate?: boolean;
        frequency?: number;
        debug?: {
            drawBoundingBox?: boolean;
            showFrequency?: boolean;
            drawScanline?: boolean;
            showPattern?: boolean;
        };
        multiple?: boolean;
        locator?: {
            halfSample?: boolean;
            patchSize?: string;
            debug?: {
                showCanvas?: boolean;
                showPatches?: boolean;
                showFoundPatches?: boolean;
                showSkeleton?: boolean;
                showLabels?: boolean;
                showPatchLabels?: boolean;
                showRemainingPatchLabels?: boolean;
                boxFromPatches?: {
                    showTransformed?: boolean;
                    showTransformedBox?: boolean;
                    showBB?: boolean;
                };
            };
        };
        decoder?: {
            readers: string[];
        };
    }

    interface QuaggaResult {
        codeResult: {
            code: string;
            format: string;
        };
        line: any[];
        box: any[];
        boxes: any[];
    }

    interface QuaggaCanvas {
        ctx: {
            overlay: CanvasRenderingContext2D;
        };
        dom: {
            overlay: HTMLCanvasElement;
        };
    }

    interface QuaggaImageDebug {
        drawPath: (path: any[], begin: any, ctx: CanvasRenderingContext2D, style: any) => void;
    }

    interface Quagga {
        init: (config: QuaggaConfig, callback?: (err?: any) => void) => void;
        start: () => void;
        stop: () => void;
        onDetected: (callback: (result: QuaggaResult) => void) => void;
        offDetected: (callback: (result: QuaggaResult) => void) => void;
        onProcessed: (callback: (result: QuaggaResult | null) => void) => void;
        offProcessed: () => void;
        canvas: QuaggaCanvas;
        ImageDebug: QuaggaImageDebug;
    }

    const Quagga: Quagga;
    export default Quagga;
}