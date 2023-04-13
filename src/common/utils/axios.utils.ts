import { catchError, retry, timer } from "rxjs";
import { AxiosError } from "axios/index";

export function backoffDelay(retryAttempt: number): number {
  return Math.min(10000, Math.pow(2, retryAttempt) * 1000);
}
export function retryPolicy() {
  return retry({ delay: (error, index) => timer(backoffDelay(index)), resetOnSuccess: true, count: 3 });
}
export function handleAxiosExceptions() {
  return catchError((error: AxiosError) => {
    if (error.response) {
      // Server responded with a non-2xx status code
      const { status, data } = error.response;
      throw `Request failed with status code ${status}: ${data}`;
    } else if (error.request) {
      // No response was received from the server
      throw 'Request failed: no response received from server';
    }
    throw `Request failed: client-side error ${error}`;
  });
}
export function makeBasicAuthHeader(username: string, password: string): object {
  return {
    Authorization: `Basic ${Buffer.from(
      `${username}:${password}`,
    ).toString('base64')}`,
  };
}