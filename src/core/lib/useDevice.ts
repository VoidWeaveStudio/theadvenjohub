// src/core/lib/useDevice.ts
"use client";

import { useEffect, useState } from "react";
import { DeviceInfo, SERVER_DEVICE_INFO, readDeviceInfo } from "./device";

export interface UseDeviceResult extends DeviceInfo {
  ready: boolean;
}

export function useDevice(): UseDeviceResult {
  const [info, setInfo] = useState<DeviceInfo>(SERVER_DEVICE_INFO);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setInfo(readDeviceInfo());

    sync();
    setReady(true);

    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  return { ...info, ready };
}
