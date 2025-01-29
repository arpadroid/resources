export type ResourcePayloadType = Record<string, unknown> | [];

export type ResourceConfigType = {
    id?: string;
    url?: string;
    payload?: ResourcePayloadType;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    pollInterval?: number;
    maxPollCount?: number;
    mode?: 'concurrent' | 'consecutive';
    debounceFetch?: number;
    showLogs?: boolean;
    fetch?: (config: ResourceConfigType) => Promise<ResourceResponseType>;
} 



export type ResourceResponseType = {
    payload?: ResourcePayloadType;
    value?: {
        payload?: ResourcePayloadType;
    };
};


