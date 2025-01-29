import type ListFilter from './listFilter';

export type ListFilterOptionType = {
    value: unknown;
    label?: string;
    isActive?: boolean;
};

export type ListFilterOptionsType = ListFilterOptionType[];

export interface ListFilterConfigType {
    alias?: string;
    allowClear?: boolean;
    defaultValue?: unknown;
    queryName?: string;
    isURLFilter?: boolean;
    isOnlyURLFilter?: boolean;
    isRequestFilter?: boolean;
    urlParamName?: string;
    hasLocalStorage?: boolean;
    preProcessor?: (value: unknown) => unknown;
    canClear?: boolean;
    callback?: (value: unknown, key?: string, filter?: ListFilter) => void;
    preProcessQueryParam?: (value: unknown) => void;
    preProcessValue?: (value: unknown, filter: ListFilter) => void;
}
