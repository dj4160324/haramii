import {
  createRuntimeLoader
} from "./runtime_loader_core.js";
import { isJspiSupported } from "./runtime_loader_core.js";
const loader = createRuntimeLoader({
  logFlavorSelection: !0,
  async loadFactory(runtimeUrl) {
    const { default: createModule } = await import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      runtimeUrl
    );
    return createModule;
  }
}), terminateLoadedRuntimeThreads = loader.terminateLoadedRuntimeThreads;
function loadBrowserRuntime(name, resolveAsset, flavor) {
  return loader.loadRuntime(name, (selectedFlavor) => {
    const isolated = globalThis.crossOriginIsolated, sharedMemory = typeof globalThis.SharedArrayBuffer == "function";
    if (isolated !== !0 || !sharedMemory) {
      const placement = typeof document > "u" ? "browser-worker" : "browser-main";
      throw new Error(
        `Threaded OR-Tools WASM requires a cross-origin-isolated page and SharedArrayBuffer. crossOriginIsolated=${String(isolated)}, SharedArrayBuffer=${sharedMemory ? "available" : "unavailable"}, isSecureContext=${String(globalThis.isSecureContext)}; runtime=${name}, flavor=${selectedFlavor}, placement=${placement}. Configure compatible Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Embedder-Policy (COEP) response headers (for example, same-origin and require-corp) and serve over HTTPS or localhost. These runtimes require shared memory even with one search worker.`
      );
    }
    const asset = resolveAsset(selectedFlavor), baseName = selectedFlavor === "asyncify" ? `${name}_asyncify` : name;
    return {
      jsUrl: asset.jsUrl,
      // Let Emscripten compile the response as it streams instead of buffering it.
      locateFile: (file) => file === `${baseName}.wasm` ? asset.wasmUrl : file === `${baseName}.js` ? asset.jsUrl : file,
      mainScriptUrlOrBlob: asset.jsUrl
    };
  }, flavor);
}
export {
  isJspiSupported,
  loadBrowserRuntime,
  terminateLoadedRuntimeThreads
};
