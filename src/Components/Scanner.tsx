"use client";

import {useState, useEffect, useRef} from "react";
import Quagga from "quagga";
import {Check, X, Award, QrCode} from "lucide-react";
import {useScan, useBonusHistory} from "../api/scan.ts";
import {useTranslation} from 'react-i18next';

declare global {
    interface Window {
        Telegram?: {
            WebApp?: any;
        };
    }
}

export function Scanner() {
    const {t} = useTranslation();
    const [isScanning, setIsScanning] = useState(false);
    const [result, setResult] = useState("");
    const [showSuccessScreen, setShowSuccessScreen] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const isProcessing = useRef(false);
    const [message, setMessage] = useState("");
    const [totalBonuses, setTotalBonuses] = useState(0);
    const [scannedCount, setScannedCount] = useState(0);
    const [todayCount, setTodayCount] = useState(0);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const hasRequestedPermission = useRef(false);
    const firstUpdate = useRef(true);
    const isTelegram = useRef(
        window.Telegram?.WebApp !== undefined ||
        /Telegram/i.test(navigator.userAgent)
    );
    const [browserSupport] = useState(
        !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia
    );

    const scan = useScan();

    const today = new Date().toISOString().split('T')[0];
    const bonusHistory = useBonusHistory({
        from_date: today,
        to_date: today
    });
    const totalBonusHistory = useBonusHistory();

    useEffect(() => {
        if (bonusHistory.data?.pages[0]) {
            setTodayCount(bonusHistory.data.pages[0].count);
        }
        if (totalBonusHistory.data?.pages[0]) {
            setTotalBonuses(totalBonusHistory.data.pages[0].total_bonuses);
            setScannedCount(totalBonusHistory.data.pages[0].count);
        }
    }, [totalBonusHistory.data, bonusHistory.data]);

    const checkCameraPermission = async () => {
        if (hasPermission === true && hasRequestedPermission.current) {
            return true;
        }

        if (hasPermission === false && hasRequestedPermission.current) {
            return false;
        }

        try {
            const status = await navigator.permissions.query({name: 'camera' as PermissionName});

            if (status.state === 'granted') {
                setHasPermission(true);
                hasRequestedPermission.current = true;
                return true;
            } else if (status.state === 'prompt') {
                const result = await requestCameraPermission();
                hasRequestedPermission.current = true;
                return result;
            } else {
                setHasPermission(false);
                hasRequestedPermission.current = true;
                return false;
            }
        } catch (error) {
            const result = await requestCameraPermission();
            hasRequestedPermission.current = true;
            return result;
        }
    };

    const requestCameraPermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment'
                }
            });
            setHasPermission(true);
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (err) {
            console.error("Camera permission error:", err);
            setHasPermission(false);
            return false;
        }
    };

    useEffect(() => {
        if (!hasRequestedPermission.current && browserSupport) {
            checkCameraPermission();
        }
    }, [browserSupport]);

    const openInBrowser = () => {
        window.open(window.location.href, '_blank');
    };

    const handleScan = async (code: string) => {
        if (isProcessing.current || showSuccessScreen || showErrorModal) {
            return;
        }

        try {
            isProcessing.current = true;

            const response = await scan.mutateAsync({barcode_data: code});
            console.log('Scan response:', response);

            if (response.message) {
                const pointsMatch = response.message.match(/\d+/);
                const points = pointsMatch ? pointsMatch[0] : '0';
                setMessage(t('pointsEarned', {points}));
            }

            bonusHistory.refetch();
            totalBonusHistory.refetch();

            setShowSuccessScreen(true);

            setTimeout(() => {
                setShowSuccessScreen(false);
                isProcessing.current = false;
            }, 3000);
        } catch (error: any) {
            console.error('Scan error:', error);

            if (error.response?.data?.detail) {
                const errorMessage = error.response.data.detail;

                if (errorMessage.includes('уже сканировал')) {
                    const userIdMatch = errorMessage.match(/ID (\d+)/);
                    const userId = userIdMatch ? userIdMatch[1] : '';
                    setMessage(t('alreadyScanned', {userId}));
                } else if (errorMessage.includes('нет в базе')) {
                    setMessage(t('barcodeNotFound'));
                } else {
                    setMessage(errorMessage);
                }
            } else if (error.message) {
                setMessage(error.message);
            }

            setShowErrorModal(true);
            setResult("");

            setTimeout(() => {
                setShowErrorModal(false);
                isProcessing.current = false;
            }, 3000);
        }
    };

    const _onDetected = (res: any) => {
        if (isProcessing.current || showSuccessScreen || showErrorModal) {
            return;
        }

        const scannedText = res.codeResult.code;
        
        if (
            !scannedText ||
            scannedText.trim() === "" ||
            scannedText.length < 4 ||
            !/^[A-Za-z0-9-_]+$/.test(scannedText)
        ) {
            return;
        }

        setResult(scannedText);
        handleScan(scannedText);
    };

    const startScanning = () => {
        const scannerContainer = document.querySelector('#scanner-container');
        if (!scannerContainer) {
            console.error('Scanner container not found');
            setShowErrorModal(true);
            return;
        }

        Quagga.init(
            {
                inputStream: {
                    type: 'LiveStream',
                    target: scannerContainer as HTMLElement,
                    constraints: {
                        facingMode: 'environment',
                        width: { min: 1280 },  // Increased resolution
                        height: { min: 720 },  // Increased resolution
                        aspectRatio: { min: 1, max: 2 }
                    }
                },
                numOfWorkers: navigator.hardwareConcurrency,
                locate: true,
                frequency: 10,  // Increased frequency for faster scanning
                debug: {
                    drawBoundingBox: true,
                    showFrequency: true,
                    drawScanline: true,
                    showPattern: true
                },
                multiple: false,
                locator: {
                    halfSample: true,  // Changed to true for better performance
                    patchSize: 'medium',  // Changed to medium for better small barcode detection
                    debug: {
                        showCanvas: false,
                        showPatches: false,
                        showFoundPatches: false,
                        showSkeleton: false,
                        showLabels: false,
                        showPatchLabels: false,
                        showRemainingPatchLabels: false,
                        boxFromPatches: {
                            showTransformed: false,
                            showTransformedBox: false,
                            showBB: false
                        }
                    }
                },
                decoder: {
                    readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader', 'upc_reader'],
                    debug: {
                        drawBoundingBox: true,
                        showFrequency: true,
                        drawScanline: true,
                        showPattern: true
                    }
                }
            },
            (err: any) => {
                if (err) {
                    console.error(err);
                    setShowErrorModal(true);
                    return;
                }
                Quagga.start();
                setIsScanning(true);
            }
        );

        Quagga.onDetected(_onDetected);
        Quagga.onProcessed((result: any) => {
            const canvas = Quagga.canvas;
            if (!canvas) return;

            let drawingCtx = canvas.ctx.overlay,
                drawingCanvas = canvas.dom.overlay;

            if (result) {
                if (result.boxes) {
                    drawingCtx.clearRect(
                        0,
                        0,
                        parseInt(drawingCanvas.getAttribute('width') || '0'),
                        parseInt(drawingCanvas.getAttribute('height') || '0')
                    );
                    result.boxes.filter((box: any) => box !== result.box).forEach((box: any) => {
                        Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, {
                            color: 'green',
                            lineWidth: 2
                        });
                    });
                }

                if (result.box) {
                    Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: '#00F', lineWidth: 2 });
                }

                if (result.codeResult && result.codeResult.code) {
                    Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 3 });
                }
            }
        });
    };

    const stopScanning = () => {
        if (typeof Quagga !== 'undefined') {
            try {
                if (Quagga.canvas) {
                    Quagga.offProcessed();
                    Quagga.offDetected(_onDetected);
                }
                Quagga.stop();
            } catch (error) {
                console.error('Error stopping Quagga:', error);
            }
        }
        setIsScanning(false);
    };

    useEffect(() => {
        if (firstUpdate.current) {
            firstUpdate.current = false;
            return;
        }

        if (isScanning) {
            startScanning();
        } else {
            stopScanning();
        }
    }, [isScanning]);

    useEffect(() => {
        return () => {
            if (isScanning && typeof Quagga !== 'undefined') {
                try {
                    stopScanning();
                } catch (error) {
                    console.error('Error in cleanup:', error);
                }
            }
        };
    }, []);

    const handleReset = () => {
        isProcessing.current = false;
        setResult("");
        setIsScanning(false);
        setShowSuccessScreen(false);
        setShowErrorModal(false);
    };

    useEffect(() => {
        // Add global styles for Quagga video
        const style = document.createElement('style');
        style.textContent = `
            #scanner-container {
                position: relative;
                width: 100%;
                height: 300px;
                overflow: hidden;
            }
            #scanner-container > video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            #scanner-container > canvas {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 100%;
                height: 100%;
            }
            .drawingBuffer {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 100%;
                height: 100%;
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);

    if (!browserSupport) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg mb-4">
                    <X className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-2"/>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {t('browserNotSupported')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {t('browserNotSupportedMessage')}
                </p>
                {isTelegram.current && (
                    <button
                        onClick={openInBrowser}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        {t('openInBrowser')}
                    </button>
                )}
            </div>
        );
    }

    if (hasPermission === false) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg mb-4">
                    <X className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-2"/>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {t('cameraPermission')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {t('cameraPermissionMessage')}
                </p>
                {isTelegram.current && (
                    <button
                        onClick={openInBrowser}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        {t('openInBrowser')}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-md mx-auto mb-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-gray-500 dark:text-gray-400">{t('totalPoints')}</h3>
                                <div className="flex items-center space-x-2 mt-2">
                                    <Award className="w-5 h-5 text-blue-500"/>
                                    <span className="text-2xl font-bold text-gray-800 dark:text-white">
                    {totalBonuses.toLocaleString()}
                  </span>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-gray-200 dark:bg-gray-700"/>

                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-gray-500 dark:text-gray-400">{t('scannedCodes')}</h3>
                                <div className="flex items-center space-x-2 mt-2">
                                    <QrCode className="w-5 h-5 text-purple-500"/>
                                    <span className="text-2xl font-bold text-gray-800 dark:text-white">
                    {scannedCount.toLocaleString()}
                  </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    ({t('today')}: {todayCount})
                  </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showSuccessScreen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 pointer-events-none">
                    <div className="bg-green-500 rounded-2xl p-9 m-4 shadow-lg animate-scale-in pointer-events-auto">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute w-32 h-32 bg-green-400/20 rounded-full animate-pulse"/>
                            <div className="absolute w-24 h-24 bg-green-400/30 rounded-full animate-pulse delay-75"/>
                            <div
                                className="relative w-16 h-16 bg-white rounded-full flex items-center justify-center animate-fadeIn">
                                <Check className="w-8 h-8 text-green-500 animate-checkmark"/>
                            </div>
                        </div>
                        <div className="mt-8 text-center space-y-2 animate-fadeIn delay-200">
                            <h1 className="text-white text-2xl font-medium">
                                {t('success')}
                            </h1>
                            <p className="text-green-100 text-lg">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-md mx-auto">
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <button
                        onClick={() => setIsScanning(prev => !prev)}
                        className="w-full py-3 bg-blue-500 dark:bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                    >
                        {isScanning ? t('stop') : t('scan')}
                    </button>
                    <button
                        onClick={handleReset}
                        className="w-full py-3 bg-red-500 dark:bg-red-600 text-white rounded-lg font-medium hover:bg-red-600 dark:hover:bg-red-700"
                    >
                        {t('reset')}
                    </button>
                </div>

                <div className="mb-4 relative" style={{ minHeight: "300px" }}>
                    <div
                        id="scanner-container"
                        className="absolute inset-0 w-full h-full rounded-lg border-2 border-gray-300 dark:border-gray-700 overflow-hidden"
                        style={{
                            position: 'relative',
                            width: '100%',
                            minHeight: '300px'
                        }}
                    >
                        {/* Quagga will inject the video element here */}
                    </div>
                </div>

                {result && (
                    <div className="mb-4">
            <pre
                className="p-4 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700">
              <code>{result}</code>
            </pre>
                    </div>
                )}
            </div>

            {showErrorModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                                <X className="w-6 h-6 text-red-600 dark:text-red-400"/>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-center mb-2 text-gray-900 dark:text-gray-100">
                            {t('error')}
                        </h3>
                        <p className="text-center mb-4 text-gray-700 dark:text-gray-300">
                            {message || t('scanError')}
                        </p>
                        <button
                            onClick={() => setShowErrorModal(false)}
                            className="w-full py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-700"
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
