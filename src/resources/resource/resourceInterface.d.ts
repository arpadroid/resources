export interface ResourceInterface {
    payload?: Record<string, unknown> | [];
    query?: Record<string, string>;
    headers?: Record<string, string>;
    pollInterval?: number;
    maxPollCount?: number;
    mode?: 'concurrent' | 'consecutive';
    debounceFetch?: number;
}
