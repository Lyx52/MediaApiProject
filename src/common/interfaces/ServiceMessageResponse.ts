interface ServiceMessageResponse<TResult> {
  success: boolean;
  data?: TResult;
}