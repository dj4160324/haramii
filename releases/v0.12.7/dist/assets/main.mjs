import * as runtime from './vendor/browser/cp-sat.js';
import {optimize} from './optimize.mjs';
export async function run(policy,input,result,options){
 if(!globalThis.crossOriginIsolated||typeof SharedArrayBuffer==='undefined')throw Error('CP-SAT 실행 환경이 아닙니다. 새 탭에서 이 페이지를 열어 주세요.');
 return optimize(policy,input,result,runtime,options);
}
