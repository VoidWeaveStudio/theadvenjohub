//src\core\types\api.ts
export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
  status?: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}
export interface ApiErrorResponse {
  error: string;
  details?: Record<string, string[]>;
  code?: string;
  status?: number;
}

export interface ApiSuccessResponse<T> {
  data: T;
  error?: never;
  success?: true;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
