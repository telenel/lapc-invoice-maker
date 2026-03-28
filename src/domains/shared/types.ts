export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    return new ApiError(res.status, body.error ?? res.statusText);
  }
}

export type AuthSession = {
  user: {
    id: string;
    name: string;
    username: string;
    role: string;
    setupComplete: boolean;
  };
};
