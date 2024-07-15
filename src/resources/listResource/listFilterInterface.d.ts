export interface ListFilterInterface {
    alias?: string;
    defaultValue?: unknown;
    queryName?: string;
    isURLFilter?: boolean;
    isOnlyURLFilter?: boolean;
    isRequestFilter?: boolean;
    urlParamName?: string;
    hasLocalStorage?: boolean;
    canClear?: boolean;
    callback?: (value, key, filter) => void;
    preProcessQueryParam?: (value) => void;
    preProcessValue?: (value, filter) => void;
}
